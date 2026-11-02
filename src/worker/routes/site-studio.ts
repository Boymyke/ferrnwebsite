/**
 * Studio → Website: structured copy editor with revisions, Bob (settings, index, analytics),
 * project import from the portfolio sheet, screenshot capture into R2.
 * Mounted at /api/studio/site (requireUser already applied by the parent router).
 */
import { Hono } from 'hono';
import type { AppEnv, SessionUser } from '../lib/env';
import { all, clamp, first, getSetting, newId, run, setSetting } from '../lib/db';
import { audit } from '../lib/audit';
import { bumpContentVersion } from '../lib/cache';
import { CONTENT_FIELDS } from '../lib/content';
import { rebuildPageIndex, retrieve } from '../lib/bob';

const RANK = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 } as const;
const can = (u: SessionUser, role: SessionUser['role']) => RANK[u.role] >= RANK[role];

export const siteStudio = new Hono<AppEnv>();

/* ── structured content ── */
siteStudio.get('/content', async (c) => {
  const rows = await all<{ key: string; value: string; updated_by: string; updated_at: string }>(c.env.DB, 'SELECT * FROM site_content').catch(() => []);
  const map = Object.fromEntries(rows.map((r) => [r.key, r]));
  return c.json({ ok: true, fields: CONTENT_FIELDS.map((f) => ({ ...f, value: map[f.key]?.value ?? null, updated_by: map[f.key]?.updated_by ?? null, updated_at: map[f.key]?.updated_at ?? null })) });
});

siteStudio.put('/content', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { changes?: Record<string, string | null> };
  const changes = Object.entries(b.changes ?? {}).filter(([k]) => CONTENT_FIELDS.some((f) => f.key === k));
  if (!changes.length) return c.json({ ok: false, error: 'Nothing to save' }, 422);
  const known = CONTENT_FIELDS.filter((f) => f.key === 'bob.persona').map((f) => f.key);
  for (const [key, raw] of changes) {
    if (known.includes(key) && !can(u, 'admin')) continue;
    const value = raw == null ? null : clamp(String(raw), 20_000);
    const before = await first<{ value: string }>(c.env.DB, 'SELECT value FROM site_content WHERE key = ?', key);
    if ((before?.value ?? null) === value) continue;
    await run(c.env.DB, 'INSERT INTO site_content (key, value, updated_by, updated_at) VALUES (?,?,?,datetime("now")) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at', key, value, u.name);
    await run(c.env.DB, 'INSERT INTO content_revisions (key, value, by) VALUES (?,?,?)', key, before?.value ?? null, u.name);
  }
  await audit(c, 'site_content', null, 'update', `${u.name} edited website copy (${changes.map(([k]) => k).join(', ').slice(0, 300)})`);
  await bumpContentVersion(c.env);
  c.executionCtx.waitUntil(rebuildPageIndex(c.env).catch(() => 0));
  return c.json({ ok: true });
});

siteStudio.get('/content/revisions', async (c) => {
  const key = clamp(c.req.query('key'), 80);
  const rows = await all(c.env.DB, 'SELECT id, key, value, by, at FROM content_revisions WHERE key = ? ORDER BY id DESC LIMIT 20', key).catch(() => []);
  return c.json({ ok: true, rows });
});

siteStudio.post('/content/revert', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { id?: number };
  const rev = await first<{ key: string; value: string | null }>(c.env.DB, 'SELECT key, value FROM content_revisions WHERE id = ?', Number(b.id));
  if (!rev) return c.json({ ok: false, error: 'Revision not found' }, 404);
  const cur = await first<{ value: string }>(c.env.DB, 'SELECT value FROM site_content WHERE key = ?', rev.key);
  await run(c.env.DB, 'INSERT INTO content_revisions (key, value, by) VALUES (?,?,?)', rev.key, cur?.value ?? null, u.name);
  if (rev.value == null) await run(c.env.DB, 'DELETE FROM site_content WHERE key = ?', rev.key);
  else await run(c.env.DB, 'INSERT INTO site_content (key, value, updated_by, updated_at) VALUES (?,?,?,datetime("now")) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at', rev.key, rev.value, u.name);
  await audit(c, 'site_content', rev.key, 'revert', `${u.name} restored an earlier version of ${rev.key}`);
  await bumpContentVersion(c.env);
  return c.json({ ok: true });
});

