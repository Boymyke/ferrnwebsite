/**
 * Company profile PDF, generated from the same sections the /profile page renders.
 * pdf-lib + Poppins (served from /fonts). Sharp corners, orange rule, lots of air.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Bindings } from './env';
import type { ProfileSection } from '../views/pages';
import type { PublicProject } from './projects';

const ORANGE = rgb(1, 0.255, 0), INK = rgb(0.06, 0.06, 0.06), MUTED = rgb(0.42, 0.41, 0.39), LINE = rgb(0.85, 0.84, 0.82);
const A4 = [595.28, 841.89] as const;
const M = 56;

const strip = (s: string | null | undefined) => (s ?? '').replace(/<li>/g, '• ').replace(/<\/(p|li|h\d)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > width && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export async function profilePdf(env: Bindings, opts: { sections: ProfileSection[]; projects: PublicProject[]; team: { name: string; role: string }[]; site: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regB, medB] = await Promise.all(['poppins-latin-400-normal.woff', 'poppins-latin-500-normal.woff'].map(async (f) => {
    const r = await env.ASSETS.fetch(new Request(`https://assets.local/fonts/${f}`));
    return r.ok ? await r.arrayBuffer() : null;
  }));
  const reg = regB ? await doc.embedFont(regB, { subset: true }) : await doc.embedFont('Helvetica');
  const med = medB ? await doc.embedFont(medB, { subset: true }) : await doc.embedFont('Helvetica-Bold');
  doc.setTitle('Ferrn Digital Agency — Company profile'); doc.setAuthor('Ferrn Digital Agency'); doc.setCreator('ferrnagency.com');

  let page: PDFPage = doc.addPage([A4[0], A4[1]]), y = 0, n = 0;
  doc.removePage(0);
  const W = A4[0] - M * 2;
  const foot = () => {
    page.drawLine({ start: { x: M, y: 40 }, end: { x: A4[0] - M, y: 40 }, thickness: 0.6, color: LINE });
    page.drawText('Ferrn Digital Agency  ·  ferrnagency.com  ·  info@ferrnagency.com', { x: M, y: 26, size: 8, font: reg, color: MUTED });
    page.drawText(String(n), { x: A4[0] - M - 10, y: 26, size: 8, font: reg, color: MUTED });
  };
  const newPage = () => { page = doc.addPage([A4[0], A4[1]]); n++; y = A4[1] - M; foot(); };
  const need = (h: number) => { if (y - h < 60) newPage(); };
  const text = (s: string, size: number, font: PDFFont, color = INK, lead = 1.4, width = W, x = M) => {
    for (const line of wrap(font, size, s, width)) { need(size * lead); page.drawText(line, { x, y: y - size, size, font, color }); y -= size * lead; }
  };

  // Cover
  newPage();
  page.drawRectangle({ x: M, y: A4[1] - M - 10, width: 44, height: 4, color: ORANGE });
  y -= 30;
  text('Company profile', 10, med, MUTED, 1.2); y -= 22;
  text('Ferrn Digital Agency', 34, med, INK, 1.1); y -= 6;
  text('Websites, web applications and AI that help businesses in Lagos, London, Houston and beyond win customers and run smoothly.', 13, reg, MUTED, 1.45, W * 0.8);
  y -= 30;
  const facts: [string, string][] = [['Based', 'Lagos, Nigeria (GMT+1)'], ['Working with clients in', 'Nigeria · United Kingdom · United States · Canada'], ['Email', 'info@ferrnagency.com'], ['Book a call', 'cal.com/ferrn-agency'], ['Website', opts.site.replace(/^https?:\/\//, '')]];
  for (const [k, v] of facts) {
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: LINE }); y -= 14;
    page.drawText(k.toUpperCase(), { x: M, y: y - 7, size: 7.5, font: med, color: MUTED });
    page.drawText(v, { x: M + 150, y: y - 8, size: 10.5, font: reg, color: INK }); y -= 18;
  }
  page.drawText(new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), { x: M, y: 60, size: 9, font: reg, color: MUTED });

  // Sections
  newPage();
  let idx = 0;
  for (const s of opts.sections) {
    idx++;
    const items: string[] = (() => { try { return JSON.parse(s.items_json || '[]'); } catch { return []; } })();
    need(80);
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: LINE }); y -= 16;
    page.drawText(String(idx).padStart(2, '0'), { x: M, y: y - 8, size: 8, font: med, color: ORANGE });
    page.drawText(s.title, { x: M + 28, y: y - 13, size: 17, font: med, color: INK }); y -= 30;
    if (s.body) { text(strip(s.body), 10.5, reg, INK, 1.5, W - 28, M + 28); y -= 6; }
    if (s.key === 'projects') {
      for (const p of opts.projects.slice(0, 10)) {
        need(34);
        page.drawText(p.title, { x: M + 28, y: y - 10, size: 11, font: med, color: INK });
        page.drawText([p.type, p.industry, p.year].filter(Boolean).join(' · '), { x: M + 28, y: y - 23, size: 8.5, font: reg, color: MUTED });
        y -= 30;
        if (p.summary) { text(p.summary, 9.5, reg, MUTED, 1.4, W - 28, M + 28); y -= 6; }
      }
    } else if (s.key === 'team') {
      for (const m of opts.team) { need(16); page.drawText(m.name, { x: M + 28, y: y - 10, size: 10.5, font: med, color: INK }); page.drawText(m.role, { x: M + 28 + med.widthOfTextAtSize(m.name, 10.5) + 10, y: y - 10, size: 9.5, font: reg, color: MUTED }); y -= 17; }
    } else {
      for (const it of items) { need(16); page.drawRectangle({ x: M + 28, y: y - 8, width: 4, height: 4, color: ORANGE }); text(String(it), 10.5, reg, INK, 1.45, W - 44, M + 40); }
    }
    y -= 12;
  }
  need(90); y -= 10;
  page.drawRectangle({ x: M, y: y - 70, width: W, height: 70, color: INK });
  page.drawText('Let’s build what’s next.', { x: M + 20, y: y - 32, size: 16, font: med, color: rgb(1, 1, 1) });
  page.drawText('info@ferrnagency.com  ·  cal.com/ferrn-agency  ·  ' + opts.site.replace(/^https?:\/\//, ''), { x: M + 20, y: y - 52, size: 9.5, font: reg, color: rgb(0.8, 0.8, 0.8) });
  return await doc.save();
}
