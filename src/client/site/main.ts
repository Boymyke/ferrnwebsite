/* Ferrn public site, progressive enhancement. Everything works without JS except Bob,
   checkout and animations. */
import { bobLauncher, personalise, prefillContact } from './bob-launcher';
import { music } from './music';
import { home } from './hero';
type Strings = Record<string, string>;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const html = document.documentElement;
let lang = document.body.dataset.lang || 'en';
let S: Strings = JSON.parse(document.body.dataset.i18n || '{}');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── intro: "Websites? / Web apps? / AI automations?" type in and out → "all in FERRN" → an orange curtain drops,
   a black one follows, and both carry on down to reveal the page. Once per session; Escape ends it. ── */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function runIntro(done: () => void) {
  const intro = $('.intro');
  if (!intro || !html.classList.contains('play-intro')) return done();
  const text = $('[data-intro-text]', intro)!, typeBox = $('.intro-type', intro)!;
  let finished = false, skipped = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem('ferrn-intro', '1'); } catch {}
    html.classList.remove('play-intro');
    done();
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !finished) { skipped = true; finish(); } }, { once: true });
  const type = async (word: string, speed: number) => { for (let i = 1; i <= word.length && !skipped; i++) { text.textContent = word.slice(0, i); await wait(speed); } };
  const untype = async (speed: number) => { while (text.textContent && !skipped) { text.textContent = text.textContent.slice(0, -1); await wait(speed); } };
  (async () => {
    await wait(250);
    for (const w of (intro.dataset.introWords || '').split('|')) { await type(w, 38); await wait(360); await untype(14); await wait(100); }
    const [lead, brand] = (intro.dataset.introFinal || 'all in|FERRN').split('|');
    await type(lead, 44);
    const b = document.createElement('span'); b.className = 'intro-brand'; text.after(b);
    for (let i = 1; i <= brand.length && !skipped; i++) { b.textContent = brand.slice(0, i); await wait(52); }
    await wait(750);
    intro.classList.add('drop');          // orange, then black, fall over the words…
    await wait(1250);
    intro.classList.add('away');          // …and the whole stack keeps falling, uncovering the page
    await wait(900);
    finish();
  })().catch(finish);
  setTimeout(finish, 12000); // safety net
}

/* ── reveals: lines (gradient mask), text clips, fades, counters, wordmark ── */
function observe() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      if (el.matches('[data-lines]')) $$<HTMLElement>('.line-in', el).forEach((l, i) => l.style.setProperty('--i', String(i)));
      el.classList.add('in');
      if (el.matches('[data-count]')) countUp(el);
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.reveal, .reveal-text, [data-lines], [data-count], .footer-mark').forEach((el) => io.observe(el));
}
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count || 0), suffix = el.dataset.suffix || '';
  if (reduced) { el.textContent = target + suffix; return; }
  const t0 = performance.now(), dur = 1600;
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(target * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── lazy looping clips: load and play only when near the viewport, pause when away ── */
function clips() {
  const vids = $$<HTMLVideoElement>('video[data-src]');
  if (!vids.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) { if (!v.src) { v.src = v.dataset.src!; v.load(); } if (!reduced) v.play().catch(() => {}); }
      else if (v.src) v.pause();
    }
  }, { rootMargin: '200px 0px' });
  vids.forEach((v) => io.observe(v));
}

