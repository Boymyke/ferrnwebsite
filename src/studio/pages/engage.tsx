import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Bot, Download, Pause, Briefcase as Linkedin, Camera as Instagram, Check, Copy, ExternalLink, Heart, Info, MessageSquareText, RefreshCw, Send, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { ago, api, list } from '../api';
import { Badge, Card, Empty, ErrorNote, Loading, Page, Pager, Tabs, useData, usePaged, useRoute, useToast } from '../ui';

type Platform = 'instagram' | 'linkedin';
type Item = {
  id: string; kind: 'dm' | 'comment'; platform: Platform; status: 'draft' | 'sent' | 'skipped';
  lead_id?: string | null; company?: string | null; person?: string | null; url: string; context?: string | null;
  drafts: string[]; note?: string | null; sent_text?: string | null; liked?: boolean;
  created_at: string; created_by: string; done_at?: string | null; done_by?: string | null; follow_up_at?: string | null; auto?: boolean;
  dm_url?: string | null;
};
type Stats = { waiting: number; week: number; instagram: number; linkedin: number; followUps: number };
type Res = { items: Item[]; stats: { dm: Stats; comment: Stats } };

const PLAT: Record<Platform, { label: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram', icon: <Instagram size={15} /> },
  linkedin: { label: 'LinkedIn', icon: <Linkedin size={15} /> },
};

/** Where a DM is sent from: Instagram's own DM link opens the message thread itself (not the profile). */
export function dmUrl(it: { platform: Platform; url: string; kind: string; dm_url?: string | null }) {
  if (it.kind !== 'dm' || it.platform !== 'instagram') return it.url;
  // instagram.com/direct/t/<id> resolved on the server; otherwise the profile (Message button).
  // Never ig.me: some networks can't reach it.
  return it.dm_url || it.url;
}

/** Copies synchronously, inside the click, BEFORE any tab opens. Once a new tab takes focus the browser
 *  refuses clipboard writes, which is why the message used to be missing when you pasted. */
export function copyNow(text: string): boolean {
  let ok = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
    ta.remove();
  } catch { ok = false; }
  if (!ok) navigator.clipboard?.writeText(text).then(() => null, () => null);
  return ok || !!navigator.clipboard;
}
/** Opens a new tab and cuts its link back to Studio. ('noopener' in the features makes window.open return
 *  null, which looked like a blocked pop-up.) */
function openTab(url: string) {
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch { /* cross-origin */ } }
  return w;
}
const PASTE = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V';

function copyOpen(text: string, url: string, toast: (t: string, k?: any) => void) {
  const copied = copyNow(text);
  const w = openTab(url);
  toast(copied ? `Copied. In the tab that opened, click the message box, press ${PASTE}, then Enter` : 'Couldn’t copy automatically. Select the text and copy it', copied ? undefined : 'err');
  if (!w) toast('Your browser blocked the new tab. Allow pop-ups for Studio', 'err');
}

/** The Ferrn DM helper (a small Chrome extension) marks the page when it is installed. */
function useHelper() {
  const read = () => document.documentElement.dataset.ferrnHelper || '';
  const [v, setV] = useState(read);
  useEffect(() => { if (v) return; const t = setTimeout(() => setV(read()), 800); return () => clearTimeout(t); }, []);
  return v;
}
/** Instagram restricts accounts that open many new chats quickly, so Send all keeps a human pace. */
const DAILY_CAP = 25;
const gap = () => 25 + Math.floor(Math.random() * 21); // 25 to 45 seconds between chats
type Live = { it: Item; text: string; state: 'opening' | 'typed' | 'stuck' | 'error'; detail?: string };

