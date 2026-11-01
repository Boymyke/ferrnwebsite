/**
 * X (Twitter) API v2 connector. OAuth 1.0a user context (HMAC-SHA1 via WebCrypto) with the app's
 * consumer keys and the @ferrn account's access token/secret.
 * Docs: https://docs.x.com/x-api/posts/manage-tweets/integrate · https://docs.x.com/x-api/media/introduction
 * Pricing is pay-per-use (docs.x.com/x-api/getting-started/pricing): every call here costs credits.
 */
import type { Bindings } from '../env';
import type { Connector, MediaItem, MetricsResult, PostRow, PublishCtx, PublishResult } from './common';
import { json, sfetch, sleep, SocialError } from './http';

const API = 'https://api.x.com';

/* ── OAuth 1.0a ── */
const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  let s = ''; for (const c of sig) s += String.fromCharCode(c);
  return btoa(s);
}

/** Builds the Authorization header. Query params (and form-urlencoded body params) are signed; JSON and multipart bodies are not. */
export async function oauth1Header(
  creds: { key: string; secret: string; token: string; tokenSecret: string },
  method: string, url: string, formParams: Record<string, string> = {},
  fixed?: { nonce: string; timestamp: string },
) {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.key,
    oauth_nonce: fixed?.nonce ?? crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: fixed?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: '1.0',
  };
  const params: [string, string][] = [];
  for (const [k, v] of Object.entries(oauth)) params.push([pct(k), pct(v)]);
  u.searchParams.forEach((v, k) => params.push([pct(k), pct(v)]));
  for (const [k, v] of Object.entries(formParams)) params.push([pct(k), pct(v)]);
  params.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const base = [method.toUpperCase(), pct(`${u.protocol}//${u.host}${u.pathname}`), pct(params.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
  const signature = await hmacSha1(`${pct(creds.secret)}&${pct(creds.tokenSecret)}`, base);
  const all = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.entries(all).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
}

const creds = (env: Bindings) => {
  if (!env.X_API_KEY || !env.X_API_SECRET || !env.X_ACCESS_TOKEN || !env.X_ACCESS_SECRET) {
    throw new SocialError('X is not connected: set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_SECRET.', { retryable: false });
  }
  return { key: env.X_API_KEY, secret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET };
};

async function xcall(env: Bindings, method: string, url: string, body?: { json?: unknown; form?: FormData }, what = 'X request') {
  const headers: Record<string, string> = { authorization: await oauth1Header(creds(env), method, url) };
  if (body?.json !== undefined) headers['content-type'] = 'application/json';
  const res = await sfetch(env, url, { method, headers, body: body?.form ?? (body?.json !== undefined ? JSON.stringify(body.json) : undefined) }, 60_000);
  if (res.status === 403) {
    const t = await res.clone().text();
    if (/client-not-enrolled|not permitted|oauth1-permissions|Unsupported Authentication/i.test(t)) {
      throw new SocialError(`${what} was refused by X (403). Check the app has "Read and write" permission, credits in the Developer Console, and regenerate the access token after changing permissions.`, { retryable: false, status: 403 });
    }
  }
  return json(res, what);
}

/* ── text ── */
/** X counts most Latin text as 1 and CJK/emoji as 2; every URL counts as 23. */
export function xLength(text: string) {
  const t = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
  let n = 0;
  for (const ch of t) {
    const cp = ch.codePointAt(0)!;
    n += cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037) ? 1 : 2;
  }
  return n;
}

/** Splits a numbered thread ("1/ …", "2/ …" at the start of a line) into posts; anything before "1/" joins the first post. */
export function splitThread(body: string, hashtags = '', max = 280): string[] {
  const lines = String(body ?? '').replace(/\r/g, '').split('\n');
  const parts: string[][] = [];
  let pre: string[] = [];
  for (const l of lines) {
    if (/^\s*\d{1,2}\/(\d{1,2})?(\s|$)/.test(l)) parts.push([l]);
    else if (parts.length) parts[parts.length - 1].push(l);
    else pre.push(l);
  }
  let out = parts.length ? parts.map((p) => p.join('\n').trim()) : [pre.join('\n').trim()];
  if (parts.length && pre.join('').trim()) out[0] = `${pre.join('\n').trim()}\n${out[0]}`;
  out = out.filter(Boolean);
  const tags = hashtags.trim();
  if (tags && out.length) {
    const last = out.length - 1;
    if (xLength(`${out[last]}\n\n${tags}`) <= max) out[last] = `${out[last]}\n\n${tags}`;
  }
  return out;
}

