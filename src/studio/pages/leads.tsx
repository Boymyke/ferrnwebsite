import React, { useMemo, useState } from 'react';
import { ago, api, can, create, fmtDate, list, ngn, update } from '../api';
import { Badge, Card, Drawer, EditedBy, Empty, ErrorNote, Fields, History, Loading, Page, Status, Tabs, useData, useRoute, useToast, useUser, waLink, type FieldDef } from '../ui';
import { Bot, CalendarPlus, ExternalLink, Globe, MailOpen, MessageCircle, Radar, SearchX, UserPlus, Workflow, MapPin, Play, Sparkles, Zap, Plus, X as XIcon } from 'lucide-react';

/** Where a lead came from, as an icon chip. */
export function LeadOrigin({ l }: { l: any; full?: boolean }) {
  const src = String(l.source || '');
  const [Icon, label, tone] =
    l.found_by === 'claude' ? [Bot, 'Found by Claude', 'purple'] :
    l.found_by === 'auto' ? [Radar, 'Autopilot', 'purple'] :
    l.origin === 'engine' ? [Workflow, 'LeadsHunter', 'purple'] :
    l.origin === 'maps' ? [MapPin, 'Google Maps', 'purple'] :
    l.origin === 'website' ? (/whatsapp/i.test(src) ? [MessageCircle, 'WhatsApp', 'green'] : /chat/i.test(src) ? [MessageCircle, 'Website chat', 'green'] : [Globe, 'Website', 'green']) :
    l.origin === 'referral' ? [UserPlus, 'Referral', 'green'] : [UserPlus, 'Added by team', 'default'];
  return <span className={`origin-chip ${tone}`} title={src || label}><Icon size={12} strokeWidth={2.2} />{label}</span>;
}


