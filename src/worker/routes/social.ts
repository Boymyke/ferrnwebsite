/**
 * Social auto-posting API.
 *   Studio (signed in):  /api/studio/social/*   (mounted from studio-api.ts, so requireUser applies)
 *   Public OAuth return: /api/social/callback/:platform
 */
import { Hono } from 'hono';
import type { AppEnv, SessionUser } from '../lib/env';
import { all, clamp, first, newId, run, setSetting } from '../lib/db';
import { audit } from '../lib/audit';
import { randomToken } from '../lib/db';
import { PLATFORMS, lagosDay, putToken, tokenMeta, type Platform, type PostRow } from '../lib/social/common';
import { SocialError, redact } from '../lib/social/http';
import { CONNECTORS, dailyCaps, postedLast24h, publishOne, runScheduler } from '../lib/social/scheduler';
import { accountSnapshot, dashboard, postSeries, recordMetrics, runCollector } from '../lib/social/metrics';
import { META_SCOPES, igAuth, metaAuthorizeUrl, metaExchange } from '../lib/social/instagram';
import { TIKTOK_SCOPES, creatorInfo, tiktokAudited, tiktokAuthorizeUrl, tiktokExchange } from '../lib/social/tiktok';
import { fakeLog } from '../lib/social/fake';

const RANK: Record<string, number> = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 };
const can = (u: SessionUser | null, role: SessionUser['role']) => !!u && RANK[u.role] >= RANK[role];
const isPlatform = (p: string): p is Platform => (PLATFORMS as string[]).includes(p);
const NAMES: Record<Platform, string> = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok' };
const callbackUrl = (reqUrl: string, p: Platform) => `${new URL(reqUrl).origin}/api/social/callback/${p}`;

export const socialStudio = new Hono<AppEnv>();

/* ── connections ── */
socialStudio.get('/connections', async (c): Promise<Response> => {
  const e = c.env;
  const caps = await dailyCaps(e);
  const out = [];
  for (const p of PLATFORMS) {
    const meta = p === 'x' ? null : await tokenMeta(e, p).catch(() => null);
    const snap = await first<{ day: string; followers: number; raw_json: string; source: string }>(e.DB, 'SELECT day, followers, raw_json, source FROM social_accounts_daily WHERE platform = ? ORDER BY day DESC LIMIT 1', p);
    const username = (() => { try { return JSON.parse(snap?.raw_json ?? '{}')?.username; } catch { return null; } })();
    const metricsErr = await e.CACHE.get(`social:metrics_err:${p}`, 'json').catch(() => null) as { at: string; error: string } | null;
    let missing: string[] = [], connected = false, account: string | null = null, how: 'keys' | 'oauth' | 'keys_or_oauth' = 'keys', canConnect = false;
    const notes: string[] = [];
    let scopes: string[] = [];
    if (p === 'x') {
      missing = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'].filter((k) => !(e as any)[k]);
      connected = !missing.length; account = username ? `@${username}` : null;
      scopes = ['App permissions: Read and write', 'OAuth 1.0a access token for the Ferrn account'];
      notes.push('Pay-per-use: about $0.015 per post, $0.20 if the post contains a link; reads are billed too. Top up credits at console.x.com.');
    } else if (p === 'instagram') {
      how = 'keys_or_oauth';
      const env = !!(e.META_ACCESS_TOKEN && e.IG_USER_ID);
      connected = env || !!(meta && (await igAuth(e).catch(() => null)));
      account = meta?.account_name ?? (username ? `@${username}` : null);
      canConnect = !!(e.META_APP_ID && e.META_APP_SECRET && e.SOCIAL_ENC_KEY);
      if (!connected) missing = env ? [] : ['IG_USER_ID + META_ACCESS_TOKEN', ...(canConnect ? [] : ['or META_APP_ID + META_APP_SECRET + SOCIAL_ENC_KEY to connect here'])];
      scopes = META_SCOPES;
      notes.push('Images must be JPEG. Every Instagram post needs an image or video; posts without media wait as “Needs media”.');
    } else {
      how = 'oauth';
      canConnect = !!(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET && e.SOCIAL_ENC_KEY);
      connected = canConnect && !!meta;
      account = meta?.account_name ?? null;
      if (!canConnect) missing = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'SOCIAL_ENC_KEY'].filter((k) => !(e as any)[k]);
      scopes = TIKTOK_SCOPES;
      if (!tiktokAudited(e)) notes.push('App not audited yet: TikTok only allows private (“Only me”) posts. Make each one public in the TikTok app, or finish the audit and set TIKTOK_AUDITED=1.');
      if (!connected) notes.push('Until connected, TikTok posts are manual: open a post and use “Copy caption” + “Download video”.');
      if (meta?.refresh_expires_at) notes.push(`Login renews automatically until ${meta.refresh_expires_at.slice(0, 10)}.`);
    }
    out.push({
      platform: p, name: NAMES[p], connected, mode: connected ? 'api' : 'manual', how, can_connect: canConnect, account, missing, scopes, notes,
      connected_by: meta?.connected_by ?? null, connected_at: meta?.updated_at ?? null,
      cap: caps[p], posted_24h: await postedLast24h(e, p), metrics_error: metricsErr, followers: snap ? { day: snap.day, value: snap.followers, source: snap.source } : null,
    });
  }
  return c.json({ ok: true, rows: out, fake: e.SOCIAL_FAKE_API === '1', enc_key: !!e.SOCIAL_ENC_KEY });
});

