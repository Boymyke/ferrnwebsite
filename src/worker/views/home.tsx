import { raw } from 'hono/html';
import { t, type Lang } from '../content/i18n';
import { CLIENT_LOGOS, FAQS } from '../content/site';
import type { SiteCtx } from '../lib/content';
import { icon } from '../lib/icons';
import { shotOf, type PublicProject } from '../lib/projects';
import { href, initials, Layout, money } from './layout';
import { OFFER_ART } from './offer-art';
import { SERVICE_ICONS } from './service-icons';
import { ASSET_V } from '../version';

export type ProductRow = {
  slug: string; name: string; category: string; industry: string | null; tagline: string | null; description?: string | null;
  demo_url: string | null; cover?: string | null; accent: string | null; price_ngn_setup: number | null; price_ngn_monthly: number | null;
  price_usd_setup: number | null; price_usd_monthly: number | null; buyout_ngn?: number | null; buyout_usd?: number | null;
  delivery_days: number | null; features_json?: string; includes_json?: string;
};
export type TeamRow = { id: string; name: string; role: string; bio: string | null; photo: string | null; linkedin: string | null; github: string | null };
export type TestimonialRow = { id?: string; name: string; role: string | null; company?: string | null; quote: string; avatar: string | null; logo?: string | null; audio?: string | null; transcript?: string | null; featured?: number };
export type PostRow = { slug: string; title: string; category: string | null; excerpt: string | null; published_at: string | null; cover?: string | null };

export const mediaUrl = (v: string | null | undefined) => (!v ? null : v.startsWith('http') || v.startsWith('/') ? v : `/media/${v}`);
/** A right-sized image: Cloudinary URLs get a resize + modern-format transform (a 44px avatar was a 900 KB photo). */
export const sized = (v: string | null | undefined, w: number, h = w) => {
  const u = mediaUrl(v); if (!u) return null;
  return /res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u) && !/\/upload\/[a-z]_[^/]*\//.test(u)
    ? u.replace('/image/upload/', `/image/upload/c_fill,w_${w * 2},h_${h * 2},g_face,f_auto,q_auto/`) : u;
};

/** Headline split into lines on "|", each line revealed through a gradient mask. */
export function Lines({ text, class: cls, tag = 'h1', id }: { text: string; class?: string; tag?: 'h1' | 'h2' | 'p'; id?: string }) {
  const lines = text.split('|').map((s) => s.trim()).filter(Boolean);
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  // [a/b/c] anywhere in a line becomes an orange word that rotates through a, b and c (main.ts headFlicks)
  const flicks = (l: string) => esc(l).replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
    const words = inner.split('/').map((w) => w.trim()).filter(Boolean);
    return `<span class="hf" data-hf="${words.join('|')}"><span class="hf-w">${words[0] ?? ''}</span></span>`;
  });
  // {, Name} marks where the visitor's first name goes (punctuation inside the braces); empty until Bob knows it
  const named = (l: string) => l.replace(/\{([^{}]*Name[^{}]*)\}/g, (_m, tpl: string) => `<span class="nm" data-nm="${tpl.replace('Name', '%')}"></span>`);
  // lines with a moving word or a name slot paint plain text: the gradient text-clip used for the reveal
  // shimmer draws animated children twice in Chromium (a ghost copy at the line start)
  const inner = lines.map((l, i) => { const h = named(flicks(l)); return `<span class="line" style="--i:${i}"><span class="line-in${h !== esc(l) ? ' plain' : ''}">${h}</span></span>`; }).join('');
  return raw(`<${tag}${id ? ` id="${id}"` : ''} class="${cls ?? ''} lines" data-lines>${inner}</${tag}>`);
}

