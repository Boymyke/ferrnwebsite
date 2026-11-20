/**
 * Autopilot prospecting: on the cron, search Google Maps for the configured niches × cities,
 * read each business's own website for a published email and visible gaps, score it, and add
 * the best new ones to Leads (found_by = 'auto'). One search per run, so the 10-minute cron
 * spreads the work across the day.
 *
 * Staying fresh: Google returns the same top 20 for the same words, so a niche × city pair that
 * is searched the same way every day runs dry in about a week. Each visit to a pair therefore uses
 * a different area of the city and a different wording (see searchFor), and Lagos and abroad
 * take turns. The number of searches a day is set from what is left of the month's free Google
 * Maps allowance, so the autopilot never runs out mid-month and never produces a bill.
 *
 * Email first: leads with a published business email fill the day. Phone-only (WhatsApp) leads
 * are allowed only in Nigeria and only up to `whatsappShare` % of the daily cap. Email leads are
 * handed to LeadsHunter, where the morning routine writes and queues their email sequence.
 */
import type { Bindings } from './env';
import { all, first, getSetting, newId, run, setSetting } from './db';
import { countryOf, enrichProspects, isNigerian, LAGOS_AND_ABROAD, mapsBudget, placeQuery, searchPlaces } from './maps';
import { engineCall, engineConfigured } from './engine';

export type AutoConfig = {
  enabled: boolean;
  niches: string[];          // keys like 'clinic', 'school' or free text
  cities: string[];
  dailyCap: number;          // max leads added per day
  minScore: number;          // 0–100
  whatsappShare: number;     // max % of the daily cap that may be phone-only (Nigeria only)
  cursor?: number;           // which pair runs next
  visits?: Record<string, number>;               // per "niche|city": how many times it has been searched (picks area + wording)
  day?: { date: string; searches: number };      // Google Maps searches used today
  lastRun?: { at: string; query: string; added: number; seen: number; fresh?: number; emails?: number; error?: string };
};

export const NICHE_QUERY: Record<string, string> = {
  clinic: 'private hospitals and clinics', dental: 'dental clinics', eye: 'eye clinics', fertility: 'fertility clinics', physio: 'physiotherapy clinics',
  lab: 'diagnostic laboratories', school: 'private schools', logistics: 'logistics and freight companies', realestate: 'real estate developers and agencies',
  shortlet: 'shortlet apartments', hospitality: 'hotels', solar: 'solar installation companies', ngo: 'NGOs and associations',
  ecommerce: 'fashion and beauty stores', professional: 'law firms and accounting firms',
  homecare: 'home care agencies', cleaning: 'commercial cleaning companies', construction: 'construction companies', church: 'churches',
  engineering: 'engineering and oil and gas services companies', interior: 'interior design and furniture companies',
  events: 'event centres and event planners', autodealer: 'car dealerships', manufacturing: 'manufacturing companies',
  travel: 'travel agencies and tour operators', studyabroad: 'study abroad and visa consultants',
  staffing: 'recruitment and outsourcing companies', security: 'security companies',
  microfinance: 'microfinance banks and loan companies', insurance: 'insurance brokers', pharma: 'pharmaceutical distributors and wholesalers',
  facility: 'facility management companies',
};
/** Other ways to say the same niche. Each visit to a pair uses the next wording, which surfaces different businesses. */
export const NICHE_VARIANTS: Record<string, string[]> = {
  logistics: ['freight forwarding and customs clearing agents', 'haulage and trucking companies', 'cargo and courier companies'],
  clinic: ['specialist hospitals', 'medical centres', 'maternity and children hospitals'],
  fertility: ['IVF centres', 'gynaecology and women\'s health clinics'],
  dental: ['orthodontists and dental implant clinics', 'dentists'],
  realestate: ['property developers', 'estate surveyors and valuers', 'property management companies'],
  school: ['private secondary schools', 'montessori and nursery schools', 'international schools'],
  construction: ['building contractors', 'civil engineering contractors', 'architecture firms'],
  engineering: ['oil and gas servicing companies', 'electrical and mechanical engineering companies', 'marine and offshore services companies'],
  solar: ['solar and inverter companies', 'power and energy solutions companies'],
  professional: ['law firms', 'chartered accounting and audit firms', 'business and management consulting firms'],
  homecare: ['home nursing services', 'elderly care services'],
  interior: ['interior designers', 'furniture makers and showrooms', 'kitchen and wardrobe companies'],
  events: ['event halls and banquet venues', 'wedding planners and event decorators'],
  autodealer: ['car dealers', 'auto sales and leasing companies'],
  manufacturing: ['food processing companies', 'packaging and plastics manufacturers', 'agro-processing and export companies'],
  travel: ['travel and visa agencies', 'tour operators'],
  studyabroad: ['education consultants', 'visa and immigration consultants'],
  staffing: ['HR and recruitment agencies', 'outsourcing companies'],
  security: ['private security guard companies', 'CCTV and security systems companies'],
  microfinance: ['microfinance banks', 'cooperative societies and thrift companies', 'asset finance and leasing companies'],
  insurance: ['insurance brokerage firms', 'health maintenance organisations (HMO)'],
  pharma: ['pharmaceutical companies', 'medical equipment suppliers'],
  facility: ['estate and facility managers', 'property and facilities maintenance companies'],
  lab: ['medical diagnostic centres', 'radiology and imaging centres'],
  hospitality: ['boutique hotels', 'serviced apartments and suites'],
};