socialStudio.get('/connect/:platform', async (c): Promise<Response> => {
  const u = c.get('user')!; const p = c.req.param('platform');
  if (!can(u, 'admin')) return c.text('Only admins can connect accounts.', 403);
  if (!isPlatform(p) || p === 'x') return c.text('X uses the keys from the X Developer Console. Add them as Cloudflare secrets (docs/SOCIAL.md).', 400);
  if (!c.env.SOCIAL_ENC_KEY) return c.text('Set the SOCIAL_ENC_KEY secret first (docs/SOCIAL.md).', 400);
  const state = randomToken(24);
  await c.env.CACHE.put(`social:oauth:${state}`, JSON.stringify({ platform: p, by: u.name, uid: u.id }), { expirationTtl: 600 });
  const redirect = callbackUrl(c.req.url, p);
  if (p === 'tiktok') {
    if (!c.env.TIKTOK_CLIENT_KEY || !c.env.TIKTOK_CLIENT_SECRET) return c.text('Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET first.', 400);
    return c.redirect(c.env.SOCIAL_FAKE_API === '1' ? `${redirect}?code=fake&state=${state}` : tiktokAuthorizeUrl(c.env, redirect, state));
  }
  if (!c.env.META_APP_ID || !c.env.META_APP_SECRET) return c.text('Set META_APP_ID and META_APP_SECRET first, or set IG_USER_ID + META_ACCESS_TOKEN.', 400);
  return c.redirect(c.env.SOCIAL_FAKE_API === '1' ? `${redirect}?code=fake&state=${state}` : metaAuthorizeUrl(c.env, redirect, state));
});

socialStudio.post('/disconnect/:platform', async (c): Promise<Response> => {
  const u = c.get('user')!; const p = c.req.param('platform');
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Only admins can disconnect accounts.' }, 403);
  if (!isPlatform(p)) return c.json({ ok: false }, 404);
  await run(c.env.DB, 'DELETE FROM social_tokens WHERE platform = ?', p);
  await audit(c, 'social_tokens', p, 'disconnect', `${u.name} disconnected ${NAMES[p]}`);
  return c.json({ ok: true });
});

/** Live check: reads the account (follower count). Costs one read on X. */
socialStudio.post('/test/:platform', async (c): Promise<Response> => {
  const u = c.get('user')!; const p = c.req.param('platform');
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  if (!isPlatform(p)) return c.json({ ok: false }, 404);
  try {
    const s = await CONNECTORS[p].accountStats(c.env);
    return c.json({ ok: true, followers: s.followers, account: (s.raw as any)?.username ?? null });
  } catch (e: any) { return c.json({ ok: false, error: redact(e?.message ?? String(e)) }, 400); }
});

socialStudio.get('/tiktok/creator', async (c): Promise<Response> => {
  if (!(await CONNECTORS.tiktok.configured(c.env).catch(() => false))) return c.json({ ok: true, connected: false, audited: tiktokAudited(c.env) });
  try {
    const i = await creatorInfo(c.env);
    return c.json({ ok: true, connected: true, audited: tiktokAudited(c.env), nickname: i.creator_nickname, username: i.creator_username, avatar: i.creator_avatar_url,
      privacy_level_options: i.privacy_level_options, comment_disabled: i.comment_disabled, max_video_post_duration_sec: i.max_video_post_duration_sec });
  } catch (e: any) { return c.json({ ok: false, error: redact(e?.message ?? String(e)) }, 400); }
});

