import { raw } from 'hono/html';
import { t, type Lang } from '../content/i18n';
import { CLIENT_LOGOS, FAQS, PROCESS } from '../content/site';
import type { SiteCtx } from '../lib/content';
import { icon } from '../lib/icons';
import { shotOf, type PublicProject } from '../lib/projects';
import { Head, href, initials, Layout, money, Section } from './layout';

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

/** Headline split into lines on "|", each line revealed through a gradient mask. */
export function Lines({ text, class: cls, tag = 'h1' }: { text: string; class?: string; tag?: 'h1' | 'h2' | 'p' }) {
  const lines = text.split('|').map((s) => s.trim()).filter(Boolean);
  const inner = lines.map((l, i) => `<span class="line" style="--i:${i}"><span class="line-in">${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))}</span></span>`).join('');
  return raw(`<${tag} class="${cls ?? ''} lines" data-lines>${inner}</${tag}>`);
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

export function ProductCard({ p, lang }: { p: ProductRow; lang: Lang }) {
  const cover = mediaUrl(p.cover) ?? (p.demo_url ? `https://image.thum.io/get/width/1200/crop/750/noanimate/${p.demo_url}` : null);
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
  return (
    <figure class={`quote-card ${audio ? 'has-audio' : ''}`} data-quote style={`--i:${i}`}>
      <blockquote><span class="quote-mark" aria-hidden="true">“</span>{x.quote}</blockquote>
      {audio ? (
        <div class="voice" data-voice>
          <button class="voice-btn" type="button" data-voice-play aria-label={`Play ${x.name}’s testimonial`}>{icon('play', { size: 16 })}<span class="voice-pause">{icon('pause', { size: 16 })}</span></button>
          <span class="voice-bars" aria-hidden="true">{Array.from({ length: 28 }, (_, k) => <i style={`--k:${k}`}></i>)}</span>
          <span class="voice-time" data-voice-time>0:00</span>
          <audio preload="none" src={audio}></audio>
          {x.transcript ? <details class="voice-transcript"><summary>Transcript</summary><p>{x.transcript}</p></details> : null}
        </div>
      ) : null}
      <figcaption>
        {x.avatar ? <img src={mediaUrl(x.avatar)!} alt="" loading="lazy" width="44" height="44" /> : <span class="avatar sm">{initials(x.name)}</span>}
        <span><strong>{x.name}</strong><small>{[x.role, x.company].filter(Boolean).join(', ')}</small></span>
        {x.logo ? <img class="quote-logo" src={mediaUrl(x.logo)!} alt={x.company ?? ''} loading="lazy" height="22" /> : null}
      </figcaption>
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

export function HomePage(p: {
  lang: Lang; ctx: SiteCtx; projects: PublicProject[]; products: ProductRow[]; testimonials: TestimonialRow[]; posts: PostRow[];
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
  const featured = p.projects.filter((x) => x.featured).slice(0, 5);
  const stats = ctx.get('home.stats').split('\n').map((l) => l.split('|')).filter((x) => x.length === 2);
  const services = ['s1', 's2', 's3'] as const;
  const serviceIcons = ['monitor', 'layout-dashboard', 'brain-circuit'];
  const serviceAnchors = ['websites', 'apps', 'ai'];
  const serviceBullets = [
    ['Positioning & copy', 'UI/UX design', 'Fast, SEO-ready build', 'Booking, quote & enquiry flows'],
    ['Client & patient portals', 'Admin dashboards', 'Workflow & approvals', 'Payments, roles & audit logs'],
    ['Website & WhatsApp assistants', 'Document intelligence', 'Lead follow-up automation', 'Internal AI copilots'],
  ];
  return (
    <Layout lang={lang} ctx={ctx} path="/" kind="home" intro schema={schema} title={ctx.get('seo.home.title')} description={ctx.get('seo.home.description')}>
      {/* ── hero ── */}
      <section class="hero" data-hero>
        <div class="hero-bg" aria-hidden="true"><div class="hero-light"></div></div>
        <div class="wrap hero-inner">
          <p class="hero-kicker reveal">{ctx.season?.greeting ? <span class="season-greet">{ctx.season.greeting}</span> : ctx.get('home.hero.kicker')}</p>
          <Lines text={ctx.get('home.hero.title')} class="hero-title" />
          <div class="hero-grid">
            <p class="hero-copy reveal" style="--d:.35s">{ctx.get('home.hero.sub')}</p>
            <div class="hero-actions reveal" style="--d:.5s">
              <a class="btn btn-primary" href={href(lang, '/contact')}>{ctx.get('home.hero.cta')} {icon('arrow-up-right', { size: 16 })}</a>
              <a class="btn btn-ghost" href={href(lang, '/work')}>{ctx.get('home.hero.cta2')} {icon('arrow-right', { size: 16 })}</a>
            </div>
          </div>
        </div>
        <div class="hero-foot wrap reveal" style="--d:.7s">
          <div class="hero-stats">{stats.map(([v, l]) => <div><strong>{v}</strong><span>{l}</span></div>)}</div>
          <div class="hero-scroll" aria-hidden="true">{icon('arrow-down', { size: 16 })} <span>Scroll</span></div>
        </div>
      </section>

      {/* ── capabilities ticker + client logos ── */}
      <div class="ticker" aria-hidden="true"><div class="ticker-track">{[0, 1].map(() => ctx.list('home.ticker').map((s) => <span>{s}<i></i></span>))}</div></div>
      <section class="logos wrap">
        <p class="logos-label">Trusted by teams in logistics, healthcare, education, energy and Web3</p>
        <div class="logo-row">{CLIENT_LOGOS.map((l) => <img src={l.src} alt={`${l.name} logo`} loading="lazy" height="28" />)}</div>
      </section>

      {/* ── featured work ── */}
      <Section n="01" label={t(lang, 'nav.work')} title={ctx.get('home.work.title')} id="work" right={<a class="link" href={href(lang, '/work')}>All work {icon('arrow-right', { size: 15 })}</a>}>
        <div class="work-list">{featured.map((x, i) => <WorkRow p={x} lang={lang} i={i} />)}</div>
      </Section>

      {/* ── services: stacked story cards ── */}
      <section class="section section-dark" id="services">
        <div class="wrap">
          <Head n="02" label={t(lang, 'nav.services')} title={ctx.get('home.services.title')} lead={ctx.get('home.services.lead')} />
          <div class="stack">
            {services.map((k, i) => (
              <article class="stack-card reveal" style={`--i:${i}`} id={`home-${serviceAnchors[i]}`}>
                <div class="stack-head"><span class="stack-n">0{i + 1}</span>{icon(serviceIcons[i]!, { size: 26, stroke: 1.5, class: 'stack-ic' })}</div>
                <div class="stack-body">
                  <h3>{ctx.get(`${k}.title`)}</h3>
                  <p>{ctx.get(`${k}.body`)}</p>
                  <ul class="ticks">{serviceBullets[i]!.map((b) => <li>{icon('check', { size: 14 })}{b}</li>)}</ul>
                  <a class="link" href={href(lang, `/services#${serviceAnchors[i]}`)}>How we do it {icon('arrow-right', { size: 15 })}</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── marketplace ── */}
      {p.products.length ? (
        <Section n="03" label={t(lang, 'nav.marketplace')} title={ctx.get('home.market.title')} lead={ctx.get('home.market.lead')} id="marketplace" right={<a class="link" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')} {icon('arrow-right', { size: 15 })}</a>}>
          <div class="product-grid">{p.products.slice(0, 3).map((x) => <ProductCard p={x} lang={lang} />)}</div>
        </Section>
      ) : null}

      {/* ── process ── */}
      <Section n="04" label="Process" title={ctx.get('home.process.title')} id="process" class="section-tight">
        <ol class="process">
          {PROCESS.map(([a, b, c], i) => <li class="reveal" style={`--d:${i * 0.08}s`}><span>{a}</span><h3>{b}</h3><p>{c}</p></li>)}
        </ol>
      </Section>

      {/* ── testimonials ── */}
      {p.testimonials.length ? (
        <Section n="05" label="Clients" title={ctx.get('home.testimonials.title')} id="testimonials" class="section-dark">
          <div class="quotes" data-quotes>
            <div class="quotes-track">{p.testimonials.map((x, i) => <Testimonial x={x} i={i} />)}</div>
            <div class="quotes-nav"><button type="button" data-prev aria-label="Previous">{icon('arrow-left', { size: 18 })}</button><span data-quotes-pos>1 / {p.testimonials.length}</span><button type="button" data-next aria-label="Next">{icon('arrow-right', { size: 18 })}</button></div>
          </div>
        </Section>
      ) : null}

      {/* ── faq ── */}
      <Section n="06" label="FAQ" title={ctx.get('home.faq.title')} id="faq" class="section-tight">
        <div class="faq reveal">{faqs.map(([q, a]) => <details><summary>{q}{icon('chevron-down', { size: 18 })}</summary><p>{a}</p></details>)}</div>
      </Section>

      {/* ── insights ── */}
      {p.posts.length ? (
        <Section n="07" label={t(lang, 'nav.insights')} title="Useful thinking for better digital decisions." class="section-tight" right={<a class="link" href={href(lang, '/insights')}>All insights {icon('arrow-right', { size: 15 })}</a>}>
          <div class="post-grid">{p.posts.map((x) => (
            <a class="post reveal" href={href(lang, `/insights/${x.slug}`)}><span class="post-meta">{x.category} · {x.published_at?.slice(0, 10)}</span><h3>{x.title}</h3><p>{x.excerpt}</p><span class="link">Read {icon('arrow-right', { size: 14 })}</span></a>
          ))}</div>
        </Section>
      ) : null}

      {/* ── start a project ── */}
      <section class="section" id="contact">
        <div class="wrap contact-split">
          <div class="reveal">
            <p class="head-rule"><span>08 — Start a project</span></p>
            <h2 class="h2">{ctx.get('contact.title')}</h2>
            <p class="lead">{ctx.get('contact.sub')}</p>
            <a class="contact-email" href="mailto:info@ferrnagency.com">info@ferrnagency.com {icon('arrow-up-right', { size: 20 })}</a>
          </div>
          <ContactForm lang={lang} ctx={ctx} />
        </div>
      </section>
    </Layout>
  );
}
