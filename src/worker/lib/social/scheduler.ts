/**
 * Auto-posting. Runs on the 10-minute cron: publishes due content_posts (autopost = 1, approved/scheduled,
 * scheduled_at <= now), resumes posts the platform is still processing, and retries failures
 * (3 attempts, 20 minutes apart). A D1 conditional claim plus a KV lock make double-posting impossible
 * even if two cron runs overlap.
 */
import type { Bindings } from '../env';
import { all, first, getSetting, parseJson, run } from '../db';
import { iso, postMedia, type Connector, type Platform, type PostRow, type PublishResult } from './common';
import { SocialError, redact } from './http';
import { x } from './x';
import { instagram } from './instagram';
import { tiktok } from './tiktok';

export const CONNECTORS: Record<Platform, Connector> = { x, instagram, tiktok };
export const DEFAULT_CAPS: Record<Platform, number> = { x: 12, instagram: 20, tiktok: 6 };
export const MAX_ATTEMPTS = 3;
export const RETRY_MS = 20 * 60_000;
export const MAX_LATE_MS = 24 * 3600_000;   // never auto-post something more than a day late
const LEASE_MS = 15 * 60_000;

export async function dailyCaps(env: Bindings): Promise<Record<Platform, number>> {
  const s = parseJson<Partial<Record<Platform, number>>>(await getSetting(env.DB, 'social_daily_caps', ''), {});
  return { ...DEFAULT_CAPS, ...Object.fromEntries(Object.entries(s).filter(([, v]) => Number(v) > 0)) } as Record<Platform, number>;
}

export async function postedLast24h(env: Bindings, platform: string, now = Date.now()) {
  const r = await first<{ n: number }>(env.DB, 'SELECT COUNT(*) AS n FROM content_posts WHERE platform = ? AND external_id IS NOT NULL AND posted_at >= ?', platform, iso(now - 864e5));
  return r?.n ?? 0;
}

async function log(env: Bindings, postId: string, action: string, summary: string) {
  await run(env.DB, `INSERT INTO audit_log (user_id, user_name, entity, entity_id, action, summary) VALUES (NULL, 'Auto-post', 'content_posts', ?, ?, ?)`, postId, action, summary.slice(0, 500));
}

export type Outcome = { id: string; state: string; message?: string; url?: string };