socialStudio.put('/caps', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, number>;
  const caps = Object.fromEntries(PLATFORMS.filter((p) => Number(b[p]) > 0).map((p) => [p, Math.min(Math.round(Number(b[p])), 100)]));
  await setSetting(c.env.DB, 'social_daily_caps', JSON.stringify(caps), u.name);
  await audit(c, 'settings', 'social_daily_caps', 'update', `${u.name} changed social daily caps`, null, caps);
  return c.json({ ok: true, caps: await dailyCaps(c.env) });
});

/* ── posts ── */
socialStudio.post('/posts/:id/publish', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  const post = await first<PostRow>(c.env.DB, 'SELECT * FROM content_posts WHERE id = ?', c.req.param('id'));
  if (!post) return c.json({ ok: false, error: 'Not found' }, 404);
  if (post.external_id) return c.json({ ok: false, error: 'This post is already live.', url: post.post_url }, 409);
  if (!isPlatform(post.platform)) return c.json({ ok: false, error: `Auto-posting is not available for ${post.platform}.` }, 400);
  // A manual retry starts a fresh round of attempts.
  await run(c.env.DB, `UPDATE content_posts SET attempts = 0, next_attempt_at = NULL,
      publish_state = CASE WHEN publish_state IN ('processing','publishing') THEN publish_state ELSE NULL END,
      status = CASE WHEN status = 'failed' THEN 'approved' ELSE status END WHERE id = ?`, post.id);
  const fresh = (await first<PostRow>(c.env.DB, 'SELECT * FROM content_posts WHERE id = ?', post.id))!;
  const r = await publishOne(c.env, fresh, { force: true });
  await audit(c, 'content_posts', post.id, 'publish', `${u.name} pressed Post now on ${NAMES[post.platform]}: ${r.state}${r.message ? ` (${r.message})` : ''}`.slice(0, 480));
  const row = await first(c.env.DB, 'SELECT * FROM content_posts WHERE id = ?', post.id);
  return c.json({ ok: r.state !== 'failed', ...r, error: r.state === 'failed' ? r.message : undefined, row }, r.state === 'failed' ? 422 : 200);
});

socialStudio.get('/posts/:id/metrics', async (c): Promise<Response> => c.json({ ok: true, rows: await postSeries(c.env, c.req.param('id')) }));

/** Manual numbers (unconnected platforms, or extra fields like leads): stored as a snapshot too, so charts work. */
socialStudio.post('/posts/:id/metrics', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  const post = await first<{ id: string; platform: string; metrics_json: string; title: string }>(c.env.DB, 'SELECT id, platform, metrics_json, title FROM content_posts WHERE id = ?', c.req.param('id'));
  if (!post) return c.json({ ok: false }, 404);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const n = (k: string) => (b[k] === '' || b[k] == null || Number.isNaN(Number(b[k])) ? null : Math.max(0, Math.round(Number(b[k]))));
  const m = { impressions: n('impressions'), reach: n('reach'), views: n('views'), likes: n('likes'), comments: n('comments'), shares: n('shares'), saves: n('saves'), clicks: n('clicks') };
  if (Object.values(m).some((v) => v != null)) await recordMetrics(c.env, post.id, post.platform, m, 'manual');
  if (b.leads !== undefined) {
    const cur = JSON.parse((await first<{ metrics_json: string }>(c.env.DB, 'SELECT metrics_json FROM content_posts WHERE id = ?', post.id))?.metrics_json || '{}');
    cur.leads = n('leads') ?? 0;
    await run(c.env.DB, 'UPDATE content_posts SET metrics_json = ? WHERE id = ?', JSON.stringify(cur), post.id);
  }
  await audit(c, 'content_posts', post.id, 'metrics', `${u.name} entered results for “${String(post.title ?? '').slice(0, 60)}”`, null, b);
  return c.json({ ok: true, row: await first(c.env.DB, 'SELECT * FROM content_posts WHERE id = ?', post.id) });
});

