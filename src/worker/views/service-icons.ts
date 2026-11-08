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
  // Websites: a browser window with a hero block and columns
  svg(0, `
    <rect x="6" y="10" width="68" height="60" rx="9" fill="url(#sv0c)"/>
    <path d="M15 10h50a9 9 0 0 1 9 9v3H6v-3a9 9 0 0 1 9-9z" fill="url(#sv0a)"/>
    <circle cx="15" cy="16" r="2.4" fill="#fff" opacity=".9"/><circle cx="22" cy="16" r="2.4" fill="#fff" opacity=".6"/><circle cx="29" cy="16" r="2.4" fill="#fff" opacity=".4"/>
    <rect class="l1" x="13" y="29" width="54" height="17" rx="4" fill="url(#sv0a)"/>
    <rect class="l2" x="13" y="51" width="25" height="12" rx="3.5" fill="url(#sv0b)"/>
    <rect class="l2" x="42" y="51" width="25" height="12" rx="3.5" fill="url(#sv0b)" opacity=".75"/>`),
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
  // WhatsApp automation: two chat bubbles, the front one sends itself
  svg(3, `
    <path d="M30 8h36a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-4v9l-10-9H30a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="url(#sv3c)"/>
    <path class="l1" d="M14 26h36a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H28l-12 10v-10h-2a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z" fill="url(#sv3a)"/>
    <path d="M35 33 24 48h9l-3 11 12-16h-9z" fill="#fff"/>`),
  // Online payments: two cards, the front one with chip and stripe, and a paid tick
  svg(4, `
    <rect x="16" y="8" width="58" height="40" rx="8" fill="url(#sv4c)" transform="rotate(-8 45 28)"/>
    <rect class="l1" x="6" y="24" width="62" height="42" rx="8" fill="url(#sv4a)"/>
    <rect x="6" y="33" width="62" height="7" fill="#7a2103" opacity=".55"/>
    <rect x="14" y="46" width="12" height="9" rx="2" fill="#fff" opacity=".85"/>
    <rect x="31" y="49" width="20" height="3.5" rx="1.75" fill="#fff" opacity=".6"/>
    <circle cx="62" cy="62" r="13" fill="#fff"/><circle cx="62" cy="62" r="10.5" fill="url(#sv4b)"/>
    <path d="M56.5 62.3l3.6 3.6 7-7.2" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  // SEO and growth: diamonds moving forward
  svg(5, `
    <path d="M44 22 62 40 44 58 26 40z" fill="url(#sv5c)" transform="translate(12 0)"/>
    <path d="M44 22 62 40 44 58 26 40z" fill="url(#sv5b)" transform="translate(6 0)"/>
    <path d="M38 16 62 40 38 64 14 40z" fill="url(#sv5a)" transform="translate(-6 0)"/>`),
];
