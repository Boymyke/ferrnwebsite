import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Bot, Briefcase as Linkedin, Camera as Instagram, Check, Copy, ExternalLink, Heart, Info, MessageSquareText, RefreshCw, Send, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { ago, api, list } from '../api';
import { Badge, Card, Empty, ErrorNote, Loading, Page, Pager, Tabs, useData, usePaged, useRoute, useToast } from '../ui';

type Platform = 'instagram' | 'linkedin';
type Item = {
  id: string; kind: 'dm' | 'comment'; platform: Platform; status: 'draft' | 'sent' | 'skipped';
  lead_id?: string | null; company?: string | null; person?: string | null; url: string; context?: string | null;
  drafts: string[]; note?: string | null; sent_text?: string | null; liked?: boolean;
  created_at: string; created_by: string; done_at?: string | null; done_by?: string | null; follow_up_at?: string | null; auto?: boolean;
};
type Stats = { waiting: number; week: number; instagram: number; linkedin: number; followUps: number };
type Res = { items: Item[]; stats: { dm: Stats; comment: Stats } };

const PLAT: Record<Platform, { label: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram', icon: <Instagram size={15} /> },
  linkedin: { label: 'LinkedIn', icon: <Linkedin size={15} /> },
};

/** Where a DM is sent from: Instagram's own DM link opens the message thread itself (not the profile). */
export function dmUrl(it: { platform: Platform; url: string; kind: string }) {
  if (it.kind !== 'dm' || it.platform !== 'instagram') return it.url;
  const h = it.url.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/)?.[1];
  return h ? `https://ig.me/m/${h}` : it.url;
}

/** Copy the text, then open the profile or post in a new tab so it can be pasted and sent. */
function copyOpen(text: string, url: string, toast: (t: string, k?: any) => void) {
  const w = window.open(url, '_blank', 'noopener');
  navigator.clipboard?.writeText(text)
    .then(() => toast('Copied. Paste it in the tab that just opened'))
    .catch(() => { toast('Couldn’t copy automatically. Select the text and copy it', 'err'); });
  if (!w) toast('Your browser blocked the new tab. Allow pop-ups for Studio', 'err');
}

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
  /** One click: copy the message, open the DM thread (or the post), and move it to Sent. */
  const send = async (it: Item, text: string) => {
    const w = window.open(dmUrl(it), '_blank', 'noopener');
    try { await navigator.clipboard?.writeText(text); } catch { toast('Couldn’t copy automatically. Copy the text from the Sent tab', 'err'); }
    if (!w) toast('Your browser blocked the new tab. Allow pop-ups for Studio', 'err');
    await patch(it.id, { status: 'sent', sent_text: text }, isDm ? 'Opened their DMs with the message copied. Paste, send. Moved to Sent' : 'Opened the post with the comment copied. Paste, post. Moved to Posted');
  };
  const queue = useMemo(() => items.filter((i) => i.status === 'draft' && (!platform || i.platform === platform) && i.drafts[0]), [items, platform]);
  const next = queue[0];

  return (
    <Page title={isDm ? 'Social DMs' : 'Interactions'}
      sub={isDm ? 'AI writes Instagram DMs and LinkedIn messages for your leads. You send each one with a tap.' : 'AI writes thoughtful comments on other people’s posts. Like the post and drop the comment with a tap.'}>
      <div className="callout"><Info size={15} /> <span><strong>Open &amp; send</strong> copies the message, opens {isDm ? 'their DMs' : 'the post'} and moves it to {isDm ? 'Sent' : 'Posted'} in one click. You paste and press send there, because Instagram and LinkedIn block apps from sending cold {isDm ? 'DMs' : 'comments'} and restrict accounts that use bots for it.</span></div>

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

      {view === 'draft' && next ? (
        <div className="eng-next">
          <div><strong>{queue.length} ready to {isDm ? 'send' : 'post'}</strong><span className="muted small">Next: {next.person || next.company || 'Profile'} · {PLAT[next.platform].label}. Each click copies the message, opens {isDm ? 'their DMs' : 'the post'} and marks it sent, then moves to the next one.</span></div>
          <button className="btn primary" onClick={() => send(next, next.drafts[0])}><Send size={15} />Open &amp; send next</button>
        </div>
      ) : null}

      {loading && !data ? <Loading /> : error ? <ErrorNote error={error} onRetry={reload} /> : !shown.length ? (
        <Empty icon={isDm ? AtSign : MessageSquareText} title={view === 'draft' ? 'Nothing waiting' : 'Nothing here yet'}>
          {view === 'draft' ? (isDm ? 'Pick a lead above, paste their Instagram or LinkedIn link and Studio drafts the message.' : 'Paste a post link and what it says, and Studio drafts three comments.') : 'Items move here when you mark them.'}
        </Empty>
      ) : (
        <>
          <div className="eng-list">{pg.rows.map((it) => <ItemCard key={it.id} it={it} patch={patch} del={del} send={send} />)}</div>
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

function ItemCard({ it, patch, del, send }: { it: Item; patch: (id: string, b: Record<string, unknown>, msg?: string) => Promise<void>; del: (id: string) => void; send: (it: Item, text: string) => Promise<void> }) {
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
            {text ? <button className="btn sm primary" onClick={() => send(it, text)}><Send size={14} />{isDm ? 'Open & send' : 'Open & post'}</button> : null}
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