socialStudio.post('/followers', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { platform?: string; followers?: number; day?: string };
  const p = String(b.platform ?? '');
  if (!isPlatform(p) || !(Number(b.followers) >= 0)) return c.json({ ok: false, error: 'Platform and follower count are required.' }, 422);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day)) ? String(b.day) : lagosDay();
  await run(c.env.DB, `INSERT INTO social_accounts_daily (platform, day, followers, source) VALUES (?,?,?, 'manual')
    ON CONFLICT(platform, day) DO UPDATE SET followers = excluded.followers, source = 'manual' WHERE social_accounts_daily.source = 'manual'`, p, day, Math.round(Number(b.followers)));
  await audit(c, 'social_accounts_daily', `${p}:${day}`, 'update', `${u.name} logged ${b.followers} ${NAMES[p]} followers for ${day}`);
  return c.json({ ok: true });
});

socialStudio.get('/dashboard', async (c): Promise<Response> =>
  c.json({ ok: true, ...(await dashboard(c.env, { days: Number(c.req.query('days') ?? 30), platform: c.req.query('platform') })) }));

/** Runs the scheduler and collector now (same code as the cron). */
socialStudio.post('/run', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Admins only' }, 403);
  const published = await runScheduler(c.env);
  const metrics = await runCollector(c.env);
  const accounts = await accountSnapshot(c.env);
  return c.json({ ok: true, published, metrics, accounts });
});

/* ── media upload straight to R2 (streamed, so videos don't sit in Worker memory) ──
 * Cloudflare caps a request body at 100 MB on Free/Pro plans (200 MB Business, 500 MB Enterprise).
 * Files up to 95 MB go in one PUT; bigger files use R2 multipart upload in 50 MB parts from the browser. */
const MEDIA_TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/;
const ONE_SHOT_MAX = 95 * 1024 * 1024;
const mediaKey = (name: string, type: string) => {
  const ext = (name.split('.').pop() || (type.split('/')[1] ?? 'bin')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  return `social/${new Date().toISOString().slice(0, 7)}/${newId()}.${ext === 'quicktime' ? 'mov' : ext}`;
};
const mediaGuard = (c: any) => {
  const u = c.get('user') as SessionUser;
  if (!can(u, 'editor')) return 'No access';
  const type = String(c.req.query('type') ?? '');
  if (!MEDIA_TYPES.test(type)) return 'Upload JPEG, PNG, WebP or GIF images, or MP4, MOV or WebM video.';
  return null;
};

socialStudio.put('/media', async (c): Promise<Response> => {
  const bad = mediaGuard(c); if (bad) return c.json({ ok: false, error: bad }, 400);
  const u = c.get('user')!;
  const len = Number(c.req.header('content-length') ?? 0);
  if (!len) return c.json({ ok: false, error: 'Missing Content-Length' }, 411);
  if (len > ONE_SHOT_MAX) return c.json({ ok: false, error: 'Files over 95 MB must use the multipart upload.' }, 413);
  const type = c.req.query('type')!; const name = clamp(c.req.query('name') ?? 'file', 120);
  const key = mediaKey(name, type);
  await c.env.MEDIA.put(key, c.req.raw.body!, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { by: u.name, name } });
  await audit(c, 'media', key, 'upload', `${u.name} uploaded ${name} for social`);
  return c.json({ ok: true, key, url: `/media/${key}`, type: type.startsWith('video') ? 'video' : 'image', size: len });
});

