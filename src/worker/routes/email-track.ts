import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { all, clamp, first, parseJson, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { addEvent } from '../lib/docs';

/* Email tracking.
 *   GET  /api/e/o/<id>.gif      open pixel (1x1, never cached)
 *   GET  /api/e/c/<id>/<n>      click: logs, then 302 to the original link
 * LeadsHunter outreach (Gmail) uses lh-<message id> ids. Its pixel and links carry an HMAC made with the
 * shared ENGINE_KEY (?t=<sent ms>&s=<sig>), so a hit can arrive before the 10-minute engine sync has
 * created the row. syncOutreachEmails() fills in recipient and subject from the engine snapshot.
 *   GET  /api/studio/emails     Studio list + stats;  GET /api/studio/emails/:id  one email with its opens/clicks
 * Opens are a signal, not proof: Apple Mail can preload images and some mail apps block them.
 * Clicks are the stronger signal. */

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (ch) => ch.charCodeAt(0));
const ID = /^(e[a-f0-9]{20}|lh-[A-Za-z0-9_-]{3,60})$/;
const BOT = /bot\b|crawler|spider|curl|wget|python|go-http|java\/|headless|scanner|barracuda|mimecast|proofpoint|safelinks/i;
/** Ignore hits this soon after sending: link scanners, and you glancing at your own Sent copy. */
const QUIET_MS = { open: { site: 5_000, outreach: 60_000 }, click: { site: 10_000, outreach: 20_000 } };

type LogRow = {
  id: string; source: 'site' | 'outreach'; kind: string; to_addr: string; subject: string | null; company: string | null;
  proposal_id: string | null; invoice_id: string | null; links_json: string; sent_at: string; open_count: number; click_count: number; status: string;
};

const iso = () => new Date().toISOString();
const parseTime = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();

async function hit(env: Bindings, req: Request, id: string, kind: 'open' | 'click', url?: string, sentAt?: string) {
  if (!ID.test(id)) return null;
  let row = await first<LogRow>(env.DB, 'SELECT * FROM email_log WHERE id = ?', id).catch(() => null);
  if (!row && sentAt && id.startsWith('lh-')) {
    // Signed outreach hit before the engine sync: create the row now, details follow at the next sync.
    await run(env.DB, "INSERT OR IGNORE INTO email_log (id, source, kind, to_addr, sent_at) VALUES (?, 'outreach', 'email', '', ?)", id, sentAt);
    row = await first<LogRow>(env.DB, 'SELECT * FROM email_log WHERE id = ?', id);
  }
  if (!row) return null;
  const ua = req.headers.get('user-agent') || '';
  if (BOT.test(ua) && !/GoogleImageProxy|YahooMailProxy/i.test(ua)) return row;
  if (Date.now() - parseTime(row.sent_at) < QUIET_MS[kind][row.source]) return row;
  // Image proxies (Gmail, Yahoo) fetch from their own data centres, so their location says nothing.
  const proxied = /GoogleImageProxy|YahooMailProxy|ggpht\.com/i.test(ua);
  const cf = proxied ? undefined : (req as unknown as { cf?: { country?: string; city?: string } }).cf;
  const now = iso();
  const firstTime = kind === 'open' ? !row.open_count : !row.click_count;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO email_events (email_id, kind, url, ua, country, city) VALUES (?,?,?,?,?,?)')
      .bind(id, kind, url ?? null, ua.slice(0, 300), cf?.country ?? null, cf?.city ?? null),
    kind === 'open'
      ? env.DB.prepare(`UPDATE email_log SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?,
          status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END, delivered_at = COALESCE(delivered_at, ?), updated_at = ? WHERE id = ?`).bind(now, now, now, now, id)
      : env.DB.prepare(`UPDATE email_log SET click_count = click_count + 1, first_clicked_at = COALESCE(first_clicked_at, ?), last_clicked_at = ?,
          open_count = CASE WHEN open_count = 0 THEN 1 ELSE open_count END, first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = COALESCE(last_opened_at, ?),
          status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END, delivered_at = COALESCE(delivered_at, ?), updated_at = ? WHERE id = ?`).bind(now, now, now, now, now, now, id),
  ]);
  // First open / first click shows in the proposal timeline too.
  if (firstTime && row.proposal_id) {
    await addEvent(env.DB, row.proposal_id, kind === 'open' ? 'email_opened' : 'email_clicked', 'Client',
      `${kind === 'open' ? 'Opened' : 'Clicked a link in'} “${row.subject ?? 'email'}”${cf?.city ? ` · ${cf.city}` : ''}`, row.invoice_id).catch(() => null);
  }
  return row;
}

export const emailTrack = new Hono<AppEnv>();

