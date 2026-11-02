import type { Bindings } from './env';

export type Prospect = {
  place_id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  maps_url?: string;
  status?: string;
  /** Business emails published on their own website (contact page, footer, mailto links). */
  emails?: string[];
  /** 'email' when we found a published address, 'whatsapp' for phone-only, 'none' otherwise. */
  channel?: 'email' | 'whatsapp' | 'none';
  /** Opportunity score: weak web presence = more room for Ferrn; a published email makes it reachable. */
  score: number;
  reasons: string[];
};

/* ── where we prospect: Lagos plus abroad markets ── */
export const CITY_COUNTRY: Record<string, string> = {
  lagos: 'Nigeria', lekki: 'Nigeria', ikeja: 'Nigeria', 'victoria island': 'Nigeria', ikoyi: 'Nigeria', yaba: 'Nigeria', surulere: 'Nigeria',
  london: 'UK', manchester: 'UK', birmingham: 'UK', leeds: 'UK', liverpool: 'UK', glasgow: 'UK', edinburgh: 'UK', bristol: 'UK',
  houston: 'USA', atlanta: 'USA', dallas: 'USA', 'new york': 'USA', chicago: 'USA', 'washington dc': 'USA', maryland: 'USA', miami: 'USA', 'los angeles': 'USA',
  toronto: 'Canada', calgary: 'Canada', vancouver: 'Canada', ottawa: 'Canada',
  dubai: 'UAE', dublin: 'Ireland', amsterdam: 'Netherlands', accra: 'Ghana', nairobi: 'Kenya', johannesburg: 'South Africa',
};
export const LAGOS_AND_ABROAD = ['Lagos', 'London', 'Manchester', 'Birmingham', 'Houston', 'Atlanta', 'Dallas', 'New York', 'Toronto', 'Dubai'];
export const countryOf = (city: string): string | null => {
  const c = city.trim().toLowerCase();
  if (CITY_COUNTRY[c]) return CITY_COUNTRY[c];
  for (const part of c.split(/\s*,\s*/)) if (CITY_COUNTRY[part]) return CITY_COUNTRY[part];
  return /nigeria/.test(c) ? 'Nigeria' : /\b(uk|england|scotland)\b/.test(c) ? 'UK' : /\b(usa|us|texas|georgia)\b/.test(c) ? 'USA' : /canada|ontario/.test(c) ? 'Canada' : null;
};
export const isNigerian = (city: string) => countryOf(city) === 'Nigeria';
/** "dental clinics in London, UK" / "dental clinics in Lagos, Nigeria"; free-text cities pass through. */
export const placeQuery = (what: string, city: string) => {
  const c = city.trim(); const country = countryOf(c);
  return `${what} in ${c}${country && !c.toLowerCase().includes(country.toLowerCase()) ? `, ${country}` : ''}`;
};

/**
 * Google Maps prospecting via the Places API (New) Text Search.
 * Needs GOOGLE_MAPS_API_KEY with "Places API (New)" enabled. One call returns up to 20
 * businesses with phone, website and rating, which the Studio scores and lets you add as leads.
 */