socialStudio.post('/media/mpu', async (c): Promise<Response> => {
  const bad = mediaGuard(c); if (bad) return c.json({ ok: false, error: bad }, 400);
  const u = c.get('user')!;
  const type = c.req.query('type')!; const name = clamp(c.req.query('name') ?? 'file', 120);
  const key = mediaKey(name, type);
  const mpu = await c.env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { by: u.name, name } });
  return c.json({ ok: true, key, uploadId: mpu.uploadId });
});
socialStudio.put('/media/mpu/part', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  const key = String(c.req.query('key') ?? ''); const uploadId = String(c.req.query('uploadId') ?? ''); const part = Number(c.req.query('part'));
  if (!key.startsWith('social/') || !uploadId || !(part >= 1 && part <= 10000)) return c.json({ ok: false, error: 'Bad part' }, 400);
  if (Number(c.req.header('content-length') ?? 0) > ONE_SHOT_MAX) return c.json({ ok: false, error: 'Part too large' }, 413);
  const r = await c.env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(part, c.req.raw.body!);
  return c.json({ ok: true, partNumber: r.partNumber, etag: r.etag });
});
socialStudio.post('/media/mpu/complete', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { key?: string; uploadId?: string; parts?: { partNumber: number; etag: string }[]; abort?: boolean };
  if (!b.key?.startsWith('social/') || !b.uploadId) return c.json({ ok: false, error: 'Bad upload' }, 400);
  const mpu = c.env.MEDIA.resumeMultipartUpload(b.key, b.uploadId);
  if (b.abort) { await mpu.abort(); return c.json({ ok: true }); }
  const obj = await mpu.complete(b.parts ?? []);
  await audit(c, 'media', b.key, 'upload', `${u.name} uploaded a large video for social (${Math.round(obj.size / 1048576)} MB)`);
  return c.json({ ok: true, key: b.key, url: `/media/${b.key}`, type: (obj.httpMetadata?.contentType ?? '').startsWith('video') ? 'video' : 'image', size: obj.size });
});

/* dev only: what the stubbed APIs were asked */
socialStudio.get('/dev/fake-log', (c) => (c.env.SOCIAL_FAKE_API === '1' ? c.json({ ok: true, calls: fakeLog }) : c.json({ ok: false }, 404)));

/* ── public OAuth callback ── */
export const socialPublic = new Hono<AppEnv>();
socialPublic.get('/callback/:platform', async (c): Promise<Response> => {
  const p = c.req.param('platform');
  const back = (msg: string, ok: boolean) => c.redirect(`/studio/content?tab=performance&social=${ok ? 'connected' : 'error'}&platform=${p}&msg=${encodeURIComponent(msg.slice(0, 240))}`);
  if (!isPlatform(p) || p === 'x') return c.text('Unknown platform', 404);
  const state = c.req.query('state') ?? '';
  const saved = state ? await c.env.CACHE.get(`social:oauth:${state}`, 'json') as { platform: string; by: string; uid: string } | null : null;
  if (!saved || saved.platform !== p) return back('This connect link expired. Try again from Studio.', false);
  await c.env.CACHE.delete(`social:oauth:${state}`);
  if (c.req.query('error')) return back(`${p === 'tiktok' ? 'TikTok' : 'Meta'} said: ${c.req.query('error_description') ?? c.req.query('error')}`, false);
  const code = c.req.query('code');
  if (!code) return back('No authorisation code came back.', false);
  try {
    const redirect = callbackUrl(c.req.url, p);
    if (p === 'tiktok') {
      const t = await tiktokExchange(c.env, code, redirect);
      const missing = TIKTOK_SCOPES.filter((s) => !(t.scopes ?? '').split(',').includes(s));
      await putToken(c.env, 'tiktok', t, saved.by);
      try { const i = await creatorInfo(c.env); await run(c.env.DB, 'UPDATE social_tokens SET account_name = ? WHERE platform = ?', `@${i.creator_username} (${i.creator_nickname})`, 'tiktok'); } catch { /* name is cosmetic */ }
      await run(c.env.DB, `INSERT INTO audit_log (user_id, user_name, entity, entity_id, action, summary) VALUES (?, ?, 'social_tokens', 'tiktok', 'connect', ?)`, saved.uid, saved.by, `${saved.by} connected TikTok`);
      return back(missing.length ? `Connected, but these scopes were not granted: ${missing.join(', ')}` : 'TikTok connected', true);
    }
    const t = await metaExchange(c.env, code, redirect);
    await putToken(c.env, 'instagram', t, saved.by);
    await run(c.env.DB, `INSERT INTO audit_log (user_id, user_name, entity, entity_id, action, summary) VALUES (?, ?, 'social_tokens', 'instagram', 'connect', ?)`, saved.uid, saved.by, `${saved.by} connected Instagram ${t.account_name}`);
    return back(`Instagram connected: ${t.account_name}`, true);
  } catch (e: any) {
    const msg = e instanceof SocialError ? e.message : redact(String(e?.message ?? e));
    console.warn('social oauth callback failed', p, msg);
    return back(msg, false);
  }
});
