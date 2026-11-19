import React, { useMemo, useRef, useState } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import {
  AlertTriangle, BookOpen, CalendarClock, Check, Copy, ExternalLink, Globe, Info, Mail, MessageCircle, Phone, PhoneCall, PhoneOff,
  RefreshCw, Sparkles, Trash2, Upload, UserRound,
} from 'lucide-react';
import { ago, api, fmtDate, fromLocalInput, toLocalInput } from '../api';
import { Badge, Card, Empty, ErrorNote, Loading, Page, Tabs, useData, useRoute, useToast, waLink, Pager, usePaged, copy } from '../ui';

type Outcome = 'to_call' | 'no_answer' | 'callback' | 'interested' | 'mockup' | 'meeting' | 'not_interested' | 'wrong_number' | 'do_not_call';
type Lead = {
  id: string; company: string; niche: string | null; city: string | null; country: string | null; website: string | null; email: string | null;
  phone: string | null; contact_name: string | null; role: string | null; tier: string | null; gaps: string | null; notes: string | null; status: string | null; source: string | null;
};
type Prep = {
  gatekeeper?: string; opener?: string; finding?: string; why_it_matters?: string; questions?: string[]; tell_them?: string[];
  objections?: { they_say: string; you_say: string }[]; close?: string; whatsapp_after?: string; watch_out?: string;
};
type Row = {
  id: string; lead_id: string; status: Outcome; attempts: number; added_at: string; last_called_at?: string | null; callback_at?: string | null;
  notes?: string | null; log: { at: string; by: string; outcome: Outcome; note?: string }[]; prep?: Prep | null; prep_at?: string | null; lead: Lead;
};

const LABEL: Record<Outcome, string> = {
  to_call: 'To call', no_answer: 'No answer', callback: 'Call back', interested: 'Interested', mockup: 'Wants the free mock-up',
  meeting: 'Meeting booked', not_interested: 'Not interested', wrong_number: 'Wrong number', do_not_call: 'Do not call',
};
const TONE: Record<Outcome, string> = {
  to_call: 'blue', no_answer: 'default', callback: 'orange', interested: 'green', mockup: 'green', meeting: 'green',
  not_interested: 'default', wrong_number: 'red', do_not_call: 'red',
};
const OPEN: Outcome[] = ['to_call'];
/* No answer: how many tries in a row went unanswered, and whether it's time for the next one. */
const missedInARow = (r: { log: { outcome: Outcome }[] }) => { let n = 0; for (const h of r.log) { if (h.outcome === 'no_answer') n++; else break; } return n; };
const RETRY_HOURS = 20;
const readyAgain = (r: { status: Outcome; last_called_at?: string | null }) => r.status === 'no_answer' && (!r.last_called_at || Date.now() - new Date(r.last_called_at).getTime() >= RETRY_HOURS * 36e5);
const partOfDay = (iso?: string | null) => { if (!iso) return ''; const h = new Date(iso).getHours(); return h < 12 ? 'morning' : h < 16 ? 'afternoon' : 'evening'; };
const WARM: Outcome[] = ['interested', 'mockup', 'meeting'];
const DONE: Outcome[] = ['not_interested', 'wrong_number', 'do_not_call'];

/* ── phone numbers: a tel: link that works from Lagos ── */
function telHref(phone?: string | null, country?: string | null) {
  const raw = String(phone ?? '').split(/[,/;]| or /i)[0];
  let d = raw.replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return 'tel:' + d;
  if (d.startsWith('00')) return 'tel:+' + d.slice(2);
  const uk = /kingdom|uk/i.test(country ?? '');
  if (d.startsWith('0')) return 'tel:+' + (uk ? '44' : '234') + d.slice(1);
  if (d.startsWith('234') || d.startsWith('44')) return 'tel:+' + d;
  return 'tel:' + d;
}

/** The number as a phone dialler wants it: +234..., no spaces. */
const dialable = (phone?: string | null, country?: string | null) => telHref(phone, country).replace(/^tel:/, '');
function copyNumber(phone: string | null | undefined, country: string | null | undefined, toast: (t: string, k?: any) => void) {
  const n = dialable(phone, country);
  if (!n) { toast('No phone number for this company', 'warn'); return; }
  const done = () => toast(`Copied ${n}. Paste it into your phone.`);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(n).then(done).catch(() => prompt('Copy this number:', n));
  else prompt('Copy this number:', n);
}

/* ── the words for one call, built from what we know about the company ── */
const firstName = (n?: string | null) => (n ?? '').replace(/^(engr|dr|mr|mrs|ms|chief|prof|arc|barr)\.?\s+/i, '').split(/\s+/)[0] || '';
const domainOf = (l: Lead) => {
  const w = (l.website ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (w) return w;
  const m = (l.gaps ?? '').match(/\b([a-z0-9-]+\.(?:com|ng|com\.ng|net|org|co\.uk))\b/i);
  return m ? m[1].toLowerCase() : '';
};
const firstSentence = (t?: string | null) => (t ?? '').split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
const daypart = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; };
const sectorWord = (l: Lead) => ({
  logistics: 'logistics', realestate: 'property', facility: 'facility management', security: 'security', engineering: 'engineering',
  construction: 'construction', lab: 'diagnostic', clinic: 'healthcare', pharma: 'medical supply', school: 'school', manufacturing: 'distribution',
  professional: 'professional services', insurance: 'insurance', microfinance: 'finance', staffing: 'staffing', homecare: 'care',
} as Record<string, string>)[l.niche ?? ''] ?? 'business';
const checkLines = (notes?: string | null) => (notes ?? '').split('\n').filter((x) => /^Check first:|free Gmail\/Yahoo/i.test(x));
const callNotes = (notes?: string | null) => (notes ?? '').split('\n').filter((x) => !/^Check first:|free Gmail\/Yahoo/i.test(x));

