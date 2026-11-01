import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { all, first } from '../lib/db';
import { edgeCache } from '../lib/cache';
import { mt } from '../lib/translate';
import { type Lang } from '../content/i18n';
import { PROJECTS } from '../content/projects';
import { HomePage, type PostRow, type ProductRow, type TeamRow, type TestimonialRow } from '../views/home';
import {
  AboutPage, CasePage, CheckoutResult, ContactPage, InsightsPage, MarketplacePage, NotFound, PoliciesPage, PostPage,
  ProductPage, ServicesPage, SimplePage, TeamPage, WorkPage,
} from '../views/pages';

const PRODUCT_COLS = `slug, name, category, industry, tagline, description, demo_url, accent, price_ngn_setup, price_ngn_monthly,
  price_usd_setup, price_usd_monthly, buyout_ngn, buyout_usd, delivery_days, features_json, includes_json`;

/** Translates the long-form text fields of products for non-English pages (cached in KV). */
async function localiseProducts(env: AppEnv['Bindings'], items: ProductRow[], lang: Lang, deep = false) {
  if (lang === 'en') return items;
  return Promise.all(items.map(async (p) => ({
    ...p,
    tagline: p.tagline ? await mt(env, p.tagline, lang) : p.tagline,
    ...(deep && p.description ? { description: await mt(env, p.description, lang) } : {}),
  })));
}

