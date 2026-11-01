/** Studio pieces for social auto-posting: connections, media picker, auto-post panel, per-post results chart. */
import React, { useState } from 'react';
import {
  CircleAlert, CircleCheck, Clock, Copy, Download, ExternalLink, Film, ImagePlus, LoaderCircle, Lock, Plug, RefreshCw, Send, TriangleAlert, Unplug, Upload, X as XIcon, Zap,
} from 'lucide-react';
import { api, ago, can, fmtDate } from './api';
import { Card, useData, useToast, useUser } from './ui';
import { LineChart, PLATFORM_META, fmtNum } from './social-charts';

/* ── state labels shown in the calendar, list and editor ── */
export const PUBLISH_STATE: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | ''; icon: React.ReactNode }> = {
  publishing: { label: 'Publishing…', tone: '', icon: <LoaderCircle size={14} /> },
  processing: { label: 'Platform processing', tone: '', icon: <LoaderCircle size={14} /> },
  retrying: { label: 'Retrying', tone: 'warn', icon: <RefreshCw size={14} /> },
  needs_media: { label: 'Needs media', tone: 'bad', icon: <ImagePlus size={14} /> },
  capped: { label: 'Waiting (daily cap)', tone: 'warn', icon: <Clock size={14} /> },
  manual: { label: 'Post manually', tone: 'warn', icon: <Plug size={14} /> },
  missed: { label: 'Missed — not auto-posted', tone: 'bad', icon: <TriangleAlert size={14} /> },
  failed: { label: 'Auto-post failed', tone: 'bad', icon: <CircleAlert size={14} /> },
  posted: { label: 'Auto-posted', tone: 'ok', icon: <CircleCheck size={14} /> },
};
export function PublishBadge({ post }: { post: any }) {
  const st = post.publish_state ? PUBLISH_STATE[post.publish_state] : null;
  if (st) return <span className={`sx-state ${st.tone}`}>{st.icon}{st.label}</span>;
  if (Number(post.autopost) && post.status !== 'posted') return <span className="sx-state"><Zap size={14} />Auto-post {post.scheduled_at ? fmtDate(post.scheduled_at, true) : '(no time set)'}</span>;
  return null;
}
/** Small icon on calendar chips. */
export function CalFlag({ post }: { post: any }) {
  const st = post.publish_state;
  if (st === 'needs_media') return <span className="sx-flag" title="Needs media" style={{ color: 'var(--red)' }}><ImagePlus size={12} /></span>;
  if (st === 'failed' || st === 'missed') return <span className="sx-flag" title={PUBLISH_STATE[st].label} style={{ color: 'var(--red)' }}><CircleAlert size={12} /></span>;
  if (st === 'manual') return <span className="sx-flag" title="Not connected: post manually" style={{ color: 'var(--amber)' }}><Plug size={12} /></span>;
  if (st === 'retrying' || st === 'capped' || st === 'processing') return <span className="sx-flag" title={PUBLISH_STATE[st].label} style={{ color: 'var(--amber)' }}><Clock size={12} /></span>;
  if (Number(post.autopost) && post.status !== 'posted') return <span className="sx-flag" title="Will auto-post" style={{ color: 'var(--o)' }}><Zap size={12} /></span>;
  return null;
}

