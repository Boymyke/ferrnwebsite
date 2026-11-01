import React, { useState } from 'react';
import { api } from '../api';

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-art" aria-hidden="true">
        <img src="/brand/ferrn-mark.svg" alt="" />
        <p>We build what’s next.</p>
      </div>
      <div className="auth-card">
        <img src="/brand/ferrn-logo.svg" alt="Ferrn" height="22" />
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Sign in to Ferrn Studio" sub="Leads, outreach, meetings, quotes, content and the website — in one place.">
      <form className="auth-form" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('');
        try { await api('/api/auth/login', { body: { email, password } }); onDone(); }
        catch (x: any) { setErr(x.message); } finally { setBusy(false); }
      }}>
        <label className="field wide"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field wide"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err ? <p className="error-note">{err}</p> : null}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">First time? The owner activates the account at <a href="/studio/setup">/studio/setup</a>. Everyone else uses the invite link they were sent.</p>
      </form>
    </Shell>
  );
}

export function Setup({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState({ secret: '', email: 'michael@ferrnagency.com', password: '', confirm: '' });
  const [err, setErr] = useState('');
  return (
    <Shell title="Activate the owner account" sub="One-time setup. You need the BOOTSTRAP_SECRET set in Cloudflare.">
      <form className="auth-form" onSubmit={async (e) => {
        e.preventDefault(); setErr('');
        if (v.password !== v.confirm) return setErr('Passwords do not match.');
        try { await api('/api/auth/setup', { body: v }); history.replaceState(null, '', '/studio'); onDone(); }
        catch (x: any) { setErr(x.message); }
      }}>
        <label className="field wide"><span>Setup key</span><input required value={v.secret} onChange={(e) => setV({ ...v, secret: e.target.value })} /></label>
        <label className="field wide"><span>Owner email</span><input type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label className="field wide"><span>Password (10+ characters, letters and numbers)</span><input type="password" autoComplete="new-password" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
        <label className="field wide"><span>Confirm password</span><input type="password" autoComplete="new-password" required value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} /></label>
        {err ? <p className="error-note">{err}</p> : null}
        <button className="btn primary block">Activate</button>
      </form>
    </Shell>
  );
}

export function AcceptInvite({ onDone }: { onDone: () => void }) {
  const token = location.hash.slice(1);
  const [v, setV] = useState({ name: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  return (
    <Shell title="Join Ferrn Studio" sub="Set your password. Every change you make will show your name.">
      <form className="auth-form" onSubmit={async (e) => {
        e.preventDefault(); setErr('');
        if (v.password !== v.confirm) return setErr('Passwords do not match.');
        try { await api('/api/auth/accept-invite', { body: { token, name: v.name, password: v.password } }); history.replaceState(null, '', '/studio'); onDone(); }
        catch (x: any) { setErr(x.message); }
      }}>
        <label className="field wide"><span>Your name (optional — keeps the one on your invite)</span><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label className="field wide"><span>Password</span><input type="password" autoComplete="new-password" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
        <label className="field wide"><span>Confirm password</span><input type="password" autoComplete="new-password" required value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} /></label>
        {err ? <p className="error-note">{err}</p> : null}
        <button className="btn primary block">Join</button>
      </form>
    </Shell>
  );
}
