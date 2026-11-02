import { raw } from 'hono/html';
import { t, type Lang } from '../content/i18n';
import { SERVICES_DETAIL } from '../content/site';
import { POLICIES } from '../content/policies';
import type { SiteCtx } from '../lib/content';
import { icon } from '../lib/icons';
import { shotOf, type PublicProject } from '../lib/projects';
import { href, initials, Layout, money, PageHero, Section } from './layout';
import { ContactForm, Lines, mediaUrl, ProductCard, Testimonial, WorkRow, type PostRow, type ProductRow, type TeamRow, type TestimonialRow } from './home';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const paras = (s: string) => raw(s.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join(''));

/* ───────────── work ───────────── */

export function WorkPage({ lang, ctx, projects }: { lang: Lang; ctx: SiteCtx; projects: PublicProject[] }) {
  const cats = [['all', 'All'], ['website', 'Websites'], ['webapp', 'Web apps'], ['ai', 'AI'], ['branding', 'Branding']].filter(([k]) => k === 'all' || projects.some((p) => p.category === k));
  return (
    <Layout lang={lang} ctx={ctx} path="/work" kind="work" title="Work — Ferrn Digital Agency" description={ctx.get('work.lead')}>
      <PageHero label={`${t(lang, 'nav.work')} · ${projects.length} projects`} title={ctx.get('work.title')} lead={ctx.get('work.lead')}>
        <div class="filters reveal" role="tablist" aria-label="Filter projects">{cats.map(([k, l], i) => <button class={`filter ${i === 0 ? 'active' : ''}`} type="button" data-filter={k}>{l}</button>)}</div>
      </PageHero>
      <div class="wrap"><div class="work-list" data-filter-grid>{projects.map((x, i) => <WorkRow p={x} lang={lang} i={i} />)}</div></div>
    </Layout>
  );
}

