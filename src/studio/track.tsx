import React, { useMemo, useState } from 'react';
import { api, list, update } from './api';
import { Card, copy, Empty, Loading, useData, useToast } from './ui';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Link2, MousePointerClick } from 'lucide-react';

/** Same rule everywhere: the tracked link for a post, so website visits show up per post in Analytics. */
export const campaignOf = (p: { scheduled_at?: string; platform: string; title?: string }) => {
  const d = new Date(p.scheduled_at || Date.now());
  const day = d.toLocaleString('en-GB', { month: 'short', timeZone: 'Africa/Lagos' }).toLowerCase() + d.toLocaleString('en-GB', { day: '2-digit', timeZone: 'Africa/Lagos' });
  const slug = String(p.title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${day}-${p.platform}-${slug}`;
};
export const trackedLink = (p: any, path = '/') => `https://www.ferrnagency.com${path}?utm_source=${p.platform}&utm_medium=social&utm_campaign=${campaignOf(p)}`;
export const BIO_LINKS: [string, string][] = [['instagram', 'Instagram bio'], ['tiktok', 'TikTok bio'], ['x', 'X bio']];
const bioLink = (pl: string) => `https://www.ferrnagency.com/?utm_source=${pl}&utm_medium=social&utm_campaign=bio-${pl}`;

const FIELDS: [string, string][] = [['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves'], ['leads', 'Leads']];
const startOfWeek = (d: Date) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; };
const PL: Record<string, string> = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn' };

export function Track({ platform, onOpen }: { platform: string; onOpen: (p: any) => void }) {
  const toast = useToast();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const to = new Date(week); to.setDate(to.getDate() + 7);
  const posts = useData(() => list('content', { platform, from: week.toISOString(), to: to.toISOString() }), [platform, week.getTime()]);
  const an = useData(() => api<any>('/analytics/overview?range=30d').catch(() => null), []);
  const visits = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of an.data?.campaigns ?? []) if (c.campaign) m[c.campaign] = (m[c.campaign] ?? 0) + Number(c.n || 0);
    return m;
  }, [an.data]);
  const [edit, setEdit] = useState<Record<string, Record<string, any>>>({});
  const [busy, setBusy] = useState<string>('');
  const rows = (posts.data ?? []).slice().sort((a: any, b: any) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  const val = (p: any, k: string) => {
    if (edit[p.id]?.[k] !== undefined) return edit[p.id][k];
    if (k === 'post_url') return p.post_url ?? '';
    try { return JSON.parse(p.metrics_json || '{}')[k] ?? ''; } catch { return ''; }
  };
  const set = (id: string, k: string, v: any) => setEdit((e) => ({ ...e, [id]: { ...(e[id] ?? {}), [k]: v } }));
  const save = async (p: any, markPosted = false) => {
    setBusy(p.id);
    try {
      const e = edit[p.id] ?? {};
      const patch: Record<string, unknown> = {};
      if (e.post_url !== undefined) patch.post_url = e.post_url;
      if (markPosted || (e.post_url && p.status !== 'posted')) { patch.status = 'posted'; patch.posted_at = p.posted_at || new Date().toISOString(); }
      if (Object.keys(patch).length) await update('content', p.id, patch);
      const nums = Object.fromEntries(FIELDS.map(([k]) => [k, e[k]]).filter(([, v]) => v !== undefined && v !== ''));
      if (Object.keys(nums).length) await api(`/social/posts/${p.id}/metrics`, { body: nums });
      setEdit((x) => { const y = { ...x }; delete y[p.id]; return y; });
      toast(markPosted ? 'Marked as posted' : 'Results saved'); posts.reload();
    } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(''); }
  };
  const label = `${week.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(to.getTime() - 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const posted = rows.filter((p: any) => p.status === 'posted').length;
  const totals = rows.reduce((a: any, p: any) => { for (const [k] of FIELDS) a[k] = (a[k] || 0) + (Number(val(p, k)) || 0); a.visits += visits[campaignOf(p)] || 0; return a; }, { visits: 0 });

  return (
    <div className="trk">
      <div className="trk-head">
        <div className="month-nav">
          <button className="icon" aria-label="Previous week" onClick={() => setWeek(new Date(week.getTime() - 7 * 864e5))}><ChevronLeft size={16} /></button>
          <strong><CalendarDays size={15} /> {label}</strong>
          <button className="icon" aria-label="Next week" onClick={() => setWeek(new Date(week.getTime() + 7 * 864e5))}><ChevronRight size={16} /></button>
        </div>
        <div className="trk-kpis">
          <span><b>{posted}/{rows.length}</b> posted</span>
          <span><b>{totals.views || 0}</b> views</span>
          <span><b>{(totals.likes || 0) + (totals.comments || 0) + (totals.shares || 0) + (totals.saves || 0)}</b> engagements</span>
          <span><b>{totals.visits}</b> site visits</span>
          <span><b>{totals.leads || 0}</b> leads</span>
        </div>
      </div>
      <p className="muted small trk-help">Post from your phone as usual. Then come back here: tick <strong>Posted</strong>, paste the post link, and type in the numbers from the app (do it again after a few days to see growth). Put the post's <strong>tracked link</strong> in the caption, bio or link sticker, and <strong>site visits</strong> fill in by themselves.</p>
      {posts.loading ? <Loading /> : !rows.length ? (
        <Empty icon={CalendarDays} title="No posts this week">Import the November calendar or add posts, then track them here.</Empty>
      ) : (
        <div className="table-wrap"><table className="table trk-table">
          <thead><tr><th>Post</th><th>Posted</th><th>Link to live post</th>{FIELDS.map(([, l]) => <th key={l} className="num">{l}</th>)}<th className="num" title="Website visits from this post's tracked link (last 30 days)">Site visits</th><th></th></tr></thead>
          <tbody>{rows.map((p: any) => {
            const dirty = !!edit[p.id]; const camp = campaignOf(p); const media = (() => { try { return JSON.parse(p.media_json || '[]').filter((m: any) => m.url); } catch { return []; } })();
            return (
              <tr key={p.id} className={p.status === 'posted' ? 'done' : ''}>
                <td className="trk-post">
                  <span className={`plat ${p.platform}`}>{PL[p.platform] ?? p.platform}</span>
                  <button className="link trk-title" onClick={() => onOpen(p)}>{p.title}</button>
                  <div className="muted small">{new Date(p.scheduled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })} · {p.format}</div>
                  <div className="trk-tools">
                    <button className="btn xs ghost" onClick={() => copy([p.body, p.hashtags].filter(Boolean).join('\n\n'), toast, 'Caption copied')}><Copy size={12} />Caption</button>
                    <button className="btn xs ghost" title={trackedLink(p)} onClick={() => copy(trackedLink(p), toast, 'Tracked link copied')}><Link2 size={12} />Tracked link</button>
                    {media.length ? <a className="btn xs ghost" href={media[0].url} target="_blank" rel="noreferrer" download><Download size={12} />{media.length > 1 ? `${media.length} files` : 'Media'}</a> : null}
                  </div>
                </td>
                <td><button className={`trk-check ${p.status === 'posted' ? 'on' : ''}`} aria-label={p.status === 'posted' ? 'Posted' : 'Mark as posted'} disabled={busy === p.id || p.status === 'posted'} onClick={() => save(p, true)}><Check size={15} strokeWidth={3} /></button></td>
                <td><div className="trk-url"><input placeholder="Paste link" value={val(p, 'post_url')} onChange={(e) => set(p.id, 'post_url', e.target.value)} />{p.post_url ? <a href={p.post_url} target="_blank" rel="noreferrer" aria-label="Open post"><ExternalLink size={13} /></a> : null}</div></td>
                {FIELDS.map(([k]) => <td key={k} className="num"><input inputMode="numeric" value={val(p, k)} onChange={(e) => set(p.id, k, e.target.value.replace(/[^\d]/g, ''))} /></td>)}
                <td className="num"><span className="trk-visits" title={camp}><MousePointerClick size={12} />{visits[camp] ?? 0}</span></td>
                <td><button className="btn sm primary" disabled={!dirty || busy === p.id} onClick={() => save(p)}>{busy === p.id ? 'Saving…' : 'Save'}</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <Card title="Bio links" className="trk-bio">
        <p className="muted small" style={{ marginTop: 0 }}>Use these in your profile bios so visits from each app are counted separately in Analytics.</p>
        <div className="trk-bios">{BIO_LINKS.map(([pl, l]) => (
          <div key={pl}><span className={`plat ${pl}`}>{l}</span><code>{bioLink(pl).replace('https://www.', '')}</code><button className="btn xs ghost" onClick={() => copy(bioLink(pl), toast, 'Bio link copied')}><Copy size={12} />Copy</button><b>{visits[`bio-${pl}`] ?? 0} visits</b></div>
        ))}</div>
      </Card>
      <style>{`
