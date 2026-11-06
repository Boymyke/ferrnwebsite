import React, { useEffect, useMemo, useState } from 'react';
import { api, can, create, fmtDate, list, money, remove, update } from '../api';
import { Card, copy, EditedBy, Empty, ErrorNote, History, Loading, Page, Status, Tabs, useData, useRoute, useToast, useUser, Pager, usePaged } from '../ui';
import { ArrowLeft, FileText, ListChecks, Plus, Receipt, Trash2 } from 'lucide-react';

type Item = { description: string; qty: number; unit_price: number; recurring: 'once' | 'monthly' | 'termly' | 'yearly' };

export function Quotes() {
  const { path, go } = useRoute();
  const { data, loading, error, reload } = useData(() => list('quotes'));
  const toast = useToast();
  const user = useUser();
  const id = path.match(/^\/quotes\/([^/?]+)/)?.[1];
  const pg = usePaged<any>(data, 'quotes');
  const del = async (q: any) => {
    if (!confirm(`Delete quote ${q.number}${q.client_company || q.client_name ? ` for ${q.client_company || q.client_name}` : ''}? Its share link stops working. This can’t be undone.`)) return;
    try { await remove('quotes', q.id); toast('Quote deleted'); reload(); } catch (x: any) { toast(x.message, 'err'); }
  };
  if (id) return <QuoteEditor id={id === 'new' ? null : id} onDone={() => { reload(); go('/quotes'); }} />;
  return (
    <Page title="Quotes" sub="Draft, share and track quotes. Clients open a branded link, download a PDF and accept online." actions={<button className="btn primary" onClick={() => go('/quotes/new')}><Plus size={14} strokeWidth={2.2} />New quote</button>}>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !data?.length ? <Empty icon={Receipt} title="No quotes yet">Create one from a lead, a meeting, or here.</Empty> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>Number</th><th>Client</th><th>Title</th><th>Total (one-off)</th><th>Status</th><th>Created</th><th>By</th><th aria-label="Actions" /></tr></thead>
          <tbody>{pg.rows.map((q: any) => (
            <tr key={q.id} onClick={() => go(`/quotes/${q.id}`)}>
              <td><strong>{q.number}</strong></td><td>{q.client_company || q.client_name}</td><td>{q.title}</td>
              <td>{money(q.total, q.currency)}</td><td><Status s={q.status} /></td><td className="muted">{fmtDate(q.created_at)}</td><td className="muted">{q.updated_by || q.created_by}</td>
              <td className="cell-act">{can(user, 'editor') ? <button className="icon" title="Delete quote" aria-label={`Delete ${q.number}`} onClick={(e) => { e.stopPropagation(); del(q); }}><Trash2 size={15} strokeWidth={1.9} /></button> : null}</td>
            </tr>
          ))}</tbody>
        </table><Pager pg={pg} noun="quotes" /></div>
      )}
    </Page>
  );
}

const TEMPLATES: Record<string, Item[]> = {
  'Clinic Front Desk': [
    { description: 'Clinic Front Desk — setup: website, booking system, WhatsApp reminders, AI assistant training', qty: 1, unit_price: 650000, recurring: 'once' },
    { description: 'Managed plan: hosting, updates, backups, support (per month)', qty: 1, unit_price: 85000, recurring: 'monthly' },
  ],
  'School Admissions Portal': [
    { description: 'School Admissions Portal — setup: website, online applications, exam booking, parent portal', qty: 1, unit_price: 750000, recurring: 'once' },
    { description: 'Managed plan (per term)', qty: 1, unit_price: 250000, recurring: 'termly' },
  ],
  'Logistics Quote & Track': [
    { description: 'Logistics Quote & Track — setup: website, quote form, shipment board, tracking page', qty: 1, unit_price: 900000, recurring: 'once' },
    { description: 'Managed plan (per month)', qty: 1, unit_price: 120000, recurring: 'monthly' },
  ],
  'Custom website': [
    { description: 'Discovery, sitemap and copy direction', qty: 1, unit_price: 150000, recurring: 'once' },
    { description: 'UI design (up to 6 pages)', qty: 1, unit_price: 350000, recurring: 'once' },
    { description: 'Development, CMS and SEO setup', qty: 1, unit_price: 450000, recurring: 'once' },
    { description: 'Care plan: hosting, updates and small edits (per month)', qty: 1, unit_price: 45000, recurring: 'monthly' },
  ],
};

function totals(items: Item[], disc: number, tax: number) {
  const once = items.filter((i) => i.recurring === 'once').reduce((a, i) => a + i.qty * i.unit_price, 0);
  const d = Math.round(once * disc / 100), t = Math.round((once - d) * tax / 100);
  const rec: Record<string, number> = {};
  for (const i of items) if (i.recurring !== 'once') rec[i.recurring] = (rec[i.recurring] ?? 0) + i.qty * i.unit_price;
  return { once, d, t, total: once - d + t, rec };
}

