import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ChevronsDown, CornerUpLeft, ExternalLink, Eye, Globe, Languages, MapPin, Minus, Monitor, MousePointerClick, RefreshCw, Route, Smartphone, Tablet, Timer, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { api } from '../api';
import { Badge, Card, Empty, ErrorNote, Loading, Page, Tabs, useData, useRoute } from '../ui';
import { AreaChart, BarList, ColumnChart, useWidth } from '../charts';

/* ── types ── */
type Range = '24h' | '7d' | '30d';
type DeviceKey = 'desktop' | 'tablet' | 'mobile';
type Kpis = { visitors: number; sessions: number; pageviews: number; bounceRate: number; avgDuration: number };
type Row = { label: string | null; n: number };
type Overview = {
  range: Range; bucket: number; kpis: Kpis; previous: Kpis; live: number;
  series: { t: number; visitors: number; pageviews: number; sessions: number }[];
  pages: { path: string; views: number; visitors: number; depth: number | null }[];
  channels: Row[]; referrers: Row[];
  campaigns: { source: string | null; medium: string | null; campaign: string | null; n: number; visitors: number }[];
  countries: { country: string | null; n: number; visitors: number }[];
  cities: { city: string; country: string | null; n: number }[];
  devices: Row[]; browsers: Row[]; os: Row[]; languages: Row[];
};
type LiveSession = {
  id: string; path: string; entry_path: string; city: string | null; region: string | null; country: string | null; lat: number | null; lon: number | null;
  device: DeviceKey; browser: string | null; os: string | null; referrer: string | null; pageviews: number; clicks: number; seen_ago: number; duration: number;
};
type Live = { now: number; count: number; sessions: LiveSession[]; minutes: { t: number; n: number }[] };
type Heat = {
  path: string; device: DeviceKey; pages: { path: string; views: number; clicks: number }[]; devices: { device: DeviceKey; clicks: number }[];
  points: [number, number][]; targets: { target: string; n: number }[];
  scroll: { sessions: number; avg: number; reach: { depth: number; pct: number }[] };
};
type SessionRow = {
  id: string; first_seen: number; last_seen: number; duration: number; entry_path: string; current_path: string; referrer: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; city: string | null; region: string | null; country: string | null;
  device: DeviceKey; browser: string | null; os: string | null; language: string | null; viewport: string | null; pageviews: number; clicks: number;
  max_scroll: number; returning: boolean; journey: { path: string; ts: number }[];
};