export function WorkRow({ p, lang, i }: { p: PublicProject; lang: Lang; i: number }) {
  const img = shotOf(p);
  return (
    <a class="work-row reveal" href={href(lang, `/work/${p.slug}`)} data-category={p.category} style={p.accent ? `--tint:${p.accent}` : undefined}>
      <span class="work-i">{String(i + 1).padStart(2, '0')}</span>
      <span class="work-main">
        <span class="work-title">{p.title}</span>
        <span class="work-meta">{[p.type, p.industry, p.year].filter(Boolean).join(' · ')}</span>
        {p.summary ? <span class="work-sum">{p.summary}</span> : null}
      </span>
      <span class="work-media" aria-hidden="true">{img ? <img src={img} alt="" loading="lazy" decoding="async" width="640" height="400" /> : <span class="work-media-empty">{icon('layout-dashboard', { size: 28 })}</span>}</span>
      <span class="work-arrow">{icon('arrow-up-right', { size: 22 })}</span>
    </a>
  );
}

/** Product image: Studio cover → bundled still of its demo (public/assets/home/shot-<demo>.webp) → live capture of the demo URL. */
const DEMO_STILLS = ['clinic-desk', 'admissions', 'track', 'cedar-clinic', 'brightpath-academy', 'harbourline-homes', 'northbridge-freight', 'assistant', 'automation'];
export function productShot(p: { cover?: string | null; demo_url?: string | null }): string | null {
  if (p.cover) return mediaUrl(p.cover);
  if (!p.demo_url) return null;
  const m = p.demo_url.match(/\/demos\/([a-z0-9-]+)\/?(?:[?#]|$)/i);
  if (m && DEMO_STILLS.includes(m[1])) return `/assets/home/shot-${m[1]}.webp`;
  return `https://image.thum.io/get/width/1200/crop/760/noanimate/${p.demo_url}`;
}

export function ProductCard({ p, lang }: { p: ProductRow; lang: Lang }) {
  const cover = productShot(p);
  return (
    <article class="product reveal" data-category={p.category} style={`--tint:${p.accent ?? 'var(--orange)'}`}>
      <a class="product-media" href={href(lang, `/marketplace/${p.slug}`)} aria-label={p.name}>
        {cover ? <img src={cover} alt={`${p.name} preview`} loading="lazy" decoding="async" width="1200" height="750" /> : <span class="product-media-empty">{icon('package', { size: 30 })}</span>}
      </a>
      <div class="product-body">
        <p class="product-kind">{t(lang, `market.${p.category}`)}{p.industry ? ` · ${p.industry}` : ''}</p>
        <h3><a href={href(lang, `/marketplace/${p.slug}`)}>{p.name}</a></h3>
        <p class="product-tag">{p.tagline}</p>
        <div class="product-foot">
          <div class="product-price" data-price-ngn={`${p.price_ngn_setup}|${p.price_ngn_monthly}`} data-price-usd={`${p.price_usd_setup}|${p.price_usd_monthly}`}>
            <span class="price-main">{money(p.price_ngn_monthly, 'NGN')}<small>{t(lang, 'market.month')}</small></span>
            <span class="price-sub">+ {money(p.price_ngn_setup, 'NGN')} {t(lang, 'market.setup')}</span>
          </div>
          <div class="product-actions">
            {p.demo_url ? <a class="btn btn-ghost btn-sm" href={p.demo_url} target="_blank" rel="noopener">{t(lang, 'cta.demo')} {icon('external-link', { size: 14 })}</a> : null}
            <a class="btn btn-primary btn-sm" href={href(lang, `/marketplace/${p.slug}`)}>{t(lang, 'market.buy')}</a>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Testimonial({ x, i }: { x: TestimonialRow; i: number }) {
  const audio = mediaUrl(x.audio);
  // Only the client's own recording is ever played (no synthetic voices). With a recording the card is a
  // voice note plus a Transcript toggle; until one is uploaded in Studio, the card shows their written words.
  const said = (x.transcript || x.quote || '').trim();
  return (
    <figure class={`quote-card vn ${audio ? 'has-audio' : 'text-only'}`} data-quote style={`--i:${i}`}>
      <figcaption>
        {x.avatar ? <img src={sized(x.avatar, 48)!} alt="" loading="lazy" decoding="async" width="48" height="48" /> : <span class="avatar sm">{initials(x.name)}</span>}
        <span><strong>{x.name}</strong><small>{[x.role, x.company].filter(Boolean).join(', ')}</small></span>
        {x.logo ? <img class="quote-logo" src={mediaUrl(x.logo)!} alt={x.company ?? ''} loading="lazy" height="22" /> : null}
      </figcaption>
      {audio ? (
        <>
          <div class="voice" data-voice>
            <button class="voice-btn" type="button" data-voice-play aria-label={`Play ${x.name}’s voice note`}>{icon('play', { size: 16 })}<span class="voice-pause">{icon('pause', { size: 16 })}</span></button>
            <span class="voice-bars" aria-hidden="true">{Array.from({ length: 32 }, (_, k) => <i style={`--k:${k};--h:${[38, 62, 45, 80, 55, 30, 70, 90, 48, 66, 35, 58, 84, 42, 72, 50, 28, 64, 88, 46, 60, 34, 76, 52, 40, 68, 86, 44, 56, 32, 62, 48][k]}%`}></i>)}</span>
            <span class="voice-time" data-voice-time>0:00</span>
            <audio preload="metadata" src={audio}></audio>
          </div>
          {said ? <details class="voice-transcript"><summary>{icon('file-text', { size: 15 })} Transcript</summary><p>{said}</p></details> : null}
        </>
      ) : (
        <blockquote><span class="quote-mark" aria-hidden="true">“</span>{x.quote}</blockquote>
      )}
    </figure>
  );
}

export function ContactForm({ lang, type = 'contact', product, ctx }: { lang: Lang; type?: string; product?: string; ctx?: SiteCtx }) {
  return (
    <form class="cform reveal" data-form={type}>
      <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex={-1} autocomplete="off" /></label></div>
      {product ? <input type="hidden" name="product" value={product} /> : null}
      <div class="cform-grid">
        <label class="field"><span>{t(lang, 'form.name')}</span><input name="name" required autocomplete="name" placeholder="Ada Okafor" /></label>
        <label class="field"><span>{t(lang, 'form.email')}</span><input name="email" type="email" required autocomplete="email" placeholder="ada@company.com" /></label>
        <label class="field field-wide"><span>{t(lang, 'form.message')}</span><textarea name="message" rows={4} maxlength={4000} placeholder="What’s costing you enquiries, time or visibility?"></textarea></label>
        <details class="cform-more field-wide">
          <summary>Add phone, company, budget {icon('chevron-down', { size: 14 })}</summary>
          <div class="cform-grid">
            <label class="field"><span>{t(lang, 'form.phone')}</span><input name="phone" autocomplete="tel" /></label>
            <label class="field"><span>{t(lang, 'form.company')}</span><input name="company" autocomplete="organization" /></label>
            <label class="field"><span>{t(lang, 'form.need')}</span>
              <select name="need"><option>Website</option><option>Web application</option><option>AI assistant / automation</option><option>Marketplace product</option><option>E-commerce</option><option>Not sure yet</option></select>
            </label>
            <label class="field"><span>{t(lang, 'form.budget')}</span>
              <select name="budget"><option>Under ₦500k / $500</option><option>₦500k–₦1.5m / $500–$1.5k</option><option>₦1.5m–₦5m / $1.5k–$5k</option><option>₦5m+ / $5k+</option><option>Not sure</option></select>
            </label>
            <label class="field-check field-wide"><input type="checkbox" name="wa_consent" /> <span>{t(lang, 'form.wa_consent')}</span></label>
          </div>
        </details>
      </div>
      <div class="cform-foot">
        <button class="btn btn-primary" type="submit">{t(lang, 'form.send')} {icon('arrow-up-right', { size: 16 })}</button>
        <span class="muted small">{ctx?.get('contact.reply') ?? 'We reply within one working day.'}</span>
      </div>
      <p class="form-status" role="status"></p>
    </form>
  );
}

/** A big About number that counts up on reveal (the shared [data-count] helper in main.ts). */
const Num = ({ v }: { v: string }) => {
  const m = /^(\d+)(.*)$/.exec(v);
  return m ? <span class="ab-num" data-count={m[1]} data-suffix={m[2]}>{v}</span> : <span class="ab-num">{v}</span>;
};
const OFFERS: [string, string, string, string, string][] = [
  ['Websites', 'that turn visitors into enquiries.', 'Fast, clear and found on Google, with WhatsApp, booking or quote one tap away.', '#F94406', '#ff8a4c'],
  ['Web apps', 'that run the business day to day.', 'Portals, dashboards and workflow systems your staff and customers actually use.', '#F94406', '#ff8a4c'],
  ['AI assistants', 'that answer at 2am.', 'Trained on your services and prices, they reply, book and hand over to a person.', '#F94406', '#ff8a4c'],
  ['Automation', 'that does the follow-up for you.', 'WhatsApp reminders, lead follow-ups and reports that go out on their own.', '#F94406', '#ff8a4c'],
  ['Payments', 'that close the sale online.', 'Paystack checkout, invoices and receipts tied to every order.', '#F94406', '#ff8a4c'],
  ['SEO and analytics', 'that show what is working.', 'Search set up properly and simple reports on visitors, enquiries and sales.', '#F94406', '#ff8a4c'],
  ['Hosting and care', 'so it keeps working after launch.', 'Security, backups, updates and small changes, handled every month.', '#F94406', '#ff8a4c'],
];

const STATS: [string, string][] = [['50+', 'Projects delivered'], ['10+', 'Industries served'], ['25+', 'Years of combined experience'], ['99%', 'Project completion rate']];

export function HomePage(p: {
  lang: Lang; ctx: SiteCtx; projects: PublicProject[]; products: ProductRow[]; testimonials: TestimonialRow[]; posts: PostRow[]; team?: TeamRow[];
}) {
  const { lang, ctx } = p;
  const faqs = ctx.faqs.length ? ctx.faqs.map((f) => [f.question, f.answer] as [string, string]) : FAQS;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://www.ferrnagency.com/#org', name: 'Ferrn Digital Agency', url: 'https://www.ferrnagency.com/', email: 'info@ferrnagency.com',
        logo: 'https://www.ferrnagency.com/brand/ferrn-mark.svg', areaServed: ['NG', 'GB', 'US', 'CA'], address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressCountry: 'NG' },
        sameAs: ['https://www.instagram.com/ferrn.agency/', 'https://x.com/ferrn_agency', 'https://www.linkedin.com/company/109135329/', 'https://www.tiktok.com/@ferrnagency'] },
      { '@type': 'WebSite', url: 'https://www.ferrnagency.com/', name: 'Ferrn Digital Agency', inLanguage: ['en', 'yo', 'ig', 'ha', 'fr', 'de', 'es', 'zh'] },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  const featured = (p.projects.filter((x) => x.featured).length ? p.projects.filter((x) => x.featured) : p.projects).slice(0, 3);
  const flick = ctx.list('home.hero.flick').length ? ctx.list('home.hero.flick') : ['Websites'];
  const levers = ctx.get('home.growth.levers').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x.length >= 2);
  const H = ({ text, cls = 'h-display' }: { text: string; cls?: string }) => <Lines text={text} tag="h2" class={cls} />;
  return (
    <Layout lang={lang} ctx={ctx} path="/" kind="home" intro schema={schema} title={ctx.get('seo.home.title')} description={ctx.get('seo.home.description')}>
      {/* ── hero: one changing word; the orange dot texture appears only where the pointer moves ── */}
      <section class="hx" data-hero>
        <canvas class="hx-dots" data-dots aria-hidden="true"></canvas>
        <div class="wrap hx-copy">
          {ctx.season?.greeting ? <p class="hero-kicker"><span class="season-greet">{ctx.season.greeting}</span></p> : ctx.get('home.hero.kicker') ? <p class="hero-kicker">{ctx.get('home.hero.kicker')}</p> : null}
          <h1 class="hx-title">
            <span class="hx-flick" data-flick={flick.join('|')}><span class="hx-flick-word">{flick[0]}</span></span>
            <span class="hx-rest">{ctx.get('home.hero.title')}</span>
          </h1>
          <p class="hx-sub">{ctx.get('home.hero.sub')}</p>
          <div class="hx-actions">
            <a class="btn btn-primary" href={href(lang, '/contact')}>{ctx.get('home.hero.cta2')} {icon('arrow-up-right', { size: 15 })}</a>
            <a class="btn btn-ghost" href={href(lang, '/work')}>See our work</a>
          </div>
        </div>
      </section>

      {/* ── Trusted By: every client, an endless strip across the full width, inside the page margins ── */}
      <section class="trusted" aria-labelledby="trusted-title">
        <div class="wrap trusted-head"><Lines text={ctx.get('home.trusted.title')} tag="h2" class="h-display" id="trusted-title" /></div>
        <div class="trusted-strip">
          <div class="trusted-track">
            {[0, 1].map((k) => CLIENT_LOGOS.map((l) => {
              const ratio = l.w / 40, h = Math.round(Math.max(26, Math.min(46, 46 / Math.sqrt(ratio))));
              return <img src={`/assets/clients/${l.file}.webp`} alt={k ? '' : l.name} aria-hidden={k ? 'true' : undefined} title={l.name === 'Client' ? undefined : l.name} height={h} width={Math.round(h * ratio)} loading="lazy" decoding="async" />;
            }))}
          </div>
        </div>
      </section>

      {/* ── about: a staggered bento (two offset rows) on one shared, softly moving glow + pixel texture that
            shows through the gaps, so the cards read as one piece. Plain cards on phones. ── */}
      <section class="about-bento" id="about" aria-labelledby="about-title">
        <div class="wrap">
          <div class="room-head"><Lines text={ctx.get('home.about.title')} tag="h2" class="h-display" id="about-title" /></div>
        </div>
        {(() => {
          const T = ctx.get('home.about.tiles').split('\n').map((l) => { const [a, ...b] = l.split('|'); return [a.trim(), b.join('|').trim()]; });
          const tt = (k: number) => T[k] ?? ['', ''];
          const Cap = ({ k }: { k: number }) => <p class="ab-cap"><strong>{tt(k)[0]}</strong> {tt(k)[1]}</p>;
          const team = (p.team ?? []).slice(0, 6);
          return (
            <div class="wrap ab-stage" data-ab>
              <div class="ab-grid">
                <article class="ab-tile ab-num-tile ab-s1 ab-k1 reveal" data-tilt>
                  <div class="ab-silk" aria-hidden="true"><img src="/assets/home/about-waves.webp" alt="" width="900" height="563" loading="lazy" decoding="async" /><span class="ab-plus">{icon('arrow-up-right', { size: 16 })}</span></div>
                  <Num v={STATS[0][0]} /><span class="ab-num-cap">{STATS[0][1]}</span>
                </article>
                <a class="ab-tile ab-num-tile ab-s2 ab-k2 reveal" style="--d:.05s" href={href(lang, '/work')} data-tilt>
                  <span class="ab-notch" aria-hidden="true"><span class="ab-notch-btn">{icon('arrow-up-right', { size: 18 })}</span></span>
                  <span class="ab-chips" aria-hidden="true">{(['building', 'heart', 'package', 'globe'] as const).map((n, k) => <i style={`--k:${k}`}>{icon(n, { size: 16 })}</i>)}<i class="more">+6</i></span>
                  <Num v={STATS[1][0]} /><span class="ab-num-cap">{STATS[1][1]}</span>
                </a>
                <article class="ab-tile ab-num-tile ab-s4 ab-k3 reveal" style="--d:.1s" data-tilt>
                  <span class="ab-orb" aria-hidden="true"></span>
                  <Num v={STATS[3][0]} /><span class="ab-num-cap">{STATS[3][1]}</span>
                </article>
                <article class="ab-tile ab-offers reveal" style="--d:.15s" data-offers aria-roledescription="carousel" aria-label="What Ferrn offers">
                  <div class="ab-offers-glow" aria-hidden="true">{OFFERS.map((o, k) => <span class={k === 0 ? 'on' : ''} style={`--g1:${o[3]};--g2:${o[4]}`}></span>)}</div>
                  <div class="ab-offers-head"><p class="ab-offers-eye">What Ferrn offers</p><a class="ab-offers-link" href={href(lang, '/services')}>All services {icon('arrow-right', { size: 14 })}</a></div>
                  <div class="ab-offers-slides">
                    {OFFERS.map(([title, line, more, g1, g2], k) => (
                      <div class={`ab-offer ${k === 0 ? 'on' : ''}`} style={`--g1:${g1};--g2:${g2}`} aria-hidden={k === 0 ? undefined : 'true'}>
                        <span class="ab-offer-art" aria-hidden="true">{raw(OFFER_ART[k])}</span>
                        <p class="ab-offer-title">{title}</p>
                        <p class="ab-offer-line">{line}</p>
                        <p class="ab-offer-more">{more}</p>
                      </div>
                    ))}
                  </div>
                  <div class="ab-offers-bars" role="tablist" aria-label="Services">
                    {OFFERS.map((o, k) => <button type="button" role="tab" aria-selected={k === 0 ? 'true' : 'false'} aria-label={o[0]} class={k === 0 ? 'on' : ''}><i></i></button>)}
                  </div>
                </article>
                <article class="ab-tile ab-team reveal">
                  <div class="ab-people">
                    <ul class="ab-faces">
                      {team.map((m, i) => (
                        <li tabindex={0}>
                          {m.photo ? <img src={sized(m.photo, 128)!} alt={m.name} width="64" height="64" loading="lazy" /> : <span class="ab-ini" style={`--h:${(i * 57 + 18) % 360}`} aria-label={m.name}>{initials(m.name)}</span>}
                          <span class="ab-face-tip" role="tooltip"><b>{m.name}</b><small>{m.role}</small></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Cap k={4} />
                </article>
                <article class="ab-tile ab-num-tile ab-s3 ab-pic reveal" style="--d:.05s" data-tilt>
                  <img class="ab-pic-img" src="/assets/home/about-studio.webp" alt="" loading="lazy" decoding="async" width="1200" height="675" />
                  <Num v={STATS[2][0]} /><span class="ab-num-cap">{STATS[2][1]}</span>
                </article>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── showreel: no header, the work speaks. Inline it plays muted; the popup plays it with sound. ── */}
      {(() => {
        const raw0 = mediaUrl(ctx.get('home.reel.video'));
        if (!raw0) return null;
        // the site version busts browser caches when the film is re-rendered under the same name
        const bust = (u: string) => (u.startsWith('/') && !u.includes('?') ? `${u}?v=${ASSET_V}` : u);
        const src = bust(raw0);
        const p0 = mediaUrl(ctx.get('home.reel.poster'));
        const poster = p0 ? bust(p0) : undefined;
        const chapters = ctx.get('home.reel.chapters').split('\n').map((l) => l.split('|')).filter((p) => p.length >= 2 && p[1].trim()).map(([t, label]) => ({ t: Number(t) || 0, label: label.trim() }));
        const first = chapters[0]?.label || '';
        return (
          <section class="reel-room" id="reel" aria-label="Ferrn film: what we do">
            <div class="reel" data-reel data-chapters={JSON.stringify(chapters)}>
              <div class="reel-frame">
                <video class="reel-video" data-reel-video data-reel-src={src} poster={poster} muted loop playsinline preload="none" aria-hidden="true"></video>
                <button type="button" class="reel-hit" data-reel-open aria-label="Watch the Ferrn film with sound"></button>
                <span class="reel-cursor" data-reel-cursor aria-hidden="true"><span class="reel-cursor-in">{icon('play', { size: 22 })}<b>Watch video</b></span></span>
                <button type="button" class="reel-mute" data-reel-mute aria-pressed="false" aria-label="Turn sound on">
                  <span class="on" aria-hidden="true">{icon('volume-2', { size: 18 })}</span><span class="off" aria-hidden="true">{icon('volume-x', { size: 18 })}</span>
                </button>
              </div>
            </div>
            <dialog class="reel-modal" data-reel-modal aria-label="Ferrn film">
              <button type="button" class="reel-close" data-reel-close aria-label="Close">{icon('x', { size: 22 })}</button>
              <div class="reel-modal-box">
                <video class="reel-modal-video" data-reel-full data-reel-src={src} poster={poster} playsinline preload="none"></video>
                <div class="reel-modal-bar">
                  <button type="button" class="reel-btn" data-reel-toggle aria-label="Pause"><span class="pa">{icon('pause', { size: 18 })}</span><span class="pl">{icon('play', { size: 18 })}</span></button>
                  <span class="reel-time" data-reel-time>0:00</span>
                  <input class="reel-seek" data-reel-seek type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" />
                  <span class="reel-modal-label" data-reel-mlabel>{first}</span>
                  <button type="button" class="reel-btn" data-reel-msound aria-label="Mute"><span class="on">{icon('volume-2', { size: 18 })}</span><span class="off">{icon('volume-x', { size: 18 })}</span></button>
                </div>
              </div>
            </dialog>
          </section>
        );
      })()}

      {/* ── services: six boxes, geometric brand icons ── */}
      {(() => {
        const items = ctx.get('home.svc.items').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x.length >= 2 && x[0]);
        return (
          <section class="svc-room" id="services" aria-labelledby="svc-title">
            <div class="wrap">
              <div class="svc-head">
                <Lines text={ctx.get('home.svc.title')} tag="h2" class="h-display" id="svc-title" />
              </div>
              <div class="svc-grid">
                {items.map(([title, text], i) => (
                  <a class="svc-box reveal" href={href(lang, '/services')} style={`--d:${(i % 3) * 0.08}s`}>
                    <span class="svc-icon">{raw(SERVICE_ICONS[i % SERVICE_ICONS.length])}</span>
                    <h3 class="svc-title">{title}</h3>
                    <p class="svc-text">{text}</p>
                    <span class="svc-go" aria-hidden="true">{icon('arrow-up-right', { size: 18 })}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── growth: how the work turns into revenue ── */}
      <section class="growth" id="growth">
        <div class="wrap">
          <div class="growth-head">
            <H text={ctx.get('home.growth.title')} cls="h-display growth-title" />
          </div>
          <div class="growth-grid">
            <ol class="levers">
              {levers.map(([title, text, tags], i) => (
                <li class="lever reveal" style={`--d:${i * 0.08}s`}>
                  <span class="lever-n">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {tags ? <p class="lever-tags">{tags.split('·').map((x) => <span>{x.trim()}</span>)}</p> : null}
                </li>
              ))}
            </ol>
            <div class="calc reveal" data-calc>
              <div class="calc-head">
                <h3>What one more enquiry in a hundred is worth</h3>
                <div class="currency-toggle calc-cur" role="group" aria-label="Currency"><button type="button" data-calc-cur="NGN" class="active">₦</button><button type="button" data-calc-cur="USD">$</button></div>
              </div>
              <label class="calc-row"><span>Visitors a month <b data-calc-out="visits">3,000</b></span><input type="range" min="200" max="50000" step="100" value="3000" data-calc-in="visits" /></label>
              <label class="calc-row"><span>Average sale <b data-calc-out="sale">₦150,000</b></span><input type="range" min="0" max="100" step="1" value="45" data-calc-in="sale" /></label>
              <label class="calc-row"><span>Visitors who become customers now <b data-calc-out="rate">1.0%</b></span><input type="range" min="0.2" max="5" step="0.1" value="1" data-calc-in="rate" /></label>
              <div class="calc-result">
                <p><span>If a better site lifts that to <b data-calc-out="better">2.0%</b></span></p>
                <p class="calc-big"><b data-calc-out="extra">+₦4,500,000</b><small>more a month</small></p>
                <p class="calc-sub"><span data-calc-out="customers">+30 customers</span> · <span data-calc-out="year">₦54,000,000 a year</span></p>
              </div>
              <p class="calc-note">An illustration with your own numbers, not a promise. Every project starts by measuring where you are, so you can see what actually changes.</p>
              <a class="btn btn-primary calc-cta" href={href(lang, '/contact')}>Get a free review of your site {icon('arrow-up-right', { size: 15 })}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── dark room: marketplace ── */}
      <section class="room room-dark" id="marketplace">
        <div class="wrap">
          <div class="room-head">
            <H text={ctx.get('home.market.title')} />
          </div>
          <div class="shelf">
            {p.products.slice(0, 3).map((x, i) => (
              <a class="shelf-item reveal" style={`--d:${i * 0.1}s`} href={href(lang, `/marketplace/${x.slug}`)}>
                <div class="shelf-shot">{productShot(x) ? <img src={productShot(x)!} alt="" loading="lazy" /> : <div class="product-media-empty">{icon('package', { size: 28 })}</div>}</div>
                <div class="shelf-body">
                  <h3>{x.name}</h3>
                  <p>{x.tagline}</p>
                  <span class="shelf-price">{money(x.price_ngn_monthly, 'NGN')}<small>{t(lang, 'market.month')}</small> <em>· live in {x.delivery_days} days</em></span>
                </div>
              </a>
            ))}
          </div>
          <div class="room-links reveal"><a class="btn btn-ghost btn-pill" href={href(lang, '/marketplace')}>{t(lang, 'nav.marketplace')} {icon('arrow-right', { size: 15 })}</a></div>
        </div>
      </section>

      {/* ── light room: work with device mockups ── */}
      <section class="room room-light room-haze" id="work">
        <div class="wrap">
          <div class="room-head">
            <H text={ctx.get('home.work.title')} />
            {ctx.get('home.work.lead') ? <p class="room-lead reveal">{ctx.get('home.work.lead')}</p> : null}
          </div>
          <div class="wk-grid">
            {featured.map((x, i) => { const img = shotOf(x); return (
              <a class={`wk reveal wk-${i + 1}`} style={`--d:${i * 0.08}s`} href={href(lang, `/work/${x.slug}`)}>
                <div class="wk-shot">{img ? <img src={img} alt={`${x.title} website`} loading="lazy" decoding="async" /> : <div class="work-media-empty">{icon('image', { size: 26 })}</div>}</div>
                <div class="wk-cap">
                  <span class="wk-n">{String(i + 1).padStart(2, '0')}</span>
                  <span class="wk-t">
                    <strong>{x.title}</strong>
                    <span class="wk-tags">{[x.type, x.industry].filter(Boolean).map((tg) => <i>{tg}</i>)}</span>
                  </span>
                  <span class="wk-go" aria-hidden="true">{icon('arrow-up-right', { size: 18 })}</span>
                </div>
              </a>
            ); })}
          </div>
          <div class="room-links reveal"><a class="link" href={href(lang, '/work')}>{t(lang, 'nav.work')} {icon('arrow-right', { size: 15 })}</a></div>
        </div>
      </section>

      {/* ── quotes (short) ── */}
      {p.testimonials.length ? (
        <section class="room room-dark room-quotes" id="testimonials">
          <div class="wrap">
            <div class="room-head"><H text={ctx.get('home.testimonials.title')} /></div>
            <div class="quotes" data-quotes>
              <div class="quotes-track" tabindex={0} aria-label="Client voice notes, scroll sideways">{p.testimonials.map((x, i) => <Testimonial x={x} i={i} />)}</div>
              <div class="quotes-nav"><button type="button" data-prev aria-label="Previous">{icon('arrow-left', { size: 18 })}</button><span data-quotes-pos>1 / {p.testimonials.length}</span><button type="button" data-next aria-label="Next">{icon('arrow-right', { size: 18 })}</button></div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── closing ── */}
      <section class="room room-dark room-close" id="contact">
        <div class="close-glow" aria-hidden="true"></div>
        <div class="wrap close-inner">
          <H text={ctx.get('home.cta.title')} cls="h-display center" />
          <p class="room-lead center reveal">{ctx.get('home.cta.lead')}</p>
          <div class="hero-actions center reveal">
            <a class="btn btn-primary btn-glow" href={href(lang, '/contact')}>{t(lang, 'cta.start')} {icon('arrow-right', { size: 15 })}</a>
            <a class="btn btn-ghost" href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">Book a 20-minute call</a>
          </div>
          <p class="close-mail"><a href="mailto:info@ferrnagency.com">info@ferrnagency.com</a></p>
        </div>
      </section>
    </Layout>
  );
}
