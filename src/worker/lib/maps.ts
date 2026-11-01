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
  /** Simple opportunity score: no website / weak reviews = more room for Ferrn. */
  score: number;
  reasons: string[];
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
    let score = 50;
    if (!p.websiteUri) { score += 30; reasons.push('No website listed on Google'); }
    else if (/facebook|instagram|linktr|wa\.me|business\.site|sites\.google/i.test(p.websiteUri)) { score += 20; reasons.push('Website is a social/free page'); }
    if ((p.userRatingCount ?? 0) < 15) { score += 8; reasons.push('Few Google reviews'); }
    if ((p.rating ?? 5) < 4) { score += 5; reasons.push('Rating under 4.0'); }
    if (p.userRatingCount > 100) { score += 7; reasons.push('Busy business (100+ reviews)'); }
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
