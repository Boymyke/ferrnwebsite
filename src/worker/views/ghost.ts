/** Bob, Ferrn's ghost (original design, 22 Nov 2026): a soft, 3D-shaded orange ghost with two arms and mitten
 *  hands. Parts carry classes the scripts animate: g-arm-l / g-arm-r (wave, point, pull), g-eyes / g-lids
 *  (look, blink), g-mouth (talks with --level), g-tail (sways). `id` keeps gradient ids unique per copy. */
export function ghostSvg(id = 'bg', w = 70, h = 76, cls = 'ghost') {
  const g = (n: string) => `${id}-${n}`;
  return `<svg class="${cls}" viewBox="-6 0 172 172" width="${w}" height="${h}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${g('body')}" cx="36%" cy="26%" r="78%">
      <stop offset="0" stop-color="#ffd2b6"/><stop offset=".18" stop-color="#ff9a62"/><stop offset=".55" stop-color="#F94406"/><stop offset="1" stop-color="#a82a00"/>
    </radialGradient>
    <radialGradient id="${g('arm')}" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffb48a"/><stop offset=".5" stop-color="#ff5a1a"/><stop offset="1" stop-color="#b83000"/>
    </radialGradient>
    <radialGradient id="${g('rim')}" cx="92%" cy="55%" r="45%">
      <stop offset="0" stop-color="#ffd9b8" stop-opacity=".35"/><stop offset="1" stop-color="#ffd9b8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${g('shadow')}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#F94406" stop-opacity=".45"/><stop offset="1" stop-color="#F94406" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse class="g-shadow" cx="80" cy="164" rx="40" ry="6" fill="url(#${g('shadow')})"/>
  <g class="g-arm g-arm-l"><path d="M34 90C24 94 14 100 9 108" stroke="url(#${g('arm')})" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="8" cy="110" r="10.5" fill="url(#${g('arm')})"/><circle cx="14" cy="102.5" r="4.4" fill="#ff8f5a"/><circle cx="5" cy="106" r="3" fill="#fff" opacity=".35"/></g>
  <g class="g-arm g-arm-r"><path d="M126 90c10 4 20 10 25 18" stroke="url(#${g('arm')})" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="152" cy="110" r="10.5" fill="url(#${g('arm')})"/><circle cx="146" cy="102.5" r="4.4" fill="#ff8f5a"/><circle cx="149" cy="106" r="3" fill="#fff" opacity=".35"/></g>
  <g class="g-body-wrap">
    <path class="g-body" fill="url(#${g('body')})" d="M80 10C47 10 26 36 26 70v42c0 14-6 26-14 34 10 4 22 2 30-4 6 10 18 14 28 10 8 8 22 10 32 2 10 6 22 4 30-4 7 3 15 2 20-2-10-10-16-22-16-38V70C136 36 113 10 80 10Z"/>
    <path class="g-rim" fill="url(#${g('rim')})" d="M80 10C47 10 26 36 26 70v42c0 14-6 26-14 34 10 4 22 2 30-4 6 10 18 14 28 10 8 8 22 10 32 2 10 6 22 4 30-4 7 3 15 2 20-2-10-10-16-22-16-38V70C136 36 113 10 80 10Z"/>
    <ellipse class="g-gloss" cx="58" cy="36" rx="18" ry="11" fill="#fff" opacity=".38" transform="rotate(-24 58 36)"/>
    <circle cx="47" cy="34" r="3.4" fill="#fff" opacity=".7"/>
    <g class="g-face">
      <ellipse class="g-cheek" cx="50" cy="84" rx="8" ry="5" fill="#ff7a8a" opacity=".45"/>
      <ellipse class="g-cheek" cx="110" cy="84" rx="8" ry="5" fill="#ff7a8a" opacity=".45"/>
      <g class="g-eyes">
        <ellipse cx="62" cy="68" rx="9" ry="12" fill="#22100a"/><ellipse cx="98" cy="68" rx="9" ry="12" fill="#22100a"/>
        <circle cx="65" cy="63" r="3.6" fill="#fff"/><circle cx="101" cy="63" r="3.6" fill="#fff"/>
        <circle cx="59.5" cy="73" r="1.6" fill="#fff" opacity=".6"/><circle cx="95.5" cy="73" r="1.6" fill="#fff" opacity=".6"/>
      </g>
      <path class="g-mouth" d="M70 92q10 9 20 0" stroke="#22100a" stroke-width="4" fill="#5a1a08" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
}
