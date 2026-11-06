import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../lib/env';
import { all, clamp, first } from '../lib/db';
import { requireUser, sha256 } from '../lib/auth';

/* ─────────────────────────────────────────────────────────────────────────────
   First-party, cookie-free website analytics.
   - Collector: POST /api/a/collect (public), batched events from public/assets/site.js.
   - Studio API: /api/studio/analytics/* (viewer and up).
   No cookies, no IP addresses stored. The IP is only hashed (with a daily salt) to
   rate-limit abuse, and that hash lives in memory / a short-lived KV key.
   ──────────────────────────────────────────────────────────────────────────── */

const DAY = 86_400;
const RETENTION_DAYS = 90;
const MAX_BODY = 24_000;
const MAX_EVENTS = 40;
const SKIP_PATH = /^\/(?:studio|api)(?:\/|$)|^\/(?:q|p|i|demos)\//;
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|facebookexternalhit|embedly|monitor|curl|wget|python|axios|node-fetch|go-http|java\//i;
const LANG_PREFIXES = ['yo', 'ig', 'ha', 'fr', 'de', 'es', 'zh'] as const;
const DEVICES = ['desktop', 'tablet', 'mobile'] as const;
type Device = (typeof DEVICES)[number];

const now = () => Math.floor(Date.now() / 1000);
const isDevice = (d: unknown): d is Device => typeof d === 'string' && (DEVICES as readonly string[]).includes(d);
const str = (v: unknown, max: number) => {
  const s = clamp(v, max).replace(/[\u0000-\u001f\u007f]/g, '');
  return s || null;
};
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