function script(l: Lead) {
  const name = l.contact_name || '';
  const fn = firstName(name);
  const who = name || 'the owner or the MD';
  const dom = domainOf(l);
  const finding = l.gaps ? firstSentence(l.gaps) : `${l.company} has no proper website that shows customers what you do`;
  const abroad = !!l.country && !/nigeria/i.test(l.country);
  const where = abroad ? '' : ' here in Lagos';
  return {
    gatekeeper: `Good ${daypart()}. Please may I speak with ${who}? My name is Michael, from Ferrn. It's about ${l.company}'s website.`,
    gatekeeperWhy: `If they ask what it's about: "I found something on ${l.company}'s website that affects how customers find you, and I'd like to tell ${name ? fn : 'the person in charge'} about it. It takes two minutes." If ${fn || 'they'} isn't in: "When is the best time to reach ${fn || 'them'}? And is there an email or WhatsApp I can send a short note to?" Get the receptionist's name and thank them by name.`,
    opener: `Good ${daypart()}, is this ${name || `the owner of ${l.company}`}? ... ${fn ? fn + ', my' : 'My'} name is Michael. I run Ferrn, a web design company${where}. I'm calling because I ${dom ? `looked at ${dom}` : `looked ${l.company} up online`} and found something I think you'd want to know about. Have I caught you at a bad time?`,
    finding: l.gaps ? `In your own words, tell them what you found: ${l.gaps}` : `"${finding}"`,
    why: `Then say why it matters, in one breath: "${abroad ? 'When' : 'These days, when'} someone hears about ${l.company} and looks you up, this is the first thing they see of you, before they ever call. For a ${sectorWord(l)} company your size, it makes you look smaller than you are."`,
    questions: [
      `How do most of your new clients find you at the moment?`,
      `When someone searches for ${l.company}, what would you want them to see first?`,
      `Who looks after the website for you now?`,
      `Is anything new coming up this year: a new branch, a new service, bigger clients?`,
      `If the website worked exactly the way you wanted, what would it do for you?`,
      `Apart from you, who else would decide on something like this?`,
    ],
    tell: [
      `The fix: "It's very fixable. ${l.gaps && /down|suspend|load|503|not secure/i.test(l.gaps) ? 'First we get it back up and secure, then' : 'We'} build a fast site that works well on phones, shows your real work, and that Google can read."`,
      `Who we are: "We design and build websites, and web systems like client portals, for established businesses${abroad ? ' in the UK and Nigeria' : ' in Lagos'}. We've done it for companies like Gromzia Ventures in logistics and M-P Infrastructure in engineering."`,
      `Keep it short: under 30 seconds, then go back to a question.`,
    ],
    close: `"Here's what I'd like to do, at no cost. I'll put together a mock-up of what a new ${l.company} homepage could look like, so you can see it before deciding anything. Should I send it to your WhatsApp or your email?" Then: "Once you've seen it, can we take 15 minutes to go through it together? Would Tuesday or Wednesday be better?"`,
    wrap: `"Thank you${fn ? ', ' + fn : ''}. So I'll send the mock-up to your [WhatsApp/email] by [day], and we'll speak on [day]. Have a lovely day." Then send the WhatsApp straight away, and log the call here.`,
    whatsapp: `Good ${daypart()}${fn ? ' ' + fn : ''}, this is Michael from Ferrn. I just tried to call you about ${l.company}'s website. ${finding.replace(/\.$/, '')}. I'd like to send you a free mock-up of a new homepage. Would that be useful?`,
    abroad,
  };
}