/* ── motion: hero light follows the pointer, cover parallax, nav hides on scroll down ── */
let para: HTMLElement[] = [], lightRooms: HTMLElement[] = [], darkRooms: HTMLElement[] = [], onScrollNow = () => {};
function heroPointer() {
  const hero = $('[data-hero]');
  if (hero && !reduced && matchMedia('(hover: hover)').matches) {
    let raf = 0, mx = 0.5, my = 0.5;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; hero.style.setProperty('--mx', mx.toFixed(3)); hero.style.setProperty('--my', my.toFixed(3)); });
    }, { passive: true });
  }
}
function refreshScroll() { para = $$<HTMLElement>('[data-parallax] img'); lightRooms = $$('.section-light'); /* rooms follow the theme now, so the nav only flips over explicitly light sections */ onScrollNow(); }
function motion() {
  heroPointer();
  const nav = $('[data-nav]');
  let last = scrollY, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    if (nav) {
      // No bar behind the nav: it floats. Over a light section its ink flips so it stays readable.
      const mid = 36;
      const under = (els: HTMLElement[]) => els.some((el) => { const r = el.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
      nav.classList.toggle('on-light', under(lightRooms));
      nav.classList.toggle('on-dark', under(darkRooms));
      nav.classList.toggle('hide', y > 320 && y > last && !document.body.classList.contains('menu-open'));
    }
    if (!reduced) for (const img of para) {
      const r = img.parentElement!.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      img.style.transform = `translateY(${(p * -6).toFixed(2)}%) scale(1.12)`;
    }
    last = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScrollNow = onScroll;
  refreshScroll();
}

/* ── idle storytelling: after N seconds without input, full-screen lines; any input dismisses ── */
function idle() {
  const el = $('.idle[data-idle]'); if (!el) return;
  const cfg = document.body.dataset.idle || '45';
  if (cfg === '0') return;
  let off = false; try { off = localStorage.getItem('ferrn-idle-off') === '1'; } catch {}
  if (off || reduced) return;
  const secs = Math.max(15, Number(cfg) || 45);
  const lines = $$<HTMLElement>('.idle-lines p', el);
  let timer = 0, on = false, cycle = 0, li = 0;
  const show = () => {
    if (on || document.visibilityState !== 'visible' || document.documentElement.classList.contains('bob-open') || document.documentElement.classList.contains('bob-touring') || document.body.classList.contains('menu-open') || document.querySelector('dialog[open]')) return arm();
    on = true; el.hidden = false; el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => el.classList.add('on'));
    li = 0; lines.forEach((l, i) => l.classList.toggle('on', i === 0));
    cycle = window.setInterval(() => { lines[li].classList.remove('on'); li = (li + 1) % lines.length; lines[li].classList.add('on'); }, 4200);
  };
  const hide = () => {
    if (!on) return; on = false; clearInterval(cycle);
    el.classList.remove('on'); setTimeout(() => { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }, 800);
  };
  const arm = () => { clearTimeout(timer); timer = window.setTimeout(show, secs * 1000); };
  const poke = () => { hide(); arm(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) addEventListener(ev, poke, { passive: true });
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? arm() : clearTimeout(timer)));
  $('[data-idle-off]', el)?.addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem('ferrn-idle-off', '1'); } catch {} hide(); clearTimeout(timer); });
  arm();
}

