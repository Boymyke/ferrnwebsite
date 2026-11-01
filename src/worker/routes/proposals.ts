/** Studio API for proposals, invoices and payment methods. Mounted at /api/studio/proposals. */
import { Hono, type Context } from 'hono';
import type { AppEnv, SessionUser } from '../lib/env';
import { all, clamp, first, isEmail, newId, parseJson, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit, diff } from '../lib/audit';
import { complete, extractJson } from '../lib/ai';
import { brandEmail, emailConfigured, sendEmail } from '../lib/email';
import {
  CURRENCIES, DEFAULT_SECTIONS, addDays, addEvent, computeTotals, createInvoiceFromProposal, expireStale, fmtDate, fmtMoney, genCode, hashCode,
  newDocToken, newGateSecret, nextNumber, normCurrency, normItems, normSections, proposalContentHash, recordPayment, round2, today, type ProposalRow,
} from '../lib/docs';
import { proposalPreview } from '../views/client-docs';

type C = Context<AppEnv>;
const RANK: Record<SessionUser['role'], number> = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 };
const can = (c: C, role: SessionUser['role']) => RANK[c.get('user')!.role] >= RANK[role];
const deny = (c: C, msg = 'You can view this but not change it.') => c.json({ ok: false, error: msg }, 403);
const origin = (c: C) => new URL(c.req.url).origin;
const body = async (c: C) => (await c.req.json().catch(() => ({}))) as Record<string, any>;

/** Never send gate secrets or code hashes to the browser. */
const strip = <T extends Record<string, any> | null>(r: T): T => {
  if (!r) return r;
  const { gate_secret, code_hash, ...rest } = r as Record<string, any>;
  return { ...rest, has_code: !!code_hash } as unknown as T;
};

const api = new Hono<AppEnv>();
api.use('*', requireUser('viewer'));

api.get('/config', (c) => c.json({ ok: true, email: emailConfigured(c.env), paystack: !!c.env.PAYSTACK_SECRET_KEY, contact: c.env.CONTACT_EMAIL, default_sections: DEFAULT_SECTIONS }));