/* ── Connections card ── */
export function ConnectionsCard() {
  const toast = useToast();
  const user = useUser();
  const { data, reload } = useData(() => api('/social/connections'), []);
  const [busy, setBusy] = useState('');
  const [fol, setFol] = useState<Record<string, string>>({});
  if (!data) return null;
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Plug size={16} />Connections</span>}
      actions={can(user, 'admin') ? <button className="btn sm ghost" disabled={busy === 'run'} onClick={async () => {
        setBusy('run');
        try { const r = await api('/social/run', { body: {} }); toast(`Ran: ${r.published.length} post(s) checked, metrics ${Object.entries(r.metrics).map(([k, v]) => `${k} ${v}`).join(', ') || 'none due'}`); reload(); }
        catch (x: any) { toast(x.message, 'err'); } finally { setBusy(''); }
      }}><RefreshCw size={14} />Run now</button> : null}>
      {data.fake ? <div className="sx-note warn"><TriangleAlert size={16} />Dev mode: SOCIAL_FAKE_API=1, every platform call is answered by stubs. Never set this in production.</div> : null}
      <div className="sx-conn">
        {data.rows.map((p: any) => (
          <div key={p.platform}>
            <h5><span><span className={`plat ${p.platform}`}>{p.name}</span></span>
              {p.connected ? <span className="sx-state ok"><CircleCheck size={14} />Connected</span> : <span className="sx-state warn"><Unplug size={14} />Manual mode</span>}</h5>
            {p.account ? <div className="small"><strong>{p.account}</strong>{p.connected_by ? <span className="muted"> · by {p.connected_by} {ago(p.connected_at)}</span> : null}</div> : null}
            <div className="small muted">{p.posted_24h} of {p.cap} posts in the last 24 h (daily cap){p.followers ? ` · ${fmtNum(p.followers.value)} followers (${p.followers.day}${p.followers.source === 'manual' ? ', typed in' : ''})` : ''}</div>
            {p.missing?.length ? <div className="small">Needs: {p.missing.map((m: string) => <code key={m} style={{ marginRight: 4 }}>{m}</code>)}</div> : null}
            <details className="small"><summary className="muted">Scopes / permissions</summary><ul>{p.scopes.map((s: string) => <li key={s}><code>{s}</code></li>)}</ul></details>
            {p.notes.length ? <ul>{p.notes.map((n: string) => <li key={n}>{n}</li>)}</ul> : null}
            {p.metrics_error ? <div className="sx-note bad"><CircleAlert size={14} />Results could not be read ({ago(p.metrics_error.at)}): {p.metrics_error.error}</div> : null}
            <div className="row-actions" style={{ marginBottom: 0 }}>
              {p.how !== 'keys' && can(user, 'admin') ? (p.can_connect
                ? <a className="btn sm primary" href={`/api/studio/social/connect/${p.platform}`}><Plug size={14} />{p.connected ? 'Reconnect' : 'Connect'}</a>
                : <span className="small muted">Add the secrets above, then Connect appears here.</span>) : null}
              {p.platform === 'x' && !p.connected ? <span className="small muted">X connects with keys from console.x.com (docs/SOCIAL.md).</span> : null}
              {p.connected ? <button className="btn sm ghost" disabled={busy === p.platform} onClick={async () => {
                setBusy(p.platform);
                try { const r = await api(`/social/test/${p.platform}`, { body: {} }); toast(`${p.name} OK${r.account ? ' — @' + r.account : ''}: ${fmtNum(r.followers ?? 0)} followers`); }
                catch (x: any) { toast(x.message, 'err'); } finally { setBusy(''); }
              }}>Test</button> : null}
              {p.connected && p.how !== 'keys' && can(user, 'admin') ? <button className="btn sm ghost danger" onClick={async () => {
                if (!confirm(`Disconnect ${p.name}? Auto-posts switch to manual mode.`)) return;
                await api(`/social/disconnect/${p.platform}`, { body: {} }); toast('Disconnected'); reload();
              }}>Disconnect</button> : null}
            </div>
            {!p.connected && can(user, 'editor') ? (
              <div className="row gap small">
                <input type="number" min={0} placeholder="Followers today" value={fol[p.platform] ?? ''} onChange={(e) => setFol({ ...fol, [p.platform]: e.target.value })} style={{ maxWidth: 150 }} />
                <button className="btn sm ghost" onClick={async () => {
                  try { await api('/social/followers', { body: { platform: p.platform, followers: Number(fol[p.platform]) } }); toast('Follower count saved'); setFol({ ...fol, [p.platform]: '' }); reload(); }
                  catch (x: any) { toast(x.message, 'err'); }
                }}>Log</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!data.enc_key ? <p className="small muted" style={{ marginBottom: 0 }}><Lock size={12} /> Set the <code>SOCIAL_ENC_KEY</code> secret to store TikTok/Instagram logins (encrypted with AES-GCM).</p> : null}
    </Card>
  );
}

/* ── media picker: images and videos straight to R2 ── */
const ONE_SHOT = 95 * 1024 * 1024, PART = 50 * 1024 * 1024;
function put(url: string, body: Blob, onProgress: (loaded: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url); x.withCredentials = true;
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () => { let d: any = {}; try { d = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 && d.ok !== false ? resolve(d) : reject(new Error(d.error || `Upload failed (${x.status})`)); };
    x.onerror = () => reject(new Error('Network error during upload'));
    x.send(body);
  });
}
export async function uploadSocialMedia(file: File, onProgress: (pct: number) => void): Promise<{ url: string; type: 'image' | 'video'; key: string; size: number }> {
  const q = `name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}`;
  if (file.size <= ONE_SHOT) return put(`/api/studio/social/media?${q}`, file, (l) => onProgress(l / file.size));
  const start = await api(`/social/media/mpu?${q}`, { body: {} });
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    for (let i = 0, off = 0; off < file.size; i++, off += PART) {
      const r = await put(`/api/studio/social/media/mpu/part?key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}&part=${i + 1}`, file.slice(off, off + PART), (l) => onProgress((off + l) / file.size));
      parts.push({ partNumber: r.partNumber, etag: r.etag });
    }
    return await api('/social/media/mpu/complete', { body: { key: start.key, uploadId: start.uploadId, parts } });
  } catch (e) {
    await api('/social/media/mpu/complete', { body: { key: start.key, uploadId: start.uploadId, abort: true } }).catch(() => null);
    throw e;
  }
}

