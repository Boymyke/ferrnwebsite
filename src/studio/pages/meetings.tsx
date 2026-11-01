import React, { useMemo, useState } from 'react';
import { api, create, fmtDate, fromLocalInput, list, money, toLocalInput, update } from '../api';
import { Card, EditedBy, Empty, ErrorNote, Fields, History, Loading, Page, Status, Tabs, useData, useRoute, useToast, type FieldDef } from '../ui';

const FIELDS = (leads: any[]): FieldDef[] => [
  { name: 'title', label: 'Title', wide: true, placeholder: 'Discovery call — Clinic Front Desk' },
  { name: 'lead_id', label: 'Lead', type: 'select', options: leads.map((l) => [l.id, `${l.company} (${l.city ?? ''})`]) },
  { name: 'starts_at', label: 'Starts (Lagos time)', type: 'datetime' },
  { name: 'duration_min', label: 'Minutes', type: 'number' },
  { name: 'channel', label: 'Channel', type: 'select', options: [['google_meet', 'Google Meet'], ['zoom', 'Zoom'], ['phone', 'Phone call'], ['whatsapp', 'WhatsApp call'], ['in_person', 'In person']] },
  { name: 'location_url', label: 'Meeting link / address', wide: true },
  { name: 'attendees', label: 'Attendees', wide: true, placeholder: 'Names and roles on their side' },
  { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'done', 'no_show', 'cancelled'] },
  { name: 'agenda', label: 'Agenda', type: 'textarea' },
];

export function Meetings() {
  const { path, go } = useRoute();
  const [tab, setTab] = useState('upcoming');
  const { data, loading, error, reload } = useData(() => list('meetings'));
  const id = path.match(/^\/meetings\/([^/?]+)/)?.[1];
  if (id === 'new') return <NewMeeting onDone={(m) => { reload(); go(m ? `/meetings/${m.id}` : '/meetings'); }} />;
  if (id) return <MeetingBrief id={id} onBack={() => { reload(); go('/meetings'); }} />;
  const now = Date.now();
  const rows = (data ?? []).filter((m: any) => tab === 'upcoming' ? new Date(m.starts_at).getTime() >= now - 3600e3 && m.status === 'scheduled' : !(new Date(m.starts_at).getTime() >= now - 3600e3 && m.status === 'scheduled'));
  if (tab === 'upcoming') rows.reverse();
  const byDay = rows.reduce((acc: Record<string, any[]>, m: any) => { const d = fmtDate(m.starts_at); (acc[d] ??= []).push(m); return acc; }, {});
  return (
    <Page title="Meetings" sub="Discovery calls with a ready brief: what to ask, what we found, what to propose." actions={<button className="btn primary" onClick={() => go('/meetings/new')}>+ Book meeting</button>}>
      <Tabs tabs={[['upcoming', 'Upcoming'], ['past', 'Past & closed']]} value={tab} onChange={setTab} />
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !rows.length ? <Empty title="No meetings here yet" /> : (
        Object.entries(byDay).map(([day, ms]) => (
          <Card key={day} title={day}>
            <ul className="list">{ms.map((m: any) => (
              <li key={m.id}><a href={`/studio/meetings/${m.id}`} onClick={(e) => { e.preventDefault(); go(`/meetings/${m.id}`); }}>
                <strong>{fmtDate(m.starts_at, true).split(',').pop()} · {m.title}</strong><span className="muted">{m.channel?.replace('_', ' ')} · {m.duration_min} min · <Status s={m.status} /></span></a></li>
            ))}</ul>
          </Card>
        ))
      )}
    </Page>
  );
}

function NewMeeting({ onDone }: { onDone: (m?: any) => void }) {
  const toast = useToast();
  const leadParam = new URLSearchParams(location.search).get('lead') ?? '';
  const { data: leads } = useData(() => list('leads', { limit: '1000' }));
  const lead = leads?.find((l: any) => l.id === leadParam);
  const tomorrow = new Date(Date.now() + 864e5); tomorrow.setUTCHours(9, 0, 0, 0);
  const [v, setV] = useState<Record<string, any>>({ lead_id: leadParam, duration_min: 30, channel: 'google_meet', status: 'scheduled', starts_at: toLocalInput(tomorrow.toISOString()) });
  const val: Record<string, any> = { ...v, title: v.title ?? (lead ? `Discovery call — ${lead.company}` : '') };
  return (
    <Page title="Book a meeting" sub="Tip: send them the Cal.com link if they prefer to pick a time themselves — https://cal.com/ferrn-agency">
      <Card>
        <Fields fields={FIELDS(leads ?? [])} value={val} onChange={setV} />
        <div className="drawer-actions">
          <button className="btn ghost" onClick={() => onDone()}>Cancel</button>
          <button className="btn primary" onClick={async () => {
            if (!val.title || !val.starts_at) return toast('Title and time are required', 'err');
            try {
              const m = await create('meetings', { ...val, starts_at: fromLocalInput(val.starts_at) });
              if (val.lead_id) await update('leads', val.lead_id, { status: 'Call booked', next_action: `Call on ${fmtDate(m.starts_at, true)}` }).catch(() => null);
              toast('Meeting booked'); onDone(m);
            } catch (x: any) { toast(x.message, 'err'); }
          }}>Book</button>
        </div>
      </Card>
    </Page>
  );
}

