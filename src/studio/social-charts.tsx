/**
 * Hand-written SVG charts for the social results dashboard (no chart library).
 * Platform colours are fixed per entity (never by rank) and use the validated categorical slots 1–3
 * (blue / orange / aqua), stepped separately for dark and light surfaces. Lines also carry a dash
 * pattern and a direct end label, so identity never relies on colour alone.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export const PLATFORM_META: Record<string, { name: string; color: string; dash?: string }> = {
  x: { name: 'X', color: 'var(--s-x)' },
  instagram: { name: 'Instagram', color: 'var(--s-ig)', dash: '6 3' },
  tiktok: { name: 'TikTok', color: 'var(--s-tt)', dash: '2 3' },
  linkedin: { name: 'LinkedIn', color: 'var(--s-li)', dash: '8 3 2 3' },
};

export const fmtNum = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 || n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
};
export const fmtPct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};
const shortDay = (d: string) => { const x = new Date(d + 'T12:00:00Z'); return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };

/** Scoped styles (kept here so the shared studio.css stays untouched). */
export function SocialStyles() {
  return <style>{`
.sx { --s-x:#3987e5; --s-ig:#d95926; --s-tt:#199e70; --s-li:#9085e9; --s-grid:rgba(255,255,255,.07); --s-axis:var(--faint); --s-heat:255,65,0; }
[data-theme="light"] .sx { --s-x:#2a78d6; --s-ig:#eb6834; --s-tt:#1baf7a; --s-li:#6250d6; --s-grid:rgba(0,0,0,.07); }
.sx-kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:18px; }
.sx-kpi { background:var(--panel); border:1px solid var(--line); border-radius:var(--r); padding:14px 16px; display:grid; gap:2px; min-width:0; }
.sx-kpi h4 { margin:0; font-size:12.5px; color:var(--muted); font-weight:500; display:flex; gap:6px; align-items:center; }
.sx-kpi strong { font-size:26px; font-weight:600; letter-spacing:-.02em; line-height:1.2; }
.sx-delta { font-size:12px; display:inline-flex; gap:4px; align-items:center; color:var(--muted); }
.sx-delta.up { color:var(--green); } .sx-delta.down { color:var(--red); }
.sx-chart { position:relative; }
.sx-chart svg { display:block; width:100%; height:auto; overflow:visible; }
.sx-chart text { font-family:var(--font); font-size:11px; fill:var(--muted); }
.sx-chart .lbl { fill:var(--ink); font-weight:500; }
.sx-tip { position:absolute; pointer-events:none; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12px; box-shadow:0 10px 30px rgba(0,0,0,.35); z-index:5; min-width:130px; transform:translate(-50%, calc(-100% - 10px)); white-space:nowrap; }
.sx-tip .h { color:var(--muted); margin-bottom:4px; }
.sx-tip .r { display:flex; align-items:center; gap:8px; } .sx-tip .r b { font-weight:600; color:var(--ink); } .sx-tip .r span { color:var(--muted); }
.sx-tip i { width:12px; height:0; border-top:2px solid; display:inline-block; }
.sx-legend { display:flex; gap:6px; flex-wrap:wrap; }
.sx-legend button { display:inline-flex; gap:6px; align-items:center; border:1px solid var(--line); background:transparent; border-radius:999px; padding:4px 10px; font-size:12px; color:var(--ink); }
.sx-legend button.off { opacity:.45; } .sx-legend button i { width:14px; height:0; border-top:2px solid; display:inline-block; }
.sx-bars { display:grid; gap:10px; }
.sx-bar { display:grid; grid-template-columns:minmax(90px,140px) 1fr auto; gap:10px; align-items:center; font-size:13px; position:relative; }
.sx-bar .track { height:12px; background:var(--panel2); border-radius:4px; overflow:hidden; }
.sx-bar .fill { height:100%; border-radius:0 4px 4px 0; background:var(--o); }
.sx-bar .v { text-align:right; font-variant-numeric:tabular-nums; } .sx-bar .v small { color:var(--muted); margin-left:6px; }
.sx-bar:hover .fill { filter:brightness(1.15); }
.sx-heat { display:grid; grid-template-columns:34px repeat(24,1fr); gap:2px; font-size:10.5px; color:var(--muted); }
.sx-heat .c { aspect-ratio:1.4; border-radius:3px; background:var(--panel2); position:relative; }
.sx-heat .c:hover, .sx-heat .c:focus { outline:1.5px solid var(--ink); outline-offset:0; }
.sx-heat .hh { text-align:center; } .sx-heat .dl { align-self:center; }
.sx-ramp { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--muted); margin-top:10px; }
.sx-ramp span { width:90px; height:8px; border-radius:4px; background:linear-gradient(90deg, rgba(var(--s-heat),.12), rgba(var(--s-heat),1)); }
.sx-top { width:100%; border-collapse:collapse; } .sx-top td, .sx-top th { padding:9px 8px 9px 0; border-bottom:1px solid var(--line); text-align:left; font-size:13px; vertical-align:middle; }
.sx-top th { color:var(--muted); font-weight:500; font-size:12px; } .sx-top td.n { font-variant-numeric:tabular-nums; text-align:right; } .sx-top th.n { text-align:right; }
.sx-top tr:last-child td { border-bottom:0; }
.sx-conn { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.sx-conn > div { border:1px solid var(--line); border-radius:var(--rs); padding:14px; display:grid; gap:8px; align-content:start; background:var(--panel2); }
.sx-conn h5 { margin:0; font-size:15px; display:flex; align-items:center; gap:8px; justify-content:space-between; }
.sx-conn ul { margin:0; padding-left:18px; color:var(--muted); font-size:12px; } .sx-conn code { font-size:11px; }
.sx-state { display:inline-flex; gap:6px; align-items:center; font-size:12px; padding:3px 10px; border-radius:999px; border:1px solid var(--line); }
.sx-state.ok { color:var(--green); border-color:rgba(34,197,94,.35); } .sx-state.warn { color:var(--amber); border-color:rgba(245,158,11,.35); } .sx-state.bad { color:var(--red); border-color:rgba(239,68,68,.35); }
.sx-filters { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }
.sx-filters .tabs { margin:0; }
.sx-media { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-top:12px; }
.sx-media figure { margin:0; position:relative; border:1px solid var(--line); border-radius:12px; padding:6px; background:var(--panel2); }
.sx-media img, .sx-media video { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; display:block; background:#000; }
.sx-media figcaption { font-size:11px; color:var(--muted); display:flex; justify-content:space-between; gap:6px; margin-top:4px; }
.sx-media .icon { position:absolute; top:10px; right:10px; background:var(--panel); width:28px; height:28px; }
.sx-autopost { display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:12px 14px; border:1px solid var(--line); border-radius:var(--rs); background:var(--panel2); margin:12px 0; }
.sx-autopost .grow { flex:1; min-width:200px; font-size:12.5px; }
.sx-switch { display:inline-flex; gap:8px; align-items:center; cursor:pointer; font-weight:500; }
.sx-switch input { appearance:none; width:38px; height:22px; border-radius:999px; background:var(--panel); border:1px solid var(--line); position:relative; padding:0; transition:.2s; cursor:pointer; }
.sx-switch input::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:var(--muted); transition:.2s; }
.sx-switch input:checked { background:var(--o); border-color:var(--o); } .sx-switch input:checked::after { left:18px; background:#fff; }
.sx-note { font-size:12.5px; padding:10px 12px; border-radius:10px; border:1px solid var(--line); display:flex; gap:8px; align-items:flex-start; margin:8px 0; }
.sx-note.warn { border-color:rgba(245,158,11,.35); background:rgba(245,158,11,.07); } .sx-note.bad { border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.07); } .sx-note.ok { border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.07); }
.sx-note svg { flex:none; margin-top:1px; }
.cal-post .sx-flag { margin-left:auto; flex:none; display:inline-flex; }
@media (max-width:1100px) { .sx-kpis { grid-template-columns:repeat(3,1fr); } .sx-conn { grid-template-columns:1fr; } }
@media (max-width:640px) { .sx-kpis { grid-template-columns:1fr 1fr; } .sx-heat { font-size:9px; } }
`}</style>;
}

