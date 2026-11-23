/** Bob, Ferrn's ghost (original design; 23 Nov 2026): a see-through orange spirit whose body thins into a tail
 *  that swishes and fades away, with two arms and real hands (four fingers and a thumb).
 *  Animated parts: g-arm-l / g-arm-r (wave, point, pull; pivot at the shoulder), g-f (each finger bends at its
 *  knuckle), g-eyes (look, blink), g-mouth (talks with --level), g-body-wrap (drifts); the tail swishes by itself
 *  (SMIL). The arms and the body are siblings, never nested, so moving an arm never moves the body.
 *  `id` keeps gradient and mask ids unique when several copies are on one page. */

/** Tail shapes the outline morphs between (identical commands, so the morph is smooth). */
const BASE = 'M80 12C48 12 30 38 30 70v30c0 36 20 58 42 72c12 8 22 14 32 24c6-12 8-26 16-36c8-14 10-34 10-56V70C130 38 112 12 80 12Z';
const LEFT = 'M80 12C48 12 30 38 30 70v30c0 36 16 60 34 74c10 8 14 16 16 24c6-12 12-28 24-38c14-14 26-34 26-56V70C130 38 112 12 80 12Z';
const RIGHT = 'M80 12C48 12 30 38 30 70v30c0 36 22 56 46 70c14 8 30 12 42 24c2-12 0-26 4-36c6-14 8-32 8-54V70C130 38 112 12 80 12Z';
const SWISH = `<animate attributeName="d" dur="3.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="${BASE};${LEFT};${BASE};${RIGHT};${BASE}"/>`;

/** One hand, drawn pointing along +x from the wrist at (0,0): [knuckle x, knuckle y, angle, length, class].
 *  Each finger is a rounded capsule starting at its knuckle, so a CSS rotation bends it from the knuckle. */
const FINGERS: [number, number, number, number, string][] = [
  [3, -7.6, -100, 11, 'g-th'],
  [12, -6.4, -34, 13.5, 'g-f1'],
  [14.6, -2.2, -10, 15.5, 'g-f2'],
  [14.6, 2.6, 13, 14.5, 'g-f3'],
  [12, 6.8, 37, 11.5, 'g-f4'],
];

export function ghostSvg(id = 'bg', w = 70, h = 82, cls = 'ghost') {
  const g = (n: string) => `${id}-${n}`;
  const finger = ([x, y, a, len, c]: [number, number, number, number, string]) =>
    `<g transform="translate(${x} ${y}) rotate(${a})"><g class="g-f ${c}"><rect x="-1" y="-3.3" width="${len}" height="6.6" rx="3.3" fill="url(#${g('hand')})" stroke="#a8380a" stroke-opacity=".38" stroke-width=".7"/><ellipse cx="${(len - 4.2).toFixed(1)}" cy="-1.4" rx="1.9" ry="1.1" fill="#fff" opacity=".4"/></g></g>`;
  const hand = (place: string) =>
    `<g class="g-hand" transform="${place}">${FINGERS.map(finger).join('')}<ellipse cx="6.8" cy="0" rx="9.4" ry="10.2" fill="url(#${g('hand')})" stroke="#a8380a" stroke-opacity=".3" stroke-width=".7"/><ellipse cx="4.4" cy="-4.4" rx="3.2" ry="2" fill="#fff" opacity=".42"/></g>`;
  return `<svg class="${cls}" viewBox="-16 0 192 200" width="${w}" height="${h}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${g('body')}" cx="40%" cy="26%" r="80%">
      <stop offset="0" stop-color="#fff1e6" stop-opacity=".98"/><stop offset=".16" stop-color="#ffb488" stop-opacity=".95"/>
      <stop offset=".5" stop-color="#ff6a2a" stop-opacity=".88"/><stop offset="1" stop-color="#e2470c" stop-opacity=".62"/>
    </radialGradient>
    <linearGradient id="${g('fade')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset=".8" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </linearGradient>
    <mask id="${g('mask')}" maskUnits="userSpaceOnUse" x="-10" y="0" width="190" height="200"><rect x="-10" y="0" width="190" height="200" fill="url(#${g('fade')})"/></mask>
    <linearGradient id="${g('arm')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8f5a"/><stop offset="1" stop-color="#e8500f"/></linearGradient>
    <radialGradient id="${g('hand')}" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#ffc39c"/><stop offset=".55" stop-color="#ff6a2a"/><stop offset="1" stop-color="#d9480d"/></radialGradient>
  </defs>
  <g class="g-arm g-arm-l" opacity=".95"><path d="M40 94C29 98 22 104 16 110" stroke="url(#${g('arm')})" stroke-width="10" stroke-linecap="round" fill="none"/>${hand('translate(16 110) scale(-1 1) rotate(40)')}</g>
  <g class="g-arm g-arm-r" opacity=".95"><path d="M120 94c11 4 18 10 24 16" stroke="url(#${g('arm')})" stroke-width="10" stroke-linecap="round" fill="none"/>${hand('translate(144 110) rotate(40)')}</g>
  <g class="g-body-wrap">
    <g mask="url(#${g('mask')})">
      <path class="g-body" fill="url(#${g('body')})" d="${BASE}">${SWISH}</path>
      <path d="${BASE}" fill="none" stroke="#ffd7bd" stroke-opacity=".45" stroke-width="1.2">${SWISH}</path>
    </g>
    <ellipse class="g-gloss" cx="60" cy="38" rx="17" ry="9.5" fill="#fff" opacity=".42" transform="rotate(-26 60 38)"/>
    <circle cx="49" cy="36" r="3" fill="#fff" opacity=".75"/>
    <g class="g-face">
      <ellipse class="g-cheek" cx="52" cy="86" rx="7.5" ry="4.6" fill="#ff7a8a" opacity=".4"/>
      <ellipse class="g-cheek" cx="108" cy="86" rx="7.5" ry="4.6" fill="#ff7a8a" opacity=".4"/>
      <g class="g-eyes">
        <ellipse cx="63" cy="70" rx="8.5" ry="11.5" fill="#2a0f06"/><ellipse cx="97" cy="70" rx="8.5" ry="11.5" fill="#2a0f06"/>
        <circle cx="66" cy="65" r="3.4" fill="#fff"/><circle cx="100" cy="65" r="3.4" fill="#fff"/>
        <circle cx="60.5" cy="75" r="1.5" fill="#fff" opacity=".6"/><circle cx="94.5" cy="75" r="1.5" fill="#fff" opacity=".6"/>
      </g>
      <path class="g-mouth" d="M71 94q9 8 18 0" stroke="#2a0f06" stroke-width="3.6" fill="#5a1a08" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
}
