import type { Bindings } from '../env';
import { run } from '../db';
import { redact } from './http';
import { runScheduler } from './scheduler';
import { accountSnapshot, runCollector } from './metrics';

/** Cron (every 10 min): publish due posts, collect results that are due, daily follower snapshot. */
export async function runSocial(env: Bindings, now = Date.now()) {
  const out: Record<string, unknown> = {};
  try { out.published = await runScheduler(env, now); } catch (e: any) { console.warn('social scheduler failed', redact(String(e?.message ?? e))); }
  try { out.metrics = await runCollector(env, now); } catch (e: any) { console.warn('social collector failed', redact(String(e?.message ?? e))); }
  try { out.accounts = await accountSnapshot(env, now); } catch (e: any) { console.warn('social account snapshot failed', redact(String(e?.message ?? e))); }
  return out;
}

/** After a Studio edit: a parked post (missed, failed, needs media, manual, capped) is re-armed when its
 *  schedule, media, platform or auto-post flag changes, so the scheduler looks at it again. */
export async function rearmAfterEdit(env: Bindings, before: Record<string, any>, data: Record<string, unknown>) {
  if (before.external_id || !before.publish_state || !['missed', 'failed', 'needs_media', 'manual', 'capped'].includes(before.publish_state)) return;
  if (!['scheduled_at', 'media_json', 'autopost', 'platform', 'status'].some((k) => k in data && String(data[k] ?? '') !== String(before[k] ?? ''))) return;
  await run(env.DB, `UPDATE content_posts SET publish_state = NULL, attempts = 0, next_attempt_at = NULL, last_error = NULL,
    publish_ref = CASE WHEN publish_state = 'needs_media' THEN NULL ELSE publish_ref END WHERE id = ?`, before.id);
}