/* ── reading the uploaded sheet (CSV or Excel), in the browser ── */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function parseXlsx(buf: ArrayBuffer): string[][] {
  const z = unzipSync(new Uint8Array(buf));
  const doc = (p: string) => (z[p] ? new DOMParser().parseFromString(strFromU8(z[p]), 'application/xml') : null);
  const ss = doc('xl/sharedStrings.xml');
  const strings = ss ? Array.from(ss.getElementsByTagName('si')).map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')) : [];
  let path = 'xl/worksheets/sheet1.xml';
  const wb = doc('xl/workbook.xml'), rels = doc('xl/_rels/workbook.xml.rels');
  const first = wb?.getElementsByTagName('sheet')[0];
  const rid = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rel = rels && rid ? Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid) : null;
  if (rel) { const tg = rel.getAttribute('Target') ?? ''; path = tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, ''); }
  const sheet = doc(path);
  if (!sheet) throw new Error('Could not read the first sheet of that file.');
  const colIdx = (ref: string) => { const letters = ref.replace(/\d+/g, ''); let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  return Array.from(sheet.getElementsByTagName('row')).map((r) => {
    const out: string[] = [];
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = t === 's' ? strings[Number(v)] ?? '' : t === 'inlineStr' ? Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('') : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v;
      out[colIdx(c.getAttribute('r') ?? 'A1')] = val;
    }
    return Array.from(out, (x) => x ?? '');
  });
}
async function readSheet(file: File): Promise<Record<string, string>[]> {
  const grid = /\.xlsx$/i.test(file.name) ? parseXlsx(await file.arrayBuffer()) : /\.xls$/i.test(file.name)
    ? (() => { throw new Error('Old .xls files can’t be read. In Excel, save it as .xlsx or CSV and upload that.'); })()
    : parseCsv(await file.text());
  const head = grid.findIndex((r) => r.some((x) => /company|business|name/i.test(x ?? '')));
  if (head < 0) throw new Error('No header row with a "Company" column was found.');
  const cols = grid[head].map((h) => String(h ?? '').trim());
  return grid.slice(head + 1).filter((r) => r.some((x) => String(x ?? '').trim())).map((r) => Object.fromEntries(cols.map((c, i) => [c || `col${i + 1}`, String(r[i] ?? '').trim()])));
}

