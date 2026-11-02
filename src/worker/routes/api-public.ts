import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { all, clamp, first, isEmail, newId, run } from '../lib/db';
import { complete, type ChatMessage } from '../lib/ai';
import { synthesize } from '../lib/tts';
import { initTransaction, validSignature, verifyTransaction } from '../lib/paystack';
import { LANGS, isLang } from '../content/i18n';
import { assistantSystemPrompt } from '../lib/assistant';
import { bobPrompt, guard, parseReply, type BobAction } from '../lib/bob';
import { onEnquiry, onPayment } from '../lib/wa-automations';
import { settleInvoiceFromPaystack } from '../lib/docs';

const api = new Hono<AppEnv>();

/** Simple fixed-window rate limit in KV: `limit` requests per `windowSec` per IP+bucket. */
async function limited(c: any, bucket: string, limit: number, windowSec: number) {
  const ip = c.req.header('cf-connecting-ip') ?? 'anon';
  const key = `rl:${bucket}:${ip}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = Number((await c.env.CACHE.get(key)) ?? 0) + 1;
  await c.env.CACHE.put(key, String(n), { expirationTtl: Math.max(60, windowSec) });
  return n > limit;
}

/* ── forms: contact, rfp, customise, newsletter, referral ── */
api.post('/forms/:type', async (c) => {
  const type = c.req.param('type');
  if (!['contact', 'rfp', 'customise', 'newsletter', 'referral', 'demo'].includes(type)) return c.json({ ok: false }, 404);
  if (await limited(c, 'forms', 10, 3600)) return c.json({ ok: false, error: 'Too many submissions — please email us.' }, 429);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, string>;
  if (b.website) return c.json({ ok: true }); // honeypot
  const email = clamp(b.email, 200);
  if (!isEmail(email)) return c.json({ ok: false, error: 'Please enter a valid email.' }, 422);
  if (type !== 'newsletter' && !clamp(b.name, 120)) return c.json({ ok: false, error: 'Please enter your name.' }, 422);
  let productId: string | null = null;
  if (b.product) productId = (await first<{ id: string }>(c.env.DB, 'SELECT id FROM products WHERE slug = ?', clamp(b.product, 80)))?.id ?? null;
  const id = newId('r_');
  await run(c.env.DB,
    `INSERT INTO requests (id, type, name, email, phone, company, product_id, message, budget, meta_json, lang)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, type, clamp(b.name, 120) || null, email, clamp(b.phone, 40) || null, clamp(b.company, 160) || null, productId,
    clamp(b.message, 4000) || null, clamp(b.budget, 80) || null, JSON.stringify({ need: clamp(b.need, 80), path: clamp(b.path, 200) }),
    isLang(b.lang) ? b.lang : 'en');
  // Website enquiries also become leads so they show up in the Studio pipeline.
  if (type !== 'newsletter') {
    const leadId = newId('L-');
    const topic = clamp(b.need, 80) || (b.product ? clamp(b.product, 80).replace(/-/g, ' ') : '') || 'your project';
    c.executionCtx.waitUntil(onEnquiry(c.env, { name: clamp(b.name, 120), phone: clamp(b.phone, 40), consent: b.wa_consent === 'on' || b.wa_consent === 'true', topic, leadId }).catch((e) => console.warn('wa enquiry', e)));
    await run(c.env.DB,
      `INSERT INTO leads (id, created, company, email, phone, contact_name, status, notes, source, origin, pitch)
       VALUES (?, date('now'), ?, ?, ?, ?, 'Replied', ?, 'Website form', 'website', ?)`,
      leadId, clamp(b.company, 160) || clamp(b.name, 120), email, clamp(b.phone, 40) || null, clamp(b.name, 120),
      clamp(b.message, 2000) || null, `${type} enquiry${b.need ? ' · ' + clamp(b.need, 80) : ''}${b.budget ? ' · ' + clamp(b.budget, 80) : ''}`);
  }
  return c.json({ ok: true });
});

