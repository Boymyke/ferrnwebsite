import React, { useState } from 'react';
import { ago, api, can, fmtDate } from '../api';
import { Badge, Card, Drawer, Empty, Loading, Page, Status, Tabs, useData, useToast, useUser, Pager, usePaged } from '../ui';
import { AlertTriangle, MailOpen, RefreshCw, Send } from 'lucide-react';

/** WhatsApp chat link with the message already typed. Nigerian numbers get their 234 code back
 *  (the sheet drops the leading 0); on a computer it opens WhatsApp Web straight in the chat. */
export function waLink(to: unknown, body: string) {
  let d = String(to ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = '234' + d.slice(1);
  else if (d.length === 10 && /^[789]/.test(d)) d = '234' + d;
  const text = encodeURIComponent(body || '');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile ? `https://wa.me/${d}?text=${text}` : `https://web.whatsapp.com/send?phone=${d}&text=${text}`;
}

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
  /** One click: open the chat with the message typed in, and mark it sent (follow-ups get scheduled). */
  const waSend = async (m: any) => {
    const w = window.open(waLink(m.to, m.body), 'ferrn-wa');
    if (!w) { toast('Your browser blocked WhatsApp. Allow pop-ups for Studio', 'err'); return; }
    try { w.opener = null; } catch { /* cross-origin */ }
    await act('waSent', { id: m.id }, `WhatsApp opened for ${m.company}. Press send there. Marked as sent`);
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
    <Page title="Outreach" sub={<>Engine snapshot {ago(snap?.generated_at)} · sending as {s.FROM_ACTUAL || s.FROM_ALIAS || 'your Gmail'} · {s.AUTO_SEND ? 'auto-send on' : 'auto-send off'}{s.TRACK_EMAILS ? ' · opens tracked' : ''}</>}
      actions={<>
        <button className="btn ghost" onClick={refresh}><RefreshCw size={15} strokeWidth={2} />Sync now</button>
        {can(user, 'admin') ? <button className="btn ghost" onClick={() => act('setSetting', { key: 'AUTO_SEND', value: s.AUTO_SEND ? 'FALSE' : 'TRUE' }, 'Auto-send updated')}>{s.AUTO_SEND ? 'Pause sending' : 'Resume sending'}</button> : null}
        <button className="btn primary" onClick={() => act('runNow', {}, 'Engine run complete')}>Run engine now</button>
      </>}>
      {s.FROM_OK === false ? (
        <div className="callout"><AlertTriangle size={15} /> <strong>Outreach is going out as {s.FROM_ACTUAL}, not {s.FROM_ALIAS}.</strong> Gmail ({s.GMAIL_ACCOUNT}) can only send as {s.FROM_ALIAS} once
          it’s added under Gmail → Settings → Accounts → “Send mail as”, using Zoho’s mail server (smtp.zoho.com, port 465, SSL). Studio picks it up at the next sync.</div>
      ) : null}
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
      {tab === 'needs' ? <p className="muted small" style={{ margin: '0 0 10px' }}>Only previews and videos a client has asked for land here, for you to make. Pricing questions and call requests wait under Held with the reply already drafted.</p> : null}
      {tab === 'needs' ? <List rows={snap?.needsYou} empty="Nothing to make right now. A lead shows up here when they ask for a preview or a video." render={(l: any) => (
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
      {tab === 'wa' && snap?.whatsapp?.length ? (
        <div className="eng-next">
          <div><strong>{snap.whatsapp.length} WhatsApp messages ready</strong><span className="muted small">Next: {snap.whatsapp[0].company}. Each click opens the chat with the message already typed and marks it sent. Press send in WhatsApp, come back, click again.</span></div>
          <button className="btn primary" onClick={() => waSend(snap.whatsapp[0])}><Send size={15} />Open &amp; send next</button>
        </div>
      ) : null}
      {tab === 'wa' ? <List rows={snap?.whatsapp} empty="No WhatsApp messages due." render={(m: any) => (
        <><div><strong>{m.company}</strong> <Badge>{String(m.step) === '0' ? 'First message' : `Follow-up ${m.step}`}</Badge> <span className="muted small">{m.to}</span><p className="pre clamp">{m.body}</p></div>
          <div className="row-actions"><button className="btn sm primary" onClick={() => waSend(m)}><Send size={14} />Open &amp; send</button>
            <button className="btn sm ghost danger" onClick={() => confirm('Cancel this WhatsApp message?') && act('cancel', { id: m.id }, 'Cancelled')}>Cancel</button></div></>
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
        <Drawer open onClose={() => setEditing(null)} title={`Edit email · ${editing.company}`}>
            <div>
              <label className="field wide"><span>Subject</span><input value={editing.subject ?? ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></label>
              <label className="field wide"><span>Body</span><textarea rows={14} value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label>
              <div className="drawer-actions"><button className="btn primary" onClick={async () => { await act('edit', { id: editing.id, subject: editing.subject, body: editing.body }, 'Email updated'); setEditing(null); }}>Save</button></div>
            </div>
        </Drawer>
      ) : null}
    </Page>
  );
}

function List({ rows, render, empty }: { rows?: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  const pg = usePaged<any>(rows, `outreach-${empty.slice(0, 12)}`, null, 25);
  if (!rows?.length) return <Empty compact icon={MailOpen} title={empty} />;
  return <><div className="stack">{pg.rows.map((r) => <div key={r.id} className="stack-item">{render(r)}</div>)}</div><Pager pg={pg} /></>;
}