/* ── seasonal particles (snow, confetti, hearts, sparkle), light, CSS-driven ── */
function season() {
  const preset = html.dataset.season; if (!preset || reduced) return;
  const fx: Record<string, { cls: string; n: number; colors: string[] }> = {
    christmas: { cls: 'fx-snow', n: 40, colors: ['#fff', '#e8f1ff'] },
    'new-year': { cls: 'fx-confetti', n: 50, colors: ['#ff4100', '#ffd27a', '#fff', '#8ad1ff'] },
    valentine: { cls: 'fx-hearts', n: 18, colors: ['#ff4d8d'] },
    independence: { cls: 'fx-confetti', n: 40, colors: ['#1aa64b', '#fff', '#1aa64b'] },
    halloween: { cls: 'fx-sparkle', n: 24, colors: ['#ff7a00', '#ffd27a'] },
    easter: { cls: 'fx-sparkle', n: 24, colors: ['#ffd27a', '#b7e4c7', '#ffb3c6'] },
  };
  const f = fx[preset]; if (!f) return;
  const box = document.createElement('div'); box.className = `season-fx ${f.cls}`; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < f.n; i++) {
    const p = document.createElement('i');
    const s = 4 + Math.random() * (f.cls === 'fx-hearts' ? 14 : 8);
    p.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--t:${(8 + Math.random() * 10).toFixed(1)}s;--dl:-${(Math.random() * 18).toFixed(1)}s;--o:${(0.4 + Math.random() * 0.5).toFixed(2)};--c:${f.colors[i % f.colors.length]}`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  // stop after 40 s so it's a greeting, not a nuisance
  setTimeout(() => { box.style.transition = 'opacity 2s'; box.style.opacity = '0'; setTimeout(() => box.remove(), 2100); }, 40_000);
}

/* ── chrome: theme, menu, filters, currency, slider ── */
/* ── nav: clock + country in the middle, the hamburger opens the control centre ── */
function clock() {
  const tick = () => {
    const el = $('[data-clock]'); if (!el) return;
    const d = new Date();
    const date = new Intl.DateTimeFormat(navigator.language || 'en', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    el.innerHTML = `<span class="nav-date">${date} · </span><b>${hh}:${mm}</b>`;
    (el as HTMLTimeElement).dateTime = d.toISOString();
  };
  tick(); setInterval(tick, 10_000);
}
/* Country + emoji flag. Windows has no flag emoji, so there a small bundled font (Twemoji country flags,
   graphics CC-BY 4.0) draws them; everywhere else the system emoji is used. */
let geoCode = '';
function flagSupport() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d', { willReadFrequently: true })!; x.font = '14px sans-serif'; x.textBaseline = 'top'; x.fillText('\u{1F1F3}\u{1F1EC}', 0, 0);
    const d = x.getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && (Math.abs(d[i] - d[i + 1]) > 30 || Math.abs(d[i + 1] - d[i + 2]) > 30)) return true;
  } catch {}
  return false;
}
function geo() {
  const show = (code: string) => {
    const el = $('[data-geo]'); if (!el) return;
    if (!/^[A-Z]{2}$/i.test(code) || code === 'XX' || code === 'T1') return;
    geoCode = code.toUpperCase();
    let country = geoCode;
    try { country = new Intl.DisplayNames([document.documentElement.lang || navigator.language || 'en'], { type: 'region' }).of(geoCode) || geoCode; } catch {}
    $('[data-geo-name]', el)!.textContent = country;
    $('[data-geo-flag]', el)!.textContent = geoCode.replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
    el.hidden = false;
  };
  if (!flagSupport()) html.classList.add('flag-font');
  if (geoCode) return show(geoCode);
  try { const c = sessionStorage.getItem('ferrn-geo'); if (c) { const g = JSON.parse(c); if (g.country) return show(g.country); } } catch {}
  fetch('/api/geo', { cache: 'no-store' }).then((r) => r.json()).then((g: { country?: string }) => {
    if (!g?.country) return;
    try { sessionStorage.setItem('ferrn-geo', JSON.stringify({ country: g.country })); } catch {}
    show(g.country);
  }).catch(() => {});
}

function toast(msg: string) {
  let t = $('.cc-toast'); if (!t) { t = document.createElement('div'); t.className = 'cc-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); setTimeout(() => t!.classList.remove('show'), 1800);
}

/* Reading guide: a soft band that follows the pointer so the line being read stands out. */
let guideEl: HTMLElement | null = null;
const moveGuide = (e: PointerEvent) => { if (guideEl) guideEl.style.transform = `translateY(${e.clientY - 22}px)`; };
function guide(on: boolean) {
  if (on && !guideEl) {
    guideEl = document.createElement('div'); guideEl.className = 'read-guide'; guideEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(guideEl); addEventListener('pointermove', moveGuide, { passive: true });
  } else if (!on && guideEl) { guideEl.remove(); guideEl = null; removeEventListener('pointermove', moveGuide); }
}

let closeMenu = () => {};
function chrome() {
  // Theme: dark (default) / light / auto (follows the OS).
  const mq = matchMedia('(prefers-color-scheme: light)');
  const applyTheme = (mode: string) => {
    html.dataset.theme = mode === 'system' ? (mq.matches ? 'light' : 'dark') : mode;
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeSet === mode)));
    try { localStorage.setItem('ferrn-theme', mode); } catch {}
  };
  let saved = ''; try { saved = localStorage.getItem('ferrn-theme') || ''; } catch {}
  $$('[data-theme-set]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.themeSet === (saved || 'dark'))); b.addEventListener('click', () => applyTheme(b.dataset.themeSet!)); });
  mq.addEventListener('change', () => { try { if (localStorage.getItem('ferrn-theme') === 'system') applyTheme('system'); } catch {} });
  $('[data-theme-toggle]')?.addEventListener('click', () => applyTheme(html.dataset.theme === 'light' ? 'dark' : 'light'));

  // Accessibility, remembered per browser; the head script re-applies the classes before paint.
  let a11y: Record<string, boolean | number> = {}; try { a11y = JSON.parse(localStorage.getItem('ferrn-a11y') || '{}'); } catch {}
  const saveA11y = () => { try { localStorage.setItem('ferrn-a11y', JSON.stringify(a11y)); } catch {} };
  const applySize = (n: number) => {
    html.classList.toggle('a11y-text', n === 1); html.classList.toggle('a11y-text2', n === 2);
    $$('[data-text-size]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.textSize) === n)));
  };
  applySize(Number(a11y.size) || 0);
  $$('[data-text-size]').forEach((b) => b.addEventListener('click', () => { a11y.size = Number(b.dataset.textSize); applySize(a11y.size); saveA11y(); }));
  const setFlag = (k: string, on: boolean) => {
    html.classList.toggle('a11y-' + k, on);
    $(`[data-a11y="${k}"]`)?.setAttribute('aria-pressed', String(on));
    if (k === 'media') $$<HTMLVideoElement>('video').forEach((v) => (on ? v.pause() : v.autoplay && v.play().catch(() => {})));
    if (k === 'guide') guide(on);
  };
  $$('[data-a11y]').forEach((b) => {
    const k = b.dataset.a11y!;
    setFlag(k, !!a11y[k]);
    b.addEventListener('click', () => { a11y[k] = !a11y[k]; setFlag(k, !!a11y[k]); saveA11y(); });
  });
  $('[data-a11y-reset]')?.addEventListener('click', () => {
    Object.keys(a11y).forEach((k) => k !== 'size' && setFlag(k, false));
    a11y = {}; applySize(0); saveA11y();
  });

  // Control centre.
  const menuBtn = $('[data-menu-toggle]'), panel = $('[data-mobile-panel]');
  const setMenu = (open: boolean) => {
    if (!open) setLangs(false);
    panel?.classList.toggle('open', open); if (panel) { if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', ''); }
    menuBtn?.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
    menuBtn && (menuBtn.innerHTML = open
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>');
    if (open) setTimeout(() => $('.cc-close', panel!)?.focus(), 350); else menuBtn?.focus();
  };
  closeMenu = () => { if (panel?.classList.contains('open')) setMenu(false); };
  menuBtn?.addEventListener('click', () => setMenu(!panel?.classList.contains('open')));
  $$('[data-cc-close]').forEach((b) => b.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (langsOpen()) { setLangs(false); $('[data-lang-toggle]')?.focus(); } else if (panel?.classList.contains('open')) setMenu(false);
  });
  // Languages open as an overlay over the panels (the control centre doesn't change height).
  function langsOpen() { return !($('[data-lang-list]')?.hidden ?? true); }
  function setLangs(open: boolean) {
    const list = $('[data-lang-list]'); if (list) list.hidden = !open;
    $('[data-lang-toggle]')?.setAttribute('aria-expanded', String(open));
    panel?.classList.toggle('langs-open', open);
  }
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-lang-toggle]')) { setLangs(!langsOpen()); if (langsOpen()) setTimeout(() => $<HTMLElement>('.cc-langs a[aria-current]')?.focus(), 50); return; }
    if (langsOpen() && !t.closest('[data-lang-list]')) setLangs(false);
  });
  // Footer language link opens the control centre with the language list expanded.
  $$('[data-lang-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setMenu(true); setLangs(true); setTimeout(() => $('.cc-langs a')?.focus(), 500); }));
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLElement>('[data-set-lang]');
    if (a) document.cookie = `ferrn_lang=${a.dataset.setLang}; path=/; max-age=31536000; samesite=lax`;
  }, true);
  music();
}

/* ── page-level widgets (re-run after a soft page change) ── */
/* About bento: a soft light follows the pointer inside each card (two CSS variables, one write per frame). */
function aboutTiles() {
  if (reduced || !matchMedia('(hover: hover)').matches) return;
  $$<HTMLElement>('[data-ab] [data-tilt]').forEach((el) => {
    let raf = 0, x = 0, y = 0;
    el.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${x - r.left}px`); el.style.setProperty('--my', `${y - r.top}px`);
      });
    }, { passive: true });
  });
}

