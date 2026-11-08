import { Hono } from 'hono';
import { whatsappWebhook } from './routes/whatsapp';
import { processQueue } from './lib/wa-automations';
import { runSocial } from './lib/social';
import { socialPublic } from './routes/social';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Bindings } from './lib/env';
import { loadUser } from './lib/auth';
import { first } from './lib/db';
import { syncEngine } from './lib/engine';
import { siteRoutes, NotFound, sitemap } from './routes/site';
import { loadSite } from './lib/content';
import publicApi from './routes/api-public';
import authApi from './routes/auth';
import studioApi from './routes/studio-api';
import { demoSite, demosApi } from './routes/demos';
import { voiceApi, voicePage } from './routes/voice';
import { pushPendingToEngine, runAutoProspect } from './lib/autoprospect';
import { syncPreviews } from './lib/engine';
import { analyticsCollect, analyticsStudio, pruneAnalytics } from './routes/analytics';
import proposalsApi from './routes/proposals';
import clientDocs from './routes/client-docs';
import { emailStudio, emailTrack, syncEmailStatus } from './routes/email-track';
import { engageApi, importInteractions, runEngageAutopilot } from './routes/engage';
import { orderActions } from './routes/order-actions';
import { notificationsApi } from './routes/notifications';
import { studioShell } from './routes/studio-shell';
import { QuoteDocument, type QuoteRow } from './views/quote';
import { LANGS } from './content/i18n';

const app = new Hono<AppEnv>();

const securityHeaders = secureHeaders({
  xFrameOptions: 'SAMEORIGIN',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], microphone: ['self'], geolocation: [] },
  contentSecurityPolicy: undefined, // inline JSON-LD + demo iframes; revisit with nonces once stable
});
// Email open pixels and click redirects are loaded by mail apps on other origins, so they skip
// Cross-Origin-Resource-Policy: same-origin (the pixel would be blocked in webmail otherwise).
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/e/')) {
    await next();
    c.res.headers.set('cross-origin-resource-policy', 'cross-origin');
    c.res.headers.set('x-content-type-options', 'nosniff');
    c.res.headers.set('referrer-policy', 'no-referrer');
    return;
  }
  // Uploaded demos and concept sites run in a CSP sandbox (opaque origin), so to the browser their own
  // images, fonts and scripts are cross-origin: let those files load there (they hold nothing private).
  if (/^\/(concept|preview|demos\/u)\//.test(c.req.path)) {
    await securityHeaders(c, next);
    c.res.headers.set('cross-origin-resource-policy', 'cross-origin');
    if (!(c.res.headers.get('content-type') || '').startsWith('text/html')) c.res.headers.set('access-control-allow-origin', '*');
    return;
  }
  return securityHeaders(c, next);
});
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
app.route('/api/studio/demos', demosApi);
app.route('/api/studio/voice', voiceApi);
app.route('/api/a', analyticsCollect);
app.route('/api/studio/analytics', analyticsStudio);
app.route('/api/studio/proposals', proposalsApi);
app.route('/api/studio/emails', emailStudio);
app.route('/api/studio/engage', engageApi);
app.route('/api/studio/order', orderActions);
app.route('/api/studio/notifications', notificationsApi);
app.route('/api/e', emailTrack); // email open pixel, click redirects, LeadsHunter send log
app.route('/api/studio', studioApi);
app.route('/api/whatsapp', whatsappWebhook);
app.route('/api/social', socialPublic); // OAuth return for TikTok / Instagram connect
app.route('/api', publicApi);

/* Uploaded demo sites (R2) */
app.route('/', demoSite);
app.route('/', voicePage);

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

/* Proposals (/p/:token) and invoices (/i/:token) for clients, behind an access code */
app.route('/', clientDocs);

/* R2 media (team photos, content assets). private/ holds signatures and receipts: never public. */
app.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  // private/ (signatures, receipts) and demos/ (served sandboxed via /demos/u/) are never served raw
  let plain = key; try { plain = decodeURIComponent(key); } catch { /* keep raw */ }
  if (/^\/*(private|demos)(\/|$)/i.test(plain)) return c.notFound();
  // Byte ranges (206) for audio and video: Safari will not play media without them.
  const m = /^bytes=(\d*)-(\d*)$/.exec(c.req.header('range') || '');
  if (m && (m[1] || m[2])) {
    const head = await c.env.MEDIA.head(key);
    if (!head) return c.notFound();
    const size = head.size;
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const h = new Headers(); head.writeHttpMetadata(h); h.set('etag', head.httpEtag); h.set('accept-ranges', 'bytes'); h.set('cache-control', 'public, max-age=31536000, immutable');
    if (start >= size || start > end) { h.set('content-range', `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
    const part = await c.env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!part) return c.notFound();
    h.set('content-range', `bytes ${start}-${end}/${size}`); h.set('content-length', String(end - start + 1));
    return new Response(part.body, { status: 206, headers: h });
  }
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers: h });
});

/* Videos with proper byte-range answers (206). Static assets only honour Range once they are cached at the
   edge, and Safari will not play a video without it, so reels are served through here. */
app.get('/v/:name', async (c) => {
  const name = c.req.param('name');
  if (!/^[a-z0-9-]+\.mp4$/.test(name)) return c.notFound();
  const src = await c.env.ASSETS.fetch(new Request(new URL(`/assets/home/${name}`, c.req.url)));
  if (!src.ok) return c.notFound();
  const buf = await src.arrayBuffer(), size = buf.byteLength;
  const h = new Headers({ 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' });
  const etag = src.headers.get('etag'); if (etag) h.set('etag', etag);
  const m = /^bytes=(\d*)-(\d*)$/.exec(c.req.header('range') || '');
  if (!m || (!m[1] && !m[2])) { h.set('content-length', String(size)); return new Response(buf, { status: 200, headers: h }); }
  let start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : size - 1;
  if (start < 0) start = 0;
  end = Math.min(end, size - 1);
  if (start > end || start >= size) { h.set('content-range', `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
  h.set('content-range', `bytes ${start}-${end}/${size}`); h.set('content-length', String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, headers: h });
});

/* SEO */
app.get('/sitemap.xml', async (c) => c.body(await sitemap(c.env), 200, { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' }));

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
  return c.html(<NotFound lang={lang} ctx={await loadSite(c.env, lang)} />, 404);
});

app.onError((err, c) => {
  console.error('Unhandled', c.req.method, c.req.path, err);
  if (c.req.path.startsWith('/api/')) return c.json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  return c.text('Something went wrong. Please try again in a moment.', 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try { await syncEngine(env); } catch (e) { console.warn('engine sync failed', e); }
      try { const snap = await env.CACHE.get('engine:snapshot', 'json') as any; await importInteractions(env, snap?.interactions); } catch (e) { console.warn('interactions import failed', e); }
      try { await runEngageAutopilot(env); } catch (e) { console.warn('social autopilot failed', e); }
      try { await processQueue(env); } catch (e) { console.warn('whatsapp queue failed', e); }
      try { await runAutoProspect(env); } catch (e) { console.warn('autoprospect failed', e); }
      try { await pushPendingToEngine(env); } catch (e) { console.warn('autopilot → engine push failed', e); }
      try { await syncPreviews(env); } catch (e) { console.warn('preview sync failed', e); }
      try { await pruneAnalytics(env); } catch (e) { console.warn('analytics prune failed', e); }
      try { await syncEmailStatus(env); } catch (e) { console.warn('email status sync failed', e); }
      try { await runSocial(env, event.scheduledTime); } catch (e) { console.warn('social autopost/metrics failed', e); }
      await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    })());
  },
};
