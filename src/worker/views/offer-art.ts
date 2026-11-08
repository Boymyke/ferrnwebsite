/**
 * Scenes for the "What Ferrn offers" card on the home page, one per service, in the order of OFFERS in
 * home.tsx. Each is a small, crisp interface card in real HTML text, floating over a dotted backdrop
 * with a soft orange glow and a lit top edge, with faded cards peeking in behind. Styled under ".ofs"
 * in site.css; the .pop / .row pieces animate only on the active slide.
 */
import { ICONS } from '../lib/icon-data';

const ic = (name: string, size = 16) => {
  const inner = (ICONS[name] || []).map(([tag, a]) => `<${tag}${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`).join('');
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
};

/** One scene: backdrop, optional side cards, and the main card. */
const scene = (main: string, left = '', right = '') =>
  `<div class="ofs"><span class="ofs-dots"></span><span class="ofs-light"></span>` +
  (left ? `<div class="ofs-side l">${left}</div>` : '') + (right ? `<div class="ofs-side r">${right}</div>` : '') +
  `<div class="ofs-card pop">${main}</div></div>`;

const row = (i: number, label: string, end = '', on = false, lead = '') =>
  `<div class="ofs-row${on ? ' on' : ''}" style="--i:${i}">${lead}<span class="t">${label}</span>${end}</div>`;
const key = (k: string) => `<kbd>${k}</kbd>`;
const sw = (on = true) => `<span class="ofs-sw${on ? ' on' : ''}"><i></i></span>`;
const dot = (c = 'ok') => `<span class="ofs-dot ${c}"></span>`;
const skel = (w: number) => `<span class="ofs-skel" style="width:${w}%"></span>`;

export const OFFER_ART: string[] = [
  // Websites: every visitor is one tap from acting
  scene(
    `<div class="ofs-bar">${ic('lock', 14)}<span>yourbusiness.com</span>${ic('x', 15)}</div>
     <p class="ofs-label">Visitors can</p>
     ${row(1, 'Book an appointment', key('1 tap'), true)}
     ${row(2, 'Get a price quote', key('Q'))}
     ${row(3, 'Chat on WhatsApp', key('W'))}`,
    `<div class="ofs-mini">${skel(70)}${skel(50)}${skel(60)}</div>`,
    `<div class="ofs-mini">${skel(60)}${skel(80)}${skel(40)}</div>`),

  // Web apps: the day's work on one board
  scene(
    `<div class="ofs-head"><b>Today</b><span class="ofs-plus">${ic('arrow-right', 14)}</span></div>
     <div class="ofs-task pop" style="--i:1"><span class="ofs-tag ok">Paid</span><p>Order #1042 for Bakare Home Goods</p>
       <div class="ofs-meta">${ic('clock', 13)}<span>Nov 8</span>${ic('message-circle', 13)}<span>4</span><i class="ofs-av">TB</i></div></div>
     <div class="ofs-task pop" style="--i:2"><span class="ofs-tag or">New</span><p>Quote request: 14 pallets to Abuja</p>
       <div class="ofs-meta">${ic('clock', 13)}<span>Nov 9</span>${ic('message-circle', 13)}<span>2</span><i class="ofs-av">IO</i></div></div>`,
    `<div class="ofs-mini"><b class="ofs-mh">Done</b>${skel(80)}${skel(55)}</div>`,
    `<div class="ofs-mini"><b class="ofs-mh">New order</b>${skel(70)}${skel(45)}</div>`),

  // AI assistants: a 2am question answered and a booking offered
  scene(
    `<div class="ofs-head"><span class="ofs-bot">${ic('sparkles', 15)}</span><span><b>Ferrn Assistant</b><small>${dot()} Online</small></span><em>2:04 AM</em></div>
     <p class="ofs-msg me pop" style="--i:1">Are you open on Sunday?</p>
     <p class="ofs-msg bot pop" style="--i:2">Yes, 10am to 4pm. Want me to book you in?</p>
     <div class="ofs-chips pop" style="--i:3"><span>Book a slot</span><span>Prices</span><span class="typing"><i></i><i></i><i></i></span></div>`),

  // Automation: follow-ups that run themselves
  scene(
    `<div class="ofs-bar">${ic('zap', 14)}<span>Automations</span><em>3 running</em></div>
     ${row(1, 'Booking reminders', sw(), true, `<small class="ofs-when">7:00 PM</small>`)}
     ${row(2, 'Lead follow-ups', sw(), false, `<small class="ofs-when">2 days</small>`)}
     ${row(3, 'Weekly report', sw(), false, `<small class="ofs-when">Mon</small>`)}`,
    `<div class="ofs-mini"><b class="ofs-mh">WhatsApp</b>${skel(75)}${skel(50)}</div>`,
    `<div class="ofs-mini"><b class="ofs-mh">Leads</b>${skel(60)}${skel(70)}</div>`),

  // Payments: paid online, receipt sent
  scene(
    `<div class="ofs-head"><span class="ofs-bot ok">${ic('check', 15)}</span><span><b>Payment received</b><small>Paystack · Card •••• 4821</small></span></div>
     <p class="ofs-amount pop" style="--i:1">₦450,000<span class="ofs-tag ok">Paid</span></p>
     <div class="ofs-lines pop" style="--i:2"><span>Website</span><b>₦350,000</b><span>Hosting, 12 months</span><b>₦100,000</b></div>
     <div class="ofs-btn pop" style="--i:3">See receipt ${ic('arrow-right', 14)}</div>`,
    `<div class="ofs-mini"><b class="ofs-mh">Invoice</b>${skel(70)}${skel(40)}</div>`,
    `<div class="ofs-mini"><b class="ofs-mh">Receipt</b>${skel(55)}${skel(75)}</div>`),

  // SEO and analytics: found first, and the numbers to prove it
  scene(
    `<div class="ofs-bar">${ic('search', 14)}<span>bakery near me lagos</span>${ic('x', 15)}</div>
     ${row(1, 'Your Bakery, Lagos', key('#1'), true)}
     <div class="ofs-stat pop" style="--i:2"><span><small>Visitors this month</small><b>1,284</b></span><span class="ofs-tag ok">+38%</span>
       <svg class="ofs-spark" viewBox="0 0 100 32" preserveAspectRatio="none"><path d="M0 28 L16 24 L30 26 L46 16 L62 14 L80 8 L100 2"/></svg></div>`),

  // Hosting and care: everything green
  scene(
    `<div class="ofs-head"><span class="ofs-bot ok">${ic('shield-check', 15)}</span><span><b>All systems normal</b><small>${dot()} Checked 2 min ago</small></span></div>
     ${row(1, 'Uptime', `<b class="ofs-v">99.98%</b>`, true, dot())}
     ${row(2, 'Daily backup', `<b class="ofs-v">03:00</b>`, false, dot())}
     ${row(3, 'SSL certificate', `<b class="ofs-v">Valid</b>`, false, dot())}`),
];
