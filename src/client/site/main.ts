/* Ferrn public site — progressive enhancement. Everything works without JS except Bob,
   checkout and animations. */
import { bob } from './bob';
type Strings = Record<string, string>;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const html = document.documentElement;
const lang = document.body.dataset.lang || 'en';
const S: Strings = JSON.parse(document.body.dataset.i18n || '{}');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── intro: mark draws → fills → grows over the screen → reveal (auto, no scroll) ── */
function runIntro(done: () => void) {
  const intro = $('.intro');
  if (!intro || !html.classList.contains('play-intro')) return done();
  const path = $<SVGPathElement>('.intro-mark-path', intro);
  if (path) intro.style.setProperty('--len', String(Math.ceil(path.getTotalLength())));
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem('ferrn-intro', '1'); } catch {}
    html.classList.remove('play-intro');
    done();
  };
  requestAnimationFrame(() => intro.classList.add('run'));
  intro.addEventListener('animationend', (e) => { if ((e as AnimationEvent).animationName === 'intro-out') finish(); });
  $('[data-intro-skip]', intro)?.addEventListener('click', finish);
  setTimeout(finish, 3400); // safety net
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

/* ── motion: hero light follows the pointer, cover parallax, nav hides on scroll down ── */
function motion() {
  const hero = $('[data-hero]');
  if (hero && !reduced && matchMedia('(hover: hover)').matches) {
    let raf = 0, mx = 0.5, my = 0.5;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; hero.style.setProperty('--mx', mx.toFixed(3)); hero.style.setProperty('--my', my.toFixed(3)); });
    }, { passive: true });
  }
  const para = $$<HTMLElement>('[data-parallax] img');
  const nav = $('[data-nav]');
  let last = scrollY, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    if (nav) {
      nav.classList.toggle('solid', y > 24);
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
  onScroll();
}

/* ── idle storytelling: after N seconds without input, full-screen lines; any input dismisses ── */
function idle() {
  const el = $('[data-idle]'); if (!el) return;
  const cfg = document.body.dataset.idle || '45';
  if (cfg === '0') return;
  let off = false; try { off = localStorage.getItem('ferrn-idle-off') === '1'; } catch {}
  if (off || reduced) return;
  const secs = Math.max(15, Number(cfg) || 45);
  const lines = $$<HTMLElement>('.idle-lines p', el);
  let timer = 0, on = false, cycle = 0, li = 0;
  const show = () => {
    if (on || document.visibilityState !== 'visible' || $('[data-bob][data-open]') || document.body.classList.contains('menu-open') || document.querySelector('dialog[open]')) return arm();
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

/* ── seasonal particles (snow, confetti, hearts, sparkle) — light, CSS-driven ── */
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
function chrome() {
  $('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = html.dataset.theme === 'light' ? 'dark' : 'light';
    html.dataset.theme = next;
    try { localStorage.setItem('ferrn-theme', next); } catch {}
  });
  const menuBtn = $('[data-menu-toggle]'), panel = $('[data-mobile-panel]');
  const setMenu = (open: boolean) => {
    panel?.classList.toggle('open', open); panel?.setAttribute('aria-hidden', String(!open));
    menuBtn?.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
    menuBtn && (menuBtn.innerHTML = open
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>');
  };
  menuBtn?.addEventListener('click', () => setMenu(!panel?.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel?.classList.contains('open')) setMenu(false); });
  // Footer language link opens the menu's language list (the only place languages live now).
  $$('[data-lang-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setMenu(true); setTimeout(() => $('.menu-langs a')?.focus(), 500); }));
  $$('[data-set-lang]').forEach((a) => a.addEventListener('click', () => {
    document.cookie = `ferrn_lang=${a.dataset.setLang}; path=/; max-age=31536000; samesite=lax`;
  }));

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
    track.addEventListener('scroll', () => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (k !== i) { i = k; pos && (pos.textContent = `${i + 1} / ${n}`); } }, { passive: true });
  });

  // Voice testimonials: one plays at a time; bars animate while playing.
  const players = $$('[data-voice]');
  players.forEach((v) => {
    const a = $<HTMLAudioElement>('audio', v)!, btn = $('[data-voice-play]', v)!, time = $('[data-voice-time]', v);
    const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    btn.addEventListener('click', () => { if (a.paused) { players.forEach((o) => o !== v && $<HTMLAudioElement>('audio', o)?.pause()); a.play(); } else a.pause(); });
    a.addEventListener('play', () => v.classList.add('playing'));
    a.addEventListener('pause', () => v.classList.remove('playing'));
    a.addEventListener('ended', () => { v.classList.remove('playing'); a.currentTime = 0; });
    a.addEventListener('timeupdate', () => time && (time.textContent = fmt(a.currentTime)));
    a.addEventListener('loadedmetadata', () => time && (time.textContent = fmt(a.duration)));
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
    f.addEventListener('submit', async (e) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value === 'cancel') return;
      e.preventDefault();
      if (!f.reportValidity()) return;
      const status = $('.form-status', f)!;
      const data = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
      if (submitter?.value === 'invoice') data.mode = 'invoice';
      status.textContent = '…';
      try {
        const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
        if (j.url) location.href = j.url; else status.textContent = j.message;
      } catch (err: any) { status.textContent = err?.message || S.error; }
    });
  }
}

/* ── first-party analytics: no cookies, no IPs; honours Do Not Track and GPC ── */
function track() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const path = (location.pathname.replace(/\/+$/, '') || '/').slice(0, 200);
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

/* ── boot ── */
html.classList.remove('no-js'); html.classList.add('js');
consent();
chrome(); forms(); motion(); season();
bob({ lang, S, reduced });
runIntro(() => { observe(); idle(); });
