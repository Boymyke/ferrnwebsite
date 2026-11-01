import { t, type Lang } from '../content/i18n';
import { CLIENT_LOGOS, FAQS, PROCESS, STATS } from '../content/site';
import type { Project } from '../content/projects';
import { href, initials, Layout, money, Section } from './layout';

export type ProductRow = {
  slug: string; name: string; category: string; industry: string | null; tagline: string | null; description?: string | null;
  demo_url: string | null; accent: string | null; price_ngn_setup: number | null; price_ngn_monthly: number | null;
  price_usd_setup: number | null; price_usd_monthly: number | null; buyout_ngn?: number | null; buyout_usd?: number | null;
  delivery_days: number | null; features_json?: string; includes_json?: string;
};
export type TeamRow = { id: string; name: string; role: string; bio: string | null; photo: string | null; linkedin: string | null; github: string | null };
export type TestimonialRow = { name: string; role: string | null; quote: string; avatar: string | null };
export type PostRow = { slug: string; title: string; category: string | null; excerpt: string | null; published_at: string | null };

export const shot = (p: Project) => p.image || `https://image.thum.io/get/width/1200/crop/800/noanimate/${p.live}`;

/** "next." drawn on like handwriting with an orange glow (modelled on the texteffect reference). */
export function WriteOn({ text, class: cls }: { text: string; class?: string }) {
  return (
    <span class={`writeon ${cls ?? ''}`} data-writeon>
      <svg aria-hidden="true" focusable="false" preserveAspectRatio="xMinYMid meet">
        <defs>
          <linearGradient id="wo-glow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#ffb08a" /><stop offset=".45" stop-color="#ff4100" /><stop offset="1" stop-color="#ff7a3d" />
          </linearGradient>
        </defs>
        <text x="0" y="0" dominant-baseline="alphabetic">{text}</text>
      </svg>
      <span class="sr-only">{text}</span>
    </span>
  );
}

export function TeamCard({ m }: { m: TeamRow }) {
  return (
    <article class="team-card reveal">
      <div class="avatar" data-initials={initials(m.name)}>
        {m.photo ? <img src={m.photo.startsWith('http') ? m.photo : `/media/${m.photo}`} alt={m.name} loading="lazy" /> : <span>{initials(m.name)}</span>}
      </div>
      <h3>{m.name}</h3>
      <p class="team-role">{m.role}</p>
      {m.bio ? <p class="team-bio">{m.bio}</p> : null}
      <div class="team-links">
        {m.linkedin ? <a href={m.linkedin} rel="noopener" target="_blank">LinkedIn</a> : null}
        {m.github ? <a href={m.github} rel="noopener" target="_blank">GitHub</a> : null}
      </div>
    </article>
  );
}

export function ProductCard({ p, lang }: { p: ProductRow; lang: Lang }) {
  return (
    <article class="product-card reveal" data-category={p.category} style={`--accent:${p.accent ?? '#ff4100'}`}>
      <a class="product-media" href={href(lang, `/marketplace/${p.slug}`)} aria-label={p.name}>
        {p.demo_url ? <iframe src={p.demo_url} title={`${p.name} preview`} loading="lazy" tabindex={-1} aria-hidden="true" scrolling="no"></iframe> : null}
        <span class="product-chip">{t(lang, `market.${p.category}`)}</span>
      </a>
      <div class="product-body">
        <p class="product-industry">{p.industry}</p>
        <h3><a href={href(lang, `/marketplace/${p.slug}`)}>{p.name}</a></h3>
        <p class="product-tag">{p.tagline}</p>
        <div class="product-price" data-price-ngn={`${p.price_ngn_setup}|${p.price_ngn_monthly}`} data-price-usd={`${p.price_usd_setup}|${p.price_usd_monthly}`}>
          <span class="price-main">{money(p.price_ngn_monthly, 'NGN')}<small>{t(lang, 'market.month')}</small></span>
          <span class="price-sub">+ {money(p.price_ngn_setup, 'NGN')} {t(lang, 'market.setup')}</span>
        </div>
        <div class="product-actions">
          {p.demo_url ? <a class="btn btn-ghost btn-sm" href={p.demo_url} target="_blank" rel="noopener">{t(lang, 'cta.demo')} ↗</a> : null}
          <a class="btn btn-primary btn-sm" href={href(lang, `/marketplace/${p.slug}`)}>{t(lang, 'market.buy')}</a>
        </div>
      </div>
    </article>
  );
}

