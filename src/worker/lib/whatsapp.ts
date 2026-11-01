import type { Bindings } from './env';
import { first, newId, run } from './db';

/**
 * WhatsApp Cloud API (Meta). Official API only: messages go to people who opted in
 * or who messaged us first. Free-form text is only allowed inside the 24-hour
 * window after their last message; anything else must be an approved template.
 */
const GRAPH = 'https://graph.facebook.com/v23.0';

export const waConfigured = (env: Bindings) => !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);

/** Normalise Nigerian/international numbers to WhatsApp's digits-only E.164 form (e.g. 2348031234567). */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1); // 0803… → 234803…
  return /^\d{10,15}$/.test(d) ? d : null;
}

type SendResult = { ok: boolean; id?: string; error?: string };

async function post(env: Bindings, payload: Record<string, unknown>): Promise<SendResult> {
  if (!waConfigured(env)) return { ok: false, error: 'WhatsApp is not connected' };
  const res = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
  return { ok: true, id: data?.messages?.[0]?.id };
}

async function log(env: Bindings, waId: string, kind: 'text' | 'template', body: string, r: SendResult, sentBy: string, template?: string) {
  await run(env.DB, `INSERT INTO wa_messages (id, wa_id, direction, kind, body, template, status, wa_msg_id, error, sent_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, newId('wm_'), waId, 'out', kind, body, template ?? null,
    r.ok ? 'sent' : 'failed', r.id ?? null, r.error ?? null, sentBy);
}

/** True when the customer messaged us in the last 24 hours, so free-form text is allowed. */
export async function inServiceWindow(env: Bindings, waId: string) {
  const c = await first<{ last_inbound_at: string | null }>(env.DB, 'SELECT last_inbound_at FROM wa_contacts WHERE wa_id = ?', waId);
  return !!c?.last_inbound_at && Date.now() - Date.parse(c.last_inbound_at + 'Z') < 23.5 * 3600e3;
}

export async function sendText(env: Bindings, waId: string, body: string, sentBy = 'bot') {
  const r = await post(env, { to: waId, type: 'text', text: { body: body.slice(0, 4000), preview_url: true } });
  await log(env, waId, 'text', body, r, sentBy);
  return r;
}

export async function sendTemplate(env: Bindings, waId: string, template: string, params: string[], sentBy = 'automation') {
  const r = await post(env, {
    to: waId, type: 'template',
    template: {
      name: template, language: { code: env.WHATSAPP_TEMPLATE_LANG || 'en' },
      ...(params.length ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text).slice(0, 900) })) }] } : {}),
    },
  });
  const preview = TEMPLATES[template] ? fill(TEMPLATES[template].body, params) : `[${template}] ${params.join(' · ')}`;
  await log(env, waId, 'template', preview, r, sentBy, template);
  return r;
}

export async function markRead(env: Bindings, msgId: string) {
  await post(env, { status: 'read', message_id: msgId }).catch(() => null);
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export async function validWebhookSignature(env: Bindings, raw: string, header: string | undefined) {
  if (!env.WHATSAPP_APP_SECRET) return true; // allowed during first setup; set the secret to enforce
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WHATSAPP_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const want = header.slice(7);
  if (hex.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const fill = (s: string, p: string[]) => s.replace(/\{\{(\d+)\}\}/g, (_, i) => p[Number(i) - 1] ?? '');

/**
 * Message templates to create once in WhatsApp Manager (Account tools → Message templates).
 * Names, categories and bodies must match exactly. All are short, useful and have an opt-out.
 */
export const TEMPLATES: Record<string, { category: 'UTILITY' | 'MARKETING'; body: string; example: string[] }> = {
  ferrn_enquiry_received: {
    category: 'UTILITY',
    body: 'Hi {{1}}, thanks for contacting Ferrn Digital Agency. We have your enquiry about {{2}} and a team member will reply here within one working day. Reply STOP to stop WhatsApp messages.',
    example: ['Ada', 'a clinic website'],
  },
  ferrn_follow_up: {
    category: 'MARKETING',
    body: 'Hi {{1}}, Michael from Ferrn here. Just checking in on {{2}}. Would a 15-minute call this week help? You can pick a time here: {{3}}. Reply STOP to opt out.',
    example: ['Ada', 'your clinic website', 'https://cal.com/ferrn-agency'],
  },
  ferrn_meeting_reminder: {
    category: 'UTILITY',
    body: 'Hi {{1}}, a reminder of your call with Ferrn on {{2}}. Join here: {{3}}. Reply to this message if you need to reschedule.',
    example: ['Ada', 'Tue 4 Nov, 10:00 (Lagos)', 'https://meet.google.com/abc-defg-hij'],
  },
  ferrn_quote_sent: {
    category: 'UTILITY',
    body: 'Hi {{1}}, your Ferrn quote {{2}} is ready. You can view and accept it here: {{3}}. Reply here with any questions.',
    example: ['Ada', 'FQ-2026-004', 'https://www.ferrnagency.com/q/abc123'],
  },
  ferrn_payment_received: {
    category: 'UTILITY',
    body: 'Hi {{1}}, we have received your payment for {{2}}. Thank you! Your project lead will message you here within one working day with next steps.',
    example: ['Ada', 'Clinic Front Desk (Launch plan)'],
  },
};

/** Upserts a contact; opt-in is only ever turned ON by explicit consent or by them messaging us. */
export async function upsertContact(env: Bindings, waId: string, f: { name?: string | null; leadId?: string | null; optIn?: boolean; source?: string }) {
  await run(env.DB, `INSERT INTO wa_contacts (wa_id, name, lead_id, opted_in, opted_in_at, source)
      VALUES (?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END, ?)
    ON CONFLICT(wa_id) DO UPDATE SET
      name = COALESCE(wa_contacts.name, excluded.name),
      lead_id = COALESCE(wa_contacts.lead_id, excluded.lead_id),
      opted_in = CASE WHEN excluded.opted_in = 1 AND wa_contacts.opted_out_at IS NULL THEN 1 ELSE wa_contacts.opted_in END,
      opted_in_at = COALESCE(wa_contacts.opted_in_at, excluded.opted_in_at)`,
    waId, f.name ?? null, f.leadId ?? null, f.optIn ? 1 : 0, f.optIn ? 1 : 0, f.source ?? null);
}

/** Queue an automated template for later; the cron sends it if the contact is still opted in and hasn't replied. */
export async function queueTemplate(env: Bindings, waId: string, template: string, params: string[], sendAfter: Date, sequence?: string) {
  await run(env.DB, `INSERT INTO wa_queue (id, wa_id, template, params_json, send_after, sequence) VALUES (?,?,?,?,?,?)`,
    newId('wq_'), waId, template, JSON.stringify(params), sendAfter.toISOString().replace('T', ' ').slice(0, 19), sequence ?? null);
}
