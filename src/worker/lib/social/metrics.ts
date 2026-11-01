/**
 * Results collection. Every cron tick picks the posts that are due: every 6 hours while a post is under
 * 30 days old, then daily until 90 days. Each collection appends a post_metrics snapshot and refreshes
 * content_posts.metrics_json. Followers are snapshotted once a day per platform (social_accounts_daily).
 */
import type { Bindings } from '../env';
import { all, first, parseJson, run } from '../db';
import { iso, lagosDay, METRIC_KEYS, num, type Metrics, type Platform } from './common';
import { redact } from './http';
import { CONNECTORS } from './scheduler';

const H = 3600_000, D = 24 * H;

/** Engagements = likes + comments + shares + saves; rate is over impressions, else views, else reach. */
export function engagementOf(m: Record<string, any>) {
  const eng = (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.shares) || 0) + (Number(m.saves) || 0);
  const imp = Number(m.impressions) || Number(m.views) || Number(m.reach) || 0;
  return { eng, imp, rate: imp ? eng / imp : 0 };
}

/** Writes a snapshot and merges the numbers into metrics_json (keeps fields the APIs don't know, like leads). */
export async function recordMetrics(env: Bindings, postId: string, platform: string, m: Metrics & { raw?: unknown }, source: 'api' | 'manual', at = Date.now()) {
  const v = Object.fromEntries(METRIC_KEYS.map((k) => [k, num(m[k])])) as Record<string, number | null>;
  await run(env.DB, `INSERT INTO post_metrics (post_id, platform, captured_at, impressions, reach, views, likes, comments, shares, saves, clicks, source, raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, postId, platform, iso(at), v.impressions, v.reach, v.views, v.likes, v.comments, v.shares, v.saves, v.clicks, source,
    m.raw === undefined ? null : JSON.stringify(m.raw).slice(0, 8000));
  const row = await first<{ metrics_json: string }>(env.DB, 'SELECT metrics_json FROM content_posts WHERE id = ?', postId);
  const merged: Record<string, any> = { ...parseJson<Record<string, any>>(row?.metrics_json, {}) };
  for (const [k, x] of Object.entries(v)) if (x != null) merged[k] = x;
  const e = engagementOf(merged);
  merged.engagements = e.eng; merged.engagement_rate = Number(e.rate.toFixed(4)); merged.updated = iso(at); merged.source = source;
  await run(env.DB, `UPDATE content_posts SET metrics_json = ?${source === 'api' ? ', metrics_at = ?' : ''} WHERE id = ?`,
    ...(source === 'api' ? [JSON.stringify(merged), iso(at), postId] : [JSON.stringify(merged), postId]));
}

export async function runCollector(env: Bindings, now = Date.now(), limit = 60) {
  const due = await all<{ id: string; platform: Platform; external_id: string; publish_ref: string | null }>(env.DB, `SELECT id, platform, external_id, publish_ref FROM content_posts
    WHERE external_id IS NOT NULL AND platform IN ('x','instagram','tiktok') AND posted_at >= ?
      AND (metrics_at IS NULL OR (posted_at >= ? AND metrics_at <= ?) OR metrics_at <= ?)
    ORDER BY COALESCE(metrics_at, '') LIMIT ?`, iso(now - 90 * D), iso(now - 30 * D), iso(now - 6 * H + 5 * 60_000), iso(now - D + 5 * 60_000), limit);
  const byPlat: Record<string, typeof due> = {};
  for (const r of due) (byPlat[r.platform] ??= []).push(r);
  const summary: Record<string, number | string> = {};
  for (const [platform, rows] of Object.entries(byPlat)) {
    const conn = CONNECTORS[platform as Platform];
    if (!(await conn.configured(env).catch(() => false))) continue;
    try {
      const res = await conn.fetchMetrics(env, rows.map((r) => ({ post_id: r.id, external_id: r.external_id, ref: parseJson(r.publish_ref, {}) })));
      for (const r of rows) {
        if (res[r.id]) await recordMetrics(env, r.id, platform, res[r.id], 'api', now);
        else await run(env.DB, 'UPDATE content_posts SET metrics_at = ? WHERE id = ?', iso(now), r.id); // private/deleted: try again next window
      }
      summary[platform] = Object.keys(res).length;
      await env.CACHE.delete(`social:metrics_err:${platform}`);
    } catch (e: any) {
      // e.g. the X plan forbids reads: keep posting, note it for Studio, wait for the next window.
      const msg = redact(String(e?.message ?? e));
      summary[platform] = msg;
      console.warn('social metrics failed', platform, msg);
      await env.CACHE.put(`social:metrics_err:${platform}`, JSON.stringify({ at: iso(now), error: msg }), { expirationTtl: 7 * 86400 });
      for (const r of rows) await run(env.DB, 'UPDATE content_posts SET metrics_at = ? WHERE id = ?', iso(now), r.id);
    }
  }
  return summary;
}

/** Once a day per platform (Lagos date). Manual entries for the day are replaced by API numbers. */
export async function accountSnapshot(env: Bindings, now = Date.now()) {
  const day = lagosDay(now);
  const done = new Set((await all<{ platform: string }>(env.DB, "SELECT platform FROM social_accounts_daily WHERE day = ? AND source = 'api'", day)).map((r) => r.platform));
  const out: Record<string, number | null | string> = {};
  for (const platform of Object.keys(CONNECTORS) as Platform[]) {
    if (done.has(platform)) continue;
    const conn = CONNECTORS[platform];
    if (!(await conn.configured(env).catch(() => false))) continue;
    try {
      const s = await conn.accountStats(env);
      await run(env.DB, `INSERT INTO social_accounts_daily (platform, day, followers, following, posts, source, raw_json, captured_at) VALUES (?,?,?,?,?, 'api', ?, ?)
        ON CONFLICT(platform, day) DO UPDATE SET followers=excluded.followers, following=excluded.following, posts=excluded.posts, source='api', raw_json=excluded.raw_json, captured_at=excluded.captured_at`,
        platform, day, s.followers, s.following ?? null, s.posts ?? null, JSON.stringify(s.raw ?? null).slice(0, 4000), iso(now));
      out[platform] = s.followers;
    } catch (e: any) { out[platform] = redact(String(e?.message ?? e)); console.warn('social account snapshot failed', platform, out[platform]); }
  }
  return out;
}

/* ── dashboard aggregation ── */
const LAGOS = H; // UTC+1, no DST
const dayOf = (isoStr: string) => new Date(Date.parse(isoStr) + LAGOS).toISOString().slice(0, 10);
export const formatBucket = (f?: string | null) => {
  const s = String(f ?? '').toLowerCase();
  if (/carousel|slides?/.test(s)) return 'Carousel';
  if (/thread/.test(s)) return 'Thread';
  if (/reel|video|talking|screen|skit|pov|demo|tutorial|walkthrough|voiceover|vlog|duet|stitch/.test(s)) return 'Video';
  if (/photo|image|graphic|poster|quote|meme|infographic|static/.test(s)) return 'Image';
  if (/poll/.test(s)) return 'Poll';
  return s ? 'Text post' : 'Other';
};
export const themeBucket = (t?: string | null) => String(t ?? '').split(/\s[–-]\s/)[0].trim() || 'Untagged';

export async function dashboard(env: Bindings, opts: { days: number; platform?: string }) {
  const now = Date.now();
  const days = Math.min(Math.max(opts.days || 30, 7), 365);
  const start = now - days * D, prevStart = start - days * D;
  const pf = opts.platform && ['x', 'instagram', 'tiktok', 'linkedin'].includes(opts.platform) ? opts.platform : '';
  const pWhere = pf ? 'AND p.platform = ?' : '';
  const pArgs = pf ? [pf] : [];

  const posts = await all<any>(env.DB, `SELECT p.id, p.platform, p.format, p.theme, p.title, p.posted_at, p.post_url, p.metrics_json, p.external_id
    FROM content_posts p WHERE p.status = 'posted' AND p.posted_at IS NOT NULL AND p.posted_at >= ? ${pWhere}`, iso(Math.min(prevStart, now - 90 * D)), ...pArgs);
  const scored = posts.map((p) => {
    const m = parseJson<Record<string, any>>(p.metrics_json, {});
    const e = engagementOf(m);
    return { ...p, metrics_json: undefined, m, imp: e.imp, eng: e.eng, rate: e.rate, clicks: Number(m.clicks) || 0, leads: Number(m.leads) || 0, reach: Number(m.reach) || 0, t: Date.parse(p.posted_at) };
  });
  const inCur = scored.filter((p) => p.t >= start), inPrev = scored.filter((p) => p.t >= prevStart && p.t < start);

  // followers: last known value per platform at each boundary
  const fol = await all<{ platform: string; day: string; followers: number }>(env.DB,
    `SELECT platform, day, followers FROM social_accounts_daily WHERE followers IS NOT NULL ${pf ? 'AND platform = ?' : ''} ORDER BY day`, ...pArgs);
  const followersAt = (ms: number) => {
    const d = lagosDay(ms); const last: Record<string, number> = {};
    for (const r of fol) if (r.day <= d) last[r.platform] = r.followers;
    return Object.values(last).reduce((a, b) => a + b, 0);
  };
  const fNow = followersAt(now), fStart = followersAt(start), fPrev = followersAt(prevStart);
  const sum = (arr: any[], k: string) => arr.reduce((a, p) => a + (Number(p[k]) || 0), 0);
  const kp = (arr: any[]) => { const imp = sum(arr, 'imp'), eng = sum(arr, 'eng'); return { posts: arr.length, impressions: imp, engagements: eng, rate: imp ? eng / imp : 0, clicks: sum(arr, 'clicks'), leads: sum(arr, 'leads') }; };
  const cur = kp(inCur), prev = kp(inPrev);
  const kpis = { current: { ...cur, followers: fNow, follower_growth: fStart ? fNow - fStart : 0 }, previous: { ...prev, followers: fStart, follower_growth: fPrev ? fStart - fPrev : 0 } };

  // daily accrued impressions/engagements per platform from snapshot deltas
  const snaps = await all<any>(env.DB, `SELECT pm.post_id, p.platform, substr(datetime(pm.captured_at, '+1 hour'), 1, 10) AS d,
      MAX(COALESCE(pm.impressions, pm.views, pm.reach, 0)) AS imp, MAX(COALESCE(pm.likes,0)+COALESCE(pm.comments,0)+COALESCE(pm.shares,0)+COALESCE(pm.saves,0)) AS eng
    FROM post_metrics pm JOIN content_posts p ON p.id = pm.post_id WHERE pm.captured_at >= ? ${pWhere} GROUP BY pm.post_id, d ORDER BY pm.post_id, d`, iso(start), ...pArgs);
  const base = await all<any>(env.DB, `SELECT pm.post_id, MAX(COALESCE(pm.impressions, pm.views, pm.reach, 0)) AS imp,
      MAX(COALESCE(pm.likes,0)+COALESCE(pm.comments,0)+COALESCE(pm.shares,0)+COALESCE(pm.saves,0)) AS eng
    FROM post_metrics pm JOIN content_posts p ON p.id = pm.post_id WHERE pm.captured_at < ? ${pWhere} GROUP BY pm.post_id`, iso(start), ...pArgs);
  const baseBy = new Map(base.map((b) => [b.post_id, b]));
  const dayKeys: string[] = [];
  for (let t = start; t <= now + 1; t += D) dayKeys.push(lagosDay(t));
  const series: Record<string, Record<string, { imp: number; eng: number }>> = {};
  const add = (d: string, plat: string, imp: number, eng: number) => {
    if (d < dayKeys[0]) return;
    const s = ((series[plat] ??= {})[d] ??= { imp: 0, eng: 0 }); s.imp += imp; s.eng += eng;
  };
  const withSnaps = new Set<string>();
  let last: { id: string; imp: number; eng: number } | null = null;
  for (const s of snaps) {
    withSnaps.add(s.post_id);
    if (!last || last.id !== s.post_id) { const b = baseBy.get(s.post_id); last = { id: s.post_id, imp: b?.imp ?? 0, eng: b?.eng ?? 0 }; }
    add(s.d, s.platform, Math.max(0, s.imp - last.imp), Math.max(0, s.eng - last.eng));
    last.imp = Math.max(last.imp, s.imp); last.eng = Math.max(last.eng, s.eng);
  }
  for (const p of inCur) if (!withSnaps.has(p.id) && !baseBy.has(p.id)) add(dayOf(p.posted_at), p.platform, p.imp, p.eng); // numbers typed in before snapshots existed

  const followers: Record<string, { day: string; followers: number }[]> = {};
  for (const r of fol) if (r.day >= dayKeys[0]) (followers[r.platform] ??= []).push({ day: r.day, followers: r.followers });

  const group = (fn: (p: any) => string) => {
    const g: Record<string, { posts: number; imp: number; eng: number; rates: number[] }> = {};
    for (const p of inCur) { const k = fn(p); const x = (g[k] ??= { posts: 0, imp: 0, eng: 0, rates: [] }); x.posts++; x.imp += p.imp; x.eng += p.eng; if (p.imp) x.rates.push(p.rate); }
    return Object.entries(g).map(([name, x]) => ({ name, posts: x.posts, impressions: x.imp, engagements: x.eng, rate: x.imp ? x.eng / x.imp : 0, avg_eng: x.posts ? x.eng / x.posts : 0 }))
      .sort((a, b) => b.rate - a.rate);
  };

  // top posts + sparkline (cumulative engagements per day)
  const top = [...inCur].sort((a, b) => b.eng - a.eng || b.imp - a.imp).slice(0, 8);
  const sparkRows = top.length ? await all<any>(env.DB, `SELECT post_id, substr(datetime(captured_at, '+1 hour'), 1, 10) AS d, MAX(COALESCE(likes,0)+COALESCE(comments,0)+COALESCE(shares,0)+COALESCE(saves,0)) AS eng,
      MAX(COALESCE(impressions, views, reach, 0)) AS imp FROM post_metrics WHERE post_id IN (${top.map(() => '?').join(',')}) GROUP BY post_id, d ORDER BY d`, ...top.map((p) => p.id)) : [];

  // best time to post: Lagos weekday (Mon=0) × hour, over the last 90 days (or the period if longer)
  const heatFrom = now - Math.max(days, 90) * D;
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, rate: 0, eng: 0 })));
  for (const p of scored) {
    if (p.t < heatFrom || !p.imp) continue;
    const l = new Date(p.t + LAGOS); const dow = (l.getUTCDay() + 6) % 7; const c = heat[dow][l.getUTCHours()];
    c.rate = (c.rate * c.n + p.rate) / (c.n + 1); c.eng = (c.eng * c.n + p.eng) / (c.n + 1); c.n++;
  }

  return {
    days, platform: pf || null, from: iso(start), to: iso(now), dayKeys, kpis, series, followers,
    byFormat: group((p) => formatBucket(p.format)), byTheme: group((p) => themeBucket(p.theme)), byPlatform: group((p) => p.platform),
    top: top.map((p) => ({ id: p.id, platform: p.platform, title: p.title, format: p.format, posted_at: p.posted_at, post_url: p.post_url, impressions: p.imp, engagements: p.eng, rate: p.rate, leads: p.leads,
      spark: sparkRows.filter((r) => r.post_id === p.id).map((r) => ({ d: r.d, eng: r.eng, imp: r.imp })) })),
    heat, totals: { posted: inCur.length },
  };
}

export async function postSeries(env: Bindings, postId: string) {
  return all(env.DB, 'SELECT captured_at, impressions, reach, views, likes, comments, shares, saves, clicks, source FROM post_metrics WHERE post_id = ? ORDER BY captured_at', postId);
}
