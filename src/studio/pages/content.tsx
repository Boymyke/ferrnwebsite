import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Eye, Heart, MousePointerClick, Plus, Send, Sparkles, Users } from 'lucide-react';
import { api, can, create, fmtDate, fromLocalInput, getOne, list, remove, toLocalInput, update } from '../api';
import { Badge, Card, Confirm, Drawer, EditedBy, Empty, Fields, History, Loading, Page, Status, Tabs, useData, useToast, useUser } from '../ui';
import { PenSquare } from 'lucide-react';
import { BarList, HeatGrid, KpiTile, LineChart, PLATFORM_META, SeriesToggles, SocialStyles, Sparkline, fmtNum, fmtPct } from '../social-charts';
import { AutopostPanel, CalFlag, ConnectionsCard, ManualKit, MediaPicker, PostMetricsChart, PublishBadge } from '../social-panels';

const PLATFORMS = [['x', 'X'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn']] as [string, string][];
const STATUSES = ['idea', 'draft', 'in_review', 'approved', 'scheduled', 'posted', 'failed'];
const POST_LINKS: Record<string, string> = {
  x: 'https://x.com/compose/post', instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/',
};

export function Content() {
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') ?? 'calendar');
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
  useEffect(() => { // back from TikTok / Instagram connect
    const q = new URLSearchParams(location.search);
    if (q.get('social')) { toast(q.get('msg') || (q.get('social') === 'connected' ? 'Connected' : 'Could not connect'), q.get('social') === 'connected' ? 'ok' : 'err'); history.replaceState(null, '', location.pathname); }
  }, []);

  return (
    <Page title="Content" sub="Plan, write, schedule, auto-post and measure posts for X, Instagram and TikTok."
      actions={<>
        {can(user, 'editor') ? <button className="btn ghost" onClick={async () => { try { const r = await api('/content/import-calendar', { body: {} }); toast(`${r.added} posts imported`); reload(); } catch (x: any) { toast(x.message, 'err'); } }}>Import November calendar</button> : null}
        <button className="btn ghost" onClick={() => setGen(true)}><Sparkles size={15} strokeWidth={2} />Generate with AI</button>
        <button className="btn primary" onClick={() => setOpen({ platform: 'instagram', status: 'draft', scheduled_at: '' })}><Plus size={15} strokeWidth={2.2} />New post</button>
      </>}>
      <SocialStyles />
      <div className="toolbar">
        <Tabs tabs={[['calendar', 'Calendar'], ['list', 'All posts'], ['performance', 'Performance']]} value={tab} onChange={setTab} />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All platforms</option>{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {tab === 'calendar' ? <div className="month-nav"><button className="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button><strong>{label}</strong><button className="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button></div> : null}
      </div>
      {tab === 'performance' ? <Performance platform={platform} onOpen={setOpen} /> : loading ? <Loading /> : tab === 'calendar' ? (
        <Calendar month={month} posts={data ?? []} onOpen={setOpen} onNew={(d) => setOpen({ platform: 'instagram', status: 'draft', scheduled_at: d })} />
      ) : !data?.length ? <Empty icon={PenSquare} title="No posts yet">Import the November calendar or generate drafts with AI.</Empty> : (
        <div className="table-wrap"><table className="table clickable">
          <thead><tr><th>When</th><th>Platform</th><th>Post</th><th>Format</th><th>Status</th><th>Auto-post</th><th>By</th></tr></thead>
          <tbody>{data.map((p: any) => (
            <tr key={p.id} onClick={() => setOpen(p)}><td className="nowrap">{fmtDate(p.scheduled_at, true)}</td><td><span className={`plat ${p.platform}`}>{p.platform}</span></td>
              <td><strong>{p.title}</strong><div className="muted small">{(p.body || '').slice(0, 90)}</div></td><td className="small">{p.format}</td><td><Status s={p.status} /></td><td><PublishBadge post={p} /></td><td className="muted small">{p.updated_by}</td></tr>
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
                <i />{p.title}<CalFlag post={p} />
              </button>
            ))}
          </div>
        );
      })}
      <p className="muted small cal-legend">Double-click a day to add a post. Red outline = past its time and not marked posted. Icons: orange bolt = will auto-post, red = needs media or failed, amber = waiting, retrying or post manually.</p>
    </div>
  );
}

const METRIC_FIELDS = ['impressions', 'views', 'reach', 'likes', 'comments', 'shares', 'saves', 'clicks', 'leads'];

function PostEditor({ post: initial, onClose }: { post: any; onClose: () => void }) {
  const toast = useToast();
  const [post, setPost] = useState<any>(initial);
  const isNew = !post.id;
  const metrics = (() => { try { return JSON.parse(post.metrics_json || '{}'); } catch { return {}; } })();
  const media = (() => { try { return JSON.parse(post.media_json || '[]'); } catch { return []; } })();
  const [v, setV] = useState<Record<string, any>>({ ...post, scheduled_at: toLocalInput(post.scheduled_at), ...Object.fromEntries(METRIC_FIELDS.map((k) => [k, metrics[k] ?? ''])) });
  const [assets, setAssets] = useState<any[]>(media);
  const [tab, setTab] = useState('write');
  const refresh = async () => { if (!post.id) return; const r = await getOne('content', post.id); setPost(r); setV((cur) => ({ ...cur, status: r.status, post_url: r.post_url, posted_at: r.posted_at })); };
  const save = async (extra: Record<string, any> = {}) => {
    const all = { ...v, ...extra };
    const m = Object.fromEntries(METRIC_FIELDS.map((k) => [k, all[k]]));
    const rest = Object.fromEntries(Object.entries(all).filter(([k]) => !METRIC_FIELDS.includes(k)));
    const body: Record<string, any> = { ...rest, scheduled_at: fromLocalInput(rest.scheduled_at), media_json: JSON.stringify(assets), autopost: Number(rest.autopost) ? 1 : 0 };
    for (const k of ['id', 'created_at', 'updated_at', 'updated_by', 'created_by', 'metrics_json', 'external_id', 'attempts', 'last_error', 'publish_state', 'next_attempt_at', 'publish_ref', 'metrics_at']) delete body[k];
    if (isNew) body.metrics_json = '{}';
    const metricsChanged = METRIC_FIELDS.some((k) => String(m[k] ?? '') !== String(metrics[k] ?? ''));
    try {
      const row = isNew ? await create('content', body) : await update('content', post.id, body);
      if (metricsChanged && row?.id) await api(`/social/posts/${row.id}/metrics`, { body: m });
      toast('Saved'); onClose();
    } catch (x: any) { toast(x.message, 'err'); }
  };
  const textToCopy = `${v.body ?? ''}\n\n${v.hashtags ?? ''}`.trim();
  const caption = (() => { const c = String(v.body ?? '').match(/(?:^|\n)\s*Caption:\s*([\s\S]*)$/i); return `${c ? c[1].trim() : v.body ?? ''}\n\n${v.hashtags ?? ''}`.trim(); })();
  const hasFiles = assets.some((a) => a.url && a.type !== 'direction');
  return (
    <Drawer open wide onClose={onClose} title={isNew ? 'New post' : v.title || 'Post'}>
      {!isNew ? <EditedBy row={post} /> : null}
      <Tabs tabs={[['write', 'Write'], ['media', `Media (${assets.filter((a) => a.type !== 'direction').length})`], ['results', 'Results'], ...(isNew ? [] : [['history', 'History']] as [string, string][])]} value={tab} onChange={setTab} />
      {tab !== 'history' ? <AutopostPanel post={post} v={v} setV={setV} isNew={isNew} onPosted={refresh} /> : null}
      {tab === 'write' ? (
        <>
          <Fields value={v} onChange={setV} fields={[
            { name: 'platform', label: 'Platform', type: 'select', options: PLATFORMS },
            { name: 'scheduled_at', label: 'Post at (Lagos time)', type: 'datetime' },
            { name: 'format', label: 'Format', placeholder: 'Carousel (6 slides), Reel 20s, Thread…' }, { name: 'status', label: 'Status', type: 'select', options: STATUSES },
            { name: 'theme', label: 'Theme' }, { name: 'goal', label: 'Goal', type: 'select', options: ['Awareness', 'Trust', 'Engagement', 'Leads', 'Traffic', 'Reach', 'Reviews', 'Thought leadership', 'Value'] },
            { name: 'title', label: 'Working title', wide: true },
            { name: 'body', label: v.platform === 'tiktok' ? 'Script (hook, beats, on-screen text, CTA) — add “Caption: …” for the posted caption' : v.platform === 'instagram' ? 'Slides + caption (only the text after “Caption:” is posted)' : 'Post / thread (start lines with 1/, 2/ … for a thread)', type: 'textarea', rows: 12 },
            { name: 'hashtags', label: 'Hashtags', wide: true },
          ]} />
          <div className="row-actions">
            <ManualKit caption={v.platform === 'x' ? textToCopy : caption} assets={assets} toast={toast} />
            <a className="btn sm ghost" href={v.platform === 'x' ? `https://x.com/intent/post?text=${encodeURIComponent(textToCopy.slice(0, 280))}` : POST_LINKS[v.platform]} target="_blank" rel="noreferrer"><ExternalLink size={14} strokeWidth={2} />Open {v.platform}</a>
            {v.platform === 'instagram' && /Slide \d/i.test(v.body ?? '') ? <a className="btn sm ghost" href={`/studio/carousel?post=${post.id}`} target="_blank" rel="noreferrer">Render carousel slides</a> : null}
          </div>
          {['instagram', 'tiktok'].includes(v.platform) && !hasFiles ? <p className="small" style={{ color: 'var(--red)' }}>No image or video yet: {v.platform === 'instagram' ? 'Instagram' : 'TikTok'} posts need media. Add it in the Media tab.</p> : null}
        </>
      ) : tab === 'media' ? (
        <MediaPicker assets={assets} onChange={setAssets} platform={v.platform} />
      ) : tab === 'results' ? (
        <>
          {!isNew ? <PostMetricsChart postId={post.id} platform={post.platform} /> : null}
          <Fields value={v} onChange={setV} fields={[
            { name: 'post_url', label: 'Link to the live post', wide: true },
            { name: 'impressions', label: 'Impressions', type: 'number' }, { name: 'views', label: 'Views (video plays)', type: 'number' },
            { name: 'reach', label: 'Reach', type: 'number' }, { name: 'likes', label: 'Likes', type: 'number' },
            { name: 'comments', label: 'Comments', type: 'number' }, { name: 'shares', label: 'Shares / reposts', type: 'number' },
            { name: 'saves', label: 'Saves / bookmarks', type: 'number' }, { name: 'clicks', label: 'Link clicks / profile visits', type: 'number' },
            { name: 'leads', label: 'DMs or leads it produced', type: 'number' },
          ]} />
          <p className="muted small">Connected platforms fill these in automatically (every 6 hours for 30 days, then daily to 90 days). For anything else, copy the numbers from the platform’s insights and Save: each save is kept as a snapshot so the charts still work. Leads are always typed in.</p>
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

const PLAT_KEYS = ['x', 'instagram', 'tiktok', 'linkedin'];

function Performance({ platform, onOpen }: { platform: string; onOpen: (p: any) => void }) {
  const [days, setDays] = useState('30');
  const [metric, setMetric] = useState<'imp' | 'eng'>('imp');
  const [on, setOn] = useState<Set<string>>(new Set(PLAT_KEYS));
  const toast = useToast();
  const { data, loading } = useData(() => api(`/social/dashboard?days=${days}${platform ? `&platform=${platform}` : ''}`), [days, platform]);
  const plats = useMemo(() => PLAT_KEYS.filter((k) => data && (data.series[k] || data.followers[k])), [data]);
  if (!data) return loading ? <Loading /> : <Empty title="Could not load results" />;
  const k = data.kpis;
  const series = plats.filter((p) => data.series[p] && on.has(p)).map((p) => ({ key: p, name: PLATFORM_META[p].name, color: PLATFORM_META[p].color, dash: PLATFORM_META[p].dash, values: data.dayKeys.map((d: string) => data.series[p]?.[d]?.[metric] ?? 0) }));
  const folSeries = plats.filter((p) => data.followers[p]?.length).map((p) => {
    let lastV: number | null = null; const by = Object.fromEntries(data.followers[p].map((r: any) => [r.day, r.followers]));
    const first = data.followers[p][0].followers;
    // indexed to a common base: net new followers since the start of the range (one axis for every platform)
    return { key: p, name: PLATFORM_META[p].name, color: PLATFORM_META[p].color, dash: PLATFORM_META[p].dash, values: data.dayKeys.map((d: string) => (lastV = by[d] ?? lastV ?? first) - first) };
  });
  const open = async (id: string) => { try { onOpen(await getOne('content', id)); } catch (x: any) { toast(x.message, 'err'); } };
  return (
    <div className="sx" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      <div className="sx-filters">
        <Tabs tabs={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} value={days} onChange={setDays} />
        <span className="muted small">{platform ? `${PLATFORM_META[platform]?.name ?? platform} only` : 'All platforms'} · compared with the {days} days before · Lagos time</span>
      </div>
      <div className="sx-kpis">
        <KpiTile label="Posts published" icon={<Send size={14} />} value={k.current.posts} prev={k.previous.posts} />
        <KpiTile label="Impressions / views" icon={<Eye size={14} />} value={k.current.impressions} prev={k.previous.impressions} hint="Impressions where the platform reports them, otherwise video views, otherwise reach" />
        <KpiTile label="Engagements" icon={<Heart size={14} />} value={k.current.engagements} prev={k.previous.engagements} hint="Likes + comments + shares + saves" />
        <KpiTile label="Engagement rate" icon={<BookOpen size={14} />} value={k.current.rate} prev={k.previous.rate || null} format={fmtPct} hint="Engagements ÷ impressions" />
        <KpiTile label="Follower growth" icon={<Users size={14} />} value={k.current.follower_growth} prev={k.previous.follower_growth || null} format={(n) => (n > 0 ? '+' : '') + fmtNum(n)} hint={`${fmtNum(k.current.followers)} followers now`} />
        <KpiTile label="Clicks · leads" icon={<MousePointerClick size={14} />} value={k.current.clicks} prev={k.previous.clicks} format={(n) => `${fmtNum(n)} · ${k.current.leads}`} hint="Link + profile clicks, and DMs/leads typed into posts" />
      </div>

      <Card title={metric === 'imp' ? 'Impressions over time' : 'Engagements over time'} actions={<Tabs tabs={[['imp', 'Impressions'], ['eng', 'Engagements']]} value={metric} onChange={(x) => setMetric(x as any)} />}>
        <div style={{ marginBottom: 10 }}><SeriesToggles items={plats.filter((p) => data.series[p]).map((p) => ({ key: p, name: PLATFORM_META[p].name, color: PLATFORM_META[p].color }))} on={on} onChange={setOn} /></div>
        <LineChart labels={data.dayKeys} series={series} area />
        <details className="small muted"><summary>Show as table</summary>
          <table className="sx-top"><thead><tr><th>Day</th>{series.map((s) => <th key={s.key} className="n">{s.name}</th>)}</tr></thead>
            <tbody>{data.dayKeys.map((d: string, i: number) => series.some((s) => s.values[i]) ? <tr key={d}><td>{d}</td>{series.map((s) => <td key={s.key} className="n">{fmtNum(s.values[i])}</td>)}</tr> : null)}</tbody></table>
        </details>
        <p className="muted small" style={{ margin: '8px 0 0' }}>Daily growth across all posts, worked out from the snapshots the collector takes (new numbers are credited to the day they were read).</p>
      </Card>

      <div className="grid-2">
        <Card title="Follower growth">
          {folSeries.length ? <>
            <LineChart labels={data.dayKeys} series={folSeries} height={200} format={(n) => (n > 0 ? '+' : '') + fmtNum(n)} />
            <p className="muted small" style={{ margin: '8px 0 0' }}>Net new followers since {data.dayKeys[0]}. Now: {plats.filter((p) => data.followers[p]?.length).map((p) => `${PLATFORM_META[p].name} ${fmtNum(data.followers[p][data.followers[p].length - 1].followers)}`).join(' · ')}</p>
          </> : <p className="muted small">No follower counts yet. They are read once a day from connected accounts; for others use “Log” in Connections below.</p>}
        </Card>
        <Card title="Best time to post">
          <HeatGrid grid={data.heat} />
          <p className="muted small" style={{ margin: '8px 0 0' }}>Average engagement rate of posts by the weekday and hour they went out (last {Math.max(Number(days), 90)} days).</p>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Engagement rate by format"><BarList rows={data.byFormat} value={(r) => r.rate} format={fmtPct} sub={(r) => `${r.posts} post${r.posts === 1 ? '' : 's'} · ${fmtNum(r.engagements)} eng.`} /></Card>
        <Card title="Engagement rate by theme"><BarList rows={data.byTheme.slice(0, 10)} value={(r) => r.rate} format={fmtPct} sub={(r) => `${r.posts} post${r.posts === 1 ? '' : 's'} · ${fmtNum(r.engagements)} eng.`} /></Card>
      </div>

      <Card title="Top posts">
        {data.top.length ? (
          <div style={{ overflowX: 'auto' }}><table className="sx-top">
            <thead><tr><th>Post</th><th>Trend (engagements)</th><th className="n">Impr./views</th><th className="n">Engagements</th><th className="n">Rate</th><th className="n">Leads</th></tr></thead>
            <tbody>{data.top.map((p: any) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => open(p.id)}>
                <td><span className={`plat ${p.platform}`}>{p.platform}</span> <strong>{p.title}</strong><div className="muted small">{p.format} · {fmtDate(p.posted_at, true)}{p.post_url ? <> · <a href={p.post_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--o)' }}><ExternalLink size={12} /> open</a></> : null}</div></td>
                <td><Sparkline values={p.spark.map((s: any) => s.eng)} color={PLATFORM_META[p.platform]?.color} label={`${p.title}: engagements ${p.spark.map((s: any) => s.eng).join(' → ')}`} /></td>
                <td className="n">{fmtNum(p.impressions)}</td><td className="n">{fmtNum(p.engagements)}</td><td className="n">{fmtPct(p.rate)}</td><td className="n">{p.leads || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted small">Nothing posted in this range yet. Posts appear here once they are live (auto-posted, or marked posted with numbers in Results).</p>}
      </Card>

      <ConnectionsCard />
      <p className="muted small">Engagements = likes + comments + shares + saves. Engagement rate = engagements ÷ impressions (views for video platforms, reach when that is all there is). X reads cost API credits; collection runs every 6 hours for posts under 30 days old, then daily until 90 days.</p>
    </div>
  );
}
