import { Hono } from 'hono';
import { whatsappWebhook } from './routes/whatsapp';
import { processQueue } from './lib/wa-automations';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Bindings } from './lib/env';
import { loadUser } from './lib/auth';
import { first } from './lib/db';
import { syncEngine } from './lib/engine';
import { siteRoutes, NotFound } from './routes/site';
import publicApi from './routes/api-public';
import authApi from './routes/auth';
import studioApi from './routes/studio-api';
import { studioShell } from './routes/studio-shell';
import { QuoteDocument, type QuoteRow } from './views/quote';
import { LANGS } from './content/i18n';
import { PROJECTS } from './content/projects';
import { POLICIES } from './content/policies';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders({
  xFrameOptions: 'SAMEORIGIN',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], microphone: ['self'], geolocation: [] },
  contentSecurityPolicy: undefined, // inline JSON-LD + demo iframes; revisit with nonces once stable
}));
// One canonical address: ferrnagency.com → www.ferrnagency.com (keeps path and query).
app.use('*', async (c, next) => {
  const u = new URL(c.req.url);
  if (u.hostname === 'ferrnagency.com') { u.hostname = 'www.ferrnagency.com'; return c.redirect(u.toString(), 301); }
  await next();
});
app.use('*', loadUser);
app.use('*', async (c, next) => { c.set('lang', 'en'); await next(); });

/* API */
app.route('/api/auth', authApi);
app.route('/api/studio', studioApi);
app.route('/api/whatsapp', whatsappWebhook);
app.route('/api', publicApi);

/* Studio (installable PWA) */
app.get('/studio', studioShell);
app.get('/studio/*', studioShell);

/* Shared quote link */
app.get('/q/:key', async (c) => {
  const q = await first<QuoteRow>(c.env.DB, 'SELECT * FROM quotes WHERE share_key = ?', c.req.param('key'));
  if (!q) return c.text('Quote not found', 404);
  c.header('cache-control', 'no-store');
  return c.html(<QuoteDocument q={q} />);
});

/* R2 media (team photos, content assets) */
app.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers: h });
});

/* SEO */
app.get('/sitemap.xml', async (c) => {
  const base = c.env.SITE_URL;
  const [products, posts] = await Promise.all([
    c.env.DB.prepare('SELECT slug, updated_at FROM products WHERE published = 1').all<{ slug: string; updated_at: string }>(),
    c.env.DB.prepare("SELECT slug, published_at FROM posts WHERE status = 'published'").all<{ slug: string; published_at: string }>(),
  ]);
  const paths = ['/', '/work', '/services', '/marketplace', '/team', '/about', '/insights', '/contact', '/procurement', '/policies',
    ...PROJECTS.map((p) => `/work/${p.slug}`), ...(products.results ?? []).map((p) => `/marketplace/${p.slug}`),
    ...(posts.results ?? []).map((p) => `/insights/${p.slug}`), ...POLICIES.map((p) => `/policies/${p.slug}`)];
  const urls = paths.map((p) => {
    const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l.code}" href="${base}${l.code === 'en' ? p : `/${l.code}${p}`}"/>`).join('');
    return `<url><loc>${base}${p}</loc>${alts}</url>`;
  }).join('');
  return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    200, { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' });
});

/* Public site, in English at / and in 7 more languages at /yo, /ig, /ha, /fr, /de, /es, /zh */
for (const l of ['yo', 'ig', 'ha', 'fr', 'de', 'es', 'zh'] as const) app.route(`/${l}`, siteRoutes(l));
app.route('/', siteRoutes('en'));

app.notFound(async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;
  // Old PHP URLs used folder-style paths (/work/, /services/): send them to the clean URL.
  if (c.req.method === 'GET' && c.req.path.length > 1 && c.req.path.endsWith('/') && !c.req.path.startsWith('/api/')) {
    const u = new URL(c.req.url); u.pathname = u.pathname.replace(/\/+$/, '');
    return c.redirect(u.pathname + u.search, 301);
  }
  const seg = c.req.path.split('/')[1];
  const lang = (LANGS.find((l) => l.code === seg)?.code ?? 'en') as any;
  return c.html(<NotFound lang={lang} />, 404);
});

app.onError((err, c) => {
  console.error('Unhandled', c.req.method, c.req.path, err);
  if (c.req.path.startsWith('/api/')) return c.json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  return c.text('Something went wrong. Please try again in a moment.', 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try { await syncEngine(env); } catch (e) { console.warn('engine sync failed', e); }
      try { await processQueue(env); } catch (e) { console.warn('whatsapp queue failed', e); }
      await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    })());
  },
};
