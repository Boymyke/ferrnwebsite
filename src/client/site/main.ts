/* Ferrn public site — progressive enhancement. Everything works without JS except the
   chat, checkout and animations. */
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

/* ── write-on text ── */
async function prepareWriteOn(el: HTMLElement) {
  const svg = $<SVGSVGElement>('svg', el);
  const text = $<SVGTextElement>('text', el);
  if (!svg || !text) return;
  // Never let a slow font block the hero: wait at most 1.2 s, then draw with whatever is loaded.
  try { await Promise.race([(document as any).fonts?.load?.('100px "Pinyon Script"', text.textContent || ''), new Promise((r) => setTimeout(r, 1200))]); } catch {}
  // CJK and other scripts the calligraphic font can't render fall back to Poppins.
  if (/[぀-鿿]/.test(text.textContent || '')) el.classList.add('plain');
  const b = text.getBBox();
  const pad = 14;
  svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
  const len = Math.ceil((b.width + b.height) * 3.2);
  text.style.strokeDasharray = String(len);
  text.style.strokeDashoffset = String(len);
}
function drawWriteOn(el: HTMLElement) {
  requestAnimationFrame(() => el.classList.add('draw'));
}

/* ── reveal + counters ── */
function observe() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.classList.add('in');
      if (el.matches('[data-count]')) countUp(el);
      if (el.matches('[data-writeon]') && !el.closest('.hero')) drawWriteOn(el);
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.reveal, [data-count], [data-writeon]').forEach((el) => io.observe(el));
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

