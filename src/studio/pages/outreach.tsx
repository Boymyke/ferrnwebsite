import React, { useState } from 'react';
import { ago, api, can, fmtDate } from '../api';
import { Badge, Card, Empty, Loading, Page, Status, Tabs, useData, useToast, useUser } from '../ui';

export function Outreach() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload, setData } = useData(() => api('/engine'));
  const [tab, setTab] = useState('soon');
  const [editing, setEditing] = useState<any | null>(null);
  const snap = data?.data;
  const act = async (action: string, params: Record<string, unknown>, msg = 'Done') => {
    try { const r = await api('/engine/action', { body: { action, params } }); setData({ ...data, data: r.data }); toast(msg); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  const refresh = async () => {
    try { const r = await api('/engine?live=1'); setData(r); toast('Synced with LeadsHunter'); } catch (x: any) { toast(x.message, 'err'); }
  };
  if (loading) return <Loading />;
  if (!data?.connected && !snap) {
    return (
      <Page title="Outreach" sub="Email sequences, follow-ups, WhatsApp queue and replies from the LeadsHunter engine.">
        <Card title="Connect the LeadsHunter engine">
          <ol className="steps">
            <li>Open the Ferrn Command Centre sheet → Extensions → Apps Script → Deploy → Manage deployments, and copy the Web app URL.</li>
            <li>In Cloudflare → Workers → ferrn → Settings → Variables: set <code>ENGINE_URL</code> to that URL and add a secret <code>ENGINE_KEY</code> with the API_KEY from the sheet’s Settings tab.</li>
            <li>Come back and press Sync. Leads sync automatically every 10 minutes after that.</li>
          </ol>
        </Card>
      </Page>
    );
  }
  const k = snap?.kpis ?? {};
  const s = snap?.settings ?? {};
  return (
    <Page title="Outreach" sub={<>Engine snapshot {ago(snap?.generated_at)} · sending as {s.FROM_ALIAS || 'your Gmail'} · {s.AUTO_SEND ? 'auto-send on' : 'auto-send off'}</>}
      actions={<>
        <button className="btn ghost" onClick={refresh}>↻ Sync now</button>
        {can(user, 'admin') ? <button className="btn ghost" onClick={() => act('setSetting', { key: 'AUTO_SEND', value: s.AUTO_SEND ? 'FALSE' : 'TRUE' }, 'Auto-send updated')}>{s.AUTO_SEND ? 'Pause sending' : 'Resume sending'}</button> : null}
        <button className="btn primary" onClick={() => act('runNow', {}, 'Engine run complete')}>Run engine now</button>
      </>}>
      <div className="kpi-row five">
        <div className="kpi"><h4>Sent today</h4><strong>{k.sentToday ?? 0}</strong><span className="muted">cap {s.DAILY_CAP_TOTAL}</span></div>
        <div className="kpi"><h4>This week</h4><strong>{k.sentWeek ?? 0}</strong></div>
        <div className="kpi"><h4>Contacted</h4><strong>{k.contacted ?? 0}</strong></div>
        <div className="kpi"><h4>Replied</h4><strong>{k.replied ?? 0}</strong></div>
        <div className="kpi"><h4>Calls</h4><strong>{k.calls ?? 0}</strong></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        ['needs', `Needs you (${snap?.needsYou?.length ?? 0})`], ['soon', `Sending soon (${snap?.sendingSoon?.length ?? 0})`],
        ['held', `Held (${snap?.held?.length ?? 0})`], ['wa', `WhatsApp (${snap?.whatsapp?.length ?? 0})`],
        ['inbox', `Inbox (${snap?.inbox?.filter((i: any) => i.status !== 'handled').length ?? 0})`], ['sent', 'Recently sent'], ['log', 'Engine log'],
      ]} />
      {tab === 'needs' ? <List rows={snap?.needsYou} empty="Nothing needs you right now." render={(l: any) => (
        <><div><strong>{l.company}</strong> <Status s={l.status} /><p>{l.needs_you_reason}</p><p className="muted small">{l.next_action}</p></div>
          <div className="row-actions"><a className="btn sm ghost" href={`/studio/leads/${l.id}`}>Open</a><button className="btn sm" onClick={() => act('resolve', { lead_id: l.id }, 'Marked as handled')}>Done</button></div></>
      )} /> : null}
      {tab === 'soon' || tab === 'held' ? <List rows={tab === 'soon' ? snap?.sendingSoon : snap?.held} empty="Queue is empty." render={(m: any) => (
        <><div><strong>{m.company}</strong> <Badge>{m.step === '0' ? 'First email' : `Follow-up ${m.step}`}</Badge> <span className="muted small">→ {m.to} · {m.send_at ? fmtDate(m.send_at, true) : 'next run'}</span>
          {m.subject ? <p><strong>{m.subject}</strong></p> : null}<p className="pre clamp">{m.body}</p></div>
          <div className="row-actions">
            <button className="btn sm ghost" onClick={() => setEditing(m)}>Edit</button>
            {m.status === 'held' ? <button className="btn sm" onClick={() => act('approve', { id: m.id }, 'Released')}>Release</button> : <button className="btn sm ghost" onClick={() => act('hold', { id: m.id }, 'Held')}>Hold</button>}
            <button className="btn sm primary" onClick={() => act('sendNow', { id: m.id }, 'Sent')}>Send now</button>
            <button className="btn sm ghost danger" onClick={() => confirm('Cancel this email?') && act('cancel', { id: m.id }, 'Cancelled')}>Cancel</button>
          </div></>
      )} /> : null}
      {tab === 'wa' ? <List rows={snap?.whatsapp} empty="No WhatsApp messages due." render={(m: any) => (
        <><div><strong>{m.company}</strong> <span className="muted small">{m.to}</span><p className="pre clamp">{m.body}</p></div>
          <div className="row-actions"><a className="btn sm primary" href={m.wa_link} target="_blank" rel="noreferrer">Open WhatsApp</a><button className="btn sm" onClick={() => act('waSent', { id: m.id }, 'Marked as sent')}>I sent it</button></div></>
      )} /> : null}
      {tab === 'inbox' ? <List rows={snap?.inbox} empty="No replies yet." render={(r: any) => (
        <><div><strong>{r.company || r.from}</strong> <Status s={r.classification} /> <span className="muted small">{ago(r.received_at)}</span><p><strong>{r.subject}</strong></p><p className="pre clamp">{r.body}</p></div>
          <div className="row-actions">{r.status !== 'handled' ? <button className="btn sm" onClick={() => act('markInbox', { id: r.id }, 'Handled')}>Handled</button> : <Badge tone="green">handled</Badge>}</div></>
      )} /> : null}
      {tab === 'sent' ? <List rows={snap?.recentSent} empty="Nothing sent yet." render={(m: any) => (
        <div><strong>{m.company}</strong> <Status s={m.status} /> <span className="muted small">{m.channel} · {fmtDate(m.sent_at, true)}</span>{m.error ? <p className="error-note">{m.error}</p> : null}<p className="pre clamp">{m.subject || m.body}</p></div>
      )} /> : null}
      {tab === 'log' ? <List rows={snap?.logs} empty="No log entries." render={(l: any) => <div><span className="muted small">{fmtDate(l.time, true)} · {l.event}</span><p className="pre">{l.detail}</p></div>} /> : null}
      {editing ? (
        <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <aside className="drawer"><header className="drawer-head"><h2>Edit email · {editing.company}</h2><button className="icon" onClick={() => setEditing(null)}>✕</button></header>
            <div className="drawer-body">
              <label className="field wide"><span>Subject</span><input value={editing.subject ?? ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></label>
              <label className="field wide"><span>Body</span><textarea rows={14} value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label>
              <div className="drawer-actions"><button className="btn primary" onClick={async () => { await act('edit', { id: editing.id, subject: editing.subject, body: editing.body }, 'Email updated'); setEditing(null); }}>Save</button></div>
            </div>
          </aside>
        </div>
      ) : null}
    </Page>
  );
}

function List({ rows, render, empty }: { rows?: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  if (!rows?.length) return <Empty title={empty} />;
  return <div className="stack">{rows.map((r) => <div key={r.id} className="stack-item">{render(r)}</div>)}</div>;
}
