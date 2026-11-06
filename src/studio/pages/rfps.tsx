import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, FileSearch, Globe, Info, ListChecks, RefreshCw, ShieldAlert, Sparkles, Target } from 'lucide-react';
import { ago, api, can, fmtDate } from '../api';
import { Badge, Card, Drawer, Empty, ErrorNote, Loading, Page, Tabs, useData, useRoute, useToast, useUser, Pager, usePaged } from '../ui';

export type Rfp = {
  id: string; found: string; title: string; buyer: string; country: string; url: string; source: string; deadline: string | null;
  budget: string; scope: string; fit_score: number; fit_reasons: string; requirements: string; risks: string; next_step: string;
  status: RfpStatus; notes: string; updated: string;
};
type RfpStatus = 'new' | 'reviewing' | 'bidding' | 'submitted' | 'won' | 'lost' | 'skipped';

const STATUS: Record<RfpStatus, { label: string; tone: string }> = {
  new: { label: 'New', tone: 'orange' }, reviewing: { label: 'Reviewing', tone: 'blue' }, bidding: { label: 'Bidding', tone: 'purple' },
  submitted: { label: 'Submitted', tone: 'blue' }, won: { label: 'Won', tone: 'green' }, lost: { label: 'Lost', tone: 'red' }, skipped: { label: 'Skipped', tone: 'default' },
};
const OPEN: RfpStatus[] = ['new', 'reviewing', 'bidding'];

const daysLeft = (iso?: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5) : null);
function Due({ iso }: { iso?: string | null }) {
  const d = daysLeft(iso);
  if (d == null) return <span className="muted small">No deadline listed</span>;
  if (d < 0) return <Badge>Closed {fmtDate(iso!)}</Badge>;
  return <Badge tone={d <= 5 ? 'red' : d <= 14 ? 'orange' : 'default'}>{d === 0 ? 'Due today' : `${d} day${d === 1 ? '' : 's'} left`} · {fmtDate(iso!)}</Badge>;
}
const Fit = ({ n }: { n: number }) => <Badge tone={n >= 80 ? 'green' : n >= 65 ? 'orange' : 'default'}>Fit {n}</Badge>;

export function Rfps() {
  const { path } = useRoute();
  const { data, loading, error, reload, setData } = useData(() => api('/engine'), []);
  const [tab, setTab] = useState<'open' | 'all' | 'submitted' | 'closed' | 'skipped'>('open');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(location.search).get('id'));
  useEffect(() => { const id = new URLSearchParams(location.search).get('id'); if (id) setOpen(id); }, [path]);
  const rfps: Rfp[] = data?.data?.rfps ?? [];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rfps
      .filter((r) => tab === 'all' ? true : tab === 'open' ? OPEN.includes(r.status) : tab === 'submitted' ? r.status === 'submitted' : tab === 'closed' ? ['won', 'lost'].includes(r.status) : r.status === 'skipped')
      .filter((r) => !s || `${r.title} ${r.buyer} ${r.country} ${r.scope}`.toLowerCase().includes(s))
      .sort((a, b) => {
        if (tab !== 'open') return (b.found || '').localeCompare(a.found || '');
        const da = daysLeft(a.deadline), db = daysLeft(b.deadline);
        const pa = da == null || da < 0 ? 9999 : da, pb = db == null || db < 0 ? 9999 : db;
        return pa - pb || b.fit_score - a.fit_score;
      });
  }, [rfps, tab, q]);
  const openCount = rfps.filter((r) => OPEN.includes(r.status)).length;
  const dueWeek = rfps.filter((r) => OPEN.includes(r.status) && (daysLeft(r.deadline) ?? 99) >= 0 && (daysLeft(r.deadline) ?? 99) <= 7).length;
  const bidding = rfps.filter((r) => r.status === 'bidding').length;
  const submitted = rfps.filter((r) => ['submitted', 'won', 'lost'].includes(r.status)).length;
  const sel = rfps.find((r) => r.id === open) ?? null;

  const pg = usePaged<Rfp>(list, 'rfps', [q, tab]);
  if (loading && !data) return <Loading />;
  return (
    <Page title="RFPs" sub="Tenders and requests for proposals Ferrn qualifies for. The RFP scout searches public tender portals every weekday morning, checks each one against what Ferrn can win, and adds the good ones here."
      actions={<button className="btn ghost sm" onClick={reload}><RefreshCw size={14} /> Refresh</button>}>
      {error ? <ErrorNote error={error} onRetry={reload} /> : null}
      <div className="kpi-row">
        <div className="kpi feature">
          <div className="kpi-icon"><FileSearch size={24} strokeWidth={1.8} /></div>
          <h4>Open RFPs</h4>
          <strong>{openCount}</strong>
          <p style={{ paddingBottom: 18 }}>{rfps.length} found so far</p>
        </div>
        <div className="kpi"><h4><CalendarClock size={14} /> Due in 7 days</h4><strong>{dueWeek}</strong><span className="muted small">{dueWeek ? 'decide bid or skip' : 'nothing urgent'}</span></div>
        <div className="kpi"><h4><Target size={14} /> Bidding</h4><strong>{bidding}</strong><span className="muted small">in progress</span></div>
        <div className="kpi"><h4><CheckCircle2 size={14} /> Submitted</h4><strong>{submitted}</strong><span className="muted small">{rfps.filter((r) => r.status === 'won').length} won</span></div>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search title, buyer, country…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs tabs={[['open', `Open (${openCount})`], ['all', 'All'], ['submitted', 'Submitted'], ['closed', 'Won / lost'], ['skipped', 'Skipped']]} value={tab} onChange={(v) => setTab(v as any)} />
      </div>
      {!list.length ? (
        <Empty icon={FileSearch} title={rfps.length ? 'Nothing in this tab' : 'No RFPs yet'}>
          {rfps.length ? 'Try another tab.' : 'The RFP scout runs every weekday at 9:17am Lagos time. Tenders Ferrn qualifies for appear here with a fit score, the deadline and what the buyer needs.'}
        </Empty>
      ) : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>RFP</th><th>Deadline</th><th>Budget</th><th>Fit</th><th>Status</th></tr></thead>
          <tbody>{pg.rows.map((r) => (
            <tr key={r.id} onClick={() => setOpen(r.id)}>
              <td><strong>{r.title}</strong><div className="muted small">{[r.buyer, r.country].filter(Boolean).join(' · ')}{r.source ? ` · via ${r.source}` : ''}</div></td>
              <td><Due iso={r.deadline} /></td>
              <td className="small">{r.budget || <span className="muted">Not stated</span>}</td>
              <td><Fit n={r.fit_score} /></td>
              <td><Badge tone={STATUS[r.status]?.tone ?? 'default'}>{STATUS[r.status]?.label ?? r.status}</Badge></td>
            </tr>
          ))}</tbody>
        </table><Pager pg={pg} noun="RFPs" /></div>
      )}
      <p className="muted small" style={{ marginTop: 14 }}><Info size={13} style={{ verticalAlign: -2 }} /> The scout never registers on portals, contacts buyers or submits anything. You decide what to bid on, and submit yourself.</p>
      {sel ? <RfpDrawer r={sel} onClose={() => { setOpen(null); if (location.search.includes('id=')) history.replaceState(null, '', '/studio/rfps'); }} onData={(d) => setData({ ...data, data: d })} /> : null}
    </Page>
  );
}