/* ── Bob, the AI assistant ── */
api.post('/chat', async (c) => {
  if (await limited(c, 'chat', 40, 3600)) return c.json({ ok: false, message: 'You’ve sent a lot of messages — please email info@ferrnagency.com and we’ll pick it up.' }, 429);
  if (await limited(c, 'chat-day', 150, 86400)) return c.json({ ok: false, message: 'That’s the daily limit for the assistant — email info@ferrnagency.com and a person will reply.' }, 429);
  const b = (await c.req.json().catch(() => ({}))) as { message?: string; history?: { role: string; content: string }[]; lang?: string; path?: string; session?: string };
  const message = clamp(b.message, 1500);
  if (!message) return c.json({ ok: false, message: 'Write a message first.' }, 422);
  const lang = isLang(b.lang) ? b.lang : 'en';
  const langName = LANGS.find((l) => l.code === lang)!.label;
  const path = clamp(b.path, 200) || '/';
  const session = clamp(b.session, 60);
  const bobOff = (await first<{ value: string }>(c.env.DB, "SELECT value FROM settings WHERE key = 'bob.enabled'").catch(() => null))?.value === '0';
  if (bobOff) return c.json({ ok: false, message: 'The assistant is taking a break. Email info@ferrnagency.com and we’ll reply within a working day.' }, 503);

  const log = (answer: string, provider: string, action?: BobAction, sources: string[] = []) =>
    c.executionCtx.waitUntil(run(c.env.DB, 'INSERT INTO chat_logs (session, path, lang, question, answer, provider, action, sources) VALUES (?,?,?,?,?,?,?,?)',
      session, path, lang, message, answer.slice(0, 4000), provider, action ? JSON.stringify(action) : null, sources.length ? JSON.stringify(sources) : null)
      .catch(() => run(c.env.DB, 'INSERT INTO chat_logs (session, path, lang, question, answer, provider) VALUES (?,?,?,?,?,?)', session, path, lang, message, answer.slice(0, 4000), provider)));

  const g = guard(message);
  if (g.blocked) { log(g.reply!, 'guard:' + g.flag); return c.json({ ok: true, message: g.reply, sources: [] }); }

  // Quick intents that need no model.
  if (/^(read|read (this|the) page|read (it )?(to|for) me|listen|read aloud)\b/i.test(message)) {
    const reply = 'Sure — reading this page now. Use the controls to pause, restart or stop.';
    log(reply, 'intent'); return c.json({ ok: true, message: reply, action: { type: 'read' }, sources: [] });
  }

  let system = '', hits: any[] = [];
  try { const p = await bobPrompt(c.env, { langName, path, message }); system = p.system; hits = p.hits; }
  catch { system = await assistantSystemPrompt(c.env, { channel: 'web', langName }); }

  const history = (b.history ?? []).slice(-8).filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: clamp(m.content, 1500) }));
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: message }];

  let reply: { message: string; action?: BobAction; sources: string[] } = { message: '', sources: [] }, provider = 'none';
  try {
    const r = await complete(c.env, messages, { maxTokens: 450, json: hits.length > 0 || system.includes('Output strictly as JSON') });
    provider = r.provider;
    reply = await parseReply(c.env, r.text, hits);
    if (!reply.message) reply.message = 'I’m not sure about that one. Email info@ferrnagency.com or book a call at ' + (c.env.BOOKING_URL || 'https://cal.com/ferrn-agency') + ' and the team will help.';
  } catch {
    reply.message = 'I can’t answer right now — please email info@ferrnagency.com or book a call at https://cal.com/ferrn-agency.';
  }

  // Capture contact details shared in chat as a lead.
  const email = message.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/)?.[0];
  const phone = message.match(/(\+?\d[\d\s-]{9,}\d)/)?.[0];
  if (email || phone) {
    await run(c.env.DB, `INSERT INTO requests (id, type, email, phone, message, meta_json, lang) VALUES (?, 'chat_lead', ?, ?, ?, ?, ?)`,
      newId('r_'), email ?? '', phone ?? null, message, JSON.stringify({ path, session }), lang);
  }
  log(reply.message, provider, reply.action, reply.sources);
  return c.json({ ok: true, message: reply.message, action: reply.action ?? null, sources: reply.sources, booking_url: c.env.BOOKING_URL });
});

/** Thumbs up/down on an answer (by session + question), for the Studio Bob analytics. */
api.post('/chat/rate', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { session?: string; question?: string; rating?: number };
  const rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : 0;
  if (!rating || !b.session) return c.json({ ok: false }, 422);
  await run(c.env.DB, 'UPDATE chat_logs SET rating = ? WHERE id = (SELECT id FROM chat_logs WHERE session = ? AND question = ? ORDER BY id DESC LIMIT 1)', rating, clamp(b.session, 60), clamp(b.question, 1500)).catch(() => {});
  return c.json({ ok: true });
});

/* ── Nigerian voice ── */
api.post('/tts', async (c) => {
  if (await limited(c, 'tts', 60, 3600)) return c.json({ ok: false }, 429);
  const b = (await c.req.json().catch(() => ({}))) as { text?: string; lang?: string };
  const res = await synthesize(c.env, clamp(b.text, 1200), isLang(b.lang) ? b.lang : 'en');
  if (!res) return c.json({ ok: false, fallback: 'browser' }, 503);
  return res;
});

api.get('/public/config', (c) => c.json({
  tts: c.env.AZURE_SPEECH_KEY || c.env.ELEVENLABS_API_KEY ? 'server' : 'browser',
  payments: !!c.env.PAYSTACK_SECRET_KEY,
  booking_url: c.env.BOOKING_URL,
}));