export function ContactForm({ lang, type = 'contact', product }: { lang: Lang; type?: string; product?: string }) {
  return (
    <form class="contact-form reveal" data-form={type}>
      <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex={-1} autocomplete="off" /></label></div>
      {product ? <input type="hidden" name="product" value={product} /> : null}
      <div class="form-grid">
        <label class="field">{t(lang, 'form.name')} *<input name="name" required autocomplete="name" /></label>
        <label class="field">{t(lang, 'form.email')} *<input name="email" type="email" required autocomplete="email" /></label>
        <label class="field">{t(lang, 'form.phone')}<input name="phone" autocomplete="tel" /></label>
        <label class="field">{t(lang, 'form.company')}<input name="company" autocomplete="organization" /></label>
        <label class="field">{t(lang, 'form.need')}
          <select name="need">
            <option>Website</option><option>Web application</option><option>AI assistant / automation</option>
            <option>Marketplace product</option><option>E-commerce</option><option>Not sure yet</option>
          </select>
        </label>
        <label class="field">{t(lang, 'form.budget')}
          <select name="budget">
            <option>Under ₦500k / $500</option><option>₦500k–₦1.5m / $500–$1.5k</option><option>₦1.5m–₦5m / $1.5k–$5k</option>
            <option>₦5m+ / $5k+</option><option>Not sure</option>
          </select>
        </label>
        <label class="field field-wide">{t(lang, 'form.message')}<textarea name="message" rows={5} maxlength={4000}></textarea></label>
        <label class="field-check field-wide"><input type="checkbox" name="wa_consent" /> <span>{t(lang, 'form.wa_consent')}</span></label>
      </div>
      <button class="btn btn-primary" type="submit">{t(lang, 'form.send')} ↗</button>
      <p class="form-status" role="status"></p>
    </form>
  );
}

