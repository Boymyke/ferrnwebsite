import React, { useEffect, useRef, useState } from 'react';
import { ago, api, can, fmtDate } from '../api';
import { Badge, Card, Empty, Loading, Page, useData, useToast, useUser } from '../ui';

type Contact = {
  wa_id: string; name: string | null; lead_id: string | null; lead_company: string | null; opted_in: number; opted_out_at: string | null;
  bot_paused: number; needs_human: number; last_body: string | null; last_at: string | null; queued: number; source: string | null;
};

const fill = (s: string, p: string[]) => s.replace(/\{\{(\d+)\}\}/g, (_, i) => p[Number(i) - 1] || `{{${i}}}`);

export function WhatsApp() {
  const toast = useToast();
  const { data, loading, reload } = useData(() => api('/wa/contacts'));
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { const t = setInterval(reload, 20000); return () => clearInterval(t); }, []); // light polling for new messages
  if (loading && !data) return <Loading />;
  const rows: Contact[] = (data?.rows ?? []).filter((r: Contact) => !q || `${r.name} ${r.wa_id} ${r.lead_company}`.toLowerCase().includes(q.toLowerCase()));
  const s = data?.stats ?? {};
  return (
    <Page title="WhatsApp" sub="The bot answers every message instantly, sends enquiry confirmations, follow-ups, meeting reminders and quote links to people who opted in, and hands over to you when someone asks for a person.">
      {!data?.connected ? (
        <Card title="Connect WhatsApp"><p className="muted">The bot is built but not connected yet. Add <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_VERIFY_TOKEN</code> and <code>WHATSAPP_APP_SECRET</code> in Cloudflare, then point the Meta webhook at <code>{location.origin}/api/whatsapp/webhook</code>. Steps are in docs/WHATSAPP.md.</p></Card>
      ) : null}
      <div className="kpi-row wa-kpis">
        <div className="kpi"><h4>Need you</h4><strong>{s.needs_human ?? 0}</strong><small>asked for a person or sent media</small></div>
        <div className="kpi"><h4>Received · 7 days</h4><strong>{s.received_7d ?? 0}</strong></div>
        <div className="kpi"><h4>Sent · 7 days</h4><strong>{s.sent_7d ?? 0}</strong><small>bot + automations + team</small></div>
        <div className="kpi"><h4>Scheduled</h4><strong>{s.queued ?? 0}</strong><small>follow-ups and reminders</small></div>
      </div>
      <div className="wa-layout">
        <Card className="wa-list" title={<input className="input" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />}>
          {!rows.length ? <Empty title="No chats yet">Chats appear here when someone messages your WhatsApp number or ticks “send me updates on WhatsApp” on the website.</Empty> : rows.map((r) => (
            <button key={r.wa_id} className={`wa-row ${sel === r.wa_id ? 'on' : ''}`} onClick={() => setSel(r.wa_id)}>
              <span className="avatar">{(r.name || '#').slice(0, 1).toUpperCase()}</span>
              <span className="wa-row-main">
                <b>{r.name || '+' + r.wa_id}{r.needs_human ? <Badge tone="orange">needs you</Badge> : null}{r.bot_paused ? <Badge>you’re replying</Badge> : null}</b>
                <small>{r.last_body?.slice(0, 70) || '—'}</small>
              </span>
              <small className="muted">{r.last_at ? ago(r.last_at + 'Z') : ''}</small>
            </button>
          ))}
        </Card>
        {sel ? <Thread key={sel} id={sel} templates={data?.templates ?? {}} onChange={reload} /> : <Card className="wa-thread"><Empty title="Pick a chat">Select a conversation to read it, reply, or take over from the bot.</Empty></Card>}
      </div>
    </Page>
  );
}