export function Engage({ kind }: { kind: 'dm' | 'comment' }) {
  const toast = useToast();
  const [view, setView] = useState<'draft' | 'sent' | 'followup' | 'skipped'>('draft');
  const [platform, setPlatform] = useState<'' | Platform>('');
  const { data, error, loading, reload, setData } = useData<Res>(() => api(`/engage?kind=${kind}`), [kind]);
  const items = data?.items ?? [];
  const shown = useMemo(() => items.filter((i) => (!platform || i.platform === platform) && (
    view === 'followup' ? i.status === 'sent' && i.follow_up_at && Date.parse(i.follow_up_at) <= Date.now() : i.status === view)), [items, view, platform]);
  const pg = usePaged(shown, `engage-${kind}`, [view, platform]);
  const st = data?.stats[kind];
  const put = (it: Item) => setData((d: Res | null) => (d ? { ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) } : d));
  const patch = async (id: string, body: Record<string, unknown>, msg?: string) => {
    try { const r = await api<{ item: Item }>(`/engage/${id}`, { method: 'PATCH', body }); put(r.item); if (msg) toast(msg); if (body.status) reload(); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  const del = async (id: string) => {
    if (!confirm('Remove this draft?')) return;
    try { await api(`/engage/${id}`, { method: 'DELETE' }); toast('Removed'); reload(); } catch (x: any) { toast(x.message, 'err'); }
  };
  const isDm = kind === 'dm';
  const helper = useHelper();
  const useHelperNow = isDm && !!helper;
  const queue = useMemo(() => items.filter((i) => i.status === 'draft' && (!platform || i.platform === platform) && i.drafts[0]), [items, platform]);
  const next = queue[0];

  /* Without the helper: copy, open their profile, confirm here once it went. */
  const [pending, setPending] = useState<{ it: Item; text: string } | null>(null);
  const copySend = async (it: Item, text: string) => {
    const copied = copyNow(text); // must happen before the new tab steals focus
    const w = openTab(dmUrl(it));
    if (!w) { toast('Your browser blocked the new tab. Allow pop-ups for Studio', 'err'); return; }
    if (!copied) toast('Couldn’t copy automatically. Use Copy only on the card', 'err');
    setPending({ it, text });
    toast(isDm ? `Message copied. In ${PLAT[it.platform].label}: click Message, click the message box, press ${PASTE}, then Enter` : `Comment copied. On the post, click Comment, press ${PASTE}, then post`);
  };
  const confirmSent = async (andNext: boolean) => {
    if (!pending) return;
    const { it, text } = pending;
    const after = queue.find((q) => q.id !== it.id);
    setPending(null);
    if (andNext && after) { await copySend(after, after.drafts[0]); }
    await patch(it.id, { status: 'sent', sent_text: text }, andNext && after ? undefined : (isDm ? 'Marked as sent' : 'Marked as posted'));
  };

  /* With the helper: one click opens the chat with the message typed in; pressing Enter there marks it sent here. */
  const [live, setLive] = useState<Live | null>(null);
  const [auto, setAuto] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const ref = useRef({ live, auto, queue, items, done: new Set<string>() });
  ref.current = { ...ref.current, live, auto, queue, items };
  const sentToday = () => {
    const day = new Date().toISOString().slice(0, 10);
    return ref.current.items.filter((i) => i.kind === 'dm' && i.status === 'sent' && (i.done_at ?? '').slice(0, 10) === day && !ref.current.done.has(i.id)).length + ref.current.done.size;
  };
  const openChat = (it: Item, text: string) => {
    copyNow(text); // a backup on the clipboard in case the chat box refuses the text
    setCountdown(0);
    setLive({ it, text, state: 'opening' });
    window.postMessage({ source: 'ferrn-studio', type: 'open', url: dmUrl(it), id: it.id, text, note: it.note ?? '', platform: it.platform }, location.origin);
  };
  const nextUp = () => ref.current.queue.find((q) => !ref.current.done.has(q.id) && q.id !== ref.current.live?.it.id);
  const stopAuto = (msg?: string) => { ref.current.auto = false; setAuto(false); setCountdown(0); if (msg) toast(msg); };
  const queueNext = () => {
    if (!ref.current.auto) return;
    if (sentToday() >= DAILY_CAP) return stopAuto(`${DAILY_CAP} sent today. Stopping here so Instagram doesn’t limit your account. Carry on tomorrow.`);
    if (!nextUp()) return stopAuto('All ready DMs are sent.');
    setCountdown(gap());
  };
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      if (countdown > 1) return setCountdown(countdown - 1);
      setCountdown(0);
      const n = nextUp();
      if (ref.current.auto && n) openChat(n, n.drafts[0]);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  const markSent = async (it: Item, text: string, how: string) => {
    ref.current.done.add(it.id);
    setLive(null);
    await patch(it.id, { status: 'sent', sent_text: text }, how);
    queueNext();
  };
  const onMsg = useRef<((e: MessageEvent) => void) | null>(null);
  onMsg.current = (e: MessageEvent) => {
    if (e.source !== window || e.data?.source !== 'ferrn-helper') return;
      const cur = ref.current.live;
      if (!cur || e.data.id !== cur.it.id) return;
      const name = cur.it.person || cur.it.company || 'them';
      if (e.data.type === 'typed') setLive({ ...cur, state: 'typed', detail: e.data.detail });
      else if (e.data.type === 'stuck') setLive({ ...cur, state: 'stuck', detail: e.data.detail });
      else if (e.data.type === 'error') { setLive({ ...cur, state: 'error', detail: e.data.detail }); stopAuto(); }
      else if (e.data.type === 'sent') markSent(cur.it, cur.text, `Sent to ${name}`);
      else if (e.data.type === 'closed') { setLive(null); stopAuto(`Chat with ${name} closed without sending. It stays in Ready.`); }
  };
  useEffect(() => {
    const on = (e: MessageEvent) => onMsg.current?.(e); // always the latest handler
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  const send = async (it: Item, text: string) => (useHelperNow ? openChat(it, text) : copySend(it, text));
  const sendAll = () => {
    if (sentToday() >= DAILY_CAP) return toast(`${DAILY_CAP} already sent today. Instagram limits accounts that open too many new chats in a day.`, 'err');
    const n = nextUp(); if (!n) return;
    setAuto(true); ref.current.auto = true;
    openChat(n, n.drafts[0]);
  };

  return (
    <Page title={isDm ? 'Social DMs' : 'Interactions'}
      sub={isDm ? (helper ? 'AI writes Instagram DMs and LinkedIn messages for your leads. One click opens each chat with the message typed.' : 'AI writes Instagram DMs and LinkedIn messages for your leads.') : 'AI writes thoughtful comments on other people’s posts. Like the post and drop the comment with a tap.'}>
      {!isDm ? (
        <div className="callout"><Info size={15} /> <span><strong>Copy &amp; open</strong> copies the comment and opens the post: click Comment, paste, post, then confirm here and it moves to Posted.</span></div>
      ) : helper ? (
        <div className="callout"><Check size={15} /> <span><strong>Ferrn DM helper is on.</strong> Click <strong>Send</strong> (or <strong>Send all</strong>): the chat opens with the message already typed. Press Enter there and Studio marks it sent, closes the chat and opens the next one. Instagram and LinkedIn don’t let any app press send, so that one key stays yours.</span></div>
      ) : (
        <div className="callout"><Download size={15} /> <span><strong>Make sending one click.</strong> Install the Ferrn DM helper in Chrome once (about a minute). After that, Send opens each chat with the message already typed: no copying or pasting, you just press Enter.
          {' '}<a href="/assets/ferrn-dm-helper.zip" download>Download the helper</a>, unzip it, open <code>chrome://extensions</code>, turn on <strong>Developer mode</strong> (top right), click <strong>Load unpacked</strong> and pick the unzipped folder. Then reload this page.</span></div>
      )}

      <Autopilot kind={kind} />

      <div className="kpi-row">
        <div className="kpi feature"><div className="kpi-icon">{isDm ? <Send size={24} strokeWidth={1.8} /> : <Heart size={24} strokeWidth={1.8} />}</div>
          <h4>{isDm ? 'DMs ready to send' : 'Comments ready'}</h4><strong>{st?.waiting ?? '—'}</strong><p style={{ paddingBottom: 18 }}>{st ? `${st.week} ${isDm ? 'sent' : 'posted'} in the last 7 days` : ' '}</p></div>
        <div className="kpi"><h4><Instagram size={14} /> Instagram</h4><strong>{st?.instagram ?? 0}</strong><span className="muted small">{isDm ? 'DMs sent' : 'comments posted'}</span></div>
        <div className="kpi"><h4><Linkedin size={14} /> LinkedIn</h4><strong>{st?.linkedin ?? 0}</strong><span className="muted small">{isDm ? 'messages sent' : 'comments posted'}</span></div>
        {isDm ? <div className="kpi"><h4><RefreshCw size={14} /> Follow-ups due</h4><strong>{st?.followUps ?? 0}</strong><span className="muted small">4 days after a DM</span></div> : null}
      </div>

      <NewItem kind={kind} onDone={(it) => { setView('draft'); setData((d: Res | null) => (d ? { ...d, items: [it, ...d.items] } : d)); reload(); }} />

      <div className="toolbar">
        <Tabs tabs={[['draft', isDm ? 'Ready to send' : 'Ready to post'], ['sent', isDm ? 'Sent' : 'Posted'], ...(isDm ? [['followup', 'Follow up'] as [string, string]] : []), ['skipped', 'Skipped']]} value={view} onChange={(v) => setView(v as any)} />
        <select value={platform} onChange={(e) => setPlatform(e.target.value as any)}><option value="">Both platforms</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option></select>
      </div>

      {useHelperNow && live ? (
        <div className="eng-next">
          <div><strong>{live.state === 'opening' ? `Opening the chat with ${live.it.person || live.it.company || 'them'}…`
            : live.state === 'typed' ? `Message typed for ${live.it.person || live.it.company || 'them'}. Press Enter in that tab to send it.`
            : live.state === 'stuck' ? 'The chat needs one click from you'
            : 'The helper couldn’t open the chat'}</strong>
            <span className="muted small">{live.state === 'typed' ? 'Studio marks it sent by itself and moves on.'
              : live.state === 'stuck' ? `${live.detail ? live.detail + '. ' : ''}Click Message there; the text is typed for you (it is also on your clipboard, ${PASTE}).`
              : live.state === 'error' ? (live.detail || 'Reload this page and try again.')
              : 'It opens in a new tab next to this one.'}{auto ? ` Sending all: ${sentToday()} sent today, up to ${DAILY_CAP}.` : ''}</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => markSent(live.it, live.text, 'Marked as sent')}><Check size={15} />It’s sent</button>
            {auto ? <button className="btn ghost" onClick={() => stopAuto('Stopped')}><Pause size={15} />Stop after this</button> : null}
            <button className="btn ghost" onClick={() => { setLive(null); stopAuto(); }}>Cancel</button>
          </div>
        </div>
      ) : useHelperNow && countdown > 0 ? (
        <div className="eng-next">
          <div><strong>Next chat opens in {countdown}s</strong><span className="muted small">A short pause between chats keeps Instagram from limiting your account. {sentToday()} sent today, up to {DAILY_CAP}.</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => { const n = nextUp(); if (n) openChat(n, n.drafts[0]); }}><Send size={15} />Open it now</button>
            <button className="btn ghost" onClick={() => stopAuto('Stopped')}><Pause size={15} />Stop</button>
          </div>
        </div>
      ) : useHelperNow && view === 'draft' && next ? (
        <div className="eng-next">
          <div><strong>{queue.length} ready to send</strong><span className="muted small">Next: {next.person || next.company || 'Profile'} · {PLAT[next.platform].label}. Send all opens each chat with the message typed; you press Enter, Studio does the rest.</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={sendAll}><Send size={15} />Send all</button>
            <button className="btn" onClick={() => openChat(next, next.drafts[0])}>Send next</button>
          </div>
        </div>
      ) : pending ? (
        <div className="eng-next">
          <div><strong>Did your {isDm ? 'message' : 'comment'} to {pending.it.person || pending.it.company || 'them'} go?</strong><span className="muted small">It is copied. In the tab that opened: {isDm ? `click Message, click the message box, press ${PASTE}, then Enter` : `click Comment, press ${PASTE}, then post`}. It stays in Ready until you confirm.</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {queue.some((q) => q.id !== pending.it.id) ? <button className="btn primary" onClick={() => confirmSent(true)}><Send size={15} />Yes, open the next</button> : null}
            <button className="btn" onClick={() => confirmSent(false)}>Yes, {isDm ? 'sent' : 'posted'}</button>
            <button className="btn ghost" onClick={() => setPending(null)}>Not yet</button>
          </div>
        </div>
      ) : view === 'draft' && next ? (
        <div className="eng-next">
          <div><strong>{queue.length} ready to {isDm ? 'send' : 'post'}</strong><span className="muted small">Next: {next.person || next.company || 'Profile'} · {PLAT[next.platform].label}. Each click copies the message and opens {isDm ? 'their profile' : 'the post'}. You paste and press send there, then confirm here.</span></div>
          <button className="btn primary" onClick={() => copySend(next, next.drafts[0])}><Send size={15} />Copy &amp; open next</button>
        </div>
      ) : null}

      {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !shown.length ? (
        <Empty icon={isDm ? AtSign : MessageSquareText} title={view === 'draft' ? 'Nothing waiting' : 'Nothing here yet'}>
          {view === 'draft' ? (isDm ? 'Pick a lead above, paste their Instagram or LinkedIn link and Studio drafts the message.' : 'Paste a post link and what it says, and Studio drafts three comments.') : 'Items move here when you mark them.'}
        </Empty>
      ) : (
        <>
          <div className="eng-list">{pg.rows.map((it) => <ItemCard key={it.id} it={it} patch={patch} del={del} send={send} oneClick={useHelperNow} />)}</div>
          <Pager pg={pg} noun={isDm ? 'messages' : 'comments'} />
        </>
      )}
    </Page>
  );
}

function NewItem({ kind, onDone }: { kind: 'dm' | 'comment'; onDone: (it: Item) => void }) {
  const toast = useToast();
  const { path } = useRoute();
  const isDm = kind === 'dm';
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [url, setUrl] = useState('');
  const [context, setContext] = useState('');
  const [person, setPerson] = useState('');
  const [leadQ, setLeadQ] = useState('');
  const [lead, setLead] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const leads = useData(() => (isDm && leadQ.trim().length > 1 && !lead ? list('leads', { q: leadQ.trim(), limit: '8' }) : Promise.resolve([])), [leadQ, lead]);
  // Opened from a lead: /social?lead=<id>
  useEffect(() => {
    const id = new URLSearchParams(path.split('?')[1] ?? '').get('lead');
    if (id && isDm) api(`/r/leads/${id}`).then((r) => { setLead(r.row); setLeadQ(r.row.company); }).catch(() => null);
  }, [path, isDm]);
  const go = async () => {
    setBusy(true);
    try {
      const r = await api<{ item: Item; warning?: string | null }>('/engage', { body: { kind, platform, url, context, person, lead_id: lead?.id, company: lead?.company } });
      toast(r.warning || (isDm ? 'Drafts ready' : 'Comments ready'), r.warning ? 'err' : undefined);
      onDone(r.item); setUrl(''); setContext(''); setPerson(''); setLead(null); setLeadQ('');
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Card title={<span className="eng-h"><Sparkles size={15} /> {isDm ? 'Draft a DM' : 'Draft comments for a post'}</span>}>
      <div className="eng-form">
        <div className="an-seg" role="tablist">
          {(['instagram', 'linkedin'] as Platform[]).map((p) => <button key={p} role="tab" aria-selected={platform === p} className={platform === p ? 'on' : ''} onClick={() => setPlatform(p)}>{PLAT[p].icon} {PLAT[p].label}</button>)}
        </div>
        {isDm ? (
          <label className="field eng-lead"><span>Lead (optional)</span>
            {lead ? <div className="eng-chip"><strong>{lead.company}</strong> <span className="muted small">{[lead.niche, lead.city].filter(Boolean).join(' · ')}</span><button className="icon xs" onClick={() => { setLead(null); setLeadQ(''); }} aria-label="Clear lead"><X size={13} /></button></div> : (
              <>
                <input placeholder="Search your leads…" value={leadQ} onChange={(e) => setLeadQ(e.target.value)} />
                {leads.data?.length ? <div className="eng-pick">{leads.data.map((l: any) => <button key={l.id} onClick={() => { setLead(l); setLeadQ(l.company); if (!person && l.contact_name) setPerson(l.contact_name); }}><strong>{l.company}</strong><span className="muted small">{[l.niche, l.city].filter(Boolean).join(' · ')}</span></button>)}</div> : null}
              </>
            )}
          </label>
        ) : null}
        <label className="field"><span>{isDm ? 'Profile link' : 'Post link'}</span><input placeholder={platform === 'linkedin' ? (isDm ? 'https://www.linkedin.com/in/…' : 'https://www.linkedin.com/posts/…') : (isDm ? '@handle or https://www.instagram.com/…' : 'https://www.instagram.com/p/…')} value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="field"><span>{isDm ? 'Their name' : 'Who posted it'} (optional)</span><input value={person} onChange={(e) => setPerson(e.target.value)} placeholder={isDm ? 'e.g. Tolu Adeyemi' : 'e.g. Lagos Business School'} /></label>
        <label className="field wide"><span>{isDm ? 'Anything you know about them (optional)' : 'What the post says'}</span>
          <textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder={isDm ? 'Their bio, a recent post, what they sell. The more specific, the better the message.' : 'Paste the caption or the main points. Studio can’t read Instagram or LinkedIn for you.'} /></label>
        <div className="eng-go"><button className="btn primary" disabled={busy || !url.trim() || (!isDm && !context.trim())} onClick={go}><Sparkles size={15} />{busy ? 'Writing…' : isDm ? 'Write the DM' : 'Write 3 comments'}</button></div>
      </div>
    </Card>
  );
}

function ItemCard({ it, patch, del, send, oneClick }: { it: Item; patch: (id: string, b: Record<string, unknown>, msg?: string) => Promise<void>; del: (id: string) => void; send: (it: Item, text: string) => Promise<void> | void; oneClick?: boolean }) {
  const toast = useToast();
  const [pick, setPick] = useState(0);
  const [edit, setEdit] = useState<string[]>(it.drafts);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEdit(it.drafts); setPick(0); }, [it.drafts]);
  const isDm = it.kind === 'dm';
  const text = edit[pick] ?? '';
  const redraft = async () => { setBusy(true); await patch(it.id, { redraft: true }, 'New drafts'); setBusy(false); };
  const due = it.follow_up_at && Date.parse(it.follow_up_at) <= Date.now() && it.status === 'sent';
  return (
    <article className={`eng-card ${it.status}`}>
      <header className="eng-card-head">
        <span className={`eng-plat ${it.platform}`}>{PLAT[it.platform].icon}{PLAT[it.platform].label}</span>
        <strong>{it.person || it.company || (isDm ? 'Profile' : 'Post')}</strong>
        {it.company && it.person ? <span className="muted small">{it.company}</span> : null}
        {it.status === 'sent' ? <Badge tone="green">{isDm ? 'Sent' : 'Posted'} {ago(it.done_at!)}</Badge> : it.status === 'skipped' ? <Badge>Skipped</Badge> : null}
        {it.auto ? <Badge tone="purple"><Bot size={11} /> Autopilot</Badge> : null}
        {it.liked ? <Badge tone="red"><Heart size={11} /> Liked</Badge> : null}
        {due ? <Badge tone="orange">Follow up now</Badge> : null}
        <a className="eng-url muted small" href={it.url} target="_blank" rel="noreferrer">{it.url.replace(/^https:\/\/(www\.)?/, '').slice(0, 60)} <ExternalLink size={11} /></a>
      </header>
      {it.context ? <p className="eng-ctx muted small">{isDm ? 'About them: ' : 'Post: '}{it.context.slice(0, 260)}{it.context.length > 260 ? '…' : ''}</p> : null}

      {it.status === 'sent' && it.sent_text ? <div className="eng-sent"><span className="muted small">What you sent</span><p>{it.sent_text}</p></div> : null}

      {it.status !== 'sent' ? (
        <>
          {isDm && it.platform === 'linkedin' && it.note ? (
            <div className="eng-note">
              <span className="muted small">1 · Connection request note ({it.note.length}/300)</span>
              <p>{it.note}</p>
              <button className="btn sm ghost" onClick={() => copyOpen(it.note!, it.url, toast)}><Copy size={14} />Copy note &amp; open profile</button>
            </div>
          ) : null}
          {!edit.length ? <p className="muted small">No drafts yet. <button className="link" onClick={redraft} disabled={busy}>Try again</button></p> : (
            <>
              <div className="eng-tabs">
                {isDm && it.platform === 'linkedin' ? <span className="muted small">2 · Message once they accept:</span> : null}
                {edit.map((_, i) => <button key={i} className={`pager-n${pick === i ? ' on' : ''}`} onClick={() => setPick(i)}>Option {i + 1}</button>)}
              </div>
              <textarea className="eng-text" rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))} value={text}
                onChange={(e) => setEdit(edit.map((d, i) => (i === pick ? e.target.value : d)))}
                onBlur={() => { if (edit.join('\u0000') !== it.drafts.join('\u0000')) patch(it.id, { drafts: edit }); }} />
            </>
          )}
        </>
      ) : null}

      <footer className="eng-actions">
        {it.status === 'draft' ? (
          <>
            {!isDm ? <a className="btn sm ghost" href={it.url} target="_blank" rel="noreferrer" onClick={() => { if (!it.liked) patch(it.id, { liked: true }, 'Marked as liked'); }}><Heart size={14} />Open &amp; like</a> : null}
            {text ? <button className="btn sm primary" onClick={() => send(it, text)}><Send size={14} />{oneClick ? 'Send' : isDm ? 'Copy & open chat' : 'Copy & open post'}</button> : null}
            {text ? <button className="btn sm ghost" onClick={() => copyOpen(text, dmUrl(it), toast)}><Copy size={14} />Copy only</button> : null}
            <button className="btn sm ghost" disabled={busy} onClick={redraft}><RefreshCw size={14} />{busy ? 'Writing…' : 'Rewrite'}</button>
            <button className="btn sm ghost" onClick={() => patch(it.id, { status: 'skipped' }, 'Skipped')}>Skip</button>
          </>
        ) : (
          <>
            {due ? <button className="btn sm primary" onClick={() => { copyOpen(`Hi${it.person ? ' ' + it.person.split(' ')[0] : ''}, just bumping this in case it got buried. Happy to share a quick idea or two for ${it.company || 'your business'} if useful.`, dmUrl(it), toast); patch(it.id, { follow_up_at: null }); }}><Send size={14} />Open &amp; send follow-up</button> : null}
            {due ? <button className="btn sm ghost" onClick={() => patch(it.id, { follow_up_at: null }, 'Follow-up done')}><Check size={14} />Followed up</button> : null}
            <button className="btn sm ghost" onClick={() => patch(it.id, { status: 'draft' }, 'Moved back to ready')}><Undo2 size={14} />Not sent, move back</button>
          </>
        )}
        <button className="icon" title="Remove" aria-label="Remove" onClick={() => del(it.id)}><Trash2 size={15} /></button>
        <span className="muted small eng-by">{it.created_by} · {ago(it.created_at)}</span>
      </footer>
    </article>
  );
}

