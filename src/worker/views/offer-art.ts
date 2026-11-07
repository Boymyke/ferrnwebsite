/**
 * Illustrations for the "What Ferrn offers" card on the home page, one per service, in the same
 * order as OFFERS in home.tsx. Each is a small, solid interface scene: solid panels, a solid
 * orange hero element, white icon tiles and real labels. Colours come from CSS variables on
 * ".il" in site.css, so the scenes follow dark and light mode. Animation classes (pop, bar,
 * flow, draw, pulse, dot) only run on the active slide.
 */
import { ICONS } from '../lib/icon-data';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A Lucide icon placed inside the SVG. `c` is a colour class: ic-d (dark), ic-w (white), ic-t (text), ic-m (muted), ic-o (orange). */
const ic = (name: string, x: number, y: number, size: number, c: string, sw = 2) => {
  const inner = (ICONS[name] || []).map(([tag, a]) => `<${tag}${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`).join('');
  return `<g class="${c}" transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
};

/** Text. `c`: tx (text), mu (muted), wt (white), wm (white, softer), dk (dark), gr (green). */
const T = (x: number, y: number, s: string, c: string, size: number, weight = 500, anchor = 'start') =>
  `<text x="${x}" y="${y}" class="${c}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`;

const defs = (k: number) =>
  `<defs><linearGradient id="ilo${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F94406"/><stop offset="1" stop-color="#ff8a4c"/></linearGradient>` +
  `<linearGradient id="ils${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;

const svg = (k: number, body: string) =>
  `<svg class="il" viewBox="0 0 260 176" fill="none" aria-hidden="true">${defs(k)}${body}</svg>`;

/** A solid orange surface with a soft top sheen, like the reference card. */
const orange = (k: number, x: number, y: number, w: number, h: number, r: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#ilo${k})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#ils${k})"/>`;

const tick = (cx: number, cy: number, r: number) =>
  `<circle class="ok" cx="${cx}" cy="${cy}" r="${r}"/><path class="wk" d="M${cx - r * 0.42} ${cy}l${r * 0.3} ${r * 0.3} ${r * 0.55}-${r * 0.6}" stroke-width="${Math.max(2, r * 0.2)}"/>`;

export const OFFER_ART: string[] = [
  // Websites: a business homepage with a clear call to action and WhatsApp one tap away
  svg(0, `
    <rect class="b0" x="8" y="6" width="244" height="152" rx="14"/>
    <circle cx="25" cy="22" r="3.5" fill="#ff5f57"/><circle cx="36" cy="22" r="3.5" fill="#febc2e"/><circle cx="47" cy="22" r="3.5" fill="#28c840"/>
    <rect class="b1" x="66" y="13" width="128" height="18" rx="9"/>${ic('lock', 74, 17, 10, 'ic-m')}${T(89, 25.5, 'yourbusiness.com', 'mu', 8)}
    <path class="hr" d="M8 39h244"/>
    ${T(22, 64, 'Fresh bakes,', 'tx', 15, 600)}${T(22, 82, 'delivered daily.', 'tx', 15, 600)}
    ${T(22, 98, 'Order before 10am, get it today.', 'mu', 7.5)}
    <g class="pop" style="--i:1">${orange(0, 22, 110, 76, 24, 12)}${T(60, 125.5, 'Order now', 'wt', 8.5, 600, 'middle')}</g>
    <rect class="b1" x="104" y="110" width="52" height="24" rx="12"/>${T(130, 125.5, 'Menu', 'tx', 8.5, 500, 'middle')}
    <g class="pop" style="--i:0">${orange(0, 170, 50, 66, 90, 12)}<rect x="189" y="80" width="28" height="28" rx="8" fill="#fff"/>${ic('heart', 196, 87, 14, 'ic-o')}</g>
    <path class="cur pop" style="--i:2" d="M88 124v16l4.4-4.4 3.4 7.2 3-1.4-3.4-7.2h6.2z"/>
    <g class="pop" style="--i:3"><rect class="ok" x="150" y="144" width="98" height="28" rx="14"/>${ic('message-circle', 161, 151, 14, 'ic-w')}${T(181, 161.5, 'WhatsApp us', 'wt', 8.5, 600)}</g>
  `),
  // Web apps: an operations dashboard with a solid orange revenue card
  svg(1, `
    <rect class="b0" x="4" y="4" width="252" height="168" rx="14"/>
    <path class="hr" d="M78 4v168"/>
    ${orange(1, 14, 14, 18, 18, 5)}${T(38, 27, 'Ferrn', 'tx', 9.5, 600)}
    <rect class="b1 st" x="12" y="42" width="58" height="20" rx="6"/>${ic('layout-dashboard', 17, 46, 12, 'ic-t')}${T(33, 55.5, 'Overview', 'tx', 7.5, 500)}
    ${ic('chart-bar', 17, 70, 12, 'ic-m')}${T(33, 79.5, 'Sales', 'mu', 7.5)}<circle class="bd" cx="64" cy="76" r="6"/>${T(64, 78.6, '20', 'bdt', 6.5, 600, 'middle')}
    ${ic('users', 17, 94, 12, 'ic-m')}${T(33, 103.5, 'Clients', 'mu', 7.5)}
    ${ic('package', 17, 118, 12, 'ic-m')}${T(33, 127.5, 'Orders', 'mu', 7.5)}<circle class="bd" cx="64" cy="124" r="6"/>${T(64, 126.6, '4', 'bdt', 6.5, 600, 'middle')}
    ${T(90, 26, 'Overview', 'tx', 11.5, 600)}${T(90, 38, 'Today at a glance', 'mu', 7)}
    <g class="pop" style="--i:0">${orange(1, 90, 46, 156, 66, 12)}
      <rect x="100" y="56" width="22" height="22" rx="6" fill="#fff"/>${ic('wallet', 104, 60, 14, 'ic-d')}
      ${T(129, 66, 'Revenue', 'wt', 9, 600)}${T(129, 76, 'This month', 'wm', 6.8)}
      ${T(100, 100, '₦2,480,000', 'wt', 14, 600)}<rect x="196" y="89" width="40" height="15" rx="7.5" fill="#fff"/>${T(216, 99, '+12%', 'dk', 7, 600, 'middle')}</g>
    <rect class="b1" x="90" y="120" width="156" height="44" rx="10"/>
    <rect class="bar m3" style="--i:0" x="102" y="146" width="11" height="10" rx="3"/>
    <rect class="bar m3" style="--i:1" x="120" y="140" width="11" height="16" rx="3"/>
    <rect class="bar m3" style="--i:2" x="138" y="143" width="11" height="13" rx="3"/>
    <rect class="bar m3" style="--i:3" x="156" y="136" width="11" height="20" rx="3"/>
    <rect class="bar m3" style="--i:4" x="174" y="138" width="11" height="18" rx="3"/>
    <rect class="bar or" style="--i:5" x="192" y="130" width="11" height="26" rx="3"/>
    <rect class="bar or" style="--i:6" x="210" y="127" width="11" height="29" rx="3"/>
    <rect class="bar m3" style="--i:7" x="228" y="134" width="11" height="22" rx="3"/>
  `),
  // AI assistants: a 2am question answered and a booking offered
  svg(2, `
    <rect class="b0" x="12" y="4" width="236" height="168" rx="14"/>
    ${orange(2, 24, 14, 26, 26, 8)}${ic('sparkles', 29, 19, 16, 'ic-w')}
    ${T(58, 25, 'Ferrn Assistant', 'tx', 9.5, 600)}<circle class="ok" cx="61" cy="35" r="3"/>${T(68, 37.6, 'Online', 'mu', 7)}
    ${T(236, 25, '2:04 AM', 'mu', 7, 500, 'end')}
    <path class="hr" d="M12 48h236"/>
    <g class="pop" style="--i:0"><rect class="b1" x="108" y="58" width="128" height="26" rx="13"/>${T(172, 74.2, 'Are you open on Sunday?', 'tx', 8, 500, 'middle')}</g>
    <g class="pop" style="--i:1">${orange(2, 24, 92, 156, 40, 13)}${T(36, 108, 'Yes, 10am to 4pm.', 'wt', 8.5, 500)}${T(36, 121, 'Want me to book you in?', 'wt', 8.5, 500)}</g>
    <g class="pop" style="--i:2"><rect class="b1 st" x="24" y="140" width="64" height="22" rx="11"/>${T(56, 154, 'Book a slot', 'tx', 7.5, 500, 'middle')}
      <rect class="b1 st" x="94" y="140" width="46" height="22" rx="11"/>${T(117, 154, 'Prices', 'tx', 7.5, 500, 'middle')}</g>
    <g class="pop" style="--i:3"><rect class="b1" x="196" y="140" width="40" height="22" rx="11"/>
      <circle class="dot" style="--i:0" cx="207" cy="151" r="2.6"/><circle class="dot" style="--i:1" cx="216" cy="151" r="2.6"/><circle class="dot" style="--i:2" cx="225" cy="151" r="2.6"/></g>
  `),
  // Automation: an enquiry arrives, a reply goes out, a follow-up is booked
  svg(3, `
    <path class="flow" d="M34 46c0 14 50 6 50 22"/><path class="flow" d="M100 104c0 14 32 6 32 20"/>
    <g class="pop" style="--i:0"><rect class="b0" x="8" y="6" width="156" height="40" rx="11"/>
      <rect x="16" y="14" width="24" height="24" rx="7" class="wtile"/>${ic('zap', 22, 20, 12, 'ic-o')}
      ${T(48, 24, 'New enquiry', 'tx', 9, 600)}${T(48, 35, 'From your website', 'mu', 7)}${T(156, 24, 'now', 'mu', 7, 500, 'end')}</g>
    <g class="pop" style="--i:1"><rect class="b0" x="56" y="64" width="166" height="40" rx="11"/>
      <rect class="ok" x="64" y="72" width="24" height="24" rx="7"/>${ic('message-circle', 70, 78, 12, 'ic-w')}
      ${T(96, 82, 'WhatsApp reply sent', 'tx', 9, 600)}${T(96, 93, 'In 4 seconds', 'mu', 7)}</g>
    <g class="pop" style="--i:2">${orange(3, 96, 124, 156, 40, 11)}
      <rect x="104" y="132" width="24" height="24" rx="7" fill="#fff"/>${ic('calendar', 110, 138, 12, 'ic-d')}
      ${T(136, 142, 'Follow-up booked', 'wt', 9, 600)}${T(136, 153, 'Friday, 10:00', 'wm', 7)}</g>
    <g class="pop" style="--i:3"><rect class="b1 st" x="180" y="14" width="68" height="22" rx="11"/><circle class="pulse" cx="193" cy="25" r="3"/><circle class="ok" cx="193" cy="25" r="3"/>${T(201, 28, 'Running', 'tx', 7.5, 500)}</g>
  `),
  // Payments: payment received on a solid card, the receipt behind it
  svg(4, `
    <g class="pop" style="--i:0" transform="rotate(6 200 76)"><rect class="b0" x="152" y="10" width="96" height="132" rx="11"/>
      ${T(164, 30, 'Receipt', 'tx', 9, 600)}
      ${T(164, 50, 'Website', 'mu', 7)}${T(238, 50, '₦350,000', 'tx', 7, 500, 'end')}
      ${T(164, 64, 'Hosting', 'mu', 7)}${T(238, 64, '₦100,000', 'tx', 7, 500, 'end')}
      <path class="hr" d="M164 74h74"/>${T(164, 88, 'Total', 'tx', 7.5, 600)}${T(238, 88, '₦450,000', 'tx', 7.5, 600, 'end')}</g>
    <g class="pop" style="--i:1"><clipPath id="ilc4"><rect x="12" y="34" width="180" height="108" rx="14"/></clipPath>
      <g clip-path="url(#ilc4)">${orange(4, 12, 34, 180, 108, 14)}<rect x="12" y="120" width="180" height="22" fill="#fff" fill-opacity=".16"/></g>
      <rect x="24" y="46" width="30" height="30" rx="9" fill="#fff"/>${ic('wallet', 31, 53, 16, 'ic-d')}
      ${T(62, 58, 'Payment received', 'wt', 9.5, 600)}${T(62, 70, 'Paystack, card', 'wm', 7)}
      ${T(24, 106, '₦450,000', 'wt', 18, 600)}<rect x="120" y="94" width="42" height="16" rx="8" fill="#fff"/>${T(141, 105, 'Paid', 'dk', 7.5, 600, 'middle')}
      ${T(24, 134.5, 'See receipt', 'wm', 7.5)}${ic('arrow-right', 172, 126, 11, 'ic-w')}</g>
    <g class="pop" style="--i:3">${tick(190, 146, 14)}</g>
  `),
  // SEO and analytics: first on Google for the search that matters, and visits going up
  svg(5, `
    <rect class="b0" x="6" y="4" width="248" height="168" rx="14"/>
    <rect class="b1" x="18" y="16" width="224" height="26" rx="13"/>${ic('search', 28, 22, 13, 'ic-m')}${T(48, 32.5, 'bakery near me lagos', 'tx', 8.5)}
    <g class="pop" style="--i:0"><rect class="b1 hl" x="18" y="52" width="224" height="46" rx="11"/>
      ${orange(5, 28, 62, 26, 26, 7)}${T(41, 79, '#1', 'wt', 10, 600, 'middle')}
      ${T(62, 72, 'Your Bakery | Fresh bakes', 'tx', 9, 600)}${T(62, 85, 'yourbakery.com', 'gr', 7.5)}</g>
    <g class="pop" style="--i:1"><rect class="b1" x="18" y="106" width="224" height="56" rx="11"/>
      ${T(30, 122, 'Visitors this month', 'mu', 7)}${T(30, 145, '1,284', 'tx', 16, 600)}
      <rect class="okbg" x="82" y="134" width="38" height="15" rx="7.5"/>${T(101, 144.5, '+38%', 'gr', 7, 600, 'middle')}
      <path d="M138 150l16-6 14 3 14-12 14-3 18-14 v32H138z" fill="url(#ilo5)" fill-opacity=".22"/>
      <path class="draw" d="M138 150l16-6 14 3 14-12 14-3 18-14"/><circle class="pulse" cx="214" cy="118" r="3.5"/><circle class="or" cx="214" cy="118" r="3.5"/></g>
  `),
  // Hosting and care: everything green, backed up and secure
  svg(6, `
    <rect class="b0" x="12" y="4" width="236" height="168" rx="14"/>
    <circle class="pulse" cx="28" cy="24" r="4"/><circle class="ok" cx="28" cy="24" r="4"/>${T(38, 27.5, 'All systems normal', 'tx', 9.5, 600)}
    <rect class="b1 st" x="198" y="14" width="36" height="20" rx="10"/>${T(216, 27, 'Live', 'tx', 7.5, 500, 'middle')}
    <g class="pop" style="--i:0"><rect class="b1" x="24" y="44" width="212" height="30" rx="9"/><rect x="31" y="49" width="20" height="20" rx="6" class="wtile"/>${ic('gauge', 35, 53, 12, 'ic-d')}
      ${T(59, 62.5, 'Uptime', 'tx', 8.5, 500)}${T(226, 62.5, '99.9%', 'tx', 8.5, 600, 'end')}</g>
    <g class="pop" style="--i:1"><rect class="b1" x="24" y="80" width="212" height="30" rx="9"/><rect x="31" y="85" width="20" height="20" rx="6" class="wtile"/>${ic('database', 35, 89, 12, 'ic-d')}
      ${T(59, 98.5, 'Daily backups', 'tx', 8.5, 500)}${tick(220, 95, 7)}</g>
    <g class="pop" style="--i:2"><rect class="b1" x="24" y="116" width="212" height="30" rx="9"/>${orange(6, 31, 121, 20, 20, 6)}${ic('lock', 35, 125, 12, 'ic-w')}
      ${T(59, 134.5, 'SSL secure', 'tx', 8.5, 500)}${T(226, 134.5, 'Active', 'gr', 8.5, 600, 'end')}</g>
    <g class="pop" style="--i:3">${Array.from({ length: 30 }, (_, i) => `<rect class="ok" x="${24 + i * 7.1}" y="154" width="5" height="10" rx="1.5" fill-opacity="${i === 19 ? '.35' : '.85'}"/>`).join('')}</g>
  `),
];