/* ── Bob ── */
const BOB_KEYS = ['bob.enabled', 'bob.voice', 'bob.read_aloud', 'bob.autovoice'];
siteStudio.get('/bob', async (c) => {
  const settings: Record<string, string | null> = {};
  for (const k of BOB_KEYS) settings[k] = await getSetting(c.env.DB, k);
  const since = `datetime('now', '-30 days')`;
  const [stats, daily, top, actions, unsure, index] = await Promise.all([
    first<any>(c.env.DB, `SELECT COUNT(*) AS messages, COUNT(DISTINCT session) AS conversations, SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS down,
      SUM(CASE WHEN provider LIKE 'guard:%' THEN 1 ELSE 0 END) AS blocked FROM chat_logs WHERE created_at >= ${since}`).catch(() => null),
    all<any>(c.env.DB, `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n, COUNT(DISTINCT session) AS s FROM chat_logs WHERE created_at >= ${since} GROUP BY day ORDER BY day`).catch(() => []),
    all<any>(c.env.DB, `SELECT lower(trim(question)) AS q, COUNT(*) AS n FROM chat_logs WHERE created_at >= ${since} GROUP BY q ORDER BY n DESC LIMIT 15`).catch(() => []),
    all<any>(c.env.DB, `SELECT COALESCE(json_extract(action, '$.type'), 'answer') AS t, COUNT(*) AS n FROM chat_logs WHERE created_at >= ${since} GROUP BY t`).catch(() => []),
    all<any>(c.env.DB, `SELECT question, answer, path, created_at FROM chat_logs WHERE created_at >= ${since} AND (answer LIKE '%not sure%' OR answer LIKE '%can’t answer%' OR answer LIKE '%don’t have%') ORDER BY id DESC LIMIT 20`).catch(() => []),
    first<any>(c.env.DB, 'SELECT COUNT(*) AS n, SUM(excluded) AS excluded, MAX(updated_at) AS at FROM page_index').catch(() => null),
  ]);
  return c.json({ ok: true, settings, stats: stats ?? { messages: 0, conversations: 0, up: 0, down: 0, blocked: 0 }, daily, top, actions, unsure, index: index ?? { n: 0, excluded: 0, at: null },
    voice: c.env.AZURE_SPEECH_KEY ? `Azure ${c.env.AZURE_VOICE || 'en-NG-EzinneNeural'} (Nigerian English)` : c.env.ELEVENLABS_API_KEY ? 'ElevenLabs voice' : 'Browser voice only — add AZURE_SPEECH_KEY for the Nigerian voice' });
});

siteStudio.put('/bob', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, string>;
  for (const k of BOB_KEYS) if (k in b) await setSetting(c.env.DB, k, clamp(String(b[k]), 200), u.name);
  await audit(c, 'settings', 'bob', 'update', `${u.name} changed Bob settings`);
  await bumpContentVersion(c.env);
  return c.json({ ok: true });
});

siteStudio.post('/bob/reindex', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const n = await rebuildPageIndex(c.env);
  await audit(c, 'page_index', null, 'rebuild', `${u.name} rebuilt Bob's knowledge index (${n} entries)`);
  await bumpContentVersion(c.env);
  return c.json({ ok: true, n });
});

siteStudio.get('/bob/index', async (c) => {
  const rows = await all(c.env.DB, 'SELECT path, kind, title, summary, excluded, updated_at, length(COALESCE(body, "")) AS chars FROM page_index ORDER BY kind, path').catch(() => []);
  return c.json({ ok: true, rows });
});

