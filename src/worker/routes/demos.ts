/**
 * Demo hosting.
 *  - Built-in demos ship as static assets at /demos/<slug>/ (see public/demos).
 *  - Uploaded demos (built anywhere, uploaded from Studio) live in R2 under demos/<slug>/ and are served at /demos/u/<slug>/.
 * Every HTML page gets the Ferrn favicon. Uploaded demos run in a CSP sandbox (opaque origin), so their scripts can
 * never read Studio sessions or call the Studio API; a small shim keeps localStorage-using apps working.
 */
import { Hono } from 'hono';
import type { AppEnv, SessionUser } from '../lib/env';
import { all, clamp, first, newId, run } from '../lib/db';
import { requireUser } from '../lib/auth';
import { audit } from '../lib/audit';
import { bumpContentVersion } from '../lib/cache';

const RANK = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 } as const;
const can = (u: SessionUser, r: SessionUser['role']) => RANK[u.role] >= RANK[r];

export const FAVICON_TAGS = `<link rel="icon" href="/icons/ferrn-favicon-black-animated-shine.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"><link rel="icon" href="/icons/ferrn-favicon-white-animated-shine.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"><link rel="icon" href="/icons/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`;
const STORAGE_SHIM = `<script>(function(){function m(){var s={};return{getItem:function(k){return k in s?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}});try{document.cookie}catch(e){Object.defineProperty(document,'cookie',{get:function(){return''},set:function(){},configurable:true})}})();</script>`;

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml', webmanifest: 'application/manifest+json', map: 'application/json', pdf: 'application/pdf', wasm: 'application/wasm',
};
const typeOf = (p: string) => TYPES[(p.split('.').pop() || '').toLowerCase()] ?? 'application/octet-stream';
export const cleanSlug = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const cleanPath = (p: string) => p.split('/').filter((x) => x && x !== '.' && x !== '..').join('/').slice(0, 300);

/** Add the Ferrn favicon (and drop any other icon) on an HTML response. */
export function withFavicon(res: Response, opts: { shim?: boolean } = {}): Response {
  return new HTMLRewriter()
    .on('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]', { element: (el) => { el.remove(); } })
    .on('head', { element: (el) => { el.prepend(FAVICON_TAGS + (opts.shim ? STORAGE_SHIM : ''), { html: true }); } })
    .transform(res);
}

/* ── public: serve uploaded demos ── */
export const demoSite = new Hono<AppEnv>();
demoSite.get('/demos/u/:slug', (c) => c.redirect(`/demos/u/${cleanSlug(c.req.param('slug'))}/`, 301));
demoSite.get('/demos/u/:slug/*', async (c) => {
  const slug = cleanSlug(c.req.param('slug'));
  const row = await first<{ entry: string }>(c.env.DB, "SELECT entry FROM demos WHERE slug = ? AND kind = 'upload'", slug);
  // Answer directly: c.notFound() would hit the site's trailing-slash 301 and loop with the redirect above.
  if (!row) return c.html('<!doctype html><meta charset="utf-8"><title>Demo not found · Ferrn</title><link rel="icon" href="/icons/favicon-32.png"><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#444"><div style="text-align:center"><h1 style="font-weight:600">This demo link isn’t active</h1><p>It may have been replaced by a newer version. <a href="/marketplace" style="color:#ff4100">See live demos</a></p></div></body>', 404, { 'x-robots-tag': 'noindex' });
  let rel = cleanPath(decodeURIComponent(c.req.path.slice(`/demos/u/${slug}/`.length)));
  const tries = !rel ? [row.entry] : rel.includes('.') ? [rel] : [rel + '/index.html', rel + '.html', row.entry]; // last = SPA fallback
  let obj: R2ObjectBody | null = null; let served = '';
  for (const t of tries) { obj = await c.env.MEDIA.get(`demos/${slug}/${t}`); if (obj) { served = t; break; } }
  if (!obj) return c.text('Not found', 404);
  const ct = obj.httpMetadata?.contentType || typeOf(served);
  const headers = new Headers({
    'content-type': ct, 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex', etag: obj.httpEtag,
    'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation',
    'x-content-type-options': 'nosniff',
  });
  const res = new Response(obj.body, { headers });
  return ct.startsWith('text/html') ? withFavicon(res, { shim: true }) : res;
});

/* ── Studio API: /api/studio/demos ── */
export const demosApi = new Hono<AppEnv>();
demosApi.use('*', requireUser('viewer'));
const fullUrl = (env: AppEnv['Bindings'], d: { kind: string; slug: string }) => `${env.SITE_URL}/demos/${d.kind === 'upload' ? 'u/' : ''}${d.slug}/`;

demosApi.get('/', async (c) => {
  const rows = await all<any>(c.env.DB, 'SELECT * FROM demos ORDER BY kind DESC, updated_at DESC');
  const used = await all<{ slug: string; name: string; demo_url: string }>(c.env.DB, 'SELECT slug, name, demo_url FROM products WHERE demo_url IS NOT NULL');
  return c.json({ ok: true, rows: rows.map((d) => { const url = fullUrl(c.env, d); return { ...d, url, products: used.filter((p) => p.demo_url && url.endsWith(new URL(p.demo_url, c.env.SITE_URL).pathname)).map((p) => p.name) }; }) });
});

