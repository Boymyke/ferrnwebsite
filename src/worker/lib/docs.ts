/** Proposals and invoices: shared maths, safe markdown, access gate, numbering and payments.
 *  Used by routes/proposals.ts (Studio), routes/client-docs.tsx (clients) and the Paystack webhook. */
import type { Bindings } from './env';
import { all, first, newId, parseJson, randomToken, run } from './db';
import { sha256 } from './auth';
import { brandEmail, emailConfigured, esc, sendEmail } from './email';

export type Billing = 'once' | 'monthly' | 'termly' | 'yearly';
export type LineItem = { description: string; qty: number; unit_price: number; billing: Billing };
export type Section = { heading: string; body: string };
export type Currency = 'NGN' | 'USD' | 'GBP';

export const VAT_RATE = 7.5;
export const CURRENCIES: Currency[] = ['NGN', 'USD', 'GBP'];
export const PAYSTACK_CURRENCIES: Currency[] = ['NGN', 'USD'];
export const BILLING_LABEL: Record<Billing, string> = { once: 'One-off', monthly: 'Monthly', termly: 'Per term', yearly: 'Yearly' };
const CYCLE_WORD: Record<string, string> = { monthly: 'month', termly: 'term', yearly: 'year' };

export const DEFAULT_SECTIONS: Section[] = [
  { heading: 'Overview', body: 'What you told us, what we heard, and the outcome this project is built to deliver.' },
  { heading: 'Scope of work', body: '- Discovery and sitemap\n- Design\n- Build and launch\n- Training and handover' },
  { heading: 'Timeline', body: '**Week 1:** discovery and content plan\n**Weeks 2–3:** design and build\n**Week 4:** testing, training and launch' },
  { heading: 'What we need from you', body: '- A main point of contact who can approve work\n- Logo, photos and any existing content\n- Access to your domain and any accounts we will connect' },
  { heading: 'Terms', body: 'Work starts when the deposit is received. The balance is due at launch. Managed plans are billed in advance. Your content, domain and data remain yours. Prices exclude third-party fees (domains, SMS or WhatsApp usage) unless listed.' },
];

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

/* ── sanitising input ── */
export function normItems(x: unknown): LineItem[] {
  const arr = Array.isArray(x) ? x : parseJson<unknown[]>(x, []);
  return (Array.isArray(arr) ? arr : []).slice(0, 60).map((i: any) => ({
    description: String(i?.description ?? '').slice(0, 1000),
    qty: Math.max(0, Math.min(1e6, Number(i?.qty) || 0)),
    unit_price: Math.max(0, Math.min(1e12, Number(i?.unit_price) || 0)),
    billing: (['once', 'monthly', 'termly', 'yearly'].includes(i?.billing ?? i?.recurring) ? (i.billing ?? i.recurring) : 'once') as Billing,
  })).filter((i) => i.description || i.unit_price);
}
export function normSections(x: unknown): Section[] {
  const arr = Array.isArray(x) ? x : parseJson<unknown[]>(x, []);
  return (Array.isArray(arr) ? arr : []).slice(0, 30).map((s: any) => ({
    heading: String(s?.heading ?? '').slice(0, 200), body: String(s?.body ?? '').slice(0, 20_000),
  })).filter((s) => s.heading || s.body);
}
export const normCurrency = (c: unknown): Currency => (CURRENCIES.includes(c as Currency) ? (c as Currency) : 'NGN');

/* ── money ── */
export function computeTotals(items: LineItem[], discountPct: number, vat: boolean | number) {
  const amount = (i: LineItem) => round2(i.qty * i.unit_price);
  const once = items.filter((i) => i.billing === 'once');
  const subtotal = round2(once.reduce((a, i) => a + amount(i), 0));
  const discount = round2(subtotal * Math.max(0, Math.min(100, Number(discountPct) || 0)) / 100);
  const taxable = round2(subtotal - discount);
  const tax = vat ? round2(taxable * VAT_RATE / 100) : 0;
  const total = round2(taxable + tax);
  const recurring: Record<string, { net: number; tax: number; total: number }> = {};
  for (const i of items) {
    if (i.billing === 'once') continue;
    const r = (recurring[i.billing] ??= { net: 0, tax: 0, total: 0 });
    r.net = round2(r.net + amount(i));
  }
  for (const r of Object.values(recurring)) { r.tax = vat ? round2(r.net * VAT_RATE / 100) : 0; r.total = round2(r.net + r.tax); }
  /** What signing commits the client to pay first: the one-off total, or the first cycle when there are no one-offs. */
  const start = total > 0 ? total : round2(Object.values(recurring).reduce((a, r) => a + r.total, 0));
  return { subtotal, discount, taxable, tax, total, recurring, start, lineAmount: amount };
}