type Auto = { dm: boolean; daily: number; comments: boolean; today: number; scanned: number };
function Autopilot({ kind }: { kind: 'dm' | 'comment' }) {
  const toast = useToast();
  const { data, setData } = useData<Auto>(() => api('/engage/settings/autopilot'), []);
  const set = async (b: Partial<Auto>) => {
    try { const r = await api<Auto>('/engage/settings/autopilot', { method: 'PUT', body: b }); setData({ ...(data as Auto), ...r }); toast('Autopilot updated'); }
    catch (x: any) { toast(x.message, 'err'); }
  };
  if (!data) return null;
  const on = kind === 'dm' ? data.dm : data.comments;
  return (
    <div className={`eng-auto ${on ? 'on' : ''}`}>
      <Bot size={18} />
      <div className="eng-auto-text">
        <strong>Autopilot {on ? 'on' : 'off'}</strong>
        <span className="muted small">{kind === 'dm'
          ? (on ? `Every day Studio opens your leads’ websites, finds their Instagram or LinkedIn, reads what they do and drafts up to ${data.daily} DMs (${data.today} today). They wait below for one click each.` : 'Turn on to have DMs drafted for your leads every day.')
          : (on ? 'Each morning the sales routine finds recent public posts from businesses you’re targeting and drafts three comments for each. They wait below: open, like, paste, done.' : 'Turn on to get comment drafts on fresh posts every morning.')}</span>
      </div>
      {kind === 'dm' && on ? <label className="muted small eng-auto-n">Per day <select value={data.daily} onChange={(e) => set({ daily: Number(e.target.value) })}>{[3, 6, 10, 15, 25].map((n) => <option key={n}>{n}</option>)}</select></label> : null}
      <button className={`btn sm ${on ? 'ghost' : 'primary'}`} onClick={() => set(kind === 'dm' ? { dm: !on } : { comments: !on })}>{on ? 'Pause' : 'Turn on'}</button>
    </div>
  );
}