demosApi.post('/', async (c) => {
  const u = c.get('user')!;
  if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const b = (await c.req.json().catch(() => ({}))) as { title?: string; slug?: string; product_slug?: string; lead_id?: string; notes?: string };
  const title = clamp(b.title, 120); if (!title) return c.json({ ok: false, error: 'Give the demo a name' }, 422);
  let slug = cleanSlug(b.slug || title) || 'demo';
  const existing = await first<any>(c.env.DB, 'SELECT * FROM demos WHERE slug = ?', slug);
  if (existing && existing.kind === 'static') return c.json({ ok: false, error: 'That address belongs to a built-in demo. Pick another.' }, 409);
  if (existing && !b.slug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  if (existing && b.slug) {
    await run(c.env.DB, 'UPDATE demos SET title = ?, product_slug = COALESCE(?, product_slug), lead_id = COALESCE(?, lead_id), notes = COALESCE(?, notes), updated_by = ?, updated_at = datetime(\'now\') WHERE slug = ?',
      title, b.product_slug || null, b.lead_id || null, clamp(b.notes, 500) || null, u.name, slug);
  } else {
    await run(c.env.DB, 'INSERT INTO demos (id, slug, title, kind, product_slug, lead_id, notes, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?)',
      newId('dm_'), slug, title, 'upload', b.product_slug || null, b.lead_id || null, clamp(b.notes, 500) || null, u.name, u.name);
  }
  return c.json({ ok: true, slug });
});

/** Remove the current files before uploading a new version. */
demosApi.post('/:slug/clear', async (c) => {
  const u = c.get('user')!; if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const slug = cleanSlug(c.req.param('slug'));
  let cursor: string | undefined;
  do {
    const l = await c.env.MEDIA.list({ prefix: `demos/${slug}/`, cursor });
    if (l.objects.length) await c.env.MEDIA.delete(l.objects.map((o) => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  return c.json({ ok: true });
});

demosApi.put('/:slug/file', async (c) => {
  const u = c.get('user')!; if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const slug = cleanSlug(c.req.param('slug'));
  if (!(await first(c.env.DB, "SELECT id FROM demos WHERE slug = ? AND kind = 'upload'", slug))) return c.json({ ok: false, error: 'Unknown demo' }, 404);
  const path = cleanPath(c.req.query('path') ?? '');
  if (!path) return c.json({ ok: false, error: 'Missing path' }, 400);
  const len = Number(c.req.header('content-length') ?? 0);
  if (len > 25 * 1024 * 1024) return c.json({ ok: false, error: `${path} is over 25 MB` }, 413);
  await c.env.MEDIA.put(`demos/${slug}/${path}`, c.req.raw.body!, { httpMetadata: { contentType: typeOf(path) } });
  return c.json({ ok: true });
});

demosApi.post('/:slug/done', async (c) => {
  const u = c.get('user')!; if (!can(u, 'sales')) return c.json({ ok: false, error: 'No access' }, 403);
  const slug = cleanSlug(c.req.param('slug'));
  const b = (await c.req.json().catch(() => ({}))) as { files?: number; bytes?: number; entry?: string };
  const d = await first<any>(c.env.DB, 'SELECT * FROM demos WHERE slug = ?', slug);
  if (!d) return c.json({ ok: false }, 404);
  const entry = cleanPath(b.entry || 'index.html') || 'index.html';
  await run(c.env.DB, "UPDATE demos SET files = ?, bytes = ?, entry = ?, updated_by = ?, updated_at = datetime('now') WHERE slug = ?", Number(b.files) || 0, Number(b.bytes) || 0, entry, u.name, slug);
  const url = fullUrl(c.env, d);
  if (d.product_slug) {
    await run(c.env.DB, "UPDATE products SET demo_url = ?, updated_by = ?, updated_at = datetime('now') WHERE slug = ?", url, u.name, d.product_slug);
    await bumpContentVersion(c.env);
  }
  await audit(c, 'demos', d.id, 'upload', `${u.name} uploaded demo “${d.title}” (${b.files ?? 0} files)`);
  return c.json({ ok: true, url });
});

demosApi.delete('/:slug', async (c) => {
  const u = c.get('user')!; if (!can(u, 'admin')) return c.json({ ok: false, error: 'Only admins delete demos' }, 403);
  const slug = cleanSlug(c.req.param('slug'));
  const d = await first<any>(c.env.DB, 'SELECT * FROM demos WHERE slug = ?', slug);
  if (!d || d.kind !== 'upload') return c.json({ ok: false, error: 'Built-in demos can’t be deleted here' }, 400);
  let cursor: string | undefined;
  do { const l = await c.env.MEDIA.list({ prefix: `demos/${slug}/`, cursor }); if (l.objects.length) await c.env.MEDIA.delete(l.objects.map((o) => o.key)); cursor = l.truncated ? l.cursor : undefined; } while (cursor);
  await run(c.env.DB, 'DELETE FROM demos WHERE slug = ?', slug);
  await audit(c, 'demos', d.id, 'delete', `${u.name} deleted demo “${d.title}”`);
  return c.json({ ok: true });
});