/* ── KPI tile with change vs previous period ── */
export function KpiTile({ label, value, prev, format = fmtNum, icon, hint, invert }: {
  label: string; value: number; prev?: number | null; format?: (n: number) => string; icon?: React.ReactNode; hint?: string; invert?: boolean;
}) {
  let delta: React.ReactNode = <span className="sx-delta">no earlier data</span>;
  if (prev != null && prev !== 0) {
    const ch = (value - prev) / Math.abs(prev);
    const up = ch > 0.005, down = ch < -0.005;
    const good = invert ? down : up, bad = invert ? up : down;
    delta = <span className={`sx-delta ${good ? 'up' : bad ? 'down' : ''}`}>{up ? <TrendingUp size={14} /> : down ? <TrendingDown size={14} /> : <Minus size={14} />}{up ? '+' : ''}{(ch * 100).toFixed(0)}% vs previous</span>;
  } else if (prev === 0 && value > 0) delta = <span className="sx-delta up"><TrendingUp size={14} />new this period</span>;
  return <div className="sx-kpi" title={hint}><h4>{icon}{label}</h4><strong>{format(value)}</strong>{delta}</div>;
}

/* ── multi-series line chart with crosshair tooltip ── */
export type LineSeries = { key: string; name: string; color: string; dash?: string; values: number[] };
export function LineChart({ labels, series, height = 220, format = fmtNum, labelFmt = shortDay, area }: {
  labels: string[]; series: LineSeries[]; height?: number; format?: (n: number) => string; labelFmt?: (s: string) => string; area?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => { // draw at the real pixel width so text stays 11px in narrow cards
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = height, L = 44, R = W < 420 ? 64 : 78, T = 12, B = 26;
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const minV = Math.min(0, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const xOf = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const lo = minV < 0 ? -niceMax(-minV) : 0;
  const yOf = (v: number) => T + (H - T - B) * (1 - (v - lo) / (max - lo));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (max - lo));
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 70))));
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - L) / (W - L - R)) * (n - 1)))));
  };
  // keep end labels from colliding
  const ends = series.map((s) => ({ s, y: yOf(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  if (!n || !series.length) return <p className="muted small">No data in this range yet.</p>;
  return (
    <div className="sx-chart" ref={ref} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={yOf(t)} y2={yOf(t)} stroke="var(--s-grid)" /><text x={L - 8} y={yOf(t) + 4} textAnchor="end">{format(t)}</text></g>)}
        {labels.map((l, i) => (i % step === 0 || i === n - 1) && (n - 1 - i >= step / 2 || i === n - 1) ? <text key={l} x={xOf(i)} y={H - 6} textAnchor="middle">{labelFmt(l)}</text> : null)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`);
          return <g key={s.key}>
            {area ? <path d={`M${xOf(0)},${yOf(0)} L${pts.join(' L')} L${xOf(n - 1)},${yOf(0)} Z`} fill={s.color} opacity={0.08} /> : null}
            <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          </g>;
        })}
        {series.length <= 4 ? ends.map(({ s, y }) => <text key={s.key} className="lbl" x={W - R + 8} y={y + 4}>{s.name}</text>) : null}
        {hover != null ? <g>
          <line x1={xOf(hover)} x2={xOf(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeWidth={1} />
          {series.map((s) => <circle key={s.key} cx={xOf(hover)} cy={yOf(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--panel)" strokeWidth={2} />)}
        </g> : null}
      </svg>
      {hover != null ? (
        <div className="sx-tip" style={{ left: `${(xOf(hover) / W) * 100}%`, top: `${(Math.min(...series.map((s) => yOf(s.values[hover] ?? 0))) / H) * 100}%` }}>
          <div className="h">{labelFmt(labels[hover])}</div>
          {series.map((s) => <div className="r" key={s.key}><i style={{ borderColor: s.color }} /><b>{format(s.values[hover] ?? 0)}</b><span>{s.name}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}

/** Toggle chips that double as the legend (line keys). */
export function SeriesToggles({ items, on, onChange }: { items: { key: string; name: string; color: string }[]; on: Set<string>; onChange: (s: Set<string>) => void }) {
  return (
    <div className="sx-legend">{items.map((it) => (
      <button key={it.key} className={on.has(it.key) ? '' : 'off'} aria-pressed={on.has(it.key)} onClick={() => {
        const n = new Set(on); if (n.has(it.key)) { if (n.size > 1) n.delete(it.key); } else n.add(it.key); onChange(n);
      }}><i style={{ borderColor: it.color }} />{it.name}</button>
    ))}</div>
  );
}

/* ── horizontal bars ── */
export function BarList({ rows, value, format = fmtNum, sub, color = 'var(--o)' }: {
  rows: any[]; value: (r: any) => number; format?: (n: number) => string; sub?: (r: any) => string; color?: string;
}) {
  const max = Math.max(...rows.map(value), 0) || 1;
  if (!rows.length) return <p className="muted small">No posts in this range yet.</p>;
  return (
    <div className="sx-bars">{rows.map((r) => (
      <div className="sx-bar" key={r.name} title={`${r.name}: ${format(value(r))}${sub ? ' · ' + sub(r) : ''}`} tabIndex={0}>
        <span className="nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
        <div className="track"><div className="fill" style={{ width: `${Math.max(2, (value(r) / max) * 100)}%`, background: color }} /></div>
        <span className="v">{format(value(r))}{sub ? <small>{sub(r)}</small> : null}</span>
      </div>
    ))}</div>
  );
}

/* ── sparkline ── */
export function Sparkline({ values, color = 'var(--o)', w = 110, h = 28, label }: { values: number[]; color?: string; w?: number; h?: number; label?: string }) {
  if (values.length < 2) return <span className="muted small">—</span>;
  const max = Math.max(...values) || 1, min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

/* ── best time to post: weekday × hour heat grid (one hue, light → dark) ── */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function HeatGrid({ grid }: { grid: { n: number; rate: number; eng: number }[][] }) {
  const max = Math.max(0, ...grid.flat().map((c) => c.rate)) || 1;
  const best = useMemo(() => {
    const all = grid.flatMap((row, d) => row.map((c, h) => ({ d, h, ...c }))).filter((c) => c.n > 0).sort((a, b) => b.rate - a.rate);
    return all.slice(0, 3);
  }, [grid]);
  const [tip, setTip] = useState<{ d: number; h: number } | null>(null);
  const hourLbl = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
  return (
    <div>
      <div className="sx-chart">
      <div className="sx-heat" onPointerLeave={() => setTip(null)}>
        <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="hh">{h % 3 === 0 ? hourLbl(h) : ''}</span>)}
        {grid.map((row, d) => (
          <React.Fragment key={d}>
            <span className="dl">{DOW[d]}</span>
            {row.map((c, h) => (
              <span key={h} className="c" tabIndex={c.n ? 0 : -1} aria-label={`${DOW[d]} ${hourLbl(h)}: ${c.n ? fmtPct(c.rate) + ' engagement, ' + c.n + ' posts' : 'no posts'}`}
                onPointerEnter={() => setTip({ d, h })} onFocus={() => setTip({ d, h })}
                style={c.n ? { background: `rgba(var(--s-heat), ${0.14 + 0.86 * (c.rate / max)})` } : undefined} />
            ))}
          </React.Fragment>
        ))}
      </div>
      {tip ? (() => { const c = grid[tip.d][tip.h]; return (
        <div className="sx-tip" style={{ left: `calc(36px + (100% - 36px) * ${((tip.h + 0.5) / 24).toFixed(3)})`, top: `${((tip.d + 1) / 8) * 100}%` }}>
          <div className="h">{DOW[tip.d]} · {hourLbl(tip.h)}–{hourLbl((tip.h + 1) % 24)} Lagos</div>
          {c.n ? <><div className="r"><b>{fmtPct(c.rate)}</b><span>avg engagement rate</span></div><div className="r"><b>{fmtNum(c.eng)}</b><span>avg engagements · {c.n} post{c.n === 1 ? '' : 's'}</span></div></> : <div className="r"><span>No posts at this time yet</span></div>}
        </div>); })() : null}
      </div>
      <div className="sx-ramp">Lower<span />Higher engagement rate · grey = no posts yet
        {best.length ? <strong style={{ marginLeft: 'auto', color: 'var(--ink)', fontWeight: 500 }}>Best so far: {best.map((b) => `${DOW[b.d]} ${hourLbl(b.h)}`).join(', ')}</strong> : null}
      </div>
    </div>
  );
}
