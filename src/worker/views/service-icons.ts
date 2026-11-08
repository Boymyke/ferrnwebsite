/**
 * Geometric service icons for the home "What we build" boxes. Solid shapes with Ferrn orange
 * gradients (light #ffa36b → brand #F94406 → deep #8f2603), in the order of home.svc.items.
 * Each gets its own gradient ids so several can sit on one page.
 */
const g = (k: number) => `<defs>
  <linearGradient id="sv${k}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb07a"/><stop offset=".55" stop-color="#F94406"/><stop offset="1" stop-color="#c73603"/></linearGradient>
  <linearGradient id="sv${k}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F94406"/><stop offset="1" stop-color="#9c2b04"/></linearGradient>
  <linearGradient id="sv${k}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8360a"/><stop offset="1" stop-color="#5e1a03"/></linearGradient>
</defs>`;
const svg = (k: number, body: string) => `<svg class="svc-ic" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">${g(k)}${body}</svg>`;

export const SERVICE_ICONS: string[] = [
  // Websites: stacked pages
  svg(0, `
    <path class="l3" d="M14 58h50l-6 10H8z" fill="url(#sv0c)"/>
    <path class="l2" d="M14 42h50l-6 10H8z" fill="url(#sv0b)"/>
    <path class="l1" d="M14 26h50l-6 10H8z" fill="url(#sv0a)"/>
    <path class="l0" d="M20 10h50l-6 10H14z" fill="url(#sv0a)" opacity=".85"/>`),
  // Web apps: a dashboard grid that fades out
  svg(1, `
    <rect x="8" y="8" width="18" height="18" rx="3" fill="url(#sv1a)"/><rect x="31" y="8" width="18" height="18" rx="3" fill="url(#sv1a)"/><rect x="54" y="8" width="18" height="18" rx="3" fill="url(#sv1a)"/>
    <rect x="8" y="31" width="18" height="18" rx="3" fill="url(#sv1b)"/><rect x="31" y="31" width="18" height="18" rx="3" fill="url(#sv1b)"/><rect x="56" y="33" width="12" height="12" rx="2.5" fill="url(#sv1c)"/>
    <rect x="8" y="54" width="18" height="18" rx="3" fill="url(#sv1b)"/><rect x="33" y="56" width="12" height="12" rx="2.5" fill="url(#sv1c)"/><rect x="58" y="58" width="9" height="9" rx="2" fill="url(#sv1c)" opacity=".8"/>`),
  // AI assistants: a small network of nodes
  svg(2, `
    <path d="M16 16 40 40 64 64M40 40l24-24M40 40 16 64M16 16h24M40 64h24" stroke="url(#sv2b)" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="16" cy="16" r="8" fill="url(#sv2a)"/><circle cx="40" cy="16" r="8" fill="url(#sv2b)"/><circle cx="64" cy="16" r="8" fill="url(#sv2c)"/>
    <circle cx="16" cy="40" r="8" fill="url(#sv2c)"/><circle cx="40" cy="40" r="9" fill="url(#sv2a)"/><circle cx="64" cy="40" r="8" fill="url(#sv2c)"/>
    <circle cx="16" cy="64" r="8" fill="url(#sv2b)"/><circle cx="40" cy="64" r="8" fill="url(#sv2a)"/><circle cx="64" cy="64" r="8" fill="url(#sv2b)"/>`),
  // Automation: a looping S, things that run on their own
  svg(3, `
    <path d="M60 18H30a12 12 0 0 0 0 24h20a12 12 0 0 1 0 24H18" stroke="url(#sv3c)" stroke-width="12" stroke-linecap="round" fill="none" transform="translate(2 2)"/>
    <path d="M60 18H30a12 12 0 0 0 0 24h20a12 12 0 0 1 0 24H18" stroke="url(#sv3a)" stroke-width="12" stroke-linecap="round" fill="none"/>`),
  // Payments: a tile with a coin and a tick
  svg(4, `
    <rect x="6" y="6" width="68" height="68" rx="14" fill="url(#sv4c)"/>
    <circle cx="40" cy="40" r="22" fill="url(#sv4a)"/>
    <path d="M30 40.5l7 7 13-14" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  // SEO and growth: diamonds moving forward
  svg(5, `
    <path d="M44 22 62 40 44 58 26 40z" fill="url(#sv5c)" transform="translate(12 0)"/>
    <path d="M44 22 62 40 44 58 26 40z" fill="url(#sv5b)" transform="translate(6 0)"/>
    <path d="M38 16 62 40 38 64 14 40z" fill="url(#sv5a)" transform="translate(-6 0)"/>`),
];