/** The web application each niche most often needs. Saved on the lead as the pitch, so every message leads with it. */
export const WEBAPP_PITCH: Record<string, string> = {
  logistics: 'Shipment tracking portal: customers request quotes and track cargo themselves, staff update status once',
  clinic: 'Patient portal: online booking, records and results, with reminders, instead of phone calls and paper files',
  fertility: 'Patient portal: private booking, treatment-cycle tracking and results for each patient',
  lab: 'Results portal: patients and referring doctors book tests and collect results online',
  dental: 'Booking and patient portal: appointments, treatment plans and payments online',
  realestate: 'Buyer portal: each buyer sees their plot or unit, payment plan, receipts and documents; sales team tracks every lead',
  school: 'Parent and admissions portal: apply online, pay fees, see results and notices in one place',
  construction: 'Project portal: clients follow progress, photos, milestones and payments; the team tracks sites and costs',
  engineering: 'Operations portal: jobs, crews, equipment and client reporting in one system instead of spreadsheets',
  manufacturing: 'Distributor ordering portal: distributors place and track orders, with stock and invoices in one place',
  solar: 'Customer portal: quotes, installation tracking, payment plans and maintenance requests online',
  professional: 'Client portal: clients upload documents, follow their matter or filing, and pay invoices online',
  autodealer: 'Inventory and enquiry system: live stock online, finance applications and lead tracking for the sales team',
  staffing: 'Staffing platform: shifts, timesheets, compliance documents and client requests in one app',
  security: 'Guard management app: rosters, patrol check-ins, incident reports and a client view',
  microfinance: 'Loan portal: customers apply, upload documents and track repayments online; staff approve in one workflow',
  insurance: 'Client portal: quotes, policy documents, renewals and claims tracking online',
  pharma: 'B2B ordering portal: pharmacies and hospitals order, track delivery and see statements online',
  facility: 'Service portal: residents and tenants log requests, pay service charges and see updates; managers track jobs',
  hospitality: 'Direct booking system: guests book and pay on your own site, with a dashboard for rooms and enquiries',
  homecare: 'Care management app: visit schedules, staff compliance, care notes and a family view',
};
/** Where the website is core: customers find, compare, book, buy, apply or check the business online before
 *  they ever call, or the business sells to people far away. Only these are prospected (Michael, 20 Nov 2026:
 *  "clients that cannot do without one", not businesses that only might need a site). */
