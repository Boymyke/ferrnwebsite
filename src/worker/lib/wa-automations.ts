import type { Bindings } from './env';
import { all, first, run } from './db';
import { complete, type ChatMessage } from './ai';
import { assistantSystemPrompt } from './assistant';
import { inServiceWindow, markRead, normalisePhone, queueTemplate, sendTemplate, sendText, upsertContact, waConfigured } from './whatsapp';

const HOUR = 3600e3;
const firstName = (n?: string | null) => (n || '').trim().split(/\s+/)[0] || 'there';

/** Website/marketplace enquiry with WhatsApp consent → instant acknowledgement + two polite follow-ups. */
export async function onEnquiry(env: Bindings, e: { name?: string | null; phone?: string | null; consent: boolean; topic: string; leadId?: string | null }) {
  const waId = normalisePhone(e.phone);
  if (!waId || !e.consent || !waConfigured(env)) return;
  await upsertContact(env, waId, { name: e.name, leadId: e.leadId, optIn: true, source: 'website form' });
  await sendTemplate(env, waId, 'ferrn_enquiry_received', [firstName(e.name), e.topic.slice(0, 80) || 'your project']);
  const booking = env.BOOKING_URL || 'https://cal.com/ferrn-agency';
  const seq = `followup:${waId}`;
  await queueTemplate(env, waId, 'ferrn_follow_up', [firstName(e.name), e.topic.slice(0, 80) || 'your project', booking], new Date(Date.now() + 2 * 24 * HOUR), seq);
  await queueTemplate(env, waId, 'ferrn_follow_up', [firstName(e.name), e.topic.slice(0, 80) || 'your project', booking], new Date(Date.now() + 6 * 24 * HOUR), seq);
}

/** Meeting booked for a lead whose WhatsApp is opted in → reminders 24 h and 1 h before. */
export async function onMeetingBooked(env: Bindings, m: { id: string; lead_id?: string | null; starts_at: string; location_url?: string | null }) {
  if (!m.lead_id || !waConfigured(env)) return;
  const c = await first<{ wa_id: string; name: string | null }>(env.DB,
    'SELECT wa_id, name FROM wa_contacts WHERE lead_id = ? AND opted_in = 1 AND opted_out_at IS NULL', m.lead_id);
  if (!c) return;
  const start = Date.parse(m.starts_at);
  if (!Number.isFinite(start)) return;
  const when = new Date(start).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' (Lagos)';
  const link = m.location_url || env.BOOKING_URL || 'https://cal.com/ferrn-agency';
  await run(env.DB, "UPDATE wa_queue SET status = 'cancelled' WHERE sequence = ? AND status = 'pending'", `reminder:${m.id}`);
  for (const before of [24, 1]) {
    const at = start - before * HOUR;
    if (at > Date.now()) await queueTemplate(env, c.wa_id, 'ferrn_meeting_reminder', [firstName(c.name), when, link], new Date(at), `reminder:${m.id}`);
  }
}

/** Quote marked as sent → WhatsApp the link if the lead opted in. */
export async function onQuoteSent(env: Bindings, q: { lead_id?: string | null; number: string; share_key: string; client_name?: string | null }) {
  if (!q.lead_id || !waConfigured(env)) return;
  const c = await first<{ wa_id: string; name: string | null }>(env.DB,
    'SELECT wa_id, name FROM wa_contacts WHERE lead_id = ? AND opted_in = 1 AND opted_out_at IS NULL', q.lead_id);
  if (!c) return;
  await sendTemplate(env, c.wa_id, 'ferrn_quote_sent', [firstName(q.client_name || c.name), q.number, `${env.SITE_URL}/q/${q.share_key}`]);
}

/** Paid marketplace order → thank-you + next steps (customer gave their number at checkout). */
export async function onPayment(env: Bindings, o: { name: string; phone?: string | null; product: string; consent?: boolean }) {
  const waId = normalisePhone(o.phone);
  if (!waId || !waConfigured(env) || o.consent === false) return;
  await upsertContact(env, waId, { name: o.name, optIn: true, source: 'checkout' });
  await sendTemplate(env, waId, 'ferrn_payment_received', [firstName(o.name), o.product]);
}

/** Cron: send due automated messages to contacts who are still opted in and haven't replied mid-sequence. */
export async function processQueue(env: Bindings) {
  if (!waConfigured(env)) return { sent: 0 };
  const due = await all<{ id: string; wa_id: string; template: string; params_json: string; sequence: string | null }>(env.DB,
    `SELECT q.id, q.wa_id, q.template, q.params_json, q.sequence FROM wa_queue q
     JOIN wa_contacts c ON c.wa_id = q.wa_id
     WHERE q.status = 'pending' AND q.send_after <= datetime('now') AND c.opted_in = 1 AND c.opted_out_at IS NULL
     ORDER BY q.send_after LIMIT 40`);
  let sent = 0;
  for (const q of due) {
    const r = await sendTemplate(env, q.wa_id, q.template, JSON.parse(q.params_json || '[]'));
    await run(env.DB, `UPDATE wa_queue SET status = ?, error = ?, sent_at = datetime('now') WHERE id = ?`, r.ok ? 'sent' : 'failed', r.error ?? null, q.id);
    if (r.ok) { sent++; await run(env.DB, "UPDATE wa_contacts SET last_outbound_at = datetime('now') WHERE wa_id = ?", q.wa_id); }
  }
  return { sent };
}