/* ── chrome: theme, menu, filters, currency, slider ── */
function chrome() {
  $('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = html.dataset.theme === 'light' ? 'dark' : 'light';
    html.dataset.theme = next;
    try { localStorage.setItem('ferrn-theme', next); } catch {}
  });
  const menuBtn = $('[data-menu-toggle]'), panel = $('[data-mobile-panel]');
  menuBtn?.addEventListener('click', () => {
    const open = panel!.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    const menu = $<HTMLDetailsElement>('.lang-menu');
    if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
  });
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
  };
  $$('[data-currency]').forEach((b) => b.addEventListener('click', () => setCurrency(b.dataset.currency!)));
  try {
    const saved = localStorage.getItem('ferrn-currency');
    const guess = saved || (/^(en-US|en-GB|en-CA|de|fr|es|zh)/.test(navigator.language) && lang !== 'yo' && lang !== 'ig' && lang !== 'ha' && !/NG/.test(navigator.language) ? 'USD' : 'NGN');
    if (guess === 'USD') setCurrency('USD');
  } catch {}

  $$('[data-slider]').forEach((s) => {
    const track = $('.testimonial-track', s)!; const n = track.children.length; let i = 0;
    const go = (d: number) => { i = (i + d + n) % n; track.style.transform = `translateX(-${i * 100}%)`; };
    $('[data-next]', s)?.addEventListener('click', () => go(1));
    $('[data-prev]', s)?.addEventListener('click', () => go(-1));
    let timer = setInterval(() => go(1), 7000);
    s.addEventListener('pointerenter', () => clearInterval(timer));
    s.addEventListener('pointerleave', () => { timer = setInterval(() => go(1), 7000); });
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

/* ── AI assistant with a Nigerian voice ── */
function chat() {
  const root = $('[data-chat]'); if (!root) return;
  const panel = $('.chat-panel', root)!, log = $('[data-chat-log]', root)!, form = $<HTMLFormElement>('[data-chat-form]', root)!;
  const input = $<HTMLInputElement>('input[name=q]', form)!, voiceToggle = $<HTMLInputElement>('[data-chat-voice]', root)!;
  const KEY = 'ferrn-chat';
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch {}
  const session = (() => { try { let s = sessionStorage.getItem('ferrn-chat-s'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('ferrn-chat-s', s); } return s; } catch { return ''; } })();
  try { voiceToggle.checked = localStorage.getItem('ferrn-voice') === '1'; } catch {}
  voiceToggle.addEventListener('change', () => { try { localStorage.setItem('ferrn-voice', voiceToggle.checked ? '1' : '0'); } catch {} });

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const linkify = (s: string) => esc(s)
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(\/(?:marketplace|work|services|contact|team|insights)[\w\-/]*)/g, '$1<a href="$2">$2</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const add = (role: 'me' | 'bot', text: string) => {
    const d = document.createElement('div');
    d.className = `msg ${role}`;
    d.innerHTML = linkify(text);
    if (role === 'bot') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'speak'; b.textContent = '🔊 ' + (S.voice || 'Listen');
      b.addEventListener('click', () => speak(text)); d.appendChild(document.createElement('br')); d.appendChild(b);
    }
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  };
  const render = () => {
    log.innerHTML = '';
    add('bot', S.welcome);
    history.forEach((m) => add(m.role === 'user' ? 'me' : 'bot', m.content));
  };

  let audio: HTMLAudioElement | null = null;
  async function speak(text: string) {
    const plain = text.replace(/https?:\/\/\S+/g, '').replace(/[*#_]/g, '');
    audio?.pause();
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: plain, lang }) });
      if (r.ok && (r.headers.get('content-type') || '').includes('audio')) {
        audio = new Audio(URL.createObjectURL(await r.blob()));
        await audio.play();
        return;
      }
    } catch {}
    // Browser fallback: prefer a Nigerian English voice when the device has one.
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(plain);
    const voices = speechSynthesis.getVoices();
    const want = lang === 'en' || lang === 'yo' || lang === 'ig' || lang === 'ha' ? ['en-NG', 'en-GB', 'en'] : [lang];
    u.voice = want.map((w) => voices.find((v) => v.lang.replace('_', '-').startsWith(w))).find(Boolean) || null;
    u.rate = 0.98;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  const open = () => { panel.hidden = false; if (!log.children.length) render(); input.focus(); };
  $('[data-chat-open]', root)!.addEventListener('click', () => (panel.hidden ? open() : (panel.hidden = true)));
  $('[data-chat-close]', root)!.addEventListener('click', () => { panel.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    input.value = '';
    add('me', q);
    const typing = document.createElement('div'); typing.className = 'msg bot typing'; typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing); log.scrollTop = log.scrollHeight;
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q, history, lang, path: location.pathname, session }) });
      const j = await r.json();
      typing.remove();
      add('bot', j.message);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: j.message });
      history = history.slice(-12);
      try { sessionStorage.setItem(KEY, JSON.stringify(history)); } catch {}
      if (voiceToggle.checked) speak(j.message);
    } catch {
      typing.remove(); add('bot', S.error);
    }
  });

  // Speech input (Chrome/Edge/Safari): talk to the assistant.
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const mic = $<HTMLButtonElement>('[data-chat-mic]', root)!;
  if (!SR) { mic.hidden = true; return; }
  const bcp: Record<string, string> = { en: 'en-NG', yo: 'yo-NG', ig: 'ig-NG', ha: 'ha-NG', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', zh: 'zh-CN' };
  mic.addEventListener('click', () => {
    const rec = new SR(); rec.lang = bcp[lang] || 'en-NG'; rec.interimResults = false;
    mic.classList.add('rec');
    rec.onresult = (ev: any) => { input.value = ev.results[0][0].transcript; voiceToggle.checked = true; form.requestSubmit(); };
    rec.onend = () => mic.classList.remove('rec');
    rec.start();
  });
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

/* ── boot ── */
html.classList.remove('no-js');
try { track(); } catch {}
chrome(); forms(); chat();
const writeOns = $$<HTMLElement>('[data-writeon]');
Promise.all(writeOns.map(prepareWriteOn)).then(() => {
  observe();
  runIntro(() => $$<HTMLElement>('.hero [data-writeon]').forEach((el) => setTimeout(() => drawWriteOn(el), 150)));
});