export const CORE_WHY: Record<string, string> = {
  hospitality: 'guests compare and book hotels online; every booking through an agent costs commission',
  shortlet: 'guests find, check and book shortlets online, often from abroad',
  realestate: 'buyers, many abroad, judge a developer by its website before they pay',
  school: 'parents shortlist schools online and apply during admission season',
  clinic: 'patients look up a hospital and book before they visit',
  fertility: 'patients research fertility clinics privately online, often from abroad',
  lab: 'patients and doctors book tests and look for results online',
  dental: 'patients compare clinics and book online',
  logistics: 'shippers check a forwarder online, ask for quotes and expect tracking',
  travel: 'travellers book and verify agencies online before they pay',
  studyabroad: 'students and parents check an agency online before trusting it with fees',
  events: 'couples and companies shortlist venues online',
  autodealer: 'buyers browse stock online before visiting',
  solar: 'homeowners and businesses search for installers and compare quotes online',
  microfinance: 'customers check a lender online before they apply',
  insurance: 'clients compare brokers and request quotes online',
  professional: 'clients search for lawyers and accountants online, especially immigration clients abroad',
  homecare: 'families search for care providers online and check them before calling',
  ecommerce: 'the website is the shop',
};
/** The AI automation each niche gets the most from: the pitch when the visible need is hand-run customer chats. */
export const AI_PITCH: Record<string, string> = {
  hospitality: 'WhatsApp and website assistant that answers guests, quotes rates and takes bookings at any hour',
  shortlet: 'WhatsApp assistant that answers guests, checks dates, quotes and takes bookings instantly',
  realestate: 'WhatsApp assistant that answers buyers, sends brochures and payment plans, and books inspections',
  school: 'WhatsApp assistant that answers parents, sends admission steps and fee details, and books visits',
  clinic: 'WhatsApp assistant that books appointments, sends reminders and answers common patient questions',
  fertility: 'Private WhatsApp assistant that answers first questions and books consultations',
  lab: 'WhatsApp assistant that books tests, gives preparation instructions and tells patients when results are ready',
  dental: 'WhatsApp assistant that books, confirms and reminds appointments',
  logistics: 'WhatsApp assistant that gives quotes, takes bookings and answers "where is my cargo?"',
  travel: 'WhatsApp assistant that answers visa and flight questions and collects documents',
  studyabroad: 'WhatsApp assistant that answers student questions, checks eligibility and books consultations',
  events: 'WhatsApp assistant that checks venue dates, sends packages and books viewings',
  autodealer: 'WhatsApp assistant that answers stock and price questions and books test drives',
  ecommerce: 'WhatsApp ordering assistant that answers product questions, takes orders and confirms payment',
};
/** Business-to-business niches have few Google reviews by nature, so a lower bar proves they are established. */
const B2B = new Set(['logistics', 'construction', 'engineering', 'manufacturing', 'professional', 'staffing', 'security', 'insurance', 'pharma', 'facility', 'microfinance']);
/** Size test (about $10k a month profit or more): a busy consumer business has 40+ reviews; a B2B firm with 12+ is established. */
const bigEnough = (niche: string, reviews = 0) => reviews >= (B2B.has(niche) ? 12 : 40);



/* Abroad, Ferrn wins with owner-run businesses that serve the African diaspora or are run by it, not with
 * polished high-street brands. These queries replace the generic one outside Nigeria, and a niche with no
 * entry here is not searched abroad at all (a private school in London is not a Ferrn client). */