export function siteRoutes(lang: Lang) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => { c.set('lang', lang); await next(); });
  app.use('*', edgeCache(300));

  app.get('/', async (c) => {
    const lang = c.get('lang');
    const [products, team, testimonials, posts] = await Promise.all([
      all<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 ORDER BY sort LIMIT 3`),
      all<TeamRow>(c.env.DB, 'SELECT id, name, role, bio, photo, linkedin, github FROM team_members WHERE published = 1 ORDER BY sort'),
      all<TestimonialRow>(c.env.DB, 'SELECT name, role, quote, avatar FROM testimonials WHERE published = 1 ORDER BY sort'),
      all<PostRow>(c.env.DB, "SELECT slug, title, category, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 3"),
    ]);
    return c.html(<HomePage lang={lang} projects={PROJECTS} products={await localiseProducts(c.env, products, lang)} team={team} testimonials={testimonials} posts={posts} />);
  });

  app.get('/work', (c) => c.html(<WorkPage lang={c.get('lang')} projects={PROJECTS} />));
  app.get('/work/:slug', async (c) => {
    const lang = c.get('lang');
    const p = PROJECTS.find((x) => x.slug === c.req.param('slug'));
    if (!p) return c.html(<NotFound lang={lang} />, 404);
    if (lang === 'en') return c.html(<CasePage lang={lang} p={p} />);
    const [summary, context, challenge, solution, impact] = await Promise.all(
      [p.summary, p.context, p.challenge, p.solution, p.impact].map((s) => mt(c.env, s, lang)));
    return c.html(<CasePage lang={lang} note p={{ ...p, summary, context, challenge, solution, impact }} />);
  });

  app.get('/services', (c) => c.html(<ServicesPage lang={c.get('lang')} />));

  app.get('/team', async (c) => {
    const team = await all<TeamRow>(c.env.DB, 'SELECT id, name, role, bio, photo, linkedin, github FROM team_members WHERE published = 1 ORDER BY sort');
    return c.html(<TeamPage lang={c.get('lang')} team={team} />);
  });
  app.get('/about', async (c) => {
    const team = await all<TeamRow>(c.env.DB, 'SELECT id, name, role, bio, photo, linkedin, github FROM team_members WHERE published = 1 ORDER BY sort');
    return c.html(<AboutPage lang={c.get('lang')} team={team} />);
  });

  app.get('/insights', async (c) => {
    const posts = await all<PostRow>(c.env.DB, "SELECT slug, title, category, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC");
    return c.html(<InsightsPage lang={c.get('lang')} posts={posts} />);
  });
  app.get('/insights/:slug', async (c) => {
    const post = await first<PostRow & { content_html: string | null }>(c.env.DB,
      "SELECT slug, title, category, excerpt, published_at, content_html FROM posts WHERE slug = ? AND status = 'published'", c.req.param('slug'));
    if (!post) return c.html(<NotFound lang={c.get('lang')} />, 404);
    return c.html(<PostPage lang={c.get('lang')} post={post} />);
  });

  app.get('/contact', (c) => c.html(<ContactPage lang={c.get('lang')} />));
  app.get('/rfp', (c) => c.html(<ContactPage lang={c.get('lang')} rfp />));
  app.get('/policies', (c) => c.html(<PoliciesPage lang={c.get('lang')} />));
  app.get('/policies/:slug', (c) => c.html(<PoliciesPage lang={c.get('lang')} slug={c.req.param('slug')} />));

  app.get('/careers', (c) => c.html(<SimplePage lang={c.get('lang')} path="/careers" title="Careers at Ferrn"
    lead="We hire people who care about business outcomes, not just pixels and code."
    body="<p>We don’t have open roles listed right now. If you are a designer, engineer or AI builder who wants to work on websites, web apps and AI systems for clients across Africa, the UK and the US, send your portfolio and a short note to <a href='mailto:info@ferrnagency.com'>info@ferrnagency.com</a>.</p>" />));

  app.get('/procurement', (c) => c.html(<SimplePage lang={c.get('lang')} path="/procurement" title="Procurement & vendor information"
    lead="Everything a procurement team needs to onboard Ferrn as a vendor."
    body="<ul><li><strong>Legal name:</strong> Ferrn Digital Agency (CAC registration in progress)</li><li><strong>Coverage:</strong> Nigeria · United Kingdom · United States · Canada · Remote/Global</li><li><strong>Capabilities:</strong> websites, custom web applications, portals and dashboards, AI automation, UI/UX, hosting and maintenance</li><li><strong>Company profile:</strong> <a href='/assets/Ferrn-Agency-Company-Profile.pdf'>download PDF</a></li><li><strong>Policies:</strong> <a href='/policies'>privacy, security, accessibility and conduct statements</a></li><li><strong>Procurement contact:</strong> <a href='mailto:info@ferrnagency.com'>info@ferrnagency.com</a></li></ul><p>To invite Ferrn to tender, <a href='/rfp'>submit an RFP</a>.</p>" />));

  app.get('/marketplace', async (c) => {
    const lang = c.get('lang');
    const products = await all<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 ORDER BY sort`);
    return c.html(<MarketplacePage lang={lang} products={await localiseProducts(c.env, products, lang)} />);
  });
  app.get('/marketplace/thank-you', (c) => c.html(<CheckoutResult lang={c.get('lang')} ok={c.req.query('status') === 'paid'} product={c.req.query('product')} />));
  app.get('/marketplace/:slug', async (c) => {
    const lang = c.get('lang');
    const p = await first<ProductRow>(c.env.DB, `SELECT ${PRODUCT_COLS} FROM products WHERE slug = ? AND published = 1`, c.req.param('slug'));
    if (!p) return c.html(<NotFound lang={lang} />, 404);
    const related = await all<ProductRow>(c.env.DB,
      `SELECT ${PRODUCT_COLS} FROM products WHERE published = 1 AND slug != ? AND (industry = ? OR category = ?) ORDER BY sort LIMIT 3`, p.slug, p.industry, p.category);
    const [lp] = await localiseProducts(c.env, [p], lang, true);
    return c.html(<ProductPage lang={lang} p={lp!} note={lang !== 'en'} related={await localiseProducts(c.env, related, lang)} />);
  });

  // Legacy URLs from the PHP site.
  app.get('/testimonials', (c) => c.redirect(lang === 'en' ? '/#testimonials' : `/${lang}/#testimonials`, 301));
  app.get('/admin', (c) => c.redirect('/studio', 302));

  return app;
}

export { NotFound };
