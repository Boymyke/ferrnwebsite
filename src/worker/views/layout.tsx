import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import { LANGS, t, type Lang } from '../content/i18n';
import { SOCIALS } from '../content/site';

export const href = (lang: Lang, path: string) => (lang === 'en' ? path : `/${lang}${path === '/' ? '/' : path}`);

const SITE = 'https://www.ferrnagency.com';
import { ASSET_V } from '../version';

type LayoutProps = {
  lang: Lang;
  path: string;
  title: string;
  description: string;
  children: Child;
  intro?: boolean;
  schema?: unknown;
  noindex?: boolean;
  ogImage?: string;
};

export function Layout(p: LayoutProps) {
  const L = LANGS.find((l) => l.code === p.lang)!;
  const canonical = SITE + href(p.lang, p.path);
  const strings = {
    title: t(p.lang, 'chat.title'), placeholder: t(p.lang, 'chat.placeholder'), welcome: t(p.lang, 'chat.welcome'),
    voice: t(p.lang, 'chat.voice'), send: t(p.lang, 'chat.send'), mic: t(p.lang, 'chat.mic'),
    sent: t(p.lang, 'form.sent'), error: t(p.lang, 'form.error'),
  };
  return (
    <html lang={L.bcp} dir={L.dir} data-theme="dark">
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
        <meta property="og:title" content={p.title} />
        <meta property="og:description" content={p.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={p.ogImage ?? `${SITE}/brand/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#0b0b0b" />
        <link rel="icon" href="/icons/ferrn-favicon-black-animated-shine.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preload" href="/fonts/poppins-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="preload" href="/fonts/pinyon-script-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href={`/assets/site.css?v=${ASSET_V}`} />
        {raw(`<script>(function(){try{var d=document.documentElement,t=localStorage.getItem('ferrn-theme');if(t)d.dataset.theme=t;${p.intro ? "if(!sessionStorage.getItem('ferrn-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('play-intro');" : ''}}catch(e){}})();</script>`)}
        {p.schema ? raw(`<script type="application/ld+json">${JSON.stringify(p.schema).replace(/</g, '\\u003c')}</script>`) : null}
        <script src={`/assets/site.js?v=${ASSET_V}`} defer></script>
      </head>
      <body data-lang={p.lang} data-i18n={JSON.stringify(strings)}>
        {p.intro ? <Intro lang={p.lang} /> : null}
        <Nav lang={p.lang} path={p.path} />
        <main id="main">{p.children}</main>
        <Footer lang={p.lang} path={p.path} />
        <ChatWidget lang={p.lang} />
      </body>
    </html>
  );
}

const MARK_PATH = 'M163.419 0V163.419H0V109.064H107.208V52.9022H17.0028V0H163.419Z';

/** Opening sequence modelled on the "loadingeffect" reference: the Ferrn mark draws itself,
 *  fills, then grows until it swallows the screen and reveals the site. Plays automatically
 *  once per browser session — no scrolling needed. */
function Intro({ lang }: { lang: Lang }) {
  return (
    <div class="intro" aria-hidden="true">
      <div class="intro-mist"></div>
      <svg class="intro-mark" viewBox="-20 -20 204 204" width="96" height="96">
        <path class="intro-mark-path" d={MARK_PATH} />
      </svg>
      <button class="intro-skip" type="button" data-intro-skip>{t(lang, 'skip')}</button>
    </div>
  );
}

function Nav({ lang, path }: { lang: Lang; path: string }) {
  const links: [string, string][] = [
    ['/work', 'nav.work'], ['/services', 'nav.services'], ['/marketplace', 'nav.marketplace'],
    ['/team', 'nav.team'], ['/insights', 'nav.insights'],
  ];
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <header class="nav-shell">
      <a class="skip-link" href="#main">Skip to content</a>
      <nav class="nav" aria-label="Primary">
        <a class="brand" href={href(lang, '/')} aria-label="Ferrn Digital Agency home">
          <img src="/brand/ferrn-logo.svg" alt="Ferrn" width="120" height="23" />
        </a>
        <div class="nav-links">
          {links.map(([p, k]) => <a href={href(lang, p)} aria-current={path.startsWith(p) ? 'page' : undefined}>{t(lang, k)}</a>)}
        </div>
        <div class="nav-actions">
          <details class="lang-menu">
            <summary aria-label={t(lang, 'lang.label')}><span class="globe" aria-hidden="true">◍</span> {current.code.toUpperCase()}</summary>
            <div class="lang-list" role="menu">
              {LANGS.map((l) => (
                <a role="menuitem" href={href(l.code, path)} hreflang={l.code} data-set-lang={l.code} aria-current={l.code === lang ? 'true' : undefined}>
                  {l.native}
                </a>
              ))}
            </div>
          </details>
          <button class="icon-btn" type="button" data-theme-toggle aria-label={t(lang, 'theme.toggle')}>{raw('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>')}</button>
          <a class="btn btn-primary btn-sm nav-cta" href={href(lang, '/contact')}>{t(lang, 'cta.start')} ↗</a>
          <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-label="Menu" aria-expanded="false">☰</button>
        </div>
      </nav>
      <div class="mobile-panel" data-mobile-panel>
        {links.map(([p, k]) => <a href={href(lang, p)}>{t(lang, k)}</a>)}
        <a href={href(lang, '/about')}>{t(lang, 'nav.about')}</a>
        <a href={href(lang, '/contact')}>{t(lang, 'nav.contact')}</a>
      </div>
    </header>
  );
}

function Footer({ lang, path }: { lang: Lang; path: string }) {
  const year = new Date().getFullYear();
  return (
    <footer class="footer">
      <div class="container footer-grid">
        <div>
          <img src="/brand/ferrn-logo.svg" alt="Ferrn" width="140" height="27" />
          <p class="footer-tag">{t(lang, 'footer.tagline')}</p>
          <form class="newsletter" data-form="newsletter">
            <label class="sr-only" for="nl-email">{t(lang, 'newsletter.email')}</label>
            <p>{t(lang, 'newsletter.title')}</p>
            <div class="newsletter-row">
              <input id="nl-email" name="email" type="email" required placeholder={t(lang, 'newsletter.email')} />
              <button class="btn btn-primary btn-sm" type="submit">{t(lang, 'newsletter.cta')}</button>
            </div>
            <p class="form-status" role="status"></p>
          </form>
        </div>
        <div class="footer-cols">
          <div>
            <h4>Ferrn</h4>
            <a href={href(lang, '/work')}>{t(lang, 'nav.work')}</a>
            <a href={href(lang, '/services')}>{t(lang, 'nav.services')}</a>
            <a href={href(lang, '/marketplace')}>{t(lang, 'nav.marketplace')}</a>
            <a href={href(lang, '/team')}>{t(lang, 'nav.team')}</a>
            <a href={href(lang, '/about')}>{t(lang, 'nav.about')}</a>
          </div>
          <div>
            <h4>Resources</h4>
            <a href={href(lang, '/insights')}>{t(lang, 'nav.insights')}</a>
            <a href={href(lang, '/procurement')}>Procurement</a>
            <a href={href(lang, '/careers')}>Careers</a>
            <a href="/assets/Ferrn-Agency-Company-Profile.pdf">Company profile (PDF)</a>
            <a href={href(lang, '/policies')}>Policies</a>
          </div>
          <div>
            <h4>{t(lang, 'nav.contact')}</h4>
            <a href="mailto:info@ferrnagency.com">info@ferrnagency.com</a>
            {SOCIALS.map(([n, u]) => <a href={u} rel="noopener" target="_blank">{n}</a>)}
          </div>
        </div>
      </div>
      <div class="container footer-base">
        <span>© {year} Ferrn Digital Agency. {t(lang, 'footer.rights')}</span>
        <span class="footer-lang">{LANGS.map((l) => <a href={href(l.code, path)} data-set-lang={l.code}>{l.code.toUpperCase()}</a>)}</span>
      </div>
    </footer>
  );
}

function ChatWidget({ lang }: { lang: Lang }) {
  return (
    <div class="chat" data-chat>
      <button class="chat-fab" type="button" data-chat-open aria-label={t(lang, 'chat.title')}>
        <svg viewBox="0 0 164 164" width="22" height="22" aria-hidden="true"><path d={MARK_PATH} fill="currentColor" /></svg>
        <span>{t(lang, 'chat.title')}</span>
      </button>
      <section class="chat-panel" role="dialog" aria-label={t(lang, 'chat.title')} hidden>
        <header class="chat-head">
          <div><strong>{t(lang, 'chat.title')}</strong><span class="chat-online">●</span></div>
          <label class="chat-voice"><input type="checkbox" data-chat-voice /> {t(lang, 'chat.voice')}</label>
          <button class="icon-btn" type="button" data-chat-close aria-label="Close">✕</button>
        </header>
        <div class="chat-log" data-chat-log aria-live="polite"></div>
        <form class="chat-form" data-chat-form>
          <button class="icon-btn chat-mic" type="button" data-chat-mic aria-label={t(lang, 'chat.mic')} title={t(lang, 'chat.mic')}>🎙</button>
          <input name="q" autocomplete="off" maxlength={1500} placeholder={t(lang, 'chat.placeholder')} />
          <button class="btn btn-primary btn-sm" type="submit">{t(lang, 'chat.send')}</button>
        </form>
      </section>
    </div>
  );
}

export function Section(p: { eyebrow?: string; title: string; lead?: string; id?: string; children?: Child; class?: string }) {
  return (
    <section class={`section ${p.class ?? ''}`} id={p.id}>
      <div class="container">
        <div class="section-head reveal">
          <div>
            {p.eyebrow ? <span class="eyebrow">{p.eyebrow}</span> : null}
            <h2 class="h2">{p.title}</h2>
          </div>
          {p.lead ? <p class="lead">{p.lead}</p> : null}
        </div>
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
