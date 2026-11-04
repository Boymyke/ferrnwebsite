import type { Bindings } from './env';
import { all } from './db';
import { contentVersion } from './cache';
import { t } from '../content/i18n';

/* Editable website copy. Every key has a code default, so an empty table renders the site as
 * designed. Studio → Website → Content edits these; the value wins for English pages, other
 * languages keep their translations unless a key only exists here. */
export type ContentField = { key: string; label: string; group: string; type?: 'text' | 'textarea' | 'url' | 'image' | 'list' | 'toggle' | 'number'; help?: string; default: string };

export const CONTENT_FIELDS: ContentField[] = [
  // Home
  { key: 'home.hero.kicker', group: 'Home', label: 'Hero kicker (optional)', default: '' },
  { key: 'home.hero.flick', group: 'Home', label: 'Hero — words that flick in orange (| separated)', default: 'Websites|Web apps|AI assistants|Automations' },
  { key: 'home.hero.title', group: 'Home', label: 'Hero — rest of the headline', default: 'that grow your business.' },
  { key: 'home.hero.sub', group: 'Home', label: 'Hero paragraph', type: 'textarea', default: 'Ferrn designs and builds the website, the web app and the assistant behind it — one accountable team in Lagos, working with clients in the UK, US and Canada.' },
  { key: 'home.hero.cta', group: 'Home', label: 'Primary button', default: 'See it in action' },
  { key: 'home.hero.cta2', group: 'Home', label: 'Secondary button', default: 'Start a project' },
  { key: 'home.hero.shot', group: 'Home', label: 'Hero screenshot (image)', type: 'image', default: '/assets/home/hero-clinic.webp' },
  { key: 'home.hero.caption', group: 'Home', label: 'Caption under the screenshot', default: 'Clinic Front Desk — a ready-built product from the Ferrn marketplace' },
  { key: 'home.bento.title', group: 'Home', label: 'Capabilities headline (| = new line)', default: 'Built for business.|Not for show.' },
  { key: 'home.bento.lead', group: 'Home', label: 'Capabilities lead', type: 'textarea', default: 'Everything we ship is meant to be used daily by customers and staff — booking, quoting, tracking, reminding, answering.' },
  { key: 'home.bento.cards', group: 'Home', label: 'Capability cards (title|text|video per line)', type: 'textarea', default: 'Booking that fills the diary.|Patients pick a service, branch, doctor and time; the clinic confirms on WhatsApp.|/assets/home/clinic.mp4\nPortals customers actually use.|Instant quotes and live tracking for freight, admissions, property — any workflow.|/assets/home/track.mp4\nReminders that send themselves.|Tomorrow’s appointments reminded tonight on WhatsApp, straight from the booking sheet.|/assets/home/automation.mp4\nEvery site comes with a Studio.|Leads, quotes, proposals, content and the website itself, managed from one place.|/assets/home/studio.mp4' },
  { key: 'home.market.title', group: 'Home', label: 'Marketplace headline (| = new line)', default: 'Live in days.|Not months.' },
  { key: 'home.market.lead', group: 'Home', label: 'Marketplace lead', type: 'textarea', default: 'Ready-built websites, apps and assistants. Try the live demo, pick a plan, and we set it up on your domain with your content.' },
  { key: 'home.work.title', group: 'Home', label: 'Work headline (| = new line)', default: 'Work that earned|its keep.' },
  { key: 'home.work.lead', group: 'Home', label: 'Work lead', type: 'textarea', default: 'Selected websites, applications and AI systems. Every one shipped, every one in use.' },
  { key: 'home.bob.title', group: 'Home', label: 'Bob headline (| = new line)', default: 'Meet Bob.|He answers at 2am.' },
  { key: 'home.bob.lead', group: 'Home', label: 'Bob lead', type: 'textarea', default: 'Every Ferrn site can ship with an assistant that knows the business, takes visitors to the right page and reads it aloud in a Nigerian voice.' },
  { key: 'home.bob.points', group: 'Home', label: 'Bob points (title|text per line)', type: 'textarea', default: 'Grounded answers.|Only what is on your site and in your approved notes — never invented prices or promises.\nTakes them there.|“Show me the plans” opens the right page instead of a wall of text.\nReads aloud.|Pause, restart, change the speed; the page highlights as it reads.' },
  { key: 'home.cta.title', group: 'Home', label: 'Closing headline (| = new line)', default: 'Let’s build|what’s next.' },
  { key: 'home.cta.lead', group: 'Home', label: 'Closing line', default: 'Tell us the problem. We’ll help define what should be built, and give you an honest price.' },
  { key: 'home.trusted.title', group: 'Home', label: 'Trusted-by label', default: 'Trusted By' },
  { key: 'home.growth.kicker', group: 'Home', label: 'Growth — kicker', default: 'Why it pays for itself' },
  { key: 'home.growth.title', group: 'Home', label: 'Growth — headline', default: 'More enquiries.|More customers.|Less chasing.' },
  { key: 'home.growth.lead', group: 'Home', label: 'Growth — paragraph', type: 'textarea', default: 'A website earns money in three places: when people find you, when they decide to contact you, and when someone follows up. We build for all three — then measure it, so you can see what changed.' },
  { key: 'home.growth.levers', group: 'Home', label: 'Growth — levers (title|text|tag per line)', type: 'textarea', default: 'Get found|Fast pages, clean structure and local search set up properly, so the people already searching for what you sell land on you — not a competitor.|Search · Speed · Google Business\nGet chosen|A clear offer, real proof and one-tap WhatsApp, booking or quote — the fewer steps between interest and contact, the more visitors become enquiries.|Copy · Proof · Booking · WhatsApp\nNever let a lead go cold|An assistant answers at 2am, reminders go out on their own and every enquiry lands in one place with a next step — so nothing waits for someone to remember.|AI assistant · Automations · CRM' },
  { key: 'home.ticker', group: 'Home', label: 'Capabilities ticker (| separated)', default: 'Websites|Web applications|Client portals|Dashboards|AI assistants|WhatsApp automation|UI/UX design|Booking systems|E-commerce|Hosting & care' },
  { key: 'home.services.title', group: 'Home', label: 'Services headline', default: 'Three things we do very well.' },
  { key: 'home.services.lead', group: 'Home', label: 'Services lead', type: 'textarea', default: 'Pick the one that solves the actual problem. We’ll tell you if it’s the wrong one.' },
  { key: 'home.testimonials.title', group: 'Home', label: 'Testimonials headline', default: 'In their words.' },
  { key: 'home.process.title', group: 'Home', label: 'Process headline', default: 'Fast enough to move. Structured enough to trust.' },
  { key: 'home.faq.title', group: 'Home', label: 'FAQ headline', default: 'Before you start a project with Ferrn.' },
  { key: 'home.stats', group: 'Home', label: 'Numbers (value|label per line)', type: 'textarea', default: '50+|projects shipped\n4|countries with active clients\n5–14 days|to launch a marketplace product\n1|accountable team' },
  // Services
  { key: 'services.title', group: 'Services', label: 'Page headline', default: 'Choose the product that solves the real problem.' },
  { key: 'services.lead', group: 'Services', label: 'Page lead', type: 'textarea', default: 'Every engagement starts with the commercial problem, not the deliverable. These are the three shapes the answer usually takes.' },
  { key: 's1.title', group: 'Services', label: 'Service 1 title', default: 'Conversion-focused websites' },
  { key: 's1.body', group: 'Services', label: 'Service 1 description', type: 'textarea', default: 'Stronger positioning, more trust and a clear path from first visit to qualified enquiry.' },
  { key: 's2.title', group: 'Services', label: 'Service 2 title', default: 'Custom web applications' },
  { key: 's2.body', group: 'Services', label: 'Service 2 description', type: 'textarea', default: 'Portals, dashboards and workflow systems that replace spreadsheets, paper and manual handoffs.' },
  { key: 's3.title', group: 'Services', label: 'Service 3 title', default: 'AI automation' },
  { key: 's3.body', group: 'Services', label: 'Service 3 description', type: 'textarea', default: 'Assistants, document intelligence and WhatsApp automations that answer customers around the clock.' },
  // Work
  { key: 'work.title', group: 'Work', label: 'Work page headline', default: 'Work that had to earn its keep.' },
  { key: 'work.lead', group: 'Work', label: 'Work page lead', type: 'textarea', default: 'Selected websites, applications and AI systems. Every one shipped, every one in use.' },
  // Marketplace
  { key: 'market.title', group: 'Marketplace', label: 'Headline', default: 'Ready-built websites, apps and AI. Live in days, not months.' },
  { key: 'market.sub', group: 'Marketplace', label: 'Lead', type: 'textarea', default: 'Try every product live. Pick a plan, tell us about your business, and we set it up, host it and keep it running.' },
  // About
  { key: 'about.title', group: 'About', label: 'Headline', default: 'A focused digital product partner, not another layer of agency overhead.' },
  { key: 'about.lead', group: 'About', label: 'Lead', type: 'textarea', default: 'Ferrn combines business strategy, UI/UX design and engineering so companies can move from a problem to a working digital product with one accountable team.' },
  { key: 'about.principle', group: 'About', label: 'Operating principle', default: 'Make money, save time, solve something worth solving.' },
  { key: 'about.body', group: 'About', label: 'Story (paragraphs separated by blank lines)', type: 'textarea', default: 'We work with clients across Nigeria, the United Kingdom, the United States, Canada and beyond — from logistics and infrastructure firms to healthcare, education, Web3 and civic organisations.\n\nWe are small on purpose. The people who scope your project are the people who design and build it, so nothing is lost between the pitch and the product.' },
  // Contact
  { key: 'contact.title', group: 'Contact', label: 'Headline', default: 'Tell us the problem. We’ll help define what should be built.' },
  { key: 'contact.sub', group: 'Contact', label: 'Lead', type: 'textarea', default: 'You don’t need a perfect brief. Tell us what is costing the business opportunities, time or visibility.' },
  { key: 'contact.reply', group: 'Contact', label: 'Reply promise', default: 'We reply within one working day (Lagos time, GMT+1).' },
  // Global
  { key: 'nav.cta', group: 'Global', label: 'Header button', default: 'Start a project' },
  { key: 'footer.kicker', group: 'Global', label: 'Footer kicker', default: 'Next project' },
  { key: 'footer.title', group: 'Global', label: 'Footer headline', default: 'Let’s build what’s next.' },
  { key: 'company.address', group: 'Global', label: 'Address line (footer)', default: 'Lagos, Nigeria · working with clients in the UK, US, Canada and beyond' },
  { key: 'company.phone', group: 'Global', label: 'Phone / WhatsApp', default: '' },
  { key: 'seo.home.title', group: 'SEO', label: 'Home title tag', default: 'Ferrn Digital Agency — Websites, Web Apps & AI Automation' },
  { key: 'seo.home.description', group: 'SEO', label: 'Home meta description', type: 'textarea', default: 'Ferrn designs and builds conversion-focused websites, custom web applications and AI automation for businesses in Nigeria, the UK, the US and beyond — plus ready-built products you can launch in days.' },
  // Bob
  { key: 'bob.name', group: 'Bob', label: 'Assistant name', default: 'Bob' },
  { key: 'bob.welcome', group: 'Bob', label: 'Welcome message', type: 'textarea', default: 'Hi, I’m Bob. I can explain what Ferrn builds, take you to the right page, or read this one aloud. What are you working on?' },
  { key: 'bob.suggestions', group: 'Bob', label: 'Suggested questions (| separated)', default: 'What does Ferrn build?|Show me your work|Read this page to me|Can Ferrn build a patient portal?' },
  { key: 'bob.persona', group: 'Bob', label: 'Personality notes (admins only)', type: 'textarea', default: 'Warm, direct, Nigerian-professional English. Short answers. Never invent clients, prices or results. Offer to navigate when a page answers the question better than text.' },
  // Idle
  { key: 'idle.enabled', group: 'Idle mode', label: 'Idle storytelling on (1/0)', type: 'toggle', default: '1' },
  { key: 'idle.seconds', group: 'Idle mode', label: 'Seconds before it starts', type: 'number', default: '45' },
  { key: 'idle.lines', group: 'Idle mode', label: 'Story lines (| separated)', type: 'textarea', default: 'Good ideas deserve better execution.|We turn complex problems into simple digital experiences.|Websites. Web applications. AI that answers at 2am.|From Lagos to London to Houston, one accountable team.|Still here? Let’s build what’s next.' },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.default]));

