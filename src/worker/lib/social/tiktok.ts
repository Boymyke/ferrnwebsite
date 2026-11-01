/**
 * TikTok connector: Content Posting API (Direct Post, PULL_FROM_URL) + Display API metrics.
 * https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 * https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 * https://developers.tiktok.com/doc/tiktok-api-v2-video-query
 * Unaudited apps can only post privately (SELF_ONLY). The media URL prefix/domain must be verified in the TikTok app.
 */
import type { Bindings } from '../env';
import { captionOf, getToken, iso, putToken, type Connector, type MediaItem, type MetricsResult, type PostRow, type PublishCtx, type PublishResult, type StoredToken } from './common';
import { sfetch, sleep, SocialError } from './http';

const OPEN = 'https://open.tiktokapis.com';
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.stats', 'video.publish', 'video.upload', 'video.list'];
const FATAL = new Set(['unaudited_client_can_only_post_to_private_accounts', 'url_ownership_unverified', 'privacy_level_option_mismatch', 'scope_not_authorized',
  'spam_risk_user_banned_from_posting', 'invalid_param', 'token_not_authorized_for_specified_publish_id', 'invalid_publish_id']);

export function tiktokAuthorizeUrl(env: Bindings, redirect: string, state: string) {
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.search = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY ?? '', response_type: 'code', scope: TIKTOK_SCOPES.join(','), redirect_uri: redirect, state }).toString();
  return u.toString();
}

async function tokenCall(env: Bindings, params: Record<string, string>): Promise<StoredToken> {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) throw new SocialError('Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET first.', { retryable: false });
  const res = await sfetch(env, `${OPEN}/v2/oauth/token/`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, ...params }),
  });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok || d.error || !d.access_token) {
    throw new SocialError(`TikTok token request failed: ${d.error_description || d.error || res.status}`, { retryable: res.status >= 500 });
  }
  const now = Date.now();
  return {
    access_token: d.access_token, refresh_token: d.refresh_token, scopes: d.scope, account_id: d.open_id,
    expires_at: iso(now + Number(d.expires_in ?? 86400) * 1000), refresh_expires_at: iso(now + Number(d.refresh_expires_in ?? 31536000) * 1000),
  };
}

export const tiktokExchange = (env: Bindings, code: string, redirect: string) => tokenCall(env, { code, grant_type: 'authorization_code', redirect_uri: redirect });

/** A valid access token, refreshed (and re-stored, encrypted) when it is within 10 minutes of expiry. */
async function accessToken(env: Bindings): Promise<string> {
  const t = await getToken(env, 'tiktok');
  if (!t) throw new SocialError('TikTok is not connected. Connect it in Studio → Content → Performance → Connections.', { retryable: false });
  if (t.expires_at && Date.parse(t.expires_at) - Date.now() > 10 * 60_000) return t.access_token;
  if (!t.refresh_token) throw new SocialError('TikTok token expired and there is no refresh token. Reconnect TikTok.', { retryable: false });
  const fresh = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await putToken(env, 'tiktok', { ...t, ...fresh, account_name: t.account_name, extra: t.extra }, 'token refresh');
  return fresh.access_token;
}

async function tcall(env: Bindings, path: string, body: unknown, what: string, method = 'POST') {
  const token = await accessToken(env);
  const res = await sfetch(env, `${OPEN}${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' }, body: body === undefined ? undefined : JSON.stringify(body),
  }, 45_000);
  const d: any = await res.json().catch(() => ({}));
  const code = d?.error?.code;
  if (!res.ok || (code && code !== 'ok')) {
    const hint = code === 'url_ownership_unverified' ? ' Verify the media domain (www.ferrnagency.com) under URL properties in the TikTok developer portal.'
      : code === 'unaudited_client_can_only_post_to_private_accounts' ? ' Until TikTok audits the app, posts must be "Only me" (SELF_ONLY).'
      : code === 'access_token_invalid' ? ' Reconnect TikTok.' : '';
    throw new SocialError(`${what} failed: ${code ?? res.status} ${d?.error?.message ?? ''}.${hint}`.trim(), { retryable: !FATAL.has(code) && code !== 'access_token_invalid', status: res.status });
  }
  return d.data ?? {};
}

export async function creatorInfo(env: Bindings) {
  return tcall(env, '/v2/post/publish/creator_info/query/', {}, 'TikTok creator info') as Promise<{
    creator_username: string; creator_nickname: string; creator_avatar_url: string; privacy_level_options: string[];
    comment_disabled: boolean; duet_disabled: boolean; stitch_disabled: boolean; max_video_post_duration_sec: number;
  }>;
}

export const tiktokAudited = (env: Bindings) => env.TIKTOK_AUDITED === '1';

/** Chosen level if TikTok allows it; unaudited apps always SELF_ONLY. No silent "public" default before the audit. */
function pickPrivacy(env: Bindings, options: string[], wanted?: string) {
  if (!tiktokAudited(env)) return 'SELF_ONLY';
  if (wanted && options.includes(wanted)) return wanted;
  return options.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : options[0] ?? 'SELF_ONLY';
}

async function checkStatus(env: Bindings, ref: Record<string, any>): Promise<PublishResult> {
  const s = await tcall(env, '/v2/post/publish/status/fetch/', { publish_id: ref.publish_id }, 'TikTok status');
  if (s.status === 'PUBLISH_COMPLETE') {
    const vid = s.publicaly_available_post_id?.[0];
    const user = ref.username ? `@${ref.username}` : '';
    return vid
      ? { state: 'done', external_id: String(vid), url: `https://www.tiktok.com/${user}/video/${vid}`.replace('.com//', '.com/') }
      : { state: 'done', external_id: `publish:${ref.publish_id}`, url: `https://www.tiktok.com/${user}`, note: ref.privacy === 'SELF_ONLY' ? 'Posted as "Only me" (app not audited). Make it public in the TikTok app.' : 'Posted; TikTok has not released a public video ID yet (still in moderation).' };
  }
  if (s.status === 'FAILED') throw new SocialError(`TikTok rejected the post: ${s.fail_reason ?? 'unknown'}`, { retryable: ['internal', 'video_pull_failed', 'photo_pull_failed'].includes(s.fail_reason) });
  if (Date.now() - (ref.started_at ?? Date.now()) > 2 * 3600_000) throw new SocialError('TikTok was still processing after 2 hours.', { retryable: false });
  return { state: 'pending', ref, note: `TikTok: ${String(s.status ?? 'processing').toLowerCase().replace(/_/g, ' ')}` };
}

