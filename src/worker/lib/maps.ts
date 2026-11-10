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
  /** Fit score: can they pay (established, busy) + do they need us (real, visible gaps) + can we reach them. */
  score: number;
  reasons: string[];
  /** Gaps we can point to in a first message (website problems only, never review counts). */
  needs?: string[];
  /** Why this business is not a fit (branch of a chain, too big, too small). Never added as a lead. */
  skip?: string;
};

/* ── who is NOT a client for Ferrn ──
 * Branches of chains and franchises can't buy a website (head office owns it), and national brands
 * have in-house teams. Both waste outreach, so they are filtered before anything is scored. */
const CHAIN_DOMAINS = /(^|\.)(homewatchcaregivers|synergyhomecare|bluebirdcare|homeinstead|visitingangels|rightathome|comfortkeepers|brightstarcare|seniorhelpers|helpinghands|caremark|radfieldhomecare|mydentist|bupa|bupadental|aspendental|heartland|pacificdentalservices|smiledirectclub|dentalcorp|portmandental|rodericksdental|colosseumdental|kindredhealthcare|remax|kw|kellerwilliams|century21|coldwellbanker|compass|sothebysrealty|savills|knightfrank|foxtons|purplebricks|zillow|rightmove|redfin|royallepage|marriott|hilton|airbnb|booking|sonder|blueground|dhl|fedex|ups|maersk|kuehne-nagel|dbschenker|gig-logistics|deloitte|pwc|kpmg|ey|hrblock|libertytax|jacksonhewitt|nhs|spirehealthcare|nuffieldhealth|hcahealthcare|care\.com|google|facebook|instagram|linktr|yelp|yell)\.[a-z.]{2,8}$/i;
export function chainReason(name: string, website?: string): string | null {
  if (website) {
    let u: URL | null = null;
    try { u = new URL(website); } catch { /* not a URL */ }
    if (u) {
      const h = u.hostname.replace(/^www\./, '').toLowerCase();
      if (CHAIN_DOMAINS.test(h)) return 'Branch of a chain or franchise';
      // "brand.com/houston-galleria/" style franchise pages: a location slug on a shared domain, with a "Brand of Place" name.
      if (u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).length >= 1 && /\b(of|in)\s+[A-Z][\w .&-]{2,}$/.test(name.trim()) && !/index|home/i.test(u.pathname)) return 'Location page of a franchise';
    }
  }
  if (/\b(franchise|franchisee)\b/i.test(name)) return 'Franchise';
  return null;
}

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
/** Google gives 1,000 free Text Search (Enterprise fields: phone + website) calls a month, then $35 per 1,000.
 *  We stop at a monthly ceiling (setting maps.monthly_limit, default 900) so lead finding never produces a bill. */
