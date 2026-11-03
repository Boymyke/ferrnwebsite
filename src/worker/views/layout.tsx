import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import { LANGS, t, type Lang } from '../content/i18n';
import { SOCIALS } from '../content/site';
import { icon } from '../lib/icons';
import type { SiteCtx } from '../lib/content';
import { ASSET_V } from '../version';

export const href = (lang: Lang, path: string) => (lang === 'en' ? path : `/${lang}${path === '/' ? '/' : path}`);
export const SITE = 'https://www.ferrnagency.com';
export const MARK_PATH = 'M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z';

type LayoutProps = {
  lang: Lang; path: string; title: string; description: string; children: Child;
  ctx?: SiteCtx; schema?: unknown; noindex?: boolean; ogImage?: string; theme?: 'dark' | 'light'; preloadImage?: string;
  /** page family for the transition + nav state */
  kind?: string; intro?: boolean;
};

export function Layout(p: LayoutProps) {
  const L = LANGS.find((l) => l.code === p.lang)!;
  const canonical = SITE + href(p.lang, p.path);
  const ctx = p.ctx;
  const strings = {
    title: ctx?.get('bob.name') ?? 'Bob', placeholder: t(p.lang, 'chat.placeholder'), welcome: ctx?.get('bob.welcome') ?? t(p.lang, 'chat.welcome'),
    voice: t(p.lang, 'chat.voice'), send: t(p.lang, 'chat.send'), mic: t(p.lang, 'chat.mic'), sent: t(p.lang, 'form.sent'), error: t(p.lang, 'form.error'),
  };
  const season = ctx?.season;
  const bob = ctx?.bob;
  return (
    <html lang={L.bcp} dir={L.dir} data-theme={p.theme ?? 'dark'} data-page={p.kind ?? 'page'} data-season={season?.preset ?? undefined} style={season?.accent ? `--accent:${season.accent}` : undefined}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <title>{p.title}</title>
        <meta name="description" content={p.description} />
        <meta name="robots" content={p.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />
        <link rel="canonical" href={canonical} />
        {LANGS.map((l) => <link rel="alternate" hreflang={l.code} href={SITE + href(l.code, p.path)} />)}
        <link rel="alternate" hreflang="x-default" href={SITE + p.path} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ferrn Digital Agency" />
        <meta property="og:title" content={p.title} />
        <meta property="og:description" content={p.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={p.ogImage ?? `${SITE}/brand/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="view-transition" content="same-origin" />
        <link rel="icon" href="/icons/ferrn-favicon-black-animated-shine.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preload" href="/fonts/poppins-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="preload" href="/fonts/poppins-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin="" />
        {p.preloadImage ? <link rel="preload" href={p.preloadImage} as="image" fetchpriority="high" /> : null}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        {raw(`<script>window.ferrnLoadGA=function(){if(window.__ga||!/(^|\\.)ferrnagency\\.com$/.test(location.hostname))return;window.__ga=1;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-XYT9F1DHSF';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-XYT9F1DHSF',{anonymize_ip:true});};try{if(localStorage.getItem('ferrn-consent')==='all')window.ferrnLoadGA();}catch(e){}</script>`)}
        <link rel="stylesheet" href={`/assets/site.css?v=${ASSET_V}`} />
        {raw(`<script>(function(){try{var d=document.documentElement,t=localStorage.getItem('ferrn-theme');if(t)d.dataset.theme=t;d.classList.add('js');${p.intro ? "if(!sessionStorage.getItem('ferrn-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('play-intro');" : ''}}catch(e){}})();</script>`)}
        {p.schema ? raw(`<script type="application/ld+json">${JSON.stringify(p.schema).replace(/</g, '\\u003c')}</script>`) : null}
        <script src={`/assets/site.js?v=${ASSET_V}`} defer></script>
      </head>
      <body data-lang={p.lang} data-i18n={JSON.stringify(strings)} data-idle={ctx?.get('idle.enabled') === '0' ? '0' : (ctx?.get('idle.seconds') ?? '45')}>
        {p.intro ? <Intro lang={p.lang} /> : null}
        <div class="grain" aria-hidden="true"></div>
        {season?.banner_text ? (
          <div class="season-banner" role="region" aria-label="Announcement">
            {season.banner_url ? <a href={season.banner_url}>{season.banner_text} {icon('arrow-up-right', { size: 14 })}</a> : <span>{season.banner_text}</span>}
          </div>
        ) : null}
        {season?.effect && season.effect !== 'none' ? <div class={`season-fx fx-${season.effect}`} aria-hidden="true"></div> : null}
        <Nav lang={p.lang} path={p.path} ctx={ctx} />
        <main id="main" data-read-root>{p.children}</main>
        <Footer lang={p.lang} path={p.path} ctx={ctx} />
        {bob?.enabled !== false ? <BobMount lang={p.lang} ctx={ctx} /> : null}
        <Idle ctx={ctx} />
        <div class="consent" id="consent" role="region" aria-label={t(p.lang, 'consent.policy')} hidden>
          <p>{t(p.lang, 'consent.text')} <a href={href(p.lang, '/policies/cookie-policy')}>{t(p.lang, 'consent.policy')}</a></p>
          <div><button type="button" class="btn btn-ghost btn-sm" data-consent="necessary">{t(p.lang, 'consent.necessary')}</button><button type="button" class="btn btn-primary btn-sm" data-consent="all">{t(p.lang, 'consent.accept')}</button></div>
        </div>
      </body>
    </html>
  );
}

/** Opening sequence: the mark draws, fills and grows into the page. Once per session. */
function Intro({ lang }: { lang: Lang }) {
  return (
    <div class="intro" aria-hidden="true">
      <svg class="intro-mark" viewBox="-20 -20 204 204" width="88" height="88"><path class="intro-mark-path" d={MARK_PATH} /></svg>
      <button class="intro-skip" type="button" data-intro-skip>{t(lang, 'skip')}</button>
    </div>
  );
}

function Nav({ lang, path, ctx }: { lang: Lang; path: string; ctx?: SiteCtx }) {
  const links: [string, string][] = [['/work', 'nav.work'], ['/services', 'nav.services'], ['/marketplace', 'nav.marketplace'], ['/about', 'nav.about'], ['/insights', 'nav.insights']];
  const cta = ctx?.get('nav.cta') ?? t(lang, 'cta.start');
  return (
    <header class="nav-shell" data-nav>
      <a class="skip-link" href="#main">Skip to content</a>
      <nav class="nav" aria-label="Primary">
        <a class="brand" href={href(lang, '/')} aria-label="Ferrn Digital Agency home">
          <svg viewBox="0 0 164 164" width="26" height="26" aria-hidden="true"><path d={MARK_PATH} fill="currentColor" /></svg>
          <span>Ferrn</span>
        </a>
        <div class="nav-links">
          {links.map(([p, k]) => <a href={href(lang, p)} aria-current={path === p || (p !== '/' && path.startsWith(p + '/')) ? 'page' : undefined}><span>{t(lang, k)}</span></a>)}
        </div>
        <div class="nav-actions">
          <button class="icon-btn" type="button" data-theme-toggle aria-label={t(lang, 'theme.toggle')}>{icon('sun-moon', { size: 18 })}</button>
          <a class="btn btn-primary btn-sm nav-cta" href={href(lang, '/contact')}>{cta} {icon('arrow-up-right', { size: 15 })}</a>
          <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-label="Menu" aria-expanded="false">{icon('menu', { size: 20 })}</button>
        </div>
      </nav>
      <div class="menu" data-mobile-panel inert>
        <div class="menu-inner">
          <div class="menu-links">
            {[...links, ['/contact', 'nav.contact'] as [string, string]].map(([p, k], i) => <a href={href(lang, p)} style={`--i:${i}`}><small>0{i + 1}</small>{t(lang, k)}</a>)}
          </div>
          <div class="menu-side">
            <p class="menu-label">Say hello</p>
            <a href="mailto:info@ferrnagency.com">info@ferrnagency.com</a>
            <a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">Book a 20-minute call</a>
            <p class="menu-label">Language</p>
            <div class="menu-langs">{LANGS.map((l) => <a href={href(l.code, path)} hreflang={l.code} data-set-lang={l.code} aria-current={l.code === lang ? 'true' : undefined}>{l.native}</a>)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer({ lang, path, ctx }: { lang: Lang; path: string; ctx?: SiteCtx }) {
  const year = new Date().getFullYear();
  const links = ctx?.links ?? [];
  return (
    <footer class="footer" id="footer">
      <div class="wrap footer-cta reveal">
        <p class="footer-kicker">{ctx?.get('footer.kicker') ?? 'Next project'}</p>
        <h2 class="footer-title"><span class="grad">{ctx?.get('footer.title') ?? 'Let’s build what’s next.'}</span></h2>
        <div class="footer-actions">
          <a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} {icon('arrow-up-right', { size: 16 })}</a>
          <a class="btn btn-ghost" href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">{t(lang, 'cta.book')} {icon('calendar', { size: 16 })}</a>
        </div>
      </div>
      <div class="wrap footer-grid">
        <div class="footer-col">
          <h4>Ferrn</h4>
          <a href={href(lang, '/work')}>{t(lang, 'nav.work')}</a>
          <a href={href(lang, '/services')}>{t(lang, 'nav.services')}</a>
          <a href={href(lang, '/marketplace')}>{t(lang, 'nav.marketplace')}</a>
          <a href={href(lang, '/about')}>{t(lang, 'nav.about')}</a>
          <a href={href(lang, '/insights')}>{t(lang, 'nav.insights')}</a>
        </div>
        <div class="footer-col">
          <h4>Services</h4>
          <a href={href(lang, '/services#websites')}>Websites</a>
          <a href={href(lang, '/services#apps')}>Web applications</a>
          <a href={href(lang, '/services#ai')}>AI automation</a>
          <a href={href(lang, '/marketplace')}>Ready-built products</a>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <a href={href(lang, '/profile')}>Company profile</a>
          <a href={href(lang, '/links')}>Important links</a>
          <a href={href(lang, '/procurement')}>Procurement</a>
          <a href={href(lang, '/careers')}>Careers</a>
          <a href={href(lang, '/policies')}>Policies</a>
          {links.slice(0, 3).map((l) => <a href={l.url} target={/^https?:/.test(l.url) && !l.url.includes('ferrnagency.com') ? '_blank' : undefined} rel="noopener">{l.title}</a>)}
        </div>
        <div class="footer-col">
          <h4>{t(lang, 'nav.contact')}</h4>
          <a href="mailto:info@ferrnagency.com">info@ferrnagency.com</a>
          <a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">cal.com/ferrn-agency</a>
          <p class="footer-addr">{ctx?.get('company.address') ?? 'Lagos, Nigeria · working with clients in the UK, US, Canada and beyond'}</p>
          <div class="footer-social">{SOCIALS.map(([n, u]) => <a href={u} rel="noopener" target="_blank" aria-label={n}>{n}</a>)}</div>
        </div>
      </div>
      <div class="wrap footer-mark" aria-hidden="true"><span data-wordmark>FERRN</span></div>
      <div class="wrap footer-base">
        <span>© {year} Ferrn Digital Agency. {t(lang, 'footer.rights')}</span>
        <span class="footer-base-links"><a href="#" data-cookie-settings="">Cookie preferences</a><a href="#" data-lang-open>{icon('languages', { size: 14 })} {LANGS.find((l) => l.code === lang)?.native}</a></span>
      </div>
    </footer>
  );
}

/** Bob: the launcher is the blob itself; the panel is a side sheet. Everything else is built in JS. */
function BobMount({ lang, ctx }: { lang: Lang; ctx?: SiteCtx }) {
  const name = ctx?.get('bob.name') ?? 'Bob';
  const suggestions = (ctx?.get('bob.suggestions') ?? 'What does Ferrn build?|Show me your work|Read this page to me|Can Ferrn build a patient portal?').split('|').map((s) => s.trim()).filter(Boolean);
  return (
    <div class="bob" data-bob data-bob-voice={ctx?.bob?.voice ?? 'auto'} data-bob-name={name}>
      <button class="bob-launch" type="button" data-bob-open aria-label={`Open ${name}, the Ferrn assistant`} aria-expanded="false">
        <span class="bob-orb" data-bob-orb aria-hidden="true"><canvas width="112" height="112"></canvas></span>
        <span class="bob-launch-label">{name}</span>
      </button>
      <section class="bob-sheet" role="dialog" aria-label={`${name}, the Ferrn assistant`} hidden>
        <header class="bob-head">
          <span class="bob-orb sm" data-bob-orb aria-hidden="true"><canvas width="88" height="88"></canvas></span>
          <div class="bob-id"><strong>{name}</strong><span data-bob-state>Ready</span></div>
          <div class="bob-tools">
            <button class="icon-btn" type="button" data-bob-read aria-label="Read this page aloud" title="Read this page">{icon('book-open', { size: 17 })}</button>
            <button class="icon-btn" type="button" data-bob-settings aria-label="Voice settings" title="Voice">{icon('sliders-horizontal', { size: 17 })}</button>
            <button class="icon-btn" type="button" data-bob-close aria-label="Close">{icon('x', { size: 18 })}</button>
          </div>
        </header>
        <div class="bob-settings" data-bob-settings-panel hidden>
          <label>Voice <select data-bob-voice-select><option value="auto">Automatic</option></select></label>
          <label>Speed <input type="range" min="0.7" max="1.4" step="0.05" value="1" data-bob-rate /></label>
          <label class="bob-check"><input type="checkbox" data-bob-autovoice /> Speak replies aloud</label>
          <p class="bob-note" data-bob-voice-note></p>
        </div>
        <div class="bob-reader" data-bob-reader hidden>
          <div class="bob-reader-row">
            <button class="icon-btn" type="button" data-read-toggle aria-label="Pause">{icon('pause', { size: 16 })}</button>
            <button class="icon-btn" type="button" data-read-restart aria-label="Restart">{icon('rotate-ccw', { size: 16 })}</button>
            <button class="icon-btn" type="button" data-read-stop aria-label="Stop reading">{icon('square', { size: 14 })}</button>
            <div class="bob-progress"><i data-read-progress></i></div>
            <span class="bob-reader-pos" data-read-pos>0 / 0</span>
          </div>
        </div>
        <div class="bob-log" data-bob-log aria-live="polite"></div>
        <div class="bob-suggest" data-bob-suggest>{suggestions.map((s) => <button type="button" data-bob-ask={s}>{s}</button>)}</div>
        <form class="bob-form" data-bob-form>
          <button class="icon-btn bob-mic" type="button" data-bob-mic aria-label={t(lang, 'chat.mic')} title={t(lang, 'chat.mic')}>{icon('mic', { size: 17 })}</button>
          <input name="q" autocomplete="off" maxlength={1500} placeholder={`Ask ${name} anything about Ferrn…`} aria-label="Your question" />
          <button class="btn btn-primary btn-sm" type="submit" aria-label={t(lang, 'chat.send')}>{icon('arrow-up-right', { size: 16 })}</button>
        </form>
      </section>
    </div>
  );
}

/** Idle storytelling: hidden until the visitor is inactive; built out in JS from these lines. */
function Idle({ ctx }: { ctx?: SiteCtx }) {
  const lines = (ctx?.get('idle.lines') ?? 'Good ideas deserve better execution.|We turn complex problems into simple digital experiences.|Websites. Web applications. AI that answers at 2am.|From Lagos to London to Houston, one accountable team.|Still here? Let’s build what’s next.').split('|').map((s) => s.trim()).filter(Boolean);
  return (
    <div class="idle" data-idle hidden aria-hidden="true">
      <div class="idle-inner">
        <svg viewBox="0 0 164 164" width="40" height="40" class="idle-mark" aria-hidden="true"><path d={MARK_PATH} fill="currentColor" /></svg>
        <div class="idle-lines">{lines.map((l, i) => <p style={`--i:${i}`}>{l}</p>)}</div>
        <p class="idle-hint">Move, scroll or press any key to continue</p>
        <button type="button" class="idle-off" data-idle-off>Don’t show this again</button>
      </div>
    </div>
  );
}

/* ── shared pieces ── */

/** Numbered hairline section opener: "01 — Work" + headline + optional lead. No chips. */
export function Head(p: { n?: string; label: string; title: string; lead?: string; id?: string; right?: Child; class?: string }) {
  return (
    <div class={`head ${p.class ?? ''}`} id={p.id}>
      <div class="head-rule"><span>{p.n ? `${p.n} — ` : ''}{p.label}</span>{p.right}</div>
      <div class="head-row">
        <h2 class="h2 reveal-text">{p.title}</h2>
        {p.lead ? <p class="lead reveal">{p.lead}</p> : null}
      </div>
    </div>
  );
}

export function Section(p: { n?: string; label: string; title: string; lead?: string; id?: string; children?: Child; class?: string; right?: Child }) {
  return (
    <section class={`section ${p.class ?? ''}`} id={p.id}>
      <div class="wrap">
        <Head n={p.n} label={p.label} title={p.title} lead={p.lead} right={p.right} />
        {p.children}
      </div>
    </section>
  );
}

export const money = (n: number | null | undefined, cur: 'NGN' | 'USD') =>
  n == null ? '' : cur === 'NGN' ? `₦${Number(n).toLocaleString('en-NG')}` : `$${Number(n).toLocaleString('en-US')}`;

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');
}

/** Page opener for inner pages: label, large title, lead. Each page passes its own composition inside. */
export function PageHero(p: { label: string; title: string; lead?: string; children?: Child; class?: string; accent?: string }) {
  return (
    <section class={`page-hero ${p.class ?? ''}`}>
      <div class="wrap">
        <p class="page-label reveal">{p.label}</p>
        <h1 class="h1 reveal-text">{p.title}{p.accent ? <> <span class="grad">{p.accent}</span></> : null}</h1>
        {p.lead ? <p class="lead reveal">{p.lead}</p> : null}
        {p.children}
      </div>
    </section>
  );
}
