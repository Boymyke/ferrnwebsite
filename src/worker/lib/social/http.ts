import type { Bindings } from '../env';
import { fakeFetch } from './fake';

/** A failure the scheduler understands. `retryable: false` fails the post at once; `needsMedia` parks it. */
export class SocialError extends Error {
  retryable: boolean;
  needsMedia: boolean;
  status?: number;
  constructor(message: string, opts: { retryable?: boolean; needsMedia?: boolean; status?: number } = {}) {
    super(redact(message));
    this.retryable = opts.retryable ?? true;
    this.needsMedia = opts.needsMedia ?? false;
    this.status = opts.status;
  }
}

/** Strips anything that looks like a token or signature from text we store or log. */
export function redact(s: string) {
  return String(s ?? '')
    .replace(/(access_token|refresh_token|client_secret|fb_exchange_token|oauth_signature|oauth_token|code)=([^&\s"']+)/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .replace(/"(access_token|refresh_token)"\s*:\s*"[^"]+"/g, '"$1":"[redacted]"')
    .slice(0, 900);
}

/** fetch with a timeout. With SOCIAL_FAKE_API=1 (local dev only) every platform call is answered by stubs. */
export async function sfetch(env: Bindings, url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  if (env.SOCIAL_FAKE_API === '1') return fakeFetch(env, url, init);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    throw new SocialError(`Network error calling ${new URL(url).host}: ${e?.name === 'AbortError' ? 'timed out' : e?.message ?? e}`);
  } finally { clearTimeout(t); }
}

/** Reads JSON and turns HTTP errors into SocialErrors (4xx except 408/429 are not retried). */
export async function json<T = any>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.detail ?? data?.title ?? data?.errors?.[0]?.message ?? data?.error_description ?? data?.raw ?? res.statusText;
    const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
    throw new SocialError(`${what} failed (${res.status}): ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, { retryable, status: res.status });
  }
  return data as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