export function CasePage({ lang, ctx, p, next, testimonial, note }: { lang: Lang; ctx: SiteCtx; p: PublicProject; next: PublicProject | null; testimonial?: TestimonialRow | null; note?: boolean }) {
  const cover = shotOf(p);
  const facts: [string, string][] = [
    ['Client', p.client ?? p.title], ['Industry', p.industry ?? '—'], ['Type', p.type ?? '—'], ['Year', p.year ?? '—'],
    ...(p.services.length ? [['Services', p.services.join(', ')] as [string, string]] : []),
    ...(p.tech.length ? [['Technology', p.tech.join(', ')] as [string, string]] : []),
  ];
  const sections: [string, string | null][] = [['Context', p.context], ['The challenge', p.challenge], ['Our approach', p.approach], ['What we built', p.solution]];
  const schema = { '@context': 'https://schema.org', '@type': 'CreativeWork', name: p.title, about: p.industry, creator: { '@type': 'Organization', name: 'Ferrn Digital Agency' }, url: `https://www.ferrnagency.com/work/${p.slug}`, ...(cover ? { image: cover.startsWith('http') ? cover : `https://www.ferrnagency.com${cover}` } : {}) };
  return (
    <Layout lang={lang} ctx={ctx} path={`/work/${p.slug}`} kind="case" title={p.meta_title ?? `${p.title} — ${p.type ?? 'Case study'} | Ferrn`} description={p.meta_description ?? p.summary ?? ''} schema={schema} ogImage={cover?.startsWith('http') ? cover : undefined}>
      <section class="case-hero" style={p.accent ? `--tint:${p.accent}` : undefined}>
        <div class="wrap">
          <a class="back reveal" href={href(lang, '/work')}>{icon('arrow-left', { size: 15 })} {t(lang, 'nav.work')}</a>
          <p class="page-label reveal">{[p.type, p.industry, p.year].filter(Boolean).join(' · ')}</p>
          <h1 class="h1 reveal-text">{p.title}</h1>
          {p.summary ? <p class="lead reveal">{p.summary}</p> : null}
        </div>
        {cover ? <figure class="case-cover reveal" data-parallax><img src={cover} alt={`${p.title} — screenshot`} width="1400" height="900" fetchpriority="high" /></figure> : null}
      </section>
      <div class="wrap case-body">
        {note ? <p class="machine-note">{t(lang, 'machine.note')}</p> : null}
        <aside class="case-facts reveal">
          <dl>{facts.map(([k, v]) => <div><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {p.live ? <a class="btn btn-ghost btn-sm" href={p.live} target="_blank" rel="noopener">Visit live site {icon('external-link', { size: 14 })}</a> : null}
        </aside>
        <div class="case-story">
          {sections.filter(([, v]) => v).map(([k, v], i) => <section class="case-sec reveal"><h2><span>0{i + 1}</span>{k}</h2><p>{v}</p></section>)}
          {p.points.length ? <div class="case-points">{p.points.map((x) => <div class="case-point reveal">{icon(x.icon, { size: 20 })}<h3>{x.title}</h3><p>{x.text}</p></div>)}</div> : null}
          {p.gallery.length ? <div class="case-gallery">{p.gallery.map((g) => g.kind === 'video'
            ? <figure class="reveal"><video src={mediaUrl(g.src)!} controls playsinline preload="metadata"></video>{g.caption ? <figcaption>{g.caption}</figcaption> : null}</figure>
            : <figure class="reveal"><img src={mediaUrl(g.src)!} alt={g.alt ?? ''} loading="lazy" decoding="async" />{g.caption ? <figcaption>{g.caption}</figcaption> : null}</figure>)}</div> : null}
          {p.results.length ? (
            <section class="case-results reveal">
              <h2><span>{String(sections.filter(([, v]) => v).length + 1).padStart(2, '0')}</span>Results</h2>
              <div class="results">{p.results.map((r) => <div><strong>{r.value}</strong><span>{r.label}</span>{r.note ? <small>{r.note}</small> : null}</div>)}</div>
            </section>
          ) : null}
          {testimonial ? <div class="case-quote"><Testimonial x={testimonial} i={0} /></div> : null}
        </div>
      </div>
      {next ? (
        <a class="case-next reveal" href={href(lang, `/work/${next.slug}`)}>
          <span class="case-next-label">Next project {icon('arrow-right', { size: 16 })}</span>
          <span class="case-next-title">{next.title}</span>
          <span class="case-next-meta">{[next.type, next.industry].filter(Boolean).join(' · ')}</span>
        </a>
      ) : null}
    </Layout>
  );
}

/* ───────────── services ───────────── */

export function ServicesPage({ lang, ctx, projects }: { lang: Lang; ctx: SiteCtx; projects: PublicProject[] }) {
  const anchors = ['websites', 'apps', 'ai'];
  const icons = ['monitor', 'layout-dashboard', 'brain-circuit'];
  const outcomes = [
    ['More qualified enquiries', 'Clearer positioning', 'Faster pages, better SEO'],
    ['Hours of manual work removed', 'One source of truth', 'Access, roles and audit built in'],
    ['Answers at 2am', 'Documents processed in seconds', 'Leads followed up automatically'],
  ];
  return (
    <Layout lang={lang} ctx={ctx} path="/services" kind="services" title="Services — Ferrn Digital Agency" description={ctx.get('services.lead')}>
      <PageHero label={t(lang, 'nav.services')} title={ctx.get('services.title')} lead={ctx.get('services.lead')} />
      <div class="wrap">
        {SERVICES_DETAIL.map((s, i) => {
          const related = projects.filter((p) => (i === 0 ? p.category === 'website' : i === 1 ? p.category === 'webapp' : p.category === 'ai')).slice(0, 2);
          return (
            <section class="svc" id={anchors[i]}>
              <div class="svc-sticky">
                <span class="svc-n">0{i + 1}</span>
                {icon(icons[i]!, { size: 34, stroke: 1.4, class: 'svc-ic' })}
                <h2 class="reveal-text">{ctx.get(`${s.key}.title`)}</h2>
                <p class="lead reveal">{ctx.get(`${s.key}.body`)}</p>
                <a class="btn btn-primary btn-sm reveal" href={href(lang, '/contact')}>{t(lang, 'cta.start')} {icon('arrow-up-right', { size: 15 })}</a>
              </div>
              <div class="svc-detail">
                <div class="svc-block reveal"><h3>What’s included</h3><ul class="ticks two">{s.items.map((x) => <li>{icon('check', { size: 14 })}{x}</li>)}</ul></div>
                <div class="svc-block reveal"><h3>What changes for the business</h3><ul class="ticks">{outcomes[i]!.map((x) => <li>{icon('zap', { size: 14 })}{x}</li>)}</ul></div>
                {related.length ? <div class="svc-block reveal"><h3>Seen in</h3><div class="svc-related">{related.map((p) => <a href={href(lang, `/work/${p.slug}`)}>{shotOf(p) ? <img src={shotOf(p)!} alt="" loading="lazy" width="480" height="300" /> : null}<span>{p.title}<small>{p.industry}</small></span></a>)}</div></div> : null}
              </div>
            </section>
          );
        })}
      </div>
      <Section n="04" label="Marketplace" title="Need it this week? Start from a ready-built product." class="section-dark section-tight" right={<a class="link" href={href(lang, '/marketplace')}>{t(lang, 'cta.browse')} {icon('arrow-right', { size: 15 })}</a>}>
        <p class="lead">Websites, apps and AI assistants with published prices, live demos and launch in 5–14 days.</p>
      </Section>
    </Layout>
  );
}

/* ───────────── people ───────────── */

export function TeamCard({ m }: { m: TeamRow }) {
  return (
    <article class="person reveal">
      <div class="person-photo">{m.photo ? <img src={mediaUrl(m.photo)!} alt={m.name} loading="lazy" width="480" height="560" /> : <span>{initials(m.name)}</span>}</div>
      <h3>{m.name}</h3>
      <p class="person-role">{m.role}</p>
      {m.bio ? <p class="person-bio">{m.bio}</p> : null}
      <div class="person-links">
        {m.linkedin ? <a href={m.linkedin} rel="noopener" target="_blank">LinkedIn {icon('arrow-up-right', { size: 12 })}</a> : null}
        {m.github ? <a href={m.github} rel="noopener" target="_blank">GitHub {icon('arrow-up-right', { size: 12 })}</a> : null}
      </div>
    </article>
  );
}

export function TeamPage({ lang, ctx, team }: { lang: Lang; ctx: SiteCtx; team: TeamRow[] }) {
  return (
    <Layout lang={lang} ctx={ctx} path="/team" kind="team" title="Team — Ferrn Digital Agency" description="The people behind Ferrn: strategy, design, engineering and AI.">
      <PageHero label={t(lang, 'team.eyebrow')} title={t(lang, 'team.title')} />
      <div class="wrap"><div class="people">{team.map((m) => <TeamCard m={m} />)}</div></div>
      <Section n="02" label="Careers" title="Want to work with us?" lead="We hire designers, engineers and AI builders who care about business outcomes." class="section-tight">
        <a class="btn btn-ghost" href={href(lang, '/careers')}>Careers {icon('arrow-right', { size: 15 })}</a>
      </Section>
    </Layout>
  );
}

export function AboutPage({ lang, ctx, team, projects }: { lang: Lang; ctx: SiteCtx; team: TeamRow[]; projects: PublicProject[] }) {
  const industries = [...new Set(projects.map((p) => p.industry).filter(Boolean))] as string[];
  return (
    <Layout lang={lang} ctx={ctx} path="/about" kind="about" title="About Ferrn Digital Agency" description={ctx.get('about.lead')}>
      <PageHero label={t(lang, 'nav.about')} title={ctx.get('about.title')} lead={ctx.get('about.lead')} />
      <section class="wrap about-grid">
        <div class="about-principle reveal"><p class="head-rule"><span>Operating principle</span></p><p class="about-big">{ctx.get('about.principle')}</p></div>
        <div class="about-story reveal">{paras(ctx.get('about.body'))}
          <div class="about-actions"><a class="btn btn-ghost btn-sm" href={href(lang, '/profile')}>Company profile {icon('arrow-right', { size: 14 })}</a><a class="btn btn-ghost btn-sm" href="/assets/Ferrn-Agency-Company-Profile.pdf" download>PDF {icon('download', { size: 14 })}</a></div>
        </div>
      </section>
      {industries.length ? <section class="wrap about-industries reveal"><p class="head-rule"><span>Industries</span></p><div class="chips-row">{industries.map((i) => <span>{i}</span>)}</div></section> : null}
      <Section n="02" label={t(lang, 'team.eyebrow')} title={t(lang, 'team.title')}><div class="people">{team.map((m) => <TeamCard m={m} />)}</div></Section>
    </Layout>
  );
}

/* ───────────── company profile + links ───────────── */

export type ProfileSection = { key: string | null; title: string; body: string | null; items_json: string; image: string | null };

export function ProfilePage({ lang, ctx, sections, projects, team }: { lang: Lang; ctx: SiteCtx; sections: ProfileSection[]; projects: PublicProject[]; team: TeamRow[] }) {
  return (
    <Layout lang={lang} ctx={ctx} path="/profile" kind="profile" title="Company profile — Ferrn Digital Agency" description="Who Ferrn is, what we build, who we work with, and how to reach us.">
      <PageHero label="Company profile" title="Ferrn, in one page." lead="Who we are, what we build, the industries we serve and the work we’ve shipped.">
        <div class="hero-actions reveal"><a class="btn btn-primary btn-sm" href="/profile.pdf">Download PDF {icon('download', { size: 15 })}</a><a class="btn btn-ghost btn-sm" href={href(lang, '/contact')}>{t(lang, 'cta.start')}</a></div>
      </PageHero>
      <div class="wrap profile">
        {sections.map((s, i) => {
          const items: string[] = JSON.parse(s.items_json || '[]');
          return (
            <section class="profile-sec reveal" id={s.key ?? undefined}>
              <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</h2>
              <div class="profile-body">
                {s.body ? paras(s.body) : null}
                {items.length ? <ul class="ticks two">{items.map((x) => <li>{icon('check', { size: 14 })}{x}</li>)}</ul> : null}
                {s.image ? <img src={mediaUrl(s.image)!} alt="" loading="lazy" /> : null}
                {s.key === 'projects' ? <div class="profile-projects">{projects.filter((p) => p.featured).slice(0, 6).map((p) => <a href={href(lang, `/work/${p.slug}`)}>{shotOf(p) ? <img src={shotOf(p)!} alt="" loading="lazy" width="480" height="300" /> : null}<span>{p.title}<small>{[p.type, p.industry].filter(Boolean).join(' · ')}</small></span></a>)}</div> : null}
                {s.key === 'team' ? <div class="profile-team">{team.map((m) => <span><strong>{m.name}</strong> {m.role}</span>)}</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </Layout>
  );
}

export function LinksPage({ lang, ctx }: { lang: Lang; ctx: SiteCtx }) {
  const groups = new Map<string, typeof ctx.links>();
  for (const l of ctx.links) { const g = l.category || 'Links'; groups.set(g, [...(groups.get(g) ?? []), l]); }
  return (
    <Layout lang={lang} ctx={ctx} path="/links" kind="links" title="Important links — Ferrn" description="Ferrn’s company profile, portfolio, brochure, demos and booking in one place.">
      <PageHero label="Links" title="Everything Ferrn, one list." lead="Profile, portfolio, demos, booking and the documents procurement teams ask for." />
      <div class="wrap links">
        {!ctx.links.length ? <p class="muted">Nothing published yet.</p> : [...groups].map(([g, items]) => (
          <section class="links-group reveal"><h2>{g}</h2>
            {items.map((l) => <a class="link-row" href={l.url} target={/^https?:/.test(l.url) && !l.url.includes('ferrnagency.com') ? '_blank' : undefined} rel="noopener">{icon(l.icon || 'link', { size: 20 })}<span><strong>{l.title}</strong>{l.description ? <small>{l.description}</small> : null}</span>{icon('arrow-up-right', { size: 18 })}</a>)}
          </section>
        ))}
      </div>
    </Layout>
  );
}

/* ───────────── insights ───────────── */

export function InsightsPage({ lang, ctx, posts }: { lang: Lang; ctx: SiteCtx; posts: PostRow[] }) {
  return (
    <Layout lang={lang} ctx={ctx} path="/insights" kind="insights" title="Insights — Ferrn Digital Agency" description="Practical guidance on websites, custom software, product strategy and AI automation.">
      <PageHero label={t(lang, 'nav.insights')} title="Useful thinking for better digital decisions." />
      <div class="wrap"><div class="post-grid">
        {posts.map((x) => <a class="post reveal" href={href(lang, `/insights/${x.slug}`)}><span class="post-meta">{x.category} · {x.published_at?.slice(0, 10)}</span><h3>{x.title}</h3><p>{x.excerpt}</p><span class="link">Read {icon('arrow-right', { size: 14 })}</span></a>)}
        {!posts.length ? <p class="muted">Articles are on the way.</p> : null}
      </div></div>
    </Layout>
  );
}

export function PostPage({ lang, ctx, post }: { lang: Lang; ctx: SiteCtx; post: PostRow & { content_html: string | null } }) {
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, datePublished: post.published_at, author: { '@type': 'Organization', name: 'Ferrn Digital Agency' } };
  return (
    <Layout lang={lang} ctx={ctx} path={`/insights/${post.slug}`} kind="post" title={`${post.title} | Ferrn`} description={post.excerpt ?? ''} schema={schema}>
      <PageHero label={`${post.category ?? 'Insight'} · ${post.published_at?.slice(0, 10) ?? ''}`} title={post.title} lead={post.excerpt ?? ''} />
      <article class="wrap prose reveal">{raw(post.content_html ?? '')}</article>
      <div class="wrap"><div class="cta-band reveal"><h2>Need help applying this?</h2><a class="btn btn-primary" href={href(lang, '/contact')}>{t(lang, 'cta.start')} {icon('arrow-up-right', { size: 15 })}</a></div></div>
    </Layout>
  );
}

/* ───────────── contact ───────────── */

export function ContactPage({ lang, ctx, rfp }: { lang: Lang; ctx: SiteCtx; rfp?: boolean }) {
  return (
    <Layout lang={lang} ctx={ctx} path={rfp ? '/rfp' : '/contact'} kind="contact" title={rfp ? 'Submit an RFP — Ferrn' : 'Contact Ferrn Digital Agency'} description={ctx.get('contact.sub')}>
      <section class="contact-page">
        <div class="wrap contact-split">
          <div>
            <p class="page-label reveal">{rfp ? 'Request for proposal' : t(lang, 'contact.eyebrow')}</p>
            <h1 class="h1 reveal-text">{ctx.get('contact.title')}</h1>
            <p class="lead reveal">{ctx.get('contact.sub')}</p>
            <div class="contact-ways reveal">
              <a href="mailto:info@ferrnagency.com">{icon('mail', { size: 18 })}<span>info@ferrnagency.com<small>{ctx.get('contact.reply')}</small></span></a>
              <a href="https://cal.com/ferrn-agency" target="_blank" rel="noopener">{icon('calendar', { size: 18 })}<span>Book a 20-minute call<small>cal.com/ferrn-agency</small></span></a>
              {ctx.get('company.phone') ? <a href={`https://wa.me/${ctx.get('company.phone').replace(/\D/g, '')}`} target="_blank" rel="noopener">{icon('message-circle', { size: 18 })}<span>WhatsApp<small>{ctx.get('company.phone')}</small></span></a> : null}
              {rfp ? <a href={href(lang, '/procurement')}>{icon('file-text', { size: 18 })}<span>Procurement information<small>Vendor details, policies, company profile</small></span></a> : null}
            </div>
          </div>
          <ContactForm lang={lang} type={rfp ? 'rfp' : 'contact'} ctx={ctx} />
        </div>
      </section>
    </Layout>
  );
}

/* ───────────── policies, simple, 404 ───────────── */

export function PoliciesPage({ lang, ctx, slug }: { lang: Lang; ctx: SiteCtx; slug?: string }) {
  const pol = slug ? POLICIES.find((p) => p.slug === slug) : null;
  if (pol) {
    return (
      <Layout lang={lang} ctx={ctx} path={`/policies/${pol.slug}`} kind="policy" title={`${pol.title} — Ferrn`} description={pol.summary}>
        <PageHero label="Policy" title={pol.title} lead={pol.summary} />
        <article class="wrap prose">{raw(pol.content)}</article>
      </Layout>
    );
  }
  return (
    <Layout lang={lang} ctx={ctx} path="/policies" kind="policy" title="Policies — Ferrn" description="Ferrn's policies and statements.">
      <PageHero label="Trust" title="Policies and statements" />
      <div class="wrap"><div class="post-grid">{POLICIES.map((p) => <a class="post reveal" href={href(lang, `/policies/${p.slug}`)}><h3>{p.title}</h3><p>{p.summary}</p><span class="link">Read {icon('arrow-right', { size: 14 })}</span></a>)}</div></div>
    </Layout>
  );
}

export function SimplePage({ lang, ctx, path, title, lead, body }: { lang: Lang; ctx: SiteCtx; path: string; title: string; lead: string; body: string }) {
  return (
    <Layout lang={lang} ctx={ctx} path={path} kind="page" title={`${title} — Ferrn`} description={lead}>
      <PageHero label="Ferrn" title={title} lead={lead} />
      <article class="wrap prose">{raw(body)}</article>
    </Layout>
  );
}

export function NotFound({ lang, ctx }: { lang: Lang; ctx?: SiteCtx }) {
  return (
    <Layout lang={lang} ctx={ctx} path="/404" kind="404" title="Page not found — Ferrn" description="This page does not exist." noindex>
      <PageHero label="404" title="This page wandered off." accent="Let’s get you back.">
        <div class="hero-actions reveal"><a class="btn btn-primary" href={href(lang, '/')}>Home</a><a class="btn btn-ghost" href={href(lang, '/work')}>{t(lang, 'nav.work')}</a></div>
      </PageHero>
    </Layout>
  );
}

/* ───────────── marketplace ───────────── */

export function MarketplacePage({ lang, ctx, products }: { lang: Lang; ctx: SiteCtx; products: ProductRow[] }) {
  const cats = ['all', 'webapp', 'website', 'chatbot', 'automation'].filter((c) => c === 'all' || products.some((p) => p.category === c));
  return (
    <Layout lang={lang} ctx={ctx} path="/marketplace" kind="market" title="Ferrn Marketplace — Ready-built websites, apps and AI" description="Ready-built websites, web applications, AI assistants and automations. Live demos, naira and dollar pricing, live in days.">
      <PageHero label={`${t(lang, 'nav.marketplace')} · ${products.length} products`} title={ctx.get('market.title')} lead={ctx.get('market.sub')}>
        <div class="market-toolbar reveal">
          <div class="filters" role="tablist">{cats.map((c, i) => <button class={`filter ${i === 0 ? 'active' : ''}`} type="button" data-filter={c}>{t(lang, `market.${c}`)}</button>)}</div>
          <div class="currency-toggle" role="group" aria-label="Currency"><button type="button" class="active" data-currency="NGN">₦ NGN</button><button type="button" data-currency="USD">$ USD</button></div>
        </div>
      </PageHero>
      <div class="wrap"><div class="product-grid" data-filter-grid>{products.map((p) => <ProductCard p={p} lang={lang} />)}</div></div>
      <Section n="02" label="Included" title="Every plan comes with" class="section-tight">
        <ul class="ticks three">
          {['A live demo before you pay', 'Set-up with your logo, content and colours', 'Hosting, SSL, backups and updates on managed plans', 'Your data exportable any time', 'Option to buy the code outright', 'WhatsApp support, Lagos hours'].map((x) => <li>{icon('check', { size: 14 })}{x}</li>)}
        </ul>
      </Section>
    </Layout>
  );
}

export function ProductPage({ lang, ctx, p, related, note }: { lang: Lang; ctx: SiteCtx; p: ProductRow; related: ProductRow[]; note?: boolean }) {
  const features: string[] = JSON.parse(p.features_json || '[]');
  const includes: string[] = JSON.parse(p.includes_json || '[]');
  const tiers = [
    { key: 'launch', name: t(lang, 'plan.launch'), ngn: p.price_ngn_setup, usd: p.price_usd_setup, unit: t(lang, 'market.setup'), own: 'Deployed for you on your domain. Then a care plan, or move it to your own hosting with a code licence.', extra: `+ ${money(p.price_ngn_monthly, 'NGN')}${t(lang, 'market.month')}`, extraUsd: `+ ${money(p.price_usd_monthly, 'USD')}${t(lang, 'market.month')}` },
    { key: 'managed', name: t(lang, 'plan.managed'), ngn: p.price_ngn_monthly, usd: p.price_usd_monthly, unit: t(lang, 'market.month'), own: 'We host, update, back up and support it. Your content, domain and data stay yours. 12-month minimum.', extra: `+ ${money(p.price_ngn_setup, 'NGN')} ${t(lang, 'market.setup')}`, extraUsd: `+ ${money(p.price_usd_setup, 'USD')} ${t(lang, 'market.setup')}`, featured: true },
    ...(p.buyout_ngn ? [{ key: 'buyout', name: t(lang, 'plan.buyout'), ngn: p.buyout_ngn, usd: p.buyout_usd, unit: 'one-off', own: 'Full source code with a perpetual licence for your business, deployment guide and 3 months of support.', extra: '', extraUsd: '' }] : []),
  ];
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.tagline, brand: { '@type': 'Brand', name: 'Ferrn' }, offers: { '@type': 'Offer', priceCurrency: 'NGN', price: p.price_ngn_setup, availability: 'https://schema.org/InStock' } };
  const cover = mediaUrl(p.cover);
  return (
    <Layout lang={lang} ctx={ctx} path={`/marketplace/${p.slug}`} kind="product" title={`${p.name} — Ferrn Marketplace`} description={p.tagline ?? ''} schema={schema}>
      <section class="product-hero" style={`--tint:${p.accent ?? 'var(--orange)'}`}>
        <div class="wrap product-hero-grid">
          <div>
            <a class="back reveal" href={href(lang, '/marketplace')}>{icon('arrow-left', { size: 15 })} {t(lang, 'nav.marketplace')}</a>
            <p class="page-label reveal">{t(lang, `market.${p.category}`)}{p.industry ? ` · ${p.industry}` : ''}</p>
            <h1 class="h1 reveal-text">{p.name}</h1>
            <p class="lead reveal">{p.tagline}</p>
            <p class="delivery reveal">{icon('timer', { size: 16 })} {t(lang, 'market.delivery', { days: p.delivery_days ?? 7 })}</p>
            <div class="hero-actions reveal">
              {p.demo_url ? <a class="btn btn-primary" href={p.demo_url} target="_blank" rel="noopener">{t(lang, 'cta.demo')} {icon('external-link', { size: 15 })}</a> : null}
              <a class="btn btn-ghost" href="#plans">{t(lang, 'market.plans')} {icon('arrow-down', { size: 15 })}</a>
            </div>
          </div>
          {p.demo_url ? (
            <div class="device reveal">
              <div class="device-bar"><span></span><span></span><span></span><em>{p.demo_url.replace(/^https?:\/\//, '')}</em></div>
              {cover ? <img src={cover} alt={`${p.name} preview`} width="1200" height="750" /> : <iframe src={p.demo_url} title={`${p.name} live demo`} loading="lazy"></iframe>}
            </div>
          ) : null}
        </div>
      </section>
      <div class="wrap product-detail">
        {note ? <p class="machine-note">{t(lang, 'machine.note')}</p> : null}
        <p class="lead reveal">{p.description}</p>
        <div class="two-col">
          <div class="reveal"><h2>Features</h2><ul class="ticks">{features.map((f) => <li>{icon('check', { size: 14 })}{f}</li>)}</ul></div>
          <div class="reveal"><h2>Included</h2><ul class="ticks">{includes.map((f) => <li>{icon('check', { size: 14 })}{f}</li>)}</ul></div>
        </div>
        <div class="plans-head"><h2 id="plans">{t(lang, 'market.plans')}</h2><div class="currency-toggle" role="group" aria-label="Currency"><button type="button" class="active" data-currency="NGN">₦ NGN</button><button type="button" data-currency="USD">$ USD</button></div></div>
        <div class="plans">
          {tiers.map((tier) => (
            <article class={`plan reveal ${tier.featured ? 'featured' : ''}`}>
              <h3>{tier.name}</h3>
              <p class="plan-price" data-ngn={money(tier.ngn, 'NGN')} data-usd={money(tier.usd, 'USD')}>{money(tier.ngn, 'NGN')} <small>{tier.unit}</small></p>
              {tier.extra ? <p class="muted plan-extra" data-ngn={tier.extra} data-usd={tier.extraUsd}>{tier.extra}</p> : null}
              <p class="plan-own"><strong>{t(lang, 'market.own')}:</strong> {tier.own}</p>
              {p.demo_url ? <button class="btn btn-primary" type="button" data-checkout={p.slug} data-tier={tier.key}>{t(lang, 'market.buy')}</button> : <a class="btn btn-ghost" href="#early-access">Reserve a founding slot</a>}
            </article>
          ))}
        </div>
        <dialog class="checkout" data-checkout-dialog>
          <form method="dialog" class="checkout-form" data-checkout-form>
            <h3>{p.name} — <span data-checkout-tier></span></h3>
            <input type="hidden" name="product" value={p.slug} /><input type="hidden" name="tier" />
            <label class="field"><span>{t(lang, 'form.name')}</span><input name="name" required /></label>
            <label class="field"><span>{t(lang, 'form.email')}</span><input name="email" type="email" required /></label>
            <label class="field"><span>{t(lang, 'form.phone')}</span><input name="phone" /></label>
            <label class="field"><span>{t(lang, 'form.company')}</span><input name="company" /></label>
            <label class="field"><span>Currency</span><select name="currency"><option value="NGN">NGN (₦)</option><option value="USD">USD ($)</option></select></label>
            <p class="muted small">You’ll pay securely with Paystack (cards, bank transfer, USSD). Prefer an invoice? Choose “Request invoice”.</p>
            <div class="row"><button class="btn btn-primary" value="pay" type="submit">Pay securely</button><button class="btn btn-ghost" type="submit" value="invoice" data-invoice>Request invoice</button><button class="btn btn-text" value="cancel" formnovalidate>Cancel</button></div>
            <p class="form-status" role="status"></p>
          </form>
        </dialog>
        <section class="customise" id="early-access">
          <h2>{p.demo_url ? t(lang, 'market.customise') : 'Early access: founding clients'}</h2>
          <p class="lead">{p.demo_url ? 'Need a feature that isn’t listed, another language, or an integration? Tell us and we’ll send a fixed quote.' : 'We’re building this with our first five clients. Tell us about your business and we’ll call you: founding clients lock in launch pricing and help decide what gets built first.'}</p>
          <ContactForm lang={lang} type="customise" product={p.slug} ctx={ctx} />
        </section>
        {related.length ? <><h2>More in the marketplace</h2><div class="product-grid">{related.map((r) => <ProductCard p={r} lang={lang} />)}</div></> : null}
      </div>
    </Layout>
  );
}

export function CheckoutResult({ lang, ctx, ok, product }: { lang: Lang; ctx: SiteCtx; ok: boolean; product?: string }) {
  return (
    <Layout lang={lang} ctx={ctx} path="/marketplace/thank-you" kind="page" title="Order — Ferrn" description="Your order" noindex>
      <PageHero label={t(lang, 'nav.marketplace')} title={ok ? 'Payment received. Thank you.' : 'Payment not completed'}
        lead={ok ? 'We’ve emailed your receipt. Next: a short onboarding form so we can set up your product. We’ll reach out on WhatsApp within one working day.' : 'Nothing was charged. You can try again, or request an invoice and pay by bank transfer.'}>
        <div class="hero-actions reveal"><a class="btn btn-primary" href={href(lang, product ? `/marketplace/${product}` : '/marketplace')}>{ok ? 'Back to the product' : 'Try again'}</a></div>
      </PageHero>
    </Layout>
  );
}

export { Lines, WorkRow };
