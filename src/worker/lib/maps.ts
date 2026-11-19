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
  appGaps?: string[];
  /** Problems that show the website itself is missing, broken, dated or weak. A business with none of these
   *  has a well-built site and is skipped (Michael, 19 Nov 2026: don't approach businesses whose site is built well). */
  siteIssues?: string[];        // web-app signals from their site (no portal, PDF forms)
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
  lagos: 'Nigeria', abuja: 'Nigeria', 'port harcourt': 'Nigeria', ibadan: 'Nigeria', lekki: 'Nigeria', ikeja: 'Nigeria', 'victoria island': 'Nigeria', ikoyi: 'Nigeria', yaba: 'Nigeria', surulere: 'Nigeria',
  london: 'UK', manchester: 'UK', birmingham: 'UK', leeds: 'UK', liverpool: 'UK', glasgow: 'UK', edinburgh: 'UK', bristol: 'UK',
  houston: 'USA', atlanta: 'USA', dallas: 'USA', 'new york': 'USA', chicago: 'USA', 'washington dc': 'USA', maryland: 'USA', miami: 'USA', 'los angeles': 'USA',
  toronto: 'Canada', calgary: 'Canada', vancouver: 'Canada', ottawa: 'Canada',
  dubai: 'UAE', dublin: 'Ireland', amsterdam: 'Netherlands', accra: 'Ghana', nairobi: 'Kenya', johannesburg: 'South Africa',
};
export const LAGOS_AND_ABROAD = ['Lagos', 'London', 'Manchester', 'Birmingham', 'Houston', 'Dallas', 'Atlanta', 'New York', 'Washington DC', 'Toronto', 'Calgary', 'Dublin', 'Dubai'];
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
    const siteIssues: string[] = [];
    if (!p.websiteUri) { score += 18; needs.push('No website listed on Google'); siteIssues.push('No website listed on Google'); }
    else if (social) { score += 20; needs.push('Website is a social or free-builder page'); siteIssues.push('Website is a social or free-builder page'); }
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
      score: skip ? Math.min(20, score) : Math.max(0, Math.min(100, score)), reasons: [...(skip ? [`Not a fit: ${skip}`] : []), ...needs, ...reasons], needs, siteIssues, skip,
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

