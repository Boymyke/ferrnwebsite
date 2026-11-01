import { ASSET_V } from '../version';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';

/**
 * Caching strategy
 *  1. /assets, /brand, /icons, /demos  → served by Workers Static Assets with long-lived
 *     immutable headers (see public/_headers) — never touch the Worker.
 *  2. Public HTML pages               → Cloudflare edge cache (caches.default), keyed by
 *     URL + language + a content version. Any CMS write bumps the version in KV, so the
 *     next request rebuilds the page. Signed-in users always bypass the cache.
 *  3. AI translations / chat answers  → KV with TTL.
 *  4. Studio PWA                      → service worker caches the app shell for offline use.
 */

let memo: { v: string; at: number } | null = null;

export async function contentVersion(env: AppEnv['Bindings']): Promise<string> {
  if (memo && Date.now() - memo.at < 30_000) return memo.v;
  const v = (await env.CACHE.get('content:version')) ?? '1';
  memo = { v, at: Date.now() };
  return v;
}

export async function bumpContentVersion(env: AppEnv['Bindings']) {
  const v = String(Date.now());
  await env.CACHE.put('content:version', v);
  memo = { v, at: Date.now() };
}

export const edgeCache = (ttlSeconds = 300): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (c.req.method !== 'GET' || c.get('user')) return next();
  const url = new URL(c.req.url);
  if (url.searchParams.has('nocache')) return next();
  const version = await contentVersion(c.env);
  url.searchParams.set('__v', version);
  url.searchParams.set('__l', c.get('lang'));
  url.searchParams.set('__a', ASSET_V);
  const key = new Request(url.toString(), { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('x-ferrn-cache', 'HIT');
    return res;
  }
  await next();
  if (c.res.status === 200 && (c.res.headers.get('content-type') ?? '').includes('text/html')) {
    const res = c.res.clone();
    const headers = new Headers(res.headers);
    headers.set('cache-control', `public, max-age=0, s-maxage=${ttlSeconds}`);
    c.executionCtx.waitUntil(cache.put(key, new Response(res.body, { status: 200, headers })));
    c.res.headers.set('x-ferrn-cache', 'MISS');
  }
};

export const noStore = (c: Context) => c.header('cache-control', 'no-store');
