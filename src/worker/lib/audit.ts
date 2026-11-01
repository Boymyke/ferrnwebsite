import type { Context } from 'hono';
import type { AppEnv } from './env';
import { run } from './db';

const MAX = 20_000;
const trim = (v: unknown) => {
  if (v == null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX ? s.slice(0, MAX) : s;
};

/** Records who did what. Used by every Studio write so edits show their author. */
export async function audit(
  c: Context<AppEnv>,
  entity: string,
  entityId: string | null,
  action: string,
  summary: string,
  before?: unknown,
  after?: unknown,
) {
  const u = c.get('user');
  await run(c.env.DB,
    `INSERT INTO audit_log (user_id, user_name, entity, entity_id, action, summary, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    u?.id ?? null, u?.name ?? 'System', entity, entityId, action, summary.slice(0, 500), trim(before), trim(after));
}

/** Only the fields that changed, for compact history entries. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (k === 'updated_at' || k === 'updated_by') continue;
    if (!before || String(before[k] ?? '') !== String(after[k] ?? '')) {
      b[k] = before ? before[k] : undefined;
      a[k] = after[k];
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}
