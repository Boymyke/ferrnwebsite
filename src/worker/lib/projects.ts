import type { Bindings } from './env';
import { all, first, parseJson } from './db';
import { PROJECTS, type Project } from '../content/projects';

/** What the public site renders for a case study. Internal fields never reach this shape. */
export type PublicProject = {
  slug: string; title: string; client: string | null; category: string; type: string | null; industry: string | null; year: string | null;
  live: string | null; featured: boolean; cover: string | null; gallery: { src: string; alt?: string; caption?: string; kind?: 'image' | 'video' }[];
  services: string[]; tech: string[]; summary: string | null; context: string | null; challenge: string | null; approach: string | null; solution: string | null;
  results: { label: string; value: string; note?: string }[]; points: { icon: string; title: string; text: string }[];
  meta_title: string | null; meta_description: string | null; accent: string | null; testimonial_id: string | null;
};

const fromLegacy = (p: Project): PublicProject => ({
  slug: p.slug, title: p.title, client: p.client, category: p.category, type: p.type, industry: p.industry, year: p.year, live: p.live,
  featured: p.featured, cover: p.image ?? null, gallery: [], services: [], tech: [], summary: p.summary, context: p.context, challenge: p.challenge,
  approach: null, solution: p.solution, results: p.impact ? [{ label: 'Effect', value: p.impact }] : [], points: p.points,
  meta_title: null, meta_description: p.meta, accent: null, testimonial_id: null,
});

const fromRow = (r: any): PublicProject => ({
  slug: r.slug, title: r.name, client: r.client, category: r.category, type: r.type, industry: r.industry, year: r.year,
  live: parseJson<any>(r.links_json, {}).live ?? null, featured: !!r.featured, cover: r.cover,
  gallery: parseJson(r.gallery_json, []), services: parseJson(r.services_json, []), tech: parseJson(r.tech_json, []),
  summary: r.summary, context: r.context, challenge: r.challenge, approach: r.approach, solution: r.solution,
  results: parseJson(r.results_json, []), points: [], meta_title: r.meta_title, meta_description: r.meta_description, accent: r.accent, testimonial_id: r.testimonial_id,
});

export const PUBLIC_COLS = `id, slug, name, client, category, type, industry, year, links_json, featured, cover, gallery_json, services_json, tech_json,
  summary, context, challenge, approach, solution, results_json, meta_title, meta_description, accent, testimonial_id, sort`;

/** Published projects from the Studio; until any are published, the code-defined case studies. */
export async function loadProjects(env: Bindings): Promise<PublicProject[]> {
  const rows = await all<any>(env.DB, `SELECT ${PUBLIC_COLS} FROM projects WHERE public = 1 ORDER BY featured DESC, sort, year DESC`).catch(() => []);
  if (!rows.length) return PROJECTS.map(fromLegacy);
  const legacy = new Map(PROJECTS.map((p) => [p.slug, p]));
  return rows.map((r) => {
    const p = fromRow(r);
    const l = legacy.get(p.slug);
    // Keep the hand-written highlight points from the code until the Studio has its own.
    if (l) { p.points = l.points; p.cover = p.cover ?? l.image ?? null; p.live = p.live ?? l.live; }
    return p;
  });
}

export async function loadProject(env: Bindings, slug: string): Promise<PublicProject | null> {
  const row = await first<any>(env.DB, `SELECT ${PUBLIC_COLS} FROM projects WHERE public = 1 AND slug = ?`, slug).catch(() => null);
  if (row) { const p = fromRow(row); const l = PROJECTS.find((x) => x.slug === slug); if (l) { p.points = l.points; p.cover = p.cover ?? l.image ?? null; p.live = p.live ?? l.live; } return p; }
  const any = await first<{ n: number }>(env.DB, 'SELECT COUNT(*) AS n FROM projects WHERE public = 1').catch(() => null);
  if (any?.n) return null; // Studio is the source of truth once anything is published
  const l = PROJECTS.find((x) => x.slug === slug);
  return l ? fromLegacy(l) : null;
}

/** Screenshot for a project: self-hosted cover first, else a live capture (thum.io), else nothing. */
export const shotOf = (p: { cover: string | null; live: string | null }) =>
  p.cover ? (p.cover.startsWith('http') || p.cover.startsWith('/') ? p.cover : `/media/${p.cover}`) : p.live ? `https://image.thum.io/get/width/800/crop/500/noanimate/${p.live}` : null;
