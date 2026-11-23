/* Bob | Ferrn's assistant, loaded on demand (window.FerrnBob). An orange ghost with three ways to talk:
     Chat    , big quote-style messages; older ones fade but stay; Bob can point and click for you.
     Talk    , hands-free voice: you speak, he says "hmm…", answers out loud, listens again; transcript at the end.
     Present , a guided tour: asks your name, highlights parts of the site, asks a few questions, checks you're
                still there after 10 s of silence, and ends on the contact page with the form filled in.
   Nothing records or speaks until the visitor asks. Nothing is sent for them. */
import { NAME_KEY, personalise, prefillContact, readName } from '../site/bob-launcher';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ss = { get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

const root = $<HTMLElement>('[data-bob]')!;
const BOB = root?.dataset.bobName || 'Bob';
const lang = document.body.dataset.lang || 'en';
const S: Record<string, string> = (() => { try { return JSON.parse(document.body.dataset.i18n || '{}'); } catch { return {}; } })();
const at = (path: string) => (lang === 'en' ? path : `/${lang}${path === '/' ? '/' : path}`);
const here = () => location.pathname.replace(new RegExp(`^/${lang}(?=/|$)`), '') || '/';

/* ══ names ══ */
/** First name only; Latin letters; 2–12 characters. Returns {name} or {ask} with what to say instead. */
export function checkName(raw: string): { name?: string; ask?: string } {
  const t = raw.trim().replace(/^(my name is|i am|i'm|im|it's|its|call me|this is)\s+/i, '').replace(/[.!,]+$/, '');
  const first = t.split(/\s+/)[0] || '';
  if (!first) return { ask: 'What should I call you? Just your first name is perfect.' };
  if (/[0-9@#$%^&*_=+<>{}[\]\\/|~]/.test(first)) return { ask: 'That doesn’t look like a name to me. What’s your first name?' };
  if (!/^\p{Script=Latin}[\p{Script=Latin}'’-]*$/u.test(first)) return { ask: 'Could you type it in English letters for me? A short first name or nickname works best.' };
  if (first.length < 2) return { ask: 'Is that your full first name? Give me a couple more letters.' };
  if (first.length > 12) return { ask: `That’s a lovely long name, could I call you something shorter? A nickname under 12 letters keeps everything neat.` };
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return { name };
}
let visitor = readName();
const setVisitor = (n: string) => { visitor = n; ls.set(NAME_KEY, n); personalise(n); };
const fill = (s: string) => s.replace(/\{name\}/g, visitor || 'friend');

/* ══ voice ══ */
let soundOn = ls.get('ferrn-bob-sound') !== '0';
let serverVoice: boolean | null = root.dataset.bobVoice === 'browser' ? false : null;
let current: { stop: () => void } | null = null;
/** Is Bob talking right now? Drives every Stop button, the talking pose and the tour music ducking. */
let speakingNow = false;
const speakingHooks: ((on: boolean) => void)[] = [];
function setSpeaking(on: boolean) { if (on === speakingNow) return; speakingNow = on; speakingHooks.forEach((f) => f(on)); }
const fillerCache = new Map<string, Blob>();
function pickVoice() {
  const vs = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
  if (!['en', 'yo', 'ig', 'ha'].includes(lang)) return vs.find((x) => x.lang.toLowerCase().startsWith(lang)) || null;
  const low = (v: SpeechSynthesisVoice) => `${v.name} ${v.lang}`.toLowerCase();
  // 1. A genuine Nigerian voice on the device (Edge ships Microsoft Abeo and Ezinne; Bob is a he, so Abeo first).
  const ng = vs.filter((v) => /en[-_]ng/i.test(v.lang) || /abeo|ezinne|nigeria/i.test(v.name));
  const best = ng.find((v) => /abeo/i.test(v.name)) || ng.find((v) => /male/i.test(low(v)) && !/female/i.test(low(v))) || ng[0];
  if (best) return best;
  // 2. Otherwise a natural-sounding English voice, never the robotic default.
  const natural = vs.filter((v) => /^en/i.test(v.lang) && /natural|online|neural|premium|enhanced|google/i.test(v.name));
  const male = (v: SpeechSynthesisVoice) => /ryan|guy|thomas|daniel|arthur|male|davis|christopher|andrew|brian/i.test(v.name) && !/female/i.test(v.name);
  return natural.find((v) => /en[-_]gb/i.test(v.lang) && male(v)) || natural.find(male) || natural.find((v) => /en[-_]gb/i.test(v.lang)) || natural[0]
    || vs.find((v) => /en[-_]gb/i.test(v.lang) && male(v)) || vs.find((v) => /en[-_]gb/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => {});
/** Speaks and resolves when finished (or immediately if sound is off / no voice). */
export function speak(text: string, opts: { force?: boolean; level?: (n: number) => void } = {}): Promise<void> {
  hush();
  const plain = text.replace(/https?:\/\/\S+/g, '').replace(/[*#_`“”"]/g, '').replace(/\s+/g, ' ').trim();
  if (!plain || (!soundOn && !opts.force)) return Promise.resolve();
  return new Promise<void>(async (resolve) => {
    let done = false; const finish = () => { if (done) return; done = true; ghostLevel(0); setSpeaking(false); resolve(); };
    setSpeaking(true);
    if (serverVoice !== false) {
      try {
        const cached = fillerCache.get(plain);
        const blob = cached || await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: plain, lang }) })
          .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('audio') ? r.blob() : null));
        if (blob) {
          serverVoice = true; if (plain.length < 24) fillerCache.set(plain, blob);
          const a = new Audio(URL.createObjectURL(blob));
          let t = 0; const pulse = () => { if (done) return; t += 0.2; ghostLevel(0.3 + Math.abs(Math.sin(t)) * 0.5); requestAnimationFrame(pulse); };
          current = { stop: () => { a.pause(); finish(); } };
          a.onended = finish; a.onerror = finish;
          await a.play().catch(finish); if (!reduced) pulse(); return;
        }
        serverVoice = false;
      } catch { serverVoice = false; }
    }
    if (!('speechSynthesis' in window)) return finish();
    const u = new SpeechSynthesisUtterance(plain); const v = pickVoice(); u.voice = v; if (v) u.lang = v.lang; u.rate = 1; u.pitch = 1;
    let t = 0; const pulse = () => { if (done) return; t += 0.2; ghostLevel(0.3 + Math.abs(Math.sin(t)) * 0.5); requestAnimationFrame(pulse); };
    const t0 = performance.now();
    u.onend = () => {
      // Some devices have no voice and "finish" at once, keep the pacing so the tour stays readable.
      if (performance.now() - t0 < 150 && plain.length > 15) setTimeout(finish, Math.max(900, plain.split(/\s+/).length * 330)); else finish();
    };
    u.onerror = () => finish();
    current = { stop: () => { speechSynthesis.cancel(); finish(); } };
    speechSynthesis.speak(u); if (!reduced) pulse();
  });
}
export function hush() { current?.stop(); current = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); setSpeaking(false); }

/* ══ the ghost that moves around the page ══ */
const GHOST_SRC = root.querySelector('svg.ghost')?.outerHTML || '';
/** A copy of Bob's SVG with its own gradient ids (two copies on a page must not share ids). */
const ghostCopy = (id: string) => GHOST_SRC.replace(/bobg-/g, `${id}-`);
const GHOST_SVG = ghostCopy('bobg2');
const HAND_SVG = '<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><defs><radialGradient id="bobx-hand-g" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#ffc39c"/><stop offset=".55" stop-color="#ff6a2a"/><stop offset="1" stop-color="#d9480d"/></radialGradient></defs><g fill="url(#bobx-hand-g)" stroke="#a8380a" stroke-opacity=".4" stroke-width=".8"><rect x="3" y="9" width="20" height="7.4" rx="3.7" transform="rotate(45 6.7 12.7)"/><rect x="18" y="15" width="10" height="6.6" rx="3.3" transform="rotate(70 21 18)"/><rect x="23" y="16.5" width="10" height="6.6" rx="3.3" transform="rotate(80 26 20)"/><rect x="27.5" y="19" width="9" height="6.2" rx="3.1" transform="rotate(90 30.5 22)"/><ellipse cx="23" cy="27" rx="10" ry="9"/><rect x="8" y="24" width="12" height="6.6" rx="3.3" transform="rotate(-20 14 27)"/></g><ellipse cx="9.5" cy="11.5" rx="2.2" ry="1.3" fill="#fff" opacity=".45" transform="rotate(45 9.5 11.5)"/><ellipse cx="20" cy="23" rx="3.4" ry="2" fill="#fff" opacity=".38"/></svg>';
let ghost: HTMLElement | null = null;
function ghostEl() {
  if (ghost) return ghost;
  ghost = document.createElement('div'); ghost.className = 'bobx-ghost'; ghost.setAttribute('aria-hidden', 'true');
  ghost.innerHTML = `<div class="bobx-ghost-in">${GHOST_SVG}</div>`;
  document.body.appendChild(ghost);
  return ghost;
}
function ghostLevel(n: number) { const g = ghost || $('.bob-ghost'); g?.style.setProperty('--level', n.toFixed(2)); }
const home = () => { const r = $('.bob-ghost', root)!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
let gx = 0, gy = 0;
async function flyTo(x: number, y: number, ms = 900) {
  const g = ghostEl();
  g.classList.toggle('face-left', x < gx);
  // He leans into the direction of travel and leaves a faint trail while flying.
  const lean = Math.max(-14, Math.min(14, (x - gx) / 30));
  g.style.setProperty('--lean', `${lean}deg`); g.classList.add('flying');
  setTimeout(() => { g.classList.remove('flying'); g.style.setProperty('--lean', '0deg'); }, reduced ? 0 : ms);
  gx = x; gy = y;
  g.style.transition = reduced ? 'none' : `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
  g.style.transform = `translate(${Math.round(x - 32)}px, ${Math.round(y - 36)}px)`;
  await wait(reduced ? 0 : ms);
}
function placeAt(x: number, y: number) { const g = ghostEl(); gx = x; gy = y; g.style.transition = 'none'; g.style.transform = `translate(${Math.round(x - 32)}px, ${Math.round(y - 36)}px)`; }
/** Portal: the ghost spins into a ring of light and is gone (out), or spins out of one (in). */
async function portal(dir: 'in' | 'out', x: number, y: number) {
  const ring = document.createElement('div'); ring.className = `bobx-portal ${dir}`; ring.style.left = x + 'px'; ring.style.top = y + 'px';
  document.body.appendChild(ring);
  const g = ghostEl();
  if (dir === 'in') { placeAt(x, y); g.classList.add('tiny'); g.hidden = false; }
  await wait(reduced ? 0 : 260);
  g.classList.toggle('tiny', dir === 'out'); g.classList.add('spin');
  await wait(reduced ? 0 : 650);
  g.classList.remove('spin'); if (dir === 'out') g.hidden = true;
  ring.classList.add('close'); await wait(reduced ? 0 : 380); ring.remove();
}
/** A white-glove hand flies from Bob to an element, presses it, and then (optionally) clicks it. */
async function point(el: Element, click = false) {
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const from = ghost && !ghost.hidden ? { x: gx, y: gy } : home();
  ghost?.classList.add('pointing');
  const h = document.createElement('div'); h.className = 'bobx-hand'; h.innerHTML = HAND_SVG;
  h.style.transform = `translate(${from.x}px, ${from.y}px)`; document.body.appendChild(h);
  await wait(30);
  const tx = r.left + Math.min(r.width / 2, 40), ty = r.top + r.height / 2;
  h.style.transform = `translate(${tx - 4}px, ${ty - 8}px)`;
  await wait(reduced ? 0 : 700);
  h.classList.add('press'); el.classList.add('bobx-pressed');
  await wait(260);
  h.classList.remove('press');
  if (click) (el as HTMLElement).click();
  await wait(380); h.classList.add('gone'); el.classList.remove('bobx-pressed'); ghost?.classList.remove('pointing');
  setTimeout(() => h.remove(), 400);
}

/* ══ spotlight for the tour ══ */
let spot: HTMLElement | null = null, spotTarget: Element | null = null, spotRaf = 0;
function spotlight(el: Element | null) {
  spotTarget = el;
  if (!el) { spot?.classList.remove('on'); cancelAnimationFrame(spotRaf); return; }
  if (!spot) { spot = document.createElement('div'); spot.className = 'bobx-spot'; spot.setAttribute('aria-hidden', 'true'); document.body.appendChild(spot); }
  spot.classList.add('on');
  const tick = () => {
    if (!spotTarget || !spot) return;
    const r = spotTarget.getBoundingClientRect(), pad = 14;
    spot.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`; spot.style.width = r.width + pad * 2 + 'px'; spot.style.height = Math.min(r.height + pad * 2, innerHeight * 0.86) + 'px';
    spotRaf = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(spotRaf); tick();
}

/* ══ panel ══ */
type Msg = { role: 'user' | 'assistant'; content: string };
type Reply = { message: string; action?: { type: 'navigate'; href: string; label?: string } | { type: 'read' } | { type: 'scroll'; selector: string } | null; sources?: string[] };
let history: Msg[] = []; try { history = JSON.parse(ss.get('ferrn-bob-hist') || '[]'); } catch {}
const session = (() => { let s = ss.get('ferrn-bob-s'); if (!s) { s = Math.random().toString(36).slice(2); ss.set('ferrn-bob-s', s); } return s; })();
const suggestions = (root.dataset.bobSuggest || '').split('|').filter(Boolean).slice(0, 3);

const panel = document.createElement('section');
panel.className = 'bobx-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', `${BOB}, the Ferrn assistant`); panel.hidden = true;
panel.innerHTML = `
  <header class="bobx-head">
    <div class="bobx-who">
      <span class="bobx-avatar">${ghostCopy('bobav')}</span>
      <span><strong>${BOB}</strong><small data-status>Online · Ferrn assistant</small></span>
    </div>
    <div class="bobx-tools">
      <button class="bobx-stop" data-stop type="button" hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>Stop</button>
      <button class="bobx-icon" data-sound aria-label="Sound" title="Sound"></button>
      <button class="bobx-icon" data-close aria-label="Close ${BOB}" title="Close">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'}</button>
    </div>
  </header>
  <div class="bobx-modes" role="tablist" aria-label="How to talk to ${BOB}">
    <button role="tab" data-mode="chat">Chat</button><button role="tab" data-mode="talk">Talk</button><button role="tab" data-mode="present">Tour</button>
  </div>
  <div class="bobx-view" data-view="chat">
    <div class="bobx-quotes" data-quotes aria-live="polite"></div>
    <div class="bobx-chips" data-chips></div>
    <form class="bobx-form" data-form>
      <button type="button" class="bobx-icon bobx-mic" data-mic aria-label="Speak your question" title="Speak">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg>'}</button>
      <input name="q" autocomplete="off" maxlength="1500" placeholder="Ask ${BOB} anything…" aria-label="Your message" />
      <button class="bobx-send" type="submit" aria-label="Send">${'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>'}</button>
    </form>
  </div>
  <div class="bobx-view" data-view="talk" hidden>
    <div class="bobx-talk">
      <div class="bobx-talk-ghost">${ghostCopy('bobg3')}</div>
      <p class="bobx-talk-state" data-talk-state>Tap the button and talk to me like a person.</p>
      <p class="bobx-talk-live" data-talk-live></p>
      <button class="bobx-talk-btn" data-talk-btn type="button">Start talking</button>
      <p class="bobx-fine">Your microphone turns on only while this is running. Tap again to end.</p>
    </div>
    <div class="bobx-transcript" data-transcript hidden></div>
  </div>
  <div class="bobx-view" data-view="present" hidden>
    <div class="bobx-present">
      <p class="bobx-present-title">Sit back, I’ll show you around.</p>
      <p class="bobx-fine">About two minutes. I’ll highlight things, ask a couple of quick questions, and leave you a message to the team, ready to check and send.</p>
      <button class="bobx-talk-btn" data-tour-start type="button">Start the tour</button>
    </div>
  </div>`;
document.body.appendChild(panel);
const quotes = $('[data-quotes]', panel)!, chips = $('[data-chips]', panel)!, form = $<HTMLFormElement>('[data-form]', panel)!, input = $<HTMLInputElement>('input', form)!;
const ICON_SOUND = (on: boolean) => on
  ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>'
  : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"/></svg>';
const soundBtn = $('[data-sound]', panel)!;
const paintSound = () => { soundBtn.innerHTML = ICON_SOUND(soundOn); soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.title = soundOn ? 'Sound on' : 'Sound off'; };
paintSound();
soundBtn.addEventListener('click', () => { soundOn = !soundOn; ls.set('ferrn-bob-sound', soundOn ? '1' : '0'); paintSound(); if (!soundOn) hush(); });
const stopBtn = $<HTMLButtonElement>('[data-stop]', panel)!, statusEl = $('[data-status]', panel)!;
stopBtn.addEventListener('click', () => { hush(); reader.stop(); });
const status = (s?: string) => { statusEl.textContent = s || 'Online · Ferrn assistant'; };
speakingHooks.push((on) => { stopBtn.hidden = !on; panel.classList.toggle('speaking', on); status(on ? 'Talking…' : undefined); ghost?.classList.toggle('talking', on); });

let mode = 'chat', panelRaf = 0;
function setMode(m: string) {
  mode = m; ss.set('ferrn-bob-mode', m);
  $$('[data-mode]', panel).forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.mode === m)); b.classList.toggle('on', b.dataset.mode === m); });
  $$('[data-view]', panel).forEach((v) => (v.hidden = v.dataset.view !== m));
  if (m === 'chat') setTimeout(() => input.focus(), 200);
}
$$('[data-mode]', panel).forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== 'talk') talk.stop(); setMode(b.dataset.mode!); }));