/* ── media ── */
async function mediaBytes(env: Bindings, m: MediaItem): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (m.key) {
    const obj = await env.MEDIA.get(m.key);
    if (obj) return { bytes: await obj.arrayBuffer(), type: obj.httpMetadata?.contentType || m.mime || 'application/octet-stream' };
  }
  const res = await sfetch(env, m.public_url);
  if (!res.ok) throw new SocialError(`Could not read media ${m.url} (${res.status})`, { retryable: res.status >= 500 });
  return { bytes: await res.arrayBuffer(), type: res.headers.get('content-type') || m.mime || 'application/octet-stream' };
}

async function uploadImage(env: Bindings, m: MediaItem): Promise<string> {
  const { bytes, type } = await mediaBytes(env, m);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new SocialError(`Image ${m.url.split('/').pop()} is over X's 5 MB limit.`, { retryable: false });
  const form = new FormData();
  form.append('media', new Blob([bytes], { type }), 'image');
  form.append('media_category', type === 'image/gif' ? 'tweet_gif' : 'tweet_image');
  const r = await xcall(env, 'POST', `${API}/2/media/upload`, { form }, 'X image upload');
  return String(r?.data?.id ?? r?.media_id_string);
}

/** Chunked video upload (initialize → append 4 MB parts → finalize). Reads R2 by range so memory stays small. */
async function uploadVideo(env: Bindings, m: MediaItem): Promise<string> {
  const head = m.key ? await env.MEDIA.head(m.key) : null;
  if (!head || !m.key) throw new SocialError(`Video ${m.url} must be uploaded to Studio media (R2) first.`, { retryable: false, needsMedia: true });
  const total = head.size;
  const type = head.httpMetadata?.contentType || m.mime || 'video/mp4';
  const init = await xcall(env, 'POST', `${API}/2/media/upload/initialize`, { json: { media_type: type, total_bytes: total, media_category: 'tweet_video' } }, 'X video init');
  const id = String(init?.data?.id);
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, off = 0; off < total; i++, off += CHUNK) {
    const part = await env.MEDIA.get(m.key, { range: { offset: off, length: Math.min(CHUNK, total - off) } });
    if (!part) throw new SocialError('Video disappeared from storage during upload.');
    const form = new FormData();
    form.append('media', new Blob([await part.arrayBuffer()], { type: 'application/octet-stream' }), 'chunk');
    form.append('segment_index', String(i));
    await xcall(env, 'POST', `${API}/2/media/upload/${id}/append`, { form }, `X video append ${i}`);
  }
  await xcall(env, 'POST', `${API}/2/media/upload/${id}/finalize`, { json: {} }, 'X video finalize');
  return id;
}

/** 'ready' | 'pending' | throws when X rejected the media. */
async function mediaReady(env: Bindings, id: string): Promise<'ready' | 'pending'> {
  const r = await xcall(env, 'GET', `${API}/2/media/upload?command=STATUS&media_id=${id}`, undefined, 'X media status');
  const p = r?.data?.processing_info;
  if (!p || p.state === 'succeeded') return 'ready';
  if (p.state === 'failed') throw new SocialError(`X could not process the video: ${p.error?.message ?? 'unknown error'}`, { retryable: false });
  return 'pending';
}

