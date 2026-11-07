/**
 * Small illustrations for the "What Ferrn offers" card on the home page, one per service, in the same
 * order as OFFERS in home.tsx. They draw in currentColor (so they follow dark and light mode) and pick
 * their accents from --g1 / --g2, which each slide sets from its glow colours. Classes are styled in
 * site.css under ".il".
 */
const grad = (k: number) =>
  `<defs><linearGradient id="ilg${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g1)"/><stop offset="1" style="stop-color:var(--g2)"/></linearGradient></defs>`;
const svg = (k: number, body: string) =>
  `<svg class="il" viewBox="0 0 240 160" fill="none" aria-hidden="true">${grad(k)}${body}</svg>`;

export const OFFER_ART: string[] = [
  // Websites: a page with a hero, a call to action and a WhatsApp button
  svg(0, `
    <rect class="p" x="18" y="12" width="204" height="136" rx="10"/>
    <path class="k f" d="M18 34h204"/>
    <circle class="m" cx="32" cy="23" r="3.5"/><circle class="m" cx="43" cy="23" r="3.5"/><circle class="m" cx="54" cy="23" r="3.5"/>
    <rect class="p" x="70" y="17" width="104" height="12" rx="6"/>
    <path class="s" d="M34 56h76M34 70h58"/><path class="s t" d="M34 86h70M34 96h52"/>
    <g class="pop" style="--i:1"><rect class="a" x="34" y="108" width="54" height="18" rx="9"/><path class="w" d="M46 117h30"/></g>
    <g class="pop" style="--i:0"><rect x="128" y="46" width="78" height="80" rx="7" fill="url(#ilg0)" fill-opacity=".35"/>
    <path class="m" d="M134 120l22-28 14 15 10-10 20 23z"/><circle class="b" cx="188" cy="62" r="7"/></g>
    <g class="pop" style="--i:3"><circle class="ok" cx="214" cy="136" r="17"/><path class="w" d="M206 140l2-6a8 8 0 1 1 3 3z" stroke-width="2.5" fill="none"/></g>
    <path class="cur pop" style="--i:2" d="M80 118v17l4.5-4.5 3.5 7.5 3-1.4-3.5-7.4h6.5z"/>
  `),
  // Web apps: a dashboard with a sidebar, two figures and a bar chart
  svg(1, `
    <rect class="p" x="14" y="12" width="212" height="136" rx="10"/>
    <path class="k f" d="M62 12v136"/>
    <rect class="a" x="22" y="44" width="32" height="14" rx="4" fill-opacity=".3"/>
    <circle class="m" cx="30" cy="30" r="5"/><path class="s t" d="M40 30h12M30 51h18M30 72h18M30 90h18M30 108h18"/>
    <g class="pop" style="--i:0"><rect class="p" x="72" y="22" width="68" height="34" rx="6"/><path class="s t" d="M82 32h28"/><path class="s" d="M82 45h18"/><path class="up" d="M122 46l6-7 6 7"/></g>
    <g class="pop" style="--i:1"><rect class="p" x="148" y="22" width="68" height="34" rx="6"/><path class="s t" d="M158 32h30"/><path class="s" d="M158 45h24"/><path class="up" d="M198 46l6-7 6 7"/></g>
    <rect class="p" x="72" y="64" width="144" height="74" rx="6"/>
    <path class="k f" d="M82 128h124"/>
    <rect class="bar m2" style="--i:0" x="86" y="104" width="12" height="24" rx="3"/>
    <rect class="bar m2" style="--i:1" x="106" y="92" width="12" height="36" rx="3"/>
    <rect class="bar m2" style="--i:2" x="126" y="98" width="12" height="30" rx="3"/>
    <rect class="bar a" style="--i:3" x="146" y="82" width="12" height="46" rx="3"/>
    <rect class="bar m2" style="--i:4" x="166" y="88" width="12" height="40" rx="3"/>
    <rect class="bar b" style="--i:5" x="186" y="74" width="12" height="54" rx="3"/>
  `),
  // AI assistants: a late-night question, the assistant's answer, and it typing again
  svg(2, `
    <g class="pop" style="--i:0"><rect class="a" x="104" y="14" width="118" height="34" rx="12"/><path class="w" d="M116 27h80M116 37h52"/></g>
    <g class="pop" style="--i:1"><circle cx="30" cy="80" r="13" fill="url(#ilg2)"/><circle cx="25.5" cy="79" r="2" fill="#fff"/><circle cx="34.5" cy="79" r="2" fill="#fff"/>
    <path d="M38 64l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" class="b"/></g>
    <g class="pop" style="--i:2"><rect class="p" x="52" y="60" width="138" height="44" rx="12"/><path class="s" d="M64 75h108"/><path class="s t" d="M64 89h76"/></g>
    <g class="pop" style="--i:3"><rect class="p" x="52" y="114" width="54" height="26" rx="13"/>
    <circle class="dot" style="--i:0" cx="67" cy="127" r="3.5"/><circle class="dot" style="--i:1" cx="79" cy="127" r="3.5"/><circle class="dot" style="--i:2" cx="91" cy="127" r="3.5"/></g>
    <g class="pop" style="--i:4"><rect class="p" x="150" y="116" width="70" height="22" rx="11"/><path class="b" d="M168 120a7 7 0 1 0 6 11 6 6 0 0 1-6-11z"/><path class="s t" d="M184 127h24"/></g>
  `),
  // Automation: a trigger, a message and a done step, joined by a moving line
  svg(3, `
    <path class="flow" d="M74 82c14 0 8-38 20-38"/><path class="flow" d="M148 44c26 0 46 14 46 48"/>
    <g class="pop" style="--i:0"><rect class="p" x="18" y="58" width="56" height="48" rx="11"/><path class="a" d="M50 66l-14 19h10l-4 13 14-19h-10z"/></g>
    <g class="pop" style="--i:1"><rect class="p" x="94" y="20" width="54" height="48" rx="11"/><rect x="106" y="32" width="30" height="20" rx="6" fill="url(#ilg3)" fill-opacity=".55"/><path class="k" d="M112 52l-3 6 8-6"/>
    <circle class="b" cx="146" cy="22" r="9"/><path class="w" d="M146 17.5v4.5l3 2" stroke-width="2"/></g>
    <g class="pop" style="--i:2"><rect class="p" x="166" y="92" width="56" height="48" rx="11"/><circle class="ok" cx="194" cy="116" r="13"/><path class="w" d="M188 116l4 4 8-8" stroke-width="3"/></g>
    <path class="s t" d="M24 124h40M24 134h26"/>
  `),
  // Payments: a card, a receipt behind it and a paid tick
  svg(4, `
    <g class="pop" style="--i:0" transform="rotate(7 168 74)"><rect class="p" x="130" y="16" width="76" height="112" rx="7"/>
    <path class="s t" d="M142 36h36M142 50h52M142 62h44M142 74h50"/><path class="k f" d="M142 90h52"/><path class="s" d="M142 104h28M182 104h12"/></g>
    <g class="pop" style="--i:1"><rect x="24" y="44" width="142" height="90" rx="12" fill="url(#ilg4)"/>
    <rect x="40" y="64" width="24" height="18" rx="4" fill="#fff" fill-opacity=".55"/><path class="w" d="M40 106h34M84 106h34" stroke-opacity=".7"/><path class="w" d="M40 120h26" stroke-width="3" stroke-opacity=".5"/>
    <circle cx="136" cy="68" r="9" fill="#fff" fill-opacity=".5"/><circle cx="148" cy="68" r="9" fill="#fff" fill-opacity=".3"/></g>
    <g class="pop" style="--i:3"><circle class="ok" cx="170" cy="132" r="17"/><path class="w" d="M162 132l5 5 11-11" stroke-width="3.5"/></g>
  `),
  // SEO and analytics: a search that ranks first and a line that climbs
  svg(5, `
    <g class="pop" style="--i:0"><rect class="p" x="26" y="12" width="188" height="30" rx="15"/><circle class="k" cx="44" cy="27" r="6"/><path class="k" d="M48.5 31.5l4 4"/><path class="s t" d="M62 27h82"/>
    <rect class="a" x="170" y="18" width="36" height="18" rx="9"/><text x="188" y="31" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="inherit">#1</text></g>
    <rect class="p" x="26" y="52" width="188" height="96" rx="10"/>
    <path class="k g" d="M40 78h160M40 102h160M40 126h160"/>
    <path d="M40 132l30-12 30 4 30-26 30-6 30-24v64H40z" fill="url(#ilg5)" fill-opacity=".3"/>
    <path class="draw" d="M40 132l30-12 30 4 30-26 30-6 30-24"/>
    <circle class="pulse" cx="200" cy="68" r="5"/><circle class="a" cx="200" cy="68" r="5"/>
  `),
  // Hosting and care: servers with live lights, a shield and an uptime strip
  svg(6, `
    <g class="pop" style="--i:0"><rect class="p" x="22" y="26" width="116" height="30" rx="7"/><circle class="ok blink" style="--i:0" cx="38" cy="41" r="4"/><path class="s t" d="M52 41h44"/><path class="k f" d="M108 36v10M116 36v10M124 36v10"/></g>
    <g class="pop" style="--i:1"><rect class="p" x="22" y="64" width="116" height="30" rx="7"/><circle class="ok blink" style="--i:1" cx="38" cy="79" r="4"/><path class="s t" d="M52 79h36"/><path class="k f" d="M108 74v10M116 74v10M124 74v10"/></g>
    <g class="pop" style="--i:2"><rect class="p" x="22" y="102" width="116" height="30" rx="7"/><circle class="ok blink" style="--i:2" cx="38" cy="117" r="4"/><path class="s t" d="M52 117h50"/><path class="k f" d="M108 112v10M116 112v10M124 112v10"/></g>
    <g class="pop" style="--i:3"><path d="M184 20l34 13v26c0 26-15 42-34 50-19-8-34-24-34-50V33z" fill="url(#ilg6)"/><path class="w" d="M170 64l9 9 19-19" stroke-width="5"/></g>
    <g class="pop" style="--i:4"><rect class="ok up2" x="154" y="122" width="6" height="16" rx="2"/><rect class="ok up2" x="163" y="122" width="6" height="16" rx="2"/><rect class="ok up2" x="172" y="122" width="6" height="16" rx="2"/>
    <rect class="ok up2" x="181" y="122" width="6" height="16" rx="2"/><rect class="ok up2" x="190" y="122" width="6" height="16" rx="2"/><rect class="ok up2" x="199" y="122" width="6" height="16" rx="2"/><rect class="ok up2" x="208" y="122" width="6" height="16" rx="2"/></g>
  `),
];