siteStudio.patch('/bob/index', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { path?: string; excluded?: boolean };
  await run(c.env.DB, 'UPDATE page_index SET excluded = ? WHERE path = ?', b.excluded ? 1 : 0, clamp(b.path, 300));
  await audit(c, 'page_index', clamp(b.path, 300), 'update', `${u.name} ${b.excluded ? 'hid' : 'showed'} ${b.path} ${b.excluded ? 'from' : 'to'} Bob`);
  await bumpContentVersion(c.env);
  return c.json({ ok: true });
});

/** What Bob would ground an answer in, for a given question (no model call). */
siteStudio.get('/bob/preview', async (c) => {
  const q = clamp(c.req.query('q'), 500);
  const hits = q ? await retrieve(c.env, q, 6, clamp(c.req.query('path'), 200) || undefined) : [];
  return c.json({ ok: true, hits: hits.map((h) => ({ path: h.path, kind: h.kind, title: h.title, score: Number(h.score.toFixed(2)), snippet: ((h.summary ? h.summary + ' ' : '') + (h.body ?? '')).slice(0, 240) })) });
});

siteStudio.get('/bob/logs', async (c) => {
  const limit = Math.min(200, Number(c.req.query('limit') ?? 60));
  const rows = await all(c.env.DB, 'SELECT id, session, path, lang, question, answer, provider, action, sources, rating, created_at FROM chat_logs ORDER BY id DESC LIMIT ?', limit);
  return c.json({ ok: true, rows });
});

