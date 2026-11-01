import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { clamp, first, run } from '../lib/db';
import { createSession, destroySession, hashPassword, passwordProblem, sha256, verifyPassword } from '../lib/auth';
import { audit } from '../lib/audit';

const auth = new Hono<AppEnv>();

async function slow(c: any) {
  const ip = c.req.header('cf-connecting-ip') ?? 'anon';
  const key = `rl:login:${ip}:${Math.floor(Date.now() / 900_000)}`;
  const n = Number((await c.env.CACHE.get(key)) ?? 0) + 1;
  await c.env.CACHE.put(key, String(n), { expirationTtl: 900 });
  return n > 10;
}

auth.get('/me', (c) => c.json({ ok: true, user: c.get('user') }));

auth.post('/login', async (c) => {
  if (await slow(c)) return c.json({ ok: false, error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const b = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
  const u = await first<any>(c.env.DB, 'SELECT * FROM users WHERE email = ? AND active = 1', clamp(b.email, 200).toLowerCase());
  if (!u || !(await verifyPassword(String(b.password ?? ''), u.password_hash))) {
    return c.json({ ok: false, error: 'Wrong email or password.' }, 401);
  }
  await createSession(c, u.id);
  c.set('user', { id: u.id, email: u.email, name: u.name, role: u.role, title: u.title });
  await audit(c, 'users', u.id, 'login', `${u.name} signed in`);
  return c.json({ ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, title: u.title } });
});

auth.post('/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

/** First-time owner setup. Works only while the owner has no password, and only with BOOTSTRAP_SECRET. */
auth.post('/setup', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { secret?: string; email?: string; password?: string };
  if (!c.env.BOOTSTRAP_SECRET || b.secret !== c.env.BOOTSTRAP_SECRET) return c.json({ ok: false, error: 'Setup key is not valid.' }, 403);
  const owner = await first<any>(c.env.DB, "SELECT * FROM users WHERE role = 'owner' ORDER BY created_at LIMIT 1");
  if (!owner) return c.json({ ok: false, error: 'No owner account in the database.' }, 500);
  if (owner.password_hash) return c.json({ ok: false, error: 'Setup has already been completed. Sign in instead.' }, 409);
  const problem = passwordProblem(String(b.password ?? ''));
  if (problem) return c.json({ ok: false, error: problem }, 422);
  const email = clamp(b.email, 200).toLowerCase() || owner.email;
  await run(c.env.DB, 'UPDATE users SET email = ?, password_hash = ? WHERE id = ?', email, await hashPassword(String(b.password)), owner.id);
  await createSession(c, owner.id);
  c.set('user', { id: owner.id, email, name: owner.name, role: owner.role, title: owner.title });
  await audit(c, 'users', owner.id, 'setup', 'Owner account activated');
  return c.json({ ok: true });
});

/** Accepting an invite link created in Studio → Team & access. */
auth.post('/accept-invite', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { token?: string; password?: string; name?: string };
  const u = await first<any>(c.env.DB, 'SELECT * FROM users WHERE invite_hash = ?', await sha256(String(b.token ?? '')));
  if (!u || !u.invite_expires_at || new Date(u.invite_expires_at) < new Date()) return c.json({ ok: false, error: 'This invite link has expired. Ask for a new one.' }, 410);
  const problem = passwordProblem(String(b.password ?? ''));
  if (problem) return c.json({ ok: false, error: problem }, 422);
  await run(c.env.DB, 'UPDATE users SET password_hash = ?, invite_hash = NULL, invite_expires_at = NULL, name = COALESCE(NULLIF(?, \'\'), name), active = 1 WHERE id = ?',
    await hashPassword(String(b.password)), clamp(b.name, 120), u.id);
  await createSession(c, u.id);
  c.set('user', { id: u.id, email: u.email, name: u.name, role: u.role, title: u.title });
  await audit(c, 'users', u.id, 'accept_invite', `${u.name} joined the Studio`);
  return c.json({ ok: true });
});

auth.post('/password', async (c) => {
  const me = c.get('user');
  if (!me) return c.json({ ok: false, error: 'Sign in required' }, 401);
  const b = (await c.req.json().catch(() => ({}))) as { current?: string; password?: string };
  const u = await first<any>(c.env.DB, 'SELECT password_hash FROM users WHERE id = ?', me.id);
  if (!(await verifyPassword(String(b.current ?? ''), u?.password_hash))) return c.json({ ok: false, error: 'Current password is wrong.' }, 403);
  const problem = passwordProblem(String(b.password ?? ''));
  if (problem) return c.json({ ok: false, error: problem }, 422);
  await run(c.env.DB, 'UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(String(b.password)), me.id);
  await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', me.id);
  await createSession(c, me.id);
  await audit(c, 'users', me.id, 'password', `${me.name} changed their password`);
  return c.json({ ok: true });
});

export default auth;