export function fmtMoney(n: number, cur: string) {
  const v = Number(n) || 0;
  const opts = { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 };
  if (cur === 'USD') return '$' + v.toLocaleString('en-US', opts);
  if (cur === 'GBP') return '£' + v.toLocaleString('en-GB', opts);
  return '₦' + v.toLocaleString('en-NG', opts);
}
export const cycleWord = (b: string) => CYCLE_WORD[b] ?? b;

export function fmtDate(iso?: string | null, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00Z' : iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', withTime
    ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos', timeZoneName: 'short' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}

/* ── simple, safe markdown: # headings, **bold**, *italic*, - bullets, 1. lists, [links](https://…) ── */
function inline(escaped: string) {
  return escaped
    .replace(/\[([^\]]{1,300})\]\(([^)\s]{1,800})\)/g, (_m, text: string, url: string) =>
      /^(https?:\/\/|mailto:|tel:)/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>` : text)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}
export function renderMarkdown(src: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushPara = () => { if (para.length) out.push(`<p>${para.join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; };
  for (const raw of String(src ?? '').replace(/\r/g, '').split('\n')) {
    const t = raw.trim();
    if (!t) { flushPara(); flushList(); continue; }
    const e = inline(esc(t));
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(#{1,3})\s+(.+)$/))) { flushPara(); flushList(); out.push(`<h${m[1].length + 2}>${inline(esc(m[2]))}</h${m[1].length + 2}>`); continue; }
    if ((m = t.match(/^[-*•]\s+(.+)$/))) { flushPara(); if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list!.items.push(inline(esc(m[1]))); continue; }
    if ((m = t.match(/^\d{1,3}[.)]\s+(.+)$/))) { flushPara(); if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list!.items.push(inline(esc(m[1]))); continue; }
    flushList(); para.push(e);
  }
  flushPara(); flushList();
  return out.join('\n');
}

/* ── access gate ── */
export function genCode() {
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= 4_294_000_000); // drop the biased tail
  return String(a[0] % 1_000_000).padStart(6, '0');
}
/** sha256 of the code. Not salted per document so an invoice can inherit its proposal's code. */
export const hashCode = (code: string) => sha256(`ferrn-doc-code:${code}`);
export const newGateSecret = () => randomToken(32);
export const newDocToken = () => randomToken(24); // 192 bits, URL-safe
export const ipHash = (ip: string) => sha256(`ferrn-ip:${ip}`);

const enc = new TextEncoder();
const hmacKey = (secret: string) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

