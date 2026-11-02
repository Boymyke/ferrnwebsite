import React, { useEffect, useState } from 'react';
import { AlertTriangle, Eye, ExternalLink, Info, Mail, MailCheck, MailOpen, MapPin, MousePointerClick, RefreshCw, Send } from 'lucide-react';
import { ago, api, fmtDate } from '../api';
import { Badge, Card, Drawer, Empty, ErrorNote, Loading, Page, Tabs, useData, useRoute } from '../ui';

type Row = {
  id: string; source: 'site' | 'outreach'; kind: string; to_addr: string; subject: string | null; company: string | null;
  proposal_id: string | null; invoice_id: string | null; lead_id: string | null; status: string; error: string | null;
  sent_at: string; delivered_at: string | null; open_count: number; first_opened_at: string | null; last_opened_at: string | null;
  click_count: number; first_clicked_at: string | null; last_clicked_at: string | null;
};
type Stats = { sent: number; delivered: number; opened: number; clicked: number; problems: number };
type ListRes = { ready: boolean; rows: Row[]; stats: Stats };
type Ev = { kind: 'open' | 'click'; url: string | null; ua: string | null; country: string | null; city: string | null; at: string };

const KIND: Record<string, string> = {
  proposal: 'Proposal', invoice: 'Invoice', access_code: 'Access code', reminder: 'Reminder', receipt: 'Payment received', signed: 'Signed — thank you',
  first_email: 'Outreach · first email', follow_up: 'Outreach · follow-up', reply: 'Outreach · reply', email: 'Email',
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** One status chip per email: the strongest thing that has happened to it. */
export function EmailState({ r }: { r: Pick<Row, 'status' | 'open_count' | 'click_count'> }) {
  if (r.status === 'failed') return <Badge tone="red">Failed</Badge>;
  if (r.status === 'bounced') return <Badge tone="red">Bounced</Badge>;
  if (r.status === 'complained') return <Badge tone="red">Marked spam</Badge>;
  if (r.click_count) return <Badge tone="purple"><MousePointerClick size={12} /> Clicked{r.click_count > 1 ? ` ${r.click_count}×` : ''}</Badge>;
  if (r.open_count) return <Badge tone="green"><Eye size={12} /> Opened{r.open_count > 1 ? ` ${r.open_count}×` : ''}</Badge>;
  if (r.status === 'delivered') return <Badge tone="blue">Delivered</Badge>;
  return <Badge>Not opened yet</Badge>;
}

const device = (ua?: string | null) => {
  if (!ua) return 'Unknown app';
  if (/GoogleImageProxy/i.test(ua)) return 'Gmail';
  if (/YahooMailProxy/i.test(ua)) return 'Yahoo Mail';
  if (/Outlook|Microsoft/i.test(ua)) return 'Outlook';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Browser';
};

export function Emails() {
  const { go } = useRoute();
  const [view, setView] = useState('all');
  const [source, setSource] = useState('');
  const [days, setDays] = useState('30');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ view, days, ...(source ? { source } : {}), ...(q.trim() ? { q: q.trim() } : {}) }).toString();
  const { data, loading, error, reload } = useData<ListRes>(() => api(`/emails?${qs}`), [qs]);
  useEffect(() => { const t = setInterval(reload, 60_000); return () => clearInterval(t); }, [qs]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = data?.stats;

  return (
    <Page title="Emails" sub={<>Who opened and clicked your proposals, invoices and outreach · sending as michael@ferrnagency.com</>}
      actions={<button className="btn ghost sm" onClick={reload}><RefreshCw size={14} /> Refresh</button>}>
      {data && !data.ready ? <div className="callout"><Info size={15} /> Email tracking is being switched on. New emails will show here within a few minutes.</div> : null}
      <div className="kpi-row">
        <div className="kpi feature">
          <div className="kpi-icon"><Send size={24} strokeWidth={1.8} /></div>
          <h4>Emails sent · last {days} days</h4>
          <strong>{s?.sent ?? '—'}</strong>
          <p style={{ paddingBottom: 18 }}>{s ? `${s.delivered} delivered` : ' '}</p>
        </div>
        <div className="kpi"><h4><MailOpen size={14} /> Opened</h4><strong>{s ? `${pct(s.opened, s.delivered)}%` : '—'}</strong><span className="muted small">{s?.opened ?? 0} emails</span></div>
        <div className="kpi"><h4><MousePointerClick size={14} /> Clicked a link</h4><strong>{s ? `${pct(s.clicked, s.delivered)}%` : '—'}</strong><span className="muted small">{s?.clicked ?? 0} emails</span></div>
        <div className="kpi"><h4><AlertTriangle size={14} /> Bounced or failed</h4><strong>{s?.problems ?? '—'}</strong><span className="muted small">{s?.problems ? 'check the addresses' : 'all good'}</span></div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search recipient, company or subject…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All emails</option><option value="site">Proposals & invoices</option><option value="outreach">LeadsHunter outreach</option>
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option>
        </select>
        <Tabs tabs={[['all', 'All'], ['opened', 'Opened'], ['unopened', 'Not opened'], ['clicked', 'Clicked'], ['problems', 'Problems']]} value={view} onChange={setView} />
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !data?.rows.length ? (
        <Empty icon={MailCheck} title={view === 'all' ? 'No emails yet' : 'Nothing here'}>
          {view === 'all' ? 'Send a proposal or invoice from Studio, or let LeadsHunter send outreach, and each email shows here with its opens and clicks.' : 'Try another tab or a longer date range.'}
        </Empty>
      ) : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>To</th><th>Email</th><th>Sent</th><th>Status</th><th>Last activity</th></tr></thead>
          <tbody>{data.rows.map((r) => {
            const last = [r.last_clicked_at, r.last_opened_at].filter(Boolean).sort().pop();
            return (
              <tr key={r.id} onClick={() => setOpen(r.id)}>
                <td><strong>{r.company || r.to_addr.split('@')[0]}</strong><div className="muted small">{r.to_addr}</div></td>
                <td>{r.subject || '—'}<div><Badge tone={r.source === 'outreach' ? 'orange' : 'default'}>{KIND[r.kind] ?? r.kind}</Badge></div></td>
                <td title={fmtDate(r.sent_at, true)}>{ago(r.sent_at)}</td>
                <td><EmailState r={r} /></td>
                <td className="muted">{last ? <span title={fmtDate(last, true)}>{r.last_clicked_at === last ? 'Clicked' : 'Opened'} {ago(last)}</span> : '—'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}

      <p className="muted small" style={{ marginTop: 14 }}>
        <Info size={13} style={{ verticalAlign: -2 }} /> Opens are a good signal but not proof: some mail apps block images (no open recorded) and Apple Mail can load them automatically (an open without reading). A click is the surest sign someone read your email.
      </p>

      {open ? <EmailDrawer id={open} onClose={() => setOpen(null)} onProposal={(pid) => go(`/proposals/${pid}`)} /> : null}
    </Page>
  );
}

function EmailDrawer({ id, onClose, onProposal }: { id: string; onClose: () => void; onProposal: (id: string) => void }) {
  const { data, loading, error } = useData<{ row: Row & { links: string[]; from_addr: string | null }; events: Ev[] }>(() => api(`/emails/${id}`), [id]);
  const r = data?.row;
  return (
    <Drawer open onClose={onClose} title={r?.subject || 'Email'}>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : r ? (
        <>
          <div style={{ marginBottom: 14 }}><EmailState r={r} /> <Badge tone={r.source === 'outreach' ? 'orange' : 'default'}>{KIND[r.kind] ?? r.kind}</Badge></div>
          <dl className="dl">
            <dt>To</dt><dd>{r.company ? <><strong>{r.company}</strong> · </> : null}{r.to_addr}</dd>
            {r.from_addr ? <><dt>From</dt><dd>{r.from_addr}</dd></> : null}
            <dt>Sent</dt><dd>{fmtDate(r.sent_at, true)} ({ago(r.sent_at)})</dd>
            <dt>First opened</dt><dd>{r.first_opened_at ? `${fmtDate(r.first_opened_at, true)} (${ago(r.first_opened_at)})` : 'Not yet'}</dd>
            <dt>Opens</dt><dd>{r.open_count}</dd>
            <dt>Link clicks</dt><dd>{r.click_count}</dd>
            {r.error ? <><dt>Problem</dt><dd className="err">{r.error}</dd></> : null}
          </dl>
          {r.proposal_id ? <button className="btn sm ghost" style={{ marginTop: 14 }} onClick={() => onProposal(r.proposal_id!)}><ExternalLink size={14} /> Open the proposal</button> : null}
          <div style={{ height: 16 }} />
          <Card title="Activity">
            {!data!.events.length ? <Empty compact icon={Mail} title="No opens yet">You’ll see each open and click here, with the time and roughly where it happened.</Empty> : (
              <ul className="plain-list">{data!.events.map((e, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  {e.kind === 'click' ? <MousePointerClick size={16} /> : <Eye size={16} />}
                  <div>
                    <strong>{e.kind === 'click' ? 'Clicked' : 'Opened'}</strong> <span className="muted">· {fmtDate(e.at, true)} · {device(e.ua)}</span>
                    {e.city || e.country ? <div className="muted small"><MapPin size={12} style={{ verticalAlign: -2 }} /> {[e.city, e.country].filter(Boolean).join(', ')}</div> : null}
                    {e.url ? <div className="muted small" style={{ wordBreak: 'break-all' }}>{e.url}</div> : null}
                  </div>
                </li>
              ))}</ul>
            )}
          </Card>
        </>
      ) : null}
    </Drawer>
  );
}