/* ── projects: import from the portfolio sheet (CSV export) or pasted CSV; no duplicates ── */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const pick = (h: string[], r: string[], ...names: string[]) => { for (const n of names) { const i = h.findIndex((x) => x === n || x.includes(n)); if (i >= 0 && r[i]?.trim()) return r[i].trim(); } return ''; };
const toIso = (s: string) => { if (!s || s === '-') return ''; if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
const STATUS: Record<string, string> = { suspended: 'paused', done: 'launched', completed: 'launched', complete: 'launched', live: 'launched', launched: 'launched', delivered: 'launched', 'in progress': 'build', ongoing: 'build', building: 'build', development: 'build', design: 'design', review: 'review', paused: 'paused', 'on hold': 'paused', cancelled: 'cancelled', canceled: 'cancelled', discovery: 'discovery', planning: 'discovery', support: 'support', maintenance: 'support' };
const CATEGORY = (s: string) => /app|portal|dashboard|platform|system|software/i.test(s) ? 'webapp' : /ai|assistant|automation|bot/i.test(s) ? 'ai' : /brand|logo|identity/i.test(s) ? 'branding' : 'website';

siteStudio.post('/projects/import', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { csv?: string; sheet?: string; gid?: string; makePublic?: boolean };
  let csv = b.csv ?? '';
  if (!csv && b.sheet) {
    const id = b.sheet.match(/\/d\/([\w-]+)/)?.[1] ?? (/^[\w-]{20,}$/.test(b.sheet.trim()) ? b.sheet.trim() : '');
    if (!id) return c.json({ ok: false, error: 'That doesn’t look like a Google Sheet link.' }, 422);
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${b.gid ? `&gid=${encodeURIComponent(b.gid)}` : ''}`;
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return c.json({ ok: false, error: `Could not read the sheet (${r.status}). Share it as “Anyone with the link can view”, or paste the CSV.` }, 400);
    csv = await r.text();
    if (/<html/i.test(csv.slice(0, 200))) return c.json({ ok: false, error: 'The sheet is private. Share it as “Anyone with the link can view”, or paste the CSV.' }, 400);
  }
  const rows = parseCsv(csv);
  if (rows.length < 2) return c.json({ ok: false, error: 'No rows found' }, 422);
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const existing = await all<{ id: string; slug: string; name: string; links_json: string }>(c.env.DB, 'SELECT id, slug, name, links_json FROM projects');
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p])), bySlug = new Map(existing.map((p) => [p.slug, p]));
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const name = pick(h, r, 'project', 'name', 'title', 'client project');
    if (!name) { skipped++; continue; }
    const client = pick(h, r, 'client', 'company', 'customer');
    const type = pick(h, r, 'type', 'service', 'deliverable', 'scope');
    const industry = pick(h, r, 'industry', 'sector', 'niche');
    const statusRaw = pick(h, r, 'status', 'stage', 'phase').toLowerCase();
    const status = STATUS[statusRaw] ?? (Object.entries(STATUS).find(([k]) => statusRaw.includes(k))?.[1] ?? 'discovery');
    const live = pick(h, r, 'live', 'url', 'website', 'link', 'domain');
    const year = pick(h, r, 'year', 'completed', 'launch').match(/20\d{2}/)?.[0] ?? '';
    const budget = Number(pick(h, r, 'budget', 'price', 'value', 'amount', 'fee').replace(/[^\d.]/g, '')) || null;
    const expenses = Number(pick(h, r, 'expense', 'cost', 'spent').replace(/[^\d.]/g, '')) || null;
    const revenue = Number(pick(h, r, 'paid', 'received', 'revenue').replace(/[^\d.]/g, '')) || null;
    const lead = pick(h, r, 'lead', 'owner', 'pm', 'manager');
    const team = pick(h, r, 'team', 'freelancer', 'developer', 'developers', 'designer', 'people').split(/[,;/]/).map((x) => x.trim()).filter(Boolean);
    const start = toIso(pick(h, r, 'start', 'began', 'kickoff')), due = toIso(pick(h, r, 'due', 'deadline', 'end', 'delivery'));
    const figma = pick(h, r, 'figma', 'design link'), repo = pick(h, r, 'repo', 'github'), brief = pick(h, r, 'brief', 'proposal'), assets = pick(h, r, 'assets', 'drive');
    const priorityRaw = pick(h, r, 'priority').toLowerCase(); const priority = /high|urgent/.test(priorityRaw) ? 'high' : /low/.test(priorityRaw) ? 'low' : 'normal';
    const extraLinks: Record<string, string> = {}; for (const [k, v] of [['figma', figma], ['repo', repo], ['brief', brief], ['assets', assets]] as const) if (v && /^https?:\/\//.test(v)) extraLinks[k] = v;
    const notes = pick(h, r, 'notes', 'description', 'summary', 'details', 'brief');
    const currency = /\$|usd/i.test(pick(h, r, 'currency', 'budget', 'price')) ? 'USD' : 'NGN';
    let slug = slugify(name) || newId('p');
    const found = byName.get(name.toLowerCase()) ?? bySlug.get(slug);
    if (found) {
      // Only fill blanks; never overwrite what the team typed in the Studio.
      const cur = await first<any>(c.env.DB, 'SELECT * FROM projects WHERE id = ?', found.id);
      const sets: string[] = [], vals: unknown[] = [];
      const fill = (col: string, v: unknown) => { if (v != null && v !== '' && (cur[col] == null || cur[col] === '' || cur[col] === '[]' || cur[col] === '{}')) { sets.push(`${col} = ?`); vals.push(v); } };
      fill('client', client); fill('type', type); fill('industry', industry); fill('year', year); fill('budget', budget); fill('expenses', expenses); fill('revenue', revenue);
      fill('lead', lead); fill('start_date', start); fill('due_date', due); fill('description', notes); if (team.length) fill('team_json', JSON.stringify(team));
      const links = JSON.parse(cur.links_json || '{}'); let linksChanged = false;
      if (live && !links.live) { links.live = live; linksChanged = true; }
      for (const [k, v] of Object.entries(extraLinks)) if (!links[k]) { links[k] = v; linksChanged = true; }
      if (linksChanged) { sets.push('links_json = ?'); vals.push(JSON.stringify(links)); }
      if (sets.length) { await run(c.env.DB, `UPDATE projects SET ${sets.join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, ...vals, u.name, found.id); updated++; } else skipped++;
      continue;
    }
    while (bySlug.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    const id = newId('pj_');
    await run(c.env.DB, `INSERT INTO projects (id, slug, name, client, category, type, industry, description, status, priority, lead, team_json, start_date, due_date, currency, budget, expenses, revenue, links_json, public, year, summary, updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, slug, name, client || null, CATEGORY(type + ' ' + name), type || null, industry || null, notes || null, status, priority, lead || null, JSON.stringify(team), start || null, due || null,
      currency, budget, expenses, revenue, JSON.stringify({ ...(live ? { live: /^https?:/.test(live) ? live : `https://${live}` } : {}), ...extraLinks }), b.makePublic && status === 'launched' ? 1 : 0, year || (due || start).slice(0, 4) || null, notes ? notes.slice(0, 200) : null, u.name);
    bySlug.set(slug, { id, slug, name, links_json: '{}' }); byName.set(name.toLowerCase(), { id, slug, name, links_json: '{}' });
    added++;
  }
  await audit(c, 'projects', null, 'import', `${u.name} imported projects from the sheet (${added} added, ${updated} filled in, ${skipped} unchanged)`);
  if (added || updated) await bumpContentVersion(c.env);
  return c.json({ ok: true, added, updated, skipped, columns: h });
});