function RfpDrawer({ r, onClose, onData }: { r: Rfp; onClose: () => void; onData: (d: any) => void }) {
  const toast = useToast();
  const user = useUser();
  const { go } = useRoute();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (params: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try { const res = await api('/engine/action', { body: { action: 'rfpStatus', params: { id: r.id, ...params } } }); onData(res.data); toast(msg); setNote(''); }
    catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const edit = can(user, 'sales');
  const Section = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => text ? (
    <div className="rfp-sec"><h4>{icon}{title}</h4><p>{text}</p></div>
  ) : null;
  return (
    <Drawer open wide onClose={onClose} title={r.title}>
      <div className="rfp-head">
        <div className="muted">{[r.buyer, r.country].filter(Boolean).join(' · ')}</div>
        <div className="rfp-badges"><Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label}</Badge><Fit n={r.fit_score} /><Due iso={r.deadline} />{r.budget ? <Badge>{r.budget}</Badge> : null}</div>
        <a className="btn primary sm" href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open the RFP</a>
      </div>
      <Section icon={<Globe size={15} />} title="What they want" text={r.scope} />
      <Section icon={<Sparkles size={15} />} title="Why Ferrn fits" text={r.fit_reasons} />
      <Section icon={<ListChecks size={15} />} title="What they ask for" text={r.requirements} />
      <Section icon={<ShieldAlert size={15} />} title="Watch out for" text={r.risks} />
      <Section icon={<Target size={15} />} title="Suggested next step" text={r.next_step} />
      {r.notes ? <div className="rfp-sec"><h4><Info size={15} />Notes</h4><p style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</p></div> : null}
      <p className="muted small">Found {ago(r.found)}{r.source ? ` on ${r.source}` : ''}. Always read the full RFP before deciding: the scout's summary can miss conditions.</p>
      {edit ? (
        <>
          <div className="rfp-actions">
            {r.status !== 'bidding' ? <button className="btn sm primary" disabled={busy} onClick={() => act({ status: 'bidding' }, 'Marked as bidding')}>We’re bidding</button> : null}
            {r.status === 'new' ? <button className="btn sm ghost" disabled={busy} onClick={() => act({ status: 'reviewing' }, 'Marked as reviewing')}>Reviewing</button> : null}
            {['bidding', 'reviewing'].includes(r.status) ? <button className="btn sm ghost" disabled={busy} onClick={() => act({ status: 'submitted' }, 'Marked as submitted')}>Submitted</button> : null}
            {r.status === 'submitted' ? <>
              <button className="btn sm ghost" disabled={busy} onClick={() => act({ status: 'won' }, 'Marked as won')}>Won</button>
              <button className="btn sm ghost" disabled={busy} onClick={() => act({ status: 'lost' }, 'Marked as lost')}>Lost</button>
            </> : null}
            {OPEN.includes(r.status) ? <button className="btn sm ghost danger" disabled={busy} onClick={() => act({ status: 'skipped' }, 'Skipped')}>Skip</button> : null}
            {r.status === 'skipped' ? <button className="btn sm ghost" disabled={busy} onClick={() => act({ status: 'reviewing' }, 'Moved back to open')}>Reopen</button> : null}
            {['bidding', 'reviewing'].includes(r.status) ? <button className="btn sm ghost" onClick={() => go('/proposals/new')}>Start a proposal</button> : null}
          </div>
          <div className="rfp-note">
            <textarea rows={2} placeholder="Add a note (questions to ask, who's writing which section…)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn sm" disabled={busy || !note.trim()} onClick={() => act({ note: note.trim() }, 'Note added')}>Add note</button>
          </div>
        </>
      ) : null}
      {daysLeft(r.deadline) != null && (daysLeft(r.deadline) as number) <= 5 && (daysLeft(r.deadline) as number) >= 0 && OPEN.includes(r.status)
        ? <div className="callout" style={{ marginTop: 14 }}><AlertTriangle size={15} /> Due in {daysLeft(r.deadline)} day(s). Decide today whether to bid.</div> : null}
    </Drawer>
  );
}
