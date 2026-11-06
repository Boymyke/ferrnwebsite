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
import { brandEmail, sendEmail } from '../lib/email';

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
  const b = (await c.req.json().catch(() => ({}))) as { message?: string; history?: { role: string; content: string }[]; lang?: string; path?: string; session?: string; visitor?: string; voice?: boolean };
  const message = clamp(b.message, 1500);
  if (!message) return c.json({ ok: false, message: 'Write a message first.' }, 422);
  const lang = isLang(b.lang) ? b.lang : 'en';
  const langName = LANGS.find((l) => l.code === lang)!.label;
  const path = clamp(b.path, 200) || '/';
  const session = clamp(b.session, 60);
  const bobSet = Object.fromEntries((await all<{ key: string; value: string }>(c.env.DB, "SELECT key, value FROM settings WHERE key IN ('bob.enabled','bob.model','bob.daily_limit')").catch(() => [])).map((r) => [r.key, r.value]));
  if (bobSet['bob.enabled'] === '0') return c.json({ ok: false, message: 'The assistant is taking a break. Email info@ferrnagency.com and we’ll reply within a working day.' }, 503);
  const model = bobSet['bob.model'] || '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
  // Site-wide daily ceiling so Bob can never run up a bill (counts model answers only).
  const dayKey = `bob:answers:${new Date().toISOString().slice(0, 10)}`;
  const answersToday = Number((await c.env.CACHE.get(dayKey)) ?? 0);
  const dailyLimit = Math.max(1, Number(bobSet['bob.daily_limit'] ?? 300) || 300);

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

  if (answersToday >= dailyLimit) {
    const reply = 'I’ve answered a lot of questions today and I’m resting until tomorrow. Email info@ferrnagency.com or book a call at ' + (c.env.BOOKING_URL || 'https://cal.com/ferrn-agency') + ' and a person will help.';
    log(reply, 'limit'); return c.json({ ok: true, message: reply, sources: [] });
  }
  await c.env.CACHE.put(dayKey, String(answersToday + 1), { expirationTtl: 60 * 60 * 26 });
  let system = '', hits: any[] = [];
  try { const p = await bobPrompt(c.env, { langName, path, message }); system = p.system; hits = p.hits; }
  catch { system = await assistantSystemPrompt(c.env, { channel: 'web', langName }); }

  // The visitor told Bob their first name (validated client-side; re-checked here) — and voice answers stay short.
  const visitor = /^[\p{L}'’-]{2,12}$/u.test(String(b.visitor || '')) ? String(b.visitor) : '';
  if (visitor) system += `\n\nThe visitor's first name is ${visitor}. Use it naturally now and then — not in every message.`;
  if (b.voice) system += '\n\nThis answer will be spoken aloud in a live conversation: keep it to two or three short sentences, no lists, no links.';
  const history = (b.history ?? []).slice(-8).filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: clamp(m.content, 1500) }));
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: message }];

  let reply: { message: string; action?: BobAction; sources: string[] } = { message: '', sources: [] }, provider = 'none';
  try {
    const r = await complete(c.env, messages, { maxTokens: 450, json: hits.length > 0 || system.includes('Output strictly as JSON'), model, bucket: 'bob' });
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
  if (await limited(c, 'chat-rate', 60, 3600)) return c.json({ ok: false }, 429);
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

/** Where the visitor is, from Cloudflare's request metadata — used by the nav clock. Never cached. */
api.get('/geo', (c) => {
  const cf = ((c.req.raw as any).cf ?? {}) as Record<string, string | undefined>;
  return c.json({ country: cf.country ?? null, city: cf.city ?? null, region: cf.region ?? null, tz: cf.timezone ?? null }, 200, { 'cache-control': 'private, no-store' });
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
  const invoiceRequest = async (why: string) => {
    await run(c.env.DB, `INSERT INTO requests (id, type, name, email, phone, company, product_id, message, meta_json) VALUES (?, 'customise', ?, ?, ?, ?, ?, ?, ?)`,
      newId('r_'), clamp(b.name, 120), email, clamp(b.phone, 40) || null, clamp(b.company, 160) || null, p.id,
      `${why}: ${p.name} — ${tier} (${currency} ${base.toLocaleString()})`, JSON.stringify({ order: id }));
  };
  if (b.mode === 'invoice' || !c.env.PAYSTACK_SECRET_KEY) {
    await invoiceRequest('Invoice requested');
    c.executionCtx.waitUntil(notifyOrder(c.env, id, 'invoice').catch(() => null));
    return c.json({ ok: true, invoice: true, message: 'Thanks. We’ll email your invoice within one working day.' });
  }
  const origin = new URL(c.req.url).origin;
  try {
    const tx = await initTransaction(c.env, {
      email, amount: base * 100, currency, reference: id,
      callback_url: `${origin}/api/checkout/callback?product=${encodeURIComponent(p.slug)}`,
      metadata: { order_id: id, product: p.slug, tier },
    });
    return c.json({ ok: true, url: tx.authorization_url });
  } catch (e) {
    // Paystack said no (e.g. a currency the account can't take yet). Keep the order and send an invoice instead.
    const why = String((e as Error).message || e).slice(0, 300);
    console.warn('paystack init', id, currency, why);
    await run(c.env.DB, "UPDATE orders SET notes = ? WHERE id = ?", `Online payment failed to start (${currency}): ${why}. Invoice to follow.`, id);
    await invoiceRequest(`Online payment failed (${why}); invoice needed`);
    c.executionCtx.waitUntil(notifyOrder(c.env, id, 'invoice').catch(() => null));
    return c.json({ ok: true, invoice: true, fallback: true, message: currency === 'USD'
      ? 'Card payment in dollars isn’t available right now, so we’ve saved your order and will email an invoice within one working day. You can also pay in naira.'
      : 'Online payment couldn’t start just now, so we’ve saved your order and will email an invoice within one working day.' });
  }
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
/** Tells Ferrn a new order came in (Studio shows it too, under Marketplace › Orders). */
async function notifyOrder(env: AppEnv['Bindings'], id: string, kind: 'invoice' | 'paid') {
  if (!env.CONTACT_EMAIL) return;
  const o = await first<any>(env.DB, 'SELECT o.*, p.name AS product FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id = ?', id);
  if (!o) return;
  const site = (env.SITE_URL || 'https://www.ferrnagency.com').replace(/\/$/, '');
  const amount = `${o.currency === 'USD' ? '$' : '₦'}${(o.amount / 100).toLocaleString()}`;
  await sendEmail(env, { to: env.CONTACT_EMAIL, track: false, subject: `${kind === 'paid' ? 'Paid' : 'New'} order: ${o.product ?? 'Marketplace'} — ${o.customer_name}`,
    html: brandEmail(env, { heading: kind === 'paid' ? 'An order was paid' : 'A new order needs an invoice',
      paragraphs: [o.notes || (kind === 'paid' ? 'Payment received through Paystack.' : 'The client asked for an invoice.'), 'Open the order in Studio to send a welcome email and book a kickoff call.'],
      rows: [['Product', `${o.product ?? ''} (${o.tier})`], ['Client', o.customer_name], ['Company', o.company || '—'], ['Email', o.email], ['Phone', o.phone || '—'], ['Amount', amount]],
      button: { label: 'Open the order', url: `${site}/studio/marketplace/orders?id=${o.id}` } }) });
}

async function notifyPaid(env: AppEnv['Bindings'], ref: string) {
  const row = await first<{ id: string }>(env.DB, 'SELECT id FROM orders WHERE provider_ref = ?', ref);
  if (row) await notifyOrder(env, row.id, 'paid').catch(() => null);
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