function openPanel(m?: string) {
  panel.hidden = false; cancelAnimationFrame(panelRaf); panelRaf = requestAnimationFrame(() => panel.classList.add('open'));
  root.classList.add('is-open'); $('[data-bob-open]', root)?.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('bob-open');
  ss.set('ferrn-bob-open', '1');
  setMode(m || ss.get('ferrn-bob-mode') || 'chat');
  if (!quotes.childElementCount) renderChat();
}
function closePanel() {
  cancelAnimationFrame(panelRaf); panel.classList.remove('open'); setTimeout(() => { if (!panel.classList.contains('open')) panel.hidden = true; }, 380);
  root.classList.remove('is-open'); $('[data-bob-open]', root)?.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('bob-open');
  ss.set('ferrn-bob-open', null); talk.stop(); hush(); reader.stop();
}
$('[data-close]', panel)!.addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && !tour.running) closePanel(); });

/* ══ chat ══ */
const linkify = (s: string) => esc(s)
  .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|\s)(\/(?:marketplace|work|services|contact|team|about|insights|profile|careers|rfp)[\w\-/#]*)/g, '$1<a href="$2">$2</a>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
let msgSeq = 0;
/** A normal chat: Bob on the left with his avatar, the visitor on the right. Bob's words appear as he "types". */
function addQuote(role: 'user' | 'assistant', text: string, reply?: Reply, opts: { animate?: boolean } = {}) {
  const row = document.createElement('div');
  row.className = `bobx-msg ${role === 'user' ? 'me' : 'bot'}`;
  const id = `m${++msgSeq}`;
  row.innerHTML = role === 'user'
    ? `<div class="bobx-bubble">${esc(text)}</div><span class="bobx-meta">${clock()}</span>`
    : `<span class="bobx-mini">${ghostCopy('bobm' + msgSeq)}</span><div class="bobx-col"><div class="bobx-bubble" data-b="${id}"></div><div class="bobx-foot"><span class="bobx-meta">${BOB} · ${clock()}</span></div></div>`;
  quotes.appendChild(row);
  if (role === 'assistant') {
    const bubble = $(`[data-b="${id}"]`, row)!;
    const html = linkify(text);
    const finish = () => {
      bubble.innerHTML = html;
      const acts = document.createElement('div'); acts.className = 'bobx-q-acts';
      const sp = document.createElement('button'); sp.type = 'button'; sp.className = 'bobx-play';
      const paint = (on: boolean) => { sp.innerHTML = on ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>Stop' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>Play'; };
      let mine = false; paint(false);
      sp.addEventListener('click', () => { if (mine && speakingNow) { hush(); return; } mine = true; paint(true); speak(text, { force: true }).then(() => { mine = false; paint(false); }); });
      speakingHooks.push((on) => { if (!on && mine) { mine = false; paint(false); } });
      acts.appendChild(sp);
      if (reply?.action?.type === 'navigate') { const a = document.createElement('a'); a.href = reply.action.href; a.textContent = (reply.action.label || 'Take me there') + ' →'; acts.appendChild(a); }
      row.querySelector('.bobx-foot')!.appendChild(acts);
    };
    if (opts.animate && !reduced) {
      // Word-by-word, like a live reply (about 3 seconds for a long answer, never slower).
      const words = text.split(/(\s+)/); let i = 0; const step = Math.max(8, Math.min(28, 2600 / Math.max(1, words.length)));
      const tick = () => { i += 2; bubble.textContent = words.slice(0, i).join(''); quotes.scrollTop = quotes.scrollHeight; if (i < words.length) setTimeout(tick, step); else finish(); };
      tick();
    } else finish();
  }
  quotes.scrollTo({ top: quotes.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  // Small avatars stay still (the tail swish is SMIL, which CSS can't switch off).
  row.querySelectorAll<SVGSVGElement>('.bobx-mini svg').forEach((v) => v.pauseAnimations?.());
  return row;
}
function setChips(list: [string, () => void][]) {
  chips.innerHTML = '';
  for (const [label, fn] of list) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); chips.appendChild(b); }
}
function defaultChips() {
  setChips([
    ['Give me the tour', () => { setMode('present'); tour.start(); }],
    ['Read this page to me', () => { addQuote('assistant', 'Reading this page, tap Stop whenever you like.'); reader.start(); }],
    ...suggestions.filter((s) => !/read/i.test(s)).slice(0, 2).map((s) => [s, () => ask(s)] as [string, () => void]),
  ]);
}
let askedName = false;
function renderChat() {
  quotes.innerHTML = '';
  const hello = visitor ? `Hi ${visitor}! What can I help you with?` : `${(S.welcome || `Hi, I’m ${BOB}. I know everything about Ferrn, prices, products, how we work.`).replace(/\s*What are you working on\?\s*$/, '')} First, what should I call you?`;
  addQuote('assistant', hello);
  history.forEach((m) => addQuote(m.role, m.content));
  if (!visitor && !history.length) askedName = true;
  defaultChips();
}
function remember(q: string, a: string) {
  history.push({ role: 'user', content: q }, { role: 'assistant', content: a }); history = history.slice(-14);
  ss.set('ferrn-bob-hist', JSON.stringify(history));
}
async function ask(q: string, opts: { voice?: boolean } = {}): Promise<Reply | null> {
  q = q.trim(); if (!q) return null;
  input.value = '';
  hush();
  // "My name is…" / the answer to "what should I call you?"
  const GREET = /^(hi|hey|hello|yo|good (morning|afternoon|evening)|thanks?|thank you|ok|okay|yes|no|price|prices|pricing|help|website|websites|app|apps|menu|tour)\b/i;
  const intro = /^(my name is|call me|i'm called|i am called)\s+\S+/i.test(q) || (askedName && /^[\p{L}'’-]+(\s+[\p{L}'’-]+)?$/u.test(q) && !GREET.test(q));
  if (intro) {
    askedName = false;
    addQuote('user', q);
    const c = checkName(q);
    if (c.name) {
      setVisitor(c.name);
      const a = `Nice to meet you, ${c.name}! Have a look around, I’ve made the site yours. What would you like to know?`;
      addQuote('assistant', a, undefined, { animate: true }); remember(q, a); if (opts.voice || soundOn) await speak(a); return { message: a };
    }
    askedName = true; addQuote('assistant', c.ask!); remember(q, c.ask!); if (opts.voice) await speak(c.ask!); return { message: c.ask! };
  }
  addQuote('user', q);
  const typing = document.createElement('div'); typing.className = 'bobx-msg bot bobx-typing-row'; typing.innerHTML = `<span class="bobx-mini">${ghostCopy('bobt' + (++msgSeq))}</span><div class="bobx-bubble bobx-typing"><i></i><i></i><i></i></div>`;
  status(`${BOB} is typing…`);
  quotes.appendChild(typing); quotes.scrollTop = quotes.scrollHeight;
  typing.querySelectorAll<SVGSVGElement>('svg').forEach((v) => v.pauseAnimations?.());
  ghostLevel(0.2);
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: q, history, lang, path: location.pathname, session, visitor }) });
    const j = (await r.json()) as Reply;
    typing.remove(); status();
    addQuote('assistant', j.message, j, { animate: true }); remember(q, j.message);
    if (opts.voice || soundOn) await speak(j.message);
    await act(j);
    return j;
  } catch {
    typing.remove(); status(); const m = S.error || 'Something went wrong, try again in a moment.'; addQuote('assistant', m); return { message: m };
  }
}
/** Do what the answer suggests: read, scroll to a section (pointing at it), or go to a page (clicking a real link). */
async function act(j: Reply) {
  const a = j.action; if (!a) return;
  if (a.type === 'read') return reader.start();
  if (a.type === 'scroll') {
    const el = $(a.selector); if (!el) return;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); await wait(700);
    await point(el); el.classList.add('bobx-hl'); setTimeout(() => el.classList.remove('bobx-hl'), 2600);
    return;
  }
  if (a.type === 'navigate' && /^\/[^/]/.test(a.href)) {
    const to = a.href;
    const link = $$<HTMLAnchorElement>('a[href]').find((l) => { const r = l.getBoundingClientRect(); return l.getAttribute('href') === to && r.width && r.top > 0 && r.bottom < innerHeight; });
    if (link) await point(link); else await wait(500);
    ss.set('ferrn-bob-open', '1');
    location.href = to;
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

/* ══ speech recognition (only when the visitor taps) ══ */
const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const bcp: Record<string, string> = { en: 'en-NG', yo: 'yo-NG', ig: 'ig-NG', ha: 'ha-NG', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', zh: 'zh-CN' };
function listenOnce(onPartial: (s: string) => void): { done: Promise<string>; stop: () => void } {
  const rec = new SR(); rec.lang = bcp[lang] || 'en-NG'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = '', stopped = false;
  const done = new Promise<string>((resolve) => {
    rec.onresult = (ev: any) => { let s = ''; for (const r of ev.results) s += r[0].transcript; onPartial(s); if (ev.results[ev.results.length - 1].isFinal) final = s; ghostLevel(0.5); };
    rec.onend = () => { ghostLevel(0); resolve(stopped ? '' : final.trim()); };
    rec.onerror = () => { ghostLevel(0); resolve(''); };
    try { rec.start(); } catch { resolve(''); }
  });
  return { done, stop: () => { stopped = true; try { rec.abort(); } catch {} } };
}
const mic = $<HTMLButtonElement>('[data-mic]', panel)!;
if (!SR) mic.hidden = true;
else mic.addEventListener('click', async () => {
  if (mic.classList.contains('rec')) return;
  hush(); mic.classList.add('rec');
  const l = listenOnce((s) => (input.value = s));
  const said = await l.done; mic.classList.remove('rec');
  if (said) ask(said, { voice: true });
});

/* ══ talk: hands-free conversation with little fillers while Bob thinks ══ */
const FILLERS = ['Hmm…', 'Okay…', 'Let me think…', 'Right…', 'Good question…', 'Mm-hm…'];
const talk = (() => {
  let running = false, cur: { done: Promise<string>; stop: () => void } | null = null;
  const lines: { who: string; text: string }[] = [];
  const btn = $<HTMLButtonElement>('[data-talk-btn]', panel)!, state = $('[data-talk-state]', panel)!, live = $('[data-talk-live]', panel)!, tr = $('[data-transcript]', panel)!;
  const set = (s: string, cls = '') => { state.textContent = s; panel.dataset.talk = cls; };
  async function loop() {
    while (running) {
      set('Listening…', 'listening'); live.textContent = '';
      cur = listenOnce((s) => (live.textContent = s));
      const said = await cur.done; cur = null;
      if (!running) break;
      if (!said) { set('I didn’t catch that, I’m still listening.', 'listening'); await wait(400); continue; }
      lines.push({ who: visitor || 'You', text: said });
      set('Thinking…', 'thinking');
      const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];
      const fillerDone = speak(filler, { force: true });
      const intro = checkName(said);
      let answer: string;
      if (!visitor && /^(my name is|i am|i'm|call me)\b/i.test(said) && intro.name) { setVisitor(intro.name); answer = `Lovely to meet you, ${intro.name}. What would you like to know about Ferrn?`; }
      else {
        try {
          const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: said, history, lang, path: location.pathname, session, visitor, voice: true }) });
          answer = ((await r.json()) as Reply).message;
        } catch { answer = 'Sorry, I lost my train of thought. Could you say that again?'; }
      }
      remember(said, answer); lines.push({ who: BOB, text: answer });
      await fillerDone;
      if (!running) break;
      set('Speaking…', 'speaking'); live.textContent = answer;
      await speak(answer, { force: true });
    }
  }
  function showTranscript() {
    if (!lines.length) { tr.hidden = true; return; }
    tr.hidden = false;
    tr.innerHTML = `<div class="bobx-tr-head"><strong>Transcript</strong><span><button type="button" data-tr-copy>Copy</button><button type="button" data-tr-chat>Continue in chat</button></span></div>` +
      lines.map((l) => `<p><b>${esc(l.who)}</b> ${esc(l.text)}</p>`).join('');
    $('[data-tr-copy]', tr)!.addEventListener('click', async () => { try { await navigator.clipboard.writeText(lines.map((l) => `${l.who}: ${l.text}`).join('\n\n')); ($('[data-tr-copy]', tr) as HTMLElement).textContent = 'Copied'; } catch {} });
    $('[data-tr-chat]', tr)!.addEventListener('click', () => { setMode('chat'); renderChat(); });
  }
  function start() {
    if (!SR) { set('Talking needs Chrome, Edge or Safari. You can still chat by typing.'); return; }
    running = true; lines.length = 0; tr.hidden = true; btn.textContent = 'End conversation'; btn.classList.add('on');
    speak(visitor ? `I’m listening, ${visitor}.` : 'I’m listening. Go ahead.', { force: true }).then(() => { if (running) loop(); });
  }
  function stop() {
    if (!running) return;
    running = false; cur?.stop(); hush(); btn.textContent = 'Start talking'; btn.classList.remove('on');
    set('Conversation ended. Here’s everything we said.', ''); live.textContent = ''; showTranscript();
  }
  btn.addEventListener('click', () => (running ? stop() : start()));
  return { start, stop, get running() { return running; } };
})();

