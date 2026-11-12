import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Ban, Banknote, Bell, CircleCheck, Copy, CreditCard, ExternalLink, Eye, FileSignature, FileText, Globe, Hourglass,
  Image as ImageIcon, KeyRound, Landmark, Lock, LockOpen, Mail, MessageCircle, Monitor, Pencil, Plus, Receipt, RefreshCw, Save, Send, ShieldCheck,
  Smartphone, Sparkles, Trash2, Wallet, X, MailOpen, MousePointerClick, AlertTriangle,
} from 'lucide-react';
import { ago, api, can, fmtDate, list, money } from '../api';
import { fromZip, normalise, findEntry, type Picked } from './demos';
import { Badge, Card, copy, Drawer, Empty, ErrorNote, History, Loading, Page, Tabs, useData, useRoute, useToast, useUser, waLink, Pager, usePaged } from '../ui';

/* ── types & maths (mirrors src/worker/lib/docs.ts) ── */
type Billing = 'once' | 'monthly' | 'termly' | 'yearly';
type Item = { description: string; qty: number; unit_price: number; billing: Billing };
type Section = { heading: string; body: string };
type Draft = {
  lead_id: string | null; client_name: string; client_company: string; client_email: string; client_phone: string;
  title: string; summary: string; sections: Section[]; items: Item[]; currency: 'NGN' | 'USD' | 'GBP';
  discount_pct: number | string; vat: boolean; deposit_pct: number | string; invoice_on_sign: 'deposit' | 'full'; valid_until: string; status: string;
};
const VAT = 7.5;
const CYCLE: Record<string, string> = { monthly: 'month', termly: 'term', yearly: 'year' };
const r2 = (n: number) => Math.round(n * 100) / 100;
function totals(items: Item[], disc: number, vat: boolean) {
  const once = r2(items.filter((i) => i.billing === 'once').reduce((a, i) => a + i.qty * i.unit_price, 0));
  const d = r2(once * Math.min(100, Math.max(0, disc)) / 100);
  const t = vat ? r2((once - d) * VAT / 100) : 0;
  const total = r2(once - d + t);
  const rec: Record<string, number> = {};
  for (const i of items) if (i.billing !== 'once') rec[i.billing] = r2((rec[i.billing] ?? 0) + i.qty * i.unit_price);
  for (const k of Object.keys(rec)) rec[k] = vat ? r2(rec[k] * (1 + VAT / 100)) : rec[k];
  const start = total > 0 ? total : r2(Object.values(rec).reduce((a, x) => a + x, 0));
  return { once, d, t, total, rec, start };
}

const TONE: Record<string, string> = {
  draft: 'default', sent: 'blue', viewed: 'purple', signed: 'green', declined: 'red', expired: 'red',
  unpaid: 'orange', receipt_submitted: 'blue', part_paid: 'purple', paid: 'green', void: 'red',
};
const LABEL: Record<string, string> = { receipt_submitted: 'receipt submitted', part_paid: 'part paid' };
const DocStatus = ({ s }: { s?: string | null }) => (s ? <Badge tone={TONE[s] ?? 'default'}>{LABEL[s] ?? s}</Badge> : null);
const I = { size: 16, strokeWidth: 1.9 } as const;
/** Client pages live on the same host as Studio, so links use this tab's origin (matters on preview and local hosts). */
const here = (u?: string) => { try { return location.origin + new URL(String(u)).pathname; } catch { return u ?? ''; } };

const DEFAULT_SECTIONS: Section[] = [
  { heading: 'Overview', body: 'What you told us, what we heard, and the outcome this project is built to deliver.' },
  { heading: 'Scope of work', body: '- Discovery and sitemap\n- Design\n- Build and launch\n- Training and handover' },
  { heading: 'Timeline', body: '**Week 1:** discovery and content plan\n**Weeks 2–3:** design and build\n**Week 4:** testing, training and launch' },
  { heading: 'What we need from you', body: '- A main point of contact who can approve work\n- Logo, photos and any existing content\n- Access to your domain and any accounts we will connect' },
  { heading: 'Terms', body: 'Work starts when the deposit is received. The balance is due at launch. Managed plans are billed in advance. Your content, domain and data remain yours. Prices exclude third-party fees (domains, SMS or WhatsApp usage) unless listed.' },
];

/* ══════════════ page ══════════════ */
export function Proposals() {
  const { path, go } = useRoute();
  const [p, qs] = path.split('?');
  const id = p.match(/^\/proposals\/([^/]+)/)?.[1];
  if (id === 'new-link') return <LinkProposalEditor key="new-link" id={null} />;
  if (id) return <ProposalEditor key={id} id={id === 'new' ? null : id} />;
  const tab = new URLSearchParams(qs ?? '').get('tab') ?? 'proposals';
  return (
    <Page title="Proposals" sub="Build a proposal here with e-signature and invoicing, or add a link to a proposal page made elsewhere. Opens are tracked either way."
      actions={tab === 'proposals' ? <>
        <button className="btn" title="Paste a working link, or upload a proposal page built elsewhere" onClick={() => go('/proposals/new-link')}><Globe {...I} />Add proposal link</button>
        <button className="btn primary" title="Write the proposal here, with e-signature and invoicing" onClick={() => go('/proposals/new')}><Plus {...I} />Build proposal</button>
      </> : null}>
      <Tabs tabs={[['proposals', 'Proposals'], ['invoices', 'Invoices'], ['methods', 'Payment methods']]} value={tab}
        onChange={(t) => go(t === 'proposals' ? '/proposals' : `/proposals?tab=${t}`)} />
      {tab === 'invoices' ? <InvoicesTab /> : tab === 'methods' ? <MethodsTab /> : <ProposalList />}
    </Page>
  );
}

function ProposalList() {
  const { go } = useRoute();
  const toast = useToast();
  const user = useUser();
  const { data, loading, error, reload } = useData(() => api<{ rows: any[] }>('/proposals').then((r) => r.rows));
  const del = async (r: any) => {
    const msg = r.status === 'signed' ? `${r.number} is signed. Delete it anyway? Its invoices stay in the Invoices tab. This can’t be undone.` : `Delete ${r.number}${r.title ? ` (${r.title})` : ''}? This can’t be undone.`;
    if (!confirm(msg)) return;
    try { await api(`/proposals/${r.id}`, { method: 'DELETE' }); toast('Proposal deleted'); reload(); } catch (x: any) { toast(x.message, 'err'); }
  };
  const pg = usePaged<any>(data, 'proposals');
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const rows = data ?? [];
  const month = new Date().toISOString().slice(0, 7);
  const awaiting = rows.filter((r) => ['sent', 'viewed'].includes(r.status));
  const signed = rows.filter((r) => r.status === 'signed' && String(r.signed_at ?? '').startsWith(month));
  const sum = (xs: any[]) => xs.filter((x) => x.currency === 'NGN').reduce((a, x) => a + Number(x.total || 0), 0);
  return (
    <>
      <div className="kpi-row">
        <div className="kpi feature">
          <div className="kpi-icon"><FileSignature size={24} /></div>
          <div><h4>Awaiting signature</h4><p className="muted">{awaiting.length} proposal{awaiting.length === 1 ? '' : 's'} out with clients</p></div>
          <strong>{money(sum(awaiting), 'NGN')}</strong>
        </div>
        <div className="kpi"><h4>Signed this month</h4><strong>{signed.length}</strong><span className="muted">{money(sum(signed), 'NGN')}</span></div>
        <div className="kpi"><h4>Opened by clients</h4><strong>{rows.filter((r) => r.first_viewed_at).length}</strong><span className="muted">{rows.reduce((a, r) => a + Number(r.view_count || 0), 0)} views in total</span></div>
        <div className="kpi"><h4>Drafts</h4><strong>{rows.filter((r) => r.status === 'draft').length}</strong><span className="muted">not yet sent</span></div>
      </div>
      {!rows.length ? <Card><Empty title="No proposals yet">Start from a lead or write one from your call notes with AI.<button className="btn sm primary" onClick={() => go('/proposals/new')}><Plus {...I} />New proposal</button></Empty></Card> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>Number</th><th>Client</th><th>Title</th><th>Value</th><th>Status</th><th>Views</th><th>Updated</th><th aria-label="Actions" /></tr></thead>
          <tbody>{pg.rows.map((r) => (
            <tr key={r.id} onClick={() => go(`/proposals/${r.id}`)} className={r.revoked ? 'dim' : ''}>
              <td><strong>{r.number}</strong></td>
              <td>{r.client_company || r.client_name || <span className="muted">—</span>}{r.client_company && r.client_name ? <div className="muted small">{r.client_name}</div> : null}</td>
              <td>{r.title || <span className="muted">Untitled</span>}{r.kind === 'link' ? <> <Badge tone="blue">{r.page_slug ? 'hosted page' : 'link'}</Badge></> : null}</td>
              <td className="nowrap">{money(r.total, r.currency)}</td>
              <td><DocStatus s={r.status} />{r.revoked ? <Badge tone="red">link off</Badge> : null}</td>
              <td className="muted nowrap">{r.view_count ? <><Eye size={13} /> {r.view_count} · {ago(r.last_viewed_at)}</> : '—'}</td>
              <td className="muted nowrap">{ago(r.updated_at || r.created_at)}<div className="small">{r.updated_by}</div></td>
              <td className="cell-act">{can(user, r.status === 'signed' ? 'admin' : 'editor') ? <button className="icon" title="Delete proposal" aria-label={`Delete ${r.number}`} onClick={(e) => { e.stopPropagation(); del(r); }}><Trash2 {...I} /></button> : null}</td>
            </tr>
          ))}</tbody>
        </table><Pager pg={pg} noun="proposals" /></div>
      )}
    </>
  );
}