/* "What Ferrn offers": cycles through the services; the bar under the active one fills while it shows.
   Pauses on hover/focus and when off screen; clicking a bar jumps to it. */
function offers() {
  $$<HTMLElement>('[data-offers]').forEach((card) => {
    const slides = $$<HTMLElement>('.ab-offer', card), glows = $$<HTMLElement>('.ab-offers-glow span', card), bars = $$<HTMLButtonElement>('.ab-offers-bars button', card);
    const n = slides.length; if (n < 2) return;
    const DUR = 4200; let i = 0, timer = 0, visible = false, held = false;
    card.style.setProperty('--dur', `${DUR}ms`);
    const show = (k: number) => {
      i = (k + n) % n;
      slides.forEach((el, j) => { el.classList.toggle('on', j === i); el.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
      glows.forEach((el, j) => el.classList.toggle('on', j === i));
      bars.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i ? 'true' : 'false'); const bar = b.firstElementChild as HTMLElement; bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; });
    };
    const tick = () => { clearTimeout(timer); if (!visible || held || reduced) return; timer = window.setTimeout(() => { show(i + 1); tick(); }, DUR); };
    bars.forEach((b, j) => b.addEventListener('click', () => { show(j); tick(); }));
    const hold = (v: boolean) => { held = v; card.classList.toggle('paused', v); if (!v) { show(i); tick(); } else clearTimeout(timer); };
    card.addEventListener('pointerenter', () => hold(true)); card.addEventListener('pointerleave', () => hold(false));
    card.addEventListener('focusin', () => hold(true)); card.addEventListener('focusout', () => hold(false));
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { show(i); tick(); } else clearTimeout(timer); }, { threshold: 0.3 }).observe(card);
    if (reduced) card.classList.add('paused');
  });
}

