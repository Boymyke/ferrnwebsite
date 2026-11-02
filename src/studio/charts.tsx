import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

/* Small hand-written SVG charts for the Studio. No dependencies; colours come from
   the Studio CSS variables so both themes work. */

/** Width of an element, kept in sync with a ResizeObserver. */
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || initial);
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [initial]);
  return [ref, w];
}

/** "Nice" axis ticks from 0 to at least max. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Smooth path through points (monotone cubic, so the line never overshoots below 0). */
export function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx = (i: number) => pts[i + 1][0] - pts[i][0];
  const slope = (i: number) => (pts[i + 1][1] - pts[i][1]) / (dx(i) || 1);
  const m: number[] = new Array(n);
  m[0] = slope(0); m[n - 1] = slope(n - 2);
  for (let i = 1; i < n - 1; i++) {
    const a = slope(i - 1), b = slope(i);
    m[i] = a * b <= 0 ? 0 : (3 * (dx(i - 1) + dx(i))) / ((2 * dx(i) + dx(i - 1)) / a + (dx(i) + 2 * dx(i - 1)) / b);
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(Math.round(v * 10) / 10));

export type Series = { key: string; label: string; color?: string; fill?: boolean; dashed?: boolean };

/** Area / line chart with axes, gridlines, gradient fill and a hover tooltip. */
export function AreaChart({ data, series, height = 260, xLabel, xTick, yFormat = compact }: {
  data: Record<string, number>[];
  series: Series[];
  height?: number;
  xLabel: (row: Record<string, number>) => string;   // tooltip heading
  xTick?: (row: Record<string, number>, i: number) => string;
  yFormat?: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');
  const pad = { t: 14, r: 14, b: 30, l: 40 };
  const iw = Math.max(10, width - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const paths = useMemo(() => series.map((s) => {
    const pts = data.map((d, i) => [x(i), y(d[s.key] ?? 0)] as [number, number]);
    const line = smoothPath(pts);
    const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${pad.t + ih} L${pts[0][0]},${pad.t + ih} Z` : '';
    return { s, line, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, series, width, height, top]);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 72))));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - pad.l;
    const i = data.length <= 1 ? 0 : Math.round((px / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover != null ? data[hover] : null;
  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Chart">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? 'var(--o)'} stopOpacity=".38" />
              <stop offset="70%" stopColor={s.color ?? 'var(--o)'} stopOpacity=".06" />
              <stop offset="100%" stopColor={s.color ?? 'var(--o)'} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t} className="chart-grid">
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {data.map((d, i) => i % every === 0 ? (
          <text key={i} className="chart-x" x={x(i)} y={height - 8} textAnchor={i === 0 && data.length > 1 ? 'start' : 'middle'}>{(xTick ?? xLabel)(d, i)}</text>
        ) : null)}
        {paths.map(({ s, area }) => s.fill ? <path key={`a-${s.key}`} d={area} fill={`url(#g-${uid}-${s.key})`} /> : null)}
        {paths.map(({ s, line }) => (
          <path key={`l-${s.key}`} d={line} fill="none" stroke={s.color ?? 'var(--o)'} strokeWidth={s.fill ? 2.4 : 1.6}
            strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinecap="round" strokeLinejoin="round" className="chart-line" />
        ))}
        {h ? (
          <g className="chart-hover">
            <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={pad.t + ih} />
            {series.map((s) => <circle key={s.key} cx={x(hover!)} cy={y(h[s.key] ?? 0)} r={4.5} fill={s.color ?? 'var(--o)'} stroke="var(--panel)" strokeWidth={2} />)}
          </g>
        ) : null}
      </svg>
      {h ? (
        <div className={`chart-tip ${x(hover!) > width * 0.6 ? 'left' : ''}`} style={{ left: x(hover!), top: pad.t }}>
          <strong>{xLabel(h)}</strong>
          {series.map((s) => (
            <div key={s.key}><i style={{ background: s.color ?? 'var(--o)' }} />{s.label}<b>{(h[s.key] ?? 0).toLocaleString()}</b></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical bars with value labels and a hover tooltip. */
export function ColumnChart({ data, height = 180, format = (v: number) => v.toLocaleString(), tip, color = 'var(--o)', showValues = true }: {
  data: { label: string; value: number; hint?: string }[];
  height?: number;
  format?: (v: number) => string;
  tip?: (d: { label: string; value: number; hint?: string }) => string;
  color?: string;
  showValues?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(400);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: showValues ? 22 : 8, r: 4, b: 24, l: 4 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(56, slot * 0.66));
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg width={width} height={height} onPointerLeave={() => setHover(null)}>
        <line className="chart-base" x1={pad.l} x2={pad.l + iw} y1={pad.t + ih + 0.5} y2={pad.t + ih + 0.5} />
        {data.map((d, i) => {
          const h = Math.max(d.value ? 3 : 0, (d.value / max) * ih);
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
              <rect x={cx - bw / 2} y={pad.t + ih - h} width={bw} height={h} rx={Math.min(6, bw / 3)} fill={color} opacity={hover == null || hover === i ? 1 : 0.45} className="chart-col" />
              {showValues && d.value ? <text className="chart-val" x={cx} y={pad.t + ih - h - 6} textAnchor="middle">{format(d.value)}</text> : null}
              {i % every === 0 ? <text className="chart-x" x={cx} y={height - 6} textAnchor="middle">{d.label}</text> : null}
            </g>
          );
        })}
      </svg>
      {hover != null && tip ? (
        <div className="chart-tip" style={{ left: pad.l + slot * hover + slot / 2, top: 0 }}><strong>{tip(data[hover])}</strong></div>
      ) : null}
    </div>
  );
}

/** Horizontal bar list: label over a soft bar, value on the right. */
export function BarList({ rows, format = (v: number) => v.toLocaleString(), empty = 'No data yet', extra }: {
  rows: { label: React.ReactNode; value: number; key?: string; title?: string }[];
  format?: (v: number) => string;
  empty?: string;
  extra?: (i: number) => React.ReactNode;
}) {
  if (!rows.length) return <p className="muted small an-none">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="barlist">
      {rows.map((r, i) => (
        <div key={r.key ?? i} className="barlist-row" title={r.title}>
          <span className="barlist-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          <span className="barlist-label">{r.label}</span>
          {extra ? <span className="barlist-extra">{extra(i)}</span> : null}
          <span className="barlist-n">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
