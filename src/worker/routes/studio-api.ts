import { Hono } from 'hono';
import { onMeetingBooked, onQuoteSent } from '../lib/wa-automations';
import { TEMPLATES, inServiceWindow, sendTemplate, sendText, waConfigured } from '../lib/whatsapp';
import type { AppEnv, SessionUser } from '../lib/env';
import { all, clamp, first, getSetting, isEmail, newId, parseJson, randomToken, run, setSetting } from '../lib/db';
import { requireUser, sha256 } from '../lib/auth';
import { audit, diff } from '../lib/audit';
import { bumpContentVersion } from '../lib/cache';
import { complete, extractJson } from '../lib/ai';
import { engineCall, engineConfigured, syncEngine } from '../lib/engine';
import { searchPlaces } from '../lib/maps';
import { getAuto, NICHE_QUERY, runAutoProspect, saveAuto, LAGOS_AND_ABROAD, type AutoConfig } from '../lib/autoprospect';
import { enrichProspects, placeQuery } from '../lib/maps';
import { CORE_FLOW, NICHE_PRODUCT, NICHE_QUESTIONS, OBJECTIONS, nicheKey } from '../content/meeting-playbook';
import { quoteTotals, type QuoteItem } from '../views/quote';
import { NOVEMBER_CALENDAR } from '../content/november-calendar';
import { WEEK_MEDIA, mediaKey } from '../content/week-media';
import { socialStudio } from './social';
import { rearmAfterEdit } from '../lib/social';

type Resource = {
  table: string;
  label: string;                 // used in audit summaries
  title: string;                 // column used as a row's display name
  writable: string[];            // columns the Studio may set
  json?: string[];               // columns stored as JSON text
  search?: string[];
  filters?: string[];            // exact-match query params
  order: string;
  writeRole: SessionUser['role'];
  public?: boolean;              // affects the public site → bump edge cache
  idPrefix: string;
};

const R: Record<string, Resource> = {
  leads: { table: 'leads', label: 'lead', title: 'company', idPrefix: 'L-', order: 'COALESCE(updated_at, created) DESC', writeRole: 'sales',
    writable: ['niche', 'company', 'website', 'email', 'phone', 'contact_name', 'role', 'city', 'country', 'tier', 'score', 'gaps', 'pitch',
      'est_value', 'status', 'preview_url', 'next_action', 'needs_you', 'needs_you_reason', 'notes', 'source', 'origin', 'maps_place_id', 'rating', 'found_by'],
    search: ['company', 'email', 'phone', 'city', 'contact_name', 'gaps'], filters: ['status', 'niche', 'city', 'tier', 'origin', 'found_by'] },
  meetings: { table: 'meetings', label: 'meeting', title: 'title', idPrefix: 'm_', order: 'starts_at DESC', writeRole: 'sales',
    writable: ['lead_id', 'title', 'starts_at', 'duration_min', 'channel', 'location_url', 'attendees', 'status', 'agenda', 'notes', 'outcome', 'next_step'],
    search: ['title', 'notes'], filters: ['status', 'lead_id'] },
  quotes: { table: 'quotes', label: 'quote', title: 'number', idPrefix: 'q_', order: 'created_at DESC', writeRole: 'sales',
    writable: ['lead_id', 'client_name', 'client_company', 'client_email', 'title', 'currency', 'items_json', 'discount_pct', 'tax_pct', 'notes', 'terms', 'valid_until', 'status'],
    json: ['items_json'], search: ['number', 'client_name', 'client_company', 'title'], filters: ['status', 'lead_id'] },
  products: { table: 'products', label: 'product', title: 'name', idPrefix: 'p_', order: 'sort, name', writeRole: 'editor', public: true,
    writable: ['slug', 'name', 'category', 'industry', 'tagline', 'description', 'features_json', 'includes_json', 'demo_url', 'cover', 'accent',
      'price_ngn_setup', 'price_ngn_monthly', 'price_usd_setup', 'price_usd_monthly', 'buyout_ngn', 'buyout_usd', 'delivery_days', 'published', 'sort'],
    json: ['features_json', 'includes_json'], search: ['name', 'industry', 'tagline'], filters: ['category', 'published'] },
  orders: { table: 'orders', label: 'order', title: 'customer_name', idPrefix: 'o_', order: 'created_at DESC', writeRole: 'admin',
    writable: ['status', 'notes'], search: ['customer_name', 'email', 'company'], filters: ['status', 'product_id'] },
  requests: { table: 'requests', label: 'enquiry', title: 'name', idPrefix: 'r_', order: 'created_at DESC', writeRole: 'sales',
    writable: ['status'], search: ['name', 'email', 'company', 'message'], filters: ['type', 'status'] },
  content: { table: 'content_posts', label: 'post', title: 'title', idPrefix: 'c_', order: 'COALESCE(scheduled_at, created_at) ASC', writeRole: 'editor',
    writable: ['platform', 'format', 'theme', 'goal', 'audience', 'title', 'body', 'hashtags', 'media_json', 'scheduled_at', 'status', 'post_url', 'metrics_json', 'posted_at', 'autopost', 'publish_opts_json'],
    json: ['media_json', 'metrics_json', 'publish_opts_json'], search: ['title', 'body', 'theme'], filters: ['platform', 'status'] },
  ads: { table: 'ad_campaigns', label: 'ad campaign', title: 'name', idPrefix: 'a_', order: 'COALESCE(start_date, updated_at) DESC', writeRole: 'admin',
    writable: ['platform', 'name', 'objective', 'audience', 'product_id', 'daily_budget', 'currency', 'start_date', 'end_date', 'status', 'creatives_json', 'metrics_json', 'notes'],
    json: ['creatives_json', 'metrics_json'], search: ['name', 'audience'], filters: ['platform', 'status'] },
  posts: { table: 'posts', label: 'article', title: 'title', idPrefix: 'b_', order: 'COALESCE(published_at, updated_at) DESC', writeRole: 'editor', public: true,
    writable: ['slug', 'title', 'category', 'excerpt', 'content_html', 'cover', 'status', 'published_at'], search: ['title', 'excerpt'], filters: ['status'] },
  testimonials: { table: 'testimonials', label: 'testimonial', title: 'name', idPrefix: 'tm_', order: 'sort', writeRole: 'editor', public: true,
    writable: ['name', 'role', 'quote', 'avatar', 'published', 'sort'] },
  team: { table: 'team_members', label: 'team member', title: 'name', idPrefix: 't_', order: 'sort', writeRole: 'editor', public: true,
    writable: ['name', 'role', 'bio', 'photo', 'linkedin', 'github', 'published', 'sort'] },
  knowledge: { table: 'knowledge', label: 'knowledge entry', title: 'title', idPrefix: 'k_', order: 'title', writeRole: 'editor',
    writable: ['title', 'content', 'published'] },
};