function QuoteEditor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const toast = useToast();
  const user = useUser();
  const { go } = useRoute();
  const leadParam = new URLSearchParams(location.search).get('lead');
  const { data: existing } = useData(() => (id ? api(`/r/quotes/${id}`).then((r) => r.row) : Promise.resolve(null)), [id]);
  const { data: lead } = useData(() => (leadParam ? api(`/r/leads/${leadParam}`).then((r) => r.row) : Promise.resolve(null)), [leadParam]);
  const [q, setQ] = useState<any>(null);
  const [brief, setBrief] = useState('');
  const [tab, setTab] = useState('edit');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id && existing) setQ({ ...existing, items: JSON.parse(existing.items_json || '[]') });
    if (!id && !q) {
      const valid = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      setQ({ currency: 'NGN', discount_pct: 0, tax_pct: 7.5, valid_until: valid, status: 'draft', items: [], lead_id: leadParam ?? null,
        client_company: lead?.company ?? '', client_name: lead?.contact_name ?? '', client_email: lead?.email ?? '', title: lead ? `Proposal for ${lead.company}` : '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, lead]);
  const tt = useMemo(() => (q ? totals(q.items, Number(q.discount_pct) || 0, Number(q.tax_pct) || 0) : null), [q]);
  if (!q) return <Loading />;
  const set = (k: string, v: any) => setQ({ ...q, [k]: v });
  const setItem = (i: number, k: keyof Item, v: any) => set('items', q.items.map((it: Item, j: number) => (j === i ? { ...it, [k]: k === 'qty' || k === 'unit_price' ? Number(v) : v } : it)));
  const save = async (extra: Record<string, unknown> = {}) => {
    const body = { lead_id: q.lead_id, client_name: q.client_name, client_company: q.client_company, client_email: q.client_email, title: q.title,
      currency: q.currency, items_json: JSON.stringify(q.items), discount_pct: Number(q.discount_pct) || 0, tax_pct: Number(q.tax_pct) || 0,
      notes: q.notes, terms: q.terms, valid_until: q.valid_until, status: q.status, ...extra };
    const row = id ? await update('quotes', id, body) : await create('quotes', body);
    setQ({ ...row, items: JSON.parse(row.items_json || '[]') });
    if (!id) go(`/quotes/${row.id}`);
    return row;
  };
  const shareUrl = q.share_key ? `${location.origin}/q/${q.share_key}` : '';
  return (
    <Page title={id ? `Quote ${q.number}` : 'New quote'} sub={<><Status s={q.status} /> <EditedBy row={q} /></>}
      actions={<>
        <button className="btn ghost" onClick={onDone}><ArrowLeft size={15} strokeWidth={2} />Quotes</button>
        {shareUrl ? <a className="btn ghost" href={shareUrl} target="_blank" rel="noreferrer"><FileText size={15} strokeWidth={2} />Open / PDF</a> : null}
        {shareUrl ? <button className="btn ghost" onClick={() => copy(shareUrl, toast, 'Share link copied')}>Copy link</button> : null}
        {id && can(user, 'editor') ? <button className="btn ghost danger" disabled={busy} onClick={async () => {
          if (!confirm(`Delete quote ${q.number || ''}? Its share link stops working. This can’t be undone.`)) return;
          try { await remove('quotes', id); toast('Quote deleted'); onDone(); } catch (x: any) { toast(x.message, 'err'); }
        }}><Trash2 size={15} strokeWidth={2} />Delete</button> : null}
        <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { await save(); toast('Saved'); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } }}>Save</button>
      </>}>
      {id ? <Tabs tabs={[['edit', 'Quote'], ['history', 'History']]} value={tab} onChange={setTab} /> : null}
      {tab === 'history' && id ? <Card><History entity="quotes" id={id} /></Card> : (
        <div className="quote-layout">
          <div>
            <Card title="Client">
              <div className="fields">
                <label className="field"><span>Company</span><input value={q.client_company ?? ''} onChange={(e) => set('client_company', e.target.value)} /></label>
                <label className="field"><span>Contact name</span><input value={q.client_name ?? ''} onChange={(e) => set('client_name', e.target.value)} /></label>
                <label className="field"><span>Email</span><input type="email" value={q.client_email ?? ''} onChange={(e) => set('client_email', e.target.value)} /></label>
                <label className="field"><span>Quote title</span><input value={q.title ?? ''} onChange={(e) => set('title', e.target.value)} /></label>
              </div>
            </Card>
            <Card title="Line items" actions={<>
              <select onChange={(e) => { if (e.target.value) set('items', [...q.items, ...TEMPLATES[e.target.value]]); e.target.value = ''; }}>
                <option value="">Add from a template…</option>{Object.keys(TEMPLATES).map((t) => <option key={t}>{t}</option>)}
              </select>
              <button className="btn sm ghost" onClick={() => set('items', [...q.items, { description: '', qty: 1, unit_price: 0, recurring: 'once' }])}><Plus size={14} strokeWidth={2.2} />Line</button>
            </>}>
              {q.items.length ? (
                <table className="table items">
                  <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Billing</th><th>Amount</th><th></th></tr></thead>
                  <tbody>{q.items.map((it: Item, i: number) => (
                    <tr key={i}>
                      <td><textarea rows={2} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} /></td>
                      <td><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                      <td><input type="number" min={0} value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} /></td>
                      <td><select value={it.recurring} onChange={(e) => setItem(i, 'recurring', e.target.value)}><option value="once">One-off</option><option value="monthly">Monthly</option><option value="termly">Per term</option><option value="yearly">Yearly</option></select></td>
                      <td className="nowrap">{money(it.qty * it.unit_price, q.currency)}</td>
                      <td><button className="icon" onClick={() => set('items', q.items.filter((_: Item, j: number) => j !== i))} aria-label="Remove line"><Trash2 size={15} strokeWidth={1.9} /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <Empty compact icon={ListChecks} title="No items yet">Use a template, add lines, or let AI draft them from your call notes.</Empty>}
            </Card>
            <Card title="AI draft from call notes" actions={<button className="btn sm" disabled={busy || !brief} onClick={async () => {
              setBusy(true);
              try {
                const r = await api('/quotes/ai-draft', { body: { brief, currency: q.currency, lead_id: q.lead_id } });
                const items = (r.draft.items ?? []).map((x: any) => ({ description: x.description, qty: Number(x.qty) || 1, unit_price: Number(x.unit_price) || 0, recurring: x.recurring || 'once' }));
                setQ({ ...q, items: [...q.items, ...items], title: q.title || r.draft.title, notes: q.notes || r.draft.notes });
                toast(`${items.length} lines drafted — review before sending`);
              } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
            }}>Draft lines</button>}>
              <textarea rows={4} placeholder="e.g. 2-branch hospital in Lekki, wants online booking, WhatsApp reminders, doctor directory; budget around ₦2m; go live before January." value={brief} onChange={(e) => setBrief(e.target.value)} />
            </Card>
            <Card title="Notes & terms">
              <div className="fields">
                <label className="field wide"><span>Notes to client</span><textarea rows={4} value={q.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
                <label className="field wide"><span>Terms (blank = standard Ferrn terms)</span><textarea rows={4} value={q.terms ?? ''} onChange={(e) => set('terms', e.target.value)} /></label>
              </div>
            </Card>
          </div>
          <aside className="quote-side">
            <Card title="Summary">
              <div className="fields">
                <label className="field"><span>Currency</span><select value={q.currency} onChange={(e) => set('currency', e.target.value)}><option>NGN</option><option>USD</option><option>GBP</option></select></label>
                <label className="field"><span>Valid until</span><input type="date" value={q.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value)} /></label>
                <label className="field"><span>Discount %</span><input type="number" value={q.discount_pct} onChange={(e) => set('discount_pct', e.target.value)} /></label>
                <label className="field"><span>VAT %</span><input type="number" value={q.tax_pct} onChange={(e) => set('tax_pct', e.target.value)} /></label>
                <label className="field wide"><span>Status</span><select value={q.status} onChange={(e) => set('status', e.target.value)}>{['draft', 'sent', 'accepted', 'declined', 'expired'].map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
              {tt ? (
                <dl className="totals">
                  <dt>One-off subtotal</dt><dd>{money(tt.once, q.currency)}</dd>
                  {tt.d ? <><dt>Discount</dt><dd>−{money(tt.d, q.currency)}</dd></> : null}
                  <dt>VAT</dt><dd>{money(tt.t, q.currency)}</dd>
                  <dt className="grand">Due to start</dt><dd className="grand">{money(tt.total, q.currency)}</dd>
                  {Object.entries(tt.rec).map(([k, v]) => <React.Fragment key={k}><dt>Then {k}</dt><dd>{money(v, q.currency)}</dd></React.Fragment>)}
                </dl>
              ) : null}
              {id ? <button className="btn primary block" onClick={async () => {
                try {
                  await save({ status: 'sent' });
                  if (q.lead_id) await update('leads', q.lead_id, { status: 'Proposal sent', next_action: `Quote ${q.number} sent — follow up in 3 days` }).catch(() => null);
                  copy(shareUrl, toast, 'Marked as sent · link copied — paste it into your email or WhatsApp');
                } catch (x: any) { toast(x.message, 'err'); }
              }}>Mark as sent & copy link</button> : <p className="muted small">Save to get a shareable link.</p>}
            </Card>
          </aside>
        </div>
      )}
    </Page>
  );
}
