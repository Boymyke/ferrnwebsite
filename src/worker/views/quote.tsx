import { raw } from 'hono/html';

export type QuoteItem = { description: string; qty: number; unit_price: number; recurring?: 'once' | 'monthly' | 'termly' | 'yearly' };
export type QuoteRow = {
  number: string; title: string | null; client_name: string | null; client_company: string | null; client_email: string | null;
  currency: string; items_json: string; discount_pct: number; tax_pct: number; notes: string | null; terms: string | null;
  valid_until: string | null; status: string; share_key: string; created_at: string;
};

export function quoteTotals(items: QuoteItem[], discountPct: number, taxPct: number) {
  const once = items.filter((i) => !i.recurring || i.recurring === 'once');
  const recurring = items.filter((i) => i.recurring && i.recurring !== 'once');
  const sum = (xs: QuoteItem[]) => xs.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const subtotal = sum(once);
  const discount = Math.round(subtotal * (discountPct / 100));
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * (taxPct / 100));
  const recurringByCycle: Record<string, number> = {};
  for (const i of recurring) recurringByCycle[i.recurring!] = (recurringByCycle[i.recurring!] ?? 0) + (Number(i.qty) || 0) * (Number(i.unit_price) || 0);
  return { subtotal, discount, tax, total: taxable + tax, recurringByCycle };
}

const fmt = (n: number, cur: string) =>
  cur === 'USD' ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : cur === 'GBP' ? `£${n.toLocaleString('en-GB')}` : `₦${n.toLocaleString('en-NG')}`;

export function QuoteDocument({ q }: { q: QuoteRow }) {
  const items: QuoteItem[] = JSON.parse(q.items_json || '[]');
  const tot = quoteTotals(items, q.discount_pct, q.tax_pct);
  const accepted = q.status === 'accepted';
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="noindex,nofollow" />
        <title>Quote {q.number} | Ferrn Digital Agency</title>
        <link rel="icon" href="/icons/favicon-32.png" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href="/assets/quote.css" />
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Download PDF / Print</button>{!accepted ? <button class="primary" data-accept>Accept quote</button> : <span class="ok">✓ Accepted</span>}</div>
        <article class="sheet">
          <header>
            <img src="/brand/ferrn-logo-on-light.svg" alt="Ferrn" width="150" />
            <div class="meta"><h1>Quote</h1><p>{q.number}</p><p>Issued {q.created_at.slice(0, 10)}</p>{q.valid_until ? <p>Valid until {q.valid_until}</p> : null}</div>
          </header>
          <section class="parties">
            <div><h4>From</h4><p><strong>Ferrn Digital Agency</strong><br />info@ferrnagency.com<br />ferrnagency.com</p></div>
            <div><h4>Prepared for</h4><p><strong>{q.client_company || q.client_name}</strong><br />{q.client_company ? q.client_name : ''}<br />{q.client_email}</p></div>
          </section>
          {q.title ? <h2>{q.title}</h2> : null}
          <table>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Billing</th><th class="r">Amount</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr><td>{i.description}</td><td>{i.qty}</td><td>{fmt(Number(i.unit_price), q.currency)}</td><td>{i.recurring && i.recurring !== 'once' ? i.recurring : 'one-off'}</td><td class="r">{fmt(i.qty * i.unit_price, q.currency)}</td></tr>
              ))}
            </tbody>
          </table>
          <div class="totals">
            <p><span>One-off subtotal</span><span>{fmt(tot.subtotal, q.currency)}</span></p>
            {tot.discount ? <p><span>Discount ({q.discount_pct}%)</span><span>−{fmt(tot.discount, q.currency)}</span></p> : null}
            {q.tax_pct ? <p><span>VAT ({q.tax_pct}%)</span><span>{fmt(tot.tax, q.currency)}</span></p> : null}
            <p class="grand"><span>Due to start</span><span>{fmt(tot.total, q.currency)}</span></p>
            {Object.entries(tot.recurringByCycle).map(([cycle, amt]) => <p class="rec"><span>Then {cycle}</span><span>{fmt(amt, q.currency)}</span></p>)}
          </div>
          {q.notes ? <section><h4>Notes</h4><p class="pre">{q.notes}</p></section> : null}
          <section><h4>Terms</h4><p class="pre">{q.terms || 'Payment: 60% to start, 40% on launch. Managed plans are billed in advance; 12-month minimum, then monthly. Your content, domain and data remain yours. Prices exclude third-party fees (domains, SMS/WhatsApp usage) unless listed.'}</p></section>
          <footer>Ferrn Digital Agency · We build what’s next.</footer>
        </article>
        {raw(`<script>document.querySelector('[data-accept]')?.addEventListener('click',async e=>{const b=e.currentTarget;const name=prompt('Type your full name to accept this quote');if(!name)return;b.disabled=true;const r=await fetch('/api/quotes/${q.share_key}/accept',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});if(r.ok){b.outerHTML='<span class="ok">✓ Accepted. Thank you, we will be in touch today.</span>'}else{b.disabled=false;alert('Could not accept right now. Please reply to our email.')}});</script>`)}
      </body>
    </html>
  );
}