const studio = new Hono<AppEnv>();
studio.use('*', requireUser('viewer'));
studio.route('/social', socialStudio); // auto-posting, connections, results dashboard (routes/social.ts)

const RANK: Record<string, number> = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 };
const can = (u: SessionUser, role: SessionUser['role']) => RANK[u.role] >= RANK[role];

function clean(res: Resource, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of res.writable) {
    if (!(k in body)) continue;
    let v = body[k];
    if (res.json?.includes(k) && typeof v !== 'string') v = JSON.stringify(v ?? (k.endsWith('_json') && k !== 'metrics_json' ? [] : {}));
    if (typeof v === 'boolean') v = v ? 1 : 0;
    if (typeof v === 'string') v = clamp(v, k === 'content_html' || k === 'description' || k === 'body' ? 60_000 : 8000);
    out[k] = v === '' ? null : v;
  }
  return out;
}

/* ── overview ── */
studio.get('/overview', async (c): Promise<Response> => {
  const db = c.env.DB;
  const [pipeline, byStatus, meetings, quotes, requests, content, orders, activity, target] = await Promise.all([
    first<any>(db, `SELECT COUNT(*) AS leads,
        SUM(CASE WHEN status IN ('Replied','Interested','Call booked','Proposal sent') THEN est_value ELSE 0 END) AS open_value,
        SUM(CASE WHEN status = 'Won' THEN est_value ELSE 0 END) AS won_value,
        SUM(CASE WHEN needs_you = 'Y' THEN 1 ELSE 0 END) AS needs_you FROM leads`),
    all<any>(db, 'SELECT status, COUNT(*) AS n FROM leads GROUP BY status ORDER BY n DESC'),
    all<any>(db, "SELECT m.*, l.company FROM meetings m LEFT JOIN leads l ON l.id = m.lead_id WHERE m.status = 'scheduled' AND m.starts_at >= datetime('now','-1 hour') ORDER BY m.starts_at LIMIT 6"),
    first<any>(db, "SELECT COUNT(*) AS open, SUM(CASE WHEN status='accepted' THEN total ELSE 0 END) AS accepted FROM quotes WHERE status IN ('draft','sent','accepted')"),
    all<any>(db, "SELECT * FROM requests WHERE status = 'new' ORDER BY created_at DESC LIMIT 8"),
    all<any>(db, "SELECT id, platform, title, scheduled_at, status FROM content_posts WHERE scheduled_at >= date('now') ORDER BY scheduled_at LIMIT 6"),
    first<any>(db, "SELECT COUNT(*) AS paid, SUM(amount)/100 AS revenue FROM orders WHERE status = 'paid'"),
    all<any>(db, 'SELECT * FROM audit_log ORDER BY id DESC LIMIT 12'),
    getSetting(db, 'monthly_target_ngn', '5000000'),
  ]);
  const snap = await c.env.CACHE.get('engine:snapshot', 'json') as any;
  return c.json({ ok: true, pipeline, byStatus, meetings, quotes, requests, content, orders, activity, target: Number(target),
    engine: { connected: engineConfigured(c.env), kpis: snap?.kpis ?? null, generated_at: snap?.generated_at ?? null } });
});

/* ── activity & history (who edited what) ── */
studio.get('/activity', async (c): Promise<Response> => {
  const user = c.req.query('user');
  const rows = await all(c.env.DB,
    `SELECT id, at, user_id, user_name, entity, entity_id, action, summary FROM audit_log ${user ? 'WHERE user_id = ?' : ''} ORDER BY id DESC LIMIT 200`,
    ...(user ? [user] : []));
  return c.json({ ok: true, rows });
});
studio.get('/history/:entity/:id', async (c): Promise<Response> => {
  const res = R[c.req.param('entity')];
  const table = res?.table ?? c.req.param('entity');
  const rows = await all(c.env.DB, 'SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 100', table, c.req.param('id'));
  return c.json({ ok: true, rows });
});

/* Leads split: inbound (came to us) vs found (we went out and found them). */
const LEAD_KINDS: Record<string, string> = {
  inbound: "origin IN ('website','referral')",
  found: "(origin IN ('engine','maps') OR found_by IN ('claude','auto'))",
  team: "origin = 'studio' AND found_by IS NULL",
};
studio.get('/leads/counts', async (c): Promise<Response> => {
  const row = await first<any>(c.env.DB, `SELECT COUNT(*) AS all_, ${Object.entries(LEAD_KINDS).map(([k, w]) => `SUM(CASE WHEN ${w} THEN 1 ELSE 0 END) AS ${k}`).join(', ')},
    SUM(CASE WHEN found_by = 'claude' THEN 1 ELSE 0 END) AS claude, SUM(CASE WHEN found_by = 'auto' THEN 1 ELSE 0 END) AS auto,
    SUM(CASE WHEN origin = 'engine' THEN 1 ELSE 0 END) AS engine, SUM(CASE WHEN origin IN ('website','referral') AND created >= date('now','-7 day') THEN 1 ELSE 0 END) AS inbound_week
    FROM leads`);
  return c.json({ ok: true, counts: { all: row?.all_ ?? 0, inbound: row?.inbound ?? 0, found: row?.found ?? 0, team: row?.team ?? 0, claude: row?.claude ?? 0, auto: row?.auto ?? 0, engine: row?.engine ?? 0, inbound_week: row?.inbound_week ?? 0 } });
});