export const tiktok: Connector = {
  platform: 'tiktok',
  async configured(env) { return !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && (await getToken(env, 'tiktok').catch(() => null))); },

  async publish(env, post: PostRow, media: MediaItem[], ctx: PublishCtx): Promise<PublishResult> {
    if (ctx.ref.publish_id) return checkStatus(env, ctx.ref);
    const video = media.find((m) => m.type === 'video');
    const images = media.filter((m) => m.type === 'image');
    if (!video && !images.length) throw new SocialError('TikTok needs a video (or photos). Add media in the post’s Media tab.', { retryable: false, needsMedia: true });
    const info = await creatorInfo(env);
    const privacy = pickPrivacy(env, info.privacy_level_options ?? [], ctx.opts.privacy_level);
    const caption = captionOf(post, true);
    const common = {
      privacy_level: privacy,
      disable_comment: !!ctx.opts.disable_comment || !!info.comment_disabled,
      brand_organic_toggle: !!ctx.opts.brand_organic, brand_content_toggle: !!ctx.opts.brand_content,
    };
    let data: any;
    if (video) {
      data = await tcall(env, '/v2/post/publish/video/init/', {
        post_info: { ...common, title: caption.slice(0, 2200), disable_duet: !!info.duet_disabled, disable_stitch: !!info.stitch_disabled, is_aigc: !!ctx.opts.is_aigc },
        source_info: { source: 'PULL_FROM_URL', video_url: video.public_url },
      }, 'TikTok video post');
    } else {
      data = await tcall(env, '/v2/post/publish/content/init/', {
        media_type: 'PHOTO', post_mode: 'DIRECT_POST',
        post_info: { ...common, title: String(post.title ?? '').slice(0, 90), description: caption.slice(0, 4000), auto_add_music: true },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: images.slice(0, 35).map((m) => m.public_url) },
      }, 'TikTok photo post');
    }
    const ref = { publish_id: data.publish_id, username: info.creator_username, privacy, started_at: Date.now() };
    await ctx.save(ref);
    await sleep(4000);
    return checkStatus(env, ref);
  },

  async fetchMetrics(env, refs): Promise<MetricsResult> {
    const out: MetricsResult = {};
    const ids = refs.filter((r) => !r.external_id.startsWith('publish:'));
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const d = await tcall(env, '/v2/video/query/?fields=id,title,view_count,like_count,comment_count,share_count,share_url,create_time', { filters: { video_ids: batch.map((b) => b.external_id) } }, 'TikTok video query');
      for (const v of d.videos ?? []) {
        const r = batch.find((b) => b.external_id === String(v.id));
        if (r) out[r.post_id] = { impressions: null, reach: null, views: v.view_count ?? 0, likes: v.like_count ?? 0, comments: v.comment_count ?? 0, shares: v.share_count ?? 0, saves: null, clicks: null, raw: v };
      }
    }
    return out;
  },

  async accountStats(env) {
    const d = await tcall(env, '/v2/user/info/?fields=open_id,username,display_name,follower_count,following_count,video_count', undefined, 'TikTok user info', 'GET');
    const u = d.user ?? {};
    return { followers: u.follower_count ?? null, following: u.following_count ?? null, posts: u.video_count ?? null, raw: { username: u.username } };
  },
};