export type Season = { id: string; name: string; preset: string; greeting: string | null; banner_text: string | null; banner_url: string | null; accent: string | null; effect: string | null; settings_json: string };
export type LinkRow = { id: string; title: string; description: string | null; url: string; category: string | null; icon: string | null };
export type Faq = { id: string; question: string; answer: string; category: string | null };

export type SiteCtx = {
  lang: string;
  /** Studio value → code default. For non-English pages, i18n translation of the same key wins when one exists. */
  get: (key: string) => string;
  /** per-line helper for | separated values */
  list: (key: string) => string[];
  season: Season | null;
  links: LinkRow[];
  faqs: Faq[];
  bob: { enabled: boolean; voice: string; readAloud: boolean };
};

let memo: { v: string; lang: string; ctx: SiteCtx; at: number } | null = null;

export async function loadSite(env: Bindings, lang: string): Promise<SiteCtx> {
  const v = await contentVersion(env);
  if (memo && memo.v === v && memo.lang === lang && Date.now() - memo.at < 60_000) return memo.ctx;
  const safe = async <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]); // tables may not exist locally before the migration
  const now = new Date().toISOString();
  const [rows, seasons, links, faqs, settings] = await Promise.all([
    safe(all<{ key: string; value: string }>(env.DB, 'SELECT key, value FROM site_content')),
    safe(all<Season & { priority: number }>(env.DB, `SELECT * FROM seasons WHERE enabled = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY priority DESC, updated_at DESC LIMIT 1`, now, now)),
    safe(all<LinkRow>(env.DB, 'SELECT id, title, description, url, category, icon FROM links WHERE visible = 1 ORDER BY sort, title')),
    safe(all<Faq>(env.DB, 'SELECT id, question, answer, category FROM faqs WHERE published = 1 AND on_site = 1 ORDER BY sort')),
    safe(all<{ key: string; value: string }>(env.DB, "SELECT key, value FROM settings WHERE key LIKE 'bob.%'")),
  ]);
  const over = Object.fromEntries(rows.filter((r) => r.value != null && r.value !== '').map((r) => [r.key, r.value]));
  const set = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const get = (key: string) => {
    if (lang !== 'en') { const tr = t(lang as any, key); if (tr && tr !== key) return tr; }
    return over[key] ?? DEFAULTS[key] ?? (t(lang as any, key) !== key ? t(lang as any, key) : '');
  };
  const ctx: SiteCtx = {
    lang, get,
    list: (key) => get(key).split('|').map((s) => s.trim()).filter(Boolean),
    season: seasons[0] ?? null, links, faqs,
    bob: { enabled: set['bob.enabled'] !== '0', voice: set['bob.voice'] ?? 'auto', readAloud: set['bob.read_aloud'] !== '0' },
  };
  memo = { v, lang, ctx, at: Date.now() };
  return ctx;
}