export function Calls() {
  const toast = useToast();
  const { go } = useRoute();
  const { data, loading, error, reload, setData } = useData(() => api<{ rows: Row[] }>('/calls'), []);
  const [tab, setTab] = useState<'open' | 'noanswer' | 'callback' | 'warm' | 'done' | 'guide'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [upload, setUpload] = useState<null | { busy: boolean; result?: any; file?: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bounced = useData(() => api<{ count: number }>('/calls/bounced').then((r) => r.count).catch(() => 0), [data?.rows?.length]);
  const moveBounced = async () => {
    try { const r = await api('/calls/bounced', { body: {} }); toast(`${r.added} bounced email lead${r.added === 1 ? '' : 's'} added to the call list`); reload(); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  const rows: Row[] = data?.rows ?? [];
  const now = Date.now();
  const due = (r: Row) => r.status === 'callback' && (!r.callback_at || new Date(r.callback_at).getTime() <= now + 864e5);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inTab = (r: Row) => tab === 'open' ? OPEN.includes(r.status) : tab === 'noanswer' ? r.status === 'no_answer' : tab === 'callback' ? r.status === 'callback' : tab === 'warm' ? WARM.includes(r.status) : DONE.includes(r.status);
    const tierRank = (t?: string | null) => ({ A: 0, B: 1, C: 2 } as Record<string, number>)[t ?? ''] ?? 3;
    return rows.filter(inTab)
      .filter((r) => !s || `${r.lead.company} ${r.lead.contact_name ?? ''} ${r.lead.city ?? ''} ${r.lead.niche ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => tab === 'callback' ? String(a.callback_at ?? '').localeCompare(String(b.callback_at ?? ''))
        : tab === 'noanswer' ? (Number(readyAgain(b)) - Number(readyAgain(a))) || (missedInARow(a) - missedInARow(b)) || String(a.last_called_at ?? '').localeCompare(String(b.last_called_at ?? ''))
        : (a.attempts - b.attempts) || (tierRank(a.lead.tier) - tierRank(b.lead.tier)) || a.lead.company.localeCompare(b.lead.company));
  }, [rows, tab, q]);
  const pg = usePaged<Row>(list, 'calls', [q, tab]);
  const current = rows.find((r) => r.id === sel) ?? null;

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setUpload({ busy: true, file: f.name });
    try {
      const items = await readSheet(f);
      if (!items.length) throw new Error('That file has no rows under the header.');
      const r = await api('/calls/import', { body: { rows: items, file: f.name, to_calls: true } });
      setUpload({ busy: false, result: r, file: f.name });
      toast(`${r.added} new · ${r.updated} updated · ${r.to_calls} added to Cold calls`);
      reload();
    } catch (x: any) { setUpload(null); toast(x.message, 'err'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const patchRow = (r: Row) => setData((d: any) => ({ ...d, rows: (d?.rows ?? []).map((x: Row) => (x.id === r.id ? { ...x, ...r, lead: x.lead } : x)) }));

  if (loading && !data) return <Loading />;
  const counts = {
    open: rows.filter((r) => OPEN.includes(r.status)).length, noanswer: rows.filter((r) => r.status === 'no_answer').length, ready: rows.filter(readyAgain).length, callback: rows.filter((r) => r.status === 'callback').length,
    dueNow: rows.filter(due).length, warm: rows.filter((r) => WARM.includes(r.status)).length, done: rows.filter((r) => DONE.includes(r.status)).length,
    week: rows.filter((r) => r.last_called_at && now - new Date(r.last_called_at).getTime() < 7 * 864e5).length,
  };
  return (
    <Page title="Cold calls" sub="Companies you phone instead of emailing. Only companies that aren't already in email outreach come here, and nobody on this list is ever emailed by LeadsHunter."
      actions={<>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn sm primary" disabled={!!upload?.busy} onClick={() => fileRef.current?.click()}><Upload size={14} />{upload?.busy ? 'Uploading…' : 'Upload companies'}</button>
        {bounced.data ? <button className="btn sm" onClick={moveBounced} title="Leads whose email bounced: phone them instead"><PhoneOff size={14} />Add {bounced.data} bounced emails</button> : null}
        <button className="btn sm ghost" onClick={reload}><RefreshCw size={14} />Refresh</button>
      </>}>
      {error ? <ErrorNote error={error} onRetry={reload} /> : null}
      {upload?.result ? <UploadResult r={upload.result} file={upload.file} onClose={() => setUpload(null)} /> : null}
      <div className="kpi-row five">
        <div className="kpi"><h4>To call</h4><strong>{counts.open}</strong><small>not called yet</small></div>
        <div className="kpi"><h4>No answer</h4><strong>{counts.noanswer}</strong><small>{counts.ready} ready to try again</small></div>
        <div className="kpi"><h4>Call back</h4><strong>{counts.callback}</strong><small>{counts.dueNow} due today</small></div>
        <div className="kpi"><h4>Interested</h4><strong>{counts.warm}</strong><small>incl. free mock-ups and meetings</small></div>
        <div className="kpi"><h4>Called · 7 days</h4><strong>{counts.week}</strong><small>{counts.done} closed</small></div>
      </div>
      <Tabs tabs={[['open', `To call (${counts.open})`], ['noanswer', `No answer (${counts.noanswer})`], ['callback', `Call back (${counts.callback})`], ['warm', `Interested (${counts.warm})`], ['done', `Closed (${counts.done})`], ['guide', 'Call guide']]} value={tab} onChange={(v) => { setTab(v as any); setSel(null); }} />
      {tab === 'guide' ? <Guide /> : !rows.length ? (
        <Card><Empty icon={PhoneCall} title="No companies to call yet" action={<button className="btn sm primary" onClick={() => fileRef.current?.click()}><Upload size={14} />Upload companies</button>}>
          Upload a CSV or Excel sheet with at least a Company and a Phone column (Email, Contact, Sector, Where, Tier and notes are picked up too). Or open a lead and choose “Add to cold calls”.
        </Empty></Card>
      ) : (
        <div className="wa-layout">
          <Card className="wa-list" title={<input className="input" placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} />}>
            {!list.length ? <Empty compact icon={Check} title="Nothing here">{tab === 'callback' ? 'No call-backs waiting.' : tab === 'noanswer' ? 'Everyone you called picked up. When a call goes unanswered, log “No answer” and it waits here for the next try.' : 'Nothing in this list right now.'}</Empty> : pg.rows.map((r) => (
              <button key={r.id} className={`wa-row ${sel === r.id ? 'on' : ''}`} onClick={() => setSel(r.id)}>
                <span className="avatar call-avatar">{r.lead.company.slice(0, 1).toUpperCase()}</span>
                <span className="wa-row-main">
                  <b>{r.lead.company}{r.lead.tier ? <Badge tone={r.lead.tier === 'A' ? 'orange' : 'default'}>{r.lead.tier}</Badge> : null}{due(r) ? <Badge tone="orange">due</Badge> : null}
                    {r.status === 'no_answer' ? (missedInARow(r) >= 3 ? <Badge>3 tries</Badge> : readyAgain(r) ? <Badge tone="green">try again</Badge> : null) : null}</b>
                  <small>{r.status === 'no_answer' ? `No answer ${missedInARow(r)}× · last tried ${r.last_called_at ? `${fmtDate(r.last_called_at, true)} (${partOfDay(r.last_called_at)})` : ''}` : [r.lead.contact_name, r.lead.city].filter(Boolean).join(' · ') || r.lead.phone}</small>
                </span>
                <span className="call-row-end">
                  <small className="muted">{r.status === 'callback' && r.callback_at ? fmtDate(r.callback_at, true) : r.status !== 'no_answer' && r.attempts ? `${r.attempts}×` : ''}</small>
                  {r.lead.phone ? <span role="button" tabIndex={0} className="call-copy" title={`Copy ${dialable(r.lead.phone, r.lead.country)}`}
                    onClick={(e) => { e.stopPropagation(); copyNumber(r.lead.phone, r.lead.country, toast); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); copyNumber(r.lead.phone, r.lead.country, toast); } }}><Copy size={14} /></span> : null}
                </span>
              </button>
            ))}
            <Pager pg={pg} noun="companies" />
          </Card>
          {current ? <CallCard key={current.id} r={current} onSaved={patchRow} onRemoved={() => { setSel(null); reload(); }} openLead={() => go(`/leads?id=${current.lead_id}`)} />
            : <Card className="wa-thread"><Empty icon={Phone} title="Pick a company">Choose a company to see who to ask for, what to say, and to log the call.</Empty></Card>}
        </div>
      )}
    </Page>
  );
}

function UploadResult({ r, file, onClose }: { r: any; file?: string; onClose: () => void }) {
  return (
    <div className="callout call-upload">
      <Info size={15} /> <span><strong>{file}:</strong> {r.added} new compan{r.added === 1 ? 'y' : 'ies'}, {r.updated} updated, {r.to_calls} added to the call list.
        {r.in_email?.length ? <> {r.in_email.length} skipped because they're already in email outreach: {r.in_email.slice(0, 8).join(', ')}{r.in_email.length > 8 ? '…' : ''}.</> : null}
        {r.skipped?.length ? <> {r.skipped.length} row{r.skipped.length === 1 ? '' : 's'} skipped ({r.skipped.slice(0, 4).map((s: any) => `row ${s.row}: ${s.why}`).join('; ')}{r.skipped.length > 4 ? '…' : ''}).</> : null}
        {' '}Upload the same sheet again any time: changed details are updated and your call notes stay.</span>
      <button className="btn sm ghost" onClick={onClose}>Close</button>
    </div>
  );
}

function CallCard({ r, onSaved, onRemoved, openLead }: { r: Row; onSaved: (r: Row) => void; onRemoved: () => void; openLead: () => void }) {
  const toast = useToast();
  const l = r.lead;
  const s = useMemo(() => script(l), [l.id]);
  const [note, setNote] = useState('');
  const [cb, setCb] = useState(toLocalInput(r.callback_at) || '');
  const [notes, setNotes] = useState(r.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<Prep | null>(r.prep ?? null);
  const [prepBusy, setPrepBusy] = useState(false);
  const checks = checkLines(l.notes);
  const tel = telHref(l.phone, l.country);
  const log = async (outcome: Outcome) => {
    if (outcome === 'callback' && !cb) { toast('Pick a call-back time first', 'warn'); return; }
    setBusy(true);
    try {
      const res = await api(`/calls/${r.id}`, { method: 'PATCH', body: { outcome, note, callback_at: outcome === 'callback' ? fromLocalInput(cb) : r.callback_at ?? null } });
      onSaved(res.item); setNote(''); toast(`Logged: ${LABEL[outcome]}`);
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const saveNotes = async () => {
    if (notes === (r.notes ?? '')) return;
    try { const res = await api(`/calls/${r.id}`, { method: 'PATCH', body: { notes } }); onSaved(res.item); toast('Notes saved'); } catch (x: any) { toast(x.message, 'err'); }
  };
  const doPrep = async () => {
    setPrepBusy(true);
    try { const res = await api(`/calls/${r.id}/prep`, { body: {} }); setPrep(res.prep); } catch (x: any) { toast(x.message, 'err'); } finally { setPrepBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Take ${l.company} off the call list? The lead stays in Leads.`)) return;
    try { await api(`/calls/${r.id}`, { method: 'DELETE' }); onRemoved(); } catch (x: any) { toast(x.message, 'err'); }
  };
  const wa = waLink(s.abroad ? '' : l.phone, prep?.whatsapp_after || s.whatsapp);
  return (
    <Card className="wa-thread call-card" title={<span>{l.company} <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>{l.tier ? <Badge tone={l.tier === 'A' ? 'orange' : 'default'}>Tier {l.tier}</Badge> : null}</span>}
      actions={<div className="row gap">
        <button className="btn sm ghost" onClick={openLead}><UserRound size={14} />Lead</button>
        <button className="btn sm ghost danger" onClick={remove} title="Take off the call list"><Trash2 size={14} /></button>
      </div>}>
      <div className="row-actions">
        {tel ? <>
          <button className="btn primary" onClick={() => copyNumber(l.phone, l.country, toast)} title="Copies the number so you can paste it into your phone"><Copy size={15} />Copy {dialable(l.phone, l.country)}</button>
          <a className="btn ghost" href={tel} title="Calls from this device (works on a phone or with a calling app)"><Phone size={15} />Call</a>
        </> : <Badge tone="red">No phone number</Badge>}
        {wa ? <a className="btn ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a> : null}
        {l.email ? <a className="btn ghost" href={`mailto:${l.email}`}><Mail size={15} />{l.email}</a> : null}
        {l.website ? <a className="btn ghost" href={/^https?:/i.test(l.website) ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer"><Globe size={15} />Website</a> : null}
      </div>
      <dl className="call-facts">
        <div><dt>Ask for</dt><dd>{l.contact_name ? <>{l.contact_name}{l.role ? <span className="muted"> · {l.role}</span> : null}</> : <span className="muted">The owner or MD (name unknown: ask the receptionist)</span>}</dd></div>
        <div><dt>Where</dt><dd>{[l.city, l.country && !/nigeria/i.test(l.country) ? l.country : ''].filter(Boolean).join(', ') || '—'}</dd></div>
        <div><dt>What we found</dt><dd>{l.gaps || <span className="muted">Nothing recorded</span>}</dd></div>
        {callNotes(l.notes).filter((x) => !/^\d{4}-\d\d-\d\d call/.test(x)).length ? <div><dt>Notes</dt><dd className="pre">{callNotes(l.notes).filter((x) => !/^\d{4}-\d\d-\d\d call/.test(x)).join('\n')}</dd></div> : null}
      </dl>
      {r.status === 'no_answer' ? <NoAnswerNote r={r} /> : null}
      {checks.length ? <div className="callout warn"><AlertTriangle size={15} /> <span><strong>Before you dial:</strong> {checks.map((c) => c.replace(/^Check first:\s*/, '')).join(' ')}</span></div> : null}
      {s.abroad ? <div className="callout"><Info size={15} /> <span><strong>Calling abroad.</strong> UK business hours are 9:00 to 17:00 UK time (an hour behind Lagos in winter). Before a sales call to a UK business, check the number isn't on the Corporate TPS list (tpsservices.co.uk).</span></div> : null}

      <h3 className="call-h">Log this call</h3>
      <div className="call-log">
        <textarea rows={2} placeholder="What did they say? (saved with the outcome)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row-actions">
          <button className="btn sm" disabled={busy} onClick={() => log('no_answer')}><PhoneOff size={14} />No answer</button>
          <button className="btn sm" disabled={busy} onClick={() => log('callback')}><CalendarClock size={14} />Call back</button>
          <input type="datetime-local" className="call-cb" value={cb} onChange={(e) => setCb(e.target.value)} title="Call-back time" />
        </div>
        <div className="row-actions">
          <button className="btn sm primary" disabled={busy} onClick={() => log('mockup')}>Wants the free mock-up</button>
          <button className="btn sm" disabled={busy} onClick={() => log('meeting')}>Meeting booked</button>
          <button className="btn sm" disabled={busy} onClick={() => log('interested')}>Interested</button>
          <button className="btn sm ghost" disabled={busy} onClick={() => log('not_interested')}>Not interested</button>
          <button className="btn sm ghost" disabled={busy} onClick={() => log('wrong_number')}>Wrong number</button>
          <button className="btn sm ghost danger" disabled={busy} onClick={() => log('do_not_call')}>Do not call</button>
        </div>
        <p className="muted small">“Wants the free mock-up” puts it in Needs you for you to make. Every outcome is also written on the lead.</p>
      </div>

      <h3 className="call-h">What to say <button className="btn sm ghost" disabled={prepBusy} onClick={doPrep}><Sparkles size={14} />{prepBusy ? 'Preparing…' : prep ? 'Prepare again' : 'Tailor to this company'}</button></h3>
      {prep ? <PrepView p={prep} at={r.prep_at} /> : null}
      <div className="call-script">
        <Step n={1} title="If someone else picks up"><Say>{s.gatekeeper}</Say><p className="muted">{s.gatekeeperWhy}</p></Step>
        <Step n={2} title="Open (ask for permission)"><Say>{s.opener}</Say><p className="muted">Asking “have I caught you at a bad time?” lets them say “no, go ahead”, so they feel in control. If it is a bad time, book a time and hang up.</p></Step>
        <Step n={3} title="Give them the finding"><Say>{s.finding}</Say><p className="muted">Keep it to one or two sentences, said plainly, as something you saw yourself: “I looked at your website and it doesn’t load at the moment.” {s.why}</p></Step>
        <Step n={4} title="Ask, then listen (pick two or three)"><ul>{s.questions.map((x) => <li key={x}>“{x}”</li>)}</ul><p className="muted">Let them talk. Write their words in the note box: they're your best material for the mock-up.</p></Step>
        <Step n={5} title="Tell them (under 30 seconds)"><ul>{s.tell.map((x) => <li key={x}>{x}</li>)}</ul></Step>
        <Step n={6} title="The free offer and next step"><Say>{s.close}</Say></Step>
        <Step n={7} title="Wrap up"><Say>{s.wrap}</Say>
          <p className="muted">WhatsApp to send after the call (or if they don't pick up):</p>
          <div className="call-wa"><span>{prep?.whatsapp_after || s.whatsapp}</span><button className="btn sm ghost" onClick={() => copy(prep?.whatsapp_after || s.whatsapp, toast)}>Copy</button></div>
        </Step>
        <p className="muted small"><BookOpen size={13} /> Rejection, objections and how to put people at ease are in the <strong>Call guide</strong> tab.</p>
      </div>

      <h3 className="call-h">Your notes on {l.company}</h3>
      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Anything to remember for next time (saved when you click away)" />
      {r.log.length ? <>
        <h3 className="call-h">Calls so far</h3>
        <div className="call-history">{r.log.map((h, i) => (
          <div key={i}><Badge tone={TONE[h.outcome]}>{LABEL[h.outcome]}</Badge> <span className="muted small">{fmtDate(h.at, true)} · {h.by} · {ago(h.at)}</span>{h.note ? <p>{h.note}</p> : null}</div>
        ))}</div>
      </> : null}
    </Card>
  );
}

function NoAnswerNote({ r }: { r: Row }) {
  const n = missedInARow(r), last = r.last_called_at, part = partOfDay(last);
  const other = part === 'morning' ? 'the afternoon (14:00 to 16:00)' : 'the morning (10:00 to 12:00)';
  const hoursLeft = last ? Math.ceil(RETRY_HOURS - (Date.now() - new Date(last).getTime()) / 36e5) : 0;
  return (
    <div className={`callout ${n >= 3 ? 'warn' : ''}`}><PhoneOff size={15} /> <span>
      <strong>No answer {n}× in a row</strong>{last ? <>, last tried {fmtDate(last, true)} ({part})</> : null}.{' '}
      {n >= 3 ? <>That’s three tries: stop calling for now. Send the WhatsApp below and give it a week, or log “Do not call” if the number seems dead.</>
        : readyAgain(r) ? <>Ready for another try. Call in {other} this time, and send the WhatsApp if it goes unanswered again.</>
        : <>Try again in about {hoursLeft} hour{hoursLeft === 1 ? '' : 's'}, in {other}. If you haven’t yet, send the WhatsApp below so they know who’s calling.</>}
    </span></div>
  );
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="call-step"><span className="call-n">{n}</span><div><h4>{title}</h4>{children}</div></div>
);
const Say = ({ children }: { children: React.ReactNode }) => <p className="call-say">{children}</p>;

function PrepView({ p, at }: { p: Prep; at?: string | null }) {
  return (
    <div className="call-prep">
      <p className="muted small"><Sparkles size={13} /> Tailored to this company{at ? ` ${ago(at)}` : ''}. Use it with the steps below.</p>
      {p.watch_out ? <div className="callout warn"><AlertTriangle size={15} /> <span>{p.watch_out}</span></div> : null}
      {p.gatekeeper ? <><h4>To the receptionist</h4><Say>{p.gatekeeper}</Say></> : null}
      {p.opener ? <><h4>Opener</h4><Say>{p.opener}</Say></> : null}
      {p.finding ? <><h4>The finding</h4><Say>{p.finding}</Say>{p.why_it_matters ? <p className="muted">{p.why_it_matters}</p> : null}</> : null}
      {p.questions?.length ? <><h4>Questions</h4><ul>{p.questions.map((x) => <li key={x}>“{x}”</li>)}</ul></> : null}
      {p.tell_them?.length ? <><h4>Tell them</h4><ul>{p.tell_them.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
      {p.objections?.length ? <><h4>If they say…</h4>{p.objections.map((o) => <div key={o.they_say} className="call-obj"><b>“{o.they_say}”</b><Say>{o.you_say}</Say></div>)}</> : null}
      {p.close ? <><h4>Close</h4><Say>{p.close}</Say></> : null}
    </div>
  );
}

/* ── the general call guide ── */
const OBJECTIONS: [string, string][] = [
  ['“We’re not interested.”', '“No problem at all, thank you for being straight with me. Can I ask, is it that the website isn’t a priority right now, or that you’re happy with it as it is?” If it’s timing: “Would it be okay if I sent the free mock-up anyway, so you have it when it is?” If it’s still no, thank them warmly and log Not interested. Never push past a second no.'],
  ['“We already have a website.”', '“You do, and that’s actually why I called.” Then give the finding in one sentence. “It’s usually a quicker fix than people expect.”'],
  ['“We have someone who does our website.”', '“That’s great, then this is easy to pass on. I can send the findings so your developer can fix them. And if you ever want a second opinion, the mock-up is free.”'],
  ['“Just send me an email.”', '“I will. So I send the right thing: what matters most to you, being found on Google, looking more established, or customers doing things online? And which email is best?” Send it within the hour and log Call back for two days later.'],
  ['“How much does it cost?”', '“It depends on what you need. Most websites we build for companies your size are between ₦1.5 million and ₦5 million. That’s why I start with the free mock-up: you see the value before we talk money.” (Abroad: from $3,000.)'],
  ['“We don’t have the budget right now.”', '“Understood. A lot of our clients start small and add to it later. Would the free mock-up still help, so you can plan for it? When does your next budget start?”'],
  ['“I’m busy.”', '“I’ll be quick then. Is later today or tomorrow morning better?” Book the time, log Call back, and hang up. Respecting their time is what earns the next call.'],
  ['“How did you get my number?”', '“Your company is listed on a business directory with this number. I’m sorry if it’s a bad moment.” Then carry on, or offer to call back.'],
  ['“We get all our clients by referral.”', '“That’s the best way to get clients. The thing is, almost everyone who’s referred still looks you up before they call. What they find decides whether they pick up the phone.”'],
  ['“Send me something on WhatsApp.”', '“Of course. I’ll send it now. Is this the right number for WhatsApp?” Send it while you’re still on the call if you can.'],
];

function Guide() {
  return (
    <div className="call-guide">
      <Card title="Before you dial">
        <ul>
          <li>Read the company’s card: who to ask for, what we found, and anything marked “Before you dial”.</li>
          <li>Open their website (or search their name) so you’ve seen the problem with your own eyes.</li>
          <li>Best times in Lagos: 10:00 to 12:00 and 14:00 to 16:00, Tuesday to Thursday. Avoid Monday morning, lunchtime and Friday afternoon.</li>
          <li>Stand up and smile. People can hear it. Speak a little slower than normal.</li>
          <li>Have one goal for the call: a yes to the free mock-up. Not a sale.</li>
        </ul>
      </Card>
      <Card title="The call, step by step">
        <ol>
          <li><b>Greet and ask for the person by name.</b> “Good morning, please may I speak with Mr Okonkwo?” If there’s no name: “Who looks after the business side, the MD or the owner?”</li>
          <li><b>Say who you are and why you’re calling, then ask permission.</b> “I’m Michael, I run Ferrn, a web design company here in Lagos. I looked at your company online and found something you’d want to know about. Have I caught you at a bad time?”</li>
          <li><b>Give the finding.</b> One specific thing, said plainly: “Your website is down at the moment, it only shows a hosting notice.” Then one sentence on what it means for them.</li>
          <li><b>Ask, then listen.</b> Two or three open questions. Let them talk at least half the call.</li>
          <li><b>Tell them, briefly.</b> The fix in one sentence, one line about Ferrn, one similar past project if there is one.</li>
          <li><b>Offer the free mock-up.</b> “At no cost, I’ll put together a mock-up of a new homepage for you. WhatsApp or email?”</li>
          <li><b>Agree the next step and wrap up.</b> Repeat what happens next and when. Thank them by name. Send the WhatsApp straight away and log the call.</li>
        </ol>
      </Card>
      <Card title="Questions that get them talking">
        <ul>
          <li>“How do most of your new clients find you at the moment?”</li>
          <li>“When someone searches for your company, what would you want them to see first?”</li>
          <li>“Who looks after the website for you now? When was it last updated?”</li>
          <li>“Is anything new coming up: a branch, a new service, bigger clients?”</li>
          <li>“What do clients usually ask before they decide to work with you?”</li>
          <li>“If the website worked exactly the way you wanted, what would it do for you?”</li>
          <li>“Apart from you, who else would decide on something like this?”</li>
        </ul>
        <p className="muted">Open questions start with how, what, who or when. Avoid questions with a yes/no answer early on, and never ask “Do you need a website?”</p>
      </Card>
      <Card title="What to tell them">
        <ul>
          <li><b>The problem, specifically.</b> What you saw on their site or on Google. Specific beats clever.</li>
          <li><b>What it costs them.</b> People look them up before calling; a broken or empty site makes a real business look small or closed.</li>
          <li><b>The fix, in one sentence.</b> Plain words, no tech terms.</li>
          <li><b>Who Ferrn is.</b> “We design and build websites, and systems like client portals, for established businesses.” Mention Gromzia Ventures (logistics), M-P Infrastructure (engineering) or Relay (freight web app) only if it’s the same kind of business.</li>
          <li><b>The free mock-up.</b> They see it before deciding anything. No obligation.</li>
          <li><b>Never</b> promise dates, discounts, rankings or results you can’t guarantee. Prices only as a range, and only if they ask.</li>
        </ul>
      </Card>
      <Card title="Making them feel at ease">
        <ul>
          <li>Ask permission and say how long it takes (“two minutes”), then keep to it.</li>
          <li>Lead with something useful to them, not with what you sell.</li>
          <li>Use their name, warmly. “Sir” or “Ma” is fine until they invite first names.</li>
          <li>Slow down, pause, and let silences sit. Don’t talk over them.</li>
          <li>Agree before you answer: “That makes sense.” “I understand.” Then respond.</li>
          <li>Give them the choices: WhatsApp or email, Tuesday or Wednesday.</li>
          <li>Take the pressure off out loud: “There’s no obligation at all. If it’s not for you, that’s completely fine.”</li>
          <li>Be honest. If you don’t know something, say you’ll check and come back to them.</li>
          <li>End on time and thank them, whatever the answer.</li>
        </ul>
      </Card>
      <Card title="Handling rejection and objections">
        <p className="muted">Agree, ask one question, offer the free mock-up. If it’s still no, thank them and move on. Never argue, and never push past a second no.</p>
        <div className="call-objs">{OBJECTIONS.map(([o, a]) => <div key={o} className="call-obj"><b>{o}</b><p>{a}</p></div>)}</div>
      </Card>
      <Card title="Keeping your head up">
        <ul>
          <li>Most calls don’t connect. One good conversation in every five to ten dials is normal.</li>
          <li>A no is usually about timing, not about you. Log it and dial the next one straight away.</li>
          <li>Leave every call so that they’d happily take your next one.</li>
          <li>Set a block: 10 calls in an hour, then a break. Count dials, not just yeses.</li>
          <li>After each session, read your notes: which opener got people talking? Use it more.</li>
        </ul>
      </Card>
      <Card title="No answer, voicemail and follow-up">
        <ul>
          <li>No answer: send the WhatsApp from the company’s card straight away (it says you tried to call and offers the free mock-up). Log No answer.</li>
          <li>Try again two days later at a different time of day. After three tries with no answer, stop calling and leave the WhatsApp to work.</li>
          <li>Voicemail (rare in Nigeria, common abroad): under 20 seconds. Your name, the company, the one finding, your number twice.</li>
          <li>Call back: always pick a time with them and log it here, so it shows under Call back on the day.</li>
        </ul>
      </Card>
      <Card title="After every call">
        <ul>
          <li>Log the outcome and a one-line note in their words.</li>
          <li>“Wants the free mock-up” goes to Needs you: make it within two working days and send it on the channel they chose.</li>
          <li>“Meeting booked”: add it under Meetings with the time you agreed.</li>
          <li>“Do not call” if they ask you not to call again. Respect it; it’s their right under Nigeria’s data protection law.</li>
          <li>Nobody on this list gets emailed by LeadsHunter, so the follow-up is yours: WhatsApp, a call, or a personal email.</li>
        </ul>
      </Card>
      <Card title="Adding companies">
        <p>Use <b>Upload companies</b> with a CSV or Excel file. The first sheet is read, and columns are matched by name: Company (required), Phone, Email, Decision maker or Contact, Sector, Where or City, Tier, Why they need a site, Size signs, Website status, Directory, Listing and Check before sending. Upload the same sheet again whenever you update it: existing companies are updated (matched by email, phone, website or name), new ones are added, and your call notes and outcomes are kept. Companies already in email outreach are skipped, so nobody gets both.</p>
      </Card>
    </div>
  );
}
