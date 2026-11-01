import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity } from 'lucide-react';
import { api, can, type User } from './api';
import { Link, RouterCtx, ToastHost, UserCtx, useRoute, useUser } from './ui';
import { AcceptInvite, Login, Setup } from './pages/auth';
import { Dashboard } from './pages/dashboard';
import { Leads, Prospect } from './pages/leads';
import { Outreach } from './pages/outreach';
import { Meetings } from './pages/meetings';
import { Quotes } from './pages/quotes';
import { Ads, Knowledge, Orders, Posts, Products, Requests, Testimonials, TeamMembers } from './pages/catalog';
import { Content } from './pages/content';
import { CarouselStudio } from './pages/carousel';
import { WhatsApp } from './pages/whatsapp';
import { Settings, TeamAccess } from './pages/team';
import { Analytics } from './pages/analytics';

const NAV: { group: string; items: [string, string, React.ReactNode, User['role']?][] }[] = [
  { group: 'Main', items: [['/', 'Dashboard', '▦'], ['/analytics', 'Analytics', <Activity size={17} strokeWidth={1.8} />], ['/leads', 'Leads', '◎'], ['/prospect', 'Find leads', '⌕'], ['/outreach', 'Outreach', '✉'], ['/whatsapp', 'WhatsApp', '✆'], ['/meetings', 'Meetings', '◷'], ['/quotes', 'Quotes', '₦']] },
  { group: 'Marketing', items: [['/content', 'Content', '✎'], ['/ads', 'Ads', '◆']] },
  { group: 'Marketplace', items: [['/marketplace/products', 'Products', '▤'], ['/marketplace/orders', 'Orders', '◫'], ['/marketplace/requests', 'Enquiries', '✦']] },
  { group: 'Website', items: [['/website/team', 'Team page', '☺'], ['/website/testimonials', 'Testimonials', '❝'], ['/website/posts', 'Insights', '¶'], ['/website/knowledge', 'Chatbot knowledge', '◐']] },
  { group: 'Workspace', items: [['/team', 'Team & access', '⚑'], ['/settings', 'Settings', '⚙']] },
];

function Router() {
  const { path } = useRoute();
  const p = path.split('?')[0];
  if (p === '/') return <Dashboard />;
  if (p.startsWith('/analytics')) return <Analytics />;
  if (p.startsWith('/leads')) return <Leads />;
  if (p.startsWith('/prospect')) return <Prospect />;
  if (p.startsWith('/outreach')) return <Outreach />;
  if (p.startsWith('/whatsapp')) return <WhatsApp />;
  if (p.startsWith('/meetings')) return <Meetings />;
  if (p.startsWith('/quotes')) return <Quotes />;
  if (p.startsWith('/content')) return <Content />;
  if (p.startsWith('/carousel')) return <CarouselStudio />;
  if (p.startsWith('/ads')) return <Ads />;
  if (p.startsWith('/marketplace/products')) return <Products />;
  if (p.startsWith('/marketplace/orders')) return <Orders />;
  if (p.startsWith('/marketplace/requests')) return <Requests />;
  if (p.startsWith('/website/team')) return <TeamMembers />;
  if (p.startsWith('/website/testimonials')) return <Testimonials />;
  if (p.startsWith('/website/posts')) return <Posts />;
  if (p.startsWith('/website/knowledge')) return <Knowledge />;
  if (p.startsWith('/team')) return <TeamAccess />;
  if (p.startsWith('/settings')) return <Settings />;
  return <Dashboard />;
}

function Shell({ onSignOut }: { onSignOut: () => void }) {
  const user = useUser()!;
  const { go, path } = useRoute();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.getElementById('global-search')?.focus(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  const crumb = NAV.flatMap((g) => g.items).find(([to]) => to !== '/' && path.startsWith(to))?.[1] ?? (path.startsWith('/carousel') ? 'Carousel slides' : 'Dashboard');
  return (
    <div className={`app ${menu ? 'menu-open' : ''}`}>
      <aside className="side">
        <div className="side-brand"><img src="/icons/appicon.svg" alt="" width="40" height="40" /><span>Ferrn Studio</span></div>
        <form className="side-search" onSubmit={(e) => { e.preventDefault(); if (q) go(`/leads?q=${encodeURIComponent(q)}`); }}>
          <input id="global-search" placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} /><kbd>⌘K</kbd>
        </form>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="side-group">
              <span className="side-label">{g.group}</span>
              {g.items.filter(([, , , role]) => !role || can(user, role)).map(([to, label, icon]) => (
                <Link key={to} to={to} className="side-link"><i>{icon}</i>{label}</Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <a className="side-link" href="/" target="_blank" rel="noreferrer"><i>↗</i>View website</a>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <button className="icon menu" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
          <div className="crumbs"><span className="muted">Ferrn</span> › <strong>{crumb}</strong></div>
          <div className="top-actions">
            <button className="icon" title="Theme" onClick={() => {
              const d = document.documentElement; const n = d.dataset.theme === 'light' ? 'dark' : 'light'; d.dataset.theme = n;
              try { localStorage.setItem('ferrn-studio-theme', n); } catch {}
            }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></svg></button>
            <div className="me">
              <span className="me-avatar">{user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <div><strong>{user.name}</strong><span>{user.title || user.role}</span></div>
              <button className="btn sm ghost" onClick={onSignOut}>Sign out</button>
            </div>
          </div>
        </header>
        <main className="content"><Router /></main>
      </div>
    </div>
  );
}

function App() {
  const [path, setPath] = useState(() => location.pathname.replace(/^\/studio/, '') + location.search || '/');
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const go = useCallback((to: string) => { history.pushState(null, '', '/studio' + (to === '/' ? '' : to)); setPath(to); scrollTo(0, 0); }, []);
  const load = useCallback(() => api('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)), []);
  useEffect(() => {
    load();
    const pop = () => setPath(location.pathname.replace(/^\/studio/, '') + location.search || '/');
    const out = () => setUser(null);
    addEventListener('popstate', pop); addEventListener('ferrn:signed-out', out);
    let deferred: any = null;
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; (window as any).ferrnInstall = () => deferred?.prompt(); });
    return () => { removeEventListener('popstate', pop); removeEventListener('ferrn:signed-out', out); };
  }, [load]);
  const p = path.split('?')[0];
  let body: React.ReactNode;
  if (user === undefined) body = <div className="boot"><img src="/brand/ferrn-mark.svg" width="56" alt="" /></div>;
  else if (p === '/setup') body = <Setup onDone={() => { load(); setPath('/'); }} />;
  else if (p === '/invite') body = <AcceptInvite onDone={() => { load(); setPath('/'); }} />;
  else if (!user) body = <Login onDone={load} />;
  else body = <Shell onSignOut={async () => { await api('/api/auth/logout', { body: {} }); setUser(null); }} />;
  return (
    <RouterCtx.Provider value={{ path, go }}>
      <UserCtx.Provider value={user ?? null}>
        <ToastHost>{body}</ToastHost>
      </UserCtx.Provider>
    </RouterCtx.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