/** Normalises a page path: no query/hash, no trailing slash, bounded length. */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//')) return null;
  let p = v.split(/[?#]/)[0].replace(/\/{2,}/g, '/').slice(0, 200);
  try { p = decodeURI(p); } catch { /* keep as is */ }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (SKIP_PATH.test(p + '/')) return null;
  return p.replace(/[\u0000-\u001f\u007f<>"]/g, '') || '/';
}

const cleanHost = (v: unknown) => {
  const s = str(v, 120)?.toLowerCase().replace(/^www\./, '') ?? null;
  return s && /^[a-z0-9.-]+\.[a-z0-9-]{2,}$|^[a-z0-9-]+$/.test(s) ? s : null;
};

/* ── user agent → browser / OS / device ── */
export function parseUA(ua: string): { browser: string; os: string; device: Device } {
  let browser = 'Other';
  if (/Edg(?:e|A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/UCBrowser/.test(ua)) browser = 'UC Browser';
  else if (/FBAN|FBAV|Instagram|LinkedInApp|Twitter|WhatsApp/.test(ua)) browser = 'In-app';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS|Chromium/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  let os = 'Other';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let device: Device = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Opera Mini|IEMobile/.test(ua)) device = 'mobile';
  return { browser, os, device };
}

/* ── rate limit: in-isolate counter, escalated to a short KV block shared by all isolates ── */
const windows = new Map<string, { w: number; n: number }>();
const RL_PER_MIN = 120;
async function rateLimited(env: Bindings, ipHash: string) {
  const w = Math.floor(Date.now() / 60_000);
  const cur = windows.get(ipHash);
  const n = cur && cur.w === w ? cur.n + 1 : 1;
  windows.set(ipHash, { w, n });
  if (windows.size > 5000) for (const [k, v] of windows) if (v.w !== w) windows.delete(k);
  const key = `an:rl:${ipHash}`;
  if (n > RL_PER_MIN) {
    if (n === RL_PER_MIN + 1) await env.CACHE.put(key, '1', { expirationTtl: 120 });
    return true;
  }
  return (await env.CACHE.get(key)) !== null;
}

/* ═════════════════════════════ collector ═════════════════════════════ */
export const analyticsCollect = new Hono<AppEnv>();

type InEvent = Record<string, unknown>;

analyticsCollect.post('/collect', async (c) => {
  const done = () => c.body(null, 204, { 'cache-control': 'no-store' });
  const ua = c.req.header('user-agent') ?? '';
  if (!ua || BOT_UA.test(ua)) return done();
  if (c.req.header('dnt') === '1' || c.req.header('sec-gpc') === '1') return done();
  const len = Number(c.req.header('content-length') ?? 0);
  if (len > MAX_BODY) return c.body(null, 413);
  const raw = await c.req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return c.body(null, raw ? 413 : 400);

  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const ipHash = (await sha256(`${ip}|${new Date().toISOString().slice(0, 10)}|ferrn-an`)).slice(0, 20);
  if (await rateLimited(c.env, ipHash)) return c.body(null, 429);

  let body: { s?: unknown; v?: unknown; e?: unknown };
  try { body = JSON.parse(raw); } catch { return c.body(null, 400); }
  const sid = typeof body.s === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(body.s) ? body.s : null;
  const vid = typeof body.v === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(body.v) ? body.v : sid;
  if (!sid || !vid || !Array.isArray(body.e) || !body.e.length) return c.body(null, 400);

  const t = now();
  const events = (body.e as unknown[]).slice(0, MAX_EVENTS).filter((e): e is InEvent => !!e && typeof e === 'object');
  const rows: { type: string; path: string; ts: number; device: Device; x?: number | null; y?: number | null; target?: string | null; depth?: number | null }[] = [];
  let pv: InEvent | null = null, pvPath: string | null = null, lastPath: string | null = null;
  let pageviews = 0, clicks = 0, maxScroll = 0;

  for (const e of events) {
    const path = cleanPath(e.p);
    if (!path) continue;
    const ts = t - Math.round((num(e.a, 0, 600_000) ?? 0) / 1000);
    const device: Device = isDevice(e.d) ? e.d : 'desktop';
    lastPath = path;
    if (e.t === 'pv') {
      pageviews++;
      if (!pv) { pv = e; pvPath = path; }
      rows.push({ type: 'pageview', path, ts, device });
    } else if (e.t === 'c') {
      const x = num(e.x, 0, 1), y = num(e.y, 0, 1);
      if (x === null || y === null) continue;
      clicks++;
      rows.push({ type: 'click', path, ts, device, x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4, target: str(e.s, 60) });
    } else if (e.t === 's') {
      const depth = num(e.m, 0, 100);
      if (depth === null) continue;
      const d = Math.round(depth);
      maxScroll = Math.max(maxScroll, d);
      rows.push({ type: 'scroll', path, ts, device, depth: d });
    }
    // 'hb' (heartbeat) only refreshes last_seen below.
  }
  if (!lastPath) return done();

  const agent = parseUA(ua);
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  const round1 = (v: unknown) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null; };
  const utm = (pv?.u && typeof pv.u === 'object' ? pv.u : {}) as Record<string, unknown>;
  const clientDevice = isDevice(pv?.dt) ? pv!.dt as Device : null;
  const device: Device = agent.device !== 'desktop' ? agent.device : clientDevice ?? 'desktop';
  const w = num(pv?.w, 0, 10_000), h = num(pv?.h, 0, 10_000);
  const ownHost = new URL(c.req.url).hostname.replace(/^www\./, '');
  const ref = cleanHost(pv?.r);

  const db = c.env.DB;
  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO an_sessions (id, visitor_id, first_seen, last_seen, entry_path, current_path, referrer, utm_source, utm_medium, utm_campaign,
         country, region, city, lat, lon, timezone, device, browser, os, language, viewport, pageviews, clicks, max_scroll)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen), current_path = excluded.current_path,
         pageviews = pageviews + excluded.pageviews, clicks = clicks + excluded.clicks, max_scroll = MAX(max_scroll, excluded.max_scroll)`,
    ).bind(
      sid, vid, t, t, pvPath ?? lastPath, lastPath, ref && ref !== ownHost ? ref : null,
      str(utm.source, 80), str(utm.medium, 80), str(utm.campaign, 120),
      str(cf?.country, 2)?.toUpperCase() ?? null, str(cf?.region, 80), str(cf?.city, 80),
      round1(cf?.latitude), round1(cf?.longitude), str(cf?.timezone, 60),
      device, agent.browser, agent.os, str(pv?.l, 20), w && h ? `${Math.round(w)}x${Math.round(h)}` : null,
      pageviews, clicks, maxScroll,
    ),
  ];
  for (const r of rows) {
    stmts.push(db.prepare('INSERT INTO an_events (session_id, ts, type, path, device, x, y, target, depth) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(sid, r.ts, r.type, r.path, r.device, r.x ?? null, r.y ?? null, r.target ?? null, r.depth ?? null));
  }
  c.executionCtx.waitUntil(db.batch(stmts).then(() => undefined).catch((err) => console.warn('analytics write failed', err)));
  return done();
});

/** Daily retention job, called from the cron. Runs at most once a day (KV flag). */
export async function pruneAnalytics(env: Bindings) {
  const flag = `an:prune:${new Date().toISOString().slice(0, 10)}`;
  if (await env.CACHE.get(flag)) return;
  await env.CACHE.put(flag, '1', { expirationTtl: 2 * DAY });
  const cutoff = now() - RETENTION_DAYS * DAY;
  // Small chunks keep each statement well inside D1's limits.
  for (let i = 0; i < 40; i++) {
    const r = await env.DB.prepare('DELETE FROM an_events WHERE id IN (SELECT id FROM an_events WHERE ts < ? LIMIT 5000)').bind(cutoff).run();
    if (!r.meta.changes) break;
  }
  await env.DB.prepare('DELETE FROM an_sessions WHERE last_seen < ?').bind(cutoff).run();
}

/* ═════════════════════════════ Studio API ═════════════════════════════ */
export const analyticsStudio = new Hono<AppEnv>();
analyticsStudio.use('*', requireUser('viewer'));

const RANGES = { '24h': { span: DAY, bucket: 3600 }, '7d': { span: 7 * DAY, bucket: DAY }, '30d': { span: 30 * DAY, bucket: DAY }, '90d': { span: 90 * DAY, bucket: DAY } } as const;
type RangeKey = keyof typeof RANGES;

function window_(q: (k: string) => string | undefined) {
  const r = q('range');
  const key: RangeKey = r && Object.hasOwn(RANGES, r) ? (r as RangeKey) : '7d';
  const { span, bucket } = RANGES[key];
  // Local-time buckets: tz is the viewer's UTC offset in minutes (Lagos = 60).
  const off = Math.trunc(Math.round(num(q('tz'), -840, 840) ?? 60) * 60);
  const t = now();
  const nowK = Math.floor((t + off) / bucket);
  const n = Math.round(span / bucket);
  const startK = nowK - n + 1;
  const since = startK * bucket - off;
  return { key, span, bucket, off, t, nowK, startK, since, prev: since - (t - since) };
}

const LANG_SQL = `CASE ${LANG_PREFIXES.map((l) => `WHEN path = '/${l}' OR path LIKE '/${l}/%' THEN '${l}'`).join(' ')} ELSE 'en' END`;

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd\.in|whatsapp|wa\.me|tiktok|youtube|youtu\.be|pinterest|reddit|threads|snapchat|telegram)/;
const channelOf = (ref: string | null, hasUtm: number) => {
  if (hasUtm) return 'Campaigns';
  if (!ref) return 'Direct';
  if (SEARCH.test(ref + '.')) return 'Search';
  if (SOCIAL.test(ref)) return 'Social';
  return 'Referral';
};

async function kpis(db: D1Database, from: number, to: number) {
  const r = await first<{ sessions: number; visitors: number; pageviews: number; bounces: number; duration: number }>(db,
    `SELECT COUNT(*) sessions, COUNT(DISTINCT visitor_id) visitors, COALESCE(SUM(pageviews), 0) pageviews,
            COALESCE(SUM(CASE WHEN pageviews <= 1 THEN 1 ELSE 0 END), 0) bounces, COALESCE(AVG(MAX(0, last_seen - first_seen)), 0) duration
       FROM an_sessions WHERE first_seen >= ? AND first_seen < ?`, from, to);
  const s = r ?? { sessions: 0, visitors: 0, pageviews: 0, bounces: 0, duration: 0 };
  return { visitors: s.visitors, sessions: s.sessions, pageviews: s.pageviews,
    bounceRate: s.sessions ? Math.round((s.bounces / s.sessions) * 1000) / 10 : 0, avgDuration: Math.round(s.duration) };
}

analyticsStudio.get('/overview', async (c) => {
  const w = window_((k) => c.req.query(k));
  const db = c.env.DB;
  const [cur, prev, pvSeries, sSeries, pages, scrolls, refs, utm, countries, cities, devices, browsers, oses, langs, live] = await Promise.all([
    kpis(db, w.since, w.t + 1),
    kpis(db, w.prev, w.since),
    // Integers inlined on purpose: bound JS numbers arrive as REAL, which would turn this into float division.
    all<{ k: number; n: number }>(db, `SELECT (ts + ${w.off}) / ${w.bucket} k, COUNT(*) n FROM an_events WHERE type = 'pageview' AND ts >= ? GROUP BY k`, w.since),
    all<{ k: number; v: number; s: number }>(db, `SELECT (first_seen + ${w.off}) / ${w.bucket} k, COUNT(DISTINCT visitor_id) v, COUNT(*) s FROM an_sessions WHERE first_seen >= ? GROUP BY k`, w.since),
    all<{ path: string; views: number; visitors: number }>(db,
      `SELECT path, COUNT(*) views, COUNT(DISTINCT session_id) visitors FROM an_events WHERE type = 'pageview' AND ts >= ? GROUP BY path ORDER BY views DESC LIMIT 12`, w.since),
    all<{ path: string; depth: number }>(db,
      `SELECT path, AVG(d) depth FROM (SELECT path, session_id, MAX(depth) d FROM an_events WHERE type = 'scroll' AND ts >= ? GROUP BY path, session_id) GROUP BY path`, w.since),
    all<{ ref: string | null; utm: number; n: number }>(db,
      `SELECT referrer ref, (utm_source IS NOT NULL OR utm_campaign IS NOT NULL) utm, COUNT(*) n FROM an_sessions WHERE first_seen >= ? GROUP BY ref, utm ORDER BY n DESC LIMIT 400`, w.since),
    all(db, `SELECT utm_source source, utm_medium medium, utm_campaign campaign, COUNT(*) n, COUNT(DISTINCT visitor_id) visitors
               FROM an_sessions WHERE first_seen >= ? AND (utm_source IS NOT NULL OR utm_campaign IS NOT NULL)
              GROUP BY source, medium, campaign ORDER BY n DESC LIMIT 10`, w.since),
    all(db, `SELECT country, COUNT(*) n, COUNT(DISTINCT visitor_id) visitors FROM an_sessions WHERE first_seen >= ? GROUP BY country ORDER BY n DESC LIMIT 12`, w.since),
    all(db, `SELECT city, country, COUNT(*) n FROM an_sessions WHERE first_seen >= ? AND city IS NOT NULL GROUP BY city, country ORDER BY n DESC LIMIT 12`, w.since),
    all(db, `SELECT device label, COUNT(*) n FROM an_sessions WHERE first_seen >= ? GROUP BY device ORDER BY n DESC`, w.since),
    all(db, `SELECT browser label, COUNT(*) n FROM an_sessions WHERE first_seen >= ? GROUP BY browser ORDER BY n DESC LIMIT 8`, w.since),
    all(db, `SELECT os label, COUNT(*) n FROM an_sessions WHERE first_seen >= ? GROUP BY os ORDER BY n DESC LIMIT 8`, w.since),
    all(db, `SELECT ${LANG_SQL} label, COUNT(*) n FROM an_events WHERE type = 'pageview' AND ts >= ? GROUP BY label ORDER BY n DESC`, w.since),
    first<{ n: number }>(db, 'SELECT COUNT(*) n FROM an_sessions WHERE last_seen >= ?', w.t - 300),
  ]);

  const pvMap = new Map(pvSeries.map((r) => [r.k, r.n]));
  const sMap = new Map(sSeries.map((r) => [r.k, r]));
  const series = [];
  for (let k = w.startK; k <= w.nowK; k++) {
    series.push({ t: k * w.bucket - w.off, pageviews: pvMap.get(k) ?? 0, visitors: sMap.get(k)?.v ?? 0, sessions: sMap.get(k)?.s ?? 0 });
  }
  const depth = new Map(scrolls.map((s) => [s.path, Math.round(s.depth)]));
  const channels = new Map<string, number>();
  const referrers = new Map<string, number>();
  for (const r of refs) {
    const ch = channelOf(r.ref, r.utm);
    channels.set(ch, (channels.get(ch) ?? 0) + r.n);
    if (r.ref) referrers.set(r.ref, (referrers.get(r.ref) ?? 0) + r.n);
  }
  const sorted = (m: Map<string, number>, limit = 10) => [...m].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, n]) => ({ label, n }));

  c.header('cache-control', 'no-store');
  return c.json({
    range: w.key, bucket: w.bucket, kpis: cur, previous: prev, live: live?.n ?? 0, series,
    pages: pages.map((p) => ({ ...p, depth: depth.get(p.path) ?? null })),
    channels: sorted(channels), referrers: sorted(referrers), campaigns: utm,
    countries, cities, devices, browsers, os: oses, languages: langs,
  });
});

analyticsStudio.get('/live', async (c) => {
  const t = now();
  const db = c.env.DB;
  const [sessions, perMinute] = await Promise.all([
    all(db, `SELECT id, current_path path, entry_path, city, region, country, lat, lon, device, browser, os, referrer, pageviews, clicks,
                    first_seen, last_seen, MAX(0, ? - last_seen) seen_ago, MAX(0, last_seen - first_seen) duration
               FROM an_sessions WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 200`, t, t - 300),
    all<{ k: number; n: number }>(db, `SELECT ts / 60 k, COUNT(*) n FROM an_events WHERE type = 'pageview' AND ts >= ? GROUP BY k`, t - 30 * 60),
  ]);
  const m = new Map(perMinute.map((r) => [r.k, r.n]));
  const nowK = Math.floor(t / 60);
  const minutes = Array.from({ length: 30 }, (_, i) => { const k = nowK - 29 + i; return { t: k * 60, n: m.get(k) ?? 0 }; });
  c.header('cache-control', 'no-store');
  return c.json({ now: t, count: sessions.length, sessions, minutes });
});

analyticsStudio.get('/heatmap', async (c) => {
  const w = window_((k) => c.req.query(k));
  const db = c.env.DB;
  const device: Device = isDevice(c.req.query('device')) ? c.req.query('device') as Device : 'desktop';
  const pages = await all<{ path: string; views: number; clicks: number }>(db,
    `SELECT path, SUM(type = 'pageview') views, SUM(type = 'click') clicks FROM an_events
      WHERE ts >= ? AND type IN ('pageview', 'click') GROUP BY path ORDER BY views DESC LIMIT 60`, w.since);
  const path = cleanPath(c.req.query('path') ?? '') ?? pages[0]?.path ?? '/';
  const [points, targets, scroll, devices] = await Promise.all([
    all<{ x: number; y: number }>(db,
      `SELECT x, y FROM an_events WHERE path = ? AND type = 'click' AND device = ? AND ts >= ? ORDER BY ts DESC LIMIT 4000`, path, device, w.since),
    all(db, `SELECT target, COUNT(*) n FROM an_events WHERE path = ? AND type = 'click' AND device = ? AND ts >= ? AND target IS NOT NULL
              GROUP BY target ORDER BY n DESC LIMIT 10`, path, device, w.since),
    first<{ n: number; d25: number; d50: number; d75: number; d100: number; avg: number }>(db,
      `SELECT COUNT(*) n, COALESCE(SUM(d >= 25), 0) d25, COALESCE(SUM(d >= 50), 0) d50, COALESCE(SUM(d >= 75), 0) d75,
              COALESCE(SUM(d >= 98), 0) d100, COALESCE(AVG(d), 0) avg
         FROM (SELECT session_id, MAX(depth) d FROM an_events WHERE path = ? AND type = 'scroll' AND device = ? AND ts >= ? GROUP BY session_id)`,
      path, device, w.since),
    all<{ device: string; clicks: number }>(db,
      `SELECT device, COUNT(*) clicks FROM an_events WHERE path = ? AND type = 'click' AND ts >= ? GROUP BY device`, path, w.since),
  ]);
  const s = scroll ?? { n: 0, d25: 0, d50: 0, d75: 0, d100: 0, avg: 0 };
  const pct = (v: number) => (s.n ? Math.round((v / s.n) * 100) : 0);
  c.header('cache-control', 'no-store');
  return c.json({
    path, device, range: w.key, pages, devices,
    points: points.map((p) => [p.x, p.y]), targets,
    scroll: { sessions: s.n, avg: Math.round(s.avg), reach: [{ depth: 25, pct: pct(s.d25) }, { depth: 50, pct: pct(s.d50) }, { depth: 75, pct: pct(s.d75) }, { depth: 100, pct: pct(s.d100) }] },
  });
});

/** Every place visitors came from in the window: one pin per rounded location (lat/lon are stored at 0.1°). */
analyticsStudio.get('/places', async (c) => {
  const w = window_((k) => c.req.query(k));
  const t = now();
  const places = await all(c.env.DB,
    `SELECT lat, lon, city, region, country, COUNT(DISTINCT visitor_id) visitors, COUNT(*) sessions, COALESCE(SUM(pageviews), 0) pageviews,
            MAX(last_seen) last_seen, SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) live
       FROM an_sessions WHERE last_seen >= ? AND lat IS NOT NULL AND lon IS NOT NULL
      GROUP BY lat, lon ORDER BY visitors DESC LIMIT 3000`, t - 300, w.since);
  const unlocated = await first<{ n: number }>(c.env.DB,
    'SELECT COUNT(DISTINCT visitor_id) n FROM an_sessions WHERE last_seen >= ? AND (lat IS NULL OR lon IS NULL)', w.since);
  c.header('cache-control', 'no-store');
  return c.json({ now: t, range: w.key, places, unlocated: unlocated?.n ?? 0 });
});

/** One row per visitor (the anonymous id their browser keeps), newest first. */
analyticsStudio.get('/visitors', async (c) => {
  const w = window_((k) => c.req.query(k));
  const page = Math.max(1, Math.round(num(c.req.query('page'), 1, 100000) ?? 1));
  const size = Math.round(num(c.req.query('size'), 10, 100) ?? 25);
  const country = (c.req.query('country') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const kind = c.req.query('kind'); // returning | new | live
  const t = now();
  const where = ['s.last_seen >= ?']; const params: unknown[] = [w.since];
  if (country) { where.push('s.visitor_id IN (SELECT visitor_id FROM an_sessions WHERE country = ? AND last_seen >= ?)'); params.push(country, w.since); }
  const having: string[] = [];
  if (kind === 'returning') having.push('COUNT(*) > 1');
  if (kind === 'new') having.push('COUNT(*) = 1');
  if (kind === 'live') having.push(`MAX(s.last_seen) >= ${t - 300}`);
  const base = `FROM an_sessions s WHERE ${where.join(' AND ')} GROUP BY s.visitor_id ${having.length ? 'HAVING ' + having.join(' AND ') : ''}`;
  // SQLite: with a single MAX() aggregate, the bare columns come from the row holding the maximum, i.e. the latest session.
  const [rows, total, countries] = await Promise.all([
    all<Record<string, unknown>>(c.env.DB,
      `SELECT s.visitor_id vid, MAX(s.last_seen) last_seen, COUNT(*) sessions, COALESCE(SUM(s.pageviews), 0) pageviews,
              COALESCE(SUM(s.clicks), 0) clicks, COALESCE(SUM(MAX(0, s.last_seen - s.first_seen)), 0) time_on_site,
              s.city, s.region, s.country, s.lat, s.lon, s.device, s.browser, s.os, s.current_path, s.referrer, s.utm_source, s.utm_campaign
         ${base} ORDER BY last_seen DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, ...params),
    first<{ n: number }>(c.env.DB, `SELECT COUNT(*) n FROM (SELECT 1 ${base})`, ...params),
    all(c.env.DB, `SELECT country, COUNT(DISTINCT visitor_id) n FROM an_sessions WHERE last_seen >= ? AND country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 60`, w.since),
  ]);
  // Before the window too? Then they are returning visitors even with one session in it.
  const vids = rows.map((r) => String(r.vid));
  const before = vids.length
    ? await all<{ vid: string; n: number; first: number }>(c.env.DB,
      `SELECT visitor_id vid, COUNT(*) n, MIN(first_seen) first FROM an_sessions WHERE visitor_id IN (${vids.map(() => '?').join(',')}) GROUP BY visitor_id`, ...vids)
    : [];
  const all_ = new Map(before.map((b) => [b.vid, b]));
  c.header('cache-control', 'no-store');
  return c.json({
    now: t, page, size, total: total?.n ?? 0, countries,
    visitors: rows.map((r) => {
      const b = all_.get(String(r.vid));
      return { ...r, id: String(r.vid), vid: undefined, total_sessions: b?.n ?? r.sessions, first_ever: b?.first ?? null, live: Number(r.last_seen) >= t - 300 };
    }),
  });
});

