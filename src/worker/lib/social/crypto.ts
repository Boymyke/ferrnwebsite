/** AES-GCM encryption for OAuth tokens at rest. The key is derived from the SOCIAL_ENC_KEY secret
 *  with HKDF-SHA-256, so the raw secret never touches the cipher directly. */
import type { Bindings } from '../env';
import { SocialError } from './http';

const enc = new TextEncoder();
const dec = new TextDecoder();
let cached: { secret: string; key: CryptoKey } | null = null;

async function key(env: Bindings): Promise<CryptoKey> {
  const secret = env.SOCIAL_ENC_KEY;
  if (!secret || secret.length < 16) throw new SocialError('SOCIAL_ENC_KEY is not set (needs at least 16 characters). See docs/SOCIAL.md.', { retryable: false });
  if (cached?.secret === secret) return cached.key;
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ferrn-social-tokens'), info: enc.encode('aes-gcm-256/v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  cached = { secret, key: k };
  return k;
}

const b64 = (u: Uint8Array) => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(env: Bindings, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64(out);
}

export async function unseal<T = any>(env: Bindings, sealed: string): Promise<T> {
  const raw = unb64(sealed);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await key(env), raw.slice(12));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new SocialError('Stored token could not be decrypted (was SOCIAL_ENC_KEY changed?). Reconnect the account in Studio.', { retryable: false });
  }
}
