import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { all, first } from '../lib/db';
import { edgeCache } from '../lib/cache';
import { mt } from '../lib/translate';
import { loadSite } from '../lib/content';
import { loadProject, loadProjects } from '../lib/projects';
import { type Lang } from '../content/i18n';
import { HomePage, type PostRow, type ProductRow, type TeamRow, type TestimonialRow } from '../views/home';
import {
  AboutPage, CasePage, CheckoutResult, ContactPage, InsightsPage, LinksPage, MarketplacePage, NotFound, PoliciesPage, PostPage,
  ProductPage, ProfilePage, ServicesPage, SimplePage, TeamPage, WorkPage, type ProfileSection,
} from '../views/pages';

const PRODUCT_COLS = `slug, name, category, industry, tagline, description, demo_url, cover, accent, price_ngn_setup, price_ngn_monthly,
  price_usd_setup, price_usd_monthly, buyout_ngn, buyout_usd, delivery_days, features_json, includes_json`;
const TEAM = 'SELECT id, name, role, bio, photo, linkedin, github FROM team_members WHERE published = 1 ORDER BY sort';
const TESTIMONIALS = 'SELECT id, name, role, company, quote, avatar, logo, audio, transcript, featured FROM testimonials WHERE published = 1 ORDER BY featured DESC, sort';

/** Translates the long-form text fields of products for non-English pages (cached in KV). */
async function localiseProducts(env: AppEnv['Bindings'], items: ProductRow[], lang: Lang, deep = false) {
  if (lang === 'en') return items;
  return Promise.all(items.map(async (p) => ({
    ...p,
    tagline: p.tagline ? await mt(env, p.tagline, lang) : p.tagline,
    ...(deep && p.description ? { description: await mt(env, p.description, lang) } : {}),
  })));
}

const DEFAULT_PROFILE: ProfileSection[] = [
  { key: 'who', title: 'Who we are', body: 'Ferrn Digital Agency is a Lagos-based digital product team working with clients in Nigeria, the United Kingdom, the United States, Canada and beyond. We combine business strategy, UI/UX design and engineering so one accountable team takes a problem to a working product.', items_json: '[]', image: null },
  { key: 'services', title: 'What we do', body: null, items_json: JSON.stringify(['Conversion-focused websites', 'Custom web applications, portals and dashboards', 'AI assistants and WhatsApp automation', 'UI/UX design', 'Hosting, maintenance and care plans', 'Ready-built marketplace products']), image: null },
  { key: 'industries', title: 'Industries served', body: null, items_json: JSON.stringify(['Logistics and freight', 'Healthcare', 'Education', 'Real estate', 'Energy and infrastructure', 'Web3 and fintech', 'Civic and non-profit']), image: null },
  { key: 'projects', title: 'Selected projects', body: null, items_json: '[]', image: null },
  { key: 'team', title: 'The team', body: null, items_json: '[]', image: null },
  { key: 'tech', title: 'Technology and capabilities', body: null, items_json: JSON.stringify(['TypeScript, React and modern web platforms', 'Cloudflare, AWS and managed hosting', 'Paystack and Stripe payments', 'WhatsApp Business and Meta APIs', 'OpenAI and Workers AI', 'Analytics, SEO and accessibility (WCAG 2.2 AA)']), image: null },
  { key: 'contact', title: 'Contact', body: 'info@ferrnagency.com · cal.com/ferrn-agency · Lagos, Nigeria (GMT+1).', items_json: '[]', image: null },
];