export async function searchPlaces(env: Bindings, query: string, pageToken?: string): Promise<{ results: Prospect[]; next?: string }> {
  if (!env.GOOGLE_MAPS_API_KEY) throw new Error('Add a GOOGLE_MAPS_API_KEY secret to search Google Maps.');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
        'places.internationalPhoneNumber', 'places.websiteUri', 'places.rating', 'places.userRatingCount',
        'places.googleMapsUri', 'places.businessStatus', 'nextPageToken',
      ].join(','),
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });
  if (!res.ok) throw new Error(`Google Places error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  const results: Prospect[] = (data.places ?? []).map((p: any) => {
    const reasons: string[] = [];
    let score = 45;
    const social = p.websiteUri && /facebook|instagram|linktr|wa\.me|business\.site|sites\.google|wixsite|godaddysites/i.test(p.websiteUri);
    if (!p.websiteUri) { score += 20; reasons.push('No website listed on Google'); }
    else if (social) { score += 20; reasons.push('Website is a social/free page'); }
    if ((p.userRatingCount ?? 0) < 15) { score += 6; reasons.push('Few Google reviews'); }
    if ((p.rating ?? 5) < 4) { score += 4; reasons.push('Rating under 4.0'); }
    if (p.userRatingCount > 100) { score += 8; reasons.push('Busy business (100+ reviews)'); }
    return {
      place_id: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber, website: p.websiteUri, rating: p.rating,
      reviews: p.userRatingCount, maps_url: p.googleMapsUri, status: p.businessStatus,
      score: Math.min(100, score), reasons,
    };
  });
  results.sort((a, b) => b.score - a.score);
  return { results, next: data.nextPageToken };
}

/* ── reading their website: published emails + visible gaps ── */
const FREE_MAIL = /@(gmail|yahoo|ymail|hotmail|outlook|live|aol|icloud|protonmail)\./i;
const JUNK_MAIL = /(example\.|domain\.|yourdomain|email\.com$|sentry|wixpress|godaddy|cloudflare|\.(png|jpe?g|gif|svg|webp|css|js)$|@\dx\.|^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster)@|u00[0-9a-f]{2})/i;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

async function getText(url: string, ms: number): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: AbortSignal.timeout(ms),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FerrnLeadCheck/1.0; +https://www.ferrnagency.com)', accept: 'text/html,application/xhtml+xml' },
    });
    if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) return null;
    const reader = r.body?.getReader(); if (!reader) return null;
    const MAX = 450_000; const chunks: Uint8Array[] = []; let size = 0;
    while (size < MAX) { const { done, value } = await reader.read(); if (done || !value) break; chunks.push(value); size += value.length; }
    reader.cancel().catch(() => null);
    const buf = new Uint8Array(Math.min(size, MAX)); let o = 0;
    for (const c of chunks) { const n = Math.min(c.length, buf.length - o); if (n <= 0) break; buf.set(c.subarray(0, n), o); o += n; }
    return { html: new TextDecoder().decode(buf), finalUrl: r.url || url };
  } catch { return null; }
}

function emailsIn(html: string) {
  const text = html.replace(/&#64;|&#x40;|\s*\[\s*at\s*\]\s*|\s+\(at\)\s+/gi, '@').replace(/&#46;|\s*\[\s*dot\s*\]\s*/gi, '.');
  const found = new Set<string>();
  for (const m of text.matchAll(/mailto:([^"'?<>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.matchAll(/[a-z0-9][a-z0-9._%+-]{0,60}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,10}/gi)) found.add(m[0].toLowerCase());
  return [...found].map((e) => e.replace(/[.,;:]+$/, '')).filter((e) => e.length < 80 && !JUNK_MAIL.test(e));
}

/** Visits a business's own website (home page + its contact page) and returns the business emails it
 *  publishes plus gaps we can point to in a first email. Never guesses an address. */
export async function readWebsite(url: string, ms = 5000): Promise<{ emails: string[]; gaps: string[]; reached: boolean }> {
  const home = await getText(url, ms);
  if (!home) return { emails: [], gaps: [], reached: false };
  const site = host(home.finalUrl);
  const hrefs = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const contactHref = hrefs.find((h) => /contact|get-in-touch|reach-us|enquir|book/i.test(h) && !/mailto:|tel:|wa\.me|whatsapp/i.test(h));
  let contact: { html: string } | null = null;
  if (contactHref) { try { const u = new URL(contactHref, home.finalUrl); if (host(u.href) === site) contact = await getText(u.href, ms); } catch { /* bad link */ } }
  const all = [...emailsIn(home.html), ...(contact ? emailsIn(contact.html) : [])];
  const rank = (e: string) => (host('https://' + e.split('@')[1]) === site ? 0 : FREE_MAIL.test(e) ? 2 : 1) * 10 + (/^(info|hello|contact|enquir|admin|office|sales|admissions|bookings?)@/.test(e) ? 0 : 1);
  const emails = [...new Set(all)].filter((e) => !host('https://' + e.split('@')[1]).match(/^(sentry|wix|squarespace|shopify)/)).sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  const html = home.html + (contact?.html ?? '');
  const gaps: string[] = [];
  if (!home.finalUrl.startsWith('https:')) gaps.push('Site is not secure (no HTTPS)');
  if (!/<meta[^>]+name=["']viewport/i.test(home.html)) gaps.push('Not mobile-friendly (no viewport tag)');
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)/gi)].map((m) => Number(m[1]));
  const year = new Date().getUTCFullYear();
  if (years.length && Math.max(...years) <= year - 2) gaps.push(`Footer says © ${Math.max(...years)} (looks unmaintained)`);
  if (emails.length && emails.every((e) => FREE_MAIL.test(e))) gaps.push('Uses a Gmail/Yahoo address on the site');
  if (!/<form[\s>]/i.test(html)) gaps.push('No enquiry or booking form');
  return { emails, gaps, reached: true };
}

/** Adds published emails and website gaps to search results (top `limit` with a real website), then re-scores. */
export async function enrichProspects(results: Prospect[], limit = 12, concurrency = 6): Promise<Prospect[]> {
  const todo = results.filter((r) => r.website && !/facebook|instagram|linktr|wa\.me/i.test(r.website)).slice(0, limit);
  for (let i = 0; i < todo.length; i += concurrency) {
    await Promise.all(todo.slice(i, i + concurrency).map(async (r) => {
      const w = await readWebsite(r.website!);
      r.emails = w.emails;
      if (!w.reached) { r.reasons.push('Website did not load'); r.score = Math.min(100, r.score + 10); return; }
      for (const g of w.gaps) r.reasons.push(g);
      r.score = Math.min(100, r.score + Math.min(24, w.gaps.length * 8) + (w.emails.length ? 15 : 0));
    }));
  }
  for (const r of results) {
    r.channel = r.emails?.length ? 'email' : r.phone ? 'whatsapp' : 'none';
    if (r.channel === 'email') r.reasons.unshift('Email published on their site');
  }
  results.sort((a, b) => (a.channel === 'email' ? 0 : 1) - (b.channel === 'email' ? 0 : 1) || b.score - a.score);
  return results;
}
