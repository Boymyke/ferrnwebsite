/**
 * Autopilot prospecting: on the cron, search Google Maps for the configured niches × cities,
 * score each business, and add the best new ones to Leads (found_by = 'auto').
 * One niche×city pair per run, so a 10-minute cron spreads the work across the day.
 */
import type { Bindings } from './env';
import { all, first, getSetting, newId, run, setSetting } from './db';
import { searchPlaces } from './maps';

export type AutoConfig = {
  enabled: boolean;
  niches: string[];          // keys like 'clinic', 'school' or free text
  cities: string[];
  dailyCap: number;          // max leads added per day
  minScore: number;          // 0–100
  cursor?: number;           // which pair runs next
  lastRun?: { at: string; query: string; added: number; seen: number; error?: string };
};

export const NICHE_QUERY: Record<string, string> = {
  clinic: 'private hospitals and clinics', dental: 'dental clinics', eye: 'eye clinics', fertility: 'fertility clinics', physio: 'physiotherapy clinics',
  lab: 'diagnostic laboratories', school: 'private schools', logistics: 'logistics and freight companies', realestate: 'real estate developers and agencies',
  shortlet: 'shortlet apartments', hospitality: 'hotels', solar: 'solar installation companies', ngo: 'NGOs and associations',
  ecommerce: 'fashion and beauty stores', professional: 'law firms and accounting firms',
};

export const DEFAULT_AUTO: AutoConfig = {
  enabled: false, niches: ['dental', 'fertility', 'realestate', 'shortlet'], cities: ['Lagos', 'Abuja', 'Port Harcourt'], dailyCap: 25, minScore: 70,
};

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
  const addedToday = (await first<{ n: number }>(env.DB, "SELECT COUNT(*) AS n FROM leads WHERE found_by = 'auto' AND created = ?", today))?.n ?? 0;
  const room = Math.max(0, cfg.dailyCap - addedToday);
  if (!room && !opts.force) return { skipped: 'daily cap reached' };
  // Each pair is searched at most once a day unless forced.
  const i = (cfg.cursor ?? 0) % pairs.length;
  const [niche, city] = pairs[i];
  cfg.cursor = (i + 1) % pairs.length;
  const doneKey = `autoprospect:${today}:${niche}:${city}`;
  if (!opts.force && (await env.CACHE.get(doneKey))) { await saveAuto(env, cfg, 'autopilot'); return { skipped: 'pair already searched today' }; }

  const query = `${NICHE_QUERY[niche] ?? niche} in ${city}${/london|houston|toronto|accra|nairobi/i.test(city) ? '' : ', Nigeria'}`;
  let added = 0, seen = 0, error: string | undefined;
  try {
    const { results } = await searchPlaces(env, query);
    seen = results.length;
    const known = new Set((await all<{ maps_place_id: string }>(env.DB, 'SELECT maps_place_id FROM leads WHERE maps_place_id IS NOT NULL')).map((x) => x.maps_place_id));
    for (const x of results) {
      if (added >= Math.max(room, opts.force ? 10 : 0)) break;
      if (x.score < cfg.minScore || known.has(x.place_id) || (x.status && x.status !== 'OPERATIONAL')) continue;
      if (await first(env.DB, 'SELECT id FROM leads WHERE company = ? AND city = ?', x.name, city)) continue;
      const tier = x.score >= 80 ? 'A' : x.score >= 65 ? 'B' : 'C';
      await run(env.DB,
        `INSERT INTO leads (id, created, niche, company, website, phone, city, tier, score, gaps, status, source, origin, found_by, maps_place_id, rating, notes, next_action, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, 'maps', 'auto', ?, ?, ?, ?, 'Autopilot')`,
        newId('L-'), today, nicheKey(niche), x.name.slice(0, 160), x.website ?? null, x.phone ?? null, city, tier, x.score,
        x.reasons.join('; '), `Autopilot · Google Maps · ${query}`, x.place_id, x.rating ?? null,
        [x.address, x.maps_url].filter(Boolean).join('\n'), x.phone ? 'Send a WhatsApp intro with a concept preview' : 'Find an email or Instagram handle');
      added++;
    }
    await env.CACHE.put(doneKey, '1', { expirationTtl: 60 * 60 * 26 });
  } catch (e: any) { error = String(e?.message ?? e).slice(0, 300); }
  cfg.lastRun = { at: new Date().toISOString(), query, added, seen, ...(error ? { error } : {}) };
  await saveAuto(env, cfg, opts.by ?? 'autopilot');
  return { query, added, seen, error };
}