.trk-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px}
.trk-head .month-nav strong{display:inline-flex;gap:6px;align-items:center}
.trk-kpis{display:flex;gap:8px;flex-wrap:wrap}
.trk-kpis span{border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12.5px;color:var(--muted);background:var(--panel)}
.trk-kpis b{color:var(--ink);font-size:14px;margin-right:4px}
.trk-help{margin:6px 0 12px}
.trk-table td{vertical-align:top}
.trk-table tr.done td{background:color-mix(in srgb,var(--green) 4%,transparent)}
.trk-post{min-width:220px;max-width:280px}
.trk-title{display:block;text-align:left;color:var(--ink);font-weight:600;margin:4px 0 2px;cursor:pointer}
.trk-tools{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.btn.xs{padding:3px 9px;font-size:11.5px;gap:4px}
.trk-check{width:30px;height:30px;border-radius:9px;border:1.5px solid var(--line);background:transparent;color:transparent;display:grid;place-items:center;cursor:pointer}
.trk-check:hover:not(:disabled){border-color:var(--green);color:var(--green)}
.trk-check.on{background:var(--green);border-color:var(--green);color:#fff;cursor:default}
.trk-url{display:flex;gap:4px;align-items:center;min-width:140px}
.trk-url input{padding:6px 8px;font-size:12.5px}
.trk-url a{color:var(--muted)}
.trk-table td.num input{width:56px;padding:6px 8px;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums}
.trk-table th.num{text-align:right}
.trk-visits{display:inline-flex;gap:4px;align-items:center;font-variant-numeric:tabular-nums;color:var(--muted);padding-top:7px}
.trk-bio{margin-top:16px}
.trk-bios{display:grid;gap:8px}
.trk-bios div{display:grid;grid-template-columns:110px 1fr auto auto;gap:10px;align-items:center}
.trk-bios code{font-size:12px;color:var(--o);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk-bios b{font-size:12.5px;color:var(--muted);font-weight:500}
@media (max-width:700px){.trk-bios div{grid-template-columns:1fr auto}.trk-bios code{grid-column:1/-1}}
`}</style>
    </div>
  );
}
