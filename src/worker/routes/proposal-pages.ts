/**
 * Hosted proposal pages: a page built outside Studio (like the Ataam or Splendid Freight proposals) uploaded to a
 * "link" proposal and served at /proposal/<slug>/ from R2 proposal-pages/<slug>/. Opens are counted on the proposal
 * (not when a signed-in team member views it), and /p/<token> of a link proposal forwards to its link.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { first, run } from '../lib/db';
import { addEvent } from '../lib/docs';
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

proposalPages.get('/proposal/:slug', (c) => c.redirect(`/proposal/${cleanPageSlug(c.req.param('slug'))}/`, 301));
proposalPages.get('/proposal/:slug/*', async (c) => {
  const slug = cleanPageSlug(c.req.param('slug'));
  const p = await first<Record<string, any>>(c.env.DB, "SELECT id, status, revoked, client_name, client_company, first_viewed_at FROM proposals WHERE page_slug = ? AND kind = 'link'", slug).catch(() => null);
  if (!p || p.revoked) return notFound(c);
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
