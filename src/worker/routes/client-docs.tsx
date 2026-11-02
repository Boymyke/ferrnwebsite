/** Client-facing proposal (/p/:token) and invoice (/i/:token) pages.
 *  Each document sits behind a 6-digit code; a correct code sets an HttpOnly, HMAC-signed
 *  cookie scoped to that one document's path. Nothing about the document is shown before that. */
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../lib/env';
import { all, clamp, first, newId, run } from '../lib/db';
import { initTransaction, verifyTransaction } from '../lib/paystack';
import { brandEmail, emailConfigured, sendEmail } from '../lib/email';
import {
  ACCESS_COOKIE, PAYSTACK_CURRENCIES, addEvent, clientAudit, createInvoiceFromProposal, fmtDate, fmtMoney, hashCode, ipHash, isExpired,
  methodCurrencies, methodsFor, notifyFerrn, paystackRef, proposalContentHash, settleInvoiceFromPaystack, signAccess, verifyAccess,
  invoiceIdFromRef, type ProposalRow,
} from '../lib/docs';
import { ClosedPage, GatePage, InvoiceView, ProposalView } from '../views/client-docs';

type C = Context<AppEnv>;
type Kind = 'proposal' | 'invoice';
const TABLE: Record<Kind, 'proposals' | 'invoices'> = { proposal: 'proposals', invoice: 'invoices' };
const PREFIX: Record<Kind, string> = { proposal: '/p/', invoice: '/i/' };

const docs = new Hono<AppEnv>();

/* Every response under /p and /i is private: never indexed, never cached, no Referer to other sites (the token is in the URL). */
const privateHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  c.res.headers.set('Cache-Control', 'private, no-store');
  c.res.headers.set('Referrer-Policy', 'same-origin');
};
docs.use('/p/*', privateHeaders);
docs.use('/i/*', privateHeaders);

const validToken = (t: string) => /^[A-Za-z0-9_-]{20,64}$/.test(t);
const ip = (c: C) => c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

async function load(c: C, kind: Kind): Promise<Record<string, any> | null> {
  const token = c.req.param('token') ?? '';
  if (!validToken(token)) return null;
  return first<Record<string, any>>(c.env.DB, `SELECT * FROM ${TABLE[kind]} WHERE token = ?`, token);
}
const hasAccess = (c: C, row: Record<string, any>) => verifyAccess(row.gate_secret, row.id, getCookie(c, ACCESS_COOKIE));
async function grant(c: C, kind: Kind, row: Record<string, any>) {
  const a = await signAccess(row.gate_secret, row.id);
  setCookie(c, ACCESS_COOKIE, a.value, { path: PREFIX[kind] + row.token, httpOnly: true, secure: true, sameSite: 'Lax', expires: a.expires });
}