/** Cloudflare's email obfuscation (very common on Nigerian business sites): hex key + XOR'd bytes. */
function cfDecode(hex: string): string {
  try {
    const key = parseInt(hex.slice(0, 2), 16); let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch { return ''; }
}
export function emailsIn(html: string) {
  const cf = [...html.matchAll(/data-cfemail=["']([0-9a-f]{6,})["']|\/cdn-cgi\/l\/email-protection#([0-9a-f]{6,})/gi)].map((m) => cfDecode(m[1] || m[2])).join(' ');
  html = (html + ' ' + cf).replace(/&#(\d{2,3});/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]{2});/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const text = html.replace(/&#64;|&#x40;|\s*\[\s*at\s*\]\s*|\s+\(at\)\s+/gi, '@').replace(/&#46;|\s*\[\s*dot\s*\]\s*/gi, '.');
  const found = new Set<string>();
  for (const m of text.matchAll(/mailto:([^"'?<>]+)/gi)) { try { found.add(decodeURIComponent(m[1]).toLowerCase()); } catch { found.add(m[1].toLowerCase()); } }
  for (const m of text.matchAll(/[a-z0-9][a-z0-9._%+-]{0,60}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,10}/gi)) found.add(m[0].toLowerCase());
  return [...found].map((e) => e.replace(/\s+/g, '').replace(/[.,;:]+$/, '').replace(/^mailto:/, ''))
    .filter((e) => e.length < 80 && /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,10}$/.test(e) && !JUNK_MAIL.test(e));
}

/** Visits a business's own website (home page + its contact page) and returns the business emails it
 *  publishes plus gaps we can point to in a first email. Never guesses an address. */
export async function readWebsite(url: string, ms = 5000): Promise<{ emails: string[]; gaps: string[]; strong: string[]; app: string[]; reached: boolean }> {
  const home = await getText(url, ms);
  if (!home) return { emails: [], gaps: [], strong: [], app: [], reached: false };
  const site = host(home.finalUrl);
  const hrefs = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  // Up to two more pages from their own site: the contact page first, then about/team (where named decision-makers are).
  const sameSite = (h: string) => { try { const u = new URL(h, home.finalUrl); return host(u.href) === site ? u.href.split('#')[0] : null; } catch { return null; } };
  const pick = (re: RegExp) => hrefs.filter((h) => re.test(h) && !/mailto:|tel:|wa\.me|whatsapp|\.(pdf|jpe?g|png|docx?)$/i.test(h)).map(sameSite).find(Boolean) ?? null;
  const homeEmails = emailsIn(home.html);
  let pages = [pick(/contact|get-in-touch|reach-us|enquir/i), pick(/about|team|leadership|management|who-we-are|our-people/i)].filter((x): x is string => !!x && x !== home.finalUrl);
  if (!pages.length && !homeEmails.length) pages = ['/contact', '/contact-us'].map((p) => new URL(p, home.finalUrl).href);
  const extra = (await Promise.all([...new Set(pages)].slice(0, 2).map((u) => getText(u, ms)))).filter((x): x is { html: string; finalUrl: string } => !!x);
  const contact = extra.length ? { html: extra.map((x) => x.html).join('\n') } : null;
  const all = [...homeEmails, ...(contact ? emailsIn(contact.html) : [])];
  const rank = (e: string) => (host('https://' + e.split('@')[1]) === site ? 0 : FREE_MAIL.test(e) ? 2 : 1) * 10 + (/^(info|hello|contact|enquir|admin|office|sales|admissions|bookings?)@/.test(e) ? 0 : 1);
  const emails = [...new Set(all)].filter((e) => !host('https://' + e.split('@')[1]).match(/^(sentry|wix|squarespace|shopify)/)).sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  const html = home.html + (contact?.html ?? '');
  // Strong = the site itself is missing, broken, dated or weak (enough on its own to approach them).
  // Soft = small things a well-built site can also have (used as extra detail, never as the reason).
  const strong: string[] = [];
  const soft: string[] = [];
  const plainHome = home.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = plainHome ? plainHome.split(' ').length : 0;
  if (!home.finalUrl.startsWith('https:')) strong.push('Site is not secure (browsers show “Not secure”)');
  if (!/<meta[^>]+name=["']viewport/i.test(home.html)) strong.push('Not built for phones (no mobile layout)');
  const shell = /<div[^>]+id=["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(home.html) || /You need to enable JavaScript to run this app/i.test(home.html);
  if (shell && words < 60) strong.push('Search engines see an empty page: the site is a JavaScript shell with no text in it');
  const desc = (home.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || home.html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description/i) || [])[1] ?? '';
  const defaultDesc = /web site created using create-react-app|just another wordpress site|^my (wordpress|wix) (blog|site)|generated by create next app|vite \+ react|powered by wix/i.exec(desc + ' ' + (home.html.match(/<title[^>]*>([^<]{0,160})/i)?.[1] ?? ''));
  if (defaultDesc) strong.push(`Google shows the template's default text: “${defaultDesc[0]}”`);
  else if (!desc || desc.length < 20) soft.push('No search description (Google shows random text)');
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)/gi)].map((m) => Number(m[1]));
  const year = new Date().getUTCFullYear();
  if (years.length && Math.max(...years) <= year - 2) strong.push(`Footer says © ${Math.max(...years)} (looks unmaintained)`);
  if (/lorem ipsum|coming soon|under construction|website is being updated|sample page|hello world!/i.test(html)) strong.push('Placeholder or “coming soon” text on the site');
  if (/wix\.com|wixstatic|weebly\.com|godaddy\.com\/websites|squarespace-cdn|sites\.google\.com/i.test(home.html) && /(created|built|made|powered)\s+(with|by|on)\s+(wix|weebly|godaddy|squarespace)/i.test(home.html)) strong.push('Free site-builder badge still showing');
  const oldTech = /<(font|marquee|center|frameset)[\s>]/i.test(home.html) ? 'old HTML tags' :
    /jquery[.-]?1\.\d+(\.\d+)?(\.min)?\.js/i.test(home.html) ? 'jQuery 1.x' :
    (/<meta[^>]+generator[^>]+WordPress ([1-4]\.|5\.[0-4]\b)/i.exec(home.html) ? 'an old WordPress version' :
    /<meta[^>]+generator[^>]+Joomla! ?(1\.|2\.|3\.)/i.test(home.html) ? 'an old Joomla version' : '');
  if (oldTech) strong.push(`Built on old technology (${oldTech}): slow, and harder to keep secure`);
  if (!shell && words < 120) strong.push('Very little on the home page (under 120 words), so visitors and Google learn almost nothing');
  if (/\b(casino|slot gacor|judi online|togel|viagra|cialis|payday loans?|essay writing service)\b/i.test(plainHome)) strong.push('Spam text injected into the page (the site looks hacked)');
  if (emails.length && emails.every((e) => FREE_MAIL.test(e))) soft.push('Uses a Gmail/Yahoo address on the site');
  const hasBooking = /calendly|acuityscheduling|simplybook|booksy|zocdoc|setmore|squareup\.com\/appointments|book(ing)?[-_ ]?(online|now|an? appointment)|schedule[-_ ]?(online|now|an? (appointment|visit|call|consultation))|request[-_ ]?(an? )?(appointment|quote|callback)/i.test(html);
  if (!/<form[\s>]/i.test(html) && !hasBooking) soft.push('No contact form or online booking');
  const title = home.html.match(/<title[^>]*>([^<]{0,160})/i)?.[1]?.trim() ?? '';
  if (!title || /^(home|home page|welcome|untitled|index|my site|just another wordpress site|react app)$/i.test(title)) strong.push(`Page title is ${title ? `just “${title}”` : 'missing'}, so Google can't tell what the business does`);
  const gaps = [...strong, ...soft];
  // Web-app signals: things their customers or staff still do by hand that a portal or app would handle.
  const app: string[] = [];
  const plain = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  if (!/log\s?-?in|sign\s?-?in|portal|my[-_ ]?account|dashboard|client[-_ ]?area|track(ing)?[-_ ]?(your|my|a|an)?[-_ ]?(shipment|order|parcel|cargo|application)|e-?learning|pay[-_ ]?(online|now|fees)|apply[-_ ]?(online|now)/i.test(plain)) app.push('No customer login, portal or online tracking');
  if (hrefs.some((h) => /\.(pdf|docx?)(\?|$)/i.test(h) && /form|applic|admission|registr|enrol|referral|order|quote/i.test(h))) app.push('Forms are documents to download and fill by hand');
  return { emails, gaps, strong, app, reached: true };
}

/** Adds published emails and website gaps to search results (top `limit` with a real website), then re-scores. */
export async function enrichProspects(results: Prospect[], limit = 20, concurrency = 7): Promise<Prospect[]> {
  const todo = results.filter((r) => !r.skip && r.website && !/facebook|instagram|linktr|wa\.me/i.test(r.website)).slice(0, limit);
  for (let i = 0; i < todo.length; i += concurrency) {
    await Promise.all(todo.slice(i, i + concurrency).map(async (r) => {
      const w = await readWebsite(r.website!);
      r.emails = w.emails;
      r.appGaps = w.app;
      r.needs = r.needs ?? [];
      r.siteIssues = r.siteIssues ?? [];
      if (!w.reached) { r.needs.push('Website did not load'); r.siteIssues.push('Website did not load'); r.reasons.unshift('Website did not load'); r.score = Math.min(100, r.score + 14); return; }
      for (const g of w.gaps) { r.needs.push(g); r.reasons.unshift(g); }
      r.siteIssues.push(...w.strong);
      r.score = Math.max(0, Math.min(100, r.score + Math.min(36, w.strong.length * 14 + (w.gaps.length - w.strong.length) * 4) + (w.emails.length ? 12 : 0)));
    }));
  }
  for (const r of results) {
    r.channel = r.emails?.length ? 'email' : r.phone ? 'whatsapp' : 'none';
    if (r.channel === 'email') r.reasons.unshift('Email published on their site');
  }
  results.sort((a, b) => (a.channel === 'email' ? 0 : 1) - (b.channel === 'email' ? 0 : 1) || b.score - a.score);
  return results;
}