export const LEAD_STATUSES = ['New', 'Preview ready', 'Queued', 'WhatsApp ready', 'Contacted', 'Following up', 'Replied', 'Interested', 'Call booked', 'Proposal sent', 'Won', 'Lost', 'Opted out', 'Bounced'];
export const NICHES = ['clinic', 'school', 'logistics', 'realestate', 'hospitality', 'solar', 'ngo', 'ecommerce', 'professional', 'other'];
const CITIES = ['Lagos', 'Lekki', 'Ikeja', 'Victoria Island', 'London', 'Manchester', 'Birmingham', 'Houston', 'Atlanta', 'Dallas', 'New York', 'Toronto', 'Dubai'];

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
  const [kind, setKind] = useState(() => new URLSearchParams(location.search).get('kind') ?? '');
  const { data, error, loading, reload } = useData(() => list('leads', { q, status, niche, kind }), [q, status, niche, kind]);
  const counts = useData(() => api<{ counts: Record<string, number> }>('/leads/counts').then((r) => r.counts), [data?.length]);
  const openId = path.match(/^\/leads\/([^/]+)/)?.[1];
  const [adding, setAdding] = useState(false);
  const total = useMemo(() => (data ?? []).reduce((a: number, l: any) => a + (Number(l.est_value) || 0), 0), [data]);

  return (
    <Page title="Leads" sub={`${data?.length ?? 0} leads · ${ngn(total)} estimated value`}
      actions={<>
        <button className="btn ghost" onClick={() => go('/prospect')}><Radar size={15} strokeWidth={2} />Find leads</button>
        {can(user, 'sales') ? <button className="btn primary" onClick={() => setAdding(true)}><Plus size={15} strokeWidth={2.2} />Add lead</button> : null}
      </>}>
      <div className="lead-kinds">
        {([['', 'All leads', Sparkles, 'Everything in the pipeline'], ['inbound', 'Inbound', Globe, 'Came to us: website forms, chat, WhatsApp, referrals'], ['found', 'Found by us', Bot, 'Claude, autopilot, LeadsHunter and Maps searches'], ['team', 'Added by team', UserPlus, 'Typed in by someone on the team']] as const).map(([k, label, Icon, hint]) => (
          <button key={k} className={`lead-kind ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)} title={hint}>
            <Icon size={16} strokeWidth={1.9} /><span>{label}</span><b>{counts.data ? (k ? counts.data[k] : counts.data.all) : '·'}</b>
            {k === 'inbound' && counts.data?.inbound_week ? <em>+{counts.data.inbound_week} this week</em> : null}
            {k === 'found' && counts.data ? <em>{counts.data.claude} Claude · {counts.data.auto} autopilot · {counts.data.engine} engine</em> : null}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search company, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={niche} onChange={(e) => setNiche(e.target.value)}><option value="">All niches</option>{NICHES.map((s) => <option key={s}>{s}</option>)}</select>
        <Tabs tabs={[['table', 'Table'], ['board', 'Board']]} value={view} onChange={(v) => setView(v as any)} />
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !data?.length ? (kind === 'inbound' ? <Empty icon={Globe} title="No website leads yet">Contact forms, chat and WhatsApp enquiries appear here automatically.</Empty>
        : kind === 'found' ? <Empty icon={Bot} title="No found leads yet" action={<button className="btn sm primary" onClick={() => go('/prospect')}><Radar size={14} />Open lead finder</button>}>Turn on the autopilot or connect LeadsHunter and leads start arriving here.</Empty>
        : <Empty icon={SearchX} title="No leads match">Try clearing a filter or searching another name.</Empty>) : view === 'table' ? (
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr><th>Company</th><th>Niche · City</th><th>Tier</th><th>Status</th><th>Value</th><th>Last contact</th><th>Next action</th></tr></thead>
            <tbody>{data.map((l: any) => (
              <tr key={l.id} onClick={() => go(`/leads/${l.id}`)}>
                <td><strong>{l.company}</strong>{l.needs_you === 'Y' ? <Badge tone="orange">needs you</Badge> : null}<div className="lead-sub"><LeadOrigin l={l} /><span className="muted small">{l.email || l.phone || ''}</span></div></td>
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
        {lead.website ? <a className="btn sm ghost" href={lead.website.startsWith('http') ? lead.website : 'https://' + lead.website} target="_blank" rel="noreferrer"><Globe size={14} strokeWidth={2} />Website</a> : null}
        {lead.preview_url ? <a className="btn sm ghost" href={lead.preview_url} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} />Concept preview</a> : null}
        <button className="btn sm" onClick={() => go(`/meetings/new?lead=${id}`)}><CalendarPlus size={14} strokeWidth={2} />Book meeting</button>
        <button className="btn sm primary" onClick={() => go(`/quotes/new?lead=${id}`)}>Draft quote</button>
      </div>
      <EditedBy row={lead} />
      <Tabs tabs={[['details', 'Details'], ['outreach', `Outreach${engine?.messages ? ` (${engine.messages.length})` : ''}`], ['history', 'History']]} value={tab} onChange={setTab} />
      {tab === 'details' ? (
        <>
          <Fields fields={LEAD_FIELDS} value={v} onChange={setDraft} disabled={!can(user, 'sales')} />
          {draft ? <div className="drawer-actions sticky"><button className="btn ghost" onClick={() => setDraft(null)}>Discard</button><button className="btn primary" onClick={save}>Save changes</button></div> : null}
          <p className="muted small"><LeadOrigin l={lead} full /> {lead.source ? `· ${lead.source}` : ''} · Created {fmtDate(lead.created)} {lead.origin === 'engine' ? '· Synced with LeadsHunter' : ''}</p>
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
        ) : <Empty compact icon={MailOpen} title="No outreach history">Leads found by the LeadsHunter routine show their emails and replies here once the engine is connected (Settings).</Empty>
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
    <Page title="Find leads" sub="Leads are found for you: the autopilot searches Google Maps every few minutes, scores each business and adds the best ones to Leads → Found by us. You can still search by hand below.">
      <Autopilot />
      <Card title="Search by hand">
        <div className="toolbar">
          <select value={niche} onChange={(e) => setNiche(e.target.value)}>{Object.keys(NICHE_QUERY).map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <input list="cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="…or a custom query, e.g. “fertility clinics in Lekki”" />
          <button className="btn primary" disabled={busy} onClick={() => search()}>{busy ? 'Searching…' : 'Search Maps'}</button>
        </div>
        <p className="muted small">Each business’s own website is checked for a published email and visible gaps (no HTTPS, not mobile-friendly, outdated footer, no enquiry form, Gmail address). Businesses with an email come first. Score: +15 email found, up to +24 for website gaps, +20 no website or a social page, +8 busy (100+ reviews).</p>
      </Card>
      {results ? (
        <Card title={`${results.length} businesses`} actions={<button className="btn primary" disabled={!Object.values(picked).some(Boolean)} onClick={add}>Add {Object.values(picked).filter(Boolean).length} to leads</button>}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th></th><th>Business</th><th>Score</th><th>Reach by</th><th>Why</th><th>Website</th><th>Rating</th></tr></thead>
            <tbody>{results.map((x) => (
              <tr key={x.place_id} className={x.already ? 'dim' : ''}>
                <td><input type="checkbox" disabled={x.already} checked={!!picked[x.place_id]} onChange={(e) => setPicked({ ...picked, [x.place_id]: e.target.checked })} /></td>
                <td><strong>{x.name}</strong>{x.already ? <Badge>in leads</Badge> : null}<div className="muted small">{x.address}</div></td>
                <td><Badge tone={x.score >= 80 ? 'green' : x.score >= 65 ? 'orange' : 'default'}>{x.score}</Badge></td>
                <td className="small">{x.emails?.length ? <><Badge tone="green">Email</Badge><div>{x.emails[0]}</div></> : x.phone ? <><Badge>WhatsApp</Badge><div>{x.phone}</div></> : <span className="muted">—</span>}</td>
                <td className="small">{x.reasons.filter((r: string) => r !== 'Email published on their site').join(' · ')}</td>
                <td className="small">{x.website ? <a href={x.website} target="_blank" rel="noreferrer">{x.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</a> : <span className="muted">none</span>}</td>
                <td className="small">{x.rating ? `${x.rating} (${x.reviews})` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {next ? <button className="btn ghost" disabled={busy} onClick={() => search(next)}>Load more</button> : null}
        </Card>
      ) : null}
    </Page>
  );
}

function Chips({ value, onChange, options, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; options?: string[]; placeholder: string; disabled?: boolean }) {
  const [t, setT] = useState('');
  const add = (x: string) => { const v = x.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="chips">
      {value.map((v) => <span key={v} className="chip">{v}{disabled ? null : <button aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><XIcon size={12} /></button>}</span>)}
      {disabled ? null : <>
        <input list={options ? placeholder : undefined} value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(t); } }} onBlur={() => t && add(t)} />
        {options ? <datalist id={placeholder}>{options.filter((o) => !value.includes(o)).map((o) => <option key={o} value={o} />)}</datalist> : null}
      </>}
    </div>
  );
}

function Autopilot() {
  const toast = useToast();
  const user = useUser();
  const { go } = useRoute();
  const { data, reload } = useData(() => api('/prospects/auto'), []);
  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const c = cfg ?? data?.config;
  const admin = can(user, 'admin');
  if (!c) return <Card><Loading /></Card>;
  const dirty = !!cfg;
  const save = async (next = c) => { try { await api('/prospects/auto', { method: 'PUT', body: next }); setCfg(null); reload(); toast(next.enabled ? 'Autopilot saved — it runs on the next cycle' : 'Autopilot saved'); } catch (x: any) { toast(x.message, 'err'); } };
  const runNow = async () => { setBusy(true); try { const r = await api('/prospects/auto/run', { body: {} }); toast(`Searched “${r.result.query}” · ${r.result.added} new leads`); reload(); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } };
  const days = data?.byDay ?? [];
  const max = Math.max(1, ...days.map((d: any) => Number(d.auto) + Number(d.claude)));
  const pairs = c.niches.length * c.cities.length;
  return (
    <Card className="autopilot" title={<span className="ap-title"><Zap size={16} />Lead autopilot <Badge tone={c.enabled ? 'green' : 'default'}>{c.enabled ? 'on' : 'off'}</Badge></span>}
      actions={<>
        <button className="btn sm ghost" disabled={busy || !data?.hasKey} onClick={runNow}><Play size={14} />{busy ? 'Searching…' : 'Run once now'}</button>
        {admin ? <label className="switch"><input type="checkbox" checked={!!c.enabled} onChange={(e) => save({ ...c, enabled: e.target.checked })} /><span />{c.enabled ? 'On' : 'Off'}</label> : null}
      </>}>
      {!data?.hasKey ? (
        <div className="callout">
          <strong>One thing needed:</strong> a Google Maps key so the autopilot can search on its own. Create one at console.cloud.google.com → APIs &amp; Services → enable <em>Places API (New)</em> → Credentials → Create API key, then add it in Cloudflare → Workers → ferrn → Settings → Variables and Secrets as the secret <code>GOOGLE_MAPS_API_KEY</code>. Until then, Claude adds leads it finds directly (they show as <Bot size={12} /> Found by Claude).
        </div>
      ) : null}
      <div className="ap-grid">
        <div className="ap-field"><span className="side-label">Niches</span><Chips value={c.niches} options={data?.niches} placeholder="niches" disabled={!admin} onChange={(v) => setCfg({ ...c, niches: v })} /></div>
        <div className="ap-field"><span className="side-label">Cities · Lagos + abroad</span><Chips value={c.cities} options={data?.cities ?? CITIES} placeholder="cities" disabled={!admin} onChange={(v) => setCfg({ ...c, cities: v })} /></div>
        <label className="ap-field"><span className="side-label">New leads per day</span><input type="number" min={1} max={200} disabled={!admin} value={c.dailyCap} onChange={(e) => setCfg({ ...c, dailyCap: Number(e.target.value) })} /></label>
        <label className="ap-field"><span className="side-label">Minimum score</span><input type="number" min={0} max={100} disabled={!admin} value={c.minScore} onChange={(e) => setCfg({ ...c, minScore: Number(e.target.value) })} /></label>
        <label className="ap-field"><span className="side-label">WhatsApp-only leads (max %)</span><input type="number" min={0} max={100} disabled={!admin} value={c.whatsappShare ?? 20} onChange={(e) => setCfg({ ...c, whatsappShare: Number(e.target.value) })} /></label>
      </div>
      <p className="muted small">{pairs} searches in rotation, one every 10 minutes, each at most once a day. Email first: leads with a published email fill the day and go to LeadsHunter, where the morning routine writes and queues their emails. Phone-only leads are kept for Lagos only, up to {c.whatsappShare ?? 20}% of the day. {c.lastRun ? <>Last run {ago(c.lastRun.at)}: “{c.lastRun.query}” — {c.lastRun.seen} businesses seen{c.lastRun.emails != null ? `, ${c.lastRun.emails} with an email` : ''}, {c.lastRun.added} added{c.lastRun.error ? <span className="err"> · {c.lastRun.error}</span> : null}.</> : 'Not run yet.'}</p>
      {dirty && admin ? <div className="row-actions"><button className="btn sm primary" onClick={() => save()}>Save changes</button><button className="btn sm ghost" onClick={() => setCfg(null)}>Discard</button></div> : null}
      <div className="ap-bottom">
        <div className="ap-chart" aria-label="Leads found per day, last 30 days">
          <span className="side-label">Found per day · 30 days</span>
          <div className="ap-bars">{Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
            const row = days.find((x: any) => x.day === d); const a = Number(row?.auto ?? 0), cl = Number(row?.claude ?? 0);
            return <i key={d} title={`${d}: ${a} autopilot, ${cl} Claude`}><b style={{ height: `${(a / max) * 100}%` }} /><b className="cl" style={{ height: `${(cl / max) * 100}%` }} /></i>;
          })}</div>
          <span className="ap-legend"><i /> autopilot <i className="cl" /> Claude</span>
        </div>
        <div className="ap-recent">
          <span className="side-label">Latest found</span>
          {(data?.recent ?? []).slice(0, 6).map((l: any) => (
            <button key={l.id} className="ap-lead" onClick={() => go(`/leads/${l.id}`)}>
              <strong>{l.company}</strong><span className="muted small">{l.niche} · {l.city} · {l.email ? 'email' : l.phone ? 'WhatsApp' : '—'}</span><Badge tone={l.score >= 80 ? 'green' : 'orange'}>{l.score ?? '—'}</Badge>
            </button>
          ))}
          {!data?.recent?.length ? <p className="muted small">Nothing yet.</p> : <button className="link small" onClick={() => go('/leads?kind=found')}>See all found leads</button>}
        </div>
      </div>
    </Card>
  );
}

const NICHE_QUERY: Record<string, string> = {
  clinic: 'private hospitals and clinics', school: 'private schools', logistics: 'logistics and freight companies',
  realestate: 'real estate agencies', hospitality: 'hotels and shortlets', solar: 'solar installation companies',
  ngo: 'NGOs and associations', ecommerce: 'fashion and beauty stores', professional: 'law firms and accounting firms', other: 'businesses',
};