const HUMAN = /\b(human|agent|person|real person|customer care|call me|speak (to|with)|talk (to|with))\b/i;
const STOP = /^\s*(stop|unsubscribe|opt ?out)\s*\.?\s*$/i;
const START = /^\s*(start|subscribe)\s*\.?\s*$/i;

/** Handles one inbound WhatsApp message: logging, opt-out, human hand-off and the AI reply. */
export async function handleInbound(env: Bindings, m: { from: string; id: string; name?: string; type: string; text?: string }) {
  const waId = m.from;
  await upsertContact(env, waId, { name: m.name ?? null, optIn: true, source: 'inbound' });
  await run(env.DB, "UPDATE wa_contacts SET last_inbound_at = datetime('now') WHERE wa_id = ?", waId);
  await run(env.DB, `INSERT INTO wa_messages (id, wa_id, direction, kind, body, status, wa_msg_id, sent_by) VALUES (?,?,?,?,?,?,?,?)`,
    'wm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16), waId, 'in', m.type, m.text ?? `[${m.type}]`, 'received', m.id, m.name ?? 'customer');
  // They replied: stop any follow-up sequence (reminders for booked calls keep going).
  await run(env.DB, "UPDATE wa_queue SET status = 'cancelled' WHERE wa_id = ? AND status = 'pending' AND sequence LIKE 'followup:%'", waId);
  // Link to a lead and move it forward.
  const contact = await first<{ lead_id: string | null; bot_paused: number; name: string | null }>(env.DB, 'SELECT lead_id, bot_paused, name FROM wa_contacts WHERE wa_id = ?', waId);
  if (contact?.lead_id) {
    await run(env.DB, "UPDATE leads SET last_reply = date('now'), status = CASE WHEN status IN ('New','Queued','Contacted','Following up','WhatsApp ready') THEN 'Replied' ELSE status END WHERE id = ?", contact.lead_id);
  }
  await markRead(env, m.id);

  const text = (m.text ?? '').trim();
  if (STOP.test(text)) {
    await run(env.DB, "UPDATE wa_contacts SET opted_in = 0, opted_out_at = datetime('now') WHERE wa_id = ?", waId);
    await run(env.DB, "UPDATE wa_queue SET status = 'cancelled' WHERE wa_id = ? AND status = 'pending'", waId);
    await sendText(env, waId, 'Done, you won’t get any more automated WhatsApp messages from Ferrn. Reply START any time to turn them back on.');
    return;
  }
  if (START.test(text)) {
    await run(env.DB, "UPDATE wa_contacts SET opted_in = 1, opted_out_at = NULL, opted_in_at = datetime('now') WHERE wa_id = ?", waId);
    await sendText(env, waId, 'You’re back on. How can we help?');
    return;
  }
  if (contact?.bot_paused) return; // a team member is handling this chat
  if (m.type !== 'text' || !text) {
    await run(env.DB, 'UPDATE wa_contacts SET needs_human = 1 WHERE wa_id = ?', waId);
    await sendText(env, waId, 'Thanks! I can only read text messages, so I’ve passed this to the team and someone will get back to you shortly.');
    return;
  }
  if (HUMAN.test(text)) {
    await run(env.DB, 'UPDATE wa_contacts SET needs_human = 1, bot_paused = 1 WHERE wa_id = ?', waId);
    await sendText(env, waId, 'Sure, I’ve asked a member of the Ferrn team to take over. They’ll reply here shortly (Mon–Fri, 9am–6pm Lagos time).');
    return;
  }

  const history = await all<{ direction: string; body: string }>(env.DB,
    'SELECT direction, body FROM wa_messages WHERE wa_id = ? ORDER BY created_at DESC LIMIT 12', waId);
  const system = await assistantSystemPrompt(env, { channel: 'whatsapp', langName: 'the same language the customer writes in (English, Nigerian Pidgin, Yorùbá, Igbo, Hausa, French and so on)' });
  const messages: ChatMessage[] = [
    { role: 'system', content: system + (contact?.name ? `\n\nThe customer's WhatsApp name is ${contact.name}.` : '') },
    ...history.reverse().slice(0, -1).map((h) => ({ role: (h.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant', content: String(h.body ?? '').slice(0, 1500) })),
    { role: 'user', content: text.slice(0, 1500) },
  ];
  let reply = '';
  try { reply = (await complete(env, messages, { maxTokens: 300 })).text; } catch { /* fall through */ }
  if (!reply) {
    await run(env.DB, 'UPDATE wa_contacts SET needs_human = 1 WHERE wa_id = ?', waId);
    reply = 'Thanks for your message! A member of the Ferrn team will reply here shortly.';
  }
  if (await inServiceWindow(env, waId)) await sendText(env, waId, reply);
}

/** Status callbacks (sent → delivered → read / failed) update the message log. */
export async function handleStatus(env: Bindings, s: { id: string; status: string; errors?: { title?: string; message?: string }[] }) {
  await run(env.DB, 'UPDATE wa_messages SET status = ?, error = COALESCE(?, error) WHERE wa_msg_id = ?',
    s.status, s.errors?.[0]?.message || s.errors?.[0]?.title || null, s.id);
}
