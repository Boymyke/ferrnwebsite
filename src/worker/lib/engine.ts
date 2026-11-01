import type { Bindings } from './env';

/**
 * Bridge to the LeadsHunter engine (Google Apps Script). The engine keeps doing what it is
 * good at — sending from Gmail in-thread, catching replies/bounces/opt-outs, the daily AI
 * routine — while the Ferrn Studio becomes the single place to work. The engine's API key
 * never leaves the Worker (ENGINE_KEY secret).
 */
export const engineConfigured = (env: Bindings) => !!(env.ENGINE_URL && env.ENGINE_KEY);

export async function engineCall<T = any>(env: Bindings, fn: 'getDashboardData' | 'getLeadDetail' | 'dashAction', args: unknown[] = []): Promise<T> {
  if (!engineConfigured(env)) throw new Error('LeadsHunter engine is not connected yet (set ENGINE_URL and ENGINE_KEY).');
  const res = await fetch(env.ENGINE_URL!, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' }, // Apps Script reads raw postData
    body: JSON.stringify({ key: env.ENGINE_KEY, fn, args }),
    redirect: 'follow',
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('Engine returned an unexpected response.'); }
  if (!data.ok) throw new Error(data.error || 'Engine error');
  return data.data as T;
}

/** Pulls the engine dashboard, caches it for the Studio and mirrors leads into D1. */
export async function syncEngine(env: Bindings): Promise<{ leads: number } | null> {
  if (!engineConfigured(env)) return null;
  const dash = await engineCall<any>(env, 'getDashboardData');
  await env.CACHE.put('engine:snapshot', JSON.stringify(dash), { expirationTtl: 60 * 60 * 6 });
  const leads: any[] = dash.leads ?? [];
  const stmts = leads.map((L) =>
    env.DB.prepare(
      `INSERT INTO leads (id, created, niche, company, website, email, phone, contact_name, city, tier, gaps, pitch, est_value,
          status, preview_url, last_contact, last_reply, next_action, needs_you, needs_you_reason, notes, origin, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'engine',datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         niche=excluded.niche, company=excluded.company, website=excluded.website, email=excluded.email, phone=excluded.phone,
         contact_name=excluded.contact_name, city=excluded.city, tier=excluded.tier, gaps=excluded.gaps, pitch=excluded.pitch,
         est_value=excluded.est_value, status=excluded.status, preview_url=excluded.preview_url, last_contact=excluded.last_contact,
         last_reply=excluded.last_reply, next_action=excluded.next_action, needs_you=excluded.needs_you,
         needs_you_reason=excluded.needs_you_reason, notes=excluded.notes, synced_at=excluded.synced_at`,
    ).bind(
      L.id, (L.created || '').slice(0, 10) || null, L.niche ?? null, L.company ?? '', L.website ?? null, L.email ?? null, L.phone ?? null,
      L.contact_name ?? null, L.city ?? null, L.tier ?? null, L.gaps ?? null, L.pitch ?? null, Number(L.est_value) || null,
      L.status ?? null, L.preview_url ?? null, (L.last_contact || '').slice(0, 10) || null, (L.last_reply || '').slice(0, 10) || null,
      L.next_action ?? null, L.needs_you ?? null, L.needs_you_reason ?? null, L.notes ?? null,
    ),
  );
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { leads: leads.length };
}