export const ACCESS_COOKIE = 'ferrn_doc';
export const ACCESS_DAYS = 30;
/** Value of the per-document access cookie: "<expiry>.<hmac(docId.expiry)>", keyed by the document's gate_secret. */
export async function signAccess(secret: string, docId: string) {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_DAYS * 86400;
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${docId}.${exp}`));
  return { value: `${exp}.${toHex(mac)}`, expires: new Date(exp * 1000) };
}
export async function verifyAccess(secret: string, docId: string, value: string | undefined) {
  if (!value) return false;
  const [exp, mac] = value.split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(mac) || Number(exp) < Date.now() / 1000) return false;
  return crypto.subtle.verify('HMAC', await hmacKey(secret), fromHex(mac), enc.encode(`${docId}.${exp}`));
}

/* ── numbering ── */
export async function nextNumber(db: D1Database, table: 'proposals' | 'invoices', prefix: 'PR' | 'INV') {
  const year = new Date().getUTCFullYear();
  const head = `${prefix}-${year}-`;
  const row = await first<{ n: number | null }>(db, `SELECT MAX(CAST(substr(number, ?) AS INTEGER)) AS n FROM ${table} WHERE number LIKE ?`, head.length + 1, head + '%');
  return head + String((row?.n ?? 0) + 1).padStart(3, '0');
}

/* ── events & notifications ── */
export async function addEvent(db: D1Database, proposalId: string | null, kind: string, actor: string, detail = '', invoiceId: string | null = null) {
  if (!proposalId) return;
  await run(db, 'INSERT INTO proposal_events (proposal_id, invoice_id, kind, actor, detail, updated_by) VALUES (?,?,?,?,?,?)',
    proposalId, invoiceId, kind, actor.slice(0, 120), detail.slice(0, 1000), actor.slice(0, 120));
}
/** Client actions land in the Studio activity log next to team edits. */
export async function clientAudit(db: D1Database, who: string, entity: string, id: string, action: string, summary: string) {
  await run(db, 'INSERT INTO audit_log (user_name, entity, entity_id, action, summary) VALUES (?,?,?,?,?)', who.slice(0, 120), entity, id, action, summary.slice(0, 500));
}
export async function notifyFerrn(env: Bindings, subject: string, paragraphs: string[], link?: { label: string; path: string }, rows?: [string, string][]) {
  if (!emailConfigured(env) || !env.CONTACT_EMAIL) return;
  await sendEmail(env, {
    to: env.CONTACT_EMAIL, subject,
    html: brandEmail(env, { heading: subject, paragraphs, rows, button: link ? { label: link.label, url: env.SITE_URL + link.path } : undefined }),
  }).catch(() => null);
}

/* ── proposal integrity ── */
export type ProposalRow = Record<string, any> & {
  id: string; number: string; title: string; currency: Currency; items_json: string; sections_json: string;
  discount_pct: number; vat: number; deposit_pct: number; invoice_on_sign: 'deposit' | 'full'; status: string; token: string;
};
export function proposalContentHash(p: ProposalRow) {
  return sha256(JSON.stringify({
    number: p.number, title: p.title, summary: p.summary ?? '', client: [p.client_name, p.client_company, p.client_email],
    sections: normSections(p.sections_json), items: normItems(p.items_json), currency: p.currency, discount_pct: Number(p.discount_pct),
    vat: Number(p.vat) ? 1 : 0, deposit_pct: Number(p.deposit_pct), invoice_on_sign: p.invoice_on_sign, valid_until: p.valid_until ?? null,
  }));
}
export const isExpired = (p: { valid_until?: string | null; status: string }) =>
  !!p.valid_until && p.valid_until < today() && ['draft', 'sent', 'viewed'].includes(p.status);

/** Marks open proposals whose validity has passed as expired (lazy; called on list and view). */
export async function expireStale(db: D1Database) {
  const rows = await all<{ id: string }>(db, "SELECT id FROM proposals WHERE status IN ('sent','viewed') AND valid_until IS NOT NULL AND valid_until < date('now')");
  for (const r of rows) {
    await run(db, "UPDATE proposals SET status = 'expired', updated_at = datetime('now') WHERE id = ?", r.id);
    await addEvent(db, r.id, 'expired', 'System', 'Validity date passed');
  }
}

/* ── invoices ── */
export async function createInvoiceFromProposal(env: Bindings, p: ProposalRow, kind: 'deposit' | 'full' | 'balance', by: string) {
  const items = normItems(p.items_json);
  const t = computeTotals(items, p.discount_pct, p.vat);
  const pct = Math.max(1, Math.min(100, Number(p.deposit_pct) || 100));
  let amountDue = t.start;
  if (kind === 'deposit') amountDue = round2(t.start * pct / 100);
  if (kind === 'balance') {
    const prior = await first<{ s: number | null }>(env.DB, "SELECT SUM(amount_due) AS s FROM invoices WHERE proposal_id = ? AND status != 'void'", p.id);
    amountDue = round2(Math.max(0, t.start - Number(prior?.s ?? 0)));
  }
  const id = newId('iv_');
  for (let attempt = 0; attempt < 4; attempt++) {
    const number = await nextNumber(env.DB, 'invoices', 'INV');
    try {
      await run(env.DB,
        `INSERT INTO invoices (id, number, proposal_id, lead_id, kind, client_name, client_company, client_email, client_phone, title, currency, items_json,
          discount_pct, vat, deposit_pct, subtotal, discount, tax, total, amount_due, due_date, status, token, code_hash, gate_secret, created_by, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'unpaid', ?,?,?,?,?)`,
        id, number, p.id, p.lead_id ?? null, kind, p.client_name ?? null, p.client_company ?? null, p.client_email ?? null, p.client_phone ?? null,
        p.title, p.currency, JSON.stringify(items), Number(p.discount_pct) || 0, Number(p.vat) ? 1 : 0, kind === 'deposit' ? pct : null,
        t.subtotal, t.discount, t.tax, t.start, amountDue, addDays(7), newDocToken(), p.code_hash ?? null, newGateSecret(), by, by);
      await addEvent(env.DB, p.id, 'invoice', by, `${number} issued for ${fmtMoney(amountDue, p.currency)} (${kind})`, id);
      return (await first<Record<string, any>>(env.DB, 'SELECT * FROM invoices WHERE id = ?', id))!;
    } catch (e) {
      if (!String(e).includes('UNIQUE') || attempt === 3) throw e;
    }
  }
  throw new Error('Could not number the invoice');
}

/** Records a payment, then recomputes amount_paid and status. Idempotent per reference. */
export async function recordPayment(env: Bindings, invoiceId: string, p: {
  amount: number; currency: string; method: string; reference?: string | null; note?: string | null; paidAt?: string | null; by: string;
}) {
  const inv = await first<Record<string, any>>(env.DB, 'SELECT * FROM invoices WHERE id = ?', invoiceId);
  if (!inv) return { ok: false as const, error: 'Invoice not found' };
  if (inv.status === 'void') return { ok: false as const, error: 'This invoice is void' };
  const r = await run(env.DB,
    `INSERT OR IGNORE INTO invoice_payments (id, invoice_id, amount, currency, method, reference, note, paid_at, recorded_by, updated_by)
     VALUES (?,?,?,?,?,?,?, COALESCE(?, datetime('now')), ?, ?)`,
    newId('pay_'), invoiceId, round2(p.amount), p.currency, p.method, p.reference || null, p.note || null, p.paidAt || null, p.by, p.by);
  if (!r.meta.changes) return { ok: true as const, duplicate: true, invoice: inv };
  const sum = await first<{ s: number }>(env.DB, 'SELECT COALESCE(SUM(amount), 0) AS s FROM invoice_payments WHERE invoice_id = ?', invoiceId);
  const paid = round2(sum?.s ?? 0);
  const status = paid + 0.009 >= Number(inv.amount_due) ? 'paid' : paid > 0 ? 'part_paid' : inv.status;
  await run(env.DB,
    `UPDATE invoices SET amount_paid = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, datetime('now')) ELSE paid_at END,
       updated_by = ?, updated_at = datetime('now') WHERE id = ?`, paid, status, status, p.by, invoiceId);
  await addEvent(env.DB, inv.proposal_id, status === 'paid' ? 'paid' : 'payment', p.by,
    `${fmtMoney(p.amount, p.currency)} received on ${inv.number} via ${p.method.replace('_', ' ')}${status === 'paid' ? ' — paid in full' : ''}`, invoiceId);
  return { ok: true as const, duplicate: false, invoice: (await first<Record<string, any>>(env.DB, 'SELECT * FROM invoices WHERE id = ?', invoiceId))!, status };
}

/** Paystack references for invoices look like INV-<invoice id>-<nonce>. */
export const paystackRef = (invoiceId: string) => `INV-${invoiceId}-${Date.now().toString(36)}${randomToken(3).replace(/[-_]/g, 'x')}`;
export const invoiceIdFromRef = (ref: string) => ref.match(/^INV-(iv_[a-z0-9]{6,20})-/i)?.[1] ?? null;

/** Called by the Paystack callback and webhook. Amount is in minor units, as Paystack sends it. */
export async function settleInvoiceFromPaystack(env: Bindings, ref: string, tx: { status?: string; amount?: number; currency?: string } | undefined) {
  const id = invoiceIdFromRef(ref);
  if (!id || tx?.status !== 'success' || !tx.amount) return { ok: false };
  const inv = await first<Record<string, any>>(env.DB, 'SELECT id, currency, number, proposal_id, client_name FROM invoices WHERE id = ?', id);
  if (!inv || (tx.currency && tx.currency.toUpperCase() !== inv.currency)) return { ok: false };
  const res = await recordPayment(env, id, { amount: tx.amount / 100, currency: inv.currency, method: 'paystack', reference: ref, note: 'Paystack', by: 'Paystack' });
  if (res.ok && !res.duplicate) {
    await clientAudit(env.DB, `Client: ${inv.client_name ?? 'Paystack'}`, 'invoices', id, 'payment', `Paystack payment of ${fmtMoney(tx.amount / 100, inv.currency)} on ${inv.number}`);
    await notifyFerrn(env, `Payment received on ${inv.number}`, [`${fmtMoney(tx.amount / 100, inv.currency)} was paid by card through Paystack.`], { label: 'Open Studio', path: '/studio/proposals?tab=invoices' });
  }
  return { ok: res.ok };
}

/* ── payment methods ── */
export type PaymentMethod = { id: string; type: 'ng_bank' | 'intl_bank' | 'other' | 'paystack'; label: string; currencies: string; details_json: string; enabled: number; sort: number };
export const methodCurrencies = (m: { currencies: string }) => m.currencies.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
export async function methodsFor(db: D1Database, currency: string) {
  const rows = await all<PaymentMethod>(db, 'SELECT * FROM payment_methods WHERE enabled = 1 ORDER BY sort, created_at');
  return rows.filter((m) => methodCurrencies(m).includes(currency));
}
