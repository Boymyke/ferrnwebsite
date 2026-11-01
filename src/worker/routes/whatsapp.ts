import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { validWebhookSignature } from '../lib/whatsapp';
import { handleInbound, handleStatus } from '../lib/wa-automations';

/** Meta WhatsApp Cloud API webhook: https://<site>/api/whatsapp/webhook */
export const whatsappWebhook = new Hono<AppEnv>();

// Verification handshake when you add the webhook URL in the Meta app dashboard.
whatsappWebhook.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode'), token = c.req.query('hub.verify_token'), challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token && c.env.WHATSAPP_VERIFY_TOKEN && token === c.env.WHATSAPP_VERIFY_TOKEN) return c.text(challenge ?? '');
  return c.text('Forbidden', 403);
});

whatsappWebhook.post('/webhook', async (c) => {
  const raw = await c.req.text();
  if (!(await validWebhookSignature(c.env, raw, c.req.header('x-hub-signature-256')))) return c.text('Bad signature', 401);
  let body: any;
  try { body = JSON.parse(raw); } catch { return c.text('ok'); }
  const work: Promise<unknown>[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {};
      const names: Record<string, string> = {};
      for (const ct of v.contacts ?? []) if (ct?.wa_id) names[ct.wa_id] = ct?.profile?.name;
      for (const m of v.messages ?? []) {
        const text = m.type === 'text' ? m.text?.body
          : m.type === 'button' ? m.button?.text
          : m.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
          : undefined;
        work.push(handleInbound(c.env, { from: m.from, id: m.id, name: names[m.from], type: text ? 'text' : m.type, text }).catch((e) => console.error('wa inbound', e)));
      }
      for (const s of v.statuses ?? []) work.push(handleStatus(c.env, s).catch(() => null));
    }
  }
  // Acknowledge fast (Meta retries slow webhooks); finish the AI reply in the background.
  c.executionCtx.waitUntil(Promise.all(work));
  return c.text('ok');
});
