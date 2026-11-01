import React, { useMemo, useState } from 'react';
import { api, can, create, fmtDate, fromLocalInput, list, remove, toLocalInput, update } from '../api';
import { Badge, Card, Confirm, Drawer, EditedBy, Empty, Fields, History, Loading, Page, Status, Tabs, useData, useToast, useUser } from '../ui';
import { UploadButton } from './resource';

const PLATFORMS = [['x', 'X'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn']] as [string, string][];
const STATUSES = ['idea', 'draft', 'in_review', 'approved', 'scheduled', 'posted', 'failed'];
const POST_LINKS: Record<string, string> = {
  x: 'https://x.com/compose/post', instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/',
};

export function Content() {
  const [tab, setTab] = useState('calendar');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [platform, setPlatform] = useState('');
  const [open, setOpen] = useState<any | null>(null);
  const [gen, setGen] = useState(false);
  const toast = useToast();
  const user = useUser();
  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
  const { data, loading, reload } = useData(() => list('content', { platform, from: tab === 'calendar' ? from : undefined, to: tab === 'calendar' ? to : undefined }), [platform, from, tab]);
  const label = month.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <Page title="Content" sub="Plan, write, schedule and measure posts for X, Instagram and TikTok."
      actions={<>
        {can(user, 'editor') ? <button className="btn ghost" onClick={async () => { try { const r = await api('/content/import-calendar', { body: {} }); toast(`${r.added} posts imported`); reload(); } catch (x: any) { toast(x.message, 'err'); } }}>Import November calendar</button> : null}
        <button className="btn ghost" onClick={() => setGen(true)}>✨ Generate with AI</button>
        <button className="btn primary" onClick={() => setOpen({ platform: 'instagram', status: 'draft', scheduled_at: '' })}>+ New post</button>
      </>}>
      <div className="toolbar">
        <Tabs tabs={[['calendar', 'Calendar'], ['list', 'All posts'], ['performance', 'Performance']]} value={tab} onChange={setTab} />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All platforms</option>{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {tab === 'calendar' ? <div className="month-nav"><button className="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{label}</strong><button className="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div> : null}
      </div>
      {tab === 'performance' ? <Performance /> : loading ? <Loading /> : tab === 'calendar' ? (
        <Calendar month={month} posts={data ?? []} onOpen={setOpen} onNew={(d) => setOpen({ platform: 'instagram', status: 'draft', scheduled_at: d })} />
      ) : !data?.length ? <Empty title="No posts yet">Import the November calendar or generate drafts with AI.</Empty> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>When</th><th>Platform</th><th>Post</th><th>Format</th><th>Status</th><th>By</th></tr></thead>
          <tbody>{data.map((p: any) => (
            <tr key={p.id} onClick={() => setOpen(p)}><td className="nowrap">{fmtDate(p.scheduled_at, true)}</td><td><span className={`plat ${p.platform}`}>{p.platform}</span></td>
              <td><strong>{p.title}</strong><div className="muted small">{(p.body || '').slice(0, 90)}</div></td><td className="small">{p.format}</td><td><Status s={p.status} /></td><td className="muted small">{p.updated_by}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {open ? <PostEditor post={open} onClose={() => { setOpen(null); reload(); }} /> : null}
      {gen ? <Generator onClose={() => { setGen(false); reload(); }} /> : null}
    </Page>
  );
}

function Calendar({ month, posts, onOpen, onNew }: { month: Date; posts: any[]; onOpen: (p: any) => void; onNew: (iso: string) => void }) {
  const start = new Date(month); start.setDate(1 - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const p of posts) { if (!p.scheduled_at) continue; const k = new Date(p.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }); (m[k] ??= []).push(p); }
    return m;
  }, [posts]);
  const today = new Date().toLocaleDateString('en-CA');
  return (
    <div className="cal">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-h">{d}</div>)}
      {days.map((d) => {
        const k = d.toLocaleDateString('en-CA');
        const now = Date.now();
        return (
          <div key={k} className={`cal-d ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''}`} onDoubleClick={() => onNew(new Date(k + 'T11:00:00+01:00').toISOString())}>
            <span className="cal-n">{d.getDate()}</span>
            {(byDay[k] ?? []).map((p) => (
              <button key={p.id} className={`cal-post ${p.platform} ${p.status} ${p.status !== 'posted' && new Date(p.scheduled_at).getTime() < now ? 'overdue' : ''}`} onClick={() => onOpen(p)} title={p.title}>
                <i />{p.title}
              </button>
            ))}
          </div>
        );
      })}
      <p className="muted small cal-legend">Double-click a day to add a post. Red outline = past its time and not marked posted.</p>
    </div>
  );
}

function PostEditor({ post, onClose }: { post: any; onClose: () => void }) {
  const toast = useToast();
  const isNew = !post.id;
  const metrics = (() => { try { return JSON.parse(post.metrics_json || '{}'); } catch { return {}; } })();
  const media = (() => { try { return JSON.parse(post.media_json || '[]'); } catch { return []; } })();
  const [v, setV] = useState<Record<string, any>>({ ...post, scheduled_at: toLocalInput(post.scheduled_at), ...metrics });
  const [assets, setAssets] = useState<any[]>(media);
  const [tab, setTab] = useState('write');
  const save = async (extra: Record<string, any> = {}) => {
    const { impressions, reach, likes, comments, shares, saves, clicks, leads, ...rest } = { ...v, ...extra };
    const m = { impressions, reach, likes, comments, shares, saves, clicks, leads };
    const num = Object.fromEntries(Object.entries(m).map(([k, x]) => [k, Number(x) || 0]));
    const body = { ...rest, scheduled_at: fromLocalInput(rest.scheduled_at), media_json: JSON.stringify(assets), metrics_json: JSON.stringify(num) };
    delete (body as any).id; delete (body as any).created_at; delete (body as any).updated_at; delete (body as any).updated_by; delete (body as any).created_by;
    try { isNew ? await create('content', body) : await update('content', post.id, body); toast('Saved'); onClose(); } catch (x: any) { toast(x.message, 'err'); }
  };
  const textToCopy = `${v.body ?? ''}\n\n${v.hashtags ?? ''}`.trim();
  return (
    <Drawer open wide onClose={onClose} title={isNew ? 'New post' : v.title || 'Post'}>
      {!isNew ? <EditedBy row={post} /> : null}
      <Tabs tabs={[['write', 'Write'], ['media', `Media (${assets.length})`], ['results', 'Results'], ...(isNew ? [] : [['history', 'History']] as [string, string][])]} value={tab} onChange={setTab} />
      {tab === 'write' ? (
        <>
          <Fields value={v} onChange={setV} fields={[
            { name: 'platform', label: 'Platform', type: 'select', options: PLATFORMS },
            { name: 'scheduled_at', label: 'Post at (Lagos time)', type: 'datetime' },
            { name: 'format', label: 'Format', placeholder: 'Carousel (6 slides), Reel 20s, Thread…' }, { name: 'status', label: 'Status', type: 'select', options: STATUSES },
            { name: 'theme', label: 'Theme' }, { name: 'goal', label: 'Goal', type: 'select', options: ['Awareness', 'Trust', 'Engagement', 'Leads', 'Traffic', 'Reach', 'Reviews', 'Thought leadership', 'Value'] },
            { name: 'title', label: 'Working title', wide: true },
            { name: 'body', label: v.platform === 'tiktok' ? 'Script (hook, beats, on-screen text, CTA)' : v.platform === 'instagram' ? 'Slides + caption' : 'Post / thread', type: 'textarea', rows: 12 },
            { name: 'hashtags', label: 'Hashtags', wide: true },
          ]} />
          <div className="row-actions">
            <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(textToCopy).then(() => toast('Copied caption'))}>Copy caption</button>
            <a className="btn sm ghost" href={v.platform === 'x' ? `https://x.com/intent/post?text=${encodeURIComponent(textToCopy.slice(0, 280))}` : POST_LINKS[v.platform]} target="_blank" rel="noreferrer">Open {v.platform} ↗</a>
            {v.platform === 'instagram' && /Slide \d/i.test(v.body ?? '') ? <a className="btn sm ghost" href={`/studio/carousel?post=${post.id}`} target="_blank" rel="noreferrer">Render carousel slides</a> : null}
          </div>
        </>
      ) : tab === 'media' ? (
        <div>
          <p className="muted small">Upload final images, videos and voiceovers. Visual directions from AI drafts show here too.</p>
          <UploadButton folder="content" label="Upload media" onUploaded={(r) => setAssets([...assets, { type: 'file', key: r.key, url: r.url }])} />
          <div className="media-grid">{assets.map((a, i) => (
            <div key={i} className="media-item">
              {a.type === 'direction' ? <p className="small"><strong>Visual direction:</strong> {a.note}</p>
                : /\.(png|jpe?g|webp|gif)$/i.test(a.url) ? <img src={a.url} alt="" /> : /\.(mp4|mov|webm)$/i.test(a.url) ? <video src={a.url} controls /> : <a href={a.url} target="_blank" rel="noreferrer">{a.url.split('/').pop()}</a>}
              <button className="icon" onClick={() => setAssets(assets.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}</div>
        </div>
      ) : tab === 'results' ? (
        <>
          <Fields value={v} onChange={setV} fields={[
            { name: 'post_url', label: 'Link to the live post', wide: true },
            { name: 'impressions', label: 'Impressions / views', type: 'number' }, { name: 'reach', label: 'Reach', type: 'number' },
            { name: 'likes', label: 'Likes', type: 'number' }, { name: 'comments', label: 'Comments', type: 'number' },
            { name: 'shares', label: 'Shares / reposts', type: 'number' }, { name: 'saves', label: 'Saves / bookmarks', type: 'number' },
            { name: 'clicks', label: 'Link clicks / profile visits', type: 'number' }, { name: 'leads', label: 'DMs or leads it produced', type: 'number' },
          ]} />
          <p className="muted small">Copy numbers from each platform’s insights 48 hours after posting. Once the X, Instagram and TikTok APIs are connected these fill in automatically.</p>
        </>
      ) : <History entity="content_posts" id={post.id} />}
      {tab !== 'history' ? (
        <div className="drawer-actions sticky">
          {!isNew ? <Confirm text="Delete this post?" className="btn ghost danger" onYes={async () => { await remove('content', post.id); toast('Deleted'); onClose(); }}>Delete</Confirm> : null}
          {!isNew && v.status !== 'posted' ? <button className="btn ghost" onClick={() => save({ status: 'posted', posted_at: new Date().toISOString() })}>Mark posted</button> : null}
          <button className="btn primary" onClick={() => save()}>Save</button>
        </div>
      ) : null}
    </Drawer>
  );
}

function Generator({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, any>>({ platform: 'instagram', count: 3, goal: 'Leads', theme: 'Clinic Front Desk launch', brief: '' });
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<any[] | null>(null);
  return (
    <Drawer open wide onClose={onClose} title="Generate content with AI">
      <Fields value={v} onChange={setV} fields={[
        { name: 'platform', label: 'Platform', type: 'select', options: PLATFORMS },
        { name: 'count', label: 'How many', type: 'number' },
        { name: 'theme', label: 'Theme / campaign', wide: true },
        { name: 'goal', label: 'Goal', type: 'select', options: ['Awareness', 'Trust', 'Engagement', 'Leads', 'Traffic'] },
        { name: 'format', label: 'Format (optional)', placeholder: 'Carousel, Reel, Thread, Talking head…' },
        { name: 'brief', label: 'Brief — facts to use (real client results, offers, dates)', type: 'textarea', rows: 5 },
        { name: 'date', label: 'Schedule first post (optional)', type: 'date' },
      ]} />
      <p className="muted small">The AI is told never to invent stats or client names, and to learn from your best-performing posts. Review every draft before approving.</p>
      <div className="drawer-actions">
        <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api('/content/generate', { body: v }); setPosts(r.posts); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } }}>{busy ? 'Writing…' : 'Preview'}</button>
        <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api('/content/generate', { body: { ...v, save: true, date: v.date ? new Date(v.date + 'T11:00:00+01:00').toISOString() : undefined } }); toast(`${r.posts.length} drafts saved`); onClose(); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } }}>Generate & save as drafts</button>
      </div>
      {posts ? <div className="stack">{posts.map((p, i) => <div key={i} className="stack-item"><div><strong>{p.title}</strong> <Badge>{p.format}</Badge><p className="pre">{p.body}</p><p className="muted small">{p.hashtags}</p><p className="small"><strong>Visual:</strong> {p.visual_direction}</p></div></div>)}</div> : null}
    </Drawer>
  );
}

function Performance() {
  const { data, loading } = useData(() => api('/content/performance'));
  if (loading) return <Loading />;
  if (!data?.total) return <Empty title="No results yet">Mark posts as posted and add their numbers in the Results tab — this page then shows what works and what doesn’t.</Empty>;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const Group = ({ title, rows }: { title: string; rows: any[] }) => (
    <Card title={title}><table className="table"><thead><tr><th></th><th>Posts</th><th>Reach</th><th>Engagement rate</th><th>Leads</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.name}><td><strong>{r.name}</strong></td><td>{r.posts}</td><td>{r.reach.toLocaleString()}</td><td>{pct(r.rate)}</td><td>{r.leads}</td></tr>)}</tbody></table></Card>
  );
  const Row = ({ p }: { p: any }) => <li><strong>{p.title}</strong> <span className={`plat ${p.platform}`}>{p.platform}</span><span className="muted small">{p.format} · reach {p.reach.toLocaleString()} · {pct(p.rate)} · {p.leads} leads</span></li>;
  return (
    <>
      <div className="grid-2">
        <Card title="Doing well"><ul className="list">{data.top.map((p: any) => <Row key={p.id} p={p} />)}</ul></Card>
        <Card title="Not landing"><ul className="list">{data.bottom.map((p: any) => <Row key={p.id} p={p} />)}</ul></Card>
      </div>
      <div className="grid-2"><Group title="By platform" rows={data.byPlatform} /><Group title="By format" rows={data.byFormat} /></div>
      <Group title="By theme" rows={data.byTheme} />
      <p className="muted small">Engagement rate = (likes + 2×comments + 3×shares + 3×saves + 2×clicks) ÷ reach. Weighted toward actions that signal buying intent.</p>
    </>
  );
}