export function siteRoutes(lang: Lang) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => { c.set('lang', lang); await next(); });
  app.use('*', edgeCache(300));
  const ctxOf = (c: any) => loadSite(c.env, lang);

  app.get('/', async (c) => {
    const [ctx, projects, products, testimonials, posts] = await Promise.all([
      ctxOf(c), loadProjects(c.env),
      all<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 ORDER BY sort LIMIT 3`),
      all<TestimonialRow>(c.env.DB, TESTIMONIALS).catch(() => all<TestimonialRow>(c.env.DB, 'SELECT id, name, role, quote, avatar FROM testimonials WHERE published = 1 ORDER BY sort')),
      all<PostRow>(c.env.DB, "SELECT slug, title, category, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 3"),
    ]);
    return c.html(<HomePage lang={lang} ctx={ctx} projects={projects} products={await localiseProducts(c.env, products, lang)} testimonials={testimonials} posts={posts} />);
  });

  app.get('/work', async (c) => c.html(<WorkPage lang={lang} ctx={await ctxOf(c)} projects={await loadProjects(c.env)} />));
  app.get('/work/:slug', async (c) => {
    const [ctx, p, list] = await Promise.all([ctxOf(c), loadProject(c.env, c.req.param('slug')), loadProjects(c.env)]);
    if (!p) return c.html(<NotFound lang={lang} ctx={ctx} />, 404);
    const i = list.findIndex((x) => x.slug === p.slug);
    const next = list.length > 1 ? list[(i + 1) % list.length]! : null;
    const testimonial = p.testimonial_id ? await first<TestimonialRow>(c.env.DB, `${TESTIMONIALS.replace('WHERE published = 1', 'WHERE published = 1 AND id = ?')}`, p.testimonial_id).catch(() => null) : null;
    if (lang === 'en') return c.html(<CasePage lang={lang} ctx={ctx} p={p} next={next} testimonial={testimonial} />);
    const [summary, context, challenge, approach, solution] = await Promise.all([p.summary, p.context, p.challenge, p.approach, p.solution].map((s) => (s ? mt(c.env, s, lang) : Promise.resolve(s))));
    return c.html(<CasePage lang={lang} ctx={ctx} note p={{ ...p, summary, context, challenge, approach, solution }} next={next} testimonial={testimonial} />);
  });

  app.get('/services', async (c) => c.html(<ServicesPage lang={lang} ctx={await ctxOf(c)} projects={await loadProjects(c.env)} />));
  app.get('/team', async (c) => c.html(<TeamPage lang={lang} ctx={await ctxOf(c)} team={await all<TeamRow>(c.env.DB, TEAM)} />));
  app.get('/about', async (c) => {
    const [ctx, team, projects] = await Promise.all([ctxOf(c), all<TeamRow>(c.env.DB, TEAM), loadProjects(c.env)]);
    return c.html(<AboutPage lang={lang} ctx={ctx} team={team} projects={projects} />);
  });
  app.get('/profile', async (c) => {
    const [ctx, team, projects, rows] = await Promise.all([ctxOf(c), all<TeamRow>(c.env.DB, TEAM), loadProjects(c.env),
      all<ProfileSection>(c.env.DB, 'SELECT key, title, body, items_json, image FROM profile_sections WHERE published = 1 ORDER BY sort').catch(() => [])]);
    return c.html(<ProfilePage lang={lang} ctx={ctx} sections={rows.length ? rows : DEFAULT_PROFILE} projects={projects} team={team} />);
  });
  app.get('/links', async (c) => c.html(<LinksPage lang={lang} ctx={await ctxOf(c)} />));

  app.get('/insights', async (c) => {
    const posts = await all<PostRow>(c.env.DB, "SELECT slug, title, category, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC");
    return c.html(<InsightsPage lang={lang} ctx={await ctxOf(c)} posts={posts} />);
  });
  app.get('/insights/:slug', async (c) => {
    const post = await first<PostRow & { content_html: string | null }>(c.env.DB,
      "SELECT slug, title, category, excerpt, published_at, content_html FROM posts WHERE slug = ? AND status = 'published'", c.req.param('slug'));
    const ctx = await ctxOf(c);
    if (!post) return c.html(<NotFound lang={lang} ctx={ctx} />, 404);
    return c.html(<PostPage lang={lang} ctx={ctx} post={post} />);
  });

  app.get('/contact', async (c) => c.html(<ContactPage lang={lang} ctx={await ctxOf(c)} />));
  app.get('/rfp', async (c) => c.html(<ContactPage lang={lang} ctx={await ctxOf(c)} rfp />));
  app.get('/policies', async (c) => c.html(<PoliciesPage lang={lang} ctx={await ctxOf(c)} />));
  app.get('/policies/:slug', async (c) => c.html(<PoliciesPage lang={lang} ctx={await ctxOf(c)} slug={c.req.param('slug')} />));

  app.get('/careers', async (c) => c.html(<SimplePage lang={lang} ctx={await ctxOf(c)} path="/careers" title="Careers at Ferrn"
    lead="We hire people who care about business outcomes, not just pixels and code."
    body="<p>We don’t have open roles listed right now. If you are a designer, engineer or AI builder who wants to work on websites, web apps and AI systems for clients across Africa, the UK and the US, send your portfolio and a short note to <a href='mailto:info@ferrnagency.com'>info@ferrnagency.com</a>.</p>" />));

  app.get('/procurement', async (c) => c.html(<SimplePage lang={lang} ctx={await ctxOf(c)} path="/procurement" title="Procurement & vendor information"
    lead="Everything a procurement team needs to onboard Ferrn as a vendor."
    body="<ul><li><strong>Legal name:</strong> Ferrn Digital Agency (CAC registration in progress)</li><li><strong>Coverage:</strong> Nigeria · United Kingdom · United States · Canada · Remote/Global</li><li><strong>Capabilities:</strong> websites, custom web applications, portals and dashboards, AI automation, UI/UX, hosting and maintenance</li><li><strong>Company profile:</strong> <a href='/profile'>online</a> · <a href='/assets/Ferrn-Agency-Company-Profile.pdf'>PDF</a></li><li><strong>Policies:</strong> <a href='/policies'>privacy, security, accessibility and conduct statements</a></li><li><strong>Procurement contact:</strong> <a href='mailto:info@ferrnagency.com'>info@ferrnagency.com</a></li></ul><p>To invite Ferrn to tender, <a href='/rfp'>submit an RFP</a>.</p>" />));

  app.get('/marketplace', async (c) => {
    const [ctx, products] = await Promise.all([ctxOf(c), all<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 ORDER BY sort`)]);
    return c.html(<MarketplacePage lang={lang} ctx={ctx} products={await localiseProducts(c.env, products, lang)} />);
  });
  app.get('/marketplace/thank-you', async (c) => c.html(<CheckoutResult lang={lang} ctx={await ctxOf(c)} ok={c.req.query('status') === 'paid'} product={c.req.query('product')} />));
  app.get('/marketplace/:slug', async (c) => {
    const [ctx, p] = await Promise.all([ctxOf(c), first<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE slug = ? AND published = 1`, c.req.param('slug'))]);
    if (!p) return c.html(<NotFound lang={lang} ctx={ctx} />, 404);
    const related = await all<ProductRow>(c.env.DB,
      `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 AND slug != ? AND (industry = ? OR category = ?) ORDER BY sort LIMIT 3`, p.slug, p.industry, p.category);
    const [lp] = await localiseProducts(c.env, [p], lang, true);
    return c.html(<ProductPage lang={lang} ctx={ctx} p={lp!} note={lang !== 'en'} related={await localiseProducts(c.env, related, lang)} />);
  });

  // Legacy URLs from the PHP site.
  app.get('/testimonials', (c) => c.redirect(lang === 'en' ? '/#testimonials' : `/${lang}/#testimonials`, 301));
  app.get('/admin', (c) => c.redirect('/studio', 302));
  const base = lang === 'en' ? '' : `/${lang}`;
  for (const [from, to] of [['/proposal', '/contact'], ['/index.php', '/']] as const) app.get(from, (c) => c.redirect(base + to, 301));
  app.get('/campaign/*', (c) => c.redirect(base + '/', 302));

  return app;
}

/** sitemap.xml: every public page in every language, with hreflang alternates. */
export async function sitemap(env: AppEnv['Bindings']) {
  const site = 'https://www.ferrnagency.com';
  const langs = ['en', 'yo', 'ig', 'ha', 'fr', 'de', 'es', 'zh'];
  const fixed = ['/', '/work', '/services', '/marketplace', '/about', '/team', '/insights', '/contact', '/rfp', '/profile', '/links', '/policies', '/careers', '/procurement'];
  const [projects, products, posts] = await Promise.all([
    loadProjects(env),
    all<{ slug: string; updated_at: string | null }>(env.DB, 'SELECT slug, updated_at FROM products WHERE published = 1'),
    all<{ slug: string; published_at: string | null }>(env.DB, "SELECT slug, published_at FROM posts WHERE status = 'published'"),
  ]);
  const paths: { path: string; mod?: string | null; prio: number }[] = [
    ...fixed.map((p) => ({ path: p, prio: p === '/' ? 1 : 0.7 })),
    ...projects.map((p) => ({ path: `/work/${p.slug}`, prio: 0.8 })),
    ...products.map((p) => ({ path: `/marketplace/${p.slug}`, mod: p.updated_at, prio: 0.8 })),
    ...posts.map((p) => ({ path: `/insights/${p.slug}`, mod: p.published_at, prio: 0.6 })),
  ];
  const url = (l: string, p: string) => site + (l === 'en' ? p : `/${l}${p === '/' ? '/' : p}`);
  const body = paths.map((p) => `<url><loc>${url('en', p.path)}</loc>${p.mod ? `<lastmod>${String(p.mod).slice(0, 10)}</lastmod>` : ''}<priority>${p.prio}</priority>${langs.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${url(l, p.path)}"/>`).join('')}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
}

export { NotFound };