/* Autopilot prospecting settings */
studio.get('/prospects/auto', async (c): Promise<Response> => {
  const cfg = await getAuto(c.env);
  const recent = await all(c.env.DB, "SELECT id, company, niche, city, score, tier, phone, email, website, status, created FROM leads WHERE found_by IN ('auto','claude') ORDER BY created DESC, updated_at DESC LIMIT 30");
  const byDay = await all(c.env.DB, "SELECT created AS day, SUM(found_by='auto') AS auto, SUM(found_by='claude') AS claude FROM leads WHERE found_by IN ('auto','claude') AND created >= date('now','-29 day') GROUP BY created ORDER BY created");
  return c.json({ ok: true, config: cfg, niches: Object.keys(NICHE_QUERY), cities: LAGOS_AND_ABROAD, hasKey: !!c.env.GOOGLE_MAPS_API_KEY, recent, byDay });
});
studio.put('/prospects/auto', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Only admins change the autopilot.' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as Partial<AutoConfig>;
  const cur = await getAuto(c.env);
  const list = (x: unknown) => (Array.isArray(x) ? x.map((s) => clamp(s, 60)).filter(Boolean).slice(0, 20) : undefined);
  const next: AutoConfig = { ...cur, enabled: b.enabled ?? cur.enabled, niches: list(b.niches) ?? cur.niches, cities: list(b.cities) ?? cur.cities,
    dailyCap: Math.max(1, Math.min(200, Number(b.dailyCap ?? cur.dailyCap) || 25)), minScore: Math.max(0, Math.min(100, Number(b.minScore ?? cur.minScore) || 0)),
    whatsappShare: Math.max(0, Math.min(100, Number(b.whatsappShare ?? cur.whatsappShare ?? 20))) };
  await saveAuto(c.env, next, u.name);
  await audit(c, 'settings', 'autoprospect', 'update', `${u.name} ${next.enabled ? 'turned on' : 'updated'} lead autopilot (${next.niches.length} niches × ${next.cities.length} cities, ${next.dailyCap}/day)`);
  return c.json({ ok: true, config: next });
});
studio.post('/prospects/auto/run', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const r = await runAutoProspect(c.env, { force: true, by: u.name });
  if ('error' in r && r.error) return c.json({ ok: false, error: r.error }, 400);
  if ('skipped' in r) return c.json({ ok: false, error: r.skipped === 'no GOOGLE_MAPS_API_KEY' ? 'Add a GOOGLE_MAPS_API_KEY secret in Cloudflare first.' : String(r.skipped) }, 400);
  return c.json({ ok: true, result: r });
});

/* ── generic CRUD ── */
studio.get('/r/:res', async (c): Promise<Response> => {
  const res = R[c.req.param('res')];
  if (!res) return c.json({ ok: false, error: 'Unknown resource' }, 404);
  const where: string[] = []; const params: unknown[] = [];
  for (const f of res.filters ?? []) {
    const v = c.req.query(f);
    if (v) { where.push(`${f} = ?`); params.push(v); }
  }
  const q = c.req.query('q');
  if (q && res.search?.length) {
    where.push('(' + res.search.map((s) => `${s} LIKE ?`).join(' OR ') + ')');
    for (const _ of res.search) params.push(`%${q}%`);
  }
  if (c.req.param('res') === 'leads') {
    const kind = c.req.query('kind');
    if (kind && LEAD_KINDS[kind]) where.push(LEAD_KINDS[kind]);
  }
  if (c.req.param('res') === 'content') {
    const from = c.req.query('from'), to = c.req.query('to');
    if (from) { where.push('scheduled_at >= ?'); params.push(from); }
    if (to) { where.push('scheduled_at <= ?'); params.push(to); }
  }
  const limit = Math.min(Number(c.req.query('limit') ?? 500), 1000);
  const rows = await all(c.env.DB, `SELECT * FROM ${res.table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${res.order} LIMIT ${limit}`, ...params);
  return c.json({ ok: true, rows });
});

studio.get('/r/:res/:id', async (c): Promise<Response> => {
  const res = R[c.req.param('res')];
  if (!res) return c.json({ ok: false }, 404);
  const row = await first(c.env.DB, `SELECT * FROM ${res.table} WHERE id = ?`, c.req.param('id'));
  if (!row) return c.json({ ok: false, error: 'Not found' }, 404);
  return c.json({ ok: true, row });
});

