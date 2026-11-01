import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, SessionUser } from './env';
import { first, run, randomToken } from './db';

const COOKIE = 'ferrn_session';
const SESSION_DAYS = 30;
const ITERATIONS = 100_000; // Workers' PBKDF2 ceiling

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sha256(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const bits = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mix letters and numbers.';
  return null;
}

export async function createSession(c: Context<AppEnv>, userId: string) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await run(c.env.DB,
    'INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
    await sha256(token), userId, expires.toISOString(),
    c.req.header('cf-connecting-ip') ?? '', (c.req.header('user-agent') ?? '').slice(0, 200));
  await run(c.env.DB, "UPDATE users SET last_login_at = datetime('now') WHERE id = ?", userId);
  setCookie(c, COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', expires,
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE);
  if (token) await run(c.env.DB, 'DELETE FROM sessions WHERE id = ?', await sha256(token));
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Attaches c.var.user when a valid session cookie is present. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null);
  const token = getCookie(c, COOKIE);
  if (token) {
    const row = await first<SessionUser & { expires_at: string; active: number }>(c.env.DB,
      `SELECT u.id, u.email, u.name, u.role, u.title, u.active, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, await sha256(token));
    if (row && row.active && new Date(row.expires_at) > new Date()) {
      c.set('user', { id: row.id, email: row.email, name: row.name, role: row.role, title: row.title });
    }
  }
  await next();
};

const RANK: Record<SessionUser['role'], number> = { viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4 };

export const requireUser = (minRole: SessionUser['role'] = 'viewer'): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: false, error: 'Sign in required' }, 401);
  if (RANK[user.role] < RANK[minRole]) return c.json({ ok: false, error: 'You do not have access to this' }, 403);
  // Mutations must come from our own origin (cookie is SameSite=Lax; this blocks cross-site form posts).
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) {
      return c.json({ ok: false, error: 'Bad origin' }, 403);
    }
  }
  await next();
};

export const canWrite = (u: SessionUser | null) => !!u && RANK[u.role] >= RANK.sales;