/* ── formatting ── */
const tz = () => -new Date().getTimezoneOffset();
const n0 = (v: number) => Math.round(v).toLocaleString();
export function dur(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}
const sinceText = (sec: number) => (sec < 10 ? 'now' : sec < 60 ? `${Math.round(sec)}s ago` : sec < 3600 ? `${Math.floor(sec / 60)}m ago` : sec < 86400 ? `${Math.floor(sec / 3600)}h ago` : `${Math.floor(sec / 86400)}d ago`);
let regionNames: Intl.DisplayNames | null = null;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser */ }
const countryName = (cc?: string | null) => {
  if (!cc || cc === 'XX' || cc === 'T1') return 'Unknown';
  try { return regionNames?.of(cc) ?? cc; } catch { return cc; }
};
const place = (s: { city?: string | null; country?: string | null }) => [s.city, s.country ? countryName(s.country) : null].filter(Boolean).join(', ') || 'Unknown location';
const LANG_NAMES: Record<string, string> = { en: 'English', yo: 'Yorùbá', ig: 'Igbo', ha: 'Hausa', fr: 'Français', de: 'Deutsch', es: 'Español', zh: '中文' };
const DEVICE_ICON: Record<string, React.ReactNode> = { desktop: <Monitor size={15} />, tablet: <Tablet size={15} />, mobile: <Smartphone size={15} /> };
const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '—');
const Cc = ({ cc }: { cc?: string | null }) => <span className="an-cc">{cc && cc.length === 2 ? cc : '··'}</span>;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function Seg<T extends string>({ value, options, onChange, small }: { value: T; options: [T, React.ReactNode][]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={`an-seg ${small ? 'sm' : ''}`} role="tablist">
      {options.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/* ═══════════════════════════ page ═══════════════════════════ */
export function Analytics() {
  const { path, go } = useRoute();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const tab = (['overview', 'live', 'heatmap', 'sessions'].includes(params.get('tab') || '') ? params.get('tab') : 'overview') as string;
  const [range, setRange] = useState<Range>(() => {
    try { return (localStorage.getItem('ferrn-an-range') as Range) || '7d'; } catch { return '7d'; }
  });
  const pickRange = (r: Range) => { setRange(r); try { localStorage.setItem('ferrn-an-range', r); } catch {} };
  const setTab = (t: string) => go(`/analytics${t === 'overview' ? '' : `?tab=${t}`}`);
  return (
    <Page
      title="Analytics"
      sub="First-party and cookie-free: who is on the website, where they come from and what they do."
      actions={tab === 'overview' || tab === 'heatmap'
        ? <Seg value={range} onChange={pickRange} options={[['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']]} />
        : null}
    >
      <Tabs tabs={[['overview', 'Overview'], ['live', 'Live'], ['heatmap', 'Heatmap'], ['sessions', 'Sessions']]} value={tab} onChange={setTab} />
      {tab === 'overview' ? <OverviewTab range={range} onLive={() => setTab('live')} /> : null}
      {tab === 'live' ? <LiveTab /> : null}
      {tab === 'heatmap' ? <HeatmapTab range={range} initialPath={params.get('path')} /> : null}
      {tab === 'sessions' ? <SessionsTab /> : null}
    </Page>
  );
}

/* ═══════════════════════════ overview ═══════════════════════════ */
function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev && !cur) return <span className="an-delta flat">—</span>;
  if (!prev) return <span className="an-delta up">new</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const good = invert ? pct <= 0 : pct >= 0;
  return <span className={`an-delta ${pct === 0 ? 'flat' : good ? 'up' : 'down'}`}>{pct > 0 ? <TrendingUp size={12} strokeWidth={2.4} /> : pct < 0 ? <TrendingDown size={12} strokeWidth={2.4} /> : <Minus size={12} />} {Math.abs(pct)}%</span>;
}

function OverviewTab({ range, onLive }: { range: Range; onLive: () => void }) {
  const { data, error } = useData(() => api<Overview>(`/analytics/overview?range=${range}&tz=${tz()}`), [range]);
  const [source, setSource] = useState<'channels' | 'referrers' | 'campaigns'>('channels');
  const [geo, setGeo] = useState<'countries' | 'cities'>('countries');
  const [tech, setTech] = useState<'devices' | 'browsers' | 'os'>('devices');
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const k = data.kpis, p = data.previous;
  const hourly = data.bucket === 3600;
  const fmtT = (t: number, long = false) => new Date(t * 1000).toLocaleString('en-GB', hourly
    ? { hour: '2-digit', minute: '2-digit', ...(long ? { weekday: 'short' as const } : {}) }
    : { day: 'numeric', month: 'short', ...(long ? { weekday: 'short' as const } : {}) });
  const label = { '24h': 'the last 24 hours', '7d': 'the last 7 days', '30d': 'the last 30 days' }[data.range];
  const hasData = k.sessions > 0;
  const tiles: [string, React.ReactNode, React.ReactNode, React.ReactNode][] = [
    ['Sessions', <Activity size={16} />, n0(k.sessions), <Delta cur={k.sessions} prev={p.sessions} />],
    ['Pageviews', <Eye size={16} />, n0(k.pageviews), <Delta cur={k.pageviews} prev={p.pageviews} />],
    ['Bounce rate', <CornerUpLeft size={16} />, `${k.bounceRate}%`, <Delta cur={k.bounceRate} prev={p.bounceRate} invert />],
    ['Avg. visit', <Timer size={16} />, dur(k.avgDuration), <Delta cur={k.avgDuration} prev={p.avgDuration} />],
  ];
  return (
    <>
      <div className="an-kpis">
        <div className="kpi feature an-kpi-main">
          <div className="kpi-icon"><Users size={24} strokeWidth={1.8} /></div>
          <div><h4>Unique visitors</h4><p className="muted">In {label}</p></div>
          <strong>{n0(k.visitors)} <Delta cur={k.visitors} prev={p.visitors} /></strong>
          <button className="kpi-foot an-live-foot" onClick={onLive}><span className="an-pulse" /> {data.live} online now <ArrowRight size={14} /></button>
        </div>
        {tiles.map(([t, icon, v, d]) => (
          <div key={t} className="kpi an-kpi"><h4><i>{icon}</i>{t}</h4><strong>{v}</strong>{d}</div>
        ))}
      </div>

      <Card title="Visitors over time" actions={
        <div className="an-legend"><span><i className="sw o" />Visitors</span><span><i className="sw dash" />Pageviews</span></div>
      }>
        {hasData ? (
          <AreaChart
            data={data.series}
            height={280}
            series={[{ key: 'visitors', label: 'Visitors', fill: true }, { key: 'pageviews', label: 'Pageviews', color: 'var(--muted)', dashed: true }]}
            xLabel={(r) => fmtT(r.t, true)}
            xTick={(r) => fmtT(r.t)}
          />
        ) : <Empty title="No visits recorded yet"><p className="muted small">Visits to the public website appear here within a few seconds. Studio, quotes and demos are never tracked.</p></Empty>}
      </Card>

      <div className="grid-2 an-grid">
        <Card title="Top pages" actions={<span className="muted small">Views · visitors · scroll</span>}>
          <BarList
            rows={data.pages.map((r) => ({ key: r.path, label: <a href={r.path} target="_blank" rel="noreferrer" className="an-path">{r.path}</a>, value: r.views }))}
            extra={(i) => <><span title="Unique sessions">{data.pages[i].visitors}</span><span className="an-scroll-chip" title="Average scroll depth">{data.pages[i].depth != null ? `${data.pages[i].depth}%` : '—'}</span></>}
            empty="No pageviews in this period."
          />
        </Card>
        <Card title="Traffic sources" actions={<Seg small value={source} onChange={setSource} options={[['channels', 'Channels'], ['referrers', 'Referrers'], ['campaigns', 'Campaigns']]} />}>
          {source === 'channels' ? <BarList rows={data.channels.map((r) => ({ label: r.label, value: r.n }))} empty="No sessions in this period." /> : null}
          {source === 'referrers' ? <BarList rows={data.referrers.map((r) => ({ label: <span className="an-ref"><img src={`https://icons.duckduckgo.com/ip3/${r.label}.ico`} alt="" width="14" height="14" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />{r.label}</span>, value: r.n }))} empty="No referring websites yet — visits so far are direct." /> : null}
          {source === 'campaigns' ? (data.campaigns.length ? (
            <table className="table an-table">
              <thead><tr><th>Campaign</th><th>Source / medium</th><th className="r">Sessions</th></tr></thead>
              <tbody>{data.campaigns.map((c, i) => (
                <tr key={i}><td>{c.campaign || <span className="muted">(none)</span>}</td><td className="muted">{c.source || '—'} / {c.medium || '—'}</td><td className="r">{c.n}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="muted small an-none">No UTM-tagged visits. Add <code>?utm_source=…&amp;utm_campaign=…</code> to links you share.</p>) : null}
        </Card>
      </div>

      <div className="an-grid3">
        <Card title={<span className="an-h"><Globe size={15} /> Locations</span>} actions={<Seg small value={geo} onChange={setGeo} options={[['countries', 'Countries'], ['cities', 'Cities']]} />}>
          {geo === 'countries'
            ? <BarList rows={data.countries.map((r) => ({ label: <><Cc cc={r.country} />{countryName(r.country)}</>, value: r.n }))} />
            : <BarList rows={data.cities.map((r) => ({ label: <><Cc cc={r.country} />{r.city}</>, value: r.n }))} empty="City data appears once visits arrive through Cloudflare." />}
        </Card>
        <Card title={<span className="an-h"><Monitor size={15} /> Technology</span>} actions={<Seg small value={tech} onChange={setTech} options={[['devices', 'Devices'], ['browsers', 'Browsers'], ['os', 'OS']]} />}>
          <BarList rows={(data[tech] as Row[]).map((r) => ({ label: tech === 'devices' ? <span className="an-ref">{DEVICE_ICON[r.label ?? ''] ?? null}{cap(r.label)}</span> : r.label || 'Other', value: r.n }))} />
        </Card>
        <Card title={<span className="an-h"><Languages size={15} /> Site language</span>} actions={<span className="muted small">Pageviews</span>}>
          <BarList rows={data.languages.map((r) => ({ label: <><span className="an-cc">{(r.label ?? 'en').toUpperCase()}</span>{LANG_NAMES[r.label ?? 'en'] ?? r.label}</>, value: r.n }))} />
        </Card>
      </div>
    </>
  );
}

/* ═══════════════════════════ live ═══════════════════════════ */
function LiveTab() {
  const { data, error, reload } = useData(() => api<Live>('/analytics/live'));
  const [tick, setTick] = useState(10);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => { if (v <= 1) { reload(); return 10; } return v - 1; }), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const pages = new Map<string, number>();
  data.sessions.forEach((s) => pages.set(s.path, (pages.get(s.path) ?? 0) + 1));
  const top = [...pages].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <>
      <div className="an-live-top">
        <Card className="an-live-count">
          <div className="an-live-num">
            <span className={`an-pulse big ${data.count ? '' : 'idle'}`} />
            <strong>{data.count}</strong>
          </div>
          <p>{data.count === 1 ? 'visitor' : 'visitors'} on the website right now</p>
          <span className="muted small">Active in the last 5 minutes · refreshing in {tick}s <button className="link" onClick={() => { reload(); setTick(10); }} aria-label="Refresh now"><RefreshCw size={12} /></button></span>
          {top.length ? (
            <div className="an-live-pages">{top.map(([p, n]) => <span key={p}><b>{n}</b> {p}</span>)}</div>
          ) : null}
        </Card>
        <Card title="Pageviews, last 30 minutes" className="an-live-chart">
          <ColumnChart
            height={150}
            showValues={false}
            data={data.minutes.map((m) => ({ label: new Date(m.t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), value: m.n }))}
            tip={(d) => `${d.label} · ${d.value} ${d.value === 1 ? 'pageview' : 'pageviews'}`}
          />
        </Card>
      </div>

      <Card title={<span className="an-h"><MapPin size={15} /> Where visitors are now</span>} actions={<span className="muted small">Approximate city, from the network</span>}>
        <LiveMap sessions={data.sessions} />
      </Card>

      <Card title="Active sessions">
        {data.sessions.length ? (
          <div className="table-wrap flat">
            <table className="table an-table">
              <thead><tr><th>Current page</th><th>Location</th><th>Device</th><th>Source</th><th className="r">Pages</th><th className="r">On site</th><th className="r">Last seen</th></tr></thead>
              <tbody>{data.sessions.map((s) => (
                <tr key={s.id}>
                  <td><a className="an-path" href={s.path} target="_blank" rel="noreferrer">{s.path}</a>{s.entry_path !== s.path ? <div className="muted small">entered on {s.entry_path}</div> : null}</td>
                  <td><Cc cc={s.country} />{place(s)}</td>
                  <td><span className="an-ref">{DEVICE_ICON[s.device]}{s.browser} · {s.os}</span></td>
                  <td className="muted">{s.referrer || 'Direct'}</td>
                  <td className="r">{s.pageviews}</td>
                  <td className="r">{dur(s.duration)}</td>
                  <td className="r"><span className={`an-seen ${s.seen_ago < 45 ? 'fresh' : ''}`}>{sinceText(s.seen_ago)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="Nobody on the site right now"><p className="muted small">This view refreshes every 10 seconds.</p></Empty>}
      </Card>
    </>
  );
}

/* Leaflet is loaded on demand from unpkg; tiles from CARTO (dark or light to match the Studio theme). */
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = '';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; s.crossOrigin = '';
    s.onload = () => resolve((window as any).L);
    s.onerror = () => { leafletPromise = null; reject(new Error('Map library failed to load')); };
    document.head.appendChild(s);
  });
  return leafletPromise;
}
const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function LiveMap({ sessions }: { sessions: LiveSession[] }) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L?: any; map?: any; tiles?: any; layer?: any; grid?: any; fitted?: boolean; theme?: string }>({});
  const [err, setErr] = useState('');
  const [tileFail, setTileFail] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const setTiles = () => {
      const { map } = st.current;
      const L = st.current.L;
      if (!L || !map) return;
      const theme = themeNow();
      if (st.current.theme === theme && st.current.tiles) return;
      st.current.tiles?.remove();
      st.current.theme = theme;
      st.current.tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${theme === 'light' ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, {
        subdomains: 'abcd', maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      el.current?.setAttribute('data-map-theme', theme);
      // If the basemap can't load (offline, blocked), keep the dots readable on a light graticule.
      st.current.tiles.once('tileerror', () => {
        if (!alive || !st.current.map || st.current.grid) return;
        const lines: [number, number][][] = [];
        for (let lat = -60; lat <= 75; lat += 15) lines.push([[lat, -180], [lat, 180]]);
        for (let lon = -180; lon <= 180; lon += 15) lines.push([[-60, lon], [80, lon]]);
        st.current.grid = L.polyline(lines, { color: themeNow() === 'light' ? '#000' : '#fff', opacity: 0.12, weight: 1, dashArray: '2 5', interactive: false }).addTo(st.current.map);
        setTileFail(true);
      });
    };
    loadLeaflet().then((L) => {
      if (!alive || !el.current) return;
      const map = L.map(el.current, { worldCopyJump: true, minZoom: 1, zoomSnap: 0.5, scrollWheelZoom: false }).setView([18, 12], 2);
      st.current = { L, map, layer: L.layerGroup().addTo(map) };
      setTiles();
      setReady(true);
    }).catch((e) => alive && setErr(e.message));
    const mo = new MutationObserver(setTiles);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { alive = false; mo.disconnect(); st.current.map?.remove(); st.current = {}; };
  }, []);

  useEffect(() => {
    const { L, map, layer } = st.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const groups = new Map<string, LiveSession[]>();
    for (const s of sessions) {
      if (s.lat == null || s.lon == null) continue;
      const key = `${s.lat},${s.lon}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const pts: [number, number][] = [];
    for (const g of groups.values()) {
      const s = g[0];
      const n = g.length;
      const size = Math.min(34, 14 + Math.sqrt(n) * 5);
      const icon = L.divIcon({ className: 'an-pin', iconSize: [size, size], html: `<span class="an-pin-ring"></span><span class="an-pin-dot">${n > 1 ? n : ''}</span>` });
      const pages = [...new Set(g.map((x) => x.path))].slice(0, 3).map(esc).join(', ');
      L.marker([s.lat, s.lon], { icon, riseOnHover: true })
        .bindTooltip(`<strong>${esc(place(s))}</strong><br>${n} ${n === 1 ? 'visitor' : 'visitors'} · ${pages}`, { direction: 'top', offset: [0, -size / 2], className: 'an-tip' })
        .addTo(layer);
      pts.push([s.lat!, s.lon!]);
    }
    if (pts.length && !st.current.fitted) {
      st.current.fitted = true;
      if (pts.length === 1) map.setView(pts[0], 4);
      else map.fitBounds(pts, { padding: [60, 60], maxZoom: 5 });
    }
  }, [sessions, ready]);

  return (
    <div className="an-map-wrap">
      <div ref={el} className="an-map" />
      {err ? <div className="an-map-msg">{err}. Check your connection and reload.</div> : null}
      {ready && !sessions.some((s) => s.lat != null) ? <div className="an-map-msg soft">No located visitors right now</div> : null}
      {tileFail ? <div className="an-map-note">Basemap unavailable on this network: showing positions only</div> : null}
    </div>
  );
}

/* ═══════════════════════════ heatmap ═══════════════════════════ */
const DEVICE_W: Record<DeviceKey, number> = { desktop: 1280, tablet: 820, mobile: 390 };
const DEVICE_VH: Record<DeviceKey, number> = { desktop: 800, tablet: 1180, mobile: 844 };

/** 256-step colour ramp: transparent blue → cyan → green → yellow → red. */
let lut: Uint8ClampedArray | null = null;
function palette() {
  if (lut) return lut;
  const c = document.createElement('canvas'); c.width = 256; c.height = 1;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#2b4cff'); g.addColorStop(0.3, '#00d9ff'); g.addColorStop(0.5, '#38ff6a'); g.addColorStop(0.72, '#ffe500'); g.addColorStop(0.88, '#ff7a00'); g.addColorStop(1, '#ff1a00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 1);
  lut = ctx.getImageData(0, 0, 256, 1).data;
  return lut;
}

function drawHeat(canvas: HTMLCanvasElement, points: [number, number][], w: number, h: number) {
  // Long pages are drawn at reduced resolution and stretched; the blur hides it.
  const k = Math.min(1, Math.sqrt(6_000_000 / (w * h)));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, cw, ch);
  if (!points.length) return;
  const r = Math.round((w < 600 ? 26 : w < 1000 ? 32 : 38) * k);
  const stamp = document.createElement('canvas'); stamp.width = stamp.height = r * 2;
  const sc = stamp.getContext('2d')!;
  const g = sc.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  sc.fillStyle = g; sc.fillRect(0, 0, r * 2, r * 2);
  ctx.globalAlpha = points.length > 400 ? 0.06 : points.length > 60 ? 0.12 : 0.22;
  for (const [x, y] of points) ctx.drawImage(stamp, x * cw - r, y * ch - r);
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data;
  let max = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i];
  if (!max) return;
  const pal = palette();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    // Square-root scale: single clicks still read clearly, clusters run hot.
    const v = Math.sqrt(a / max);
    const j = Math.min(255, Math.round(v * 255)) * 4;
    d[i] = pal[j]; d[i + 1] = pal[j + 1]; d[i + 2] = pal[j + 2];
    d[i + 3] = Math.round(Math.min(1, 0.3 + v) * 225 * Math.min(1, v * 3.5));
  }
  ctx.putImageData(img, 0, 0);
}

function HeatmapTab({ range, initialPath }: { range: Range; initialPath: string | null }) {
  const [device, setDevice] = useState<DeviceKey>('desktop');
  const [path, setPath] = useState<string>(initialPath || '');
  const [showHeat, setShowHeat] = useState(true);
  const { data, error, loading } = useData(() => api<Heat>(`/analytics/heatmap?range=${range}&device=${device}&tz=${tz()}${path ? `&path=${encodeURIComponent(path)}` : ''}`), [range, device, path]);
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const clicksBy = (d: DeviceKey) => data.devices.find((x) => x.device === d)?.clicks ?? 0;
  const pages = data.pages.some((p) => p.path === data.path) ? data.pages : [{ path: data.path, views: 0, clicks: 0 }, ...data.pages];
  return (
    <>
      <div className="an-hm-bar card">
        <label className="an-hm-page">
          <span>Page</span>
          <select value={data.path} onChange={(e) => setPath(e.target.value)}>
            {pages.map((p) => <option key={p.path} value={p.path}>{p.path} · {p.views} views · {p.clicks} clicks</option>)}
          </select>
        </label>
        <Seg value={device} onChange={setDevice} options={(['desktop', 'tablet', 'mobile'] as DeviceKey[]).map((d) => [d, <span className="an-ref">{DEVICE_ICON[d]}{cap(d)} <small>{clicksBy(d)}</small></span>])} />
        <label className="an-toggle"><input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> Heatmap</label>
        <a className="btn sm ghost" href={data.path} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open page</a>
        {loading ? <span className="muted small">Updating…</span> : null}
      </div>
      <div className="an-hm">
        <Card className="an-hm-view">
          <PageHeat key={`${data.path}|${device}`} path={data.path} device={device} points={data.points} reach={data.scroll.reach} show={showHeat} />
        </Card>
        <div className="an-hm-side">
          <div className="an-mini">
            <div><MousePointerClick size={16} /><strong>{data.points.length.toLocaleString()}</strong><span>clicks</span></div>
            <div><Users size={16} /><strong>{data.scroll.sessions}</strong><span>sessions</span></div>
            <div><ChevronsDown size={16} /><strong>{data.scroll.avg}%</strong><span>avg. scroll</span></div>
          </div>
          <Card title="Scroll depth" actions={<span className="muted small">Share of sessions</span>}>
            {data.scroll.sessions ? (
              <ColumnChart height={170} format={(v) => `${v}%`} data={data.scroll.reach.map((r) => ({ label: r.depth === 100 ? 'Bottom' : `${r.depth}%`, value: r.pct }))}
                tip={(d) => `${d.value}% reached ${d.label === 'Bottom' ? 'the bottom' : d.label}`} />
            ) : <Empty title="No scroll data yet" />}
          </Card>
          <Card title="Most clicked">
            <BarList rows={data.targets.map((t) => ({ label: <code className="an-target">{t.target}</code>, value: t.n, title: t.target }))} empty="No clicks recorded on this page and device." />
          </Card>
          <div className="an-ramp"><span>Fewer clicks</span><i /><span>More</span></div>
        </div>
      </div>
    </>
  );
}

function PageHeat({ path, device, points, reach, show }: { path: string; device: DeviceKey; points: [number, number][]; reach: Heat['scroll']['reach']; show: boolean }) {
  const [box, boxW] = useWidth<HTMLDivElement>(900);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const w = DEVICE_W[device];
  const [docH, setDocH] = useState(DEVICE_VH[device]);
  const [loaded, setLoaded] = useState(false);
  const scale = Math.min(1, (boxW - 2) / w);
  const src = useMemo(() => {
    try { sessionStorage.setItem('ferrn-intro', '1'); } catch { /* skip the intro animation inside the frame */ }
    return `${path}${path.includes('?') ? '&' : '?'}__noTrack=1`;
  }, [path]);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const style = doc.createElement('style');
    style.textContent = '.reveal{opacity:1!important;transform:none!important;transition:none!important}.intro,[data-chat]{display:none!important}html{scroll-behavior:auto!important}';
    doc.head.appendChild(style);
    doc.documentElement.classList.remove('play-intro');
    const measure = () => {
      const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      if (h > 0) setDocH((cur) => (Math.abs(cur - h) > 2 ? h : cur));
    };
    measure();
    setLoaded(true);
    [300, 900, 2000].forEach((t) => setTimeout(measure, t));
  };

  useEffect(() => {
    if (canvas.current) drawHeat(canvas.current, show ? points : [], w, docH);
  }, [points, w, docH, show]);

  return (
    <div className="an-frame-box" ref={box}>
      <div className="an-frame-sizer" style={{ width: w * scale, height: docH * scale }}>
        <div className="an-frame-inner" style={{ width: w, height: docH, transform: `scale(${scale})` }}>
          <iframe ref={frame} src={src} title={`Heatmap of ${path}`} width={w} height={docH} onLoad={onLoad} scrolling="no" tabIndex={-1} />
          {show && points.length ? <div className="an-dim" /> : null}
          <canvas ref={canvas} className="an-heat" style={{ width: w, height: docH }} />
          {loaded && show ? reach.filter((r) => r.depth < 100).map((r) => (
            <div key={r.depth} className="an-fold" style={{ top: (r.depth / 100) * docH }}>
              <span style={{ transform: `scale(${1 / scale})` }}>{r.pct}% of sessions scrolled this far</span>
            </div>
          )) : null}
        </div>
        {!loaded ? <div className="an-frame-loading"><Loading /></div> : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════ sessions ═══════════════════════════ */
function SessionsTab() {
  const { data, error, reload } = useData(() => api<{ now: number; sessions: SessionRow[] }>('/analytics/sessions?limit=50'));
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  if (!data.sessions.length) return <Card><Empty title="No sessions yet"><p className="muted small">Each visit to the public site becomes a session with its page journey.</p></Empty></Card>;
  return (
    <Card title={<span className="an-h"><Route size={15} /> Recent visits</span>} actions={<button className="btn sm ghost" onClick={reload}><RefreshCw size={14} /> Refresh</button>}>
      <ol className="an-sessions">
        {data.sessions.map((s) => {
          const live = data.now - s.last_seen < 300;
          const src = s.utm_campaign || s.utm_source ? `${s.utm_source ?? ''}${s.utm_campaign ? ` · ${s.utm_campaign}` : ''}` : s.referrer || 'Direct';
          return (
            <li key={s.id} className="an-sess">
              <div className="an-sess-icon">{DEVICE_ICON[s.device]}</div>
              <div className="an-sess-main">
                <div className="an-sess-head">
                  <strong><Cc cc={s.country} />{place(s)}</strong>
                  {live ? <Badge tone="green">Live</Badge> : null}
                  {s.returning ? <Badge tone="purple">Returning</Badge> : <Badge>New</Badge>}
                  <span className="muted small">{s.browser} · {s.os}{s.viewport ? ` · ${s.viewport}` : ''} · from {src}</span>
                </div>
                <div className="an-journey">
                  {s.journey.length ? s.journey.map((j, i) => (
                    <React.Fragment key={i}>
                      {i ? <span className="an-arrow"><ArrowRight size={12} /><small>{dur(j.ts - s.journey[i - 1].ts)}</small></span> : null}
                      <span className="an-step">{j.path}</span>
                    </React.Fragment>
                  )) : <span className="an-step">{s.entry_path}</span>}
                </div>
              </div>
              <div className="an-sess-stats">
                <span title="Time on site"><Timer size={13} />{dur(s.duration)}</span>
                <span title="Pages"><Eye size={13} />{s.pageviews}</span>
                <span title="Clicks"><MousePointerClick size={13} />{s.clicks}</span>
                <span title="Deepest scroll"><ChevronsDown size={13} />{s.max_scroll}%</span>
                <span className="muted small">{sinceText(data.now - s.last_seen)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
