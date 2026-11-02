/**
 * DEV ONLY. With SOCIAL_FAKE_API=1 every call to X, Meta and TikTok is answered here, so the scheduler,
 * OAuth callbacks and the metrics collector can be exercised end to end on `wrangler dev` without real
 * accounts. Never set SOCIAL_FAKE_API in production.
 */
import type { Bindings } from '../env';

export const fakeLog: { at: string; method: string; url: string }[] = [];

const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return Math.abs(h); };
const grow = (id: string, base: number) => Math.round((base + (hash(id) % base)) * (1 - Math.exp(-((Date.now() / 3600_000) % 240) / 30)) + (hash(id) % 7));
const newId = () => String(1_800_000_000_000_000_000n + BigInt(Math.floor(Math.random() * 1e15)));

export async function fakeFetch(_env: Bindings, url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const u = new URL(url);
  fakeLog.push({ at: new Date().toISOString(), method, url: `${u.host}${u.pathname}` });
  if (fakeLog.length > 200) fakeLog.shift();
  console.log(`[social:fake] ${method} ${u.host}${u.pathname}`);
  const p = u.pathname;

  /* X */
  if (u.host === 'api.x.com') {
    if (p === '/2/media/upload' && method === 'POST') return ok({ data: { id: newId(), media_key: '3_' + newId() } });
    if (p === '/2/media/upload/initialize') return ok({ data: { id: newId(), expires_after_secs: 86400 } });
    if (/\/append$/.test(p)) return ok({ data: { expires_at: Date.now() / 1000 + 86400 } });
    if (/\/finalize$/.test(p)) return ok({ data: { id: p.split('/')[4], processing_info: { state: 'pending', check_after_secs: 1 } } });
    if (p === '/2/media/upload' && method === 'GET') return ok({ data: { processing_info: { state: 'succeeded' } } });
    if (p === '/2/tweets' && method === 'POST') return ok({ data: { id: newId(), text: JSON.parse(String(init.body ?? '{}')).text } }, 201);
    if (p === '/2/tweets') {
      const ids = (u.searchParams.get('ids') ?? '').split(',').filter(Boolean);
      return ok({ data: ids.map((id) => ({ id, public_metrics: { impression_count: grow(id, 2400), like_count: grow(id, 40), reply_count: grow(id, 6), retweet_count: grow(id, 8), quote_count: grow(id, 2), bookmark_count: grow(id, 9) }, non_public_metrics: { url_link_clicks: grow(id, 15), user_profile_clicks: grow(id, 10) } })) });
    }
    if (p === '/2/users/me') return ok({ data: { id: '1', username: 'ferrnagency', public_metrics: { followers_count: 1200 + (Math.floor(Date.now() / 864e5) % 50), following_count: 310, tweet_count: 420 } } });
  }

  /* Meta / Instagram */
  if (u.host === 'graph.facebook.com') {
    if (p.endsWith('/oauth/access_token')) return ok({ access_token: 'fake-meta-user-token', token_type: 'bearer', expires_in: 5184000 });
    if (p.endsWith('/me/accounts')) return ok({ data: [{ id: '55', name: 'Ferrn Digital Agency', access_token: 'fake-page-token', instagram_business_account: { id: '1784000000000', username: 'ferrnagency' } }] });
    if (p.endsWith('/media') && method === 'POST') return ok({ id: 'c' + newId() });
    if (p.endsWith('/media_publish')) return ok({ id: newId() });
    if (p.endsWith('/insights')) {
      const id = p.split('/')[2];
      return ok({ data: ['reach', 'likes', 'comments', 'saved', 'shares', 'views', 'total_interactions'].map((name, i) => ({ name, period: 'lifetime', values: [{ value: grow(id + name, [1800, 90, 12, 25, 14, 3200, 140][i]) }] })) });
    }
    const fields = u.searchParams.get('fields') ?? '';
    if (fields.includes('status_code')) return ok({ status_code: 'FINISHED', id: p.split('/')[2] });
    if (fields.includes('permalink')) return ok({ permalink: `https://www.instagram.com/p/FAKE${p.split('/')[2].slice(-6)}/` });
    if (fields.includes('followers_count')) return ok({ username: 'ferrnagency', followers_count: 3400 + (Math.floor(Date.now() / 864e5) % 90), follows_count: 210, media_count: 160 });
  }

  /* TikTok */
  if (u.host === 'open.tiktokapis.com') {
    const t = (data: unknown) => ok({ data, error: { code: 'ok', message: '', log_id: 'fake' } });
    if (p === '/v2/oauth/token/') return ok({ access_token: 'fake-tt-access', refresh_token: 'fake-tt-refresh', open_id: 'fake-open-id', scope: 'user.info.basic,video.publish,video.upload,video.list,user.info.stats', expires_in: 86400, refresh_expires_in: 31536000, token_type: 'Bearer' });
    if (p === '/v2/post/publish/creator_info/query/') return t({ creator_username: 'ferrnagency', creator_nickname: 'Ferrn Agency', creator_avatar_url: '', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 600 });
    if (p === '/v2/post/publish/video/init/' || p === '/v2/post/publish/content/init/') return t({ publish_id: 'v_pub_' + newId() });
    if (p === '/v2/post/publish/status/fetch/') return t({ status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [Number(newId().slice(0, 15))] });
    if (p === '/v2/video/query/') {
      const ids: string[] = JSON.parse(String(init.body ?? '{}'))?.filters?.video_ids ?? [];
      return t({ videos: ids.map((id) => ({ id, view_count: grow(id, 5200), like_count: grow(id, 300), comment_count: grow(id, 20), share_count: grow(id, 30) })) });
    }
    if (p === '/v2/user/info/') return t({ user: { open_id: 'fake-open-id', username: 'ferrnagency', follower_count: 860 + (Math.floor(Date.now() / 864e5) % 40), following_count: 40, video_count: 70 } });
  }

  /* our own public media URLs */
  if (p.startsWith('/media/')) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { headers: { 'content-type': 'image/jpeg' } });
  return ok({ error: { message: `fake: no stub for ${method} ${u.host}${p}` } }, 404);
}