/* ══ page reader (for "read this page") ══ */
const reader = (() => {
  let chunks: { el: HTMLElement; text: string }[] = [], i = 0, active = false;
  const bar = document.createElement('div'); bar.className = 'bobx-reader'; bar.hidden = true;
  bar.innerHTML = '<span>Reading this page</span><button type="button" data-r-stop>Stop</button>';
  document.body.appendChild(bar);
  const collect = () => $$<HTMLElement>('main h1, main h2, main h3, main p, main li, main blockquote')
    .filter((el) => el.offsetParent && el.textContent!.trim().length > 2 && !el.closest('[aria-hidden="true"], .trusted, nav'))
    .map((el) => ({ el, text: el.textContent!.replace(/\s+/g, ' ').trim() }));
  const mark = (el: HTMLElement | null) => { $$('.bobx-read').forEach((e) => e.classList.remove('bobx-read')); if (!el) return; el.classList.add('bobx-read'); el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); };
  async function run() { while (active && i < chunks.length) { mark(chunks[i].el); await speak(chunks[i].text, { force: true }); i++; } stop(); }
  function start() { stop(); chunks = collect(); i = 0; active = true; bar.hidden = false; run(); }
  function stop() { active = false; hush(); mark(null); bar.hidden = true; }
  $('[data-r-stop]', bar)!.addEventListener('click', stop);
  return { start, stop };
})();

