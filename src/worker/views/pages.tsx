import { raw } from 'hono/html';
import { t, type Lang } from '../content/i18n';
import { SERVICES_DETAIL, STATS } from '../content/site';
import type { Project } from '../content/projects';
import { POLICIES } from '../content/policies';
import { href, Layout, money, Section } from './layout';
import { ContactForm, ProductCard, shot, TeamCard, WriteOn, type PostRow, type ProductRow, type TeamRow } from './home';

const PageHero = (p: { eyebrow: string; title: string; lead?: string; accent?: string }) => (
  <section class="page-hero">
    <div class="container">
      <span class="eyebrow">{p.eyebrow}</span>
      <h1 class="h1">{p.title} {p.accent ? <WriteOn text={p.accent} class="inline-script" /> : null}</h1>
      {p.lead ? <p class="lead">{p.lead}</p> : null}
    </div>
  </section>
);

export function WorkPage({ lang, projects }: { lang: Lang; projects: Project[] }) {
  return (
    <Layout lang={lang} path="/work" title="Work — Ferrn Digital Agency" description="Case studies across websites, web applications and AI automation.">
      <PageHero eyebrow={t(lang, 'nav.work')} title={t(lang, 'impact.title')} />
      <div class="container">
        <div class="impact-grid">
          {projects.map((x, i) => (
            <a class="impact-card reveal" href={href(lang, `/work/${x.slug}`)}>
              <div class="impact-media"><img src={shot(x)} alt={`Screenshot of ${x.title}`} loading="lazy" /><span class="impact-index">{String(i + 1).padStart(2, '0')} · {x.type}</span></div>
              <div class="impact-body"><div class="impact-meta"><h3>{x.title}</h3><span>{x.industry} · {x.year}</span></div><p>{x.summary}</p></div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export function CasePage({ lang, p, note }: { lang: Lang; p: Project; note?: boolean }) {
  return (
    <Layout lang={lang} path={`/work/${p.slug}`} title={`${p.title} — ${p.type} | Ferrn`} description={p.meta}>
      <PageHero eyebrow={`${p.type} · ${p.industry} · ${p.year}`} title={p.title} lead={p.summary} />
      <div class="container case">
        <figure class="case-shot reveal"><img src={shot(p)} alt={`Screenshot of ${p.title}`} /></figure>
        {note ? <p class="machine-note">{t(lang, 'machine.note')}</p> : null}
        <div class="case-grid">
          <div><h2>Context</h2><p>{p.context}</p></div>
          <div><h2>Challenge</h2><p>{p.challenge}</p></div>
          <div><h2>What we built</h2><p>{p.solution}</p></div>
          <div><h2>Effect</h2><p>{p.impact}</p></div>
        </div>
        <div class="points">{p.points.map((x) => <div class="point reveal"><h3>{x.title}</h3><p>{x.text}</p></div>)}</div>
        <p><a class="btn btn-ghost" href={p.live} target="_blank" rel="noopener">Visit live site ↗</a> <a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} ↗</a></p>
      </div>
    </Layout>
  );
}

export function ServicesPage({ lang }: { lang: Lang }) {
  return (
    <Layout lang={lang} path="/services" title="Services — Ferrn Digital Agency" description="Websites, custom web applications and AI automation for growing businesses.">
      <PageHero eyebrow={t(lang, 'services.eyebrow')} title={t(lang, 'services.title')} />
      <div class="container">
        {SERVICES_DETAIL.map((s, i) => (
          <section class="service-detail reveal">
            <span class="service-num">0{i + 1}</span>
            <div><h2>{t(lang, `${s.key}.title`)}</h2><p class="lead">{t(lang, `${s.key}.body`)}</p></div>
            <ul class="tick-list">{s.items.map((x) => <li>{x}</li>)}</ul>
          </section>
        ))}
        <div class="metrics reveal">{STATS.map((s) => <div><strong data-count={s.value} data-suffix={s.suffix}>0</strong><span>{s.label}</span></div>)}</div>
        <div class="section-action"><a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} ↗</a> <a class="btn btn-ghost" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')}</a></div>
      </div>
    </Layout>
  );
}

export function TeamPage({ lang, team }: { lang: Lang; team: TeamRow[] }) {
  return (
    <Layout lang={lang} path="/team" title="Team — Ferrn Digital Agency" description="The people behind Ferrn: strategy, design, engineering and AI.">
      <PageHero eyebrow={t(lang, 'team.eyebrow')} title={t(lang, 'team.title')} />
      <div class="container"><div class="team-grid">{team.map((m) => <TeamCard m={m} />)}</div></div>
      <Section title="Want to work with us?" lead="We hire designers, engineers and AI builders who care about business outcomes.">
        <a class="btn btn-ghost" href={href(lang, '/careers')}>Careers →</a>
      </Section>
    </Layout>
  );
}

export function AboutPage({ lang, team }: { lang: Lang; team: TeamRow[] }) {
  return (
    <Layout lang={lang} path="/about" title="About Ferrn Digital Agency" description="A focused digital product partner for businesses in Nigeria and worldwide.">
      <PageHero eyebrow={t(lang, 'nav.about')} title="A focused digital product partner, not another layer of agency overhead." />
      <div class="container prose-wrap">
        <p class="lead">Ferrn combines business strategy, UI/UX design and engineering so companies can move from a problem to a working digital product with one accountable team. Our operating principle: <strong>make money, save time, solve something worth solving.</strong></p>
        <p>We work with clients across Nigeria, the United Kingdom, the United States, Canada and beyond — from logistics and infrastructure firms to healthcare, education, Web3 and civic organisations.</p>
        <p><a class="btn btn-ghost" href="/assets/Ferrn-Agency-Company-Profile.pdf" download>Download our company profile ↓</a></p>
      </div>
      <Section eyebrow={t(lang, 'team.eyebrow')} title={t(lang, 'team.title')}><div class="team-grid">{team.map((m) => <TeamCard m={m} />)}</div></Section>
    </Layout>
  );
}

export function InsightsPage({ lang, posts }: { lang: Lang; posts: PostRow[] }) {
  return (
    <Layout lang={lang} path="/insights" title="Insights — Ferrn Digital Agency" description="Practical guidance on websites, custom software, product strategy and AI automation.">
      <PageHero eyebrow={t(lang, 'nav.insights')} title="Useful thinking for better digital decisions." />
      <div class="container"><div class="post-grid">
        {posts.map((x) => (
          <a class="post-card reveal" href={href(lang, `/insights/${x.slug}`)}><span class="post-meta">{x.category} · {x.published_at?.slice(0, 10)}</span><h3>{x.title}</h3><p>{x.excerpt}</p><span class="post-link">Read →</span></a>
        ))}
      </div></div>
    </Layout>
  );
}

export function PostPage({ lang, post }: { lang: Lang; post: PostRow & { content_html: string | null } }) {
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, datePublished: post.published_at, author: { '@type': 'Organization', name: 'Ferrn Digital Agency' } };
  return (
    <Layout lang={lang} path={`/insights/${post.slug}`} title={`${post.title} | Ferrn`} description={post.excerpt ?? ''} schema={schema}>
      <PageHero eyebrow={`${post.category ?? 'Insight'} · ${post.published_at?.slice(0, 10) ?? ''}`} title={post.title} lead={post.excerpt ?? ''} />
      <article class="container prose-wrap prose">{raw(post.content_html ?? '')}</article>
      <div class="container"><div class="cta-band reveal"><h2>Need help applying this?</h2><a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} ↗</a></div></div>
    </Layout>
  );
}

export function ContactPage({ lang, rfp }: { lang: Lang; rfp?: boolean }) {
  return (
    <Layout lang={lang} path={rfp ? '/rfp' : '/contact'} title={rfp ? 'Submit an RFP — Ferrn' : 'Contact Ferrn Digital Agency'} description={t(lang, 'contact.sub')}>
      <PageHero eyebrow={rfp ? 'Request for proposal' : t(lang, 'contact.eyebrow')} title={t(lang, 'contact.title')} lead={t(lang, 'contact.sub')} />
      <div class="container contact-wrap">
        <div class="contact-panel">
          <p><strong>Email</strong><br /><a class="contact-email" href="mailto:info@ferrnagency.com">info@ferrnagency.com</a></p>
          <p><strong>Book a 20-minute call</strong><br /><a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">cal.com/ferrn-agency ↗</a></p>
          <p class="muted">We reply within one working day (Lagos time, GMT+1).</p>
        </div>
        <ContactForm lang={lang} type={rfp ? 'rfp' : 'contact'} />
      </div>
    </Layout>
  );
}

export function PoliciesPage({ lang, slug }: { lang: Lang; slug?: string }) {
  const pol = slug ? POLICIES.find((p) => p.slug === slug) : null;
  if (pol) {
    return (
      <Layout lang={lang} path={`/policies/${pol.slug}`} title={`${pol.title} — Ferrn`} description={pol.summary}>
        <PageHero eyebrow="Policy" title={pol.title} lead={pol.summary} />
        <article class="container prose-wrap prose">{raw(pol.content)}</article>
      </Layout>
    );
  }
  return (
    <Layout lang={lang} path="/policies" title="Policies — Ferrn" description="Ferrn's policies and statements.">
      <PageHero eyebrow="Trust" title="Policies and statements" />
      <div class="container"><div class="post-grid">{POLICIES.map((p) => <a class="post-card" href={href(lang, `/policies/${p.slug}`)}><h3>{p.title}</h3><p>{p.summary}</p></a>)}</div></div>
    </Layout>
  );
}

export function SimplePage({ lang, path, title, lead, body }: { lang: Lang; path: string; title: string; lead: string; body: string }) {
  return (
    <Layout lang={lang} path={path} title={`${title} — Ferrn`} description={lead}>
      <PageHero eyebrow="Ferrn" title={title} lead={lead} />
      <article class="container prose-wrap prose">{raw(body)}</article>
    </Layout>
  );
}

export function NotFound({ lang }: { lang: Lang }) {
  return (
    <Layout lang={lang} path="/404" title="Page not found — Ferrn" description="This page does not exist." noindex>
      <PageHero eyebrow="404" title="This page wandered off." accent="Let’s get you back." />
      <div class="container section-action"><a class="btn btn-primary" href={href(lang, '/')}>Home</a> <a class="btn btn-ghost" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')}</a></div>
    </Layout>
  );
}

/* ───────────── marketplace ───────────── */

export function MarketplacePage({ lang, products }: { lang: Lang; products: ProductRow[] }) {
  const cats = ['all', 'webapp', 'website', 'chatbot', 'automation'];
  return (
    <Layout lang={lang} path="/marketplace" title="Ferrn Marketplace — Ready-built websites, apps and AI"
      description="Ready-built websites, web applications, AI assistants and automations. Live demos, naira and dollar pricing, live in days.">
      <section class="page-hero market-hero">
        <div class="container">
          <span class="eyebrow">{t(lang, 'market.eyebrow')}</span>
          <h1 class="h1">{t(lang, 'market.title')}</h1>
          <p class="lead">{t(lang, 'market.sub')}</p>
          <div class="market-toolbar">
            <div class="tabs" role="tablist">{cats.map((c, i) => <button class={`tab ${i === 0 ? 'active' : ''}`} type="button" data-filter={c}>{t(lang, `market.${c}`)}</button>)}</div>
            <div class="currency-toggle" role="group" aria-label="Currency"><button type="button" class="active" data-currency="NGN">₦ NGN</button><button type="button" data-currency="USD">$ USD</button></div>
          </div>
        </div>
      </section>
      <div class="container"><div class="product-grid" data-filter-grid>{products.map((p) => <ProductCard p={p} lang={lang} />)}</div></div>
      <Section title="Every plan comes with" class="section-tight">
        <ul class="tick-list cols">
          <li>A live demo before you pay</li><li>Set-up with your logo, content and colours</li><li>Hosting, SSL, backups and updates on managed plans</li>
          <li>Your data exportable any time</li><li>Option to buy the code outright</li><li>WhatsApp support, Lagos hours</li>
        </ul>
      </Section>
    </Layout>
  );
}

export function ProductPage({ lang, p, related, note }: { lang: Lang; p: ProductRow; related: ProductRow[]; note?: boolean }) {
  const features: string[] = JSON.parse(p.features_json || '[]');
  const includes: string[] = JSON.parse(p.includes_json || '[]');
  const tiers = [
    { key: 'launch', name: t(lang, 'plan.launch'), ngn: p.price_ngn_setup, usd: p.price_usd_setup, unit: t(lang, 'market.setup'),
      own: 'Deployed for you on your domain. Then a care plan, or move it to your own hosting with a code licence.', extra: `+ ${money(p.price_ngn_monthly, 'NGN')}${t(lang, 'market.month')}` },
    { key: 'managed', name: t(lang, 'plan.managed'), ngn: p.price_ngn_monthly, usd: p.price_usd_monthly, unit: t(lang, 'market.month'),
      own: 'We host, update, back up and support it. Your content, domain and data stay yours. 12-month minimum.', extra: `+ ${money(p.price_ngn_setup, 'NGN')} ${t(lang, 'market.setup')}`, featured: true },
    ...(p.buyout_ngn ? [{ key: 'buyout', name: t(lang, 'plan.buyout'), ngn: p.buyout_ngn, usd: p.buyout_usd, unit: 'one-off',
      own: 'Full source code with a perpetual licence for your business, deployment guide and 3 months of support.', extra: '' }] : []),
  ];
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.tagline, brand: { '@type': 'Brand', name: 'Ferrn' },
    offers: { '@type': 'Offer', priceCurrency: 'NGN', price: p.price_ngn_setup, availability: 'https://schema.org/InStock' } };
  return (
    <Layout lang={lang} path={`/marketplace/${p.slug}`} title={`${p.name} — Ferrn Marketplace`} description={p.tagline ?? ''} schema={schema}>
      <section class="page-hero product-hero" style={`--accent:${p.accent ?? '#ff4100'}`}>
        <div class="container product-hero-grid">
          <div>
            <a class="back" href={href(lang, '/marketplace')}>← {t(lang, 'nav.marketplace')}</a>
            <span class="eyebrow">{t(lang, `market.${p.category}`)} · {p.industry}</span>
            <h1 class="h1">{p.name}</h1>
            <p class="lead">{p.tagline}</p>
            <p class="delivery">⏱ {t(lang, 'market.delivery', { days: p.delivery_days ?? 7 })}</p>
            <div class="hero-actions">
              {p.demo_url ? <a class="btn btn-primary" href={p.demo_url} target="_blank" rel="noopener">{t(lang, 'cta.demo')} ↗</a> : null}
              <a class="btn btn-ghost" href="#plans">{t(lang, 'market.plans')} ↓</a>
            </div>
          </div>
          {p.demo_url ? (
            <div class="device">
              <div class="device-bar"><span></span><span></span><span></span><em>{p.demo_url}</em></div>
              <iframe src={p.demo_url} title={`${p.name} live demo`} loading="lazy"></iframe>
            </div>
          ) : null}
        </div>
      </section>
      <div class="container product-detail">
        {note ? <p class="machine-note">{t(lang, 'machine.note')}</p> : null}
        <p class="lead">{p.description}</p>
        <div class="two-col">
          <div><h2>Features</h2><ul class="tick-list">{features.map((f) => <li>{f}</li>)}</ul></div>
          <div><h2>Included</h2><ul class="tick-list">{includes.map((f) => <li>{f}</li>)}</ul></div>
        </div>
        <h2 id="plans">{t(lang, 'market.plans')}</h2>
        <div class="currency-toggle" role="group" aria-label="Currency"><button type="button" class="active" data-currency="NGN">₦ NGN</button><button type="button" data-currency="USD">$ USD</button></div>
        <div class="plans">
          {tiers.map((tier) => (
            <article class={`plan ${tier.featured ? 'featured' : ''}`}>
              <h3>{tier.name}</h3>
              <p class="plan-price" data-ngn={money(tier.ngn, 'NGN')} data-usd={money(tier.usd, 'USD')}>{money(tier.ngn, 'NGN')} <small>{tier.unit}</small></p>
              {tier.extra ? <p class="muted">{tier.extra}</p> : null}
              <p class="plan-own"><strong>{t(lang, 'market.own')}:</strong> {tier.own}</p>
              <button class="btn btn-primary" type="button" data-checkout={p.slug} data-tier={tier.key}>{t(lang, 'market.buy')}</button>
            </article>
          ))}
        </div>
        <dialog class="checkout" data-checkout-dialog>
          <form method="dialog" class="checkout-form" data-checkout-form>
            <h3>{p.name} — <span data-checkout-tier></span></h3>
            <input type="hidden" name="product" value={p.slug} /><input type="hidden" name="tier" />
            <label class="field">{t(lang, 'form.name')} *<input name="name" required /></label>
            <label class="field">{t(lang, 'form.email')} *<input name="email" type="email" required /></label>
            <label class="field">{t(lang, 'form.phone')}<input name="phone" /></label>
            <label class="field">{t(lang, 'form.company')}<input name="company" /></label>
            <label class="field">Currency<select name="currency"><option value="NGN">NGN (₦)</option><option value="USD">USD ($)</option></select></label>
            <p class="muted">You’ll pay securely with Paystack (cards, bank transfer, USSD). Prefer an invoice? Choose “Request invoice”.</p>
            <div class="row"><button class="btn btn-primary" value="pay" type="submit">Pay securely</button><button class="btn btn-ghost" type="submit" value="invoice" data-invoice>Request invoice</button><button class="btn btn-text" value="cancel" formnovalidate>Cancel</button></div>
            <p class="form-status" role="status"></p>
          </form>
        </dialog>
        <section class="customise">
          <h2>{t(lang, 'market.customise')}</h2>
          <p>Need a feature that isn’t listed, another language, or an integration? Tell us and we’ll send a fixed quote.</p>
          <ContactForm lang={lang} type="customise" product={p.slug} />
        </section>
        {related.length ? <><h2>More in the marketplace</h2><div class="product-grid">{related.map((r) => <ProductCard p={r} lang={lang} />)}</div></> : null}
      </div>
    </Layout>
  );
}

export function CheckoutResult({ lang, ok, product }: { lang: Lang; ok: boolean; product?: string }) {
  return (
    <Layout lang={lang} path="/marketplace/thank-you" title="Order — Ferrn" description="Your order" noindex>
      <PageHero eyebrow={t(lang, 'nav.marketplace')} title={ok ? 'Payment received — thank you!' : 'Payment not completed'}
        lead={ok ? 'We’ve emailed your receipt. Next: a short onboarding form so we can set up your product. We’ll reach out on WhatsApp within one working day.' : 'Nothing was charged. You can try again, or request an invoice and pay by bank transfer.'} />
      <div class="container section-action"><a class="btn btn-primary" href={href(lang, product ? `/marketplace/${product}` : '/marketplace')}>{ok ? 'Back to the product' : 'Try again'}</a></div>
    </Layout>
  );
}