/* ── screenshot capture: live site → R2 cover (no more hot-linked third-party captures) ── */
siteStudio.post('/projects/:id/capture', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'Editors and admins only' }, 403);
  const p = await first<any>(c.env.DB, 'SELECT id, slug, links_json FROM projects WHERE id = ?', c.req.param('id'));
  if (!p) return c.json({ ok: false, error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => ({}))) as { url?: string };
  const live = clamp(b.url, 500) || JSON.parse(p.links_json || '{}').live;
  if (!live || !/^https?:\/\//.test(live)) return c.json({ ok: false, error: 'Add the live URL first' }, 422);
  const sources = [
    `https://image.thum.io/get/width/1600/crop/1000/noanimate/${live}`,
    `https://s0.wp.com/mshots/v1/${encodeURIComponent(live)}?w=1600&h=1000`,
  ];
  for (const src of sources) {
    try {
      const r = await fetch(src, { headers: { 'user-agent': 'FerrnStudio/1.0' }, signal: AbortSignal.timeout(25_000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 8000) continue; // placeholder "generating" images are tiny
      const key = `projects/${p.slug}-${Date.now().toString(36)}.${type.includes('png') ? 'png' : 'jpg'}`;
      await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { by: u.name, source: live } });
      await run(c.env.DB, "UPDATE projects SET cover = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", `/media/${key}`, u.name, p.id);
      await audit(c, 'projects', p.id, 'capture', `${u.name} captured a screenshot of ${live}`);
      await bumpContentVersion(c.env);
      return c.json({ ok: true, cover: `/media/${key}` });
    } catch { /* try the next source */ }
  }
  return c.json({ ok: false, error: 'Could not capture that site right now — try again in a minute or upload a screenshot.' }, 502);
});

/* ── small project calculator: server-side so quotes and projects agree ── */
export type CalcInput = { pages?: number; screens?: number; integrations?: number; ai?: boolean; cms?: boolean; ecommerce?: boolean; design?: 'template' | 'custom' | 'premium'; hours?: number; rate?: number; currency?: 'NGN' | 'USD' };
export function calcProject(i: CalcInput) {
  const rate = i.rate ?? (i.currency === 'USD' ? 35 : 25_000);
  const hours = i.hours ?? ((i.pages ?? 0) * 4 + (i.screens ?? 0) * 8 + (i.integrations ?? 0) * 10 + (i.ai ? 30 : 0) + (i.cms ? 12 : 0) + (i.ecommerce ? 24 : 0) + ({ template: 10, custom: 30, premium: 60 } as any)[i.design ?? 'custom']);
  const build = hours * rate;
  const pm = build * 0.12, qa = build * 0.08, contingency = build * 0.1;
  const total = build + pm + qa + contingency;
  const weeks = Math.max(1, Math.round(hours / 30));
  return { hours, rate, build, pm, qa, contingency, total, weeks, currency: i.currency ?? 'NGN' };
}
siteStudio.post('/projects/calc', async (c) => c.json({ ok: true, ...calcProject((await c.req.json().catch(() => ({}))) as CalcInput) }));
