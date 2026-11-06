import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import { LANGS, t, type Lang } from '../content/i18n';
import { MUSIC, SOCIALS } from '../content/site';
import { icon } from '../lib/icons';
import type { SiteCtx } from '../lib/content';
import { ASSET_V } from '../version';

export const href = (lang: Lang, path: string) => (lang === 'en' ? path : `/${lang}${path === '/' ? '/' : path}`);
export const SITE = 'https://www.ferrnagency.com';
export const MARK_PATH = 'M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z';
/** Same mark, but the path starts bottom-left and runs right, then up, so a stroke draw "writes" it in that order. */
export const MARK_DRAW = 'M0 163.419H163.419V0H17.0028V52.9022H107.208V109.064H0Z';

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
        {raw(`<script>(function(){try{var d=document.documentElement,t=localStorage.getItem('ferrn-theme');if(t==='system')d.dataset.theme=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';else if(t)d.dataset.theme=t;var a=JSON.parse(localStorage.getItem('ferrn-a11y')||'{}');for(var k in a)if(a[k]&&k!=='size')d.classList.add('a11y-'+k);if(a.size==1)d.classList.add('a11y-text');if(a.size==2)d.classList.add('a11y-text2');d.classList.add('js');${p.intro ? "if(!sessionStorage.getItem('ferrn-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('play-intro');" : ''}}catch(e){}})();</script>`)}
        {p.schema ? raw(`<script type="application/ld+json">${JSON.stringify(p.schema).replace(/</g, '\\u003c')}</script>`) : null}
        <script src={`/assets/site.js?v=${ASSET_V}`} defer></script>
      </head>
      <body data-lang={p.lang} data-i18n={JSON.stringify(strings)} data-idle={ctx?.get('idle.enabled') === '0' ? '0' : (ctx?.get('idle.seconds') ?? '45')}>
        {p.intro ? <Intro /> : null}
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

/** Opening sequence (once per session): the questions type in and out, then "all in FERRN"; an orange curtain
 *  and a black one drop over it and carry on down, revealing the page. Driven by runIntro() in main.ts. */
function Intro() {
  return (
    <div class="intro" aria-hidden="true" data-intro-words="Websites?|Web apps?|AI automations?" data-intro-final="all in|FERRN">
      <p class="intro-type"><span class="intro-text" data-intro-text></span><span class="intro-caret"></span></p>
      <div class="intro-drop intro-drop-orange"></div>
      <div class="intro-drop intro-drop-black"></div>
    </div>
  );
}

/** Accessibility switches in the control centre → `html.a11y-<key>` (see site.css), remembered in localStorage. */
const A11Y: [string, string, string][] = [
  ['motion', 'Stop motion', 'zap-off'], ['contrast', 'High contrast', 'contrast'], ['links', 'Highlight links', 'underline'], ['font', 'Readable font', 'case-sensitive'],
  ['spacing', 'Text spacing', 'text-cursor'], ['grey', 'Greyscale', 'droplet-off'], ['cursor', 'Big cursor', 'mouse-pointer-2'], ['guide', 'Reading guide', 'ruler'],
  ['focus', 'Focus outline', 'scan'], ['media', 'Pause video', 'circle-pause'], ['images', 'Hide images', 'image-off'], ['align', 'Align left', 'text-align-start'],
];

const NAV_LINKS: [string, string, string][] = [['/', 'nav.home', 'house'], ['/work', 'nav.work', 'layout-dashboard'], ['/services', 'nav.services', 'layers'], ['/marketplace', 'nav.marketplace', 'package'], ['/about', 'nav.about', 'users'], ['/insights', 'nav.insights', 'book-open'], ['/contact', 'nav.contact', 'send']];

const BRAND_GLYPH: Record<string, string> = {
  Instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm5.6-1.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z',
  X: 'M3 3h4.6l4.9 6.7L18.2 3H21l-7.2 8.4L21.5 21h-4.6l-5.2-7.1L5.6 21H2.8l7.6-8.9Z',
  LinkedIn: 'M4.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 9h3v12H3Zm6 0h2.9v1.7c.5-.9 1.7-2 3.6-2 3.8 0 4.5 2.5 4.5 5.7V21h-3v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H9Z',
  TikTok: 'M13 3h3c.2 2 1.6 3.6 3.7 3.8v3a6.7 6.7 0 0 1-3.7-1.2v6.2A5.2 5.2 0 1 1 10.8 9.7v3.1a2.2 2.2 0 1 0 2.2 2.2Z',
};