export function MediaPicker({ assets, onChange, platform }: { assets: any[]; onChange: (a: any[]) => void; platform: string }) {
  const toast = useToast();
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const files = assets.filter((a) => a.type === 'image' || a.type === 'video' || (a.url && a.type === 'file'));
  const notes = assets.filter((a) => a.type === 'direction');
  const kind = (a: any) => (a.type === 'image' || a.type === 'video' ? a.type : /\.(mp4|mov|webm|m4v)$/i.test(a.url) ? 'video' : /\.(png|jpe?g|webp|gif)$/i.test(a.url) ? 'image' : 'file');
  const move = (i: number, d: number) => { const a = [...assets]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div>
      <p className="muted small">
        Images and videos are stored in Ferrn media (R2) and served publicly from <code>/media/…</code>, which is how Instagram and TikTok fetch them.
        {platform === 'instagram' ? ' Instagram: JPEG only, up to 10 items become a carousel, a single video posts as a Reel.' : platform === 'tiktok' ? ' TikTok: one MP4/MOV video (3 s–10 min), or photos for a photo post.' : platform === 'x' ? ' X: up to 4 images (5 MB each) or one video.' : ''}
        {' '}Uploads up to 95 MB go in one request (Cloudflare’s 100 MB request limit); bigger videos upload in 50 MB parts.
      </p>
      <label className="btn sm ghost upload">
        {progress ? <><LoaderCircle size={14} />{progress.name} {Math.round(progress.pct * 100)}%</> : <><Upload size={14} />Add images or video</>}
        <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" disabled={!!progress} onChange={async (e) => {
          const list = Array.from(e.target.files ?? []); e.target.value = '';
          let next = [...assets];
          for (const f of list) {
            setProgress({ name: f.name, pct: 0 });
            try { const r = await uploadSocialMedia(f, (pct) => setProgress({ name: f.name, pct })); next = [...next, { url: r.url, type: r.type, key: r.key, name: f.name, size: r.size, mime: f.type }]; onChange(next); }
            catch (x: any) { toast(`${f.name}: ${x.message}`, 'err'); }
          }
          setProgress(null);
          if (list.length) toast('Uploaded — remember to Save');
        }} />
      </label>
      {files.length ? (
        <div className="sx-media">{assets.map((a, i) => a.type === 'direction' ? null : (
          <figure key={i}>
            {kind(a) === 'image' ? <img src={a.url} alt="" /> : kind(a) === 'video' ? <video src={a.url} muted controls preload="metadata" /> : <a href={a.url} target="_blank" rel="noreferrer">{String(a.url).split('/').pop()}</a>}
            <figcaption><span>{kind(a) === 'video' ? <Film size={11} /> : null} {i + 1}{a.size ? ` · ${(a.size / 1048576).toFixed(1)} MB` : ''}{platform === 'instagram' && kind(a) === 'image' && !/\.jpe?g$/i.test(a.url) ? ' · not JPEG' : ''}</span>
              <span><button className="link small" onClick={() => move(i, -1)} aria-label="Move earlier">‹</button> <button className="link small" onClick={() => move(i, 1)} aria-label="Move later">›</button></span></figcaption>
            <button className="icon" aria-label="Remove" onClick={() => onChange(assets.filter((_, j) => j !== i))}><XIcon size={14} /></button>
          </figure>
        ))}</div>
      ) : <p className="small" style={{ marginTop: 10 }}>No images or video yet.</p>}
      {notes.map((n, i) => <p key={i} className="small"><strong>Visual direction:</strong> {n.note}</p>)}
    </div>
  );
}