/** Everything one visitor did: each session with its page journey. */
analyticsStudio.get('/visitors/:id', async (c) => {
  const vid = c.req.param('id').slice(0, 80);
  const sessions = await all<Record<string, unknown> & { id: string }>(c.env.DB,
    `SELECT id, first_seen, last_seen, MAX(0, last_seen - first_seen) duration, entry_path, current_path, referrer, utm_source, utm_medium, utm_campaign,
            city, region, country, lat, lon, device, browser, os, language, viewport, pageviews, clicks, max_scroll
       FROM an_sessions WHERE visitor_id = ? ORDER BY last_seen DESC LIMIT 100`, vid);
  const ids = sessions.map((s) => s.id);
  const steps = ids.length
    ? await all<{ session_id: string; path: string; ts: number }>(c.env.DB,
      `SELECT session_id, path, ts FROM an_events WHERE type = 'pageview' AND session_id IN (${ids.map(() => '?').join(',')}) ORDER BY ts, id LIMIT 3000`, ...ids)
    : [];
  const journeys = new Map<string, { path: string; ts: number }[]>();
  for (const s of steps) { const j = journeys.get(s.session_id) ?? []; if (j.length < 30) j.push({ path: s.path, ts: s.ts }); journeys.set(s.session_id, j); }
  c.header('cache-control', 'no-store');
  return c.json({ now: now(), sessions: sessions.map((s) => ({ ...s, returning: false, journey: journeys.get(s.id) ?? [] })) });
});