export const ABROAD_QUERY: Record<string, string> = {
  logistics: 'cargo and shipping to Nigeria and Africa companies', professional: 'immigration law firms and accountants for small businesses',
  realestate: 'independent property management companies', homecare: 'independent home care agencies',
  staffing: 'healthcare staffing and nursing agencies',
  // kept for searches typed by hand in Studio; not in the default autopilot list
  ecommerce: 'African and Caribbean food and beauty stores', church: 'African churches', hospitality: 'Nigerian and African restaurants',
  events: 'Nigerian and African wedding caterers and event planners', travel: 'travel agencies for flights to Nigeria and Africa',
};
export const ABROAD_VARIANTS: Record<string, string[]> = {
  logistics: ['African freight forwarders and shipping agents', 'barrel and container shipping to Africa'],
  professional: ['immigration lawyers', 'small business accountants and tax advisers'],
  realestate: ['property management companies', 'independent letting agents'],
  homecare: ['domiciliary care agencies', 'supported living providers'],
  staffing: ['care staff recruitment agencies', 'nurse staffing agencies'],
  church: ['Nigerian churches', 'African charities and community organisations'],
  events: ['African event halls and banquet venues'], travel: ['African travel agents'], ecommerce: ['African grocery stores'],
};
/** Niches that only make sense abroad (in Lagos they are not who Ferrn sells to). */
const ABROAD_ONLY = new Set(['church']);
/** Abroad the autopilot only searches these (diaspora-facing and big enough); other ABROAD_QUERY entries are for manual searches. */
const ABROAD_AUTO = new Set(['logistics', 'professional', 'realestate', 'homecare', 'staffing']);

/** Parts of each city. A visit searches one of them, so the same pair reaches businesses the city-wide search never shows. */
export const AREAS: Record<string, string[]> = {
  lagos: ['Lekki', 'Victoria Island', 'Ikoyi', 'Ikeja', 'Yaba', 'Surulere', 'Ajah', 'Gbagada', 'Apapa', 'Festac', 'Magodo', 'Isolo', 'Ogba', 'Ilupeju', 'Maryland'],
  london: ['Peckham', 'Woolwich', 'Croydon', 'Barking', 'Tottenham', 'Lewisham', 'Hackney', 'Enfield', 'Thamesmead', 'Stratford'],
  manchester: ['Salford', 'Moss Side', 'Cheetham Hill', 'Oldham', 'Bolton', 'Stockport'],
  birmingham: ['Handsworth', 'Erdington', 'Wolverhampton', 'Coventry', 'Walsall'],
  houston: ['Southwest Houston', 'Katy', 'Sugar Land', 'Missouri City', 'Richmond', 'Pearland'],
  dallas: ['Arlington', 'Irving', 'Garland', 'Plano', 'Grand Prairie'],
  atlanta: ['Marietta', 'Lawrenceville', 'Stone Mountain', 'Decatur', 'Norcross', 'Duluth'],
  'new york': ['Bronx', 'Brooklyn', 'Queens', 'Newark'],
  'washington dc': ['Silver Spring', 'Bowie', 'Laurel', 'Hyattsville', 'Baltimore'],
  toronto: ['Brampton', 'Mississauga', 'Scarborough', 'Etobicoke', 'North York', 'Ajax'],
  calgary: ['Northeast Calgary', 'Airdrie', 'Edmonton'],
  dublin: ['Blanchardstown', 'Tallaght', 'Swords', 'Lucan'],
};

export const DEFAULT_AUTO: AutoConfig = {
  enabled: false,
  // Businesses that typically clear about $10k a month and run on processes a web app can take over.
  niches: ['hospitality', 'shortlet', 'realestate', 'school', 'clinic', 'fertility', 'lab', 'dental', 'logistics', 'travel', 'studyabroad',
    'events', 'autodealer', 'solar', 'microfinance', 'insurance', 'professional', 'homecare'],
  cities: ['Lagos', 'London', 'Manchester', 'Birmingham', 'Houston', 'Dallas', 'Atlanta', 'New York', 'Washington DC', 'Toronto', 'Calgary', 'Dublin'],
  dailyCap: 12, minScore: 65, whatsappShare: 20,
};
export { LAGOS_AND_ABROAD };

export async function getAuto(env: Bindings): Promise<AutoConfig> {
  try { return { ...DEFAULT_AUTO, ...JSON.parse(await getSetting(env.DB, 'autoprospect', '{}')) }; } catch { return { ...DEFAULT_AUTO }; }
}
export const saveAuto = (env: Bindings, cfg: AutoConfig, by: string) => setSetting(env.DB, 'autoprospect', JSON.stringify(cfg), by);

const nicheKey = (n: string) => (NICHE_QUERY[n] ? n : n.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 40));