function MeetingBrief({ id, onBack }: { id: string; onBack: () => void }) {
  const toast = useToast();
  const { go } = useRoute();
  const { data, error, reload } = useData(() => api(`/meetings/${id}/brief`), [id]);
  const [notes, setNotes] = useState<Record<string, any> | null>(null);
  const [ai, setAi] = useState<any>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState('brief');
  const m = data?.meeting;
  const n = notes ?? { notes: m?.notes ?? '', outcome: m?.outcome ?? '', next_step: m?.next_step ?? '', status: m?.status };
  const answered = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const L = data.lead;
  const Q = ({ q, k }: { q: string; k: string }) => (
    <label className="q"><input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} /><span>{q}</span></label>
  );
  return (
    <Page title={m.title} sub={<>{fmtDate(m.starts_at, true)} · {m.duration_min} min · {m.channel?.replace('_', ' ')} <Status s={m.status} /> <EditedBy row={m} /></>}
      actions={<>
        <button className="btn ghost" onClick={onBack}>← All meetings</button>
        {m.location_url ? <a className="btn ghost" href={m.location_url} target="_blank" rel="noreferrer">Join ↗</a> : null}
        {L ? <button className="btn primary" onClick={() => go(`/quotes/new?lead=${L.id}`)}>Draft quote</button> : null}
      </>}>
      <Tabs tabs={[['brief', 'Meeting brief'], ['notes', 'Notes & outcome'], ['history', 'History']]} value={tab} onChange={setTab} />
      {tab === 'brief' ? (
        <div className="grid-2 brief">
          <div>
            {L ? (
              <Card title={`About ${L.company}`}>
                <dl className="dl">
                  <dt>Contact</dt><dd>{L.contact_name || '—'} {L.role ? `· ${L.role}` : ''}</dd>
                  <dt>Niche · city</dt><dd>{L.niche} · {L.city}</dd>
                  <dt>Website</dt><dd>{L.website ? <a href={L.website} target="_blank" rel="noreferrer">{L.website}</a> : 'None'}</dd>
                  <dt>Est. value</dt><dd>{money(L.est_value)}</dd>
                  <dt>Our pitch</dt><dd>{L.pitch}</dd>
                  <dt>Notes</dt><dd className="pre">{L.notes}</dd>
                </dl>
              </Card>
            ) : <Card><Empty title="Not linked to a lead">Link this meeting to a lead to get gap-specific questions.</Empty></Card>}
            {data.gaps.length ? (
              <Card title="What we found on their site — use these as openers">
                {data.gapQuestions.map((q: string, i: number) => <Q key={i} q={q} k={`g${i}`} />)}
              </Card>
            ) : null}
            {data.product ? (
              <Card title="What to propose">
                <p><strong>{data.product.name}</strong> — {data.product.tagline}</p>
                <p className="muted">Setup {money(data.product.price_ngn_setup)} + {money(data.product.price_ngn_monthly)}/month · or {money(data.product.price_usd_setup, 'USD')} + {money(data.product.price_usd_monthly, 'USD')}/month</p>
                <a className="btn sm ghost" href={`/marketplace/${data.product.slug}`} target="_blank" rel="noreferrer">Show live demo ↗</a>
              </Card>
            ) : null}
            <Card title="Tailor with AI" actions={<button className="btn sm" onClick={async () => {
              try { const r = await api(`/meetings/${id}/ai-questions`, { body: {} }); setAi(r.brief); } catch (x: any) { toast(x.message, 'err'); }
            }}>Generate</button>}>
              {ai ? (<>
                {ai.opener ? <p><strong>Opener:</strong> {ai.opener}</p> : null}
                {(ai.questions ?? []).map((q: string, i: number) => <Q key={i} q={q} k={`ai${i}`} />)}
                {ai.risks?.length ? <><h5>Watch out for</h5><ul>{ai.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></> : null}
                {ai.recommendation ? <p><strong>Recommend:</strong> {ai.recommendation}</p> : null}
              </>) : <p className="muted small">Uses the lead’s audit notes to write questions specific to this business.</p>}
            </Card>
          </div>
          <div>
            <Card title={`Call flow · ${answered} ticked`}>
              {data.flow.map((s: any, i: number) => (
                <div key={i} className="flow-stage"><h5>{s.stage}</h5><p className="muted small">{s.goal}</p>{s.questions.map((q: string, j: number) => <Q key={j} q={q} k={`f${i}-${j}`} />)}</div>
              ))}
            </Card>
            <Card title={`${(L?.niche || 'Industry')} questions`}>{data.niche.map((q: string, i: number) => <Q key={i} q={q} k={`n${i}`} />)}</Card>
            <Card title="Objections & answers">
              {data.objections.map((o: any, i: number) => <details key={i} className="obj"><summary>{o.objection}</summary><p>{o.response}</p></details>)}
            </Card>
          </div>
        </div>
      ) : tab === 'notes' ? (
        <Card>
          <Fields value={n} onChange={setNotes} fields={[
            { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'done', 'no_show', 'cancelled'] },
            { name: 'outcome', label: 'Outcome', type: 'select', options: ['Quote requested', 'Interested — follow up', 'Not a fit', 'No decision', 'Won'] },
            { name: 'notes', label: 'Notes (budget, timeline, decision makers, pains in their words)', type: 'textarea', rows: 10 },
            { name: 'next_step', label: 'Next step', wide: true },
          ]} />
          <div className="drawer-actions"><button className="btn primary" onClick={async () => {
            try {
              await update('meetings', id, n);
              if (L && n.outcome === 'Quote requested') await update('leads', L.id, { status: 'Interested', next_action: n.next_step || 'Send quote' });
              if (L && n.outcome === 'Won') await update('leads', L.id, { status: 'Won' });
              toast('Saved'); setNotes(null); reload();
            } catch (x: any) { toast(x.message, 'err'); }
          }}>Save</button></div>
        </Card>
      ) : <Card><History entity="meetings" id={id} /></Card>}
    </Page>
  );
}