/* ══════════════ payment methods (admins edit) ══════════════ */
const METHOD_KEYS: Record<string, string[]> = {
  ng_bank: ['bank', 'account_name', 'account_number', 'instructions'],
  intl_bank: ['bank', 'account_name', 'account_number', 'iban', 'swift', 'sort_code', 'routing', 'bank_address', 'intermediary', 'reference_note', 'instructions'],
  other: ['provider', 'account', 'instructions'],
  paystack: [],
};
function cleanMethod(b: Record<string, any>, before?: Record<string, any>) {
  const type = (Object.keys(METHOD_KEYS).includes(b.type) ? b.type : before?.type ?? 'ng_bank') as string;
  const curList = (Array.isArray(b.currencies) ? b.currencies : String(b.currencies ?? before?.currencies ?? 'NGN').split(','))
    .map((x: string) => String(x).trim().toUpperCase()).filter((x: string) => (CURRENCIES as string[]).includes(x));
  const srcDetails = b.details ?? parseJson(before?.details_json, {});
  const details: Record<string, string> = {};
  for (const k of METHOD_KEYS[type]) if (srcDetails?.[k]) details[k] = clamp(srcDetails[k], k === 'instructions' ? 2000 : 300);
  const label = clamp(b.label ?? before?.label, 120) || ({ ng_bank: 'Bank transfer (Nigeria)', intl_bank: 'International bank transfer', other: 'Other payment option', paystack: 'Paystack (card, transfer, USSD)' } as Record<string, string>)[type];
  return { type, label, currencies: [...new Set(curList.length ? curList : ['NGN'])].join(','), details_json: JSON.stringify(details), enabled: b.enabled === undefined ? (before?.enabled ?? 1) : (b.enabled ? 1 : 0) };
}
api.get('/methods', async (c) => {
  const rows = await all(c.env.DB, 'SELECT * FROM payment_methods ORDER BY sort, created_at');
  return c.json({ ok: true, rows, paystack_configured: !!c.env.PAYSTACK_SECRET_KEY, can_edit: can(c, 'admin') });
});
api.post('/methods', async (c) => {
  if (!can(c, 'admin')) return deny(c, 'Only admins can change payment methods.');
  const u = c.get('user')!; const m = cleanMethod(await body(c)); const id = newId('pm_');
  const max = await first<{ s: number | null }>(c.env.DB, 'SELECT MAX(sort) AS s FROM payment_methods');
  await run(c.env.DB, 'INSERT INTO payment_methods (id, type, label, currencies, details_json, enabled, sort, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?)',
    id, m.type, m.label, m.currencies, m.details_json, m.enabled, (max?.s ?? 0) + 1, u.name, u.name);
  await audit(c, 'payment_methods', id, 'create', `${u.name} added payment method “${m.label}”`, null, { ...m, details_json: '(hidden)' });
  return c.json({ ok: true, row: await first(c.env.DB, 'SELECT * FROM payment_methods WHERE id = ?', id) });
});
api.post('/methods/reorder', async (c) => {
  if (!can(c, 'admin')) return deny(c, 'Only admins can change payment methods.');
  const ids = ((await body(c)).ids ?? []) as string[];
  for (const [i, id] of ids.slice(0, 100).entries()) await run(c.env.DB, "UPDATE payment_methods SET sort = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", i + 1, c.get('user')!.name, String(id));
  await audit(c, 'payment_methods', null, 'reorder', `${c.get('user')!.name} reordered payment methods`);
  return c.json({ ok: true });
});
api.patch('/methods/:id', async (c) => {
  if (!can(c, 'admin')) return deny(c, 'Only admins can change payment methods.');
  const u = c.get('user')!; const id = c.req.param('id');
  const before = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM payment_methods WHERE id = ?', id);
  if (!before) return c.json({ ok: false, error: 'Not found' }, 404);
  const m = cleanMethod(await body(c), before);
  await run(c.env.DB, "UPDATE payment_methods SET type = ?, label = ?, currencies = ?, details_json = ?, enabled = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
    m.type, m.label, m.currencies, m.details_json, m.enabled, u.name, id);
  const d = diff(before, m);
  await audit(c, 'payment_methods', id, 'update', `${u.name} edited payment method “${m.label}” (${d.changed.join(', ') || 'no changes'})`);
  return c.json({ ok: true, row: await first(c.env.DB, 'SELECT * FROM payment_methods WHERE id = ?', id) });
});
api.delete('/methods/:id', async (c) => {
  if (!can(c, 'admin')) return deny(c, 'Only admins can change payment methods.');
  const before = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM payment_methods WHERE id = ?', c.req.param('id'));
  if (!before) return c.json({ ok: false }, 404);
  await run(c.env.DB, 'DELETE FROM payment_methods WHERE id = ?', before.id);
  await audit(c, 'payment_methods', before.id, 'delete', `${c.get('user')!.name} removed payment method “${before.label}”`);
  return c.json({ ok: true });
});

/* ══════════════ private files (signatures, receipts) — Studio session only ══════════════ */
async function privateFile(c: C, key: string | null | undefined, filename = 'file') {
  if (!key || !key.startsWith('private/')) return c.json({ ok: false, error: 'Not found' }, 404);
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.json({ ok: false, error: 'Not found' }, 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('cache-control', 'private, no-store');
  h.set('content-disposition', `inline; filename="${filename.replace(/[^\w.\- ]/g, '_')}"`);
  h.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers: h });
}
api.get('/receipts/:id', async (c) => {
  const r = await first<{ r2_key: string; filename: string }>(c.env.DB, 'SELECT r2_key, filename FROM payment_receipts WHERE id = ?', c.req.param('id'));
  return privateFile(c, r?.r2_key, r?.filename);
});