studio.post('/r/:res', async (c): Promise<Response> => {
  const key = c.req.param('res'); const res = R[key]; const u = c.get('user')!;
  if (!res) return c.json({ ok: false }, 404);
  if (!can(u, res.writeRole)) return c.json({ ok: false, error: 'You can view this but not change it.' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = clean(res, body);
  const id = newId(res.idPrefix);
  data.id = id;
  if (key === 'quotes') {
    data.number = await nextQuoteNumber(c.env.DB);
    data.share_key = randomToken(18);
    const items = parseJson<QuoteItem[]>(data.items_json, []);
    data.total = quoteTotals(items, Number(data.discount_pct ?? 0), Number(data.tax_pct ?? 7.5)).total;
  }
  if (key === 'leads') { data.created = new Date().toISOString().slice(0, 10); data.origin = data.origin ?? 'studio'; data.status = data.status ?? 'New'; }
  if (['meetings', 'quotes', 'content'].includes(key)) data.created_by = u.name;
  if (res.table !== 'orders' && res.table !== 'requests') data.updated_by = u.name;
  const cols = Object.keys(data);
  await run(c.env.DB, `INSERT INTO ${res.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((k) => data[k]));
  await audit(c, res.table, id, 'create', `${u.name} created ${res.label} “${String(data[res.title] ?? id).slice(0, 80)}”`, null, data);
  if (res.public) await bumpContentVersion(c.env);
  if (key === 'meetings') c.executionCtx.waitUntil(onMeetingBooked(c.env, { id, lead_id: data.lead_id as string, starts_at: String(data.starts_at), location_url: data.location_url as string }).catch(() => null));
  return c.json({ ok: true, row: await first(c.env.DB, `SELECT * FROM ${res.table} WHERE id = ?`, id) });
});

studio.patch('/r/:res/:id', async (c): Promise<Response> => {
  const key = c.req.param('res'); const res = R[key]; const u = c.get('user')!; const id = c.req.param('id');
  if (!res) return c.json({ ok: false }, 404);
  if (!can(u, res.writeRole)) return c.json({ ok: false, error: 'You can view this but not change it.' }, 403);
  const before = await first<Record<string, any>>(c.env.DB, `SELECT * FROM ${res.table} WHERE id = ?`, id);
  if (!before) return c.json({ ok: false, error: 'Not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = clean(res, body);
  if (key === 'quotes') {
    const merged = { ...before, ...data } as any;
    data.total = quoteTotals(parseJson<QuoteItem[]>(merged.items_json, []), Number(merged.discount_pct), Number(merged.tax_pct)).total;
  }
  if (!Object.keys(data).length) return c.json({ ok: true, row: before });
  if ('updated_by' in before) { data.updated_by = u.name; data.updated_at = new Date().toISOString(); }
  const cols = Object.keys(data);
  await run(c.env.DB, `UPDATE ${res.table} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...cols.map((k) => data[k]), id);
  const d = diff(before, data);
  if (d.changed.length) {
    await audit(c, res.table, id, 'update', `${u.name} edited ${res.label} “${String(before[res.title] ?? id).slice(0, 60)}” (${d.changed.join(', ')})`, d.before, d.after);
  }
  // Keep the LeadsHunter engine in step when a synced lead's status changes.
  if (key === 'leads' && before.origin === 'engine' && 'status' in data && engineConfigured(c.env)) {
    c.executionCtx.waitUntil(engineCall(c.env, 'dashAction', ['setStatus', { lead_id: id, status: data.status }]).catch(() => null));
  }
  if (key === 'content') await rearmAfterEdit(c.env, before, data);
  if (res.public) await bumpContentVersion(c.env);
  const after = await first<Record<string, any>>(c.env.DB, `SELECT * FROM ${res.table} WHERE id = ?`, id);
  if (key === 'meetings' && after && ('starts_at' in data || 'lead_id' in data)) c.executionCtx.waitUntil(onMeetingBooked(c.env, after as any).catch(() => null));
  if (key === 'quotes' && after && data.status === 'sent' && before.status !== 'sent') c.executionCtx.waitUntil(onQuoteSent(c.env, after as any).catch(() => null));
  return c.json({ ok: true, row: after });
});

studio.delete('/r/:res/:id', async (c): Promise<Response> => {
  const res = R[c.req.param('res')]; const u = c.get('user')!; const id = c.req.param('id');
  if (!res) return c.json({ ok: false }, 404);
  if (!can(u, res.writeRole === 'sales' ? 'editor' : 'admin')) return c.json({ ok: false, error: 'Only admins can delete this.' }, 403);
  const before = await first<Record<string, unknown>>(c.env.DB, `SELECT * FROM ${res.table} WHERE id = ?`, id);
  if (!before) return c.json({ ok: false }, 404);
  await run(c.env.DB, `DELETE FROM ${res.table} WHERE id = ?`, id);
  await audit(c, res.table, id, 'delete', `${u.name} deleted ${res.label} “${String(before[res.title] ?? id).slice(0, 60)}”`, before, null);
  if (res.public) await bumpContentVersion(c.env);
  return c.json({ ok: true });
});

async function nextQuoteNumber(db: D1Database) {
  const year = new Date().getFullYear();
  const row = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM quotes WHERE number LIKE ?", `FQ-${year}-%`);
  return `FQ-${year}-${String((row?.n ?? 0) + 1).padStart(3, '0')}`;
}

/* ── team & access ── */
studio.get('/users', async (c): Promise<Response> => {
  const rows = await all(c.env.DB, `SELECT id, email, name, role, title, active, created_at, last_login_at,
      CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS activated,
      (SELECT COUNT(*) FROM audit_log a WHERE a.user_id = users.id AND a.action IN ('create','update','delete')) AS edits
    FROM users ORDER BY created_at`);
  return c.json({ ok: true, rows });
});

studio.post('/users/invite', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Only admins can invite people.' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { email?: string; name?: string; role?: string; title?: string; user_id?: string };
  const role = ['admin', 'editor', 'sales', 'viewer'].includes(String(b.role)) ? b.role! : 'editor';
  if (role === 'admin' && u.role !== 'owner') return c.json({ ok: false, error: 'Only the owner can create admins.' }, 403);
  const token = randomToken(24);
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  let id = b.user_id;
  if (id) {
    await run(c.env.DB, 'UPDATE users SET invite_hash = ?, invite_expires_at = ? WHERE id = ?', await sha256(token), expires, id);
  } else {
    const email = clamp(b.email, 200).toLowerCase();
    if (!isEmail(email) || !clamp(b.name, 120)) return c.json({ ok: false, error: 'Name and email are required.' }, 422);
    id = newId('u_');
    await run(c.env.DB, 'INSERT INTO users (id, email, name, role, title, invite_hash, invite_expires_at) VALUES (?,?,?,?,?,?,?)',
      id, email, clamp(b.name, 120), role, clamp(b.title, 80) || null, await sha256(token), expires);
  }
  await audit(c, 'users', id, 'invite', `${u.name} created an invite link`);
  const origin = new URL(c.req.url).origin;
  return c.json({ ok: true, link: `${origin}/studio/invite#${token}`, expires });
});

studio.patch('/users/:id', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Only admins can change access.' }, 403);
  const target = await first<any>(c.env.DB, 'SELECT * FROM users WHERE id = ?', c.req.param('id'));
  if (!target) return c.json({ ok: false }, 404);
  if (target.role === 'owner' && u.role !== 'owner') return c.json({ ok: false, error: 'The owner account can only be changed by the owner.' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { role?: string; active?: boolean; title?: string; name?: string };
  const data: Record<string, unknown> = {};
  if (b.role && ['admin', 'editor', 'sales', 'viewer'].includes(b.role) && target.role !== 'owner') data.role = b.role;
  if (typeof b.active === 'boolean' && target.id !== u.id) data.active = b.active ? 1 : 0;
  if (b.title !== undefined) data.title = clamp(b.title, 80);
  if (b.name) data.name = clamp(b.name, 120);
  const cols = Object.keys(data);
  if (cols.length) await run(c.env.DB, `UPDATE users SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...cols.map((k) => data[k]), target.id);
  if (data.active === 0) await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', target.id);
  await audit(c, 'users', target.id, 'update', `${u.name} changed access for ${target.name} (${cols.join(', ')})`, null, data);
  return c.json({ ok: true });
});

/* ── LeadsHunter engine ── */
studio.get('/engine', async (c): Promise<Response> => {
  const cached = await c.env.CACHE.get('engine:snapshot', 'json');
  if (c.req.query('live') && engineConfigured(c.env)) {
    try { await syncEngine(c.env); } catch (e: any) { return c.json({ ok: false, error: e.message, data: cached }, 502); }
    return c.json({ ok: true, data: await c.env.CACHE.get('engine:snapshot', 'json'), connected: true });
  }
  return c.json({ ok: true, data: cached, connected: engineConfigured(c.env) });
});
studio.get('/engine/lead/:id', async (c): Promise<Response> => {
  if (!engineConfigured(c.env)) return c.json({ ok: true, data: null });
  try { return c.json({ ok: true, data: await engineCall(c.env, 'getLeadDetail', [c.req.param('id')]) }); }
  catch (e: any) { return c.json({ ok: false, error: e.message }, 502); }
});
studio.post('/engine/action', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { action?: string; params?: Record<string, unknown> };
  const allowed = ['approve', 'hold', 'cancel', 'edit', 'sendNow', 'waSent', 'resolve', 'setStatus', 'note', 'markInbox', 'setSetting', 'runNow', 'rfpStatus'];
  if (!allowed.includes(String(b.action))) return c.json({ ok: false, error: 'Unknown action' }, 400);
  if (b.action === 'setSetting' && !can(u, 'admin')) return c.json({ ok: false, error: 'Only admins change engine settings.' }, 403);
  try {
    const data = await engineCall(c.env, 'dashAction', [b.action, b.params ?? {}]);
    await c.env.CACHE.put('engine:snapshot', JSON.stringify(data), { expirationTtl: 60 * 60 * 6 });
    await audit(c, 'engine', String(b.params?.id ?? b.params?.lead_id ?? ''), String(b.action), `${u.name}: ${b.action} ${b.params?.lead_id ?? b.params?.id ?? ''}`, null, b.params);
    return c.json({ ok: true, data });
  } catch (e: any) { return c.json({ ok: false, error: e.message }, 502); }
});
studio.post('/engine/sync', async (c): Promise<Response> => {
  try { const r = await syncEngine(c.env); return c.json({ ok: true, result: r }); }
  catch (e: any) { return c.json({ ok: false, error: e.message }, 502); }
});

/* ── prospecting: Google Maps ── */
studio.post('/prospects/search', async (c): Promise<Response> => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { niche?: string; city?: string; query?: string; page?: string };
  const query = clamp(b.query, 200) || placeQuery(NICHE_QUERY[clamp(b.niche, 60)] ?? clamp(b.niche, 60), clamp(b.city, 60) || 'Lagos');
  try {
    const r = await searchPlaces(c.env, query, b.page);
    const known = new Set((await all<{ maps_place_id: string }>(c.env.DB, 'SELECT maps_place_id FROM leads WHERE maps_place_id IS NOT NULL')).map((x) => x.maps_place_id));
    await enrichProspects(r.results.filter((x) => !known.has(x.place_id)), 12);
    const results = r.results.map((x) => ({ ...x, already: known.has(x.place_id) }));
    await run(c.env.DB, 'INSERT INTO prospect_searches (id, query, niche, city, provider, results_json, created_by) VALUES (?,?,?,?,?,?,?)',
      newId('ps_'), query, clamp(b.niche, 60), clamp(b.city, 60), 'google_places', JSON.stringify(results).slice(0, 200_000), u.name);
    return c.json({ ok: true, query, results, next: r.next });
  } catch (e: any) { return c.json({ ok: false, error: e.message }, 400); }
});

studio.post('/prospects/add', async (c): Promise<Response> => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { niche?: string; city?: string; items?: any[] };
  let added = 0;
  for (const x of (b.items ?? []).slice(0, 50)) {
    const exists = await first(c.env.DB, 'SELECT id FROM leads WHERE maps_place_id = ? OR (company = ? AND city = ?)', x.place_id, x.name, b.city ?? '');
    if (exists) continue;
    const tier = x.score >= 80 ? 'A' : x.score >= 65 ? 'B' : 'C';
    await run(c.env.DB,
      `INSERT INTO leads (id, created, niche, company, website, email, phone, city, tier, score, gaps, status, source, origin, maps_place_id, rating, notes, updated_by)
       VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 'maps', ?, ?, ?, ?)`,
      newId('L-'), clamp(b.niche, 60), clamp(x.name, 160), x.website ?? null, Array.isArray(x.emails) && x.emails[0] ? clamp(x.emails[0], 120).toLowerCase() : null, x.phone ?? null, clamp(b.city, 60), tier, x.score,
      (x.reasons ?? []).join('; '), x.maps_url ?? 'Google Maps', x.place_id, x.rating ?? null, clamp(x.address, 300), u.name);
    added++;
  }
  await audit(c, 'leads', null, 'import', `${u.name} added ${added} leads from Google Maps (${b.niche ?? ''} · ${b.city ?? ''})`);
  return c.json({ ok: true, added });
});

/* ── meetings: discovery brief ── */
studio.get('/meetings/:id/brief', async (c): Promise<Response> => {
  const m = await first<any>(c.env.DB, 'SELECT * FROM meetings WHERE id = ?', c.req.param('id'));
  if (!m) return c.json({ ok: false }, 404);
  const lead = m.lead_id ? await first<any>(c.env.DB, 'SELECT * FROM leads WHERE id = ?', m.lead_id) : null;
  const key = nicheKey(lead?.niche);
  const product = await first<any>(c.env.DB, 'SELECT slug, name, tagline, price_ngn_setup, price_ngn_monthly, price_usd_setup, price_usd_monthly FROM products WHERE slug = ?', NICHE_PRODUCT[key]);
  const gaps = (lead?.gaps ?? '').split(/;\s*/).filter(Boolean);
  return c.json({ ok: true, meeting: m, lead, product, gaps,
    gapQuestions: gaps.slice(0, 4).map((g: string) => `We noticed: ${g}. How is that affecting enquiries today?`),
    flow: CORE_FLOW, niche: NICHE_QUESTIONS[key], objections: OBJECTIONS });
});

/** Optional AI tailoring of the brief using the lead's audit notes. */
studio.post('/meetings/:id/ai-questions', async (c): Promise<Response> => {
  const m = await first<any>(c.env.DB, 'SELECT * FROM meetings WHERE id = ?', c.req.param('id'));
  const lead = m?.lead_id ? await first<any>(c.env.DB, 'SELECT * FROM leads WHERE id = ?', m.lead_id) : null;
  if (!lead) return c.json({ ok: false, error: 'Link the meeting to a lead first.' }, 422);
  const r = await complete(c.env, [
    { role: 'system', content: 'You prepare short discovery-call briefs for Ferrn Digital Agency (Nigeria). Return JSON: {"opener": string, "questions": string[6], "risks": string[3], "recommendation": string}. Plain, respectful Nigerian business English.' },
    { role: 'user', content: JSON.stringify({ company: lead.company, niche: lead.niche, city: lead.city, website: lead.website, gaps: lead.gaps, pitch: lead.pitch, notes: lead.notes }) },
  ], { maxTokens: 700, json: true });
  return c.json({ ok: true, brief: extractJson(r.text, { questions: [] }) });
});

/* ── quotes: AI draft from a brief ── */
studio.post('/quotes/ai-draft', async (c): Promise<Response> => {
  const b = (await c.req.json().catch(() => ({}))) as { brief?: string; currency?: string; lead_id?: string };
  const products = await all<any>(c.env.DB, 'SELECT name, price_ngn_setup, price_ngn_monthly, price_usd_setup, price_usd_monthly FROM products WHERE published = 1');
  const lead = b.lead_id ? await first<any>(c.env.DB, 'SELECT company, niche, gaps, pitch, est_value FROM leads WHERE id = ?', b.lead_id) : null;
  const r = await complete(c.env, [
    { role: 'system', content: `You draft quotes for Ferrn Digital Agency. Use the marketplace price list as anchors; custom work at ₦150,000 or $400 per developer-day. Return JSON {"title": string, "items": [{"description": string, "qty": number, "unit_price": number, "recurring": "once"|"monthly"|"termly"}], "notes": string}. Currency: ${b.currency === 'USD' ? 'USD' : 'NGN'}. Keep 3–7 line items, realistic, no padding.` },
    { role: 'user', content: JSON.stringify({ brief: clamp(b.brief, 3000), lead, price_list: products }) },
  ], { maxTokens: 900, json: true });
  return c.json({ ok: true, draft: extractJson(r.text, { items: [] }) });
});

/* ── content: AI drafts, calendar import, performance ── */
studio.post('/content/generate', async (c): Promise<Response> => {
  const u = c.get('user')!;
  const b = (await c.req.json().catch(() => ({}))) as { platform?: string; format?: string; theme?: string; goal?: string; brief?: string; count?: number; save?: boolean; date?: string };
  const platform = ['x', 'instagram', 'tiktok', 'linkedin'].includes(String(b.platform)) ? b.platform! : 'instagram';
  const count = Math.min(Math.max(Number(b.count ?? 3), 1), 7);
  const top = await all<any>(c.env.DB, "SELECT platform, format, title, body, metrics_json FROM content_posts WHERE status = 'posted' ORDER BY json_extract(metrics_json,'$.engagement_rate') DESC LIMIT 5");
  const r = await complete(c.env, [
    { role: 'system', content: `You are Ferrn Digital Agency's content lead. Ferrn builds websites, web apps and AI automation for Nigerian and international SMEs. Brand: confident, specific, useful — never hype, no clichés, no emoji walls, no made-up stats or client names. Platform rules: X = ≤280 chars per post or a numbered thread; Instagram = carousel slide text (≤12 words a slide) + caption; TikTok = hook (0–3s), beats with on-screen text, CTA, plus voiceover script. Every piece ends with one clear CTA (DM a keyword, link in bio, book a call). Return JSON {"posts":[{"title":string,"format":string,"body":string,"hashtags":string,"visual_direction":string}]}.` },
    { role: 'user', content: JSON.stringify({ platform, format: b.format, theme: b.theme, goal: b.goal, brief: clamp(b.brief, 2000), count, what_performed_well: top }) },
  ], { maxTokens: 1800, json: true, temperature: 0.7 });
  const posts = extractJson<{ posts: any[] }>(r.text, { posts: [] }).posts ?? [];
  if (b.save) {
    for (const p of posts) {
      await run(c.env.DB, `INSERT INTO content_posts (id, platform, format, theme, goal, title, body, hashtags, media_json, scheduled_at, status, created_by, updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'draft', ?, ?)`, newId('c_'), platform, clamp(p.format, 80), clamp(b.theme, 120), clamp(b.goal, 80),
        clamp(p.title, 200), clamp(p.body, 8000), clamp(p.hashtags, 500), JSON.stringify([{ type: 'direction', note: clamp(p.visual_direction, 1000) }]),
        b.date ?? null, u.name, u.name);
    }
    await audit(c, 'content_posts', null, 'generate', `${u.name} generated ${posts.length} ${platform} drafts with AI`);
  }
  return c.json({ ok: true, posts, provider: r.provider });
});