/* ── checkout ── */
api.post('/checkout', async (c) => {
  if (await limited(c, 'checkout', 10, 3600)) return c.json({ ok: false, error: 'Too many attempts.' }, 429);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, string>;
  const p = await first<any>(c.env.DB, 'SELECT * FROM products WHERE slug = ? AND published = 1', clamp(b.product, 80));
  if (!p) return c.json({ ok: false, error: 'Product not found.' }, 404);
  const tier = ['launch', 'managed', 'buyout'].includes(b.tier) ? b.tier : 'managed';
  const currency = b.currency === 'USD' ? 'USD' : 'NGN';
  const email = clamp(b.email, 200);
  if (!isEmail(email) || !clamp(b.name, 120)) return c.json({ ok: false, error: 'Name and a valid email are required.' }, 422);
  // First payment: launch = setup; managed = setup + first month; buyout = buyout price.
  const base = currency === 'NGN'
    ? (tier === 'buyout' ? p.buyout_ngn : tier === 'launch' ? p.price_ngn_setup : p.price_ngn_setup + p.price_ngn_monthly)
    : (tier === 'buyout' ? p.buyout_usd : tier === 'launch' ? p.price_usd_setup : p.price_usd_setup + p.price_usd_monthly);
  if (!base) return c.json({ ok: false, error: 'This plan is not available for that product.' }, 422);
  const id = newId('o_');
  await run(c.env.DB,
    `INSERT INTO orders (id, product_id, tier, customer_name, email, phone, company, currency, amount, status, provider_ref, notes)
     VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?)`,
    id, p.id, tier, clamp(b.name, 120), email, clamp(b.phone, 40) || null, clamp(b.company, 160) || null, currency, base * 100, id,
    b.mode === 'invoice' ? 'Invoice requested' : null);
  if (b.mode === 'invoice' || !c.env.PAYSTACK_SECRET_KEY) {
    await run(c.env.DB, `INSERT INTO requests (id, type, name, email, phone, company, product_id, message, meta_json) VALUES (?, 'customise', ?, ?, ?, ?, ?, ?, ?)`,
      newId('r_'), clamp(b.name, 120), email, clamp(b.phone, 40) || null, clamp(b.company, 160) || null, p.id,
      `Invoice requested: ${p.name} — ${tier} (${currency} ${base.toLocaleString()})`, JSON.stringify({ order: id }));
    return c.json({ ok: true, invoice: true, message: 'Thanks — we’ll email your invoice within one working day.' });
  }
  const origin = new URL(c.req.url).origin;
  const tx = await initTransaction(c.env, {
    email, amount: base * 100, currency, reference: id,
    callback_url: `${origin}/api/checkout/callback?product=${encodeURIComponent(p.slug)}`,
    metadata: { order_id: id, product: p.slug, tier },
  });
  return c.json({ ok: true, url: tx.authorization_url });
});

api.get('/checkout/callback', async (c) => {
  const ref = c.req.query('reference') ?? c.req.query('trxref') ?? '';
  const product = c.req.query('product') ?? '';
  const v = ref ? await verifyTransaction(c.env, ref) : undefined;
  const paid = v?.status === 'success';
  if (paid) {
    const r = await c.env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE provider_ref = ? AND status != 'paid'").bind(ref).run();
    if (r.meta.changes) c.executionCtx.waitUntil(notifyPaid(c.env, ref));
  }
  return c.redirect(`/marketplace/thank-you?status=${paid ? 'paid' : 'failed'}&product=${encodeURIComponent(product)}`);
});

api.post('/paystack/webhook', async (c) => {
  const raw = await c.req.text();
  if (!(await validSignature(c.env, raw, c.req.header('x-paystack-signature')))) return c.json({ ok: false }, 401);
  const evt = JSON.parse(raw);
  if (evt.event === 'charge.success' && String(evt.data?.reference ?? '').startsWith('INV-')) {
    await settleInvoiceFromPaystack(c.env, evt.data.reference, evt.data); // proposal invoices
  } else if (evt.event === 'charge.success') {
    const r = await c.env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE provider_ref = ? AND status != 'paid'").bind(evt.data?.reference).run();
    if (r.meta.changes) c.executionCtx.waitUntil(notifyPaid(c.env, evt.data?.reference));
  }
  return c.json({ ok: true });
});

/** WhatsApp thank-you once an order is paid (only the first time it flips to paid). */
async function notifyPaid(env: AppEnv['Bindings'], ref: string) {
  const o = await first<{ customer_name: string; phone: string | null; tier: string; name: string | null }>(env.DB,
    'SELECT o.customer_name, o.phone, o.tier, p.name FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.provider_ref = ?', ref);
  if (o) await onPayment(env, { name: o.customer_name, phone: o.phone, product: `${o.name ?? 'your order'} (${o.tier} plan)` }).catch(() => null);
}

/* ── quote acceptance from the shared link ── */
api.post('/quotes/:key/accept', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string };
  const q = await first<any>(c.env.DB, 'SELECT id, status, number FROM quotes WHERE share_key = ?', c.req.param('key'));
  if (!q || !['sent', 'draft'].includes(q.status)) return c.json({ ok: false }, 404);
  await run(c.env.DB, "UPDATE quotes SET status = 'accepted', updated_at = datetime('now'), updated_by = ? WHERE id = ?", `Client: ${clamp(b.name, 80)}`, q.id);
  await run(c.env.DB, `INSERT INTO audit_log (user_name, entity, entity_id, action, summary) VALUES (?, 'quotes', ?, 'accept', ?)`,
    `Client: ${clamp(b.name, 80)}`, q.id, `Quote ${q.number} accepted online by ${clamp(b.name, 80)}`);
  return c.json({ ok: true });
});

export default api;