analyticsStudio.get('/sessions', async (c) => {
  const limit = Math.round(num(c.req.query('limit'), 1, 100) ?? 40);
  const page = Math.max(1, Math.round(num(c.req.query('page'), 1, 100000) ?? 1));
  const db = c.env.DB;
  const total = await first<{ n: number }>(db, 'SELECT COUNT(*) n FROM an_sessions');
  const sessions = await all<Record<string, unknown> & { id: string }>(db,
    `SELECT id, visitor_id, first_seen, last_seen, MAX(0, last_seen - first_seen) duration, entry_path, current_path, referrer, utm_source, utm_medium, utm_campaign,
            city, region, country, device, browser, os, language, viewport, pageviews, clicks, max_scroll,
            (SELECT COUNT(*) FROM an_sessions o WHERE o.visitor_id = s.visitor_id AND o.first_seen < s.first_seen) previous
       FROM an_sessions s ORDER BY last_seen DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`);
  const ids = sessions.map((s) => s.id);
  const steps = ids.length
    ? await all<{ session_id: string; path: string; ts: number }>(db,
      `SELECT session_id, path, ts FROM an_events WHERE type = 'pageview' AND session_id IN (${ids.map(() => '?').join(',')}) ORDER BY ts, id`, ...ids)
    : [];
  const journeys = new Map<string, { path: string; ts: number }[]>();
  for (const s of steps) {
    const j = journeys.get(s.session_id) ?? [];
    if (j.length < 30) j.push({ path: s.path, ts: s.ts });
    journeys.set(s.session_id, j);
  }
  c.header('cache-control', 'no-store');
  return c.json({ now: now(), page, size: limit, total: total?.n ?? 0, sessions: sessions.map(({ visitor_id: v, ...s }) => ({ ...s, visitor: v, returning: Number(s.previous) > 0, journey: journeys.get(s.id) ?? [] })) });
});