/* ══════════════ invoices ══════════════ */
const OPEN = "('unpaid','receipt_submitted','part_paid')";
api.get('/invoices', async (c) => {
  const month = today().slice(0, 7) + '-01';
  const [rows, receipts, outstanding, received, awaiting] = await Promise.all([
    all<Record<string, any>>(c.env.DB, `SELECT i.*, p.number AS proposal_number FROM invoices i LEFT JOIN proposals p ON p.id = i.proposal_id ORDER BY i.created_at DESC LIMIT 500`),
    all<Record<string, any>>(c.env.DB, 'SELECT id, invoice_id, filename, content_type, size, note, created_at FROM payment_receipts ORDER BY created_at'),
    all<{ currency: string; amount: number; n: number }>(c.env.DB, `SELECT currency, SUM(amount_due - amount_paid) AS amount, COUNT(*) AS n FROM invoices WHERE status IN ${OPEN} GROUP BY currency`),
    all<{ currency: string; amount: number; n: number }>(c.env.DB, 'SELECT currency, SUM(amount) AS amount, COUNT(*) AS n FROM invoice_payments WHERE paid_at >= ? GROUP BY currency', month),
    first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM invoices WHERE status = 'receipt_submitted'"),
  ]);
  const byInv: Record<string, any[]> = {};
  for (const r of receipts) (byInv[r.invoice_id] ??= []).push(r);
  return c.json({ ok: true, rows: rows.map((r) => ({ ...strip(r), receipts: byInv[r.id] ?? [] })), kpis: { outstanding, received, awaiting: awaiting?.n ?? 0 } });
});
api.get('/invoices/:id', async (c) => {
  const id = c.req.param('id');
  const inv = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', id);
  if (!inv) return c.json({ ok: false, error: 'Not found' }, 404);
  const [payments, receipts, events] = await Promise.all([
    all(c.env.DB, 'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at', id),
    all(c.env.DB, 'SELECT id, filename, content_type, size, note, created_at FROM payment_receipts WHERE invoice_id = ? ORDER BY created_at', id),
    all(c.env.DB, 'SELECT * FROM proposal_events WHERE invoice_id = ? ORDER BY id DESC', id),
  ]);
  return c.json({ ok: true, row: strip(inv), payments, receipts, events, url: `${origin(c)}/i/${inv.token}` });
});
api.patch('/invoices/:id', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!; const id = c.req.param('id'); const b = await body(c);
  const before = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', id);
  if (!before) return c.json({ ok: false, error: 'Not found' }, 404);
  const data: Record<string, unknown> = {};
  if ('due_date' in b) data.due_date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_date)) ? b.due_date : null;
  if ('notes' in b) data.notes = clamp(b.notes, 2000) || null;
  if ('status' in b) {
    if (!can(c, 'admin')) return deny(c, 'Only admins can void or reopen invoices.');
    if (b.status === 'void') data.status = 'void';
    else if (b.status === 'unpaid' && before.status === 'void') data.status = Number(before.amount_paid) > 0 ? 'part_paid' : 'unpaid';
  }
  if (!Object.keys(data).length) return c.json({ ok: true, row: strip(before) });
  const cols = Object.keys(data);
  await run(c.env.DB, `UPDATE invoices SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, ...cols.map((k) => data[k]), u.name, id);
  const d = diff(before, data);
  await audit(c, 'invoices', id, 'update', `${u.name} edited invoice ${before.number} (${d.changed.join(', ')})`, d.before, d.after);
  if (data.status) await addEvent(c.env.DB, before.proposal_id, data.status === 'void' ? 'void' : 'reopened', u.name, `${before.number} ${data.status === 'void' ? 'voided' : 'reopened'}`, id);
  return c.json({ ok: true, row: strip(await first(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', id)) });
});
api.post('/invoices/:id/payments', async (c) => {
  if (!can(c, 'admin')) return deny(c, 'Only admins can record payments.');
  const u = c.get('user')!; const id = c.req.param('id'); const b = await body(c);
  const inv = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', id);
  if (!inv) return c.json({ ok: false, error: 'Not found' }, 404);
  const remaining = round2(Number(inv.amount_due) - Number(inv.amount_paid));
  const amount = b.full ? remaining : round2(Number(b.amount));
  if (!(amount > 0)) return c.json({ ok: false, error: 'Enter the amount received.' }, 422);
  const method = ['bank_transfer', 'paystack', 'cash', 'other'].includes(b.method) ? b.method : 'bank_transfer';
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(String(b.paid_at)) ? `${b.paid_at} 12:00:00` : null;
  const r = await recordPayment(c.env, id, { amount, currency: inv.currency, method, reference: clamp(b.reference, 120) || null, note: clamp(b.note, 500) || null, paidAt, by: u.name });
  if (!r.ok) return c.json({ ok: false, error: r.error }, 422);
  if (r.duplicate) return c.json({ ok: false, error: 'A payment with that reference is already recorded.' }, 409);
  await audit(c, 'invoices', id, 'payment', `${u.name} recorded ${fmtMoney(amount, inv.currency)} on ${inv.number} (${r.status === 'paid' ? 'paid in full' : 'part paid'})`);
  if (r.status === 'paid' && emailConfigured(c.env) && inv.client_email && b.notify !== false) {
    c.executionCtx.waitUntil(sendEmail(c.env, {
      to: inv.client_email, subject: `Payment received — ${inv.number}`,
      html: brandEmail(c.env, { heading: 'Payment received — thank you', paragraphs: [`We’ve received your payment for ${inv.number}. Your invoice now shows as paid.`],
        rows: [['Invoice', inv.number], ['Amount received', fmtMoney(amount, inv.currency)]], button: { label: 'View invoice', url: `${origin(c)}/i/${inv.token}` } }),
    }).catch(() => null));
  }
  return c.json({ ok: true, row: strip(r.invoice) });
});

/** Shares a document: new 6-digit code (old one stops working), optional email(s) via Resend. */
async function share(c: C, kind: 'proposal' | 'invoice', row: Record<string, any>, b: Record<string, any>, regenerateOnly = false) {
  const u = c.get('user')!;
  const table = kind === 'proposal' ? 'proposals' : 'invoices';
  const code = genCode();
  // Sending switches a revoked link back on; regenerating a code alone leaves it as it is.
  await run(c.env.DB, `UPDATE ${table} SET code_hash = ?, gate_secret = ?, revoked = CASE WHEN ? THEN revoked ELSE 0 END, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
    await hashCode(code), newGateSecret(), regenerateOnly ? 1 : 0, u.name, row.id);
  const url = `${origin(c)}/${kind === 'proposal' ? 'p' : 'i'}/${row.token}`;
  const to = clamp(b.to ?? row.client_email, 200);
  const wantEmail = !regenerateOnly && b.email !== false && emailConfigured(c.env) && isEmail(to);
  let emailed = false, emailError: string | undefined;
  if (wantEmail) {
    const first = (row.client_name || '').split(' ')[0] || 'there';
    const separate = b.separate_code !== false;
    const message = clamp(b.message, 2000);
    const docName = kind === 'proposal' ? `proposal ${row.number}` : `invoice ${row.number}`;
    const t = kind === 'proposal' ? computeTotals(normItems(row.items_json), row.discount_pct, row.vat) : null;
    const rows: [string, string][] = kind === 'proposal'
      ? [['Proposal', row.number], ['Investment', fmtMoney(t!.start, row.currency)], ...(row.valid_until ? [['Valid until', fmtDate(row.valid_until)] as [string, string]] : [])]
      : [['Invoice', row.number], ['Amount due', fmtMoney(round2(row.amount_due - row.amount_paid), row.currency)], ...(row.due_date ? [['Due', fmtDate(row.due_date)] as [string, string]] : [])];
    const main = await sendEmail(c.env, {
      to, subject: kind === 'proposal' ? `Your proposal from Ferrn: ${row.title || row.number}` : `Invoice ${row.number} from Ferrn Digital Agency`,
      html: brandEmail(c.env, {
        heading: kind === 'proposal' ? (row.title || 'Your proposal') : `Invoice ${row.number}`,
        preheader: `Your ${docName} is ready to view.`,
        paragraphs: [`Hi ${first},`, ...(message ? [message] : []),
          kind === 'proposal' ? 'Your proposal is ready. You can read it, download a PDF, and accept and sign online.' : 'Your invoice is ready. You can pay online or by bank transfer, and upload your receipt on the same page.',
          separate ? 'For your security, the 6-digit access code is in a separate email.' : 'Use the access code below to open it.'],
        rows, code: separate ? undefined : code, button: { label: kind === 'proposal' ? 'View proposal' : 'View invoice', url },
        small: 'This link is private to you. Please don’t forward it.',
      }),
    });
    emailed = main.ok; emailError = main.error;
    if (main.ok && separate) {
      const second = await sendEmail(c.env, {
        to, subject: `Access code for your ${docName}`,
        html: brandEmail(c.env, { heading: 'Your access code', preheader: 'Use this code to open your document.', paragraphs: [`Hi ${first}, here is the code to open your ${docName}. It works with the link in our other email.`], code, small: 'Never share this code. Ferrn will never ask you for it by phone.' }),
      });
      if (!second.ok) { emailed = false; emailError = `Link sent, but the code email failed: ${second.error}`; }
    }
  }
  return { code, url, emailed, emailError, to };
}