/* ══════════════ editor ══════════════ */
const toDraft = (r: any): Draft => ({
  lead_id: r.lead_id ?? null, client_name: r.client_name ?? '', client_company: r.client_company ?? '', client_email: r.client_email ?? '', client_phone: r.client_phone ?? '',
  title: r.title ?? '', summary: r.summary ?? '', sections: JSON.parse(r.sections_json || '[]'), items: JSON.parse(r.items_json || '[]').map((i: any) => ({ ...i, billing: i.billing ?? i.recurring ?? 'once' })),
  currency: r.currency ?? 'NGN', discount_pct: r.discount_pct ?? 0, vat: !!Number(r.vat ?? 1), deposit_pct: r.deposit_pct ?? 60,
  invoice_on_sign: r.invoice_on_sign ?? 'deposit', valid_until: r.valid_until ?? '', status: r.status ?? 'draft',
});
const toBody = (d: Draft) => ({ ...d, discount_pct: Number(d.discount_pct) || 0, deposit_pct: Number(d.deposit_pct) || 0, vat: d.vat ? 1 : 0 });

function ProposalEditor({ id }: { id: string | null }) {
  const toast = useToast();
  const { go } = useRoute();
  const user = useUser();
  const writable = can(user, 'sales');
  const leadParam = new URLSearchParams(location.search).get('lead');
  const { data, error, reload } = useData(() => (id ? api(`/proposals/${id}`) : Promise.resolve(null)), [id]);
  const { data: cfg } = useData(() => api('/proposals/config'));
  const [d, setD] = useState<Draft | null>(null);
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState('edit');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [share, setShare] = useState<null | 'send' | { code: string; url: string; emailed?: boolean; emailError?: string; to?: string }>(null);

  useEffect(() => {
    if (id && data?.row) { const x = toDraft(data.row); setD(x); setSaved(JSON.stringify(x)); }
    if (!id && !d) {
      const fresh: Draft = { lead_id: leadParam, client_name: '', client_company: '', client_email: '', client_phone: '', title: '', summary: '',
        sections: DEFAULT_SECTIONS, items: [], currency: 'NGN', discount_pct: 0, vat: true, deposit_pct: 60, invoice_on_sign: 'deposit',
        valid_until: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), status: 'draft' };
      setD(fresh);
      if (leadParam) api(`/r/leads/${leadParam}`).then((r) => setD((x) => x && ({ ...x, client_company: r.row.company ?? '', client_name: r.row.contact_name ?? '', client_email: r.row.email ?? '', client_phone: r.row.phone ?? '', title: x.title || `Proposal for ${r.row.company}` }))).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const tt = useMemo(() => (d ? totals(d.items, Number(d.discount_pct) || 0, d.vat) : null), [d]);
  if (error) return <ErrorNote error={error} />;
  if (id && data?.row?.kind === 'link') return <LinkProposalEditor id={id} loaded={data} reload={reload} />;
  if (!d || !tt) return <Loading />;

  const row = data?.row;
  const locked = row?.status === 'signed' || !writable;
  const dirty = JSON.stringify(d) !== saved;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const setItem = (i: number, k: keyof Item, v: any) => set('items', d.items.map((it, j) => (j === i ? { ...it, [k]: k === 'qty' || k === 'unit_price' ? Number(v) : v } : it)));
  const setSec = (i: number, k: keyof Section, v: string) => set('sections', d.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const moveSec = (i: number, dir: -1 | 1) => { const xs = [...d.sections]; const j = i + dir; if (j < 0 || j >= xs.length) return; [xs[i], xs[j]] = [xs[j], xs[i]]; set('sections', xs); };

  const save = async (quiet = false) => {
    const body = toBody(d);
    const r = id ? await api(`/proposals/${id}`, { method: 'PATCH', body }) : await api('/proposals', { body });
    setSaved(JSON.stringify(d));
    if (!id) { go(`/proposals/${r.row.id}`); return r.row; }
    if (!quiet) toast('Saved');
    reload();
    return r.row;
  };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } };
  const deposit = d.invoice_on_sign === 'full' ? tt.start : r2(tt.start * (Number(d.deposit_pct) || 0) / 100);

  return (
    <Page title={id ? `${row?.number ?? ''} ${d.title ? '· ' + d.title : ''}` : 'New proposal'}
      sub={<><DocStatus s={row?.status ?? 'draft'} />{row?.revoked ? <Badge tone="red">link switched off</Badge> : null}
        {dirty && !locked ? <span className="muted small"> · unsaved changes</span> : row?.updated_by ? <span className="muted small"> · edited by {row.updated_by} {ago(row.updated_at)}</span> : null}</>}
      actions={<>
        <button className="btn ghost" onClick={() => go('/proposals')}><ArrowLeft {...I} />Proposals</button>
        {!locked ? <button className="btn primary" disabled={busy || (!dirty && !!id)} onClick={() => run(() => save())}><Save {...I} />Save</button> : null}
      </>}>
      <Tabs tabs={[['edit', 'Edit'], ['preview', 'Live preview'], ...(id ? [['timeline', 'Timeline'], ['history', 'History']] as [string, string][] : [])]} value={tab} onChange={setTab} />

      {tab === 'preview' ? <FullPreview draft={d} id={id} /> : tab === 'timeline' && id ? <Timeline events={data?.events ?? []} /> : tab === 'history' && id ? <Card><History entity="proposals" id={id} /></Card> : (
        <div className="pp-layout">
          <div>
            {locked && row?.status === 'signed' ? <div className="pp-note"><ShieldCheck {...I} /> Signed proposals are locked so the signed version stays exactly as the client saw it.</div> : null}
            <fieldset disabled={locked} className="pp-fieldset">
              <Card title="Client">
                <LeadPicker value={d.lead_id} onPick={(l) => setD({
                  ...d, lead_id: l?.id ?? null,
                  ...(l ? { client_company: d.client_company || l.company || '', client_name: d.client_name || l.contact_name || '', client_email: d.client_email || l.email || '', client_phone: d.client_phone || l.phone || '', title: d.title || `Proposal for ${l.company}` } : {}),
                })} />
                <div className="fields">
                  <label className="field"><span>Company</span><input value={d.client_company} onChange={(e) => set('client_company', e.target.value)} /></label>
                  <label className="field"><span>Contact name</span><input value={d.client_name} onChange={(e) => set('client_name', e.target.value)} /></label>
                  <label className="field"><span>Email</span><input type="email" value={d.client_email} onChange={(e) => set('client_email', e.target.value)} /></label>
                  <label className="field"><span>Phone (for WhatsApp)</span><input value={d.client_phone} onChange={(e) => set('client_phone', e.target.value)} placeholder="0803 000 0000" /></label>
                </div>
              </Card>
              <Card title="Cover">
                <div className="fields">
                  <label className="field wide"><span>Title</span><input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. A booking website and WhatsApp assistant for Lekki Dental" /></label>
                  <label className="field wide"><span>Cover summary</span><textarea rows={3} value={d.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Two or three sentences on the outcome you’ll deliver." /></label>
                </div>
              </Card>
              <Card title="Sections" actions={<>
                <button className="btn sm ghost" onClick={() => { if (confirm('Replace all sections with the standard five?')) set('sections', DEFAULT_SECTIONS); }}><RefreshCw {...I} />Defaults</button>
                <button className="btn sm" onClick={() => set('sections', [...d.sections, { heading: '', body: '' }])}><Plus {...I} />Section</button>
              </>}>
                <p className="muted small pp-hint">Simple formatting: <code># Heading</code> <code>**bold**</code> <code>- bullet</code> <code>1. step</code> <code>[link](https://…)</code></p>
                <div className="pp-sections">
                  {d.sections.map((s, i) => (
                    <div key={i} className="pp-section">
                      <div className="pp-section-head">
                        <span className="pp-num">{String(i + 1).padStart(2, '0')}</span>
                        <input value={s.heading} placeholder="Section heading" onChange={(e) => setSec(i, 'heading', e.target.value)} />
                        <button className="icon" title="Move up" onClick={() => moveSec(i, -1)} disabled={i === 0}><ArrowUp {...I} /></button>
                        <button className="icon" title="Move down" onClick={() => moveSec(i, 1)} disabled={i === d.sections.length - 1}><ArrowDown {...I} /></button>
                        <button className="icon" title="Remove" onClick={() => set('sections', d.sections.filter((_, j) => j !== i))}><Trash2 {...I} /></button>
                      </div>
                      <textarea rows={Math.min(14, Math.max(4, s.body.split('\n').length + 1))} value={s.body} onChange={(e) => setSec(i, 'body', e.target.value)} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Line items" actions={<button className="btn sm" onClick={() => set('items', [...d.items, { description: '', qty: 1, unit_price: 0, billing: 'once' }])}><Plus {...I} />Line</button>}>
                {d.items.length ? (
                  <div className="table-scroll"><table className="table items">
                    <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Billing</th><th>Amount</th><th></th></tr></thead>
                    <tbody>{d.items.map((it, i) => (
                      <tr key={i}>
                        <td><textarea rows={2} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} /></td>
                        <td><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} style={{ width: 70 }} /></td>
                        <td><input type="number" min={0} value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} /></td>
                        <td><select value={it.billing} onChange={(e) => setItem(i, 'billing', e.target.value)}><option value="once">One-off</option><option value="monthly">Monthly</option><option value="termly">Per term</option><option value="yearly">Yearly</option></select></td>
                        <td className="nowrap">{money(it.qty * it.unit_price, d.currency)}</td>
                        <td><button className="icon" title="Remove line" onClick={() => set('items', d.items.filter((_, j) => j !== i))}><X {...I} /></button></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                ) : <Empty title="No line items yet">Add lines, or let AI draft them from your notes below.</Empty>}
              </Card>
              <Card title={<><Sparkles {...I} /> AI draft from notes</>} actions={<button className="btn sm" disabled={busy || notes.trim().length < 10} onClick={() => run(async () => {
                const r = await api('/proposals/ai-draft', { body: { notes, currency: d.currency, lead_id: d.lead_id, client_name: d.client_name, client_company: d.client_company } });
                const x = r.draft;
                const custom = JSON.stringify(d.sections) !== JSON.stringify(DEFAULT_SECTIONS) && d.sections.some((s) => s.body.trim());
                const replace = x.sections?.length && (!custom || confirm('Replace your current sections with the AI draft? (Line items are added, not replaced.)'));
                setD({ ...d, title: d.title || x.title || '', summary: d.summary || x.summary || '', sections: replace ? x.sections : d.sections,
                  items: [...d.items, ...(x.items ?? [])], deposit_pct: x.deposit_pct ?? d.deposit_pct });
                toast(`Drafted with ${r.provider} — review every line before sending`);
              })}><Sparkles {...I} />Draft proposal</button>}>
                <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Paste call notes: who they are, what hurts, what they asked for, budget, deadline. e.g. 2-branch dental clinic in Lekki; patients book by phone; wants online booking + WhatsApp reminders; budget ~₦2m; launch before January." />
              </Card>
            </fieldset>
          </div>

          <aside className="pp-side">
            <Card title="Pricing & terms">
              <fieldset disabled={locked} className="pp-fieldset">
                <div className="fields">
                  <label className="field"><span>Currency</span><select value={d.currency} onChange={(e) => set('currency', e.target.value as Draft['currency'])}><option>NGN</option><option>USD</option><option>GBP</option></select></label>
                  <label className="field"><span>Valid until</span><input type="date" value={d.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></label>
                  <label className="field"><span>Discount %</span><input type="number" min={0} max={100} value={d.discount_pct} onChange={(e) => set('discount_pct', e.target.value)} /></label>
                  <label className="field"><span>Deposit %</span><input type="number" min={1} max={100} value={d.deposit_pct} onChange={(e) => set('deposit_pct', e.target.value)} /></label>
                  <label className="field wide"><span>Invoice when signed</span>
                    <select value={d.invoice_on_sign} onChange={(e) => set('invoice_on_sign', e.target.value as Draft['invoice_on_sign'])}>
                      <option value="deposit">Deposit ({Number(d.deposit_pct) || 0}%)</option><option value="full">Full amount</option>
                    </select></label>
                  <label className="field wide check"><span>Add VAT (7.5%)</span><input type="checkbox" checked={d.vat} onChange={(e) => set('vat', e.target.checked)} /></label>
                </div>
              </fieldset>
              <dl className="totals">
                <dt>One-off subtotal</dt><dd>{money(tt.once, d.currency)}</dd>
                {tt.d ? <><dt>Discount</dt><dd>−{money(tt.d, d.currency)}</dd></> : null}
                {d.vat ? <><dt>VAT 7.5%</dt><dd>{money(tt.t, d.currency)}</dd></> : null}
                <dt className="grand">One-off total</dt><dd className="grand">{money(tt.total, d.currency)}</dd>
                {Object.entries(tt.rec).map(([k, v]) => <React.Fragment key={k}><dt>Then per {CYCLE[k] ?? k}</dt><dd>{money(v, d.currency)}</dd></React.Fragment>)}
                <dt>Invoice on signing</dt><dd><strong>{money(deposit, d.currency)}</strong></dd>
              </dl>
            </Card>

            {id && row ? (
              <Card title="Share with client">
                <dl className="dl pp-dl">
                  <dt>Status</dt><dd><DocStatus s={row.status} /></dd>
                  <dt>Sent</dt><dd>{row.sent_at ? ago(row.sent_at) : '—'}</dd>
                  <dt>Views</dt><dd>{row.view_count ? `${row.view_count} · first ${fmtDate(row.first_viewed_at, true)}` : 'Not opened yet'}</dd>
                  <dt>Access</dt><dd>{row.revoked ? <Badge tone="red">switched off</Badge> : row.has_code ? 'Code set (shown once when sent)' : 'No code yet'}</dd>
                </dl>
                <div className="pp-actions">
                  {row.status !== 'signed' && writable ? <button className="btn primary block" disabled={busy} onClick={() => run(async () => { if (dirty) await save(true); setShare('send'); })}><Send {...I} />{row.has_code ? 'Send again' : 'Send to client'}</button> : null}
                  {row.has_code ? <button className="btn ghost sm" onClick={() => copy(here(data.url), toast, 'Client link copied')}><Copy {...I} />Copy link</button> : null}
                  {row.has_code ? <a className="btn ghost sm" href={here(data.url)} target="_blank" rel="noreferrer"><ExternalLink {...I} />Open client page</a> : null}
                  {row.has_code && writable ? <button className="btn ghost sm" disabled={busy} onClick={() => { if (confirm('Create a new access code? The old code and anyone already signed in stop working.')) run(async () => setShare(await api(`/proposals/${id}/code`, { body: {} }))); }}><KeyRound {...I} />New code</button> : null}
                  {row.has_code && writable ? <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await api(`/proposals/${id}/revoke`, { body: { revoked: !row.revoked } }); toast(row.revoked ? 'Link switched back on' : 'Link switched off'); reload(); })}>{row.revoked ? <><LockOpen {...I} />Restore link</> : <><Lock {...I} />Revoke link</>}</button> : null}
                  {can(user, row.status === 'signed' ? 'admin' : 'editor') ? <button className="btn ghost sm danger" onClick={() => { if (confirm(row.status === 'signed' ? `${row.number} is signed. Delete it anyway? Its invoices stay in the Invoices tab. This can’t be undone.` : `Delete ${row.number}? This can’t be undone.`)) run(async () => { await api(`/proposals/${id}`, { method: 'DELETE' }); toast('Deleted'); go('/proposals'); }); }}><Trash2 {...I} />Delete</button> : null}
                </div>
              </Card>
            ) : <Card><p className="muted small">Save the draft to get a private client link and access code.</p></Card>}

            {row?.status === 'signed' ? <SignedCard id={id!} row={row} data={data} onChange={reload} /> : null}

            <Card title="Live preview" actions={<button className="btn sm ghost" onClick={() => setTab('preview')}><Eye {...I} />Full size</button>}>
              <ThumbPreview draft={d} id={id} onOpen={() => setTab('preview')} />
            </Card>
          </aside>
        </div>
      )}

      <Drawer open={!!share} onClose={() => { setShare(null); reload(); }} title={share === 'send' ? `Send ${row?.number ?? ''}` : 'Client link and access code'}>
        {share === 'send' && row ? <SendForm kind="proposal" doc={{ ...row, ...d }} email={!!cfg?.email} path={`/proposals/${id}/send`} onDone={(r) => setShare(r)} />
          : share && share !== 'send' ? <ShareResult result={share} name={d.client_name} phone={d.client_phone} what="proposal" /> : null}
      </Drawer>
    </Page>
  );
}

function SignedCard({ id, row, data, onChange }: { id: string; row: any; data: any; onChange: () => void }) {
  const toast = useToast();
  const { go } = useRoute();
  const ok = data?.integrity && data.integrity.stored === data.integrity.current;
  return (
    <Card title={<><FileSignature {...I} /> Signature</>}>
      <div className="pp-sig"><img src={`/api/studio/proposals/${id}/signature`} alt="Client signature" /></div>
      <p className="small"><strong>{row.signer_name}</strong>{row.signer_title ? `, ${row.signer_title}` : ''} · {fmtDate(row.signed_at, true)}</p>
      <dl className="dl pp-dl small">
        <dt>Method</dt><dd>{row.signature_mode === 'type' ? 'Typed name' : 'Drawn signature'}</dd>
        <dt>IP hash</dt><dd><code>{String(row.signer_ip_hash ?? '').slice(0, 16)}…</code></dd>
        <dt>Device</dt><dd className="muted">{String(row.signer_ua ?? '').slice(0, 90)}</dd>
        <dt>Integrity</dt><dd>{ok ? <Badge tone="green">content unchanged</Badge> : <Badge tone="red">mismatch</Badge>}<code className="wrap">{row.content_hash}</code></dd>
      </dl>
      <h4 className="pp-sub">Invoices</h4>
      <ul className="list">
        {(data?.invoices ?? []).map((i: any) => (
          <li key={i.id}><a href="#" onClick={(e) => { e.preventDefault(); go(`/proposals?tab=invoices&invoice=${i.id}`); }}><span><strong>{i.number}</strong> <DocStatus s={i.status} /></span><span className="muted small">{i.kind} · {money(i.amount_due, i.currency)}{Number(i.amount_paid) ? ` · ${money(i.amount_paid, i.currency)} paid` : ''}</span></a></li>
        ))}
      </ul>
      <button className="btn sm ghost" onClick={async () => {
        try { const r = await api(`/proposals/${id}/invoices`, { body: { kind: 'balance' } }); toast(`${r.row.number} raised`); onChange(); } catch (x: any) { toast(x.message, 'err'); }
      }}><Receipt {...I} />Raise balance invoice</button>
    </Card>
  );
}

/* ── lead picker ── */
function LeadPicker({ value, onPick }: { value: string | null; onPick: (lead: any | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { data: current } = useData(() => (value ? api(`/r/leads/${value}`).then((r) => r.row).catch(() => null) : Promise.resolve(null)), [value]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => list('leads', { q: q || undefined, limit: '8' }).then(setResults).catch(() => setResults([])), 220);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <div className="pp-lead">
      <span className="pp-label">Linked lead</span>
      {value && current ? (
        <div className="pp-lead-chip"><strong>{current.company}</strong><span className="muted small">{[current.contact_name, current.city, current.status].filter(Boolean).join(' · ')}</span>
          <button className="icon" title="Unlink lead" onClick={() => onPick(null)}><X {...I} /></button></div>
      ) : (
        <div className="pp-lead-search">
          <input value={q} placeholder="Search leads by company, name, email…" onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)} onChange={(e) => setQ(e.target.value)} />
          {open && results.length ? (
            <ul className="pp-dropdown">{results.map((l) => (
              <li key={l.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(l); setOpen(false); setQ(''); }}>
                <strong>{l.company}</strong><span className="muted small">{[l.contact_name, l.city, l.status].filter(Boolean).join(' · ')}</span></button></li>
            ))}</ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── live preview: the server renders the real client page from unsaved state ── */
function usePreviewHtml(draft: Draft, id: string | null) {
  const [html, setHtml] = useState('');
  const key = JSON.stringify(draft);
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch('/api/studio/proposals/preview', { method: 'POST', credentials: 'same-origin', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...toBody(draft), id }) })
        .then((r) => r.text()).then(setHtml).catch(() => null);
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [key, id]); // eslint-disable-line react-hooks/exhaustive-deps
  return html;
}
function PreviewFrame({ html, className, title }: { html: string; className?: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  useEffect(() => { try { scroll.current = ref.current?.contentWindow?.scrollY ?? 0; } catch { /* sandboxed */ } }, [html]);
  return <iframe ref={ref} className={className} title={title} sandbox="allow-same-origin" srcDoc={html}
    onLoad={() => { try { ref.current?.contentWindow?.scrollTo(0, scroll.current); } catch { /* ignore */ } }} />;
}
function ThumbPreview({ draft, id, onOpen }: { draft: Draft; id: string | null; onOpen: () => void }) {
  const html = usePreviewHtml(draft, id);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.32);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1100));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="pp-thumb" onClick={onOpen} title="Open full preview" style={{ height: Math.round(1500 * scale) }}>
      <div style={{ transform: `scale(${scale})` }}><PreviewFrame html={html} title="Client page preview" /></div>
    </div>
  );
}
function FullPreview({ draft, id }: { draft: Draft; id: string | null }) {
  const html = usePreviewHtml(draft, id);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  return (
    <Card title="This is exactly what your client sees" actions={<div className="tabs pp-device">
      <button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor {...I} /> Desktop</button>
      <button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone {...I} /> Mobile</button>
    </div>}>
      <div className={`pp-full ${device}`}><PreviewFrame html={html} title="Client page preview" /></div>
    </Card>
  );
}

/* ── timeline ── */
const EVENT_ICON: Record<string, React.ReactNode> = {
  created: <Plus {...I} />, sent: <Send {...I} />, viewed: <Eye {...I} />, signed: <FileSignature {...I} />, declined: <Ban {...I} />, changes: <MessageCircle {...I} />,
  code: <KeyRound {...I} />, revoked: <Lock {...I} />, restored: <LockOpen {...I} />, invoice: <Receipt {...I} />, invoice_sent: <Mail {...I} />, receipt: <ImageIcon {...I} />,
  payment: <Banknote {...I} />, paid: <CircleCheck {...I} />, reminder: <Bell {...I} />, expired: <Hourglass {...I} />, status: <RefreshCw {...I} />, void: <Ban {...I} />, reopened: <RefreshCw {...I} />,
  email_opened: <MailOpen {...I} />, email_clicked: <MousePointerClick {...I} />, email_bounced: <AlertTriangle {...I} />,
};
function Timeline({ events }: { events: any[] }) {
  if (!events.length) return <Card><Empty title="Nothing yet" /></Card>;
  return (
    <Card>
      <ol className="pp-timeline">
        {events.map((e) => (
          <li key={e.id} className={`k-${e.kind}`}>
            <span className="pp-ev-icon">{EVENT_ICON[e.kind] ?? <Pencil {...I} />}</span>
            <div><strong>{e.kind.replace(/_/g, ' ')}</strong> <span className="muted">· {e.actor} · {fmtDate(e.at, true)} ({ago(e.at)})</span>{e.detail ? <p>{e.detail}</p> : null}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ── sharing (proposals and invoices) ── */
function SendForm({ kind, doc, email, path, onDone }: { kind: 'proposal' | 'invoice'; doc: any; email: boolean; path: string; onDone: (r: any) => void }) {
  const toast = useToast();
  const [to, setTo] = useState(doc.client_email ?? '');
  const [separate, setSeparate] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      {email ? (
        <>
          <p className="muted">We’ll email a private link to the {kind}. A new 6-digit access code is created now; any earlier code stops working.</p>
          <div className="fields">
            <label className="field wide"><span>Client email</span><input type="email" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="field wide"><span>Personal note (optional)</span><textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Great speaking with you on Tuesday — here’s the plan we discussed." /></label>
            <label className="field wide check"><span>Send the access code in a separate email (extra security)</span><input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} /></label>
          </div>
        </>
      ) : (
        <div className="pp-note"><Mail {...I} /> Email isn’t connected (add the <code>RESEND_API_KEY</code> secret). You’ll get the link and code to share on WhatsApp or by email yourself.</div>
      )}
      <div className="drawer-actions">
        <button className="btn primary" disabled={busy || (email && !!to && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to))} onClick={async () => {
          setBusy(true);
          try {
            const r = await api(path, { body: { to, separate_code: separate, message, email: email && !!to } });
            if (r.emailed) toast(`Sent to ${r.to}`); else if (r.emailError) toast(r.emailError, 'err');
            onDone(r);
          } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
        }}><Send {...I} />{email && to ? 'Send email' : 'Create link & code'}</button>
      </div>
    </div>
  );
}

function ShareResult({ result: raw, name, phone, what }: { result: { code: string; url: string; emailed?: boolean; emailError?: string; to?: string }; name?: string; phone?: string; what: string }) {
  const toast = useToast();
  const result = { ...raw, url: here(raw.url) };
  const first = (name || '').split(' ')[0] || 'there';
  const shareText = `Hi ${first}, here is your ${what} from Ferrn Digital Agency: ${result.url}\nAccess code: ${result.code}`;
  const wa = (text: string) => waLink(phone, text) || `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <div className="stack">
      {result.emailed ? <div className="pp-note ok"><CircleCheck {...I} /> Emailed to {result.to}. You can also share it below.</div>
        : result.emailError ? <div className="error-note">{result.emailError}</div> : null}
      <div className="pp-share">
        <span className="pp-label">Client link</span>
        <div className="pp-copyrow"><code>{result.url}</code><button className="btn sm" onClick={() => copy(result.url, toast, 'Link copied')}><Copy {...I} />Copy</button></div>
        <span className="pp-label">Access code</span>
        <div className="pp-copyrow"><span className="pp-code">{result.code}</span><button className="btn sm" onClick={() => copy(result.code, toast, 'Code copied')}><Copy {...I} />Copy</button></div>
        <p className="muted small">The code is shown only now. Use “New code” if you need another one later.</p>
      </div>
      <div className="row gap">
        <a className="btn wa" href={wa(shareText)} target="_blank" rel="noreferrer"><MessageCircle {...I} />Send on WhatsApp</a>
        <button className="btn" onClick={() => copy(shareText, toast, 'Message copied')}><Copy {...I} />Copy message</button>
      </div>
    </div>
  );
}

/* ══════════════ invoices ══════════════ */
const sumByCur = (xs: { currency: string; amount: number }[] | undefined) =>
  (xs ?? []).filter((x) => Number(x.amount)).map((x) => money(Number(x.amount), x.currency)).join(' · ') || money(0, 'NGN');

function InvoicesTab() {
  const { path, go } = useRoute();
  const open = new URLSearchParams(path.split('?')[1] ?? '').get('invoice');
  const { data, loading, error, reload } = useData(() => api('/proposals/invoices'));
  const [filter, setFilter] = useState('open');
  const shown = ((data?.rows ?? []) as any[]).filter((r) => filter === 'all' || (filter === 'open' ? ['unpaid', 'receipt_submitted', 'part_paid'].includes(r.status) : r.status === filter));
  const pg = usePaged<any>(shown, 'invoices', filter);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const rows: any[] = data.rows;
  const k = data.kpis;
  return (
    <>
      <div className="kpi-row">
        <div className="kpi feature">
          <div className="kpi-icon"><Wallet size={24} /></div>
          <div><h4>Outstanding</h4><p className="muted">{k.outstanding.reduce((a: number, x: any) => a + x.n, 0)} open invoice(s)</p></div>
          <strong className="pp-kpi-money">{sumByCur(k.outstanding)}</strong>
        </div>
        <div className="kpi"><h4>Received this month</h4><strong className="pp-kpi-money">{sumByCur(k.received)}</strong><span className="muted">{k.received.reduce((a: number, x: any) => a + x.n, 0)} payment(s)</span></div>
        <div className="kpi"><h4>Receipts to check</h4><strong>{k.awaiting}</strong><span className="muted">clients say they’ve paid</span></div>
        <div className="kpi"><h4>Paid invoices</h4><strong>{rows.filter((r) => r.status === 'paid').length}</strong><span className="muted">of {rows.length}</span></div>
      </div>
      <div className="toolbar">
        <Tabs tabs={[['open', 'Open'], ['receipt_submitted', 'Receipt submitted'], ['paid', 'Paid'], ['void', 'Void'], ['all', 'All']]} value={filter} onChange={setFilter} />
      </div>
      {!shown.length ? <Card><Empty title={rows.length ? 'Nothing here' : 'No invoices yet'}>Invoices are created automatically when a client signs a proposal.</Empty></Card> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>Invoice</th><th>Client</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Due</th><th>Receipts</th></tr></thead>
          <tbody>{pg.rows.map((r) => {
            const overdue = r.due_date && r.due_date < new Date().toISOString().slice(0, 10) && !['paid', 'void'].includes(r.status);
            return (
              <tr key={r.id} onClick={() => go(`/proposals?tab=invoices&invoice=${r.id}`)} className={r.status === 'void' ? 'dim' : ''}>
                <td><strong>{r.number}</strong><div className="muted small">{r.kind}{r.proposal_number ? ` · ${r.proposal_number}` : ''}</div></td>
                <td>{r.client_company || r.client_name}</td>
                <td className="nowrap">{money(r.amount_due, r.currency)}</td>
                <td className="nowrap">{Number(r.amount_paid) ? money(r.amount_paid, r.currency) : <span className="muted">—</span>}</td>
                <td><DocStatus s={r.status} /></td>
                <td className={`nowrap ${overdue ? 'pp-overdue' : 'muted'}`}>{r.due_date ? fmtDate(r.due_date) : '—'}{overdue ? <div className="small">overdue</div> : null}</td>
                <td><Thumbs receipts={r.receipts} /></td>
              </tr>
            );
          })}</tbody>
        </table><Pager pg={pg} noun="invoices" /></div>
      )}
      <Drawer open={!!open} wide onClose={() => { go('/proposals?tab=invoices'); reload(); }} title={rows.find((r) => r.id === open)?.number ?? 'Invoice'}>
        {open ? <InvoiceDetail key={open} id={open} onChange={reload} /> : null}
      </Drawer>
    </>
  );
}

function Thumbs({ receipts, big }: { receipts: any[]; big?: boolean }) {
  if (!receipts?.length) return <span className="muted">—</span>;
  return (
    <div className={`pp-thumbs ${big ? 'big' : ''}`}>
      {receipts.map((r) => {
        const src = `/api/studio/proposals/receipts/${r.id}`;
        const img = /^image\/(png|jpeg|webp)$/.test(r.content_type);
        return (
          <a key={r.id} href={src} target="_blank" rel="noreferrer" title={`${r.filename}${r.note ? ' — ' + r.note : ''}`} onClick={(e) => e.stopPropagation()}>
            {img ? <img src={src} alt={r.filename} loading="lazy" /> : <span className="pp-file">{r.content_type === 'application/pdf' ? <FileText size={big ? 26 : 16} /> : <ImageIcon size={big ? 26 : 16} />}</span>}
            {big ? <small>{r.filename}<br />{ago(r.created_at)}</small> : null}
          </a>
        );
      })}
    </div>
  );
}

function InvoiceDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const toast = useToast();
  const user = useUser();
  const admin = can(user, 'admin');
  const { data, loading, error, reload } = useData(() => api(`/proposals/invoices/${id}`), [id]);
  const { data: cfg } = useData(() => api('/proposals/config'));
  const [pay, setPay] = useState<{ amount: string; method: string; reference: string; paid_at: string; note: string } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [reminder, setReminder] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const inv = data.row;
  const remaining = r2(Number(inv.amount_due) - Number(inv.amount_paid));
  const refresh = () => { reload(); onChange(); };
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } };
  return (
    <div className="stack">
      <div className="pp-inv-head">
        <div><span className="pp-label">Amount due</span><strong>{money(inv.amount_due, inv.currency)}</strong></div>
        <div><span className="pp-label">Paid</span><strong>{money(inv.amount_paid, inv.currency)}</strong></div>
        <div><span className="pp-label">Remaining</span><strong>{money(remaining, inv.currency)}</strong></div>
        <div><span className="pp-label">Status</span><DocStatus s={inv.status} />{inv.revoked ? <Badge tone="red">link off</Badge> : null}</div>
      </div>
      <dl className="dl">
        <dt>Client</dt><dd>{inv.client_company || inv.client_name} {inv.client_email ? <span className="muted">· {inv.client_email}</span> : null}</dd>
        <dt>For</dt><dd>{inv.title} <span className="muted">({inv.kind}{inv.deposit_pct ? ` ${inv.deposit_pct}%` : ''} of {money(inv.total, inv.currency)})</span></dd>
        <dt>Issued</dt><dd>{fmtDate(inv.issued_at)}</dd>
        <dt>Due</dt><dd><input type="date" className="pp-inline-date" defaultValue={inv.due_date ?? ''} disabled={!can(user, 'sales')} onChange={(e) => act(async () => { await api(`/proposals/invoices/${id}`, { method: 'PATCH', body: { due_date: e.target.value } }); toast('Due date updated'); refresh(); })} /></dd>
        <dt>Views</dt><dd>{inv.view_count ? `${inv.view_count} · last ${ago(inv.last_viewed_at)}` : 'Not opened yet'}</dd>
        {inv.reminded_at ? <><dt>Last reminder</dt><dd>{ago(inv.reminded_at)}</dd></> : null}
      </dl>

      <div className="row-actions">
        {!['paid', 'void'].includes(inv.status) && admin ? <button className="btn primary sm" onClick={() => setPay({ amount: String(remaining), method: 'bank_transfer', reference: '', paid_at: new Date().toISOString().slice(0, 10), note: '' })}><Banknote {...I} />Mark paid</button> : null}
        {can(user, 'sales') ? <button className="btn sm" onClick={() => { setSending(true); setResult(null); }}><Send {...I} />Send link & code</button> : null}
        {!['paid', 'void'].includes(inv.status) && can(user, 'sales') ? <button className="btn sm" disabled={busy} onClick={() => act(async () => {
          const r = await api(`/proposals/invoices/${id}/remind`, { body: {} }); setReminder(r);
          toast(r.emailed ? 'Reminder emailed' : r.emailError ? r.emailError : 'Reminder ready to share', r.emailError ? 'err' : 'ok'); refresh();
        })}><Bell {...I} />Send reminder</button> : null}
        <button className="btn ghost sm" onClick={() => copy(here(data.url), toast, 'Invoice link copied')}><Copy {...I} />Copy link</button>
        <a className="btn ghost sm" href={here(data.url)} target="_blank" rel="noreferrer"><ExternalLink {...I} />Client page</a>
        {can(user, 'sales') ? <button className="btn ghost sm" disabled={busy} onClick={() => { if (confirm('Create a new access code? The old one stops working.')) act(async () => { setResult(await api(`/proposals/invoices/${id}/send`, { body: { regenerate_only: true } })); }); }}><KeyRound {...I} />New code</button> : null}
        {can(user, 'sales') ? <button className="btn ghost sm" disabled={busy} onClick={() => act(async () => { await api(`/proposals/invoices/${id}/revoke`, { body: { revoked: !inv.revoked } }); toast(inv.revoked ? 'Link restored' : 'Link switched off'); refresh(); })}>{inv.revoked ? <><LockOpen {...I} />Restore link</> : <><Lock {...I} />Revoke link</>}</button> : null}
        {admin ? <button className="btn ghost sm danger" disabled={busy} onClick={() => { if (confirm(inv.status === 'void' ? 'Reopen this invoice?' : 'Void this invoice? The client will see it as cancelled.')) act(async () => { await api(`/proposals/invoices/${id}`, { method: 'PATCH', body: { status: inv.status === 'void' ? 'unpaid' : 'void' } }); refresh(); }); }}><Ban {...I} />{inv.status === 'void' ? 'Reopen' : 'Void'}</button> : null}
      </div>

      {pay ? (
        <Card title="Record a payment" className="soft">
          <div className="fields">
            <label className="field"><span>Amount ({inv.currency})</span><input type="number" min={0} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="field"><span>Method</span><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="paystack">Paystack</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
            <label className="field"><span>Date received</span><input type="date" value={pay.paid_at} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} /></label>
            <label className="field"><span>Bank reference (optional)</span><input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
            <label className="field wide"><span>Note</span><input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></label>
          </div>
          <div className="drawer-actions">
            <button className="btn ghost" onClick={() => setPay(null)}>Cancel</button>
            <button className="btn ghost" onClick={() => setPay({ ...pay, amount: String(remaining) })}>Full amount</button>
            <button className="btn primary" disabled={busy} onClick={() => act(async () => {
              const r = await api(`/proposals/invoices/${id}/payments`, { body: { ...pay, amount: Number(pay.amount) } });
              toast(r.row.status === 'paid' ? `${inv.number} marked paid` : 'Part payment recorded'); setPay(null); refresh();
            })}><CircleCheck {...I} />Record payment</button>
          </div>
        </Card>
      ) : null}

      {sending && !result ? <Card title="Send invoice" className="soft"><SendForm kind="invoice" doc={inv} email={!!cfg?.email} path={`/proposals/invoices/${id}/send`} onDone={(r) => { setResult(r); setSending(false); refresh(); }} /></Card> : null}
      {result ? <Card title="Client link and access code" className="soft" actions={<button className="icon" onClick={() => setResult(null)}><X {...I} /></button>}><ShareResult result={result} name={inv.client_name} phone={inv.client_phone} what="invoice" /></Card> : null}
      {reminder && !reminder.emailed ? (
        <Card title="Reminder" className="soft" actions={<button className="icon" onClick={() => setReminder(null)}><X {...I} /></button>}>
          <p className="pre small">{reminder.text}</p>
          <div className="row gap">
            <button className="btn sm" onClick={() => copy(reminder.text, toast, 'Reminder copied')}><Copy {...I} />Copy text</button>
            <a className="btn sm wa" href={waLink(reminder.phone, reminder.text) || `https://wa.me/?text=${encodeURIComponent(reminder.text)}`} target="_blank" rel="noreferrer"><MessageCircle {...I} />WhatsApp</a>
          </div>
        </Card>
      ) : null}

      <Card title={`Receipts (${data.receipts.length})`}>
        {data.receipts.length ? <Thumbs receipts={data.receipts} big /> : <p className="muted small">No receipts uploaded yet.</p>}
        {data.receipts.filter((r: any) => r.note).map((r: any) => <p key={r.id} className="small"><strong>{r.filename}:</strong> {r.note}</p>)}
      </Card>
      <Card title="Payments">
        {data.payments.length ? (
          <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>By</th></tr></thead>
            <tbody>{data.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.paid_at)}</td><td>{money(p.amount, p.currency)}</td><td>{p.method.replace('_', ' ')}</td><td className="muted">{p.reference || p.note || '—'}</td><td className="muted">{p.recorded_by}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted small">No payments recorded.</p>}
      </Card>
      {data.events.length ? <Timeline events={data.events} /> : null}
    </div>
  );
}

/* ══════════════ payment methods ══════════════ */
const TYPE_LABEL: Record<string, string> = { ng_bank: 'Nigerian bank transfer', intl_bank: 'International bank', other: 'Other', paystack: 'Paystack' };
const TYPE_ICON: Record<string, React.ReactNode> = { ng_bank: <Landmark size={20} />, intl_bank: <Globe size={20} />, other: <Wallet size={20} />, paystack: <CreditCard size={20} /> };
const FIELDS: Record<string, [string, string, ('wide' | 'area')?][]> = {
  ng_bank: [['bank', 'Bank'], ['account_name', 'Account name'], ['account_number', 'Account number'], ['instructions', 'Extra instructions (optional)', 'area']],
  intl_bank: [['bank', 'Bank'], ['account_name', 'Account name'], ['account_number', 'Account number'], ['iban', 'IBAN'], ['swift', 'SWIFT / BIC'], ['sort_code', 'Sort code'],
    ['routing', 'Routing / ABA'], ['intermediary', 'Intermediary bank'], ['bank_address', 'Bank address', 'wide'], ['reference_note', 'Reference instructions', 'area'], ['instructions', 'Extra instructions (optional)', 'area']],
  other: [['provider', 'Provider (e.g. Wise, Payoneer, Grey, Chipper Cash)'], ['account', 'Account, email or tag'], ['instructions', 'How to pay', 'area']],
  paystack: [],
};

function MethodsTab() {
  const toast = useToast();
  const { data, loading, error, reload } = useData(() => api('/proposals/methods'));
  const [edit, setEdit] = useState<any>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const rows: any[] = data.rows;
  const editable = data.can_edit;
  const move = async (i: number, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id); const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api('/proposals/methods/reorder', { body: { ids } }); reload(); } catch (x: any) { toast(x.message, 'err'); }
  };
  return (
    <>
      <Card title="How clients pay" actions={editable ? <button className="btn sm primary" onClick={() => setEdit({ type: 'ng_bank', label: '', currencies: ['NGN'], details: {}, enabled: 1 })}><Plus {...I} />Add method</button> : null}>
        <p className="muted small">Invoices show every enabled method that lists the invoice’s currency, in this order. {editable ? '' : 'Only admins can change these.'}</p>
        <p className="small">Paystack: {data.paystack_configured ? <Badge tone="green">connected</Badge> : <Badge tone="orange">add PAYSTACK_SECRET_KEY to switch on card payments</Badge>}</p>
      </Card>
      {!rows.length ? <Card><Empty title="No payment methods yet">Add your bank account so invoices show transfer details.</Empty></Card> : (
        <div className="stack">
          {rows.map((m, i) => {
            const d = JSON.parse(m.details_json || '{}');
            const summary = m.type === 'paystack' ? 'Card, bank transfer and USSD checkout' : [d.bank || d.provider, d.account_name, d.account_number ? `••••${String(d.account_number).slice(-4)}` : d.iban ? `IBAN ••••${String(d.iban).slice(-4)}` : d.account].filter(Boolean).join(' · ');
            return (
              <div key={m.id} className={`stack-item pp-method ${m.enabled ? '' : 'off'}`}>
                <div className="pp-method-main">
                  <span className="pp-method-icon">{TYPE_ICON[m.type]}</span>
                  <div>
                    <strong>{m.label}</strong> {m.enabled ? <Badge tone="green">enabled</Badge> : <Badge>disabled</Badge>}
                    <div className="muted small">{TYPE_LABEL[m.type]} · {m.currencies.split(',').join(', ')}</div>
                    {summary ? <div className="small">{summary}</div> : null}
                  </div>
                </div>
                {editable ? (
                  <div className="row-actions">
                    <button className="icon" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp {...I} /></button>
                    <button className="icon" title="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown {...I} /></button>
                    <button className="btn sm ghost" onClick={async () => { try { await api(`/proposals/methods/${m.id}`, { method: 'PATCH', body: { enabled: !m.enabled } }); reload(); } catch (x: any) { toast(x.message, 'err'); } }}>{m.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn sm ghost" onClick={() => setEdit({ ...m, currencies: m.currencies.split(','), details: d })}><Pencil {...I} />Edit</button>
                    <button className="icon" title="Delete" onClick={async () => { if (!confirm(`Remove “${m.label}”?`)) return; try { await api(`/proposals/methods/${m.id}`, { method: 'DELETE' }); reload(); } catch (x: any) { toast(x.message, 'err'); } }}><Trash2 {...I} /></button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.label}` : 'Add payment method'}>
        {edit ? <MethodForm value={edit} onDone={() => { setEdit(null); reload(); }} /> : null}
      </Drawer>
    </>
  );
}

function MethodForm({ value, onDone }: { value: any; onDone: () => void }) {
  const toast = useToast();
  const [m, setM] = useState<any>(value);
  const setD = (k: string, v: string) => setM({ ...m, details: { ...m.details, [k]: v } });
  const toggleCur = (c: string) => setM({ ...m, currencies: m.currencies.includes(c) ? m.currencies.filter((x: string) => x !== c) : [...m.currencies, c] });
  return (
    <div className="stack">
      <div className="fields">
        <label className="field wide"><span>Type</span>
          <select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value, currencies: e.target.value === 'ng_bank' ? ['NGN'] : e.target.value === 'paystack' ? ['NGN', 'USD'] : m.currencies })}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label className="field wide"><span>Label clients see</span><input value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} placeholder={m.type === 'intl_bank' ? 'e.g. USD account (Grey)' : 'e.g. GTBank — Naira account'} /></label>
        <div className="field wide"><span>Currencies</span>
          <div className="row gap">{['NGN', 'USD', 'GBP'].filter((c) => m.type !== 'paystack' || c !== 'GBP').map((c) => (
            <label key={c} className="pp-check"><input type="checkbox" checked={m.currencies.includes(c)} onChange={() => toggleCur(c)} /> {c}</label>
          ))}</div>
        </div>
        {FIELDS[m.type].map(([k, l, kind]) => (
          <label key={k} className={`field ${kind ? 'wide' : ''}`}><span>{l}</span>
            {kind === 'area' ? <textarea rows={3} value={m.details[k] ?? ''} onChange={(e) => setD(k, e.target.value)} /> : <input value={m.details[k] ?? ''} onChange={(e) => setD(k, e.target.value)} />}
          </label>
        ))}
        {m.type === 'paystack' ? <p className="muted small field wide">Shows a “Pay with Paystack” button on NGN and USD invoices when the <code>PAYSTACK_SECRET_KEY</code> secret is set. Disable this to hide it.</p> : null}
        <label className="field wide check"><span>Enabled</span><input type="checkbox" checked={!!Number(m.enabled)} onChange={(e) => setM({ ...m, enabled: e.target.checked ? 1 : 0 })} /></label>
      </div>
      <div className="drawer-actions">
        <button className="btn primary" disabled={!m.currencies.length} onClick={async () => {
          try {
            const body = { type: m.type, label: m.label, currencies: m.currencies, details: m.details, enabled: !!Number(m.enabled) };
            if (m.id) await api(`/proposals/methods/${m.id}`, { method: 'PATCH', body }); else await api('/proposals/methods', { body });
            toast('Saved'); onDone();
          } catch (x: any) { toast(x.message, 'err'); }
        }}><Save {...I} />Save</button>
      </div>
    </div>
  );
}

/* ══════════════ link proposals: a working link, or a page uploaded here and hosted at /proposal/<slug>/ ══════════════ */
type LinkDraft = {
  lead_id: string | null; client_name: string; client_company: string; client_email: string; client_phone: string; title: string; summary: string;
  currency: 'NGN' | 'USD' | 'GBP'; total: number | string; deposit_pct: number | string; valid_until: string; status: string; link_url: string; page_slug: string;
};
const toLink = (r: any): LinkDraft => ({
  lead_id: r?.lead_id ?? null, client_name: r?.client_name ?? '', client_company: r?.client_company ?? '', client_email: r?.client_email ?? '', client_phone: r?.client_phone ?? '',
  title: r?.title ?? '', summary: r?.summary ?? '', currency: r?.currency ?? 'NGN', total: r?.total ?? '', deposit_pct: r?.deposit_pct ?? 40,
  valid_until: r?.valid_until ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), status: r?.status ?? 'draft', link_url: r?.link_url ?? '', page_slug: r?.page_slug ?? '',
});
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function LinkProposalEditor({ id, loaded, reload }: { id: string | null; loaded?: any; reload?: () => void }) {
  const toast = useToast();
  const { go } = useRoute();
  const user = useUser();
  const writable = can(user, 'sales');
  const leadParam = new URLSearchParams(location.search).get('lead');
  const row = loaded?.row;
  const [d, setD] = useState<LinkDraft>(() => toLink(row ?? { lead_id: leadParam }));
  const [saved, setSaved] = useState(() => JSON.stringify(toLink(row ?? { lead_id: leadParam })));
  const [mode, setMode] = useState<'url' | 'upload'>(row?.page_slug ? 'upload' : row?.link_url ? 'url' : 'upload');
  const [files, setFiles] = useState<Picked>([]);
  const [pickLabel, setPickLabel] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('edit');
  const fileIn = useRef<HTMLInputElement>(null);
  const dirIn = useRef<HTMLInputElement>(null);
  useEffect(() => { if (row) { const x = toLink(row); setD(x); setSaved(JSON.stringify(x)); } }, [row]);
  useEffect(() => {
    if (!id && leadParam) api(`/r/leads/${leadParam}`).then((r) => setD((x) => ({ ...x, client_company: r.row.company ?? '', client_name: r.row.contact_name ?? '', client_email: r.row.email ?? '', client_phone: r.row.phone ?? '', title: x.title || `Proposal for ${r.row.company}` }))).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = <K extends keyof LinkDraft>(k: K, v: LinkDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== saved;
  const total = Number(d.total) || 0;
  const dep = Math.round(total * (Number(d.deposit_pct) || 0) / 100);
  const slug = d.page_slug || slugify(d.client_company || d.client_name || d.title);
  const clientUrl = row?.page_slug && row?.link_url ? here(row.link_url) : row?.token ? `${location.origin}/p/${row.token}` : '';

  const take = async (list: FileList | null) => {
    const arr = Array.from(list ?? []); if (!arr.length) return;
    try {
      let picked: Picked;
      if (arr.length === 1 && /\.zip$/i.test(arr[0].name)) picked = await fromZip(arr[0]);
      else if (arr.length === 1 && /\.html?$/i.test(arr[0].name)) picked = [{ path: 'index.html', data: arr[0] }];
      else picked = arr.map((f) => ({ path: (f as any).webkitRelativePath || f.name, data: f }));
      picked = normalise(picked);
      const entry = findEntry(picked);
      if (!entry) return toast('No HTML page found. The upload needs an index.html', 'err');
      if (!/^index\.html?$/i.test(entry)) {
        if (picked.filter((x) => /\.html?$/i.test(x.path)).length === 1 && !entry.includes('/')) picked = picked.map((x) => (x.path === entry ? { ...x, path: 'index.html' } : x));
        else return toast(`Put the main page at the top level as index.html (found ${entry})`, 'err');
      }
      setFiles(picked); setPickLabel(arr.length === 1 ? arr[0].name : `${picked.length} files`);
    } catch (e: any) { toast('Could not read that: ' + e.message, 'err'); }
  };

  const save = async (quiet = false) => {
    const body: Record<string, unknown> = { ...d, kind: 'link', total, deposit_pct: Number(d.deposit_pct) || 0, page_slug: undefined, link_url: mode === 'url' ? d.link_url : undefined };
    if (mode === 'url' && d.link_url && !/^https?:\/\//i.test(d.link_url)) throw new Error('The link should start with https://');
    const r = id ? await api(`/proposals/${id}`, { method: 'PATCH', body }) : await api('/proposals', { body });
    const pid = r.row.id as string;
    if (mode === 'upload' && files.length) {
      setProgress(0);
      await api(`/proposals/${pid}/page/start`, { body: { slug } });
      let done = 0; const queue = [...files];
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const res = await fetch(`/api/studio/proposals/${pid}/page/file?path=${encodeURIComponent(it.path)}`, { method: 'PUT', body: it.data, credentials: 'same-origin' });
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Upload failed for ${it.path}`);
          done++; setProgress(Math.round((done / files.length) * 100));
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
      await api(`/proposals/${pid}/page/done`, { body: { files: files.length } });
      setFiles([]); setPickLabel(''); setProgress(null);
      toast('Page uploaded and live');
    } else if (!quiet) toast('Saved');
    setSaved(JSON.stringify(d));
    if (!id) { go(`/proposals/${pid}`); return; }
    reload?.();
  };
  const runIt = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (x: any) { toast(x.message, 'err'); setProgress(null); } finally { setBusy(false); } };
  const status = (s: string) => runIt(async () => { await api(`/proposals/${id}`, { method: 'PATCH', body: { status: s } }); toast(`Marked as ${s}`); reload?.(); });
  const shareText = `Hello${d.client_name ? ' ' + d.client_name.split(' ')[0] : ''}, here is our proposal${d.title ? ` for ${d.title.replace(/^proposal for /i, '')}` : ''}: ${clientUrl}`;

  return (
    <Page title={id ? `${row?.number ?? ''} ${d.title ? '· ' + d.title : ''}` : 'Add proposal link'}
      sub={<><DocStatus s={row?.status ?? 'draft'} /> <Badge tone="blue">{row?.page_slug ? 'hosted page' : 'link'}</Badge>{row?.revoked ? <Badge tone="red">link switched off</Badge> : null}
        {dirty || files.length ? <span className="muted small"> · unsaved changes</span> : row?.updated_by ? <span className="muted small"> · edited by {row.updated_by} {ago(row.updated_at)}</span> : null}</>}
      actions={<>
        <button className="btn ghost" onClick={() => go('/proposals')}><ArrowLeft {...I} />Proposals</button>
        {writable ? <button className="btn primary" disabled={busy || (!dirty && !files.length && !!id)} onClick={() => runIt(() => save())}><Save {...I} />{files.length ? 'Save & upload' : 'Save'}</button> : null}
      </>}>
      {id ? <Tabs tabs={[['edit', 'Details'], ['timeline', 'Timeline'], ['history', 'History']]} value={tab} onChange={setTab} /> : null}
      {tab === 'timeline' && id ? <Timeline events={loaded?.events ?? []} /> : tab === 'history' && id ? <Card><History entity="proposals" id={id} /></Card> : (
        <div className="pp-layout">
          <div>
            <fieldset disabled={!writable} className="pp-fieldset">
              <Card title="The proposal">
                <div className="seg" role="radiogroup" aria-label="How the proposal is shared" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button type="button" className={`btn sm ${mode === 'upload' ? 'primary' : 'ghost'}`} aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}><FileText {...I} />Upload a page</button>
                  <button type="button" className={`btn sm ${mode === 'url' ? 'primary' : 'ghost'}`} aria-pressed={mode === 'url'} onClick={() => setMode('url')}><Globe {...I} />Paste a working link</button>
                </div>
                {mode === 'url' ? (
                  <div className="fields">
                    <label className="field wide"><span>Proposal link</span><input type="url" value={d.link_url} placeholder="https://ferrn-proposals.pages.dev/client-proposal" onChange={(e) => set('link_url', e.target.value)} /></label>
                    <p className="muted small wide">Clients get a Ferrn link that opens this page, so you can still see when they open it.</p>
                  </div>
                ) : (
                  <div className="fields">
                    <label className="field wide"><span>Address</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="muted small nowrap">{location.host}/proposal/</span>
                        <input value={slug} disabled={!!row?.page_slug} onChange={(e) => set('page_slug', slugify(e.target.value))} placeholder="client-name" /></div></label>
                    <div className="wide" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button type="button" className="btn sm" onClick={() => fileIn.current?.click()}><FileText {...I} />Choose HTML, ZIP or files</button>
                      <button type="button" className="btn sm ghost" onClick={() => dirIn.current?.click()}>Choose a folder</button>
                      <input ref={fileIn} type="file" hidden multiple accept=".html,.htm,.zip,.css,.js,.png,.jpg,.jpeg,.webp,.svg,.pdf,.gif,.woff,.woff2" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
                      <input ref={dirIn} type="file" hidden multiple {...({ webkitdirectory: '', directory: '' } as any)} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
                      {pickLabel ? <span className="small"><strong>{pickLabel}</strong> ready · {files.length} file{files.length === 1 ? '' : 's'} · saved when you press Save &amp; upload</span>
                        : row?.page_slug ? <span className="muted small">Live at <a href={here(row.link_url)} target="_blank" rel="noreferrer">/proposal/{row.page_slug}/</a>. Choose new files to replace it.</span>
                        : <span className="muted small">One HTML file, a ZIP, or a folder with index.html and its images or PDF.</span>}
                    </div>
                    {progress !== null ? <div className="wide small">Uploading… {progress}%</div> : null}
                  </div>
                )}
              </Card>
              <Card title="Client">
                <LeadPicker value={d.lead_id} onPick={(l) => setD((x) => ({ ...x, lead_id: l?.id ?? null, ...(l ? { client_company: x.client_company || l.company || '', client_name: x.client_name || l.contact_name || '', client_email: x.client_email || l.email || '', client_phone: x.client_phone || l.phone || '', title: x.title || `Proposal for ${l.company}` } : {}) }))} />
                <div className="fields">
                  <label className="field"><span>Company</span><input value={d.client_company} onChange={(e) => set('client_company', e.target.value)} /></label>
                  <label className="field"><span>Contact name</span><input value={d.client_name} onChange={(e) => set('client_name', e.target.value)} /></label>
                  <label className="field"><span>Email</span><input type="email" value={d.client_email} onChange={(e) => set('client_email', e.target.value)} /></label>
                  <label className="field"><span>Phone (for WhatsApp)</span><input value={d.client_phone} onChange={(e) => set('client_phone', e.target.value)} /></label>
                  <label className="field wide"><span>Title</span><input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Logistics and ATM support platform" /></label>
                  <label className="field wide"><span>Notes (team only)</span><textarea rows={3} value={d.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Scope, what was agreed on the call, anything the team should know." /></label>
                </div>
              </Card>
            </fieldset>
          </div>
          <aside className="pp-side">
            <Card title="Value & terms">
              <fieldset disabled={!writable} className="pp-fieldset">
                <div className="fields">
                  <label className="field"><span>Currency</span><select value={d.currency} onChange={(e) => set('currency', e.target.value as LinkDraft['currency'])}><option>NGN</option><option>USD</option><option>GBP</option></select></label>
                  <label className="field"><span>Total value</span><input type="number" min={0} value={d.total} onChange={(e) => set('total', e.target.value)} /></label>
                  <label className="field"><span>Upfront %</span><input type="number" min={1} max={100} value={d.deposit_pct} onChange={(e) => set('deposit_pct', e.target.value)} /></label>
                  <label className="field"><span>Valid until</span><input type="date" value={d.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></label>
                  {id ? <label className="field wide"><span>Status</span><select value={d.status} onChange={(e) => set('status', e.target.value)}>
                    {['draft', 'sent', 'viewed', 'signed', 'declined', 'expired'].map((s) => <option key={s} value={s}>{s === 'signed' ? 'accepted / signed' : s}</option>)}</select></label> : null}
                </div>
              </fieldset>
              <dl className="totals">
                <dt className="grand">Total</dt><dd className="grand">{money(total, d.currency)}</dd>
                <dt>Upfront ({Number(d.deposit_pct) || 0}%)</dt><dd>{money(dep, d.currency)}</dd>
                <dt>Balance</dt><dd>{money(total - dep, d.currency)}</dd>
              </dl>
            </Card>
            {id && row ? (
              <Card title="Share with client">
                <dl className="dl pp-dl">
                  <dt>Status</dt><dd><DocStatus s={row.status} /></dd>
                  <dt>Sent</dt><dd>{row.sent_at ? ago(row.sent_at) : '—'}</dd>
                  <dt>Views</dt><dd>{row.view_count ? `${row.view_count} · last ${ago(row.last_viewed_at)}` : 'Not opened yet'}</dd>
                  <dt>Link</dt><dd className="small" style={{ wordBreak: 'break-all' }}>{clientUrl || 'Add a link or upload a page'}</dd>
                </dl>
                {clientUrl && !row.revoked ? <div className="pp-actions">
                  <button className="btn primary block" onClick={() => copy(clientUrl, toast, 'Client link copied')}><Copy {...I} />Copy client link</button>
                  <a className="btn ghost sm" href={clientUrl} target="_blank" rel="noreferrer"><ExternalLink {...I} />Open</a>
                  {d.client_phone ? <a className="btn ghost sm" href={waLink(d.client_phone, shareText)} target="_blank" rel="noreferrer"><MessageCircle {...I} />WhatsApp</a> : null}
                  {d.client_email ? <a className="btn ghost sm" href={`mailto:${d.client_email}?subject=${encodeURIComponent(d.title || 'Our proposal')}&body=${encodeURIComponent(shareText)}`}><Mail {...I} />Email</a> : null}
                  {writable && ['draft', 'expired'].includes(row.status) ? <button className="btn ghost sm" disabled={busy} onClick={() => status('sent')}><Send {...I} />Mark as sent</button> : null}
                  {writable && row.status !== 'signed' ? <button className="btn ghost sm" disabled={busy} onClick={() => status('signed')}><CircleCheck {...I} />Mark accepted</button> : null}
                </div> : null}
                <div className="pp-actions">
                  {writable && clientUrl ? <button className="btn ghost sm" disabled={busy} onClick={() => runIt(async () => { await api(`/proposals/${id}/revoke`, { body: { revoked: !row.revoked } }); toast(row.revoked ? 'Link switched back on' : 'Link switched off'); reload?.(); })}>{row.revoked ? <><LockOpen {...I} />Restore link</> : <><Lock {...I} />Switch link off</>}</button> : null}
                  {can(user, 'editor') ? <button className="btn ghost sm danger" onClick={() => { if (confirm(`Delete ${row.number}? This can’t be undone.`)) runIt(async () => { await api(`/proposals/${id}`, { method: 'DELETE' }); toast('Deleted'); go('/proposals'); }); }}><Trash2 {...I} />Delete</button> : null}
                </div>
              </Card>
            ) : <Card><p className="muted small">Save to get the client link. Opens are tracked so you can see when the client reads it.</p></Card>}
            {clientUrl && row?.page_slug ? <Card title="Preview" actions={<a className="btn sm ghost" href={clientUrl} target="_blank" rel="noreferrer"><Eye {...I} />Full size</a>}>
              <div className="pp-thumb" style={{ aspectRatio: '16 / 11', overflow: 'hidden', borderRadius: 8, border: '1px solid var(--line, #e5e5e5)' }}>
                <iframe title="Proposal page preview" src={clientUrl} style={{ width: '250%', height: '250%', transform: 'scale(.4)', transformOrigin: '0 0', border: 0, pointerEvents: 'none' }} />
              </div>
            </Card> : null}
          </aside>
        </div>
      )}
    </Page>
  );
}
