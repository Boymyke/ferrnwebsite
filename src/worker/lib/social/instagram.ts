/**
 * Instagram connector: Instagram API with Facebook Login (graph.facebook.com).
 * Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
 * Insights:   https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/
 * Media must be at a public HTTPS URL (SITE_URL/media/...). Images must be JPEG.
 */
import type { Bindings } from '../env';
import { getToken, type Connector, type MediaItem, type MetricsResult, type PostRow, type PublishCtx, type PublishResult, captionOf } from './common';
import { json, sfetch, sleep, SocialError } from './http';

const graph = (env: Bindings) => `https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v25.0'}`;

export async function igAuth(env: Bindings): Promise<{ token: string; igId: string } | null> {
  if (env.META_ACCESS_TOKEN && env.IG_USER_ID) return { token: env.META_ACCESS_TOKEN, igId: env.IG_USER_ID };
  const t = await getToken(env, 'instagram');
  if (t?.access_token && (t.account_id || env.IG_USER_ID)) return { token: t.access_token, igId: env.IG_USER_ID || t.account_id! };
  return null;
}
async function auth(env: Bindings) {
  const a = await igAuth(env);
  if (!a) throw new SocialError('Instagram is not connected: set IG_USER_ID + META_ACCESS_TOKEN, or use Connect Instagram in Studio.', { retryable: false });
  return a;
}

async function gpost(env: Bindings, path: string, params: Record<string, string>, what: string) {
  const { token } = await auth(env);
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await sfetch(env, `${graph(env)}/${path}`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }, 60_000);
  return json(res, what).catch((e) => { throw tokenHint(e); });
}
async function gget(env: Bindings, path: string, params: Record<string, string>, what: string) {
  const { token } = await auth(env);
  const q = new URLSearchParams({ ...params, access_token: token });
  return json(await sfetch(env, `${graph(env)}/${path}?${q}`), what).catch((e) => { throw tokenHint(e); });
}
const tokenHint = (e: any) => {
  if (e instanceof SocialError && /OAuthException|access token|Session has expired|code 190/i.test(e.message)) {
    return new SocialError(`${e.message} — the Meta token expired or was revoked. Reconnect Instagram (docs/SOCIAL.md).`, { retryable: false, status: e.status });
  }
  return e;
};

const isJpeg = (m: MediaItem) => /jpe?g/i.test(m.mime ?? '') || /\.jpe?g(\?|$)/i.test(m.url);

async function containerStatus(env: Bindings, id: string): Promise<string> {
  const r = await gget(env, id, { fields: 'status_code,status' }, 'Instagram container status');
  if (r.status_code === 'ERROR') throw new SocialError(`Instagram could not process the media: ${r.status ?? 'unknown error'}`, { retryable: true });
  return String(r.status_code ?? 'FINISHED');
}

