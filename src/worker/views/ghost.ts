/** Bob, Ferrn's ghost (original design; ghostly version 23 Nov 2026): a glowing, see-through orange spirit whose
 *  body thins into a curling wisp of a tail that fades into mist. Two soft arms with mitten hands. Parts carry
 *  classes the scripts animate: g-arm-l / g-arm-r (wave, point, pull), g-eyes (look, blink), g-mouth (talks with
 *  --level), g-body-wrap (drifts), g-f (fingers wiggle); the tail swishes by itself (SMIL). `id` keeps ids unique per copy. */
export function ghostSvg(id = 'bg', w = 70, h = 82, cls = 'ghost') {
  const g = (n: string) => `${id}-${n}`;
  const BODY = 'M80 12C48 12 30 38 30 70v30c0 36 20 58 42 72c12 8 22 14 32 24c6-12 8-26 16-36c8-14 10-34 10-56V70C130 38 112 12 80 12Z';
  // The tail swishes: the outline morphs between these shapes (same commands, so it animates smoothly).
  const SWISH = `<animate attributeName="d" dur="3.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="M80 12C48 12 30 38 30 70v30c0 36 20 58 42 72c12 8 22 14 32 24c6-12 8-26 16-36c8-14 10-34 10-56V70C130 38 112 12 80 12Z;M80 12C48 12 30 38 30 70v30c0 36 16 60 34 74c10 8 14 16 16 24c6-12 12-28 24-38c14-14 26-34 26-56V70C130 38 112 12 80 12Z;M80 12C48 12 30 38 30 70v30c0 36 20 58 42 72c12 8 22 14 32 24c6-12 8-26 16-36c8-14 10-34 10-56V70C130 38 112 12 80 12Z;M80 12C48 12 30 38 30 70v30c0 36 22 56 46 70c14 8 30 12 42 24c2-12 0-26 4-36c6-14 8-32 8-54V70C130 38 112 12 80 12Z;M80 12C48 12 30 38 30 70v30c0 36 20 58 42 72c12 8 22 14 32 24c6-12 8-26 16-36c8-14 10-34 10-56V70C130 38 112 12 80 12Z"/>`;
  return `<svg class="${cls}" viewBox="-4 0 168 200" width="${w}" height="${h}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${g('body')}" cx="40%" cy="26%" r="80%">
      <stop offset="0" stop-color="#fff1e6" stop-opacity=".98"/><stop offset=".16" stop-color="#ffb488" stop-opacity=".95"/>
      <stop offset=".5" stop-color="#ff6a2a" stop-opacity=".86"/><stop offset="1" stop-color="#e2470c" stop-opacity=".55"/>
    </radialGradient>
    <linearGradient id="${g('fade')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset=".8" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </linearGradient>
    <mask id="${g('mask')}" maskUnits="userSpaceOnUse" x="-10" y="0" width="190" height="200"><rect x="-10" y="0" width="190" height="200" fill="url(#${g('fade')})"/></mask>
    <radialGradient id="${g('arm')}" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffd0b0" stop-opacity=".95"/><stop offset=".55" stop-color="#ff6a2a" stop-opacity=".85"/><stop offset="1" stop-color="#e2470c" stop-opacity=".6"/>
    </radialGradient>
    <linearGradient id="${g('wisp')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff8a4a" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a4a" stop-opacity="0"/>
    </linearGradient>
    <filter id="${g('glow')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${g('soft')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <g class="g-aura" opacity=".55"><path d="${BODY}" fill="#ff5a1a" filter="url(#${g('glow')})">${SWISH}</path></g>
  <g class="g-arm g-arm-l"><path d="M36 92C26 96 17 102 12 110" stroke="url(#${g('arm')})" stroke-width="11" stroke-linecap="round" fill="none"/><g class="g-hand"><g class="g-fingers" fill="url(#${g('arm')})"><g class="g-f g-f1" style="--ox:7.8px;--oy:108.6px"><ellipse cx="4.0" cy="104.5" rx="3.6" ry="5.4" transform="rotate(45 4.0 104.5)"/></g><g class="g-f g-f2" style="--ox:6.7px;--oy:112.0px"><ellipse cx="1.5" cy="112.0" rx="3.6" ry="5.4" transform="rotate(90 1.5 112.0)"/></g><g class="g-f g-f3" style="--ox:7.8px;--oy:115.4px"><ellipse cx="4.0" cy="119.5" rx="3.6" ry="5.4" transform="rotate(135 4.0 119.5)"/></g><g class="g-f g-th" style="--ox:12.3px;--oy:107.7px"><ellipse cx="14.0" cy="102.5" rx="3.6" ry="5.4" transform="rotate(15 14.0 102.5)"/></g></g><circle cx="11" cy="112" r="8.4" fill="url(#${g('arm')})"/><circle cx="14" cy="108.5" r="2.4" fill="#fff" opacity=".45"/></g>
  <g class="g-arm g-arm-r"><path d="M124 92c10 4 19 10 24 18" stroke="url(#${g('arm')})" stroke-width="11" stroke-linecap="round" fill="none"/><g class="g-hand"><g class="g-fingers" fill="url(#${g('arm')})"><g class="g-f g-f1" style="--ox:152.2px;--oy:108.6px"><ellipse cx="156.0" cy="104.5" rx="3.6" ry="5.4" transform="rotate(-45 156.0 104.5)"/></g><g class="g-f g-f2" style="--ox:153.3px;--oy:112.0px"><ellipse cx="158.5" cy="112.0" rx="3.6" ry="5.4" transform="rotate(-90 158.5 112.0)"/></g><g class="g-f g-f3" style="--ox:152.2px;--oy:115.4px"><ellipse cx="156.0" cy="119.5" rx="3.6" ry="5.4" transform="rotate(-135 156.0 119.5)"/></g><g class="g-f g-th" style="--ox:147.7px;--oy:107.7px"><ellipse cx="146.0" cy="102.5" rx="3.6" ry="5.4" transform="rotate(-15 146.0 102.5)"/></g></g><circle cx="149" cy="112" r="8.4" fill="url(#${g('arm')})"/><circle cx="146" cy="108.5" r="2.4" fill="#fff" opacity=".45"/></g>
  <g class="g-body-wrap">
    <g mask="url(#${g('mask')})">
      <path class="g-body" fill="url(#${g('body')})" d="${BODY}">${SWISH}</path>
      <path d="${BODY}" fill="none" stroke="#ffd7bd" stroke-opacity=".55" stroke-width="1.6" filter="url(#${g('soft')})">${SWISH}</path>
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
