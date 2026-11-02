import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { all, first, run } from '../lib/db';
import { requireUser } from '../lib/auth';

/* Studio notifications: the things that happened without you — new website leads and
 * enquiries, orders, proposal activity (viewed, signed, paid, opened, bounced), WhatsApp
 * messages and outreach replies that need a human. Read from the tables that already
 * record them, so nothing has to be written twice. "Seen" is one timestamp per user. */

export type Notice = { id: string; kind: string; title: string; detail: string | null; at: string; href: string; tone: 'ok' | 'info' | 'warn' | 'money' };

const norm = (t: string | null | undefined) => {
  if (!t) return new Date(0).toISOString();
  const s = String(t);
  return s.includes('T') ? (s.endsWith('Z') || /[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z') : s.replace(' ', 'T') + 'Z';
};
const safe = async <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]); // a table missing locally is not an outage

export const notificationsApi = new Hono<AppEnv>();
notificationsApi.use('*', requireUser('viewer'));

notificationsApi.get('/', async (c) => {
  const u = c.get('user')!; const db = c.env.DB;
  const since = new Date(Date.now() - 14 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const seenRow = await first<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', `notif_seen:${u.id}`);
  const seen = seenRow?.value || new Date(0).toISOString();

  const [leads, needs, reqs, orders, pev, wa] = await Promise.all([
    safe(all<any>(db, `SELECT id, company, contact_name, email, phone, updated_at FROM leads WHERE origin = 'website' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 20`, since)),
    safe(all<any>(db, `SELECT id, company, needs_you_reason, updated_at FROM leads WHERE needs_you = 'Y' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 20`, since)),
    safe(all<any>(db, `SELECT id, type, name, email, phone, company, message, status, created_at FROM requests WHERE created_at >= ? AND status <> 'spam' ORDER BY created_at DESC LIMIT 20`, since)),
    safe(all<any>(db, `SELECT o.id, o.customer_name, o.status, o.created_at, p.name AS product FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.created_at >= ? ORDER BY o.created_at DESC LIMIT 20`, since)),
    safe(all<any>(db, `SELECT e.id, e.kind, e.detail, e.at, e.proposal_id, p.number, p.client_company, p.client_name FROM proposal_events e JOIN proposals p ON p.id = e.proposal_id
      WHERE e.at >= ? AND e.kind IN ('viewed','signed','declined','changes','receipt','payment','paid','email_opened','email_clicked','email_bounced') ORDER BY e.id DESC LIMIT 40`, since)),
    safe(all<any>(db, `SELECT m.id, m.body, m.created_at, m.wa_id, c.name FROM wa_messages m LEFT JOIN wa_contacts c ON c.wa_id = m.wa_id WHERE m.direction = 'in' AND m.created_at >= ? ORDER BY m.created_at DESC LIMIT 20`, since)),
  ]);

  const items: Notice[] = [];
  for (const l of leads) items.push({ id: `lead:${l.id}`, kind: 'lead', tone: 'ok', at: norm(l.updated_at), href: `/leads/${l.id}`,
    title: `New website lead: ${l.company || l.contact_name || 'someone'}`, detail: [l.contact_name, l.email || l.phone].filter(Boolean).join(' · ') || null });
  for (const l of needs) items.push({ id: `needs:${l.id}:${l.updated_at}`, kind: 'needs_you', tone: 'warn', at: norm(l.updated_at), href: `/leads/${l.id}`,
    title: `${l.company || 'A lead'} needs you`, detail: l.needs_you_reason || 'Reply or decide the next step' });
  const reqLabel: Record<string, string> = { contact: 'Contact form', rfp: 'Project brief', demo: 'Demo request', customise: 'Customisation request', referral: 'Referral', newsletter: 'Newsletter signup', chat_lead: 'Chat lead' };
  for (const r of reqs) {
    const who = r.name || r.company || r.email || (r.phone ? '+' + String(r.phone).replace(/\D/g, '') : '') || 'a visitor';
    const detail = [r.name && r.company ? r.company : null, !r.name && !r.company && r.message ? String(r.message).slice(0, 90) : null].filter(Boolean).join(' · ') || null;
    items.push({ id: `req:${r.id}`, kind: 'enquiry', tone: 'ok', at: norm(r.created_at), href: `/marketplace/requests`, title: `${reqLabel[r.type] || 'Enquiry'}: ${who}`, detail });
  }
  for (const o of orders) items.push({ id: `order:${o.id}`, kind: 'order', tone: o.status === 'paid' ? 'money' : 'info', at: norm(o.created_at), href: `/marketplace/orders`,
    title: `${o.status === 'paid' ? 'Paid order' : 'New order'} from ${o.customer_name}`, detail: o.product || null });
  const pevTitle: Record<string, (e: any) => [string, Notice['tone']]> = {
    viewed: (e) => [`${e.client_company || e.client_name} opened ${e.number}`, 'info'],
    signed: (e) => [`${e.client_company || e.client_name} signed ${e.number}`, 'money'],
    declined: (e) => [`${e.client_company || e.client_name} declined ${e.number}`, 'warn'],
    changes: (e) => [`${e.client_company || e.client_name} asked for changes on ${e.number}`, 'warn'],
    receipt: (e) => [`Receipt uploaded for ${e.number}`, 'money'],
    payment: (e) => [`Payment recorded on ${e.number}`, 'money'],
    paid: (e) => [`${e.number} is paid in full`, 'money'],
    email_opened: (e) => [`${e.client_company || e.client_name} opened your email`, 'info'],
    email_clicked: (e) => [`${e.client_company || e.client_name} clicked a link in your email`, 'info'],
    email_bounced: (e) => [`Email to ${e.client_company || e.client_name} bounced`, 'warn'],
  };
  for (const e of pev) {
    const [title, tone] = (pevTitle[e.kind] || ((x: any) => [`${x.kind} on ${x.number}`, 'info' as const]))(e);
    items.push({ id: `pev:${e.id}`, kind: e.kind, tone, at: norm(e.at), href: `/proposals/${e.proposal_id}`, title, detail: e.detail || null });
  }
  for (const m of wa) items.push({ id: `wa:${m.id}`, kind: 'whatsapp', tone: 'ok', at: norm(m.created_at), href: `/whatsapp?chat=${m.wa_id}`,
    title: `WhatsApp from ${m.name || '+' + m.wa_id}`, detail: m.body ? String(m.body).slice(0, 90) : null });

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  const top = items.slice(0, 40);
  return c.json({ ok: true, items: top, seen, unread: top.filter((i) => i.at > seen).length });
});

notificationsApi.post('/seen', async (c) => {
  const u = c.get('user')!;
  const now = new Date().toISOString();
  await run(c.env.DB, `INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`, `notif_seen:${u.id}`, now, u.name);
  return c.json({ ok: true, seen: now });
});
