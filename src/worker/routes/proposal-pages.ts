/**
 * Hosted proposal pages: a page built outside Studio (like the Ataam or Splendid Freight proposals) uploaded to a
 * "link" proposal and served at /proposal/<slug>/ from R2 proposal-pages/<slug>/. Opens are counted on the proposal
 * (not when a signed-in team member views it), and /p/<token> of a link proposal forwards to its link.
 */
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../lib/env';
import { first, run } from '../lib/db';
import { addEvent, hashCode, signAccess, verifyAccess } from '../lib/docs';
import { cleanPageSlug, pageType } from './proposals';
import { withFavicon } from './demos';

export const proposalPages = new Hono<AppEnv>();
const notFound = (c: any) => c.html('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Proposal not found · Ferrn</title><link rel="icon" href="/icons/favicon-32.png"><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#444"><div style="text-align:center;max-width:440px;padding:24px"><h1 style="font-weight:600">This proposal link isn’t active</h1><p>It may have been replaced or switched off. Email <a href="mailto:hello@ferrnagency.com" style="color:#ff4100">hello@ferrnagency.com</a> and we will send you the current link.</p></div></body>', 404, { 'x-robots-tag': 'noindex' });

async function countOpen(c: any, p: Record<string, any>) {
  if (c.get('user') || p.status === 'draft') return; // team previews and unsent drafts don't count
  const ua = c.req.header('user-agent') ?? '';
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|linkedin|skype|curl|wget/i.test(ua)) return; // link unfurls
  await run(c.env.DB, `UPDATE proposals SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, datetime('now')),
    last_viewed_at = datetime('now'), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END WHERE id = ?`, p.id);
  if (p.status === 'sent' || !p.first_viewed_at) await addEvent(c.env.DB, p.id, 'viewed', `Client: ${p.client_name || p.client_company || 'client'}`, p.first_viewed_at ? 'Opened the proposal' : 'Opened the proposal for the first time');
}


const PAGE_COOKIE = (slug: string) => `ferrn_pp_${slug.replace(/-/g, '_')}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const gatePage = (slug: string, company: string, error = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private proposal · Ferrn</title><link rel="icon" href="/icons/favicon-32.png">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,Helvetica,sans-serif;background:radial-gradient(1200px 600px at 20% 0%,#0d3b30,#061a15 60%);color:#0a0f0d}
.card{width:100%;max-width:420px;background:#fff;border-radius:24px;padding:34px 30px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.mark{width:44px;height:44px;border-radius:10px;background:#000;display:grid;place-items:center;margin-bottom:22px}
small{display:block;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0f8a6a}
h1{margin:8px 0 8px;font-size:26px;letter-spacing:-.02em}p{margin:0 0 22px;color:#5e6b66;font-size:15px;line-height:1.5}
label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}input{width:100%;font:inherit;font-size:16px;padding:14px 16px;border:1px solid #cfd8d4;border-radius:12px;outline:none}
input:focus{border-color:#00936d;box-shadow:0 0 0 4px rgba(0,147,109,.15)}button{margin-top:14px;width:100%;font:inherit;font-weight:800;font-size:15px;padding:14px;border:0;border-radius:12px;background:#0a2a22;color:#fff;cursor:pointer}
button:hover{background:#007a5e}.err{margin:12px 0 0;color:#c0362c;font-size:14px}.foot{margin-top:20px;font-size:12.5px;color:#8a9893;text-align:center}.foot a{color:#007a5e}</style></head>
<body><form class="card" method="post" action="/proposal/${slug}/unlock">
<div class="mark"><svg width="26" height="26" viewBox="0 0 478 478" aria-hidden="true"><rect width="478" height="478" fill="#000"/><path d="M320.71 157.291V320.71H157.291V266.355H264.499V210.193H174.294V157.291H320.71Z" fill="#FF4100"/></svg></div>
<small>Private proposal</small><h1>${esc(company) || 'Your proposal'}</h1><p>This proposal is password protected. Enter the password we sent you to open it.</p>
<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}<button type="submit">Open proposal</button>
<div class="foot">Need help? <a href="mailto:hello@ferrnagency.com">hello@ferrnagency.com</a></div></form></body></html>`;
const gateHeaders = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