api.post('/invoices/:id/send', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const inv = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', c.req.param('id'));
  if (!inv) return c.json({ ok: false, error: 'Not found' }, 404);
  const b = await body(c);
  const s = await share(c, 'invoice', inv, b, b.regenerate_only === true);
  const u = c.get('user')!;
  await addEvent(c.env.DB, inv.proposal_id, b.regenerate_only ? 'code' : 'invoice_sent', u.name, b.regenerate_only ? `New access code for ${inv.number}` : s.emailed ? `${inv.number} emailed to ${s.to}` : `${inv.number} link and code created for sharing`, inv.id);
  await audit(c, 'invoices', inv.id, b.regenerate_only ? 'code' : 'send', `${u.name} ${b.regenerate_only ? 'regenerated the access code for' : s.emailed ? 'emailed' : 'shared'} invoice ${inv.number}`);
  return c.json({ ok: true, ...s });
});
api.post('/invoices/:id/remind', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!;
  const inv = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', c.req.param('id'));
  if (!inv) return c.json({ ok: false, error: 'Not found' }, 404);
  if (['paid', 'void'].includes(inv.status)) return c.json({ ok: false, error: 'This invoice is already settled.' }, 409);
  const url = `${origin(c)}/i/${inv.token}`;
  const due = round2(inv.amount_due - inv.amount_paid);
  const overdue = inv.due_date && inv.due_date < today();
  const text = `Hi ${(inv.client_name || '').split(' ')[0] || 'there'}, a friendly reminder that invoice ${inv.number} (${fmtMoney(due, inv.currency)}) ${overdue ? `was due on ${fmtDate(inv.due_date)}` : `is due${inv.due_date ? ` on ${fmtDate(inv.due_date)}` : ''}`}. You can pay or upload a transfer receipt here: ${url} — it opens with the access code from our earlier message. Thank you! — Ferrn`;
  let emailed = false, emailError: string | undefined;
  if (emailConfigured(c.env) && isEmail(inv.client_email ?? '')) {
    const r = await sendEmail(c.env, {
      to: inv.client_email, subject: `${overdue ? 'Overdue' : 'Reminder'}: invoice ${inv.number}`,
      html: brandEmail(c.env, {
        heading: overdue ? `Invoice ${inv.number} is overdue` : `A friendly reminder about ${inv.number}`,
        paragraphs: [`Hi ${(inv.client_name || '').split(' ')[0] || 'there'},`, `This is a quick reminder that ${fmtMoney(due, inv.currency)} is ${overdue ? 'now overdue' : 'due'} on invoice ${inv.number}. If you’ve already paid, please upload your receipt on the invoice page, or just reply to this email.`],
        rows: [['Invoice', inv.number], ['Amount due', fmtMoney(due, inv.currency)], ...(inv.due_date ? [['Due date', fmtDate(inv.due_date)] as [string, string]] : [])],
        button: { label: 'View and pay invoice', url }, small: 'The page opens with the access code from our earlier message. Reply if you need a new one.',
      }),
    });
    emailed = r.ok; emailError = r.error;
  }
  await run(c.env.DB, "UPDATE invoices SET reminded_at = datetime('now'), updated_by = ?, updated_at = datetime('now') WHERE id = ?", u.name, inv.id);
  await addEvent(c.env.DB, inv.proposal_id, 'reminder', u.name, `Reminder for ${inv.number}${emailed ? ` emailed to ${inv.client_email}` : ' prepared for manual sending'}`, inv.id);
  await audit(c, 'invoices', inv.id, 'remind', `${u.name} sent a payment reminder for ${inv.number}`);
  return c.json({ ok: true, emailed, emailError, url, text, phone: inv.client_phone });
});
api.post('/invoices/:id/revoke', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const inv = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', c.req.param('id'));
  if (!inv) return c.json({ ok: false, error: 'Not found' }, 404);
  const revoked = (await body(c)).revoked !== false ? 1 : 0;
  await run(c.env.DB, "UPDATE invoices SET revoked = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", revoked, c.get('user')!.name, inv.id);
  await addEvent(c.env.DB, inv.proposal_id, revoked ? 'revoked' : 'restored', c.get('user')!.name, `${inv.number} link ${revoked ? 'switched off' : 'switched back on'}`, inv.id);
  await audit(c, 'invoices', inv.id, revoked ? 'revoke' : 'restore', `${c.get('user')!.name} ${revoked ? 'revoked' : 'restored'} the link for ${inv.number}`);
  return c.json({ ok: true, row: strip(await first(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', inv.id)) });
});

/* ══════════════ proposals ══════════════ */
const P_FIELDS = ['lead_id', 'client_name', 'client_company', 'client_email', 'client_phone', 'title', 'summary', 'currency', 'discount_pct', 'vat',
  'deposit_pct', 'invoice_on_sign', 'valid_until', 'status'] as const;
function cleanProposal(b: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const k of P_FIELDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (k === 'currency') out[k] = normCurrency(v);
    else if (k === 'discount_pct') out[k] = Math.max(0, Math.min(100, Number(v) || 0));
    else if (k === 'deposit_pct') out[k] = Math.max(1, Math.min(100, Number(v) || 100));
    else if (k === 'vat') out[k] = v ? 1 : 0;
    else if (k === 'invoice_on_sign') out[k] = v === 'full' ? 'full' : 'deposit';
    else if (k === 'valid_until') out[k] = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v : null;
    else if (k === 'status') { if (['draft', 'sent', 'viewed', 'declined', 'expired'].includes(v)) out[k] = v; }
    else if (k === 'client_email') out[k] = clamp(v, 200) || null;
    else out[k] = clamp(v, k === 'summary' ? 3000 : 300) || null;
  }
  if ('sections' in b) out.sections_json = JSON.stringify(normSections(b.sections));
  if ('items' in b) out.items_json = JSON.stringify(normItems(b.items));
  return out;
}

api.get('/', async (c) => {
  await expireStale(c.env.DB);
  const rows = await all<Record<string, any>>(c.env.DB,
    `SELECT p.*, (SELECT COUNT(*) FROM invoices i WHERE i.proposal_id = p.id AND i.status != 'void') AS invoice_count FROM proposals p ORDER BY COALESCE(p.updated_at, p.created_at) DESC LIMIT 500`);
  return c.json({ ok: true, rows: rows.map(strip) });
});

api.post('/ai-draft', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const b = await body(c);
  const notes = clamp(b.notes, 4000);
  if (notes.length < 10) return c.json({ ok: false, error: 'Add a few lines of notes first.' }, 422);
  const currency = normCurrency(b.currency);
  const products = await all<any>(c.env.DB, 'SELECT name, price_ngn_setup, price_ngn_monthly, price_usd_setup, price_usd_monthly FROM products WHERE published = 1 LIMIT 30');
  const lead = b.lead_id ? await first<any>(c.env.DB, 'SELECT company, niche, city, gaps, pitch, est_value FROM leads WHERE id = ?', b.lead_id) : null;
  try {
    const r = await complete(c.env, [
      { role: 'system', content: `You write client proposals for Ferrn Digital Agency (Lagos; websites, web apps, AI automation for Nigerian and international businesses). Write in clear, warm, confident Nigerian business English. No hype, no invented facts or client names, no placeholders like [X]. Use the price list as anchors; custom work is about ₦150,000 or $400 per developer-day. Currency: ${currency}.
Return JSON only: {"title": string, "summary": string (2–3 sentences for the cover), "sections": [{"heading": string, "body": string}], "items": [{"description": string, "qty": number, "unit_price": number, "billing": "once"|"monthly"|"termly"|"yearly"}], "deposit_pct": number}.
Sections, in this order: "Overview", "Scope of work", "Timeline", "What we need from you", "Terms". Bodies use simple markdown only: **bold**, "- " bullets, "1. " lists, "### " sub-headings. Keep 3–7 line items, realistic, no padding.` },
      { role: 'user', content: JSON.stringify({ notes, client: { name: b.client_name, company: b.client_company }, lead, price_list: products }) },
    ], { maxTokens: 2200, json: true, temperature: 0.5 });
    const d = extractJson<Record<string, any>>(r.text, {});
    return c.json({ ok: true, provider: r.provider, draft: {
      title: clamp(d.title, 200), summary: clamp(d.summary, 1500), sections: normSections(d.sections), items: normItems(d.items),
      deposit_pct: Number(d.deposit_pct) > 0 && Number(d.deposit_pct) <= 100 ? Number(d.deposit_pct) : undefined,
    } });
  } catch (e) {
    return c.json({ ok: false, error: `AI is not available right now (${(e as Error).message}).` }, 503);
  }
});

/** Live preview: renders the exact client page from unsaved editor state. */
api.post('/preview', async (c) => {
  const b = await body(c);
  const existing = b.id ? await first<ProposalRow>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', String(b.id)) : null;
  const data = cleanProposal(b);
  const p = {
    id: 'preview', number: existing?.number ?? 'PR-DRAFT', status: existing?.status ?? 'draft', token: 'preview', created_at: existing?.created_at ?? today(),
    title: '', currency: 'NGN', discount_pct: 0, vat: 1, deposit_pct: 60, invoice_on_sign: 'deposit', items_json: '[]', sections_json: '[]',
    ...(existing ? strip(existing) : {}), ...data,
  } as ProposalRow;
  const invs = existing ? await all<Record<string, any>>(c.env.DB, "SELECT * FROM invoices WHERE proposal_id = ? AND status != 'void'", existing.id) : [];
  const html = await c.html(proposalPreview({
    p, contentHash: '', signatureUrl: existing?.signature_key ? `/api/studio/proposals/${existing.id}/signature` : null,
    invoices: invs.map((i) => ({ number: i.number, url: '#', status: i.status, amount: fmtMoney(i.amount_due, i.currency) })),
  }));
  html.headers.set('cache-control', 'private, no-store');
  return html;
});

api.post('/', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!; const b = await body(c);
  const data = cleanProposal(b);
  if (!('sections_json' in data)) data.sections_json = JSON.stringify(DEFAULT_SECTIONS);
  if (!('items_json' in data)) data.items_json = '[]';
  if (!data.valid_until) data.valid_until = addDays(14);
  if (data.status && data.status !== 'draft') data.status = 'draft';
  const items = normItems(data.items_json);
  data.total = computeTotals(items, Number(data.discount_pct ?? 0), data.vat === undefined ? 1 : Number(data.vat)).total;
  const id = newId('pr_');
  Object.assign(data, { id, token: newDocToken(), gate_secret: newGateSecret(), created_by: u.name, updated_by: u.name, title: data.title ?? '' });
  for (let attempt = 0; ; attempt++) {
    data.number = await nextNumber(c.env.DB, 'proposals', 'PR');
    const cols = Object.keys(data);
    try {
      await run(c.env.DB, `INSERT INTO proposals (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((k) => data[k]));
      break;
    } catch (e) { if (!String(e).includes('UNIQUE') || attempt >= 3) throw e; }
  }
  await addEvent(c.env.DB, id, 'created', u.name, `Draft ${data.number} created`);
  await audit(c, 'proposals', id, 'create', `${u.name} created proposal ${data.number} “${String(data.title || '').slice(0, 60)}”`);
  return c.json({ ok: true, row: strip(await first(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', id)) });
});

api.get('/:id', async (c) => {
  const id = c.req.param('id');
  const p = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', id);
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  const [events, invoices] = await Promise.all([
    all(c.env.DB, 'SELECT * FROM proposal_events WHERE proposal_id = ? ORDER BY id DESC LIMIT 200', id),
    all<Record<string, any>>(c.env.DB, 'SELECT * FROM invoices WHERE proposal_id = ? ORDER BY created_at', id),
  ]);
  return c.json({ ok: true, row: strip(p), events, invoices: invoices.map(strip), url: `${origin(c)}/p/${p.token}`,
    integrity: p.content_hash ? { stored: p.content_hash, current: await proposalContentHash(p as ProposalRow) } : null });
});
api.get('/:id/signature', async (c) => {
  const p = await first<{ signature_key: string; number: string }>(c.env.DB, 'SELECT signature_key, number FROM proposals WHERE id = ?', c.req.param('id'));
  return privateFile(c, p?.signature_key, `${p?.number ?? 'signature'}-signature.png`);
});

api.patch('/:id', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!; const id = c.req.param('id');
  const before = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', id);
  if (!before) return c.json({ ok: false, error: 'Not found' }, 404);
  if (before.status === 'signed') return c.json({ ok: false, error: 'Signed proposals are locked so the signed version stays intact.' }, 409);
  const data = cleanProposal(await body(c));
  if (!Object.keys(data).length) return c.json({ ok: true, row: strip(before) });
  const merged = { ...before, ...data };
  data.total = computeTotals(normItems(merged.items_json), Number(merged.discount_pct), merged.vat).total;
  data.updated_by = u.name; data.updated_at = new Date().toISOString();
  const cols = Object.keys(data);
  await run(c.env.DB, `UPDATE proposals SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...cols.map((k) => data[k]), id);
  const d = diff(before, data);
  if (d.changed.length) {
    await audit(c, 'proposals', id, 'update', `${u.name} edited proposal ${before.number} (${d.changed.join(', ')})`,
      Object.fromEntries(Object.entries(d.before).map(([k, v]) => [k, String(v ?? '').slice(0, 300)])), Object.fromEntries(Object.entries(d.after).map(([k, v]) => [k, String(v ?? '').slice(0, 300)])));
    if ('status' in data && data.status !== before.status) await addEvent(c.env.DB, id, 'status', u.name, `Status set to ${data.status}`);
  }
  return c.json({ ok: true, row: strip(await first(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', id)) });
});

api.delete('/:id', async (c) => {
  if (!can(c, 'editor')) return deny(c, 'Only editors and admins can delete proposals.');
  const p = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false }, 404);
  if (p.status === 'signed') return c.json({ ok: false, error: 'Signed proposals are kept for your records. Revoke the link instead.' }, 409);
  await run(c.env.DB, 'DELETE FROM proposals WHERE id = ?', p.id);
  await audit(c, 'proposals', p.id, 'delete', `${c.get('user')!.name} deleted proposal ${p.number}`, strip(p), null);
  return c.json({ ok: true });
});

api.post('/:id/send', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!;
  const p = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  if (p.status === 'signed') return c.json({ ok: false, error: 'Already signed — share the invoice instead.' }, 409);
  if (!normItems(p.items_json).length && !normSections(p.sections_json).length) return c.json({ ok: false, error: 'Add some content before sending.' }, 422);
  if (p.valid_until && p.valid_until < today()) return c.json({ ok: false, error: 'The “valid until” date has passed. Update it, save, then send.' }, 422);
  const b = await body(c);
  const s = await share(c, 'proposal', p, b);
  await run(c.env.DB, `UPDATE proposals SET status = CASE WHEN status IN ('draft','expired','declined') THEN 'sent' ELSE status END,
    sent_at = datetime('now'), updated_by = ?, updated_at = datetime('now') WHERE id = ?`, u.name, p.id);
  await addEvent(c.env.DB, p.id, 'sent', u.name, s.emailed ? `Emailed to ${s.to}${b.separate_code !== false ? ' (code in a separate email)' : ''}` : 'Link and access code created for sharing');
  await audit(c, 'proposals', p.id, 'send', `${u.name} ${s.emailed ? 'emailed' : 'shared'} proposal ${p.number}${s.emailed ? ` to ${s.to}` : ''}`);
  if (p.lead_id) await run(c.env.DB, "UPDATE leads SET status = 'Proposal sent', next_action = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND status NOT IN ('Won','Lost')",
    `Proposal ${p.number} sent — follow up in 3 days`, u.name, p.lead_id).catch(() => null);
  return c.json({ ok: true, ...s, row: strip(await first(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', p.id)) });
});
api.post('/:id/code', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!;
  const p = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  const s = await share(c, 'proposal', p, {}, true);
  await addEvent(c.env.DB, p.id, 'code', u.name, 'New access code generated (earlier code and sessions stopped working)');
  await audit(c, 'proposals', p.id, 'code', `${u.name} regenerated the access code for ${p.number}`);
  return c.json({ ok: true, ...s });
});
api.post('/:id/revoke', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!;
  const p = await first<Record<string, any>>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  const revoked = (await body(c)).revoked !== false ? 1 : 0;
  await run(c.env.DB, "UPDATE proposals SET revoked = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", revoked, u.name, p.id);
  await addEvent(c.env.DB, p.id, revoked ? 'revoked' : 'restored', u.name, revoked ? 'Client link switched off' : 'Client link switched back on');
  await audit(c, 'proposals', p.id, revoked ? 'revoke' : 'restore', `${u.name} ${revoked ? 'revoked' : 'restored'} the client link for ${p.number}`);
  return c.json({ ok: true, row: strip(await first(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', p.id)) });
});
api.post('/:id/invoices', async (c) => {
  if (!can(c, 'sales')) return deny(c);
  const u = c.get('user')!;
  const p = await first<ProposalRow>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  if (p.status !== 'signed') return c.json({ ok: false, error: 'Invoices are raised once the proposal is signed.' }, 409);
  const want = (await body(c)).kind;
  const kind = (['deposit', 'full', 'balance'].includes(want) ? want : 'balance') as 'deposit' | 'full' | 'balance';
  const inv = await createInvoiceFromProposal(c.env, p, kind, u.name);
  if (!(Number(inv.amount_due) > 0)) {
    await run(c.env.DB, "UPDATE invoices SET status = 'void' WHERE id = ?", inv.id);
    return c.json({ ok: false, error: 'Nothing left to invoice on this proposal.' }, 422);
  }
  await audit(c, 'invoices', inv.id, 'create', `${u.name} raised ${kind} invoice ${inv.number} for ${fmtMoney(inv.amount_due, inv.currency)}`);
  return c.json({ ok: true, row: strip(inv) });
});

export default api;