emailTrack.get('/o/:file', async (c) => {
  const id = c.req.param('file').replace(/\.gif$/, '');
  const sentAt = await signedSentAt(c.env, id, c.req.query('t'), c.req.query('s'));
  c.executionCtx.waitUntil(hit(c.env, c.req.raw, id, 'open', undefined, sentAt).catch((e) => console.warn('email open', e)));
  return new Response(GIF, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, no-cache, must-revalidate, max-age=0', pragma: 'no-cache', expires: '0' } });
});

emailTrack.get('/c/:id/:n', async (c) => {
  const id = c.req.param('id'); const n = Number(c.req.param('n'));
  const site = (c.env.SITE_URL || 'https://www.ferrnagency.com').replace(/\/$/, '');
  if (id.startsWith('lh-')) {
    // Outreach: the destination is in the link itself, signed so it can't be used as an open redirect.
    const u = c.req.query('u') || '';
    const sentAt = /^https?:\/\//i.test(u) ? await signedSentAt(c.env, id, c.req.query('t'), c.req.query('s'), u) : undefined;
    if (!sentAt) return c.redirect(site, 302);
    c.executionCtx.waitUntil(hit(c.env, c.req.raw, id, 'click', u, sentAt).catch((e) => console.warn('email click', e)));
    return c.redirect(u, 302);
  }
  const row = ID.test(id) ? await first<LogRow>(c.env.DB, 'SELECT links_json FROM email_log WHERE id = ?', id).catch(() => null) : null;
  const links = parseJson<string[]>(row?.links_json, []);
  const target = Number.isInteger(n) && /^https?:\/\//i.test(links[n] ?? '') ? links[n] : site;
  if (row) c.executionCtx.waitUntil(hit(c.env, c.req.raw, id, 'click', target).catch((e) => console.warn('email click', e)));
  return c.redirect(target, 302);
});

/** HMAC-SHA256(ENGINE_KEY, "<id>|<t>[|<url>]") as hex, first 20 chars — must match sign_() in Code.gs. */
async function sign(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}
/** Returns the ISO send time when the outreach signature checks out, otherwise undefined. */
async function signedSentAt(env: Bindings, id: string, t?: string, s?: string, url?: string) {
  if (!id.startsWith('lh-') || !env.ENGINE_KEY || !t || !s || !/^\d{12,14}$/.test(t)) return undefined;
  const want = await sign(env.ENGINE_KEY, url ? `${id}|${t}|${url}` : `${id}|${t}`);
  if (want.length !== s.length) return undefined;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ s.charCodeAt(i);
  return d === 0 ? new Date(Number(t)).toISOString() : undefined;
}

/** Called after each engine sync: records LeadsHunter's tracked outreach emails (recentSent in the snapshot). */
export async function syncOutreachEmails(env: Bindings, dash: { recentSent?: any[]; settings?: Record<string, unknown> }) {
  const sent = (dash.recentSent ?? []).filter((m) => m && m.channel === 'email' && m.tracked === true && m.id && (m.status === 'sent' || m.status === 'failed'));
  if (!sent.length) return;
  const from = String(dash.settings?.FROM_ACTUAL || dash.settings?.FROM_ALIAS || '').slice(0, 200) || null;
  const stmts = sent.map((m) => {
    const id = 'lh-' + String(m.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const step = String(m.step ?? '');
    const kind = step === '0' ? 'first_email' : step === 'R' ? 'reply' : step ? 'follow_up' : 'email';
    const sentAt = m.sent_at && !Number.isNaN(Date.parse(m.sent_at)) ? new Date(m.sent_at).toISOString() : new Date().toISOString();
    return env.DB.prepare(`INSERT INTO email_log (id, source, kind, from_addr, to_addr, subject, company, lead_id, status, error, sent_at)
        VALUES (?, 'outreach', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, from_addr = excluded.from_addr, to_addr = excluded.to_addr, subject = excluded.subject,
          company = excluded.company, lead_id = excluded.lead_id, sent_at = excluded.sent_at,
          status = CASE WHEN excluded.status = 'failed' THEN 'failed' ELSE email_log.status END, error = excluded.error,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
      .bind(id, kind, from, clamp(m.to, 200), clamp(m.subject, 300) || null, clamp(m.company, 200) || null, clamp(m.lead_id, 80) || null,
        m.status === 'failed' ? 'failed' : 'sent', m.status === 'failed' ? clamp(m.error, 500) || null : null, sentAt);
  });
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

/* ── Studio ── */
export const emailStudio = new Hono<AppEnv>();
emailStudio.use('*', requireUser('viewer'));

emailStudio.get('/', async (c) => {
  const view = c.req.query('view') || 'all';
  const source = c.req.query('source');
  const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
  const q = clamp(c.req.query('q'), 100).toLowerCase();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // Rows still waiting for the engine sync (to_addr '') appear once their details arrive.
  const where: string[] = ['sent_at >= ?', "to_addr <> ''"]; const params: unknown[] = [since];
  if (source === 'site' || source === 'outreach') { where.push('source = ?'); params.push(source); }
  const base = where.join(' AND ');
  const listWhere = [base];
  if (view === 'opened') listWhere.push('open_count > 0');
  if (view === 'unopened') listWhere.push("open_count = 0 AND status NOT IN ('failed','bounced')");
  if (view === 'clicked') listWhere.push('click_count > 0');
  if (view === 'problems') listWhere.push("status IN ('failed','bounced','complained')");
  const listParams = [...params];
  if (q) { listWhere.push('(lower(to_addr) LIKE ? OR lower(subject) LIKE ? OR lower(company) LIKE ?)'); listParams.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  try {
    const [rows, stats] = await Promise.all([
      all(c.env.DB, `SELECT id, source, kind, to_addr, subject, company, proposal_id, invoice_id, lead_id, status, error, sent_at, delivered_at,
          open_count, first_opened_at, last_opened_at, click_count, first_clicked_at, last_clicked_at
        FROM email_log WHERE ${listWhere.join(' AND ')} ORDER BY sent_at DESC LIMIT 300`, ...listParams),
      first<Record<string, number>>(c.env.DB, `SELECT COUNT(*) AS sent,
          SUM(CASE WHEN status NOT IN ('failed','bounced') THEN 1 ELSE 0 END) AS delivered,
          SUM(CASE WHEN open_count > 0 THEN 1 ELSE 0 END) AS opened,
          SUM(CASE WHEN click_count > 0 THEN 1 ELSE 0 END) AS clicked,
          SUM(CASE WHEN status IN ('failed','bounced','complained') THEN 1 ELSE 0 END) AS problems
        FROM email_log WHERE ${base}`, ...params),
    ]);
    return c.json({ ok: true, ready: true, rows, stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, problems: 0, ...Object.fromEntries(Object.entries(stats ?? {}).map(([k, v]) => [k, Number(v) || 0])) } });
  } catch (e) {
    if (/no such table/i.test(String(e))) return c.json({ ok: true, ready: false, rows: [], stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, problems: 0 } });
    throw e;
  }
});

emailStudio.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await first<Record<string, unknown>>(c.env.DB, 'SELECT * FROM email_log WHERE id = ?', id);
  if (!row) return c.json({ ok: false, error: 'Not found' }, 404);
  const events = await all(c.env.DB, 'SELECT kind, url, ua, country, city, at FROM email_events WHERE email_id = ? ORDER BY id DESC LIMIT 200', id);
  return c.json({ ok: true, row: { ...row, links: parseJson<string[]>(row.links_json, []) }, events });
});

/* ── cron: delivery status for site emails (Resend) ── */
export async function syncEmailStatus(env: Bindings) {
  if (!env.RESEND_API_KEY) return;
  if (await env.CACHE.get('email:status:off')) return; // the key cannot read emails (sending-only key)
  const rows = await all<{ id: string; provider_id: string; proposal_id: string | null; invoice_id: string | null; subject: string | null; to_addr: string }>(env.DB,
    `SELECT id, provider_id, proposal_id, invoice_id, subject, to_addr FROM email_log
     WHERE source = 'site' AND provider_id IS NOT NULL AND status = 'sent' AND sent_at >= ?
       AND (status_checked_at IS NULL OR status_checked_at < ?) ORDER BY sent_at DESC LIMIT 25`,
    new Date(Date.now() - 3 * 86400000).toISOString(), new Date(Date.now() - 9 * 60000).toISOString()).catch(() => []);
  for (const r of rows) {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(r.provider_id)}`, { headers: { authorization: `Bearer ${env.RESEND_API_KEY}` } });
    if (res.status === 401 || res.status === 403) { await env.CACHE.put('email:status:off', '1', { expirationTtl: 86400 }); return; }
    if (!res.ok) continue;
    const d = (await res.json().catch(() => ({}))) as { last_event?: string };
    const ev = d.last_event || '';
    const status = ev === 'bounced' ? 'bounced' : ev === 'complained' ? 'complained' : ['delivered', 'opened', 'clicked'].includes(ev) ? 'delivered' : 'sent';
    await run(env.DB, `UPDATE email_log SET status = CASE WHEN status = 'sent' THEN ? ELSE status END, delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
      status_checked_at = ?, updated_at = ? WHERE id = ?`, status, status, iso(), iso(), iso(), r.id);
    if (status === 'bounced' && r.proposal_id) await addEvent(env.DB, r.proposal_id, 'email_bounced', 'System', `“${r.subject ?? 'Email'}” to ${r.to_addr} bounced. Check the address.`, r.invoice_id).catch(() => null);
  }
}