/* ══ present: the guided tour ══ */
type Answers = { visits?: string; need?: string; email?: string; message?: boolean };
type Step = { page: string; target?: string; say: string; ask?: 'name' | 'chips' | 'email'; options?: string[]; key?: keyof Answers; then?: (a: string) => string | void; before?: () => Promise<void> | void; done?: () => void };
const VISITS: Record<string, [string, number]> = { 'Under 1,000': ['under 1,000', 800], '1,000–5,000': ['about 1,000–5,000', 3000], '5,000–20,000': ['about 5,000–20,000', 12000], 'More than that': ['more than 20,000', 30000], 'No website yet': ['none yet, no website', 0] };
const NEEDS: Record<string, string> = { 'A new website': 'Website', 'A web app or portal': 'Web application', 'An AI assistant': 'AI assistant / automation', 'Not sure yet': 'Not sure yet' };
const tour = (() => {
  let running = false, paused = false, idx = 0, ans: Answers = {}, token = 0;
  let resolveAnswer: ((s: string) => void) | null = null;
  let stillTimer = 0, pauseTimer = 0;
  const cap = document.createElement('div'); cap.className = 'bobx-cap'; cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-live', 'polite'); cap.hidden = true;
  cap.innerHTML = `<p class="bobx-cap-text" data-cap-text></p><div class="bobx-cap-ask" data-cap-ask></div>
    <form class="bobx-cap-q" data-cap-q><input name="q" maxlength="400" autocomplete="off" placeholder="Ask ${BOB} a question…" aria-label="Ask ${BOB} a question during the tour" /><button type="submit" aria-label="Ask">${'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>'}</button></form>
    <div class="bobx-cap-bar"><span class="bobx-cap-step" data-cap-step></span><button type="button" data-cap-stop hidden>Stop talking</button><button type="button" data-cap-music aria-pressed="true">Music on</button><button type="button" data-cap-pause>Pause</button><button type="button" data-cap-skip>Next</button><button type="button" data-cap-end>End tour</button></div>`;
  document.body.appendChild(cap);
  const capText = $('[data-cap-text]', cap)!, capAsk = $('[data-cap-ask]', cap)!, capStep = $('[data-cap-step]', cap)!;
  const capStop = $<HTMLButtonElement>('[data-cap-stop]', cap)!, capMusic = $<HTMLButtonElement>('[data-cap-music]', cap)!, capQ = $<HTMLFormElement>('[data-cap-q]', cap)!;
  capStop.addEventListener('click', () => hush());
  speakingHooks.push((on) => { capStop.hidden = !on; bgm.duck(on); });

  /* Background music while Bob isn't talking: a calm track from the site's own playlist, quiet, ducked under his voice. */
  const bgm = (() => {
    let list: { src: string }[] = []; try { list = JSON.parse($('[data-music]')?.dataset.music || '[]'); } catch {}
    const a = new Audio(); a.loop = true; a.preload = 'none';
    let on = ls.get('ferrn-bob-tour-music') !== '0', playing = false, target = 0.16, raf = 0;
    const fade = (to: number) => { cancelAnimationFrame(raf); const step = () => { const d = to - a.volume; if (Math.abs(d) < 0.01) { a.volume = to; if (!to && !playing) a.pause(); return; } a.volume = Math.max(0, Math.min(1, a.volume + d * 0.15)); raf = requestAnimationFrame(step); }; step(); };
    const paint = () => { capMusic.textContent = on ? 'Music on' : 'Music off'; capMusic.setAttribute('aria-pressed', String(on)); };
    paint();
    capMusic.addEventListener('click', () => { on = !on; ls.set('ferrn-bob-tour-music', on ? '1' : '0'); paint(); on ? start() : stop(); });
    // Don't stack on top of music the visitor already has playing from the control centre.
    const siteMusicOn = () => !!$('[data-music].playing');
    function start() {
      if (!on || !list.length || siteMusicOn()) return;
      if (!a.src) a.src = list[(list.length > 1 ? 1 : 0)].src;
      playing = true; a.volume = 0; a.play().then(() => fade(speakingNow ? 0.03 : target)).catch(() => { playing = false; });
    }
    function stop() { playing = false; fade(0); }
    return { start, stop, duck: (talking: boolean) => { if (playing) fade(talking ? 0.03 : target); } };
  })();

  /* Questions during the tour: the tour pauses, Bob answers (spoken), then carries on when the visitor is ready. */
  let asking = false;
  capQ.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $<HTMLInputElement>('input', capQ)!; const q = inp.value.trim(); if (!q || asking) return;
    inp.value = ''; asking = true; clearTimers(); hush();
    const wasPaused = paused; paused = true; $('[data-cap-pause]', cap)!.textContent = 'Resume';
    const keep = { text: capText.textContent, ask: capAsk.innerHTML };
    capText.textContent = 'Hmm, let me think…'; capAsk.innerHTML = '';
    let answer = '';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: q, history, lang, path: location.pathname, session, visitor, voice: true, tour: STEPS[idx]?.say.slice(0, 160) }) });
      answer = ((await r.json()) as Reply).message;
    } catch { answer = 'Sorry, I lost my train of thought. Ask me again?'; }
    remember(q, answer);
    capText.textContent = answer;
    capAsk.innerHTML = '<button type="button" class="bobx-chip on" data-carry>Carry on with the tour</button>';
    $('[data-carry]', capAsk)!.addEventListener('click', () => {
      hush(); asking = false; capText.textContent = fill(STEPS[idx]?.say || keep.text || ''); capAsk.innerHTML = keep.ask;
      // re-wire the step's own buttons after restoring them
      if (STEPS[idx]?.ask) askUi(STEPS[idx]);
      if (!wasPaused) setPaused(false);
    });
    await speak(answer, { force: true });
  });

  const STEPS: Step[] = [
    { page: '/', say: `Hi, I’m ${BOB}. Before we start, what should I call you?`, ask: 'name' },
    { page: '/', say: `Lovely to meet you, {name}. Sit back and relax, I’ll take you on a quick journey through Ferrn.`, before: async () => {} },
    { page: '/', target: '.hx-title', say: `This is Ferrn. We build websites, web apps and AI assistants for businesses that want to grow, not just look nice online.` },
    { page: '/', target: '.trusted', say: `These are some of the businesses that already trust us with theirs.` },
    { page: '/', target: '.levers', say: `Every site we build earns its keep in three places: helping people find you, helping them choose you, and making sure no enquiry goes cold.` },
    { page: '/', target: '.calc', say: `Quick question, {name}: roughly how many people visit your website each month?`, ask: 'chips', options: Object.keys(VISITS), key: 'visits',
      then: (a) => {
        const v = VISITS[a]?.[1] ?? 0;
        const slider = $<HTMLInputElement>('[data-calc-in="visits"]');
        if (slider && v) { slider.value = String(v); slider.dispatchEvent(new Event('input', { bubbles: true })); }
        const extra = $('[data-calc-out="extra"]')?.textContent || '';
        return v ? `Look at that, with ${a.toLowerCase()} visitors, one more customer in every hundred is worth about ${extra.replace('+', '')} a month. That’s the kind of thing we design for.` : `No website yet, that’s the best place to start, honestly. Nothing to undo.`;
      } },
    { page: '/', target: '#services .bento', say: `This is what that looks like in practice: booking systems, quoting tools, dashboards, and assistants like me, working at 2am.` },
    { page: '/', target: '#services .h-display', say: `What would help your business most right now, {name}?`, ask: 'chips', options: Object.keys(NEEDS), key: 'need', then: (a) => (a === 'Not sure yet' ? `That’s fine, most people aren’t. We’ll work it out together.` : `${a}, good choice. We do a lot of those.`) },
    { page: '/', target: '#marketplace .shelf', say: `If you need something fast, these are ready-built. Prices are on the page, and they go live in days, not months.` },
    { page: '/', target: '#work .work-grid', say: `And this is real work, for real clients.` },
    { page: '/', target: '.close-glow', say: `Shall I write a short message to the team for you, {name}? I’ll fill in the form, you just check it and press send.`, ask: 'chips', options: ['Yes, please', 'Not now'], key: 'message', then: (a) => (a === 'Yes, please' ? 'Great, one more thing.' : `No problem. Thanks for coming along, {name}. I’ll be in the corner if you need me.`) },
    { page: '/', target: '.close-glow', say: `What email should the team reply to? (You can leave it blank.)`, ask: 'email', key: 'email' },
    { page: '/contact', target: 'form[data-form="contact"]', say: `Here we are, {name}. I’ve filled it in for you, check it over and press Send when you’re happy. I won’t send anything for you.` },
  ];

  const save = () => ss.set('ferrn-bob-tour', JSON.stringify({ idx, ans }));
  function clearTimers() { clearTimeout(stillTimer); clearTimeout(pauseTimer); }
  function waitAnswer(): Promise<string> {
    return new Promise((resolve) => {
      resolveAnswer = (s) => { clearTimers(); resolveAnswer = null; resolve(s); };
      // 10 seconds of silence: check they're still there; another 20: pause the tour quietly.
      const nudge = () => {
        stillTimer = window.setTimeout(async () => {
          if (!running || paused || !resolveAnswer) return;
          const back = capAsk.innerHTML;
          capAsk.insertAdjacentHTML('afterbegin', `<p class="bobx-still">Still there, ${esc(visitor || 'friend')}? <button type="button" data-still>Yes, carry on</button></p>`);
          $('[data-still]', capAsk)?.addEventListener('click', () => { $('.bobx-still', capAsk)?.remove(); nudge(); });
          speak(`Still there, ${visitor || 'friend'}?`);
          pauseTimer = window.setTimeout(() => { if (running && resolveAnswer) setPaused(true); void back; }, 20000);
        }, 10000);
      };
      nudge();
    });
  }
  function askUi(st: Step) {
    capAsk.innerHTML = '';
    if (st.ask === 'name' || st.ask === 'email') {
      const f = document.createElement('form'); f.className = 'bobx-cap-form';
      f.innerHTML = st.ask === 'name'
        ? '<input name="v" autocomplete="given-name" maxlength="40" placeholder="Your first name" aria-label="Your first name" required /><button type="submit">That’s me</button>'
        : '<input name="v" type="email" autocomplete="email" maxlength="120" placeholder="you@company.com" aria-label="Your email" /><button type="submit">Continue</button><button type="button" data-skip-email>Skip</button>';
      f.addEventListener('submit', (e) => { e.preventDefault(); resolveAnswer?.((f.elements.namedItem('v') as HTMLInputElement).value); });
      $('[data-skip-email]', f)?.addEventListener('click', () => resolveAnswer?.(''));
      capAsk.appendChild(f); setTimeout(() => ($('input', f) as HTMLInputElement)?.focus(), 80);
      return;
    }
    for (const o of st.options || []) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bobx-chip'; b.textContent = o; b.addEventListener('click', () => resolveAnswer?.(o)); capAsk.appendChild(b); }
  }
  async function position(el: Element | null) {
    if (!el) { const h = home(); await flyTo(h.x - 30, h.y - 140); placeCap(); return; }
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    await wait(reduced ? 50 : 650);
    spotlight(el);
    const r = el.getBoundingClientRect();
    const x = Math.min(innerWidth - 60, Math.max(60, r.right - 40)), y = Math.max(90, Math.min(innerHeight - 220, r.top - 10));
    await flyTo(x, y); placeCap();
  }
  function placeCap() {
    cap.hidden = false; requestAnimationFrame(() => cap.classList.add('on'));
    const w = Math.min(380, innerWidth - 24), left = Math.max(12, Math.min(innerWidth - w - 12, gx - w + 40));
    const h = cap.offsetHeight || 260;
    const top = gy + 60 + h < innerHeight ? gy + 60 : Math.max(12, gy - h - 60);
    cap.style.width = w + 'px'; cap.style.transform = `translate(${left}px, ${top}px)`;
  }
  async function run(my: number) {
    while (running && idx < STEPS.length && my === token) {
      if (paused) { await wait(300); continue; }
      const st = STEPS[idx];
      if (here() !== st.page) {
        // Change page through the portal; the tour carries on when the next page loads.
        save(); spotlight(null); cap.classList.remove('on');
        if (st.page === '/contact') {
          ss.set('ferrn-prefill', JSON.stringify(prefill()));
        }
        await portal('out', gx || home().x, gy || home().y);
        location.href = at(st.page); return;
      }
      capStep.textContent = `${idx + 1} / ${STEPS.length}`;
      await position(st.target ? $(st.target) : null);
      if (my !== token || !running) return;
      capText.textContent = fill(st.say); capAsk.innerHTML = '';
      if (st.ask) {
        askUi(st);
        const spoken = speak(fill(st.say));
        let a = await waitAnswer();
        if (my !== token || !running) return;
        if (st.ask === 'name') {
          let c = checkName(a);
          while (!c.name && running && my === token) { capText.textContent = c.ask!; speak(c.ask!); askUi(st); a = await waitAnswer(); c = checkName(a); }
          if (!c.name) return;
          setVisitor(c.name);
        } else if (st.key) {
          (ans as any)[st.key] = st.key === 'message' ? a === 'Yes, please' : a;
        }
        await spoken;
        capAsk.innerHTML = '';
        const follow = st.then?.(a);
        if (follow) { capText.textContent = fill(follow); await Promise.all([speak(fill(follow)), wait(Math.max(1600, follow.length * 45))]); }
        if (st.key === 'message' && !ans.message) { end(true); return; }
      } else {
        await Promise.all([speak(fill(st.say)), wait(Math.max(2200, st.say.length * 48))]);
        st.done?.();
        if (st.done) await wait(1300);
      }
      idx++; save();
    }
    if (running && my === token) {
      // Last step: type the prefilled fields in.
      await finishOnContact();
      end(false);
    }
  }
  function prefill() {
    const need = NEEDS[ans.need || ''] || '';
    const v = VISITS[ans.visits || '']?.[0];
    const lines = [`Hi Ferrn, I’m ${visitor || 'interested'} and I just took ${BOB}’s tour.`];
    if (need && need !== 'Not sure yet') lines.push(`I’m interested in: ${need.toLowerCase()}.`); else lines.push('I’m not sure yet what I need, I’d like your advice.');
    if (v) lines.push(`Our website gets ${v} visitors a month.`);
    lines.push('Could we talk?');
    return { name: visitor, email: ans.email || '', need, message: lines.join(' ') };
  }
  async function finishOnContact() {
    const f = $<HTMLFormElement>('form[data-form="contact"]'); if (!f) return;
    const msg = f.elements.namedItem('message') as HTMLTextAreaElement | null;
    if (msg) await point(msg);
    const p = prefill();
    for (const k of ['name', 'email', 'message'] as const) {
      const el = f.elements.namedItem(k) as HTMLInputElement | null; if (!el || !p[k]) continue;
      el.value = ''; el.focus({ preventScroll: true });
      for (const chunk of p[k].match(/.{1,3}/g) || []) { el.value += chunk; await wait(reduced ? 0 : 14); }
    }
    const need = f.elements.namedItem('need') as HTMLSelectElement | null; if (need && p.need) need.value = p.need;
    ss.set('ferrn-prefill', null);
  }
  function setPaused(p: boolean) {
    paused = p; $('[data-cap-pause]', cap)!.textContent = p ? 'Resume' : 'Pause';
    if (p) { hush(); clearTimers(); capText.textContent = `Paused. Press Resume whenever you’re ready, ${visitor || 'friend'}.`; }
    else if (resolveAnswer) { capText.textContent = fill(STEPS[idx].say); }
  }
  async function start(from = 0, saved?: Answers) {
    token++; const my = token;
    running = true; paused = false; idx = from; ans = saved || {};
    closePanel(); document.documentElement.classList.add('bob-touring');
    root.classList.add('away');
    if (!from) {
      // Out of the launcher through a portal, into the page.
      const h = home(); placeAt(h.x, h.y); ghostEl().hidden = false;
      await portal('out', h.x, h.y); await portal('in', innerWidth - 120, 150);
    } else {
      await portal('in', innerWidth - 120, 150);
    }
    bgm.start();
    save(); run(my);
  }
  function end(quiet: boolean) {
    token++; running = false; clearTimers(); resolveAnswer = null; hush(); spotlight(null); bgm.stop(); asking = false;
    cap.classList.remove('on'); setTimeout(() => (cap.hidden = true), 300);
    ss.set('ferrn-bob-tour', null);
    document.documentElement.classList.remove('bob-touring');
    const h = home();
    (async () => { if (ghost && !ghost.hidden) { await flyTo(h.x, h.y, 700); await portal('out', h.x, h.y); } root.classList.remove('away'); })();
    if (!quiet) setTimeout(() => { /* leave the form for the visitor */ }, 0);
  }
  $('[data-cap-pause]', cap)!.addEventListener('click', () => setPaused(!paused));
  $('[data-cap-skip]', cap)!.addEventListener('click', () => { if (resolveAnswer) resolveAnswer(STEPS[idx].ask === 'name' ? (visitor || 'Friend') : ''); else { hush(); } });
  $('[data-cap-end]', cap)!.addEventListener('click', () => end(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && running) end(true); });
  addEventListener('resize', () => { if (running) placeCap(); });
  // The caption grows when Bob answers a question: keep it clear of him.
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (running && !cap.hidden) placeCap(); }).observe(cap);
  $('[data-tour-start]', panel)!.addEventListener('click', () => start(0));
  return {
    start, end,
    resume() { const t = ss.get('ferrn-bob-tour'); if (!t) return false; try { const s = JSON.parse(t); start(s.idx || 0, s.ans || {}); return true; } catch { return false; } },
    get running() { return running; },
  };
})();

/* ══ public API used by the launcher ══ */
window.FerrnBob = {
  open: (m?: string) => { if (m === 'present') { tour.start(0); return; } openPanel(m); },
  ask: (q: string) => { openPanel('chat'); ask(q); },
  resume: () => { if (tour.resume()) return; if (ss.get('ferrn-bob-open') === '1') openPanel(); },
};
prefillContact();
