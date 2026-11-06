import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { clamp, first, isEmail, newId, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { complete, extractJson } from '../lib/ai';
import { brandEmail, emailConfigured, sendEmail } from '../lib/email';
import { onMeetingBooked } from '../lib/wa-automations';

/* What to do when an order comes in (Studio › Marketplace › Orders):
 *   POST /:id/welcome-draft   AI (or a template) writes a welcome email for the client
 *   POST /:id/email           send it from michael@ferrnagency.com (tracked, shows in Emails)
 *   POST /:id/meeting         book a kickoff call: links the client to a lead, creates the meeting,
 *                             and can email them the time, the link and a calendar file. */

type Order = { id: string; product_id: string | null; product: string | null; tier: string; customer_name: string; email: string; phone: string | null;
  company: string | null; currency: string; amount: number; status: string; notes: string | null; created_at: string };

const getOrder = (env: Bindings, id: string) => first<Order>(env.DB,
  'SELECT o.*, p.name AS product FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id = ?', id);
const first_ = (name: string) => name.trim().split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase()).replace(/^(.)(.*)$/, (_m, a, b) => a + b.toLowerCase());
const amountText = (o: Order) => `${o.currency === 'USD' ? '$' : '₦'}${(o.amount / 100).toLocaleString()}`;
const plan = (t: string) => ({ launch: 'Launch', managed: 'Managed', buyout: 'Own the code' }[t] ?? t);
const addNote = (env: Bindings, id: string, line: string) =>
  run(env.DB, "UPDATE orders SET notes = TRIM(COALESCE(notes, '') || char(10) || ?) WHERE id = ?", `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${line}`, id);

function template(o: Order) {
  const paid = o.status === 'paid';
  return {
    subject: `Welcome to Ferrn, ${first_(o.customer_name)}: next steps for your ${o.product ?? 'project'}`,
    body: [
      `Hi ${first_(o.customer_name)},`,
      `Thank you for choosing Ferrn for your ${o.product ?? 'project'} (${plan(o.tier)} plan)${o.company ? ` for ${o.company}` : ''}. ${paid ? 'Your payment has come through.' : 'Your invoice is on its way if it isn’t with you already.'}`,
      'Here is what happens next:\n1. A 30-minute kickoff call, where we go through your business, your brand and what you want the site to do.\n2. You send us your logo, photos and any content you already have (we’ll share a simple checklist).\n3. We set everything up and send you a preview link to review before anything goes live.',
      'Reply with two or three times that work for you this week, or I’ll send an invitation shortly.',
      'Looking forward to working with you.',
    ].join('\n\n'),
  };
}

export const orderActions = new Hono<AppEnv>();
orderActions.use('*', requireUser('sales'));

orderActions.post('/:id/welcome-draft', async (c) => {
  const o = await getOrder(c.env, c.req.param('id'));
  if (!o) return c.json({ ok: false, error: 'Order not found' }, 404);
  const base = template(o);
  try {
    const r = await complete(c.env, [
      { role: 'system', content: `You write a short welcome email from Michael, founder of Ferrn Digital Agency (Lagos), to a client who just ordered. Warm, clear, plain English, no hype, no exclamation marks, no emojis.
Keep the structure of the template you're given (greeting, thanks, numbered next steps, ask for call times), personalise it lightly with the facts given, and never invent facts, prices or dates.
Don't add a signature (it's added automatically). Return JSON {"subject": string, "body": string} where body is plain text with blank lines between paragraphs.` },
      { role: 'user', content: JSON.stringify({ template: base, order: { product: o.product, plan: plan(o.tier), client: o.customer_name, company: o.company, paid: o.status === 'paid', amount: amountText(o) } }) },
    ], { maxTokens: 700, json: true, bucket: 'studio' });
    const j = extractJson<{ subject?: string; body?: string }>(r.text, {});
    if (j.subject && j.body && j.body.length > 120) return c.json({ ok: true, draft: { subject: clamp(j.subject, 200), body: clamp(j.body, 6000) } });
  } catch (e) { console.warn('welcome draft', e); }
  return c.json({ ok: true, draft: base });
});

