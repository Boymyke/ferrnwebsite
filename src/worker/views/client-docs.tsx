import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import { ASSET_V } from '../version';
import {
  BILLING_LABEL, computeTotals, cycleWord, fmtDate, fmtMoney, isExpired, methodCurrencies, normItems, normSections, renderMarkdown,
  type PaymentMethod, type ProposalRow,
} from '../lib/docs';
import { parseJson } from '../lib/db';

const CONTACT = 'info@ferrnagency.com';

function Shell({ title, children, bodyClass, data }: { title: string; children: Child; bodyClass?: string; data?: Record<string, string> }) {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) attrs[`data-${k}`] = v;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="same-origin" />
        <meta name="theme-color" content="#0b0b0b" />
        <title>{title}</title>
        <link rel="icon" href="/icons/favicon-32.png" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href={`/assets/docs.css?v=${ASSET_V}`} />
      </head>
      <body class={bodyClass ?? ''} {...attrs}>
        {children}
        <script src={`/assets/docs.js?v=${ASSET_V}`} defer></script>
      </body>
    </html>
  );
}

const Logo = ({ dark, width = 132 }: { dark?: boolean; width?: number }) =>
  <img class="logo" src={dark ? '/brand/ferrn-logo-on-dark.svg' : '/brand/ferrn-logo-on-light.svg'} alt="Ferrn Digital Agency" width={width} height={Math.round(width * 62 / 320)} />;

const STATUS_TEXT: Record<string, string> = {
  draft: 'Draft', sent: 'Awaiting signature', viewed: 'Awaiting signature', signed: 'Signed', declined: 'Declined', expired: 'Expired',
  unpaid: 'Unpaid', receipt_submitted: 'Receipt received', part_paid: 'Part paid', paid: 'Paid', void: 'Void',
};
const Pill = ({ s }: { s: string }) => <span class={`pill s-${s}`}>{STATUS_TEXT[s] ?? s}</span>;

/* ── gate ── */
export function GatePage({ kind, action, error, locked }: { kind: 'proposal' | 'invoice'; action: string; error?: string; locked?: boolean }) {
  return (
    <Shell title="Private document | Ferrn Digital Agency" bodyClass="gate-body">
      <main class="gate">
        <div class="gate-card">
          <Logo dark width={150} />
          <div class="gate-lock" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </div>
          <h1>This {kind} is private</h1>
          <p class="gate-sub">Enter the 6-digit access code we sent you with the link.</p>
          <form method="post" action={action} class="gate-form" autocomplete="off">
            <label class="sr" for="code">Access code</label>
            <input id="code" name="code" inputmode="numeric" pattern="[0-9 ]*" maxlength={7} autocomplete="one-time-code" placeholder="••••••" required autofocus disabled={locked} />
            {error ? <p class="gate-err" role="alert">{error}</p> : null}
            <button type="submit" disabled={locked}>Open {kind}</button>
          </form>
          <p class="gate-help">Can’t find the code? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we’ll send a new one.</p>
        </div>
        <p class="gate-foot">Ferrn Digital Agency · Secure document link</p>
      </main>
    </Shell>
  );
}

export function ClosedPage({ title, message }: { title: string; message: string }) {
  return (
    <Shell title={`${title} | Ferrn Digital Agency`} bodyClass="gate-body">
      <main class="gate">
        <div class="gate-card">
          <Logo dark width={150} />
          <h1>{title}</h1>
          <p class="gate-sub">{message}</p>
          <p class="gate-help">Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        </div>
      </main>
    </Shell>
  );
}

/* ── proposal ── */
export type ProposalViewProps = {
  p: ProposalRow; contentHash: string; preview?: boolean; flash?: string;
  signatureUrl?: string | null; invoices?: { number: string; url: string; status: string; amount: string }[];
};