function Nav({ lang, path, ctx }: { lang: Lang; path: string; ctx?: SiteCtx }) {
  const cta = ctx?.get('nav.cta') ?? t(lang, 'cta.start');
  const current = (p: string) => path === p || (p !== '/' && path.startsWith(p + '/')) ? 'page' : undefined;
  return (
    <header class="nav-shell" data-nav>
      <a class="skip-link" href="#main">Skip to content</a>
      <nav class="nav" aria-label="Primary">
        <a class="brand" href={href(lang, '/')} aria-label="Ferrn Digital Agency home">
          <svg viewBox="0 0 164 164" width="28" height="28" aria-hidden="true"><path d={MARK_PATH} fill="currentColor" /></svg>
        </a>
        <div class="nav-meta" aria-live="off">
          <time class="nav-clock" data-clock></time>
          <span class="nav-geo" data-geo hidden><span data-geo-name></span><span class="nav-flag-emoji" data-geo-flag aria-hidden="true"></span></span>
        </div>
        <div class="nav-actions">
          <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-label="Menu" aria-expanded="false" aria-controls="cc">{icon('menu', { size: 20 })}</button>
        </div>
      </nav>
      <div class="cc-backdrop" data-cc-close></div>
      <div class="cc" id="cc" role="dialog" aria-modal="true" aria-label="Menu" data-mobile-panel inert>
        <div class="cc-head">
          <span class="cc-title">Menu</span>
          <button class="icon-btn cc-close" type="button" data-cc-close aria-label="Close menu">{icon('x', { size: 18 })}</button>
        </div>
        <div class="cc-grid">
          <section class="cc-panel cc-nav" aria-label="Navigation">
            <h4 class="cc-label">Navigation</h4>
            <ul class="cc-list">
              {NAV_LINKS.map(([p, k, ic], i) => <li style={`--i:${i}`}><a href={href(lang, p)} aria-current={current(p)}>{icon(ic, { size: 17 })}<span>{t(lang, k)}</span>{icon('chevron-right', { size: 15, class: 'cc-chev' })}</a></li>)}
            </ul>
            <div class="cc-hello"><span>Say hello</span><a href="mailto:info@ferrnagency.com">info@ferrnagency.com</a><a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">Book a 20-minute call</a></div>
            <a class="btn btn-primary cc-cta" href={href(lang, '/contact')}>{cta} {icon('arrow-up-right', { size: 15 })}</a>
          </section>
          <div class="cc-col">
            <section class="cc-panel" aria-label="Theme">
              <h4 class="cc-label">Theme</h4>
              <div class="cc-seg" role="radiogroup" aria-label="Theme">
                <button type="button" role="radio" data-theme-set="dark" aria-checked="false">{icon('moon', { size: 16 })}<span>Dark</span></button>
                <button type="button" role="radio" data-theme-set="light" aria-checked="false">{icon('sun-medium', { size: 16 })}<span>Light</span></button>
                <button type="button" role="radio" data-theme-set="system" aria-checked="false">{icon('laptop-minimal', { size: 16 })}<span>Auto</span></button>
              </div>
            </section>
            <section class="cc-panel cc-lang" aria-label={t(lang, 'lang.label')}>
              <button class="cc-row" type="button" data-lang-toggle aria-expanded="false">{icon('languages', { size: 17 })}<span>{t(lang, 'lang.label')}</span><b>{LANGS.find((l) => l.code === lang)?.native}</b>{icon('chevron-down', { size: 15, class: 'cc-chev' })}</button>
              <div class="cc-langs" data-lang-list role="menu" aria-label={t(lang, 'lang.label')} hidden>{LANGS.map((l) => <a href={href(l.code, path)} hreflang={l.code} data-set-lang={l.code} aria-current={l.code === lang ? 'true' : undefined}>{l.native}</a>)}</div>
            </section>
            <section class="cc-panel" aria-label="Accessibility">
              <div class="cc-label-row"><h4 class="cc-label">{icon('accessibility', { size: 15 })} Accessibility</h4><button type="button" class="cc-reset" data-a11y-reset>{icon('rotate-ccw', { size: 13 })} Reset</button></div>
              <div class="cc-size" role="radiogroup" aria-label="Text size">
                <span>Text size</span>
                {[['0', 'Default', '15'], ['1', 'Large', '18'], ['2', 'Larger', '21']].map(([v, label, px]) => <button type="button" role="radio" data-text-size={v} aria-checked={v === '0' ? 'true' : 'false'} aria-label={label}><b style={`font-size:${px}px`}>A</b></button>)}
              </div>
              <div class="cc-tiles">
                {A11Y.map(([k, label, ic]) => <button type="button" class="cc-tile" data-a11y={k} aria-pressed="false">{icon(ic, { size: 19 })}<span>{label}</span></button>)}
              </div>
            </section>
            <section class="cc-panel cc-music" aria-label="Music" data-music={JSON.stringify(MUSIC)}>
              <div class="cc-label-row"><h4 class="cc-label">{icon('disc-3', { size: 15, class: 'cc-disc' })} Music</h4><a class="cc-credit" href="https://pixabay.com/music/" target="_blank" rel="noopener">via Pixabay</a></div>
              <div class="cc-player">
                <button class="icon-btn cc-prev" type="button" data-music-prev aria-label="Previous track">{icon('skip-back', { size: 16 })}</button>
                <button class="cc-play" type="button" data-music-toggle aria-label="Play music" aria-pressed="false">{icon('play', { size: 18 })}</button>
                <button class="icon-btn cc-next" type="button" data-music-next aria-label="Next track">{icon('skip-forward', { size: 16 })}</button>
                <div class="cc-track"><b data-music-title>{MUSIC[0].title}</b><small data-music-sub>{MUSIC[0].artist}</small></div>
              </div>
              <div class="cc-progress"><span data-music-time>0:00</span><input type="range" min="0" max="1000" value="0" data-music-seek aria-label="Seek" /><span data-music-dur>{MUSIC[0].length}</span></div>
              <div class="cc-volrow">{icon('volume-2', { size: 15 })}<input class="cc-vol" type="range" min="0" max="100" value="60" data-music-vol aria-label="Volume" /></div>
            </section>
            <section class="cc-panel cc-actions" aria-label="Our website links">
              <h4 class="cc-label">Our website links</h4>
              <div class="cc-social">
                {SOCIALS.map(([n, u]) => <a href={u} rel="noopener" target="_blank" aria-label={n} title={n}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={BRAND_GLYPH[n]} /></svg></a>)}
                <a href="mailto:info@ferrnagency.com" aria-label="Email" title="info@ferrnagency.com">{icon('at-sign', { size: 18 })}</a>
                <a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener" aria-label="Book a call" title="Book a 20-minute call">{icon('calendar', { size: 18 })}</a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer({ lang, path, ctx }: { lang: Lang; path: string; ctx?: SiteCtx }) {
  const year = new Date().getFullYear();
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
          <a href={href(lang, '/procurement')}>Procurement</a>
          <a href={href(lang, '/careers')}>Careers</a>
          <a href={href(lang, '/policies')}>Policies</a>
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
/** Bob: a small orange ghost bottom-right. The full assistant (chat, talk, guided tour) loads only when it is clicked. */
function BobMount({ lang, ctx }: { lang: Lang; ctx?: SiteCtx }) {
  const name = ctx?.get('bob.name') ?? 'Bob';
  const suggestions = (ctx?.get('bob.suggestions') ?? 'What does Ferrn build?|Show me your work|Read this page to me|Can Ferrn build a patient portal?').split('|').map((s) => s.trim()).filter(Boolean);
  return (
    <div class="bob" data-bob data-bob-name={name} data-bob-voice={ctx?.bob?.voice ?? 'auto'} data-bob-suggest={suggestions.join('|')} data-bob-src={`/assets/bob.js?v=${ASSET_V}`} data-bob-css={`/assets/bob.css?v=${ASSET_V}`}>
      <button class="bob-ghost" type="button" data-bob-open aria-label={`Open ${name}, the Ferrn assistant`} aria-expanded="false">
        <span class="ghost-float"><svg class="ghost" viewBox="0 0 120 132" width="58" height="64" aria-hidden="true">
          <defs><radialGradient id="ghost-g" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#ffb08a" /><stop offset=".45" stop-color="#F94406" /><stop offset="1" stop-color="#b52c00" /></radialGradient></defs>
          <path class="ghost-body" fill="url(#ghost-g)" d="M60 6C31 6 12 28 12 58v58c0 6 6 9 11 5l9-7 9 8c4 3 8 3 12 0l7-7 7 7c4 3 8 3 12 0l9-8 9 7c5 4 11 1 11-5V58C108 28 89 6 60 6Z" />
          <g class="ghost-eyes"><ellipse cx="44" cy="56" rx="7.5" ry="10" fill="#1a0d06" /><ellipse cx="76" cy="56" rx="7.5" ry="10" fill="#1a0d06" /><circle cx="46.5" cy="52" r="2.6" fill="#fff" /><circle cx="78.5" cy="52" r="2.6" fill="#fff" /></g>
          <path class="ghost-mouth" d="M53 78q7 6 14 0" stroke="#1a0d06" stroke-width="3.5" fill="none" stroke-linecap="round" />
        </svg></span>
        <span class="bob-ghost-label">Ask {name}</span>
      </button>
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

/** Numbered hairline section opener: "01, Work" + headline + optional lead. No chips. */
export function Head(p: { n?: string; label: string; title: string; lead?: string; id?: string; right?: Child; class?: string }) {
  return (
    <div class={`head ${p.class ?? ''}`} id={p.id}>
      <div class="head-rule"><span>{p.n ? `${p.n} · ` : ''}{p.label}</span>{p.right}</div>
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
