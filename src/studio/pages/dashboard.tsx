import React from 'react';
import { ago, api, fmtDate, ngn } from '../api';
import { Card, Empty, ErrorNote, Link, Loading, Page, Status, useData, useUser } from '../ui';

export function Dashboard() {
  const user = useUser()!;
  const { data, error, loading } = useData(() => api('/overview'));
  const hour = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const d = data;
  const won = Number(d.pipeline?.won_value ?? 0) + Number(d.orders?.revenue ?? 0);
  const pct = Math.min(100, Math.round((won / (d.target || 1)) * 100));
  const k = d.engine?.kpis;
  return (
    <Page title={`${greet}, ${user.name.split(' ')[0]}`} sub="Here is what needs attention across sales, delivery and content.">
      <div className="kpi-row">
        <div className="kpi feature">
          <div className="kpi-icon">₦</div>
          <div><h4>Open pipeline</h4><p className="muted">Replied → proposal sent</p></div>
          <strong>{ngn(d.pipeline?.open_value ?? 0)}</strong>
          <Link to="/leads" className="kpi-foot">See leads →</Link>
        </div>
        <div className="kpi"><h4>Leads</h4><strong>{d.pipeline?.leads ?? 0}</strong><span className="muted">{d.pipeline?.needs_you ?? 0} need you</span></div>
        <div className="kpi"><h4>Emails sent this week</h4><strong>{k?.sentWeek ?? '—'}</strong><span className="muted">{k ? `${k.replied} replied · ${k.calls} calls` : 'Connect LeadsHunter'}</span></div>
        <div className="kpi"><h4>Quotes open</h4><strong>{d.quotes?.open ?? 0}</strong><span className="muted">{ngn(d.quotes?.accepted ?? 0)} accepted</span></div>
      </div>

      <Card title="Monthly revenue target" actions={<span className="muted small">Won deals + marketplace orders</span>}>
        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
        <div className="progress-legend"><span>{ngn(won)} won</span><span>{pct}% of {ngn(d.target)}</span></div>
      </Card>

      <div className="grid-2">
        <Card title="Upcoming meetings" actions={<Link to="/meetings">All →</Link>}>
          {d.meetings.length ? (
            <ul className="list">{d.meetings.map((m: any) => (
              <li key={m.id}><Link to={`/meetings/${m.id}`}><strong>{m.title}</strong><span className="muted">{m.company ?? ''} · {fmtDate(m.starts_at, true)}</span></Link></li>
            ))}</ul>
          ) : <Empty title="No meetings booked"><Link to="/meetings" className="btn sm">Book one</Link></Empty>}
        </Card>
        <Card title="New enquiries" actions={<Link to="/marketplace/requests">All →</Link>}>
          {d.requests.length ? (
            <ul className="list">{d.requests.map((r: any) => (
              <li key={r.id}><div><strong>{r.name || r.email}</strong> <Status s={r.type} /><span className="muted">{(r.message || '').slice(0, 90)} · {ago(r.created_at)}</span></div></li>
            ))}</ul>
          ) : <Empty title="Inbox zero" />}
        </Card>
        <Card title="Content this week" actions={<Link to="/content">Calendar →</Link>}>
          {d.content.length ? (
            <ul className="list">{d.content.map((c: any) => (
              <li key={c.id}><div><span className={`plat ${c.platform}`}>{c.platform}</span> <strong>{c.title}</strong><span className="muted">{fmtDate(c.scheduled_at, true)} · <Status s={c.status} /></span></div></li>
            ))}</ul>
          ) : <Empty title="Nothing scheduled"><Link to="/content" className="btn sm">Plan content</Link></Empty>}
        </Card>
        <Card title="Pipeline by status">
          <div className="bars">{d.byStatus.map((s: any) => {
            const max = Math.max(...d.byStatus.map((x: any) => x.n));
            return <div key={s.status} className="bar"><span className="lbl">{s.status || '—'}</span><span className="track"><i style={{ width: `${(s.n / max) * 100}%` }} /></span><span className="n">{s.n}</span></div>;
          })}</div>
        </Card>
      </div>

      <Card title="Recent activity" actions={<Link to="/team">Team activity →</Link>}>
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
          <tbody>{d.activity.map((a: any) => <tr key={a.id}><td className="muted">{ago(a.at)}</td><td>{a.user_name}</td><td>{a.summary}</td></tr>)}</tbody>
        </table>
      </Card>
    </Page>
  );
}