orderActions.post('/:id/email', async (c) => {
  const u = c.get('user')!;
  const o = await getOrder(c.env, c.req.param('id'));
  if (!o) return c.json({ ok: false, error: 'Order not found' }, 404);
  if (!emailConfigured(c.env)) return c.json({ ok: false, error: 'Email isn’t switched on (RESEND_API_KEY).' }, 503);
  const b = (await c.req.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = clamp(b.subject, 200); const body = clamp(b.body, 8000);
  if (!subject || body.length < 20) return c.json({ ok: false, error: 'Add a subject and a message.' }, 422);
  if (!isEmail(o.email)) return c.json({ ok: false, error: 'This order has no valid email address.' }, 422);
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const heading = paras[0] && paras[0].length < 60 && /^(hi|hello|dear)\b/i.test(paras[0]) ? paras.shift()! : `Welcome, ${first_(o.customer_name)}`;
  const html = brandEmail(c.env, { preheader: paras[0]?.slice(0, 120), heading, paragraphs: [...paras, '— Michael, Ferrn Digital Agency'] });
  const r = await sendEmail(c.env, { to: o.email, subject, html, text: `${heading}\n\n${paras.join('\n\n')}\n\n— Michael, Ferrn Digital Agency`, track: { kind: 'welcome', company: o.company || o.customer_name } });
  if (!r.ok) return c.json({ ok: false, error: r.error || 'Email failed' }, 502);
  await addNote(c.env, o.id, `${u.name} sent “${subject}”`);
  await audit(c, 'orders', o.id, 'email', `${u.name} emailed ${o.customer_name}: ${subject}`);
  return c.json({ ok: true });
});

/** Calendar file (RFC 5545) so the client can add the call in one tap. */
function ics(m: { id: string; title: string; start: Date; minutes: number; url?: string | null; agenda?: string | null; to: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const end = new Date(m.start.getTime() + m.minutes * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ferrn Digital Agency//Studio//EN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${m.id}@ferrnagency.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(m.start)}`, `DTEND:${f(end)}`, `SUMMARY:${e(m.title)}`,
    `DESCRIPTION:${e([m.agenda, m.url ? `Join: ${m.url}` : ''].filter(Boolean).join('\n\n'))}`, ...(m.url ? [`LOCATION:${e(m.url)}`, `URL:${m.url}`] : []),
    'ORGANIZER;CN=Michael | Ferrn:mailto:michael@ferrnagency.com', `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${m.to}`,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

orderActions.post('/:id/meeting', async (c) => {
  const u = c.get('user')!;
  const o = await getOrder(c.env, c.req.param('id'));
  if (!o) return c.json({ ok: false, error: 'Order not found' }, 404);
  const b = (await c.req.json().catch(() => ({}))) as { starts_at?: string; duration_min?: number; channel?: string; location_url?: string; agenda?: string; invite?: boolean; title?: string };
  const start = new Date(String(b.starts_at ?? ''));
  if (Number.isNaN(start.getTime())) return c.json({ ok: false, error: 'Pick a date and time.' }, 422);
  if (start.getTime() < Date.now() - 5 * 60000) return c.json({ ok: false, error: 'That time has already passed.' }, 422);
  const minutes = Math.min(240, Math.max(15, Math.round(Number(b.duration_min) || 30)));
  const channel = ['google_meet', 'zoom', 'phone', 'whatsapp', 'in_person'].includes(String(b.channel)) ? String(b.channel) : 'google_meet';
  const url = /^https:\/\//i.test(String(b.location_url ?? '')) ? clamp(b.location_url, 500) : null;
  const title = clamp(b.title, 160) || `Kickoff: ${o.product ?? 'project'} · ${o.company || o.customer_name}`;
  const agenda = clamp(b.agenda, 2000) || `Kickoff for ${o.product ?? 'the project'} (${plan(o.tier)} plan): goals, brand, content checklist, timeline.`;

  // The client becomes (or already is) a lead, so the meeting, emails and history sit together.
  let lead = await first<{ id: string }>(c.env.DB, 'SELECT id FROM leads WHERE lower(email) = lower(?) LIMIT 1', o.email);
  if (!lead) {
    const id = newId('L-');
    await run(c.env.DB, `INSERT INTO leads (id, created, company, email, phone, contact_name, status, est_value, origin, source, notes, updated_by)
      VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, 'website', 'marketplace order', ?, ?)`,
      id, o.company || o.customer_name, o.email, o.phone, o.customer_name, o.status === 'paid' ? 'Won' : 'Call booked',
      o.currency === 'NGN' ? Math.round(o.amount / 100) : null, `Order ${o.id}: ${o.product ?? ''} (${plan(o.tier)}), ${amountText(o)}`, u.name);
    lead = { id };
  }
  const mid = newId('m_');
  await run(c.env.DB, `INSERT INTO meetings (id, lead_id, title, starts_at, duration_min, channel, location_url, attendees, status, agenda, created_by, updated_by)
    VALUES (?,?,?,?,?,?,?,?, 'scheduled', ?, ?, ?)`, mid, lead.id, title, start.toISOString(), minutes, channel, url, `${o.customer_name} <${o.email}>`, agenda, u.name, u.name);
  c.executionCtx.waitUntil(onMeetingBooked(c.env, { id: mid, lead_id: lead.id, starts_at: start.toISOString(), location_url: url }).catch(() => null));

  let invited = false; let inviteError: string | null = null;
  if (b.invite && emailConfigured(c.env) && isEmail(o.email)) {
    const when = start.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const how = url ? 'Join with the button below at the time.' : channel === 'phone' || channel === 'whatsapp' ? `I’ll call you on ${o.phone || 'your number'}.` : 'I’ll send the joining details before the call.';
    const html = brandEmail(c.env, { preheader: `${when} (Lagos time)`, heading: 'Your kickoff call is booked',
      paragraphs: [`Hi ${first_(o.customer_name)}, I’ve booked our kickoff call for your ${o.product ?? 'project'}.`, how, 'The calendar invite is attached so you can add it in one tap. If the time doesn’t work, just reply and we’ll move it.'],
      rows: [['When', `${when} (Lagos time, WAT)`], ['Length', `${minutes} minutes`], ['What we’ll cover', agenda.slice(0, 160)]],
      ...(url ? { button: { label: 'Join the call', url } } : {}) });
    const content = btoa(unescape(encodeURIComponent(ics({ id: mid, title, start, minutes, url, agenda, to: o.email }))));
    const r = await sendEmail(c.env, { to: o.email, subject: `Kickoff call: ${when}`, html, track: { kind: 'meeting', company: o.company || o.customer_name },
      attachments: [{ filename: 'ferrn-kickoff.ics', content, contentType: 'text/calendar; method=REQUEST' }] });
    invited = r.ok; inviteError = r.ok ? null : r.error ?? 'Email failed';
  }
  await addNote(c.env, o.id, `${u.name} booked a kickoff call for ${start.toISOString().slice(0, 16).replace('T', ' ')} UTC${invited ? ' and emailed the invite' : ''}`);
  await audit(c, 'meetings', mid, 'create', `${u.name} booked a kickoff call with ${o.customer_name} (order ${o.id})`);
  return c.json({ ok: true, meeting_id: mid, lead_id: lead.id, invited, inviteError });
});