function pageBits() {
  home(reduced);
  aboutTiles();
  offers();
  $$<HTMLButtonElement>('[data-filter]').forEach((btn) => btn.addEventListener('click', () => {
    const scope = btn.closest('section') || document;
    $$('[data-filter]', btn.parentElement!).forEach((b) => b.classList.toggle('active', b === btn));
    const f = btn.dataset.filter!;
    const grid = $('[data-filter-grid]', scope) || $('[data-filter-grid]');
    $$<HTMLElement>('[data-category]', grid!).forEach((card) => card.classList.toggle('is-hidden', f !== 'all' && card.dataset.category !== f));
  }));

  const setCurrency = (cur: string) => {
    try { localStorage.setItem('ferrn-currency', cur); } catch {}
    $$('[data-currency]').forEach((b) => b.classList.toggle('active', b.dataset.currency === cur));
    $$('.product-price').forEach((p) => {
      const [setup, month] = (p.dataset[cur === 'USD' ? 'priceUsd' : 'priceNgn'] || '').split('|').map(Number);
      const fmt = (n: number) => (cur === 'USD' ? '$' + n.toLocaleString('en-US') : '₦' + n.toLocaleString('en-NG'));
      const main = $('.price-main', p), sub = $('.price-sub', p);
      if (main && month) main.innerHTML = `${fmt(month)}<small>${main.querySelector('small')?.textContent ?? ''}</small>`;
      if (sub && setup) sub.textContent = sub.textContent!.replace(/[₦$][\d,]+/, fmt(setup));
    });
    $$('.plan-price').forEach((p) => {
      const v = p.dataset[cur === 'USD' ? 'usd' : 'ngn'];
      if (v && p.firstChild) p.firstChild.textContent = v + ' ';
    });
    $$('.plan-extra').forEach((p) => { const v = p.dataset[cur === 'USD' ? 'usd' : 'ngn']; if (v) p.textContent = v; });
  };
  $$('[data-currency]').forEach((b) => b.addEventListener('click', () => setCurrency(b.dataset.currency!)));
  try {
    const saved = localStorage.getItem('ferrn-currency');
    const guess = saved || (/^(en-US|en-GB|en-CA|de|fr|es|zh)/.test(navigator.language) && lang !== 'yo' && lang !== 'ig' && lang !== 'ha' && !/NG/.test(navigator.language) ? 'USD' : 'NGN');
    if (guess === 'USD') setCurrency('USD');
  } catch {}

  $$('[data-quotes]').forEach((s) => {
    const track = $('.quotes-track', s)!; const n = track.children.length; let i = 0;
    const pos = $('[data-quotes-pos]', s);
    const go = (d: number) => { i = (i + d + n) % n; (track.children[i] as HTMLElement).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'start' }); pos && (pos.textContent = `${i + 1} / ${n}`); };
    $('[data-next]', s)?.addEventListener('click', () => go(1));
    $('[data-prev]', s)?.addEventListener('click', () => go(-1));
    // Several cards can be in view at once: step by one card's width (plus the gap).
    const step = () => { const c = track.children[0] as HTMLElement | undefined; return c ? c.offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth; };
    track.addEventListener('scroll', () => { const k = Math.min(n - 1, Math.round(track.scrollLeft / Math.max(1, step()))); if (k !== i) { i = k; pos && (pos.textContent = `${i + 1} / ${n}`); } }, { passive: true });
  });

  // Voice-note testimonials: one plays at a time; bars animate while playing. A card with the client's own
  // recording plays it; otherwise the site reads their words aloud (server voice, else the device's voice).
  const players = $$<HTMLElement>('[data-voice]');
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  let stopCurrent: (() => void) | null = null;
  players.forEach((v) => {
    const btn = $('[data-voice-play]', v)!, time = $('[data-voice-time]', v);
    const initial = time?.textContent || '';
    let a = $<HTMLAudioElement>('audio', v);
    let speaking = false;
    const done = () => { v.classList.remove('playing', 'loading'); speaking = false; if (time) time.textContent = a && a.duration ? fmt(a.duration) : initial; if (stopCurrent === stop) stopCurrent = null; };
    const stop = () => { if (a && !a.paused) a.pause(); if (speaking) { try { speechSynthesis.cancel(); } catch {} } done(); };
    const wire = (el: HTMLAudioElement) => {
      el.addEventListener('play', () => { v.classList.remove('loading'); v.classList.add('playing'); });
      el.addEventListener('pause', done);
      el.addEventListener('ended', () => { el.currentTime = 0; done(); });
      el.addEventListener('timeupdate', () => time && (time.textContent = fmt(el.currentTime)));
      el.addEventListener('loadedmetadata', () => time && !v.classList.contains('playing') && (time.textContent = fmt(el.duration)));
    };
    if (a) wire(a);
    const say = v.dataset.say;
    btn.addEventListener('click', async () => {
      if (v.classList.contains('playing') || v.classList.contains('loading')) return stop();
      stopCurrent?.(); stopCurrent = stop;
      if (a) { a.play().catch(done); return; }
      if (!say) return;
      v.classList.add('loading');
      try {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: say, lang }) });
        const type = r.headers.get('content-type') || '';
        if (!r.ok || !/audio/.test(type)) throw new Error('no server voice');
        a = new Audio(URL.createObjectURL(await r.blob())); wire(a);
        if (stopCurrent !== stop) return done(); // pressed something else meanwhile
        await a.play();
      } catch {
        // The device's own voice.
        try {
          const u = new SpeechSynthesisUtterance(say); u.rate = 1; speaking = true;
          u.onstart = () => { v.classList.remove('loading'); v.classList.add('playing'); };
          u.onend = u.onerror = () => done();
          speechSynthesis.cancel(); speechSynthesis.speak(u);
        } catch { done(); }
      }
    });
  });
}

