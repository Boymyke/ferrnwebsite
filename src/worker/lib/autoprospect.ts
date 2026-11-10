/**
 * Autopilot prospecting: on the cron, search Google Maps for the configured niches × cities,
 * read each business's own website for a published email and visible gaps, score it, and add
 * the best new ones to Leads (found_by = 'auto'). One niche×city pair per run, so the
 * 10-minute cron spreads the work across the day.
 *
 * Email first: leads with a published business email fill the day. Phone-only (WhatsApp) leads
 * are allowed only in Nigeria and only up to `whatsappShare` % of the daily cap. Email leads are
 * handed to LeadsHunter, where the morning routine writes and queues their email sequence.
 */
import type { Bindings } from './env';
import { all, first, getSetting, newId, run, setSetting } from './db';
import { countryOf, enrichProspects, isNigerian, LAGOS_AND_ABROAD, placeQuery, searchPlaces } from './maps';
import { engineCall, engineConfigured } from './engine';

export type AutoConfig = {
  enabled: boolean;
  niches: string[];          // keys like 'clinic', 'school' or free text
  cities: string[];
  dailyCap: number;          // max leads added per day
  minScore: number;          // 0–100
  whatsappShare: number;     // max % of the daily cap that may be phone-only (Nigeria only)
  cursor?: number;           // which pair runs next
  lastRun?: { at: string; query: string; added: number; seen: number; emails?: number; error?: string };
};

export const NICHE_QUERY: Record<string, string> = {
  clinic: 'private hospitals and clinics', dental: 'dental clinics', eye: 'eye clinics', fertility: 'fertility clinics', physio: 'physiotherapy clinics',
  lab: 'diagnostic laboratories', school: 'private schools', logistics: 'logistics and freight companies', realestate: 'real estate developers and agencies',
  shortlet: 'shortlet apartments', hospitality: 'hotels', solar: 'solar installation companies', ngo: 'NGOs and associations',
  ecommerce: 'fashion and beauty stores', professional: 'law firms and accounting firms',
  homecare: 'home care agencies', cleaning: 'commercial cleaning companies', construction: 'construction companies', church: 'churches',
};

/* Abroad, Ferrn wins with owner-run businesses that serve the African diaspora or are run by it, not with
 * polished high-street brands. These queries replace the generic one outside Nigeria. */
export const ABROAD_QUERY: Record<string, string> = {
  logistics: 'cargo and shipping to Nigeria and Africa companies', professional: 'immigration law firms and accountants for small businesses',
  ecommerce: 'African and Caribbean food and beauty stores', church: 'African churches', hospitality: 'Nigerian and African restaurants',
  realestate: 'independent estate agents and property management companies', homecare: 'independent home care agencies',
};

export const DEFAULT_AUTO: AutoConfig = {
  enabled: false, niches: ['logistics', 'clinic', 'fertility', 'realestate', 'school', 'construction', 'professional', 'homecare'],
  cities: ['Lagos', 'London', 'Manchester', 'Houston', 'Atlanta', 'Toronto'], dailyCap: 12, minScore: 70, whatsappShare: 20,
};
export { LAGOS_AND_ABROAD };

export async function getAuto(env: Bindings): Promise<AutoConfig> {
  try { return { ...DEFAULT_AUTO, ...JSON.parse(await getSetting(env.DB, 'autoprospect', '{}')) }; } catch { return { ...DEFAULT_AUTO }; }
}
export const saveAuto = (env: Bindings, cfg: AutoConfig, by: string) => setSetting(env.DB, 'autoprospect', JSON.stringify(cfg), by);

const nicheKey = (n: string) => (NICHE_QUERY[n] ? n : n.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 40));

