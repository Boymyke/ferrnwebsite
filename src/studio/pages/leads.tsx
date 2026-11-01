import React, { useMemo, useState } from 'react';
import { api, can, create, fmtDate, list, ngn, update } from '../api';
import { Badge, Card, Drawer, EditedBy, Empty, ErrorNote, Fields, History, Loading, Page, Status, Tabs, useData, useRoute, useToast, useUser, waLink, type FieldDef } from '../ui';

export const LEAD_STATUSES = ['New', 'Preview ready', 'Queued', 'WhatsApp ready', 'Contacted', 'Following up', 'Replied', 'Interested', 'Call booked', 'Proposal sent', 'Won', 'Lost', 'Opted out', 'Bounced'];
export const NICHES = ['clinic', 'school', 'logistics', 'realestate', 'hospitality', 'solar', 'ngo', 'ecommerce', 'professional', 'other'];
const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Benin City', 'Kaduna', 'Owerri', 'Uyo', 'London', 'Houston', 'Toronto'];

const LEAD_FIELDS: FieldDef[] = [
  { name: 'company', label: 'Company' }, { name: 'status', label: 'Status', type: 'select', options: LEAD_STATUSES },
  { name: 'contact_name', label: 'Contact name' }, { name: 'role', label: 'Role' },
  { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone / WhatsApp' },
  { name: 'website', label: 'Website', type: 'url' }, { name: 'niche', label: 'Niche', type: 'select', options: NICHES },
  { name: 'city', label: 'City' }, { name: 'country', label: 'Country' },
  { name: 'tier', label: 'Tier', type: 'select', options: ['A', 'B', 'C'] }, { name: 'est_value', label: 'Estimated value (₦)', type: 'number' },
  { name: 'gaps', label: 'Gaps found (what is broken)', type: 'textarea' }, { name: 'pitch', label: 'Pitch', type: 'textarea' },
  { name: 'next_action', label: 'Next action', wide: true }, { name: 'notes', label: 'Notes', type: 'textarea', rows: 5 },
];

export function Leads() {
  const { path, go } = useRoute();
  const user = useUser();
  const toast = useToast();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [status, setStatus] = useState('');
  const [niche, setNiche] = useState('');
  const [view, setView] = useState<'table' | 'board'>('table');
  const { data, error, loading, reload } = useData(() => list('leads', { q, status, niche }), [q, status, niche]);
  const openId = path.match(/^\/leads\/([^/]+)/)?.[1];
  const [adding, setAdding] = useState(false);
  const total = useMemo(() => (data ?? []).reduce((a: number, l: any) => a + (Number(l.est_value) || 0), 0), [data]);

  return (
    <Page title="Leads" sub={`${data?.length ?? 0} leads · ${ngn(total)} estimated value`}
      actions={<>
        <button className="btn ghost" onClick={() => go('/prospect')}>🔎 Find leads</button>
        {can(user, 'sales') ? <button className="btn primary" onClick={() => setAdding(true)}>+ Add lead</button> : null}
      </>}>
      <div className="toolbar">
        <input className="search" placeholder="Search company, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={niche} onChange={(e) => setNiche(e.target.value)}><option value="">All niches</option>{NICHES.map((s) => <option key={s}>{s}</option>)}</select>
        <Tabs tabs={[['table', 'Table'], ['board', 'Board']]} value={view} onChange={(v) => setView(v as any)} />
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !data?.length ? <Empty title="No leads match" /> : view === 'table' ? (
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr><th>Company</th><th>Niche · City</th><th>Tier</th><th>Status</th><th>Value</th><th>Last contact</th><th>Next action</th></tr></thead>
            <tbody>{data.map((l: any) => (
              <tr key={l.id} onClick={() => go(`/leads/${l.id}`)}>
                <td><strong>{l.company}</strong>{l.needs_you === 'Y' ? <Badge tone="orange">needs you</Badge> : null}<div className="muted small">{l.email || l.phone || ''}</div></td>
                <td>{l.niche} · {l.city}</td><td>{l.tier}</td><td><Status s={l.status} /></td><td>{ngn(l.est_value)}</td>
                <td className="muted">{fmtDate(l.last_contact)}</td><td className="muted small">{(l.next_action || '').slice(0, 60)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="board">
          {['New', 'Contacted', 'Following up', 'Replied', 'Interested', 'Call booked', 'Proposal sent', 'Won'].map((s) => {
            const col = data.filter((l: any) => l.status === s || (s === 'New' && ['Queued', 'Preview ready', 'WhatsApp ready'].includes(l.status)));
            return (
              <div className="board-col" key={s} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
                const id = e.dataTransfer.getData('text/plain');
                try { await update('leads', id, { status: s }); toast(`Moved to ${s}`); reload(); } catch (x: any) { toast(x.message, 'err'); }
              }}>
                <h4>{s} <span>{col.length}</span></h4>
                {col.map((l: any) => (
                  <div key={l.id} className="board-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)} onClick={() => go(`/leads/${l.id}`)}>
                    <strong>{l.company}</strong><span className="muted small">{l.niche} · {l.city}</span><span className="small">{ngn(l.est_value)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {openId ? <LeadDrawer id={openId} onClose={() => { go('/leads'); reload(); }} /> : null}
      {adding ? <NewLead onClose={() => { setAdding(false); reload(); }} /> : null}
    </Page>
  );
}

function NewLead({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState<Record<string, any>>({ status: 'New', country: 'Nigeria' });
  const toast = useToast();
  return (
    <Drawer open title="Add a lead" onClose={onClose}>
      <Fields fields={LEAD_FIELDS} value={v} onChange={setV} />
      <div className="drawer-actions"><button className="btn primary" onClick={async () => {
        if (!v.company) return toast('Company is required', 'err');
        try { await create('leads', v); toast('Lead added'); onClose(); } catch (x: any) { toast(x.message, 'err'); }
      }}>Save lead</button></div>
    </Drawer>
  );
}

function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const { go } = useRoute();
  const { data: lead, error, setData } = useData(() => api(`/r/leads/${id}`).then((r) => r.row), [id]);
  const { data: engine } = useData(() => api(`/engine/lead/${id}`).then((r) => r.data).catch(() => null), [id]);
  const [tab, setTab] = useState('details');
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const v = draft ?? lead ?? {};
  if (error) return <Drawer open title="Lead" onClose={onClose}><ErrorNote error={error} /></Drawer>;
  if (!lead) return <Drawer open title="Lead" onClose={onClose}><Loading /></Drawer>;
  const save = async () => {
    try { const row = await update('leads', id, draft!); setData(row); setDraft(null); toast('Saved'); } catch (x: any) { toast(x.message, 'err'); }
  };
  const waText = `Hello ${lead.contact_name || lead.company + ' team'}, this is Michael from Ferrn Digital Agency.`;
  return (
    <Drawer open wide onClose={onClose} title={<>{lead.company} <Status s={lead.status} /></>}>
      <div className="lead-actions">
        {lead.phone ? <a className="btn sm ghost" href={waLink(lead.phone, waText)} target="_blank" rel="noreferrer">WhatsApp</a> : null}
        {lead.phone ? <a className="btn sm ghost" href={`tel:${lead.phone}`}>Call</a> : null}
        {lead.email ? <a className="btn sm ghost" href={`mailto:${lead.email}`}>Email</a> : null}
        {lead.website ? <a className="btn sm ghost" href={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} target="_blank" rel="noreferrer">Website ↗</a> : null}
        {lead.preview_url ? <a className="btn sm ghost" href={lead.preview_url} target="_blank" rel="noreferrer">Concept preview ↗</a> : null}
        <button className="btn sm" onClick={() => go(`/meetings/new?lead=${id}`)}>📅 Book meeting</button>
        <button className="btn sm primary" onClick={() => go(`/quotes/new?lead=${id}`)}>Draft quote</button>
      </div>
      <EditedBy row={lead} />
      <Tabs tabs={[['details', 'Details'], ['outreach', `Outreach${engine?.messages ? ` (${engine.messages.length})` : ''}`], ['history', 'History']]} value={tab} onChange={setTab} />
      {tab === 'details' ? (
        <>
          <Fields fields={LEAD_FIELDS} value={v} onChange={setDraft} disabled={!can(user, 'sales')} />
          {draft ? <div className="drawer-actions sticky"><button className="btn ghost" onClick={() => setDraft(null)}>Discard</button><button className="btn primary" onClick={save}>Save changes</button></div> : null}
          <p className="muted small">Source: {lead.source || lead.origin} · Created {fmtDate(lead.created)} {lead.origin === 'engine' ? '· Synced with LeadsHunter' : ''}</p>
        </>
      ) : tab === 'outreach' ? (
        engine ? (
          <div className="thread">
            {[...(engine.messages || []).map((m: any) => ({ ...m, kind: 'out', at: m.sent_at || m.send_after })), ...(engine.inbox || []).map((m: any) => ({ ...m, kind: 'in', at: m.received_at }))]
              .sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)))
              .map((m: any) => (
                <div key={m.id} className={`bubble ${m.kind}`}>
                  <div className="bubble-meta">{m.kind === 'out' ? `Step ${m.step} · ${m.channel}` : m.from} · {fmtDate(m.at, true)} · <Status s={m.status || m.classification} /></div>
                  {m.subject ? <strong>{m.subject}</strong> : null}
                  <p>{m.body}</p>
                </div>
              ))}
          </div>
        ) : <Empty title="No outreach history">Leads found by the LeadsHunter routine show their emails and replies here once the engine is connected (Settings).</Empty>
      ) : <History entity="leads" id={id} />}
    </Drawer>
  );
}

/* ── Find leads: Google Maps ── */
export function Prospect() {
  const toast = useToast();
  const [niche, setNiche] = useState('clinic');
  const [city, setCity] = useState('Lagos');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | undefined>();
  const search = async (page?: string) => {
    setBusy(true);
    try {
      const r = await api('/prospects/search', { body: { niche: NICHE_QUERY[niche] ?? niche, city, query, page } });
      setResults(page ? [...(results ?? []), ...r.results] : r.results); setNext(r.next);
      if (!page) setPicked(Object.fromEntries(r.results.filter((x: any) => !x.already && x.score >= 70).map((x: any) => [x.place_id, true])));
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const add = async () => {
    const items = (results ?? []).filter((x) => picked[x.place_id]);
    try { const r = await api('/prospects/add', { body: { niche, city, items } }); toast(`${r.added} leads added`); setPicked({}); search(); } catch (x: any) { toast(x.message, 'err'); }
  };
  return (
    <Page title="Find leads" sub="Search Google Maps for businesses, score the opportunity, and add the best ones to your pipeline.">
      <Card>
        <div className="toolbar">
          <select value={niche} onChange={(e) => setNiche(e.target.value)}>{Object.keys(NICHE_QUERY).map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <input list="cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="…or a custom query, e.g. “fertility clinics in Lekki”" />
          <button className="btn primary" disabled={busy} onClick={() => search()}>{busy ? 'Searching…' : 'Search Maps'}</button>
        </div>
        <p className="muted small">Score: +30 no website, +20 social/free page as website, +8 few reviews, +7 busy (100+ reviews). Other channels the AI routine already covers: Finelib, ConnectCiti, BusinessList, LinkedIn, Instagram bios and Google search.</p>
      </Card>
      {results ? (
        <Card title={`${results.length} businesses`} actions={<button className="btn primary" disabled={!Object.values(picked).some(Boolean)} onClick={add}>Add {Object.values(picked).filter(Boolean).length} to leads</button>}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th></th><th>Business</th><th>Score</th><th>Why</th><th>Website</th><th>Phone</th><th>Rating</th></tr></thead>
            <tbody>{results.map((x) => (
              <tr key={x.place_id} className={x.already ? 'dim' : ''}>
                <td><input type="checkbox" disabled={x.already} checked={!!picked[x.place_id]} onChange={(e) => setPicked({ ...picked, [x.place_id]: e.target.checked })} /></td>
                <td><strong>{x.name}</strong>{x.already ? <Badge>in leads</Badge> : null}<div className="muted small">{x.address}</div></td>
                <td><Badge tone={x.score >= 80 ? 'green' : x.score >= 65 ? 'orange' : 'default'}>{x.score}</Badge></td>
                <td className="small">{x.reasons.join(' · ')}</td>
                <td className="small">{x.website ? <a href={x.website} target="_blank" rel="noreferrer">{x.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</a> : <span className="muted">none</span>}</td>
                <td className="small">{x.phone ?? '—'}</td><td className="small">{x.rating ? `${x.rating} (${x.reviews})` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {next ? <button className="btn ghost" disabled={busy} onClick={() => search(next)}>Load more</button> : null}
        </Card>
      ) : null}
    </Page>
  );
}

const NICHE_QUERY: Record<string, string> = {
  clinic: 'private hospitals and clinics', school: 'private schools', logistics: 'logistics and freight companies',
  realestate: 'real estate agencies', hospitality: 'hotels and shortlets', solar: 'solar installation companies',
  ngo: 'NGOs and associations', ecommerce: 'fashion and beauty stores', professional: 'law firms and accounting firms', other: 'businesses',
};