studio.post('/content/import-calendar', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'editor')) return c.json({ ok: false, error: 'No access' }, 403);
  let added = 0, attached = 0;
  for (const p of NOVEMBER_CALENDAR) {
    const media = WEEK_MEDIA[mediaKey(p.scheduled_at, p.platform)];
    const exists = await first<{ id: string; media_json: string | null }>(c.env.DB, 'SELECT id, media_json FROM content_posts WHERE platform = ? AND scheduled_at = ? AND title = ?', p.platform, p.scheduled_at, p.title);
    if (exists) {
      // Already imported: just attach the ready-made media if the post has none yet.
      if (media && (!exists.media_json || exists.media_json === '[]')) { await run(c.env.DB, 'UPDATE content_posts SET media_json = ? WHERE id = ?', JSON.stringify(media), exists.id); attached++; }
      continue;
    }
    await run(c.env.DB, `INSERT INTO content_posts (id, platform, format, theme, goal, audience, title, body, hashtags, scheduled_at, status, media_json, created_by, updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?, 'approved', ?, ?, ?)`, newId('c_'), p.platform, p.format, p.theme, p.goal, p.audience, p.title, p.body, p.hashtags, p.scheduled_at, media ? JSON.stringify(media) : '[]', u.name, u.name);
    added++;
  }
  await audit(c, 'content_posts', null, 'import', `${u.name} imported ${added} posts from the November content calendar${attached ? ` and attached media to ${attached}` : ''}`);
  return c.json({ ok: true, added, attached });
});