function Thread({ id, templates, onChange }: { id: string; templates: Record<string, { body: string; example: string[] }>; onChange: () => void }) {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload } = useData(() => api(`/wa/contacts/${id}`), [id]);
  const [text, setText] = useState('');
  const [tpl, setTpl] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [data?.messages?.length]);
  useEffect(() => { const t = setInterval(reload, 10000); return () => clearInterval(t); }, [id]);
  if (loading && !data) return <Card className="wa-thread"><Loading /></Card>;
  const c = data?.contact; if (!c) return null;
  const canSend = can(user, 'sales');
  const patch = async (b: Record<string, unknown>, msg: string) => { try { await api(`/wa/contacts/${id}`, { method: 'PATCH', body: b }); toast(msg); reload(); onChange(); } catch (x: any) { toast(x.message, 'err'); } };
  const send = async (body: Record<string, unknown>) => {
    try { await api(`/wa/contacts/${id}/send`, { body }); setText(''); setTpl(''); toast('Sent'); reload(); onChange(); } catch (x: any) { toast(x.message, 'err'); }
  };
  return (
    <Card className="wa-thread" title={<span>{c.name || '+' + c.wa_id} <small className="muted">+{c.wa_id}</small></span>} actions={
      <div className="row gap">
        <a className="btn sm ghost" href={`https://wa.me/${c.wa_id}`} target="_blank" rel="noreferrer">Open in WhatsApp ↗</a>
        {canSend ? (c.bot_paused
          ? <button className="btn sm" onClick={() => patch({ bot_paused: false, needs_human: false }, 'Bot is answering again')}>Hand back to bot</button>
          : <button className="btn sm primary" onClick={() => patch({ bot_paused: true }, 'You’ve taken over this chat')}>Take over</button>) : null}
      </div>}>
      <div className="wa-meta">
        {c.opted_out_at ? <Badge tone="red">replied STOP</Badge> : c.opted_in ? <Badge tone="green">opted in</Badge> : <Badge>not opted in</Badge>}
        {c.source ? <Badge>{c.source}</Badge> : null}
        {data.window_open ? <Badge tone="green">24-hour window open: free text allowed</Badge> : <Badge tone="orange">window closed: templates only</Badge>}
      </div>
      <div className="wa-messages">
        {data.messages.map((m: any) => (
          <div key={m.id} className={`wa-msg ${m.direction}`}>
            <p>{m.body}</p>
            <small>{m.direction === 'out' ? `${m.sent_by} · ` : ''}{fmtDate(m.created_at + 'Z', true)}{m.direction === 'out' ? ` · ${m.status}${m.error ? ` (${m.error})` : ''}` : ''}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      {data.queue.filter((q: any) => q.status === 'pending').length ? (
        <div className="wa-queue">
          <b>Scheduled</b>
          {data.queue.filter((q: any) => q.status === 'pending').map((q: any) => <div key={q.id} className="muted">{q.template.replace(/_/g, ' ')} · {fmtDate(q.send_after.replace(' ', 'T') + 'Z', true)}</div>)}
          {canSend ? <button className="btn sm ghost" onClick={() => patch({ cancel_queue: true }, 'Scheduled messages cancelled')}>Cancel scheduled</button> : null}
        </div>
      ) : null}
      {canSend ? (
        <div className="wa-compose">
          {data.window_open ? (
            <form onSubmit={(e) => { e.preventDefault(); send({ text }); }} className="row gap">
              <textarea className="input" rows={2} placeholder="Type a reply…" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn primary" disabled={!text.trim()}>Send</button>
            </form>
          ) : null}
          <div className="row gap wrap">
            <select className="input" value={tpl} onChange={(e) => { setTpl(e.target.value); setParams(templates[e.target.value]?.example.map(() => '') ?? []); }}>
              <option value="">Send an approved template…</option>
              {Object.keys(templates).map((k) => <option key={k} value={k}>{k.replace(/^ferrn_/, '').replace(/_/g, ' ')}</option>)}
            </select>
            {tpl ? templates[tpl].example.map((ex, i) => (
              <input key={i} className="input" placeholder={ex} value={params[i] ?? ''} onChange={(e) => { const p = [...params]; p[i] = e.target.value; setParams(p); }} />
            )) : null}
            {tpl ? <button className="btn" onClick={() => send({ template: tpl, params: params.map((p, i) => p || templates[tpl].example[i]) })}>Send template</button> : null}
          </div>
          {tpl ? <p className="muted small">Preview: {fill(templates[tpl].body, params.map((p, i) => p || templates[tpl].example[i]))}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
