import { syncOutreachEmails } from '../routes/email-track';
import type { Bindings } from './env';

/**
 * Bridge to the LeadsHunter engine (Google Apps Script). The engine keeps doing what it is
 * good at — sending from Gmail in-thread, catching replies/bounces/opt-outs, the daily AI
 * routine — while the Ferrn Studio becomes the single place to work. The engine's API key
 * never leaves the Worker (ENGINE_KEY secret).
 */
export const engineConfigured = (env: Bindings) => !!(env.ENGINE_URL && env.ENGINE_KEY);

export async function engineCall<T = any>(env: Bindings, fn: 'getDashboardData' | 'getLeadDetail' | 'dashAction' | 'getPreviews', args: unknown[] = []): Promise<T> {
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

/* "Needs you" is Michael's make-list: a preview (concept site) or a video that a client has asked for.
 * Everything else the routines used to flag (good candidates, pricing questions, call requests) stays out:
 * those replies are already drafted and wait under Held. */
export const isMakeRequest = (reason: unknown) => {
  const r = String(reason ?? '');
  return /\b(preview|concept|mock-?up|demo|sample (site|page|design)|video|walk-?through|loom|recording)\b/i.test(r) && !/good candidate|would benefit|could benefit|might benefit/i.test(r);
};
export function shapeDash<T extends Record<string, any>>(dash: T): T {
  if (dash && Array.isArray(dash.needsYou)) (dash as any).needsYou = dash.needsYou.filter((l: any) => isMakeRequest(l.needs_you_reason));
  if (dash && Array.isArray(dash.leads)) for (const L of dash.leads) if (L.needs_you === 'Y' && !isMakeRequest(L.needs_you_reason)) { L.needs_you = ''; L.needs_you_reason = ''; }
  return dash;
}

let handledByCol: boolean | null = null;
/** True once migration 0011 has added leads.handled_by (checked once per isolate). */
export async function hasHandledBy(env: Bindings) {
  if (handledByCol === null) handledByCol = await env.DB.prepare('SELECT handled_by FROM leads LIMIT 0').all().then(() => true, () => false);
  return handledByCol;
}

/** Pulls the engine dashboard, caches it for the Studio and mirrors leads into D1. */
export async function syncEngine(env: Bindings): Promise<{ leads: number } | null> {
  if (!engineConfigured(env)) return null;
  const dash = shapeDash(await engineCall<any>(env, 'getDashboardData'));
  await env.CACHE.put('engine:snapshot', JSON.stringify(dash), { expirationTtl: 60 * 60 * 6 });
  const leads: any[] = dash.leads ?? [];
  // Until migration 0011 (leads.handled_by) is applied, mirror leads without it rather than failing the sync.
  const takeover = await hasHandledBy(env);
  const stmts = leads.map((L) => takeover ?
    env.DB.prepare(
      `INSERT INTO leads (id, created, niche, company, website, email, phone, contact_name, city, tier, gaps, pitch, est_value,
          status, preview_url, last_contact, last_reply, next_action, needs_you, needs_you_reason, notes, handled_by, origin, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'engine',datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         niche=excluded.niche, company=excluded.company, website=excluded.website, email=excluded.email, phone=excluded.phone,
         contact_name=excluded.contact_name, city=excluded.city, tier=excluded.tier, gaps=excluded.gaps, pitch=excluded.pitch,
         est_value=excluded.est_value, status=excluded.status, preview_url=excluded.preview_url, last_contact=excluded.last_contact,
         last_reply=excluded.last_reply, next_action=excluded.next_action, needs_you=excluded.needs_you,
         needs_you_reason=excluded.needs_you_reason, notes=excluded.notes, handled_by=excluded.handled_by, synced_at=excluded.synced_at`,
    ).bind(
      L.id, (L.created || '').slice(0, 10) || null, L.niche ?? null, L.company ?? '', L.website ?? null, L.email ?? null, L.phone ?? null,
      L.contact_name ?? null, L.city ?? null, L.tier ?? null, L.gaps ?? null, L.pitch ?? null, Number(L.est_value) || null,
      L.status ?? null, L.preview_url ?? null, (L.last_contact || '').slice(0, 10) || null, (L.last_reply || '').slice(0, 10) || null,
      L.next_action ?? null, L.needs_you || null, L.needs_you_reason || null, L.notes ?? null, L.handler || null,
    )
   :
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
      L.next_action ?? null, L.needs_you || null, L.needs_you_reason || null, L.notes ?? null,
    ),
  );
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await syncOutreachEmails(env, dash).catch((e) => console.warn('outreach email sync', e));
  return { leads: leads.length };
}

/**
 * Concept sites the morning routine built for leads. The engine keeps the HTML in Drive; we copy each new one
 * into R2 (demos/<slug>/index.html), register it as an uploaded demo and serve it at /preview/<slug>/.
 * Then the engine marks it synced and writes the live URL on the lead.
 */
export async function syncPreviews(env: Bindings): Promise<number> {
  if (!engineConfigured(env)) return 0;
  const list = await engineCall<{ slug: string; lead_id?: string; company?: string; html: string }[]>(env, 'getPreviews').catch(() => []);
  let n = 0;
  for (const p of list ?? []) {
    const slug = String(p.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (!slug || !p.html || p.html.length < 200) continue;
    // Never let a preview take over a marketplace demo address.
    const existing = await env.DB.prepare('SELECT kind FROM demos WHERE slug = ?').bind(slug).first<{ kind: string }>();
    if (existing && existing.kind !== 'upload') continue;
    await env.MEDIA.put(`demos/${slug}/index.html`, p.html, { httpMetadata: { contentType: 'text/html; charset=utf-8' }, customMetadata: { by: 'morning-routine', lead: p.lead_id ?? '' } });
    if (existing) {
      await env.DB.prepare("UPDATE demos SET title = ?, lead_id = COALESCE(?, lead_id), files = 1, bytes = ?, entry = 'index.html', updated_by = 'Morning routine', updated_at = datetime('now') WHERE slug = ?")
        .bind(`Preview — ${p.company || slug}`, p.lead_id || null, p.html.length, slug).run();
    } else {
      await env.DB.prepare("INSERT INTO demos (id, slug, title, kind, lead_id, notes, files, bytes, entry, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind('dm_' + Math.random().toString(36).slice(2, 12), slug, `Preview — ${p.company || slug}`, 'upload', p.lead_id || null, 'Concept site built by the morning routine', 1, p.html.length, 'index.html', 'Morning routine', 'Morning routine').run();
    }
    const url = `${env.SITE_URL || 'https://www.ferrnagency.com'}/concept/${slug}/`;
    if (p.lead_id) await env.DB.prepare("UPDATE leads SET preview_url = ? WHERE id = ?").bind(url, p.lead_id).run().catch(() => null);
    await engineCall(env, 'dashAction', ['previewSynced', { slug, url }]).catch(() => null);
    n++;
  }
  return n;
}