export const instagram: Connector = {
  platform: 'instagram',
  async configured(env) { return !!(await igAuth(env).catch(() => null)); },

  async publish(env, post: PostRow, media: MediaItem[], ctx: PublishCtx): Promise<PublishResult> {
    const { igId } = await auth(env);
    if (!media.length) throw new SocialError('Instagram needs at least one image or video. Add media in the post’s Media tab.', { retryable: false, needsMedia: true });
    const bad = media.find((m) => m.type === 'image' && !isJpeg(m));
    if (bad) throw new SocialError(`Instagram only accepts JPEG images. Re-export ${bad.url.split('/').pop()} as .jpg and upload again.`, { retryable: false, needsMedia: true });
    const caption = captionOf(post);
    if (caption.length > 2200) throw new SocialError(`Caption is ${caption.length} characters (Instagram allows 2,200).`, { retryable: false });
    if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30) throw new SocialError('Instagram allows at most 30 hashtags.', { retryable: false });
    const items = media.slice(0, 10);
    const ref = { ...ctx.ref } as { children?: string[]; creation_id?: string; media_type?: string; started_at?: number };

    if (!ref.creation_id) {
      ref.started_at ??= Date.now();
      if (items.length === 1) {
        const m = items[0];
        const r = m.type === 'video'
          ? await gpost(env, `${igId}/media`, { media_type: 'REELS', video_url: m.public_url, caption, share_to_feed: 'true' }, 'Instagram reel container')
          : await gpost(env, `${igId}/media`, { image_url: m.public_url, caption }, 'Instagram image container');
        ref.creation_id = String(r.id); ref.media_type = m.type === 'video' ? 'REELS' : 'IMAGE';
      } else {
        if (!ref.children) {
          ref.children = [];
          for (const m of items) {
            const r = await gpost(env, `${igId}/media`, m.type === 'video'
              ? { media_type: 'VIDEO', video_url: m.public_url, is_carousel_item: 'true' }
              : { image_url: m.public_url, is_carousel_item: 'true' }, 'Instagram carousel item');
            ref.children.push(String(r.id));
          }
          await ctx.save(ref);
        }
        for (const id of ref.children) {
          let st = await containerStatus(env, id);
          for (let i = 0; st === 'IN_PROGRESS' && i < 4; i++) { await sleep(5000); st = await containerStatus(env, id); }
          if (st === 'IN_PROGRESS') return { state: 'pending', ref, note: 'Instagram is processing a carousel video' };
          if (st === 'EXPIRED') { await ctx.save({}); throw new SocialError('Instagram media containers expired; they will be recreated on retry.'); }
        }
        const r = await gpost(env, `${igId}/media`, { media_type: 'CAROUSEL', children: ref.children.join(','), caption }, 'Instagram carousel container');
        ref.creation_id = String(r.id); ref.media_type = 'CAROUSEL';
      }
      await ctx.save(ref);
    }

    // Video containers take a while: check (Meta suggests once a minute, up to 5 min). We wait briefly, then resume next cron tick.
    let st = await containerStatus(env, ref.creation_id);
    for (let i = 0; st === 'IN_PROGRESS' && i < 4; i++) { await sleep(5000); st = await containerStatus(env, ref.creation_id); }
    if (st === 'IN_PROGRESS') {
      if (Date.now() - (ref.started_at ?? Date.now()) > 60 * 60_000) { await ctx.save({}); throw new SocialError('Instagram took over an hour to process the video.'); }
      return { state: 'pending', ref, note: 'Instagram is processing the video' };
    }
    if (st === 'EXPIRED') { await ctx.save({}); throw new SocialError('Instagram container expired before publishing; it will be recreated on retry.'); }

    const pub = await gpost(env, `${igId}/media_publish`, { creation_id: ref.creation_id }, 'Instagram publish');
    const mediaId = String(pub.id);
    let url = `https://www.instagram.com/`;
    try { const p = await gget(env, mediaId, { fields: 'permalink' }, 'Instagram permalink'); if (p.permalink) url = p.permalink; } catch { /* permalink is best effort */ }
    return { state: 'done', external_id: mediaId, url };
  },

  async fetchMetrics(env, refs): Promise<MetricsResult> {
    const out: MetricsResult = {};
    for (const r of refs) {
      let data: any;
      try { data = await gget(env, `${r.external_id}/insights`, { metric: 'reach,likes,comments,saved,shares,views,total_interactions' }, 'Instagram insights'); }
      catch { data = await gget(env, `${r.external_id}/insights`, { metric: 'reach,likes,comments,saved,shares' }, 'Instagram insights'); }
      const v: Record<string, number> = {};
      for (const m of data?.data ?? []) v[m.name] = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0);
      out[r.post_id] = { impressions: null, reach: v.reach ?? null, views: v.views ?? null, likes: v.likes ?? 0, comments: v.comments ?? 0, shares: v.shares ?? 0, saves: v.saved ?? 0, clicks: null, raw: v };
    }
    return out;
  },

  async accountStats(env) {
    const { igId } = await auth(env);
    const r = await gget(env, igId, { fields: 'username,followers_count,follows_count,media_count' }, 'Instagram account');
    return { followers: r.followers_count ?? null, following: r.follows_count ?? null, posts: r.media_count ?? null, raw: { username: r.username } };
  },
};

/* ── Facebook Login (connect from Studio): long-lived user token → Page token → linked IG account ── */
export const META_SCOPES = ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];

export function metaAuthorizeUrl(env: Bindings, redirect: string, state: string) {
  const u = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION || 'v25.0'}/dialog/oauth`);
  u.search = new URLSearchParams({ client_id: env.META_APP_ID ?? '', redirect_uri: redirect, state, response_type: 'code', scope: META_SCOPES.join(',') }).toString();
  return u.toString();
}

export async function metaExchange(env: Bindings, code: string, redirect: string) {
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new SocialError('Set META_APP_ID and META_APP_SECRET first.', { retryable: false });
  const q = (p: Record<string, string>) => new URLSearchParams(p).toString();
  const short = await json(await sfetch(env, `${graph(env)}/oauth/access_token?${q({ client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, redirect_uri: redirect, code })}`), 'Meta code exchange');
  const long = await json(await sfetch(env, `${graph(env)}/oauth/access_token?${q({ grant_type: 'fb_exchange_token', client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: short.access_token })}`), 'Meta long-lived token');
  const pages = await json(await sfetch(env, `${graph(env)}/me/accounts?${q({ fields: 'name,access_token,instagram_business_account{id,username}', access_token: long.access_token })}`), 'Meta pages');
  const page = (pages.data ?? []).find((p: any) => p.instagram_business_account?.id);
  if (!page) throw new SocialError('No Facebook Page with a linked Instagram professional account was found for this login. Link Instagram to the Page first (docs/SOCIAL.md).', { retryable: false });
  // A Page token obtained from a long-lived user token does not expire on a schedule.
  return { access_token: page.access_token as string, account_id: String(page.instagram_business_account.id), account_name: `@${page.instagram_business_account.username} (Page: ${page.name})`, scopes: META_SCOPES.join(','), expires_at: null };
}
