import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Card, Loading, Page, Tabs } from '../ui';

/**
 * Turns "Slide 1: … Slide 2: …" text into branded 1080×1350 Instagram slides, drawn on a
 * canvas with Ferrn's type and colours (no stock-template look) and downloadable as PNGs.
 */
const W = 1080, H = 1350;
const MARK = new Path2D('M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z');
type Theme = 'dark' | 'light' | 'orange';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function draw(canvas: HTMLCanvasElement, text: string, i: number, n: number, theme: Theme) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W; canvas.height = H;
  const bg = theme === 'dark' ? '#0b0b0b' : theme === 'light' ? '#f6f4f0' : '#ff4100';
  const ink = theme === 'light' ? '#111111' : '#ffffff';
  const accent = theme === 'orange' ? '#111111' : '#ff4100';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (theme === 'dark') {
    const g = ctx.createRadialGradient(W * .85, H * .1, 0, W * .85, H * .1, W * .9);
    g.addColorStop(0, 'rgba(255,65,0,.35)'); g.addColorStop(1, 'rgba(255,65,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // giant mark watermark
  ctx.save(); ctx.globalAlpha = theme === 'orange' ? .14 : .06; ctx.translate(W - 520, H - 560); ctx.scale(3.6, 3.6); ctx.fillStyle = ink; ctx.fill(MARK); ctx.restore();
  // header
  ctx.save(); ctx.translate(80, 80); ctx.scale(.26, .26); ctx.fillStyle = accent; ctx.fill(MARK); ctx.restore();
  ctx.fillStyle = ink; ctx.font = '500 30px Poppins'; ctx.fillText('Ferrn Digital Agency', 140, 113);
  ctx.textAlign = 'right'; ctx.fillStyle = theme === 'light' ? '#8d8983' : 'rgba(255,255,255,.6)'; ctx.fillText(`${i + 1}/${n}`, W - 80, 113); ctx.textAlign = 'left';
  // body
  const first = i === 0, last = i === n - 1;
  const size = first ? 92 : text.length > 90 ? 58 : 70;
  ctx.font = `600 ${size}px Poppins`;
  const lines = wrap(ctx, text, W - 160);
  const lh = size * 1.12;
  let y = first ? 420 : (H - lines.length * lh) / 2 + size * .4;
  if (!first && !last) { ctx.fillStyle = accent; ctx.font = '600 34px Poppins'; ctx.fillText(String(i).padStart(2, '0'), 80, y - size - 10); ctx.font = `600 ${size}px Poppins`; }
  ctx.fillStyle = ink;
  for (const l of lines) { ctx.fillText(l, 80, y); y += lh; }
  // footer
  ctx.fillStyle = accent; ctx.fillRect(80, H - 150, 90, 6);
  ctx.fillStyle = ink; ctx.font = '500 30px Poppins';
  ctx.fillText(last ? 'ferrnagency.com' : first ? 'Swipe →' : '', 80, H - 90);
}

export function CarouselStudio() {
  const id = new URLSearchParams(location.search).get('post');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('carousel');
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);
  const refs = useRef<HTMLCanvasElement[]>([]);
  useEffect(() => { (document as any).fonts.load('600 60px Poppins').then(() => (document as any).fonts.load('500 30px Poppins')).then(() => setReady(true)); }, []);
  useEffect(() => { if (id) api(`/r/content/${id}`).then((r) => { setText(r.row.body ?? ''); setTitle(r.row.title ?? 'carousel'); }); }, [id]);
  const slides = text.split('\n').map((l) => l.match(/^\s*Slide\s*\d+\s*:\s*(.+)$/i)?.[1]).filter(Boolean) as string[];
  useEffect(() => { if (ready) slides.forEach((s, i) => refs.current[i] && draw(refs.current[i], s, i, slides.length, theme)); });
  const download = (i: number) => refs.current[i].toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b!); a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}.png`; a.click(); }, 'image/png');
  return (
    <Page title="Carousel slides" sub="Branded 1080×1350 slides from your post text. One idea per slide, big type, no stock clichés." actions={<button className="btn primary" onClick={() => slides.forEach((_, i) => setTimeout(() => download(i), i * 300))}>Download all ({slides.length})</button>}>
      <Card>
        <Tabs tabs={[['dark', 'Dark'], ['light', 'Light'], ['orange', 'Orange']]} value={theme} onChange={(v) => setTheme(v as Theme)} />
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Slide 1: Hook\nSlide 2: Point\n…'} />
      </Card>
      {!ready ? <Loading /> : <div className="slides">{slides.map((_, i) => <figure key={i}><canvas ref={(el) => { if (el) refs.current[i] = el; }} /><button className="btn sm ghost" onClick={() => download(i)}>Download {i + 1}</button></figure>)}</div>}
    </Page>
  );
}