export function ProposalView({ p, contentHash, preview, flash, signatureUrl, invoices = [] }: ProposalViewProps) {
  const items = normItems(p.items_json);
  const sections = normSections(p.sections_json);
  const t = computeTotals(items, p.discount_pct, p.vat);
  const cur = p.currency;
  const expired = p.status === 'expired' || isExpired(p);
  const status = expired && p.status !== 'signed' ? 'expired' : p.status;
  const canSign = !preview && ['draft', 'sent', 'viewed'].includes(status);
  const who = p.client_company || p.client_name || 'You';
  const depositPct = Number(p.deposit_pct) || 0;
  const firstAmount = p.invoice_on_sign === 'full' ? t.start : Math.round(t.start * depositPct) / 100;
  const recurring = Object.entries(t.recurring);
  const issued = (p.sent_at || p.created_at || '').slice(0, 10);
  const n = sections.length;
  return (
    <Shell title={`${p.title || 'Proposal'}, ${p.number} | Ferrn`} bodyClass={`doc proposal ${preview ? 'is-preview' : ''}`}
      data={preview ? {} : { kind: 'proposal', base: `/p/${p.token}` }}>
      <div class="bar no-print">
        <div class="bar-in">
          <a class="bar-brand" href="#top"><Logo dark width={96} /></a>
          <span class="bar-doc">Proposal {p.number}</span> <Pill s={status} />
          <div class="bar-actions">
            <button type="button" class="b ghost" data-print>Download PDF</button>
            {canSign ? <a class="b primary" href="#accept">Accept &amp; sign</a> : null}
            {status === 'signed' && invoices[0] ? <a class="b primary" href={invoices[0].url}>View invoice</a> : null}
          </div>
        </div>
      </div>
      {flash ? <div class="flash no-print">{flash}</div> : null}
      <main class="paper" id="top">
        <section class="cover">
          <div class="cover-top"><Logo dark width={150} /><span>{p.number}</span></div>
          <div class="cover-main">
            <p class="kicker">Proposal prepared for</p>
            <p class="client">{who}</p>
            <h1>{p.title || 'Proposal'}</h1>
            {p.summary ? <p class="summary">{p.summary}</p> : null}
          </div>
          <dl class="cover-meta">
            <div><dt>Prepared by</dt><dd>Ferrn Digital Agency</dd></div>
            <div><dt>Date</dt><dd>{fmtDate(issued) || fmtDate(new Date().toISOString().slice(0, 10))}</dd></div>
            <div><dt>Valid until</dt><dd>{p.valid_until ? fmtDate(p.valid_until) : 'On request'}</dd></div>
            <div><dt>Investment</dt><dd>{fmtMoney(t.start, cur)}{recurring.length ? <small> + recurring</small> : null}</dd></div>
          </dl>
        </section>

        <div class="doc-body">
          {status === 'declined' ? <div class="notice red">This proposal was declined{p.declined_at ? ` on ${fmtDate(p.declined_at)}` : ''}. If anything has changed, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we’ll send an updated version.</div> : null}
          {status === 'expired' ? <div class="notice">This proposal expired{p.valid_until ? ` on ${fmtDate(p.valid_until)}` : ''}. Prices and availability may have changed. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for a refreshed version.</div> : null}

          <nav class="toc">
            <h4>Contents</h4>
            <ol>
              {sections.map((s, i) => <li><a href={`#s${i + 1}`}><span>{String(i + 1).padStart(2, '0')}</span>{s.heading || 'Section'}</a></li>)}
              <li><a href="#investment"><span>{String(n + 1).padStart(2, '0')}</span>Investment</a></li>
              <li><a href="#accept"><span>{String(n + 2).padStart(2, '0')}</span>Acceptance</a></li>
            </ol>
          </nav>

          {sections.map((s, i) => (
            <section class="sec" id={`s${i + 1}`}>
              <div class="num">{String(i + 1).padStart(2, '0')}</div>
              <div class="sec-main">
                <h2>{s.heading}</h2>
                <div class="md">{raw(renderMarkdown(s.body))}</div>
              </div>
            </section>
          ))}

          <section class="sec pricing" id="investment">
            <div class="num">{String(n + 1).padStart(2, '0')}</div>
            <div class="sec-main">
              <h2>Investment</h2>
              {items.length ? (
                <table class="items">
                  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit price</th><th>Billing</th><th class="r">Amount</th></tr></thead>
                  <tbody>
                    {items.map((i) => (
                      <tr>
                        <td>{i.description}</td><td class="c">{i.qty}</td><td class="r">{fmtMoney(i.unit_price, cur)}</td>
                        <td><span class={`chip ${i.billing}`}>{BILLING_LABEL[i.billing]}</span></td><td class="r strong">{fmtMoney(t.lineAmount(i), cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p class="muted">Pricing will be confirmed with you.</p>}
              <div class="sum-grid">
                <div class="sum-card">
                  <h4>One-off</h4>
                  <p class="row"><span>Subtotal</span><span>{fmtMoney(t.subtotal, cur)}</span></p>
                  {t.discount ? <p class="row"><span>Discount ({Number(p.discount_pct)}%)</span><span>−{fmtMoney(t.discount, cur)}</span></p> : null}
                  {Number(p.vat) ? <p class="row"><span>VAT (7.5%)</span><span>{fmtMoney(t.tax, cur)}</span></p> : null}
                  <p class="row grand"><span>Total</span><span>{fmtMoney(t.total, cur)}</span></p>
                </div>
                {recurring.length ? (
                  <div class="sum-card rec">
                    <h4>Recurring</h4>
                    {recurring.map(([cycle, r]) => <p class="row"><span>Per {cycleWord(cycle)}{Number(p.vat) ? ' (incl. VAT)' : ''}</span><span class="strong">{fmtMoney(r.total, cur)}</span></p>)}
                    <p class="fine">Billed in advance from launch. Cancel any time after the minimum term in the terms above.</p>
                  </div>
                ) : null}
              </div>
              <div class="callout">
                <div>
                  <h4>{p.invoice_on_sign === 'full' ? 'Due on signing' : `${depositPct}% deposit on signing`}</h4>
                  <p>{p.invoice_on_sign === 'full'
                    ? 'Your invoice is issued as soon as you sign, so we can book your start date.'
                    : `Your deposit invoice is issued as soon as you sign. The balance of ${fmtMoney(Math.max(0, t.start - firstAmount), cur)} is invoiced at launch.`}</p>
                </div>
                <strong>{fmtMoney(firstAmount, cur)}</strong>
              </div>
              {p.valid_until ? <p class="validity">Prices in this proposal are valid until <strong>{fmtDate(p.valid_until)}</strong>.</p> : null}
            </div>
          </section>

          <section class="sec accept" id="accept">
            <div class="num">{String(n + 2).padStart(2, '0')}</div>
            <div class="sec-main">
              <h2>Acceptance</h2>
              {status === 'signed' ? (
                <div class="signed">
                  {signatureUrl ? <div class="sig-img"><img src={signatureUrl} alt={`Signature of ${p.signer_name}`} /></div> : null}
                  <p class="by">Signed by <strong>{p.signer_name}</strong>{p.signer_title ? `, ${p.signer_title}` : ''}{p.client_company ? ` for ${p.client_company}` : ''} on {fmtDate(p.signed_at, true)}</p>
                  {p.content_hash ? <p class="fp">Document fingerprint (SHA-256): <code>{p.content_hash}</code></p> : null}
                  {invoices.length ? (
                    <div class="inv-links no-print">
                      {invoices.map((i) => <a class="b primary" href={i.url}>View invoice {i.number} · {i.amount}</a>)}
                    </div>
                  ) : null}
                </div>
              ) : canSign ? (
                <div class="sign-card no-print">
                  <p class="lead">Happy to go ahead? Sign below. Your {p.invoice_on_sign === 'full' ? 'invoice' : 'deposit invoice'} opens straight after.</p>
                  <form id="sign-form" novalidate>
                    <div class="grid2">
                      <label>Full name<input name="name" autocomplete="name" required maxlength={120} value={p.client_name ?? ''} /></label>
                      <label>Title / role<input name="title" autocomplete="organization-title" maxlength={120} placeholder="e.g. Managing Director" /></label>
                    </div>
                    <div class="sig-tabs" role="tablist">
                      <button type="button" class="on" data-mode="draw" role="tab">Draw signature</button>
                      <button type="button" data-mode="type" role="tab">Type signature</button>
                    </div>
                    <div class="sig-pane" data-pane="draw">
                      <div class="sig-pad"><canvas id="sig-canvas" aria-label="Signature pad"></canvas><span class="sig-line">Sign here</span></div>
                      <div class="sig-tools"><span class="muted">Use your mouse, trackpad or finger.</span><button type="button" class="link" id="sig-clear">Clear</button></div>
                    </div>
                    <div class="sig-pane" data-pane="type" hidden>
                      <input id="sig-typed" maxlength={60} placeholder="Type your full name" />
                      <div class="sig-typed-preview" id="sig-typed-preview" aria-hidden="true"></div>
                    </div>
                    <label class="agree"><input type="checkbox" name="agree" required /> <span>I have read this proposal, agree to its scope, pricing and terms, and I am authorised to sign for {who}.</span></label>
                    <input type="hidden" name="content_hash" value={contentHash} />
                    <button type="submit" class="b primary big">Sign proposal</button>
                    <p class="err" id="sign-err" role="alert"></p>
                    <p class="legal">Signing creates a binding electronic signature. We record your name, title, the time, a hash of your IP address, your browser, and a fingerprint of this exact document.</p>
                  </form>
                  <details class="respond">
                    <summary>Request changes or decline</summary>
                    <form id="respond-form">
                      <div class="radios">
                        <label><input type="radio" name="kind" value="changes" checked /> Request changes</label>
                        <label><input type="radio" name="kind" value="decline" /> Decline this proposal</label>
                      </div>
                      <textarea name="message" rows={4} maxlength={3000} placeholder="Tell us what you’d like to change, or why it isn’t right for now." required></textarea>
                      <button type="submit" class="b ghost">Send to Ferrn</button>
                      <p class="err" id="respond-err" role="alert"></p>
                    </form>
                  </details>
                </div>
              ) : preview ? (
                <div class="sign-card preview-sign"><p class="lead">The client signs here: full name, title, a drawn or typed signature and an agreement checkbox.</p></div>
              ) : <p class="muted">Signing is closed for this proposal.</p>}
              <div class="print-sign print-only">
                {status !== 'signed' ? <><div><span>Signature</span></div><div><span>Name and title</span></div><div><span>Date</span></div></> : null}
              </div>
            </div>
          </section>
        </div>
        <footer class="doc-foot"><Logo width={84} /><span>Ferrn Digital Agency · ferrnagency.com · {CONTACT}</span><span>{p.number}</span></footer>
      </main>
    </Shell>
  );
}

/* ── invoice ── */
export type InvoiceViewProps = {
  inv: Record<string, any>; methods: PaymentMethod[]; paystack: boolean; receipts: { filename: string; created_at: string }[];
  flash?: { kind: 'ok' | 'err'; text: string }; proposalUrl?: string | null;
};

const METHOD_FIELDS: Record<string, [string, string][]> = {
  ng_bank: [['bank', 'Bank'], ['account_name', 'Account name'], ['account_number', 'Account number']],
  intl_bank: [['bank', 'Bank'], ['account_name', 'Account name'], ['account_number', 'Account number'], ['iban', 'IBAN'], ['swift', 'SWIFT / BIC'],
    ['sort_code', 'Sort code'], ['routing', 'Routing / ABA'], ['bank_address', 'Bank address'], ['intermediary', 'Intermediary bank']],
  other: [['provider', 'Provider'], ['account', 'Account / tag']],
};

export function InvoiceView({ inv, methods, paystack, receipts, flash, proposalUrl }: InvoiceViewProps) {
  const items = normItems(inv.items_json);
  const cur = inv.currency as string;
  const t = computeTotals(items, inv.discount_pct, inv.vat);
  const remaining = Math.max(0, Math.round((Number(inv.amount_due) - Number(inv.amount_paid)) * 100) / 100);
  const paid = inv.status === 'paid';
  const open = !paid && inv.status !== 'void';
  const kindLine = inv.kind === 'deposit' ? `Deposit (${Number(inv.deposit_pct)}%)` : inv.kind === 'balance' ? 'Balance' : 'Amount invoiced';
  const bank = methods.filter((m) => m.type !== 'paystack');
  return (
    <Shell title={`Invoice ${inv.number} | Ferrn Digital Agency`} bodyClass="doc invoice" data={{ kind: 'invoice', base: `/i/${inv.token}` }}>
      <div class="bar no-print">
        <div class="bar-in">
          <span class="bar-brand"><Logo dark width={96} /></span>
          <span class="bar-doc">Invoice {inv.number}</span> <Pill s={inv.status} />
          <div class="bar-actions">
            {proposalUrl ? <a class="b ghost" href={proposalUrl}>Proposal</a> : null}
            <button type="button" class="b ghost" data-print>Download PDF</button>
            {open ? <a class="b primary" href="#pay">Pay {fmtMoney(remaining, cur)}</a> : null}
          </div>
        </div>
      </div>
      {flash ? <div class={`flash no-print ${flash.kind}`}>{flash.text}</div> : null}
      <main class="paper sheet">
        {paid ? <div class="stamp" aria-label="Paid">Paid</div> : inv.status === 'void' ? <div class="stamp void">Void</div> : null}
        <header class="inv-head">
          <Logo width={150} />
          <div class="inv-title"><h1>Invoice</h1><p>{inv.number}</p><Pill s={inv.status} /></div>
        </header>
        <section class="parties">
          <div><h4>From</h4><p><strong>Ferrn Digital Agency</strong><br />Lagos, Nigeria<br />{CONTACT}<br />ferrnagency.com</p></div>
          <div><h4>Bill to</h4><p><strong>{inv.client_company || inv.client_name}</strong>{inv.client_company && inv.client_name ? <><br />{inv.client_name}</> : null}{inv.client_email ? <><br />{inv.client_email}</> : null}{inv.client_phone ? <><br />{inv.client_phone}</> : null}</p></div>
          <div><h4>Details</h4>
            <dl class="mini">
              <dt>Issued</dt><dd>{fmtDate(inv.issued_at)}</dd>
              <dt>Due</dt><dd>{inv.due_date ? fmtDate(inv.due_date) : 'On receipt'}</dd>
              <dt>Reference</dt><dd>{inv.number}</dd>
            </dl>
          </div>
        </section>
        {inv.title ? <h2 class="inv-sub">{inv.title}</h2> : null}
        <table class="items">
          <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit price</th><th>Billing</th><th class="r">Amount</th></tr></thead>
          <tbody>{items.map((i) => (
            <tr><td>{i.description}</td><td class="c">{i.qty}</td><td class="r">{fmtMoney(i.unit_price, cur)}</td>
              <td><span class={`chip ${i.billing}`}>{BILLING_LABEL[i.billing]}</span></td><td class="r strong">{fmtMoney(t.lineAmount(i), cur)}</td></tr>
          ))}</tbody>
        </table>
        <div class="inv-totals">
          <p class="row"><span>Subtotal (one-off)</span><span>{fmtMoney(t.subtotal, cur)}</span></p>
          {t.discount ? <p class="row"><span>Discount ({Number(inv.discount_pct)}%)</span><span>−{fmtMoney(t.discount, cur)}</span></p> : null}
          {Number(inv.vat) ? <p class="row"><span>VAT (7.5%)</span><span>{fmtMoney(t.tax, cur)}</span></p> : null}
          <p class="row strong"><span>Project total</span><span>{fmtMoney(inv.total, cur)}</span></p>
          {Number(inv.amount_due) !== Number(inv.total) ? <p class="row"><span>{kindLine}, this invoice</span><span>{fmtMoney(inv.amount_due, cur)}</span></p> : null}
          {Number(inv.amount_paid) ? <p class="row"><span>Paid</span><span>−{fmtMoney(inv.amount_paid, cur)}</span></p> : null}
          <p class="row grand"><span>{paid ? 'Balance' : 'Amount due'}</span><span>{fmtMoney(remaining, cur)}</span></p>
          {Object.entries(t.recurring).map(([cycle, r]) => <p class="row fine"><span>Then per {cycleWord(cycle)}, billed separately</span><span>{fmtMoney(r.total, cur)}</span></p>)}
        </div>

        {paid ? (
          <div class="paid-box"><strong>Thank you, this invoice is paid.</strong><span>{inv.paid_at ? `Payment confirmed on ${fmtDate(inv.paid_at)}.` : ''} A receipt is available on request.</span></div>
        ) : inv.status === 'void' ? (
          <div class="notice">This invoice has been cancelled. Nothing is due on it.</div>
        ) : (
          <section class="pay" id="pay">
            <h3>How to pay</h3>
            <p class="muted">Please use <strong>{inv.number}</strong> as your payment reference{inv.due_date ? <> and pay by <strong>{fmtDate(inv.due_date)}</strong></> : null}.</p>
            <div class="pay-grid">
              {paystack ? (
                <div class="pay-card card-pay no-print">
                  <h4>Pay online with Paystack</h4>
                  <p class="muted">Card, bank transfer or USSD. You’ll get an instant confirmation.</p>
                  <form method="post" action={`/i/${inv.token}/pay`} class="paystack-form">
                    <label>Email for your receipt<input type="email" name="email" required value={inv.client_email ?? ''} /></label>
                    <button type="submit" class="b primary big">Pay {fmtMoney(remaining, cur)} securely</button>
                  </form>
                </div>
              ) : null}
              {bank.map((m) => {
                const d = parseJson<Record<string, string>>(m.details_json, {});
                return (
                  <div class="pay-card">
                    <h4>{m.label}</h4>
                    <p class="cur">{m.type === 'ng_bank' ? 'Nigerian bank transfer' : m.type === 'intl_bank' ? 'International transfer' : 'Other'} · {methodCurrencies(m).join(', ')}</p>
                    <dl class="acct">
                      {(METHOD_FIELDS[m.type] ?? []).filter(([k]) => d[k]).map(([k, label]) => (
                        <><dt>{label}</dt><dd><span>{d[k]}</span>{['account_number', 'iban', 'swift', 'sort_code', 'routing', 'account'].includes(k) ? <button type="button" class="copy no-print" data-copy={d[k]}>Copy</button> : null}</dd></>
                      ))}
                    </dl>
                    {d.instructions ? <p class="instr">{d.instructions}</p> : null}
                    {d.reference_note ? <p class="instr">{d.reference_note}</p> : null}
                  </div>
                );
              })}
              {!paystack && !bank.length ? <div class="pay-card"><h4>Payment details</h4><p class="muted">We’ll send payment details by email. Questions: {CONTACT}</p></div> : null}
            </div>
          </section>
        )}

        {open ? (
          <section class="receipt no-print" id="receipt">
            <h3>Paid by transfer? Upload your receipt</h3>
            <p class="muted">Images or PDF, up to 10 MB each. We confirm within one working day.</p>
            <form id="receipt-form" method="post" action={`/i/${inv.token}/receipts`} enctype="multipart/form-data">
              <label class="drop">
                <input type="file" name="files" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf" multiple required />
                <span class="drop-text"><strong>Choose files</strong> or drop them here</span>
                <span class="drop-files" id="drop-files"></span>
              </label>
              <textarea name="note" rows={2} maxlength={1000} placeholder="Optional note, e.g. paid from GTBank, sender name Ada Obi"></textarea>
              <button type="submit" class="b primary">Upload receipt</button>
              <p class="err" id="receipt-err" role="alert"></p>
            </form>
          </section>
        ) : null}
        {receipts.length ? (
          <section class="receipts-list">
            <h4>Receipts received</h4>
            <ul>{receipts.map((r) => <li><span>{r.filename}</span><span class="muted">{fmtDate(r.created_at, true)}</span></li>)}</ul>
          </section>
        ) : null}
        <footer class="doc-foot"><span>Thank you for your business.</span><span>Ferrn Digital Agency · ferrnagency.com</span><span>{inv.number}</span></footer>
      </main>
    </Shell>
  );
}

/** For Studio's live preview (keeps routes/proposals.ts free of JSX). */
export const proposalPreview = (props: Omit<ProposalViewProps, 'preview'>) => <ProposalView {...props} preview />;