proposalPages.post('/proposal/:slug/unlock', async (c) => {
  const slug = cleanPageSlug(c.req.param('slug'));
  const p = await first<Record<string, any>>(c.env.DB, "SELECT id, revoked, code_hash, gate_secret, client_company, client_name FROM proposals WHERE page_slug = ? AND kind = 'link'", slug).catch(() => null);
  if (!p || p.revoked) return notFound(c);
  if (!p.code_hash) return c.redirect(`/proposal/${slug}/`, 303);
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const key = `rl:ppage:${slug}:${ip}:${Math.floor(Date.now() / 900000)}`;
  const n = Number((await c.env.CACHE.get(key)) ?? 0);
  if (n >= 10) return c.html(gatePage(slug, p.client_company || p.client_name, 'Too many attempts. Please try again in 15 minutes.'), 429, gateHeaders);
  await c.env.CACHE.put(key, String(n + 1), { expirationTtl: 900 });
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
  const pw = String(form.password ?? '');
  if (!pw || (await hashCode(`page:${pw}`)) !== p.code_hash) return c.html(gatePage(slug, p.client_company || p.client_name, 'That password didn’t work. Check the message we sent and try again.'), 401, gateHeaders);
  const a = await signAccess(p.gate_secret, p.id);
  setCookie(c, PAGE_COOKIE(slug), a.value, { path: `/proposal/${slug}/`, httpOnly: true, secure: true, sameSite: 'Lax', expires: a.expires });
  return c.redirect(`/proposal/${slug}/`, 303);
});

proposalPages.get('/proposal/:slug', (c) => c.redirect(`/proposal/${cleanPageSlug(c.req.param('slug'))}/`, 301));
proposalPages.get('/proposal/:slug/*', async (c) => {
  const slug = cleanPageSlug(c.req.param('slug'));
  const p = await first<Record<string, any>>(c.env.DB, "SELECT id, status, revoked, client_name, client_company, first_viewed_at, code_hash, gate_secret FROM proposals WHERE page_slug = ? AND kind = 'link'", slug).catch(() => null);
  if (!p || p.revoked) return notFound(c);
  if (p.code_hash && !c.get('user') && !(await verifyAccess(p.gate_secret, p.id, getCookie(c, PAGE_COOKIE(slug))))) {
    return c.html(gatePage(slug, p.client_company || p.client_name), 401, gateHeaders);
  }
  const prefix = `/proposal/${c.req.param('slug')}/`;
  const rel = decodeURIComponent(c.req.path.slice(prefix.length)).split('/').filter((x) => x && x !== '.' && x !== '..').join('/');
  const key = !rel ? 'index.html' : rel.includes('.') ? rel : `${rel}/index.html`;
  const obj = await c.env.MEDIA.get(`proposal-pages/${slug}/${key}`);
  if (!obj) return key === 'index.html' ? notFound(c) : c.text('Not found', 404);
  const ct = obj.httpMetadata?.contentType || pageType(key);
  const html = ct.startsWith('text/html');
  if (html) await countOpen(c, p);
  const headers = new Headers({
    'content-type': ct, etag: obj.httpEtag, 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff',
    'cache-control': html ? 'private, no-cache' : 'public, max-age=300',
    'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation allow-modals',
    'referrer-policy': 'no-referrer',
  });
  if (key.endsWith('.pdf')) headers.set('content-disposition', `inline; filename="${key.split('/').pop()}"`);
  const res = new Response(obj.body, { headers });
  return html ? withFavicon(res) : res;
});

/** /p/<token> of a link proposal: count the open, then forward to the page. Built proposals fall through to client-docs. */
proposalPages.get('/p/:token', async (c, next) => {
  const p = await first<Record<string, any>>(c.env.DB, "SELECT id, status, revoked, link_url, page_slug, client_name, client_company, first_viewed_at FROM proposals WHERE token = ? AND kind = 'link'", c.req.param('token')).catch(() => null);
  if (!p) return next();
  if (p.revoked || !p.link_url) return notFound(c);
  if (!p.page_slug) await countOpen(c, p); // hosted pages count on arrival
  return c.redirect(p.link_url, 302);
});