/* ── forms ── */
function forms() {
  $$<HTMLFormElement>('form[data-form]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('.form-status', form);
    const btn = $<HTMLButtonElement>('button[type=submit]', form);
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    data.lang = lang; data.path = location.pathname;
    btn && (btn.disabled = true);
    try {
      const r = await fetch(`/api/forms/${form.dataset.form}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      form.reset();
      if (status) status.textContent = S.sent;
    } catch (err: any) {
      if (status) status.textContent = err?.message || S.error;
    } finally { btn && (btn.disabled = false); }
  }));

  const dialog = $<HTMLDialogElement>('[data-checkout-dialog]');
  if (dialog) {
    const f = $<HTMLFormElement>('[data-checkout-form]', dialog)!;
    $$<HTMLButtonElement>('[data-checkout]').forEach((b) => b.addEventListener('click', () => {
      (f.elements.namedItem('tier') as HTMLInputElement).value = b.dataset.tier!;
      $('[data-checkout-tier]', dialog)!.textContent = b.closest('.plan')?.querySelector('h3')?.textContent || '';
      const cur = localStorage.getItem('ferrn-currency') || 'NGN';
      (f.elements.namedItem('currency') as HTMLSelectElement).value = cur;
      dialog.showModal();
    }));
    // One status card on the page: the dialog closes as soon as a button is pressed.
    const note = (html: string, tone: 'busy' | 'ok' | 'err', retry = false) => {
      let el = $<HTMLDivElement>('.checkout-note');
      if (!el) { el = document.createElement('div'); el.className = 'checkout-note'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
      el.className = `checkout-note ${tone}`;
      el.innerHTML = `<span class="checkout-note-ic" aria-hidden="true"></span><p>${html}</p>${retry ? '<button type="button" class="btn btn-ghost" data-retry>Try again</button>' : ''}<button type="button" class="checkout-note-x" aria-label="Close">×</button>`;
      el.querySelector('.checkout-note-x')!.addEventListener('click', () => el!.remove());
      el.querySelector('[data-retry]')?.addEventListener('click', () => { el!.remove(); dialog.showModal(); });
      if (tone === 'ok') setTimeout(() => el?.remove(), 12000);
    };
    const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
    let sending = false;
    f.addEventListener('submit', async (e) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value === 'cancel') return; // method="dialog" closes it
      e.preventDefault();
      if (sending || !f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
      const invoice = submitter?.value === 'invoice';
      if (invoice) data.mode = 'invoice';
      sending = true;
      dialog.close();
      note(invoice ? 'Sending your invoice request…' : 'Taking you to Paystack to pay securely…', 'busy');
      try {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({ ok: false }));
        if (!j.ok) throw new Error(j.error);
        if (j.url) { location.href = j.url; return; }
        note(esc(j.message || 'Thanks. We’ll be in touch shortly.'), 'ok');
        f.reset();
      } catch (err: any) {
        note(esc(err?.message || S.error), 'err', true);
      } finally { sending = false; }
    });
  }
}

/* ── first-party analytics: no cookies, no IPs; honours Do Not Track and GPC ── */
let softPageview = () => {};
function track() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  let path = (location.pathname.replace(/\/+$/, '') || '/').slice(0, 200);
  if (/^\/(?:studio|api)(?:\/|$)|^\/(?:q|p|i|demos)\//.test(path + '/') || /[?&]__noTrack=1(?:&|$)/.test(location.search)) return;
  if (nav.doNotTrack === '1' || (window as any).doNotTrack === '1' || nav.globalPrivacyControl === true) return;
  const rid = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return Array.from(a, (b) => (b % 36).toString(36)).join(''); };
  // Session: per tab, ends after 30 min of inactivity. Visitor: anonymous, long-lived.
  let sid = '', vid = '';
  try {
    const [s, at] = (sessionStorage.getItem('ferrn-a-s') || '').split('.');
    sid = s && Date.now() - Number(at) < 30 * 60_000 ? s : rid();
    vid = localStorage.getItem('ferrn-a-v') || rid();
    localStorage.setItem('ferrn-a-v', vid);
  } catch { sid = sid || rid(); vid = vid || sid; }
  const touch = () => { try { sessionStorage.setItem('ferrn-a-s', `${sid}.${Date.now()}`); } catch {} };
  const bucket = () => (innerWidth < 640 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop');
  const ua = navigator.userAgent;
  const deviceType = /iPad|Tablet|Silk|Kindle/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? 'tablet' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'mobile' : 'desktop';

  type Ev = Record<string, unknown> & { at: number };
  const queue: Ev[] = [];
  let timer = 0;
  const flush = () => {
    clearTimeout(timer); timer = 0;
    while (queue.length) {
      const t = Date.now();
      const body = JSON.stringify({ s: sid, v: vid, e: queue.splice(0, 40).map(({ at, ...e }) => ({ ...e, a: t - at })) });
      let sent = false;
      try { sent = !!navigator.sendBeacon?.('/api/a/collect', new Blob([body], { type: 'text/plain' })); } catch {}
      if (!sent) fetch('/api/a/collect', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
    }
    touch();
  };
  const push = (e: Record<string, unknown>, now = false) => {
    queue.push({ ...e, p: path, d: bucket(), at: Date.now() });
    if (now || queue.length >= 20) flush();
    else if (!timer) timer = window.setTimeout(flush, 5000);
  };

  const pageview = () => {
    let r = '';
    try { const h = document.referrer ? new URL(document.referrer).hostname : ''; r = h && h !== location.hostname ? h : ''; } catch {}
    const q = new URLSearchParams(location.search);
    const u: Record<string, string> = {};
    for (const k of ['source', 'medium', 'campaign']) { const v = q.get('utm_' + k); if (v) u[k] = v.slice(0, 120); }
    push({ t: 'pv', r, u, l: navigator.language, w: innerWidth, h: innerHeight, dt: deviceType }, true);
  };
  pageview();
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) { maxDepth = 0; sentDepth = -1; pageview(); } });

  // Clicks: position as a fraction of the whole document, plus a short label for the element.
  const label = (el: Element) => {
    const hit = el.closest('a,button,[role=button],summary,label,input,select,textarea,[data-track]') || el;
    const tag = hit.tagName.toLowerCase();
    let sel = tag + (hit.id ? '#' + hit.id : typeof (hit as HTMLElement).className === 'string' && (hit as HTMLElement).className.trim() ? '.' + (hit as HTMLElement).className.trim().split(/\s+/)[0] : '');
    if (/^(input|select|textarea)$/.test(tag)) sel += (hit as HTMLInputElement).name ? `[name=${(hit as HTMLInputElement).name}]` : '';
    else if (hit !== el || /^(a|button|summary|label)$/.test(tag)) {
      const text = ((hit as HTMLElement).dataset?.track || (hit as HTMLElement).innerText || hit.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (text) sel = `${tag} "${text.slice(0, 40)}"`;
    }
    return sel.slice(0, 60);
  };
  document.addEventListener('click', (e) => {
    // Keyboard-activated clicks have no position; clicks on the intro overlay say nothing about the page.
    if (!e.isTrusted || e.detail === 0 || html.classList.contains('play-intro')) return;
    const doc = document.documentElement;
    const w = Math.max(doc.scrollWidth, innerWidth), h = Math.max(doc.scrollHeight, innerHeight);
    push({ t: 'c', x: +(e.pageX / w).toFixed(4), y: +(e.pageY / h).toFixed(4), s: e.target instanceof Element ? label(e.target) : '' });
  }, { capture: true, passive: true });

  // Scroll depth: the deepest point seen, sent when the page is hidden or left.
  let maxDepth = 0, sentDepth = -1, ticking = false;
  const measure = () => {
    ticking = false;
    const h = document.documentElement.scrollHeight;
    maxDepth = Math.max(maxDepth, Math.min(100, Math.round(((scrollY + innerHeight) / Math.max(1, h)) * 100)));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }, { passive: true });
  setTimeout(measure, 800);
  const leave = () => {
    measure();
    if (maxDepth > sentDepth) { sentDepth = maxDepth; push({ t: 's', m: maxDepth }); }
    flush();
  };
  addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });

  softPageview = () => { leave(); path = (location.pathname.replace(/\/+$/, '') || '/').slice(0, 200); maxDepth = 0; sentDepth = -1; pageview(); };

  // Heartbeat while the tab is visible, so Live shows who is still reading.
  setInterval(() => { if (document.visibilityState === 'visible') push({ t: 'hb' }, true); }, 20_000);
}

/* ── consent: analytics (GA4 + first-party heatmaps) only after Accept, as the cookie policy says ── */
function consent() {
  let choice = '';
  try { choice = localStorage.getItem('ferrn-consent') || ''; } catch {}
  const start = () => { try { (window as any).ferrnLoadGA?.(); } catch {} try { track(); } catch {} };
  if (choice === 'all') return start();
  const bar = document.getElementById('consent');
  if (choice || !bar || /^\/(studio|q|p|i)\//.test(location.pathname + '/')) return;
  setTimeout(() => { bar.hidden = false; requestAnimationFrame(() => bar.classList.add('in')); }, 1200);
  bar.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-consent]')?.dataset.consent;
    if (!v) return;
    try { localStorage.setItem('ferrn-consent', v); } catch {}
    bar.classList.remove('in'); setTimeout(() => (bar.hidden = true), 250);
    if (v === 'all') start();
  });
}
// The footer's "Cookie settings" link (if present) reopens the choice.
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-cookie-settings]')) return;
  e.preventDefault(); try { localStorage.removeItem('ferrn-consent'); } catch {} location.reload();
});

/* ── soft page changes: while music is playing, links swap the page in place so the music never stops ── */
const musicOn = () => !!$('[data-music]')?.classList.contains('playing');
const SOFT_SKIP = /^\/(?:studio|api|media|preview|demos|q|p|i|assets|brand|icons|fonts|feed|sitemap)(?:\/|$|\.)/;
function softNav() {
  try { history.replaceState({ ...(history.state || {}), soft: true }, ''); } catch {}
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !musicOn()) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-hard')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || SOFT_SKIP.test(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return; // same-page anchor
    e.preventDefault();
    softGo(url, true);
  });
  addEventListener('popstate', (e) => { if ((e.state as { soft?: boolean } | null)?.soft) softGo(new URL(location.href), false); });
}
async function softGo(url: URL, push: boolean) {
  let doc: Document;
  try {
    const r = await fetch(url.href, { credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) throw new Error('not a page');
    doc = new DOMParser().parseFromString(await r.text(), 'text/html');
  } catch { location.href = url.href; return; }
  const newMain = doc.querySelector('main#main'), newFooter = doc.querySelector('footer.footer'), newCc = doc.querySelector('.cc');
  if (!newMain || !newCc) { location.href = url.href; return; }
  if (push) history.pushState({ soft: true }, '', url.href);
  const swap = () => {
    document.title = doc.title;
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
    if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    const nh = doc.documentElement;
    html.lang = nh.lang; html.dir = nh.dir; html.dataset.page = nh.dataset.page || 'page';
    document.body.dataset.lang = doc.body.dataset.lang || 'en'; document.body.dataset.i18n = doc.body.dataset.i18n || '{}';
    lang = document.body.dataset.lang!; try { S = JSON.parse(document.body.dataset.i18n!); } catch {}
    const main = $('main#main')!; main.innerHTML = newMain.innerHTML; main.className = newMain.className;
    const footer = $('footer.footer'); if (footer && newFooter) footer.replaceWith(document.importNode(newFooter, true));
    // Nav pieces that depend on the page or the language; theme, accessibility and music stay as they are.
    for (const sel of ['.cc-nav', '[data-lang-list]', '[data-lang-toggle]']) { const o = $(sel), n = newCc.querySelector(sel); if (o && n) o.replaceWith(document.importNode(n, true)); }
    const brand = doc.querySelector('.brand'); if (brand) $('.brand')?.setAttribute('href', brand.getAttribute('href') || '/');
    closeMenu();
    if (url.hash) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView(); else scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    observe(); clips(); forms(); pageBits(); heroPointer(); refreshScroll(); geo(); personalise(); prefillContact();
    softPageview();
  };
  const vt = (document as any).startViewTransition;
  if (vt && !reduced) vt.call(document, swap); else swap();
}

/* ── boot ── */
html.classList.remove('no-js'); html.classList.add('js');
consent();
chrome(); pageBits(); clock(); geo(); forms(); motion(); season(); clips(); softNav();
bobLauncher();
runIntro(() => { observe(); idle(); });