export async function mapsBudget(env: Bindings) {
  const month = new Date().toISOString().slice(0, 7);
  const used = Number((await env.CACHE.get(`maps:calls:${month}`)) ?? 0);
  const limitRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'maps.monthly_limit'").first<{ value: string }>().catch(() => null);
  const limit = Math.max(0, Number(limitRow?.value ?? 900) || 900);
  return { month, used, limit, left: Math.max(0, limit - used) };
}
export async function searchPlaces(env: Bindings, query: string, pageToken?: string): Promise<{ results: Prospect[]; next?: string }> {
  if (!env.GOOGLE_MAPS_API_KEY) throw new Error('Add a GOOGLE_MAPS_API_KEY secret to search Google Maps.');
  const b = await mapsBudget(env);
  if (b.used >= b.limit) throw new Error(`Google Maps budget for ${b.month} reached (${b.limit} free searches). It resets next month, or raise maps.monthly_limit in Settings.`);
  await env.CACHE.put(`maps:calls:${b.month}`, String(b.used + 1), { expirationTtl: 60 * 60 * 24 * 62 });
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
    const reasons: string[] = []; const needs: string[] = [];
    const n = p.userRatingCount ?? 0;
    let score = 30;
    const social = p.websiteUri && /facebook|instagram|linktr|wa\.me|business\.site|sites\.google|wixsite|godaddysites|weebly|wordpress\.com|blogspot/i.test(p.websiteUri);
    // Need: what is visibly wrong with how they show up online.
    if (!p.websiteUri) { score += 18; needs.push('No website listed on Google'); }
    else if (social) { score += 20; needs.push('Website is a social or free-builder page'); }
    // Budget: an established, busy business can pay for a proper build. Tiny or brand-new ones rarely can.
    if (n >= 150) { score += 16; reasons.push(`Established (${n} Google reviews)`); }
    else if (n >= 40) { score += 10; reasons.push(`Active business (${n} Google reviews)`); }
    else if (n < 10) { score -= 10; reasons.push('Very few Google reviews (small or new)'); }
    if ((p.rating ?? 5) < 3.6 && n >= 20) { score -= 6; reasons.push('Low rating'); }
    let skip = chainReason(p.displayName?.text ?? '', p.websiteUri) ?? undefined;
    if (!skip && n > 4000) skip = 'Too large (national brand)';
    return {
      place_id: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber, website: p.websiteUri, rating: p.rating,
      reviews: p.userRatingCount, maps_url: p.googleMapsUri, status: p.businessStatus,
      score: skip ? Math.min(20, score) : Math.max(0, Math.min(100, score)), reasons: [...(skip ? [`Not a fit: ${skip}`] : []), ...needs, ...reasons], needs, skip,
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
  for (const m of text.matchAll(/mailto:([^"'?<>]+)/gi)) { try { found.add(decodeURIComponent(m[1]).toLowerCase()); } catch { found.add(m[1].toLowerCase()); } }
  for (const m of text.matchAll(/[a-z0-9][a-z0-9._%+-]{0,60}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,10}/gi)) found.add(m[0].toLowerCase());
  return [...found].map((e) => e.replace(/\s+/g, '').replace(/[.,;:]+$/, '').replace(/^mailto:/, ''))
    .filter((e) => e.length < 80 && /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,10}$/.test(e) && !JUNK_MAIL.test(e));
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
  const hasBooking = /calendly|acuityscheduling|simplybook|booksy|zocdoc|setmore|squareup\.com\/appointments|book(ing)?[-_ ]?(online|now|an? appointment)|schedule[-_ ]?(online|now|an? (appointment|visit|call|consultation))|request[-_ ]?(an? )?(appointment|quote|callback)/i.test(html);
  if (!/<form[\s>]/i.test(html) && !hasBooking) gaps.push('No enquiry or booking form');
  const title = home.html.match(/<title[^>]*>([^<]{0,160})/i)?.[1]?.trim() ?? '';
  if (!title || /^(home|home page|welcome|untitled|index|my site|just another wordpress site)$/i.test(title)) gaps.push(`Page title is ${title ? `just “${title}”` : 'missing'} (hard to find on Google)`);
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(home.html) && !/<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']description/i.test(home.html)) gaps.push('No search description (Google shows random text)');
  if (/lorem ipsum|coming soon|under construction|website is being updated/i.test(html)) gaps.push('Placeholder or “coming soon” text on the site');
  if (/wix\.com|wixstatic|weebly\.com|godaddy\.com\/websites|squarespace-cdn|sites\.google\.com/i.test(home.html) && /(created|built|made|powered)\s+(with|by|on)\s+(wix|weebly|godaddy|squarespace)/i.test(home.html)) gaps.push('Free site-builder badge still showing');
  return { emails, gaps, reached: true };
}

/** Adds published emails and website gaps to search results (top `limit` with a real website), then re-scores. */
export async function enrichProspects(results: Prospect[], limit = 12, concurrency = 6): Promise<Prospect[]> {
  const todo = results.filter((r) => !r.skip && r.website && !/facebook|instagram|linktr|wa\.me/i.test(r.website)).slice(0, limit);
  for (let i = 0; i < todo.length; i += concurrency) {
    await Promise.all(todo.slice(i, i + concurrency).map(async (r) => {
      const w = await readWebsite(r.website!);
      r.emails = w.emails;
      r.needs = r.needs ?? [];
      if (!w.reached) { r.needs.push('Website did not load'); r.reasons.unshift('Website did not load'); r.score = Math.min(100, r.score + 14); return; }
      for (const g of w.gaps) { r.needs.push(g); r.reasons.unshift(g); }
      r.score = Math.max(0, Math.min(100, r.score + Math.min(36, w.gaps.length * 12) + (w.emails.length ? 12 : 0)));
    }));
  }
  for (const r of results) {
    r.channel = r.emails?.length ? 'email' : r.phone ? 'whatsapp' : 'none';
    if (r.channel === 'email') r.reasons.unshift('Email published on their site');
  }
  results.sort((a, b) => (a.channel === 'email' ? 0 : 1) - (b.channel === 'email' ? 0 : 1) || b.score - a.score);
  return results;
}