/* ── auto-post panel (editor) ── */
export function AutopostPanel({ post, v, setV, isNew, onPosted }: { post: any; v: Record<string, any>; setV: (v: Record<string, any>) => void; isNew: boolean; onPosted: () => void }) {
  const toast = useToast();
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const supported = ['x', 'instagram', 'tiktok'].includes(v.platform);
  const conn = useData(() => api('/social/connections').then((r) => r.rows.find((x: any) => x.platform === v.platform)), [v.platform]).data;
  const tt = useData(() => (v.platform === 'tiktok' ? api('/social/tiktok/creator').catch(() => null) : Promise.resolve(null)), [v.platform]).data;
  const opts = (() => { try { return typeof v.publish_opts_json === 'string' ? JSON.parse(v.publish_opts_json || '{}') : v.publish_opts_json ?? {}; } catch { return {}; } })();
  const setOpt = (k: string, val: unknown) => setV({ ...v, publish_opts_json: JSON.stringify({ ...opts, [k]: val }) });
  if (!supported) return <div className="sx-note"><Plug size={16} />Auto-posting covers X, Instagram and TikTok. Post {v.platform} by hand.</div>;
  const posted = post.status === 'posted' && post.external_id;
  const st = post.publish_state;
  return (
    <>
      <div className="sx-autopost">
        <label className="sx-switch"><input type="checkbox" checked={!!Number(v.autopost)} onChange={(e) => setV({ ...v, autopost: e.target.checked ? 1 : 0 })} disabled={!!posted} />Auto-post</label>
        <div className="grow muted">
          {posted ? <>Live on {PLATFORM_META[post.platform]?.name}: <a href={post.post_url} target="_blank" rel="noreferrer" style={{ color: 'var(--o)' }}>open post <ExternalLink size={12} /></a></>
            : Number(v.autopost) ? <>Goes out automatically at the scheduled time when the status is <strong>approved</strong> or <strong>scheduled</strong>{conn && !conn.connected ? '. This platform is not connected, so it will be flagged for manual posting.' : '.'}</>
              : 'Off: nothing is posted automatically.'}
        </div>
        <PublishBadge post={post} />
        {!isNew && !posted && can(user, 'editor') ? (
          <button className="btn sm primary" disabled={busy || (conn && !conn.connected)} title={conn && !conn.connected ? 'Connect this platform first' : 'Publish now'} onClick={async () => {
            if (!confirm(`Post this to ${PLATFORM_META[v.platform]?.name} now? Save your edits first.`)) return;
            setBusy(true);
            try { const r = await api(`/social/posts/${post.id}/publish`, { body: {} }); toast(r.state === 'posted' ? 'Posted!' : `${PUBLISH_STATE[r.state]?.label ?? r.state}${r.message ? ': ' + r.message : ''}`, r.state === 'posted' || r.state === 'processing' ? 'ok' : 'err'); onPosted(); }
            catch (x: any) { toast(x.message, 'err'); onPosted(); } finally { setBusy(false); }
          }}>{busy ? <LoaderCircle size={14} /> : <Send size={14} />}Post now</button>
        ) : null}
      </div>
      {post.last_error && !posted ? <div className={`sx-note ${st === 'processing' || st === 'publishing' ? '' : st === 'retrying' || st === 'capped' || st === 'manual' ? 'warn' : 'bad'}`}><CircleAlert size={16} /><div>{post.last_error}{post.attempts ? <span className="muted"> · attempt {post.attempts} of 3{post.next_attempt_at && st === 'retrying' ? `, next ${fmtDate(post.next_attempt_at, true)}` : ''}</span> : null}</div></div> : null}
      {posted && post.last_error ? <div className="sx-note warn"><TriangleAlert size={16} />{post.last_error}</div> : null}
      {v.platform === 'tiktok' && !posted ? (
        <div className="sx-note">
          <Film size={16} />
          <div style={{ display: 'grid', gap: 6, flex: 1 }}>
            {tt?.connected ? <>
              <div>Posting to <strong>{tt.nickname}</strong> (@{tt.username}){tt.max_video_post_duration_sec ? <span className="muted"> · videos up to {Math.round(tt.max_video_post_duration_sec / 60)} min</span> : null}</div>
              <label className="small">Who can view this video
                <select value={opts.privacy_level ?? ''} onChange={(e) => setOpt('privacy_level', e.target.value || undefined)} disabled={!tt.audited} style={{ marginTop: 4 }}>
                  <option value="">{tt.audited ? 'Choose…' : 'Only me (required until the app is audited)'}</option>
                  {tt.audited ? (tt.privacy_level_options ?? []).map((o: string) => <option key={o} value={o}>{o.replace(/_/g, ' ').toLowerCase()}</option>) : null}
                </select>
              </label>
              <div className="row gap small">
                <label className="sx-switch"><input type="checkbox" checked={!!opts.disable_comment} onChange={(e) => setOpt('disable_comment', e.target.checked)} />Turn off comments</label>
                <label className="sx-switch"><input type="checkbox" checked={!!opts.brand_organic} onChange={(e) => setOpt('brand_organic', e.target.checked)} />Promotes Ferrn (your brand)</label>
              </div>
              {!tt.audited ? <span className="small muted">TikTok has not audited this app yet, so every API post is private (“Only me”). Open it in the TikTok app and switch it to Everyone, or finish the audit (docs/SOCIAL.md).</span> : null}
            </> : <span>TikTok isn’t connected, so this is a <strong>manual</strong> post: use <em>Copy caption</em> and <em>Download video</em> below, then upload in the TikTok app.</span>}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Manual kit: copy caption + download each media file. */
export function ManualKit({ caption, assets, toast }: { caption: string; assets: any[]; toast: (t: string, k?: any) => void }) {
  const files = assets.filter((a) => a.url && a.type !== 'direction');
  return (
    <>
      <button className="btn sm ghost" onClick={() => navigator.clipboard.writeText(caption).then(() => toast('Caption copied'))}><Copy size={14} />Copy caption</button>
      {files.map((a, i) => <a key={i} className="btn sm ghost" href={a.url} download={a.name ?? String(a.url).split('/').pop()}><Download size={14} />Download {/\.(mp4|mov|webm|m4v)$/i.test(a.url) || a.type === 'video' ? 'video' : 'image'}{files.length > 1 ? ` ${i + 1}` : ''}</a>)}
    </>
  );
}

/* ── per-post results over time ── */
export function PostMetricsChart({ postId, platform }: { postId: string; platform: string }) {
  const { data } = useData(() => api(`/social/posts/${postId}/metrics`).then((r) => r.rows as any[]), [postId]);
  if (!data) return null;
  if (data.length < 2) return <p className="muted small">{data.length ? 'One snapshot so far — the chart appears after the next collection (every 6 hours for the first 30 days, then daily).' : 'No results collected yet. Connected platforms are read every 6 hours; for others type the numbers below.'}</p>;
  const labels = data.map((r) => r.captured_at);
  const lf = (s: string) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', timeZone: 'Africa/Lagos' });
  const reachKeys = [['impressions', 'Impressions', 'var(--s-x)'], ['views', 'Views', 'var(--s-ig)'], ['reach', 'Reach', 'var(--s-tt)']].filter(([k]) => data.some((r) => r[k] != null));
  const actKeys: [string, string, string, string | undefined][] = ([['likes', 'Likes', 'var(--s-x)', undefined], ['comments', 'Comments', 'var(--s-ig)', '6 3'], ['shares', 'Shares', 'var(--s-tt)', '2 3'], ['saves', 'Saves', 'var(--s-li)', '8 3 2 3']] as [string, string, string, string | undefined][]).filter(([k]) => data.some((r) => r[k] != null));
  return (
    <div className="sx" style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
      {reachKeys.length ? <div><h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Audience over time</h4>
        <LineChart height={170} labels={labels} labelFmt={lf} series={reachKeys.map(([k, n, c], i) => ({ key: k, name: n, color: c, dash: i ? ['', '6 3', '2 3'][i] : undefined, values: data.map((r) => Number(r[k]) || 0) }))} /></div> : null}
      {actKeys.length ? <div><h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Engagement actions over time</h4>
        <LineChart height={170} labels={labels} labelFmt={lf} series={actKeys.map(([k, n, c, d]) => ({ key: k, name: n, color: c, dash: d, values: data.map((r) => Number(r[k]) || 0) }))} /></div> : null}
      <p className="muted small" style={{ margin: 0 }}>{data.length} snapshots · last {ago(data[data.length - 1].captured_at)} ({data[data.length - 1].source === 'manual' ? 'typed in' : `read from ${PLATFORM_META[platform]?.name ?? platform}`})</p>
    </div>
  );
}
