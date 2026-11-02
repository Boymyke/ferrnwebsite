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
import { Proposals } from './pages/proposals';
import { FileSignature } from 'lucide-react';
import { Ads, Knowledge, Orders, Posts, Products, Requests, Testimonials, TeamMembers } from './pages/catalog';
import { Content } from './pages/content';
import { CarouselStudio } from './pages/carousel';
import { WhatsApp } from './pages/whatsapp';
import { Settings, TeamAccess } from './pages/team';
import { Demos } from './pages/demos';
import { Analytics } from './pages/analytics';
import {
  LayoutDashboard, Users, Radar, Send, MessageCircle, CalendarClock, Receipt, PenSquare, Megaphone, Package, ShoppingBag, Inbox,
  UserSquare2, Quote, Newspaper, BrainCircuit, ShieldCheck, Settings as SettingsIcon, ExternalLink, Menu, MonitorPlay, SunMoon, Search, LogOut,
} from 'lucide-react';

const I = (C: React.ComponentType<any>) => <C size={17} strokeWidth={1.8} aria-hidden="true" />;

const NAV: { group: string; items: [string, string, React.ReactNode, User['role']?][] }[] = [
  { group: 'Main', items: [['/', 'Dashboard', I(LayoutDashboard)], ['/analytics', 'Analytics', I(Activity)], ['/leads', 'Leads', I(Users)], ['/prospect', 'Find leads', I(Radar)], ['/outreach', 'Outreach', I(Send)], ['/whatsapp', 'WhatsApp', I(MessageCircle)], ['/meetings', 'Meetings', I(CalendarClock)], ['/quotes', 'Quotes', I(Receipt)], ['/proposals', 'Proposals', I(FileSignature)]] },
  { group: 'Marketing', items: [['/content', 'Content', I(PenSquare)], ['/ads', 'Ads', I(Megaphone)]] },
  { group: 'Marketplace', items: [['/marketplace/products', 'Products', I(Package)], ['/marketplace/demos', 'Demos', I(MonitorPlay)], ['/marketplace/orders', 'Orders', I(ShoppingBag)], ['/marketplace/requests', 'Enquiries', I(Inbox)]] },
  { group: 'Website', items: [['/website/team', 'Team page', I(UserSquare2)], ['/website/testimonials', 'Testimonials', I(Quote)], ['/website/posts', 'Insights', I(Newspaper)], ['/website/knowledge', 'Chatbot knowledge', I(BrainCircuit)]] },
  { group: 'Workspace', items: [['/team', 'Team & access', I(ShieldCheck)], ['/settings', 'Settings', I(SettingsIcon)]] },
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
  if (p.startsWith('/proposals')) return <Proposals />;
  if (p.startsWith('/content')) return <Content />;
  if (p.startsWith('/carousel')) return <CarouselStudio />;
  if (p.startsWith('/ads')) return <Ads />;
  if (p.startsWith('/marketplace/products')) return <Products />;
  if (p.startsWith('/marketplace/demos')) return <Demos />;
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
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.getElementById('global-search')?.focus(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  const crumb = NAV.flatMap((g) => g.items).find(([to]) => to !== '/' && path.startsWith(to))?.[1] ?? (path.startsWith('/carousel') ? 'Carousel slides' : 'Dashboard');
  return (
    <div className={`app ${menu ? 'menu-open' : ''}`}>
      <div className="side-scrim" onClick={() => setMenu(false)} aria-hidden="true" />
      <aside className="side" onTouchStart={(e) => { (e.currentTarget as any)._x = e.touches[0].clientX; }} onTouchEnd={(e) => { const x0 = (e.currentTarget as any)._x; if (x0 != null && x0 - e.changedTouches[0].clientX > 60) setMenu(false); }}>
        <div className="side-brand"><img src="/icons/appicon.svg" alt="" width="40" height="40" /><span>Ferrn Studio</span></div>
        <form className="side-search" onSubmit={(e) => { e.preventDefault(); if (q) go(`/leads?q=${encodeURIComponent(q)}`); }}>
          <Search className="side-search-ic" size={15} strokeWidth={2} aria-hidden="true" /><input id="global-search" placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} /><kbd>⌘K</kbd>
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
          <a className="side-link" href="/" target="_blank" rel="noreferrer"><i>{I(ExternalLink)}</i>View website</a>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <button className="icon menu" onClick={() => setMenu(!menu)} aria-label="Menu"><Menu size={18} strokeWidth={1.8} /></button>
          <div className="crumbs"><span className="muted">Ferrn</span> › <strong>{crumb}</strong></div>
          <div className="top-actions">
            <button className="icon" title="Theme" onClick={() => {
              const d = document.documentElement; const n = d.dataset.theme === 'light' ? 'dark' : 'light'; d.dataset.theme = n;
              try { localStorage.setItem('ferrn-studio-theme', n); } catch {}
            }}><SunMoon size={18} strokeWidth={1.8} /></button>
            <div className="me">
              <span className="me-avatar">{user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <div><strong>{user.name}</strong><span>{user.title || user.role}</span></div>
              <button className="btn sm ghost" onClick={onSignOut}><LogOut size={14} strokeWidth={2} />Sign out</button>
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