/** 8 attempts per 15 minutes per document token + IP (fixed window in KV). */
async function limited(c: C, bucket: string, token: string, limit: number, windowSec: number) {
  const key = `rl:${bucket}:${token}:${ip(c)}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = Number((await c.env.CACHE.get(key)) ?? 0);
  if (n >= limit) return true;
  await c.env.CACHE.put(key, String(n + 1), { expirationTtl: Math.max(60, windowSec) });
  return false;
}
const sameOrigin = (c: C) => {
  const o = c.req.header('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(c.req.url).host; } catch { return false; }
};
const wantsJson = (c: C) => (c.req.header('accept') ?? '').includes('application/json');
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

const closed = (c: C, row: Record<string, any> | null) =>
  row?.revoked
    ? c.html(<ClosedPage title="This link has been switched off" message="Ferrn has turned off access to this document. If you still need it, ask us for a new link." />, 410)
    : row && !row.code_hash
      ? c.html(<ClosedPage title="Not ready yet" message="This document hasn’t been shared yet. Please use the link and code from our message." />, 404)
      : c.html(<ClosedPage title="Link not found" message="This link isn’t valid. Check that you copied the whole address from our message." />, 404);

/* ── gate (shared) ── */
for (const kind of ['proposal', 'invoice'] as Kind[]) {
  const base = kind === 'proposal' ? '/p/:token' : '/i/:token';
  docs.post(`${base}/unlock`, async (c) => {
    const row = await load(c, kind);
    if (!row || row.revoked || !row.code_hash) return closed(c, row);
    const action = `${PREFIX[kind]}${row.token}/unlock`;
    if (!sameOrigin(c)) return c.html(<GatePage kind={kind} action={action} error="Please open the link directly and try again." />, 403);
    if (await limited(c, 'gate', row.token, 8, 900)) {
      return c.html(<GatePage kind={kind} action={action} locked error="Too many attempts. For your security, try again in 15 minutes." />, 429);
    }
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    const code = String(form.code ?? '').replace(/\D/g, '');
    if (code.length !== 6 || !safeEq(await hashCode(code), row.code_hash)) {
      return c.html(<GatePage kind={kind} action={action} error="That code didn’t work. Check the message we sent and try again." />, 401);
    }
    await grant(c, kind, row);
    return c.redirect(PREFIX[kind] + row.token, 303);
  });
}

/* ── proposal ── */
docs.get('/p/:token', async (c) => {
  const p = await load(c, 'proposal') as ProposalRow | null;
  if (!p || p.revoked || !p.code_hash) return closed(c, p);
  if (!(await hasAccess(c, p))) return c.html(<GatePage kind="proposal" action={`/p/${p.token}/unlock`} />);

  if (isExpired(p) && ['sent', 'viewed'].includes(p.status)) {
    await run(c.env.DB, "UPDATE proposals SET status = 'expired', updated_at = datetime('now') WHERE id = ?", p.id);
    await addEvent(c.env.DB, p.id, 'expired', 'System', 'Validity date passed');
    p.status = 'expired';
  }
  if (!c.get('user')) {
    await run(c.env.DB, `UPDATE proposals SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, datetime('now')),
      last_viewed_at = datetime('now'), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END WHERE id = ?`, p.id);
    if (p.status === 'sent') {
      await addEvent(c.env.DB, p.id, 'viewed', `Client: ${p.client_name || p.client_company || 'client'}`, 'Opened the proposal for the first time');
      await clientAudit(c.env.DB, `Client: ${p.client_name || 'client'}`, 'proposals', p.id, 'view', `Proposal ${p.number} opened by the client`);
      p.status = 'viewed';
    }
  }
  const invs = await all<Record<string, any>>(c.env.DB, "SELECT * FROM invoices WHERE proposal_id = ? AND status != 'void' AND revoked = 0 ORDER BY created_at", p.id);
  // Same code opens the invoices that came from this proposal, so "View invoice" works without asking again.
  for (const i of invs) if (i.code_hash === p.code_hash) await grant(c, 'invoice', i);
  return c.html(<ProposalView p={p} contentHash={await proposalContentHash(p)}
    signatureUrl={p.signature_key ? `/p/${p.token}/signature.png` : null}
    invoices={invs.map((i) => ({ number: i.number, url: `/i/${i.token}`, status: i.status, amount: fmtMoney(i.amount_due, i.currency) }))} />);
});

docs.get('/p/:token/signature.png', async (c) => {
  const p = await load(c, 'proposal');
  if (!p || p.revoked || !p.signature_key || !(await hasAccess(c, p))) return c.text('Not found', 404);
  const obj = await c.env.MEDIA.get(p.signature_key);
  if (!obj) return c.text('Not found', 404);
  return new Response(obj.body, { headers: { 'content-type': 'image/png' } });
});

docs.post('/p/:token/sign', async (c) => {
  const p = await load(c, 'proposal') as ProposalRow | null;
  if (!p || p.revoked || !p.code_hash || !sameOrigin(c) || !(await hasAccess(c, p))) return c.json({ ok: false, error: 'Your session has ended. Reload the page and enter your code again.' }, 403);
  if (await limited(c, 'sign', p.token, 10, 900)) return c.json({ ok: false, error: 'Too many attempts. Please wait a few minutes.' }, 429);
  if (!['draft', 'sent', 'viewed'].includes(p.status) || isExpired(p)) return c.json({ ok: false, error: 'This proposal can no longer be signed. Please contact us.' }, 409);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = clamp(b.name, 120), title = clamp(b.title, 120);
  if (name.length < 2) return c.json({ ok: false, error: 'Please enter your full name.' }, 422);
  if (b.agree !== true) return c.json({ ok: false, error: 'Please confirm you agree to the terms.' }, 422);
  const hash = await proposalContentHash(p);
  if (b.content_hash !== hash) return c.json({ ok: false, error: 'This proposal was updated while you had it open. Reload the page to see the latest version, then sign.' }, 409);
  const m = String(b.signature ?? '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[1].length > 900_000) return c.json({ ok: false, error: 'Please add your signature.' }, 422);
  const png = Uint8Array.from(atob(m[1]), (ch) => ch.charCodeAt(0));
  if (png.length < 100 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return c.json({ ok: false, error: 'Please add your signature.' }, 422);

  const sigKey = `private/signatures/${p.id}/${Date.now()}.png`;
  await c.env.MEDIA.put(sigKey, png, { httpMetadata: { contentType: 'image/png' }, customMetadata: { proposal: p.number, signer: name } });
  const ua = clamp(c.req.header('user-agent'), 300);
  const r = await run(c.env.DB,
    `UPDATE proposals SET status = 'signed', signed_at = datetime('now'), signer_name = ?, signer_title = ?, signature_key = ?, signature_mode = ?,
       signer_ip_hash = ?, signer_ua = ?, content_hash = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ? AND status IN ('draft','sent','viewed')`,
    name, title || null, sigKey, b.mode === 'type' ? 'type' : 'draw', await ipHash(ip(c)), ua, hash, `Client: ${name}`, p.id);
  if (!r.meta.changes) return c.json({ ok: false, error: 'This proposal has already been signed.' }, 409);

  const who = `Client: ${name}`;
  await addEvent(c.env.DB, p.id, 'signed', who, `Signed${title ? ` as ${title}` : ''} (${b.mode === 'type' ? 'typed' : 'drawn'} signature)`);
  await clientAudit(c.env.DB, who, 'proposals', p.id, 'sign', `Proposal ${p.number} signed by ${name}${title ? `, ${title}` : ''}`);
  const signed = (await first<ProposalRow>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', p.id))!;
  const inv = await createInvoiceFromProposal(c.env, signed, p.invoice_on_sign === 'full' ? 'full' : 'deposit', 'System');
  await grant(c, 'invoice', inv);
  if (p.lead_id) await run(c.env.DB, "UPDATE leads SET status = 'Won', next_action = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?",
    `Proposal ${p.number} signed — invoice ${inv.number} issued`, who, p.lead_id).catch(() => null);

  const origin = new URL(c.req.url).origin;
  c.executionCtx.waitUntil((async () => {
    await notifyFerrn(c.env, `${p.client_company || name} signed ${p.number}`, [
      `${name}${title ? ` (${title})` : ''} signed “${p.title}”.`, `Invoice ${inv.number} for ${fmtMoney(inv.amount_due, inv.currency)} was issued automatically.`,
    ], { label: 'Open in Studio', path: `/studio/proposals/${p.id}` });
    if (emailConfigured(c.env) && p.client_email) {
      await sendEmail(c.env, {
        to: p.client_email, subject: `Thank you — ${p.number} is signed`,
        track: { kind: 'signed', proposalId: p.id, invoiceId: inv.id, company: p.client_company },
        html: brandEmail(c.env, {
          heading: 'Thank you for signing', preheader: `Your invoice ${inv.number} is ready.`,
          paragraphs: [`Hi ${name.split(' ')[0]}, thank you for signing “${p.title}”. Your invoice is ready below. It opens with the same access code as your proposal.`],
          rows: [['Invoice', inv.number], ['Amount due', fmtMoney(inv.amount_due, inv.currency)], ['Due', fmtDate(inv.due_date)]],
          button: { label: 'View invoice', url: `${origin}/i/${inv.token}` },
        }),
      });
    }
  })().catch((e) => console.warn('sign notify', e)));
  return c.json({ ok: true, invoice_url: `/i/${inv.token}` });
});

docs.post('/p/:token/respond', async (c) => {
  const p = await load(c, 'proposal') as ProposalRow | null;
  if (!p || p.revoked || !p.code_hash || !sameOrigin(c) || !(await hasAccess(c, p))) return c.json({ ok: false, error: 'Your session has ended. Reload the page.' }, 403);
  if (await limited(c, 'respond', p.token, 6, 3600)) return c.json({ ok: false, error: 'Please wait a little before sending another message.' }, 429);
  if (!['draft', 'sent', 'viewed', 'expired'].includes(p.status)) return c.json({ ok: false, error: 'This proposal is closed.' }, 409);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const message = clamp(b.message, 3000);
  if (message.length < 3) return c.json({ ok: false, error: 'Please add a short message.' }, 422);
  const decline = b.kind === 'decline';
  const who = `Client: ${p.client_name || p.client_company || 'client'}`;
  if (decline) {
    await run(c.env.DB, "UPDATE proposals SET status = 'declined', declined_at = datetime('now'), decline_message = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", message, who, p.id);
  }
  await addEvent(c.env.DB, p.id, decline ? 'declined' : 'changes', who, message);
  await clientAudit(c.env.DB, who, 'proposals', p.id, decline ? 'decline' : 'changes', `${decline ? 'Declined' : 'Changes requested on'} ${p.number}: ${message.slice(0, 200)}`);
  c.executionCtx.waitUntil(notifyFerrn(c.env, `${p.client_company || p.client_name || 'Client'} ${decline ? 'declined' : 'asked for changes to'} ${p.number}`,
    [message], { label: 'Open in Studio', path: `/studio/proposals/${p.id}` }).catch(() => null));
  return c.json({ ok: true });
});

/* ── invoice ── */
async function paystackOn(c: C, currency: string) {
  if (!c.env.PAYSTACK_SECRET_KEY || !PAYSTACK_CURRENCIES.includes(currency as any)) return false;
  const rows = await all<{ enabled: number; currencies: string }>(c.env.DB, "SELECT enabled, currencies FROM payment_methods WHERE type = 'paystack'");
  return !rows.length || rows.some((m) => m.enabled && methodCurrencies(m).includes(currency));
}

docs.get('/i/:token', async (c) => {
  const inv = await load(c, 'invoice');
  if (!inv || inv.revoked || !inv.code_hash) return closed(c, inv);
  if (!(await hasAccess(c, inv))) return c.html(<GatePage kind="invoice" action={`/i/${inv.token}/unlock`} />);
  if (!c.get('user')) {
    await run(c.env.DB, `UPDATE invoices SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, datetime('now')), last_viewed_at = datetime('now') WHERE id = ?`, inv.id);
  }
  const [methods, receipts, paystack, prop] = await Promise.all([
    methodsFor(c.env.DB, inv.currency),
    all<{ filename: string; created_at: string }>(c.env.DB, 'SELECT filename, created_at FROM payment_receipts WHERE invoice_id = ? ORDER BY created_at', inv.id),
    paystackOn(c, inv.currency),
    inv.proposal_id ? first<{ token: string; revoked: number }>(c.env.DB, 'SELECT token, revoked FROM proposals WHERE id = ?', inv.proposal_id) : null,
  ]);
  const q = c.req.query();
  const flash = q.uploaded ? { kind: 'ok' as const, text: 'Receipt received — thank you. We’ll confirm your payment within one working day.' }
    : q.paid ? { kind: 'ok' as const, text: 'Payment received — thank you! A confirmation is on its way.' }
      : q.payment ? { kind: 'err' as const, text: 'That payment didn’t go through. You can try again, or pay by bank transfer below.' } : undefined;
  return c.html(<InvoiceView inv={inv} methods={methods} paystack={paystack} receipts={receipts} flash={flash}
    proposalUrl={prop && !prop.revoked ? `/p/${prop.token}` : null} />);
});

docs.post('/i/:token/pay', async (c) => {
  const inv = await load(c, 'invoice');
  if (!inv || inv.revoked || !inv.code_hash || !sameOrigin(c) || !(await hasAccess(c, inv))) return closed(c, inv);
  const back = `/i/${inv.token}`;
  if (['paid', 'void'].includes(inv.status) || !(await paystackOn(c, inv.currency))) return c.redirect(back, 303);
  const remaining = Math.round((Number(inv.amount_due) - Number(inv.amount_paid)) * 100);
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
  const email = clamp(form.email, 200) || inv.client_email;
  if (remaining <= 0 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return c.redirect(`${back}?payment=failed`, 303);
  try {
    const tx = await initTransaction(c.env, {
      email, amount: remaining, currency: inv.currency, reference: paystackRef(inv.id),
      callback_url: `${new URL(c.req.url).origin}/i/${inv.token}/paystack`, metadata: { invoice_id: inv.id, invoice_number: inv.number },
    });
    return c.redirect(tx.authorization_url, 303);
  } catch (e) {
    console.warn('paystack init', e);
    return c.redirect(`${back}?payment=failed`, 303);
  }
});

docs.get('/i/:token/paystack', async (c) => {
  const inv = await load(c, 'invoice');
  if (!inv) return closed(c, inv);
  const ref = c.req.query('reference') ?? c.req.query('trxref') ?? '';
  if (invoiceIdFromRef(ref) !== inv.id) return c.redirect(`/i/${inv.token}?payment=failed`, 303);
  const tx = await verifyTransaction(c.env, ref).catch(() => undefined);
  const r = await settleInvoiceFromPaystack(c.env, ref, tx);
  return c.redirect(`/i/${inv.token}?${r.ok ? 'paid=1' : 'payment=failed'}`, 303);
});

/** Receipt types we accept, checked by the file's first bytes rather than its name. */
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  const s = (o: number, str: string) => [...str].every((ch, i) => b[o + i] === ch.charCodeAt(0));
  if (b[0] === 0x89 && s(1, 'PNG')) return { type: 'image/png', ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (s(0, 'RIFF') && s(8, 'WEBP')) return { type: 'image/webp', ext: 'webp' };
  if (s(0, '%PDF')) return { type: 'application/pdf', ext: 'pdf' };
  if (s(4, 'ftyp') && (s(8, 'heic') || s(8, 'heix') || s(8, 'mif1') || s(8, 'heif'))) return { type: 'image/heic', ext: 'heic' };
  return null;
}

docs.post('/i/:token/receipts', async (c) => {
  const inv = await load(c, 'invoice');
  const fail = (error: string, status: 400 | 403 | 409 | 413 | 415 | 422 | 429) =>
    wantsJson(c) ? c.json({ ok: false, error }, status) : c.redirect(`/i/${inv?.token}?upload=failed`, 303);
  if (!inv || inv.revoked || !inv.code_hash || !sameOrigin(c) || !(await hasAccess(c, inv))) return fail('Your session has ended. Reload the page and enter your code again.', 403);
  if (['paid', 'void'].includes(inv.status)) return fail('This invoice is already settled.', 409);
  if (await limited(c, 'receipt', inv.token, 10, 3600)) return fail('Too many uploads. Please try again later or email us the receipt.', 429);
  const form = await c.req.parseBody({ all: true }).catch(() => ({} as Record<string, unknown>));
  const raw = form.files ?? form.file;
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail('Choose at least one file.', 422);
  if (files.length > 5) return fail('Upload up to 5 files at a time.', 422);
  const existing = await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM payment_receipts WHERE invoice_id = ?', inv.id);
  if ((existing?.n ?? 0) + files.length > 30) return fail('This invoice already has a lot of receipts. Please email any others to us.', 422);
  const checked: { f: File; bytes: Uint8Array; kind: { type: string; ext: string } }[] = [];
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) return fail(`${f.name} is larger than 10 MB.`, 413);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniff(bytes.subarray(0, 16));
    if (!kind) return fail(`${f.name} isn’t an image or PDF.`, 415);
    checked.push({ f, bytes, kind });
  }
  const note = clamp(Array.isArray(form.note) ? form.note[0] : form.note, 1000) || null;
  const iph = await ipHash(ip(c));
  for (const { f, bytes, kind } of checked) {
    const id = newId('rc_');
    const key = `private/receipts/${inv.id}/${id}.${kind.ext}`;
    await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type }, customMetadata: { invoice: inv.number, name: f.name.slice(0, 120) } });
    await run(c.env.DB, 'INSERT INTO payment_receipts (id, invoice_id, r2_key, filename, content_type, size, note, ip_hash, updated_by) VALUES (?,?,?,?,?,?,?,?,?)',
      id, inv.id, key, clamp(f.name, 160).replace(/[\\/]/g, '_') || `receipt.${kind.ext}`, kind.type, f.size, note, iph, 'Client');
  }
  await run(c.env.DB, "UPDATE invoices SET status = 'receipt_submitted', updated_by = 'Client', updated_at = datetime('now') WHERE id = ? AND status IN ('unpaid','part_paid')", inv.id);
  const who = `Client: ${inv.client_name || inv.client_company || 'client'}`;
  await addEvent(c.env.DB, inv.proposal_id, 'receipt', who, `${checked.length} receipt${checked.length > 1 ? 's' : ''} uploaded for ${inv.number}${note ? ` — “${note}”` : ''}`, inv.id);
  await clientAudit(c.env.DB, who, 'invoices', inv.id, 'receipt', `Payment receipt uploaded for ${inv.number} (${checked.length} file${checked.length > 1 ? 's' : ''})`);
  c.executionCtx.waitUntil(notifyFerrn(c.env, `Receipt uploaded for ${inv.number}`, [
    `${inv.client_company || inv.client_name || 'The client'} uploaded ${checked.length} payment receipt${checked.length > 1 ? 's' : ''}. Please check the account and mark the invoice paid.`, ...(note ? [`Note: ${note}`] : []),
  ], { label: 'Review in Studio', path: '/studio/proposals?tab=invoices' }, [['Amount due', fmtMoney(Number(inv.amount_due) - Number(inv.amount_paid), inv.currency)]]).catch(() => null));
  return wantsJson(c) ? c.json({ ok: true, count: checked.length }) : c.redirect(`/i/${inv.token}?uploaded=1`, 303);
});

export default docs;