/** Publishes (or resumes) one post. `force` = "Post now" from Studio: ignores autopost/schedule but keeps caps and locks. */
export async function publishOne(env: Bindings, post: PostRow, opts: { now?: number; force?: boolean } = {}): Promise<Outcome> {
  const now = opts.now ?? Date.now();
  const platform = post.platform as Platform;
  const conn = CONNECTORS[platform];
  if (!conn) return { id: post.id, state: 'skipped', message: `Auto-posting is not available for ${post.platform}.` };
  if (post.external_id) return { id: post.id, state: 'posted', message: 'Already posted.', url: post.post_url ?? undefined };

  if (!(await conn.configured(env).catch(() => false))) {
    const message = `${platform === 'x' ? 'X' : platform === 'instagram' ? 'Instagram' : 'TikTok'} is not connected, so this needs posting by hand: copy the caption and download the media from Studio.`;
    await run(env.DB, "UPDATE content_posts SET publish_state = 'manual', last_error = ? WHERE id = ?", message, post.id);
    return { id: post.id, state: 'manual', message };
  }
  // A post that missed its slot by more than a day waits for a human ("Post now") instead of going out late.
  if (!opts.force && [null, 'manual', 'needs_media'].includes(post.publish_state) && post.scheduled_at && now - Date.parse(post.scheduled_at) > MAX_LATE_MS) {
    const message = 'Missed its posting time by more than 24 hours, so it was not auto-posted. Use "Post now" or reschedule it.';
    await run(env.DB, "UPDATE content_posts SET publish_state = 'missed', last_error = ? WHERE id = ?", message, post.id);
    return { id: post.id, state: 'missed', message };
  }
  if (post.publish_state !== 'processing') {
    const cap = (await dailyCaps(env))[platform];
    if ((await postedLast24h(env, platform, now)) >= cap) {
      const message = `Daily cap reached (${cap} ${platform} posts in 24 hours). It will go out automatically when allowed.`;
      await run(env.DB, "UPDATE content_posts SET publish_state = 'capped', last_error = ?, next_attempt_at = ? WHERE id = ?", message, iso(now + 30 * 60_000), post.id);
      return { id: post.id, state: 'capped', message };
    }
  }

  // Lock 1: KV (cheap, cross-isolate). Lock 2: conditional D1 claim (authoritative).
  const lockKey = `social:lock:${post.id}`;
  if (await env.CACHE.get(lockKey)) return { id: post.id, state: 'locked', message: 'Another run is publishing this post right now.' };
  await env.CACHE.put(lockKey, String(now), { expirationTtl: 900 });
  try {
    const claim = await run(env.DB, `UPDATE content_posts SET publish_state = 'publishing', next_attempt_at = ?
      WHERE id = ? AND external_id IS NULL AND (publish_state IS NULL OR publish_state <> 'publishing' OR next_attempt_at IS NULL OR next_attempt_at <= ?)`,
      iso(now + LEASE_MS), post.id, iso(now));
    if (!claim.meta?.changes) return { id: post.id, state: 'locked', message: 'Another run is publishing this post right now.' };

    const ref = parseJson<Record<string, any>>(post.publish_ref, {});
    const ctx = {
      ref, opts: parseJson<Record<string, any>>(post.publish_opts_json, {}),
      save: async (r: Record<string, unknown>) => { await run(env.DB, 'UPDATE content_posts SET publish_ref = ? WHERE id = ?', JSON.stringify(r), post.id); },
    };
    let res: PublishResult;
    try {
      res = await conn.publish(env, post, postMedia(env, post), ctx);
    } catch (e: any) {
      const err = e instanceof SocialError ? e : new SocialError(String(e?.message ?? e));
      if (err.needsMedia) {
        await run(env.DB, "UPDATE content_posts SET publish_state = 'needs_media', last_error = ?, next_attempt_at = NULL, publish_ref = ? WHERE id = ?",
          err.message, JSON.stringify({ needs_media_for: post.media_json }), post.id);
        await log(env, post.id, 'needs_media', `Auto-post paused: ${err.message}`);
        return { id: post.id, state: 'needs_media', message: err.message };
      }
      const attempts = (post.attempts ?? 0) + 1;
      if (!err.retryable || attempts >= MAX_ATTEMPTS) {
        await run(env.DB, "UPDATE content_posts SET status = 'failed', publish_state = 'failed', attempts = ?, last_error = ?, next_attempt_at = NULL WHERE id = ?", attempts, err.message, post.id);
        await log(env, post.id, 'publish_failed', `Auto-post failed on ${platform} (attempt ${attempts}): ${err.message}`);
        console.warn('social publish failed', post.id, platform, redact(err.message));
        return { id: post.id, state: 'failed', message: err.message };
      }
      await run(env.DB, "UPDATE content_posts SET publish_state = 'retrying', attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?", attempts, err.message, iso(now + RETRY_MS), post.id);
      console.warn('social publish retry', post.id, platform, redact(err.message));
      return { id: post.id, state: 'retrying', message: `${err.message} (attempt ${attempts} of ${MAX_ATTEMPTS}; retrying in 20 minutes)` };
    }

    if (res.state === 'pending') {
      await run(env.DB, "UPDATE content_posts SET publish_state = 'processing', publish_ref = ?, last_error = ?, next_attempt_at = ? WHERE id = ?",
        JSON.stringify(res.ref), res.note ?? null, iso(now + 60_000), post.id);
      return { id: post.id, state: 'processing', message: res.note ?? 'The platform is processing the media. It finishes on the next run (within 10 minutes).' };
    }
    const postedAt = iso(Date.now());
    await run(env.DB, `UPDATE content_posts SET status = 'posted', publish_state = 'posted', external_id = ?, post_url = ?, posted_at = ?, last_error = ?, next_attempt_at = NULL,
      metrics_at = NULL, updated_at = ?, updated_by = 'Auto-post' WHERE id = ?`, res.external_id, res.url, postedAt, res.note ?? null, postedAt, post.id);
    await log(env, post.id, 'published', `Auto-posted to ${platform}: ${res.url}${res.note ? ` (${res.note})` : ''}`);
    return { id: post.id, state: 'posted', url: res.url, message: res.note };
  } finally {
    await env.CACHE.delete(lockKey).catch(() => null);
  }
}

/** Cron entry: due posts first, then anything the platforms are still processing or that is waiting to retry. */
export async function runScheduler(env: Bindings, now = Date.now()): Promise<Outcome[]> {
  const t = iso(now);
  const rows = await all<PostRow>(env.DB, `SELECT * FROM content_posts
    WHERE external_id IS NULL AND platform IN ('x','instagram','tiktok')
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      AND (
        (autopost = 1 AND status IN ('approved','scheduled') AND scheduled_at IS NOT NULL AND scheduled_at <= ?
          AND COALESCE(publish_state, '') NOT IN ('posted','failed','missed'))
        OR publish_state IN ('processing','retrying')
      )
    ORDER BY scheduled_at LIMIT 8`, t, t);
  const out: Outcome[] = [];
  for (const p of rows) {
    // Parked posts are re-checked cheaply: needs_media only once media exists, manual only once connected.
    if (p.publish_state === 'needs_media' && (!postMedia(env, p).length || parseJson<any>(p.publish_ref, {}).needs_media_for === p.media_json)) continue;
    if (p.publish_state === 'manual' && !(await CONNECTORS[p.platform as Platform].configured(env).catch(() => false))) continue;
    try { out.push(await publishOne(env, p, { now })); }
    catch (e: any) { console.warn('social scheduler error', p.id, redact(String(e?.message ?? e))); }
  }
  return out;
}