export async function runAutoProspect(env: Bindings, opts: { force?: boolean; by?: string } = {}) {
  const cfg = await getAuto(env);
  if (!opts.force && !cfg.enabled) return { skipped: 'off' };
  if (!env.GOOGLE_MAPS_API_KEY) return { skipped: 'no GOOGLE_MAPS_API_KEY' };
  const pairs = cfg.niches.flatMap((n) => cfg.cities.map((c) => [n, c] as const));
  if (!pairs.length) return { skipped: 'no niches or cities' };

  const today = new Date().toISOString().slice(0, 10);
  const counts = await first<{ n: number; wa: number }>(env.DB,
    "SELECT COUNT(*) AS n, SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) AS wa FROM leads WHERE found_by = 'auto' AND created = ?", today);
  const room = Math.max(0, cfg.dailyCap - (counts?.n ?? 0));
  const waRoom = Math.max(0, Math.floor((cfg.dailyCap * (cfg.whatsappShare ?? 20)) / 100) - (counts?.wa ?? 0));
  if (!room && !opts.force) return { skipped: 'daily cap reached' };
  // Each pair is searched at most once a day unless forced.
  const i = (cfg.cursor ?? 0) % pairs.length;
  const [niche, city] = pairs[i];
  cfg.cursor = (i + 1) % pairs.length;
  const doneKey = `autoprospect:${today}:${niche}:${city}`;
  if (!opts.force && (await env.CACHE.get(doneKey))) { await saveAuto(env, cfg, 'autopilot'); return { skipped: 'pair already searched today' }; }

  const nigeria = isNigerian(city);
  const query = placeQuery((!nigeria && ABROAD_QUERY[niche]) || NICHE_QUERY[niche] || niche, city);
  let added = 0, seen = 0, emails = 0, waAdded = 0, error: string | undefined;
  const pushed: Record<string, unknown>[] = [];
  try {
    const { results } = await searchPlaces(env, query);
    seen = results.length;
    const known = new Set((await all<{ maps_place_id: string }>(env.DB, 'SELECT maps_place_id FROM leads WHERE maps_place_id IS NOT NULL')).map((x) => x.maps_place_id));
    // Not a fit: branches of chains and franchises, national brands (they can't or won't buy from an agency).
    const fresh = results.filter((x) => !known.has(x.place_id) && (!x.status || x.status === 'OPERATIONAL') && !x.skip);
    await enrichProspects(fresh, 14);
    const domainOf = (u?: string | null) => { try { return new URL(u!).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
    const knownDomains = new Set((await all<{ website: string }>(env.DB, "SELECT website FROM leads WHERE website IS NOT NULL AND website <> ''")).map((x) => domainOf(x.website)).filter(Boolean));
    const limit = Math.max(room, opts.force ? 10 : 0);
    for (const x of fresh) {
      if (added >= limit) break;
      const email = x.emails?.[0];
      if (email) emails++;
      if (x.score < cfg.minScore) continue;
      // Quality gate: a real, visible gap we can point to (never just review counts). Abroad needs two,
      // because a business with a decent site has no reason to hire an agency in another country.
      const needs = x.needs ?? [];
      if (needs.length < (nigeria ? 1 : 2)) continue;
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
      const tier = x.score >= 82 && needs.length >= 2 && (x.reviews ?? 0) >= 40 ? 'A' : x.score >= 70 ? 'B' : 'C';
      const id = newId('L-');
      const gaps = x.reasons.filter((r) => r !== 'Email published on their site').join('; ');
      const source = `Autopilot · Google Maps · ${query}`;
      await run(env.DB,
        `INSERT INTO leads (id, created, niche, company, website, email, phone, city, country, tier, score, gaps, status, source, origin, found_by, maps_place_id, rating, notes, next_action, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 'maps', 'auto', ?, ?, ?, ?, 'Autopilot')`,
        id, today, nicheKey(niche), x.name.slice(0, 160), x.website ?? null, email ?? null, x.phone ?? null, city, countryOf(city) ?? 'Nigeria', tier, x.score,
        gaps, source, x.place_id, x.rating ?? null,
        [x.address, x.maps_url, x.emails && x.emails.length > 1 ? `Other emails on site: ${x.emails.slice(1).join(', ')}` : ''].filter(Boolean).join('\n'),
        email ? 'Email sequence: written by the morning routine, sent by LeadsHunter' : 'Send a WhatsApp intro');
      if (email) pushed.push({ id, company: x.name.slice(0, 160), website: x.website ?? '', email, phone: x.phone ?? '', city, niche: nicheKey(niche), tier, score: x.score, gaps, source, notes: x.address });
      else waAdded++;
      added++;
    }
    await env.CACHE.put(doneKey, '1', { expirationTtl: 60 * 60 * 26 });
  } catch (e: any) { error = String(e?.message ?? e).slice(0, 300); }
  if (pushed.length) await pushToEngine(env, pushed);
  cfg.lastRun = { at: new Date().toISOString(), query, added, seen, emails, ...(error ? { error } : {}) };
  await saveAuto(env, cfg, opts.by ?? 'autopilot');
  return { query, added, seen, emails, error };
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
  const rows = await all<any>(env.DB, `SELECT id, company, website, email, phone, city, niche, tier, score, gaps, source, notes FROM leads
    WHERE found_by = 'auto' AND email IS NOT NULL AND email <> '' AND synced_at IS NULL AND created >= date('now','-7 day') LIMIT 50`).catch(() => []);
  if (rows.length) await pushToEngine(env, rows.map((r) => ({ ...r, notes: r.notes ?? '' })));
}