export function HomePage(p: {
  lang: Lang; projects: Project[]; products: ProductRow[]; team: TeamRow[]; testimonials: TestimonialRow[]; posts: PostRow[];
}) {
  const { lang } = p;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://www.ferrnagency.com/#org', name: 'Ferrn Digital Agency', url: 'https://www.ferrnagency.com/',
        email: 'info@ferrnagency.com', logo: 'https://www.ferrnagency.com/brand/ferrn-mark.svg', areaServed: 'Worldwide',
        sameAs: ['https://www.instagram.com/ferrn.agency/', 'https://x.com/ferrn_agency', 'https://www.linkedin.com/company/109135329/', 'https://www.tiktok.com/@ferrnagency'] },
      { '@type': 'WebSite', url: 'https://www.ferrnagency.com/', name: 'Ferrn Digital Agency', inLanguage: ['en', 'yo', 'ig', 'ha', 'fr', 'de', 'es', 'zh'] },
      { '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  const featured = p.projects.filter((x) => x.featured);
  return (
    <Layout lang={lang} path="/" intro schema={schema}
      title="Ferrn Digital Agency — Websites, Web Apps & AI Automation"
      description="Ferrn designs and builds conversion-focused websites, custom web applications and AI automation for businesses in Nigeria, the UK, the US and beyond — plus ready-built products you can launch in days.">
      <section class="hero">
        <div class="hero-glow" aria-hidden="true"></div>
        <div class="container hero-inner">
          <span class="eyebrow hero-eyebrow">{t(lang, 'hero.eyebrow')}</span>
          <h1 class="hero-title">
            <span class="hero-line">{t(lang, 'hero.title1')}</span>{' '}
            <WriteOn text={t(lang, 'hero.title2')} class="hero-script" />
          </h1>
          <p class="hero-copy">{t(lang, 'hero.sub')}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} ↗</a>
            <a class="btn btn-ghost" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')} →</a>
          </div>
        </div>
        <div class="proof">
          <div class="proof-count">
            <strong data-count="50" data-suffix="+">0</strong>
            <span>{t(lang, 'intro.count')}<br /><em>{t(lang, 'intro.sub')}</em></span>
          </div>
          <div class="logo-arc" aria-label="Clients">
            <div class="logo-ring" style={`--n:${CLIENT_LOGOS.length * 2}`}>
              {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((l, i) => (
                <img src={l.src} alt={i < CLIENT_LOGOS.length ? `${l.name} logo` : ''} style={`--i:${i}`} loading="lazy" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow={t(lang, 'impact.eyebrow')} title={t(lang, 'impact.title')} id="impact">
        <div class="tabs reveal" role="tablist">
          <button class="tab active" type="button" data-filter="all">{t(lang, 'market.all')}</button>
          <button class="tab" type="button" data-filter="website">{t(lang, 'market.website')}</button>
          <button class="tab" type="button" data-filter="webapp">{t(lang, 'market.webapp')}</button>
          <button class="tab" type="button" data-filter="ai">{t(lang, 'market.chatbot')}</button>
        </div>
        <div class="impact-grid" data-filter-grid>
          {featured.map((x, i) => (
            <a class="impact-card reveal" data-category={x.category} href={href(lang, `/work/${x.slug}`)}>
              <div class="impact-media"><img src={shot(x)} alt={`Screenshot of ${x.title}`} loading="lazy" /><span class="impact-index">{String(i + 1).padStart(2, '0')} · {x.type}</span></div>
              <div class="impact-body">
                <div class="impact-meta"><h3>{x.title}</h3><span>{x.industry}</span></div>
                <p>{x.summary}</p>
                <p class="impact-result"><strong>Effect</strong> {x.impact}</p>
              </div>
            </a>
          ))}
        </div>
      </Section>

      <Section eyebrow={t(lang, 'services.eyebrow')} title={t(lang, 'services.title')} id="services">
        <div class="service-list">
          {['s1', 's2', 's3'].map((k, i) => (
            <a class="service-row reveal" href={href(lang, '/services')}>
              <span class="service-num">0{i + 1}</span>
              <h3>{t(lang, `${k}.title`)}</h3>
              <p>{t(lang, `${k}.body`)}</p>
              <span class="service-arrow">↗</span>
            </a>
          ))}
        </div>
      </Section>

      <Section eyebrow={t(lang, 'market.eyebrow')} title={t(lang, 'market.title')} lead={t(lang, 'market.sub')} class="section-dark" id="marketplace">
        <div class="product-grid">
          {p.products.slice(0, 3).map((x) => <ProductCard p={x} lang={lang} />)}
        </div>
        <div class="section-action reveal"><a class="btn btn-ghost" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')} →</a></div>
      </Section>

      <Section eyebrow={t(lang, 'team.eyebrow')} title={t(lang, 'team.title')} id="team">
        <div class="team-grid">{p.team.map((m) => <TeamCard m={m} />)}</div>
      </Section>

      <Section eyebrow={t(lang, 'testimonials.eyebrow')} title={t(lang, 'testimonials.title')} id="testimonials">
        <div class="testimonials reveal" data-slider>
          <div class="testimonial-track">
            {p.testimonials.map((x) => (
              <figure class="testimonial">
                <blockquote>“{x.quote}”</blockquote>
                <figcaption>
                  {x.avatar ? <img src={x.avatar} alt="" loading="lazy" width="44" height="44" /> : <span class="avatar sm">{initials(x.name)}</span>}
                  <span><strong>{x.name}</strong><small>{x.role}</small></span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div class="slider-controls"><button type="button" data-prev aria-label="Previous">←</button><button type="button" data-next aria-label="Next">→</button></div>
        </div>
      </Section>

      <Section eyebrow={t(lang, 'process.eyebrow')} title={t(lang, 'process.title')}>
        <ol class="process reveal">
          {PROCESS.map(([a, b, c]) => <li><span>{a}</span><h3>{b}</h3><p>{c}</p></li>)}
        </ol>
        <div class="metrics reveal">
          {STATS.map((s) => <div><strong data-count={s.value} data-suffix={s.suffix}>0</strong><span>{s.label}</span></div>)}
        </div>
      </Section>

      <Section eyebrow={t(lang, 'faq.eyebrow')} title={t(lang, 'faq.title')} id="faq">
        <div class="faq reveal">
          {FAQS.map(([q, a]) => <details><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </Section>

      {p.posts.length ? (
        <Section eyebrow={t(lang, 'nav.insights')} title="Useful thinking for better digital decisions.">
          <div class="post-grid">
            {p.posts.map((x) => (
              <a class="post-card reveal" href={href(lang, `/insights/${x.slug}`)}>
                <span class="post-meta">{x.category} · {x.published_at?.slice(0, 10)}</span>
                <h3>{x.title}</h3><p>{x.excerpt}</p><span class="post-link">Read →</span>
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <section class="section" id="contact">
        <div class="container contact-wrap">
          <div class="contact-panel reveal">
            <span class="eyebrow">{t(lang, 'contact.eyebrow')}</span>
            <h2 class="h2">{t(lang, 'contact.title')}</h2>
            <p>{t(lang, 'contact.sub')}</p>
            <a class="contact-email" href="mailto:info@ferrnagency.com">info@ferrnagency.com</a>
            <a class="btn btn-ghost" href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">{t(lang, 'cta.book')} ↗</a>
          </div>
          <ContactForm lang={lang} />
        </div>
      </section>
    </Layout>
  );
}