studio.get('/content/performance', async (c): Promise<Response> => {
  const rows = await all<any>(c.env.DB, "SELECT id, platform, format, theme, title, posted_at, metrics_json FROM content_posts WHERE status = 'posted'");
  const scored = rows.map((r) => {
    const m = parseJson<Record<string, number>>(r.metrics_json, {});
    const reach = m.reach || m.impressions || 0;
    const engagements = (m.likes || 0) + (m.comments || 0) * 2 + (m.shares || 0) * 3 + (m.saves || 0) * 3 + (m.clicks || 0) * 2;
    const rate = reach ? engagements / reach : 0;
    return { ...r, metrics: m, reach, engagements, rate, leads: m.leads || 0 };
  });
  const by = (k: string) => {
    const g: Record<string, { posts: number; reach: number; engagements: number; leads: number }> = {};
    for (const r of scored) { const key = r[k] || '—'; g[key] ??= { posts: 0, reach: 0, engagements: 0, leads: 0 }; g[key].posts++; g[key].reach += r.reach; g[key].engagements += r.engagements; g[key].leads += r.leads; }
    return Object.entries(g).map(([name, v]) => ({ name, ...v, rate: v.reach ? v.engagements / v.reach : 0 })).sort((a, b) => b.rate - a.rate);
  };
  scored.sort((a, b) => b.rate - a.rate);
  return c.json({ ok: true, top: scored.slice(0, 5), bottom: scored.slice(-5).reverse(), byPlatform: by('platform'), byTheme: by('theme'), byFormat: by('format'), total: scored.length });
});