export const x: Connector = {
  platform: 'x',
  async configured(env) { return !!(env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET); },

  async publish(env, post: PostRow, media: MediaItem[], ctx: PublishCtx): Promise<PublishResult> {
    const max = Number(env.X_MAX_CHARS || 280);
    const parts = splitThread(post.body ?? post.title ?? '', post.hashtags ?? '', max);
    if (!parts.length) throw new SocialError('Nothing to post: the body is empty.', { retryable: false });
    parts.forEach((p, i) => {
      const n = xLength(p);
      if (n > max) throw new SocialError(`Post ${i + 1} of the thread is ${n} characters (X allows ${max}). Shorten it or split it with "${i + 2}/".`, { retryable: false });
    });
    const ref = { ...ctx.ref } as { media_ids?: string[]; tweet_ids?: string[] };

    // 1. media (once; kept in publish_ref so a retry does not upload again)
    if (!ref.media_ids) {
      const video = media.find((m) => m.type === 'video');
      const ids = video ? [await uploadVideo(env, video)] : await Promise.all(media.filter((m) => m.type === 'image').slice(0, 4).map((m) => uploadImage(env, m)));
      ref.media_ids = ids;
      await ctx.save(ref);
    }
    for (const id of ref.media_ids) {
      let state = await mediaReady(env, id);
      for (let i = 0; state === 'pending' && i < 6; i++) { await sleep(5000); state = await mediaReady(env, id); }
      if (state === 'pending') return { state: 'pending', ref, note: 'X is still processing the video' };
    }

    // 2. the thread, resuming after the last post that went out
    ref.tweet_ids ??= [];
    for (let i = ref.tweet_ids.length; i < parts.length; i++) {
      const payload: Record<string, unknown> = { text: parts[i] };
      if (i === 0 && ref.media_ids.length) payload.media = { media_ids: ref.media_ids };
      if (i > 0) payload.reply = { in_reply_to_tweet_id: ref.tweet_ids[i - 1] };
      const r = await xcall(env, 'POST', `${API}/2/tweets`, { json: payload }, `X post ${i + 1}/${parts.length}`);
      ref.tweet_ids.push(String(r.data.id));
      await ctx.save(ref);
    }
    const id = ref.tweet_ids[0];
    return { state: 'done', external_id: id, url: `https://x.com/i/status/${id}`, note: parts.length > 1 ? `Thread of ${parts.length} posts` : undefined };
  },

  /** public_metrics always; non_public_metrics (link/profile clicks) only for own posts under 30 days. Fails soft if the plan forbids reads. */
  async fetchMetrics(env, refs): Promise<MetricsResult> {
    const out: MetricsResult = {};
    for (let i = 0; i < refs.length; i += 100) {
      const batch = refs.slice(i, i + 100);
      const ids = batch.map((r) => r.external_id).join(',');
      let data: any;
      try { data = await xcall(env, 'GET', `${API}/2/tweets?ids=${ids}&tweet.fields=public_metrics,non_public_metrics,created_at`, undefined, 'X metrics'); }
      catch { data = await xcall(env, 'GET', `${API}/2/tweets?ids=${ids}&tweet.fields=public_metrics,created_at`, undefined, 'X metrics'); }
      for (const t of data?.data ?? []) {
        const p = t.public_metrics ?? {}; const np = t.non_public_metrics ?? {};
        const post = batch.find((b) => b.external_id === t.id);
        if (!post) continue;
        out[post.post_id] = {
          impressions: p.impression_count ?? np.impression_count ?? null, reach: null, views: null,
          likes: p.like_count ?? 0, comments: p.reply_count ?? 0, shares: (p.retweet_count ?? 0) + (p.quote_count ?? 0), saves: p.bookmark_count ?? 0,
          clicks: np.url_link_clicks != null || np.user_profile_clicks != null ? (np.url_link_clicks ?? 0) + (np.user_profile_clicks ?? 0) : null,
          raw: { public_metrics: p, non_public_metrics: t.non_public_metrics ?? null },
        };
      }
    }
    return out;
  },

  async accountStats(env) {
    const r = await xcall(env, 'GET', `${API}/2/users/me?user.fields=public_metrics`, undefined, 'X account');
    const m = r?.data?.public_metrics ?? {};
    return { followers: m.followers_count ?? null, following: m.following_count ?? null, posts: m.tweet_count ?? null, raw: { username: r?.data?.username, ...m } };
  },
};