type Pair = readonly [niche: string, city: string];
/** Which niche × city pairs are worth searching, split so Lagos and abroad can take turns. */
export function pairsOf(cfg: Pick<AutoConfig, 'niches' | 'cities'>): { ng: Pair[]; abroad: Pair[] } {
  const ng: Pair[] = [], abroad: Pair[] = [];
  for (const n of cfg.niches) for (const c of cfg.cities) {
    if (isNigerian(c)) { if (!ABROAD_ONLY.has(n)) ng.push([n, c]); }
    // Abroad: only niches with a diaspora-facing query, or one the team typed in by hand.
    else if (ABROAD_AUTO.has(n) || !NICHE_QUERY[n]) abroad.push([n, c]);
  }
  return { ng, abroad };
}
/** The pair for step `s`: even steps Lagos, odd steps abroad (whichever exists). */
const pairAt = (p: { ng: Pair[]; abroad: Pair[] }, s: number): Pair | null => {
  const lists = [p.ng, p.abroad].filter((l) => l.length);
  if (!lists.length) return null;
  const list = lists[s % lists.length];
  return list[Math.floor(s / lists.length) % list.length];
};

/** The words for visit number `visit` to a pair: walks every area × wording combination before repeating. */
export function searchFor(niche: string, city: string, visit: number): { query: string; area: string } {
  const nigeria = isNigerian(city);
  const abroadWords = !nigeria && ABROAD_QUERY[niche];
  const phrases = abroadWords ? [abroadWords, ...(ABROAD_VARIANTS[niche] ?? [])] : [NICHE_QUERY[niche] ?? niche, ...(NICHE_VARIANTS[niche] ?? [])];
  const areas = ['', ...(AREAS[city.trim().toLowerCase()] ?? [])];
  const k = ((visit % (areas.length * phrases.length)) + areas.length * phrases.length) % (areas.length * phrases.length);
  const ai = k % areas.length;
  const phrase = phrases[(ai + Math.floor(k / areas.length)) % phrases.length];
  const area = areas[ai];
  const country = countryOf(city);
  return { area, query: area ? `${phrase} in ${area}, ${city.trim()}${country ? `, ${country}` : ''}` : placeQuery(phrase, city) };
}

/** Searches allowed today: what is left of the month's free Google Maps allowance, spread over the days left
 *  (a tenth is kept back for searches made by hand in Studio). */
export async function searchAllowance(env: Bindings, now = new Date()) {
  const b = await mapsBudget(env);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  return { perDay: Math.max(0, Math.min(60, Math.floor((b.left * 0.9) / daysLeft))), left: b.left, limit: b.limit };
}