/* ── media uploads (R2) ── */
studio.post('/media', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ ok: false, error: 'No file' }, 400);
  if (file.size > 25 * 1024 * 1024) return c.json({ ok: false, error: 'Max 25 MB' }, 413);
  if (!/^(image|video|audio)\/|application\/pdf/.test(file.type)) return c.json({ ok: false, error: 'Images, video, audio or PDF only' }, 415);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${clamp(String(form.get('folder') ?? 'uploads'), 30).replace(/[^a-z0-9-]/gi, '')}/${new Date().toISOString().slice(0, 7)}/${newId()}.${ext}`;
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { by: u.name, name: file.name } });
  await audit(c, 'media', key, 'upload', `${u.name} uploaded ${file.name}`);
  return c.json({ ok: true, key, url: `/media/${key}` });
});

/* ── settings & integrations ── */
studio.get('/settings', async (c): Promise<Response> => {
  const rows = await all(c.env.DB, 'SELECT * FROM settings ORDER BY key');
  const e = c.env;
  return c.json({ ok: true, rows, integrations: {
    ai: e.OPENAI_API_KEY ? `OpenAI (${e.OPENAI_MODEL})` : e.AI ? 'Cloudflare Workers AI (fallback)' : 'Not configured',
    voice: e.AZURE_SPEECH_KEY ? `Azure ${e.AZURE_VOICE}` : e.ELEVENLABS_API_KEY ? 'ElevenLabs' : 'Browser voice (add AZURE_SPEECH_KEY for a Nigerian neural voice)',
    engine: engineConfigured(e) ? 'Connected' : 'Not connected — set ENGINE_URL + ENGINE_KEY',
    maps: e.GOOGLE_MAPS_API_KEY ? 'Connected' : 'Add GOOGLE_MAPS_API_KEY',
    payments: e.PAYSTACK_SECRET_KEY ? 'Paystack live' : 'Paystack not connected (orders become invoice requests)',
    whatsapp: waConfigured(e) ? `Connected (number ID ${e.WHATSAPP_PHONE_NUMBER_ID})` : 'Not connected — set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID',
  } });
});
studio.put('/settings/:key', async (c): Promise<Response> => {
  const u = c.get('user')!;
  if (!can(u, 'admin')) return c.json({ ok: false, error: 'Admins only' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { value?: string };
  const before = await getSetting(c.env.DB, c.req.param('key'));
  await setSetting(c.env.DB, clamp(c.req.param('key'), 60), clamp(b.value, 4000), u.name);
  await audit(c, 'settings', c.req.param('key'), 'update', `${u.name} changed setting ${c.req.param('key')}`, before, b.value);
  return c.json({ ok: true });
});

export default studio;

/* ── WhatsApp inbox ── */
studio.get('/wa/contacts', async (c): Promise<Response> => {
  const rows = await all(c.env.DB, `SELECT c.*, l.company AS lead_company,
      (SELECT body FROM wa_messages m WHERE m.wa_id = c.wa_id ORDER BY created_at DESC LIMIT 1) AS last_body,
      (SELECT created_at FROM wa_messages m WHERE m.wa_id = c.wa_id ORDER BY created_at DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM wa_queue q WHERE q.wa_id = c.wa_id AND q.status = 'pending') AS queued
    FROM wa_contacts c LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.needs_human DESC, COALESCE(last_at, c.created_at) DESC LIMIT 300`);
  const stats = await first(c.env.DB, `SELECT
      (SELECT COUNT(*) FROM wa_messages WHERE direction = 'out' AND created_at >= datetime('now','-7 days')) AS sent_7d,
      (SELECT COUNT(*) FROM wa_messages WHERE direction = 'in' AND created_at >= datetime('now','-7 days')) AS received_7d,
      (SELECT COUNT(*) FROM wa_queue WHERE status = 'pending') AS queued,
      (SELECT COUNT(*) FROM wa_contacts WHERE needs_human = 1) AS needs_human`);
  return c.json({ ok: true, rows, stats, connected: waConfigured(c.env), templates: TEMPLATES });
});
studio.get('/wa/contacts/:id', async (c): Promise<Response> => {
  const id = c.req.param('id');
  const [contact, messages, queue] = await Promise.all([
    first(c.env.DB, 'SELECT * FROM wa_contacts WHERE wa_id = ?', id),
    all(c.env.DB, 'SELECT * FROM wa_messages WHERE wa_id = ? ORDER BY created_at ASC LIMIT 500', id),
    all(c.env.DB, "SELECT * FROM wa_queue WHERE wa_id = ? ORDER BY send_after ASC", id),
  ]);
  if (!contact) return c.json({ ok: false, error: 'Not found' }, 404);
  return c.json({ ok: true, contact, messages, queue, window_open: await inServiceWindow(c.env, id) });
});
studio.post('/wa/contacts/:id/send', async (c): Promise<Response> => {
  const u = c.get('user')!; const id = c.req.param('id');
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { text?: string; template?: string; params?: string[] };
  const contact = await first<{ opted_out_at: string | null }>(c.env.DB, 'SELECT opted_out_at FROM wa_contacts WHERE wa_id = ?', id);
  if (!contact) return c.json({ ok: false, error: 'Not found' }, 404);
  let r;
  if (b.template) {
    if (!TEMPLATES[b.template]) return c.json({ ok: false, error: 'Unknown template' }, 422);
    if (contact.opted_out_at) return c.json({ ok: false, error: 'This person replied STOP. Only reply if they message you first.' }, 422);
    r = await sendTemplate(c.env, id, b.template, (b.params ?? []).map(String), u.name);
  } else {
    const text = clamp(b.text, 4000);
    if (!text) return c.json({ ok: false, error: 'Write a message first.' }, 422);
    if (!(await inServiceWindow(c.env, id))) return c.json({ ok: false, error: 'More than 24 hours since they last messaged, so WhatsApp only allows an approved template. Pick one below.' }, 422);
    r = await sendText(c.env, id, text, u.name);
  }
  if (!r.ok) return c.json({ ok: false, error: r.error }, 502);
  await run(c.env.DB, "UPDATE wa_contacts SET needs_human = 0, last_outbound_at = datetime('now') WHERE wa_id = ?", id);
  await audit(c, 'whatsapp', id, 'send', `${u.name} sent a WhatsApp ${b.template ? 'template' : 'message'} to +${id}`);
  return c.json({ ok: true });
});
studio.patch('/wa/contacts/:id', async (c): Promise<Response> => {
  const u = c.get('user')!; const id = c.req.param('id');
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { bot_paused?: boolean; needs_human?: boolean; lead_id?: string | null; cancel_queue?: boolean };
  if (typeof b.bot_paused === 'boolean') await run(c.env.DB, 'UPDATE wa_contacts SET bot_paused = ? WHERE wa_id = ?', b.bot_paused ? 1 : 0, id);
  if (typeof b.needs_human === 'boolean') await run(c.env.DB, 'UPDATE wa_contacts SET needs_human = ? WHERE wa_id = ?', b.needs_human ? 1 : 0, id);
  if (b.lead_id !== undefined) await run(c.env.DB, 'UPDATE wa_contacts SET lead_id = ? WHERE wa_id = ?', b.lead_id || null, id);
  if (b.cancel_queue) await run(c.env.DB, "UPDATE wa_queue SET status = 'cancelled' WHERE wa_id = ? AND status = 'pending'", id);
  await audit(c, 'whatsapp', id, 'update', `${u.name} updated WhatsApp chat +${id}`, null, b);
  return c.json({ ok: true });
});
