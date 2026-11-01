import type { Bindings } from '../env';
import { first, parseJson, run } from '../db';
import { seal, unseal } from './crypto';

export type Platform = 'x' | 'instagram' | 'tiktok';
export const PLATFORMS: Platform[] = ['x', 'instagram', 'tiktok'];

export type PostRow = {
  id: string; platform: string; format: string | null; theme: string | null; title: string | null; body: string | null; hashtags: string | null;
  media_json: string; scheduled_at: string | null; status: string; autopost: number; external_id: string | null; attempts: number;
  last_error: string | null; publish_state: string | null; next_attempt_at: string | null; publish_ref: string | null; publish_opts_json: string | null;
  post_url: string | null; posted_at: string | null; metrics_json: string; metrics_at: string | null;
};

export type MediaItem = { url: string; type: 'image' | 'video'; key?: string; mime?: string; public_url: string };

export type Metrics = { impressions?: number | null; reach?: number | null; views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null; clicks?: number | null };
export const METRIC_KEYS = ['impressions', 'reach', 'views', 'likes', 'comments', 'shares', 'saves', 'clicks'] as const;

/** done → posted; pending → the platform is still working, `resume` is called on the next cron tick. */
export type PublishResult =
  | { state: 'done'; external_id: string; url: string; note?: string }
  | { state: 'pending'; ref: Record<string, unknown>; note?: string };

export type PublishCtx = {
  /** Progress saved by an earlier attempt (e.g. thread ids already posted), so retries never double-post. */
  ref: Record<string, any>;
  save: (ref: Record<string, unknown>) => Promise<void>;
  opts: Record<string, any>;
};

export type MetricsResult = Record<string, Metrics & { raw?: unknown }>;

export interface Connector {
  platform: Platform;
  /** API credentials present (and token stored, for OAuth platforms). */
  configured(env: Bindings): Promise<boolean>;
  publish(env: Bindings, post: PostRow, media: MediaItem[], ctx: PublishCtx): Promise<PublishResult>;
  resume?(env: Bindings, post: PostRow, ref: Record<string, any>): Promise<PublishResult>;
  fetchMetrics(env: Bindings, refs: { post_id: string; external_id: string; ref?: Record<string, any> }[]): Promise<MetricsResult>;
  accountStats(env: Bindings): Promise<{ followers: number | null; following?: number | null; posts?: number | null; raw?: unknown }>;
}

const IMG = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const VID = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

export const mediaBase = (env: Bindings) => (env.SOCIAL_MEDIA_BASE || env.SITE_URL || '').replace(/\/$/, '');

/** media_json → usable image/video items with public URLs. Visual-direction notes are ignored. */
export function postMedia(env: Bindings, post: Pick<PostRow, 'media_json'>): MediaItem[] {
  const raw = parseJson<any[]>(post.media_json, []);
  const out: MediaItem[] = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    if (!m || typeof m.url !== 'string' || !m.url) continue;
    const type: MediaItem['type'] | null = m.type === 'image' || m.type === 'video' ? m.type : IMG.test(m.url) ? 'image' : VID.test(m.url) ? 'video' : null;
    if (!type) continue;
    const key = m.key ?? (m.url.startsWith('/media/') ? m.url.slice(7) : undefined);
    const ext = (m.url.split('?')[0].split('.').pop() || '').toLowerCase();
    out.push({ url: m.url, type, key, mime: m.mime ?? MIME[ext], public_url: m.url.startsWith('http') ? m.url : mediaBase(env) + m.url });
  }
  return out;
}

/** Instagram/TikTok bodies often hold slide text plus "Caption: …". Post only the caption part. */
export function captionOf(post: Pick<PostRow, 'body' | 'hashtags' | 'title'>, fallbackTitle = false) {
  const body = String(post.body ?? '');
  const m = body.match(/(?:^|\n)\s*Caption:\s*([\s\S]*)$/i);
  let text = m ? m[1].trim() : fallbackTitle && /^(HOOK|Slide \d|Visual:)/im.test(body) ? String(post.title ?? '').trim() : body.trim();
  const tags = String(post.hashtags ?? '').trim();
  if (tags && !text.includes(tags)) text = `${text}\n\n${tags}`.trim();
  return text;
}

/* ── OAuth token storage (encrypted) ── */
export type StoredToken = {
  access_token: string; refresh_token?: string; expires_at?: string | null; refresh_expires_at?: string | null;
  account_id?: string; account_name?: string; scopes?: string; extra?: Record<string, unknown>;
};

export async function getToken(env: Bindings, platform: Platform): Promise<StoredToken | null> {
  const row = await first<{ enc: string; account_id: string; account_name: string; scopes: string; expires_at: string; refresh_expires_at: string }>(
    env.DB, 'SELECT * FROM social_tokens WHERE platform = ?', platform);
  if (!row) return null;
  const t = await unseal<StoredToken>(env, row.enc);
  return { ...t, account_id: row.account_id ?? t.account_id, account_name: row.account_name ?? t.account_name, scopes: row.scopes ?? t.scopes };
}

export async function putToken(env: Bindings, platform: Platform, t: StoredToken, by: string) {
  await run(env.DB, `INSERT INTO social_tokens (platform, account_id, account_name, scopes, enc, expires_at, refresh_expires_at, connected_by, updated_at)
    VALUES (?,?,?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(platform) DO UPDATE SET account_id=excluded.account_id, account_name=excluded.account_name, scopes=excluded.scopes, enc=excluded.enc,
      expires_at=excluded.expires_at, refresh_expires_at=excluded.refresh_expires_at, connected_by=excluded.connected_by, updated_at=excluded.updated_at`,
    platform, t.account_id ?? null, t.account_name ?? null, t.scopes ?? null, await seal(env, t), t.expires_at ?? null, t.refresh_expires_at ?? null, by);
}

export async function tokenMeta(env: Bindings, platform: Platform) {
  return first<{ account_id: string | null; account_name: string | null; scopes: string | null; expires_at: string | null; refresh_expires_at: string | null; connected_by: string | null; updated_at: string }>(
    env.DB, 'SELECT account_id, account_name, scopes, expires_at, refresh_expires_at, connected_by, updated_at FROM social_tokens WHERE platform = ?', platform);
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const lagosDay = (ms = Date.now()) => new Date(ms + 3600_000).toISOString().slice(0, 10);
export const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
