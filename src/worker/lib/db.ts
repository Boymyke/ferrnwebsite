/** Small D1 helpers. All SQL lives next to the code that uses it; identifiers
 *  that come from requests are checked against allow-lists before use. */

export const newId = (prefix = '') =>
  prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export const randomToken = (bytes = 24) => {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
};

export const nowIso = () => new Date().toISOString();

export async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>();
  return r.results ?? [];
}

export async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]) {
  return db.prepare(sql).bind(...params).run();
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export const clamp = (s: unknown, max = 5000) =>
  String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export async function getSetting(db: D1Database, key: string, fallback = ''): Promise<string> {
  const row = await first<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? fallback;
}

export async function setSetting(db: D1Database, key: string, value: string, by: string) {
  await run(db,
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    key, value, by);
}