export async function runAutoProspect(env: Bindings, opts: { force?: boolean; by?: string } = {}) {
  const cfg = await getAuto(env);
  if (!opts.force && !cfg.enabled) return { skipped: 'off' };
  if (!env.GOOGLE_MAPS_API_KEY) return { skipped: 'no GOOGLE_MAPS_API_KEY' };
  const pairs = pairsOf(cfg);
  if (!pairs.ng.length && !pairs.abroad.length) return { skipped: 'no niches or cities' };

  const today = new Date().toISOString().slice(0, 10);
  const counts = await first<{ n: number; wa: number }>(env.DB,
    "SELECT COUNT(*) AS n, SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) AS wa FROM leads WHERE found_by = 'auto' AND created = ?", today);
  const room = Math.max(0, cfg.dailyCap - (counts?.n ?? 0));
  const waRoom = Math.max(0, Math.floor((cfg.dailyCap * (cfg.whatsappShare ?? 20)) / 100) - (counts?.wa ?? 0));
  if (!room && !opts.force) return { skipped: 'daily cap reached' };
  // Stay inside the month's free Google Maps allowance: a fixed number of searches a day.
  const day = cfg.day?.date === today ? cfg.day : { date: today, searches: 0 };
  if (!opts.force) {
    const allow = await searchAllowance(env);
    if (day.searches >= allow.perDay) return { skipped: allow.left ? 'today\'s searches are used' : 'Google Maps allowance for the month is used' };
  }
  // Next pair that has not been searched today (a pair is searched at most once a day unless forced).
  let step = cfg.cursor ?? 0, pair: Pair | null = null, doneKey = '';
  for (let tries = 0; tries < 8; tries++, step++) {
    const p = pairAt(pairs, step); if (!p) break;
    doneKey = `autoprospect:${today}:${p[0]}:${p[1]}`;
    if (opts.force || !(await env.CACHE.get(doneKey))) { pair = p; step++; break; }
  }
  cfg.cursor = step % 1_000_000;
  if (!pair) { await saveAuto(env, cfg, 'autopilot'); return { skipped: 'pairs already searched today' }; }
  const [niche, city] = pair;
  const vKey = `${niche}|${city}`;
  const visit = (cfg.visits?.[vKey] ?? 0) + 1; // visit 0 is the plain city-wide search the autopilot used before
  cfg.visits = { ...(cfg.visits ?? {}), [vKey]: visit };
  cfg.day = { date: today, searches: day.searches + 1 };

  const nigeria = isNigerian(city);
  const { query } = searchFor(niche, city, visit);
  let added = 0, seen = 0, freshN = 0, emails = 0, waAdded = 0, error: string | undefined;
  const pushed: Record<string, unknown>[] = [];
  try {
    const { results } = await searchPlaces(env, query);
    seen = results.length;
    const known = new Set((await all<{ maps_place_id: string }>(env.DB, 'SELECT maps_place_id FROM leads WHERE maps_place_id IS NOT NULL')).map((x) => x.maps_place_id));
    // Not a fit: branches of chains and franchises, national brands (they can't or won't buy from an agency).
    const fresh = results.filter((x) => !known.has(x.place_id) && (!x.status || x.status === 'OPERATIONAL') && !x.skip);
    freshN = fresh.length;
    await enrichProspects(fresh, 20);
    const domainOf = (u?: string | null) => { try { return new URL(u!).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
    const knownDomains = new Set((await all<{ website: string }>(env.DB, "SELECT website FROM leads WHERE website IS NOT NULL AND website <> ''")).map((x) => domainOf(x.website)).filter(Boolean));
    const limit = Math.max(room, opts.force ? 10 : 0);
    for (const x of fresh) {
      if (added >= limit) break;
      const email = x.emails?.[0];
      if (email) emails++;
      // Quality gate (19 Nov 2026): only businesses whose website is missing, broken, dated or weak. A well-built
      // site is skipped even if it has no portal. Abroad also needs a second thing to point to, because a business
      // with a decent site has little reason to hire an agency in another country.
      const needs = x.needs ?? [];
      // Only businesses that can't do without a website (or without automating customer chats).
      const key0 = nicheKey(niche);
      if (!CORE_WHY[key0]) continue;
      const badSite = (x.siteIssues ?? []).length > 0;
      // AI track: customers are handled by hand at volume (busy: 60+ reviews) and nothing answers for them.
      const aiNeed = (x.aiSignals ?? []).length > 0 && (x.reviews ?? 0) >= 60 && !!AI_PITCH[key0];
      if (!badSite && !aiNeed) continue;
      if (aiNeed) for (const g of x.aiSignals ?? []) if (!needs.includes(g)) { needs.push(g); x.reasons.unshift(g); x.score = Math.min(100, x.score + 8); }
      // Web-app fit: where this niche runs on a portal, a missing one is extra detail for the message.
      const key = nicheKey(niche);
      if (WEBAPP_PITCH[key]) for (const g of x.appGaps ?? []) if (!needs.includes(g)) { needs.push(g); x.reasons.unshift(g); x.score = Math.min(100, x.score + 6); }
      if (needs.length < (nigeria ? 1 : 2)) continue;
      // Size: only businesses big enough to pay for a web app.
      if (!bigEnough(key, x.reviews)) continue;
      if (x.score < cfg.minScore) continue;
      // Phone-only leads must be established enough to be worth a personal WhatsApp.
      if (!email && (x.reviews ?? 0) < 15) continue;
      // One lead per company: a second listing on a domain we already have is a branch.
      const dom = domainOf(x.website);
      if (dom && knownDomains.has(dom)) continue;
      if (dom) knownDomains.add(dom);
      // Email first: phone-only only in Nigeria, within the WhatsApp share; abroad needs an email.
      if (!email && (!nigeria || !x.phone || waAdded >= waRoom)) continue;
      if (await first(env.DB, 'SELECT id FROM leads WHERE company = ? AND city = ?', x.name, city)) continue;
      if (email && (await first(env.DB, 'SELECT id FROM leads WHERE lower(email) = ?', email))) continue;
      const tier = x.score >= 80 && needs.length >= 2 && (x.reviews ?? 0) >= 40 ? 'A' : 'B'; // no Tier C: below the minimum score is not added
      const id = newId('L-');
      const gaps = [...x.reasons.filter((r) => r !== 'Email published on their site'), `Website is core: ${CORE_WHY[key]}`].join('; ');
      const pitch = !badSite && aiNeed ? `AI automation: ${AI_PITCH[key]}` : (WEBAPP_PITCH[key] ?? '');
      const source = `Autopilot · Google Maps · ${query}`;
      await run(env.DB,
        `INSERT INTO leads (id, created, niche, company, website, email, phone, city, country, tier, score, gaps, pitch, status, source, origin, found_by, maps_place_id, rating, notes, next_action, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 'maps', 'auto', ?, ?, ?, ?, 'Autopilot')`,
        id, today, key, x.name.slice(0, 160), x.website ?? null, email ?? null, x.phone ?? null, city, countryOf(city) ?? 'Nigeria', tier, x.score,
        gaps, pitch || null, source, x.place_id, x.rating ?? null,
        [x.address, x.maps_url, x.emails && x.emails.length > 1 ? `Other emails on site: ${x.emails.slice(1).join(', ')}` : ''].filter(Boolean).join('\n'),
        email ? 'Email sequence: written by the morning routine, sent by LeadsHunter' : 'Send a WhatsApp intro');
      if (email) pushed.push({ id, company: x.name.slice(0, 160), website: x.website ?? '', email, phone: x.phone ?? '', city, niche: key, tier, score: x.score, gaps, pitch, source, notes: x.address });
      else waAdded++;
      added++;
    }
    await env.CACHE.put(doneKey, '1', { expirationTtl: 60 * 60 * 26 });
  } catch (e: any) { error = String(e?.message ?? e).slice(0, 300); }
  if (pushed.length) await pushToEngine(env, pushed);
  cfg.lastRun = { at: new Date().toISOString(), query, added, seen, fresh: freshN, emails, ...(error ? { error } : {}) };
  await saveAuto(env, cfg, opts.by ?? 'autopilot');
  return { query, added, seen, fresh: freshN, emails, error };
}

/** Hands email leads to LeadsHunter (the morning routine writes their emails). Best effort: if the
 *  engine is down they are retried by pushPendingToEngine on a later cron. */
async function pushToEngine(env: Bindings, leads: Record<string, unknown>[]) {
  if (!engineConfigured(env) || !leads.length) return false;
  try {
    await engineCall(env, 'dashAction', ['addLeads', { leads }]);
    await env.DB.batch(leads.map((l) => env.DB.prepare("UPDATE leads SET synced_at = datetime('now') WHERE id = ?").bind(l.id)));
    return true;
  } catch (e) { console.warn('push autopilot leads to engine', e); return false; }
}

export async function pushPendingToEngine(env: Bindings) {
  const rows = await all<any>(env.DB, `SELECT id, company, website, email, phone, city, niche, tier, score, gaps, pitch, source, notes FROM leads
    WHERE found_by = 'auto' AND email IS NOT NULL AND email <> '' AND synced_at IS NULL AND created >= date('now','-7 day') LIMIT 50`).catch(() => []);
  if (rows.length) await pushToEngine(env, rows.map((r) => ({ ...r, notes: r.notes ?? '' })));
}
