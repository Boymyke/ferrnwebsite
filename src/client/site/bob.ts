/* Bob — Ferrn's assistant. A noise blob that breathes, listens, thinks and speaks; a side sheet
   for text + voice; a page reader with synchronised highlighting. Nothing records or speaks until
   the visitor asks. */
type Strings = Record<string, string>;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

export type BobState = 'idle' | 'listening' | 'thinking' | 'speaking';

/* ── blob: 2D canvas, simplex-ish noise on a ring of points, state changes amplitude/speed/hue ── */
function makeBlob(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  const N = 96; // ring resolution
  let state: BobState = 'idle';
  let level = 0; // audio level 0..1 (listening/speaking)
  let t = 0, raf = 0, running = false;
  const P: Record<BobState, { amp: number; speed: number; hue: number; sat: number; scale: number }> = {
    idle: { amp: 0.06, speed: 0.35, hue: 18, sat: 100, scale: 0.78 },
    listening: { amp: 0.14, speed: 0.9, hue: 24, sat: 100, scale: 0.82 },
    thinking: { amp: 0.11, speed: 1.6, hue: 32, sat: 92, scale: 0.8 },
    speaking: { amp: 0.17, speed: 1.1, hue: 16, sat: 100, scale: 0.84 },
  };
  const cur = { ...P.idle };
  // cheap 1D noise via summed sines keeps the blob organic without a noise lib
  const noise = (a: number, tt: number) => Math.sin(a * 3 + tt) * 0.5 + Math.sin(a * 5 - tt * 1.3) * 0.3 + Math.sin(a * 8 + tt * 0.7) * 0.2;
  const draw = () => {
    const target = P[state];
    for (const k of Object.keys(cur) as (keyof typeof cur)[]) cur[k] += (target[k] - cur[k]) * 0.06;
    t += 0.016 * cur.speed;
    ctx.clearRect(0, 0, W, H);
    const r = (W / 2) * cur.scale * (1 + level * 0.12);
    const amp = cur.amp + level * 0.12;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.25);
    g.addColorStop(0, `hsl(${cur.hue + 14} ${cur.sat}% 68%)`);
    g.addColorStop(0.55, `hsl(${cur.hue} ${cur.sat}% 50%)`);
    g.addColorStop(1, `hsl(${cur.hue - 10} ${cur.sat}% 34%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const rr = r * (1 + amp * noise(a, t));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    // specular
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (running && !reduced) raf = requestAnimationFrame(draw);
  };
  const start = () => { if (running) return; running = true; draw(); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  draw();
  return {
    set(s: BobState) { state = s; if (reduced) draw(); },
    level(v: number) { level = Math.max(0, Math.min(1, v)); },
    start, stop,
  };
}

/* ── page reader: sentence-level chunks with highlight, pause/resume, speed ── */
function makeReader(root: HTMLElement, speakFn: (text: string, onEnd: () => void) => Promise<() => void>, ui: {
  progress: HTMLElement; pos: HTMLElement; toggle: HTMLButtonElement; panel: HTMLElement; onState: (s: BobState) => void;
}) {
  type Chunk = { el: HTMLElement; text: string };
  let chunks: Chunk[] = [], i = 0, paused = false, cancel: (() => void) | null = null, active = false;
  const collect = (): Chunk[] => {
    const out: Chunk[] = [];
    const sel = 'h1,h2,h3,h4,p,li,blockquote,dt,dd,figcaption,summary';
    for (const el of $$<HTMLElement>(sel, root)) {
      if (el.closest('[data-bob],.idle,.ticker,.sr-only,script,style,noscript,[aria-hidden="true"],[hidden],.hp')) continue;
      if (el.querySelector(sel) && !/^(LI|BLOCKQUOTE|DD)$/.test(el.tagName)) continue; // leaves only
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 3 || /^\d+\s*\/\s*\d+$/.test(text)) continue;
      out.push({ el, text });
    }
    return out;
  };
  const mark = (el: HTMLElement | null) => {
    $$('.read-hl', root).forEach((e) => e.classList.remove('read-hl'));
    if (!el) return;
    el.classList.add('read-hl');
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const show = () => { ui.progress.style.width = `${chunks.length ? (i / chunks.length) * 100 : 0}%`; ui.pos.textContent = `${Math.min(i + 1, chunks.length)} / ${chunks.length}`; };
  const next = async () => {
    if (!active || paused) return;
    if (i >= chunks.length) return stop();
    const c = chunks[i];
    mark(c.el); show();
    ui.onState('speaking');
    cancel = await speakFn(c.text, () => { if (!active || paused) return; i++; next(); });
  };
  const start = async () => {
    stop();
    chunks = collect(); i = 0; paused = false; active = true;
    ui.panel.hidden = false;
    ui.toggle.setAttribute('aria-label', 'Pause'); ui.toggle.dataset.state = 'playing';
    if (!chunks.length) return stop();
    next();
  };
  const pause = () => { paused = true; cancel?.(); ui.toggle.setAttribute('aria-label', 'Resume'); ui.toggle.dataset.state = 'paused'; ui.onState('idle'); };
  const resume = () => { paused = false; ui.toggle.setAttribute('aria-label', 'Pause'); ui.toggle.dataset.state = 'playing'; next(); };
  const stop = () => { active = false; paused = false; cancel?.(); cancel = null; mark(null); ui.panel.hidden = true; ui.onState('idle'); };
  const restart = () => { if (!active) return start(); i = 0; cancel?.(); paused = false; next(); };
  return { start, pause, resume, stop, restart, toggle: () => (paused ? resume() : pause()), get active() { return active; }, get paused() { return paused; },
    rerun() { if (active && !paused) { cancel?.(); next(); } } };
}

export function bob(opts: { lang: string; S: Strings; reduced: boolean }) {
  const root = $('[data-bob]'); if (!root) return;
  const { lang, S, reduced } = opts;
  const name = root.dataset.bobName || 'Bob';
  const sheet = $('.bob-sheet', root)!, log = $('[data-bob-log]', root)!, form = $<HTMLFormElement>('[data-bob-form]', root)!;
  const input = $<HTMLInputElement>('input[name=q]', form)!, stateEl = $('[data-bob-state]', root)!;
  const openBtn = $<HTMLButtonElement>('[data-bob-open]', root)!, closeBtn = $('[data-bob-close]', root)!;
  const settingsBtn = $<HTMLButtonElement>('[data-bob-settings]', root)!, settingsPanel = $('[data-bob-settings-panel]', root)!;
  const voiceSel = $<HTMLSelectElement>('[data-bob-voice-select]', root)!, rate = $<HTMLInputElement>('[data-bob-rate]', root)!;
  const autoVoice = $<HTMLInputElement>('[data-bob-autovoice]', root)!, voiceNote = $('[data-bob-voice-note]', root)!;
  const readBtn = $<HTMLButtonElement>('[data-bob-read]', root)!, readerPanel = $('[data-bob-reader]', root)!;
  const serverVoice = root.dataset.bobVoice || 'auto'; // 'auto' | 'server' | 'browser'
  const blobs = $$<HTMLCanvasElement>('[data-bob-orb] canvas', root).map((c) => makeBlob(c, reduced));
  let state: BobState = 'idle';
  const labels: Record<BobState, string> = { idle: 'Ready', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking' };
  const setState = (s: BobState) => { state = s; blobs.forEach((b) => b.set(s)); stateEl.textContent = labels[s]; root.dataset.bobStateNow = s; };

  // Scrim behind the sheet
  const scrim = document.createElement('div'); scrim.className = 'bob-scrim'; root.after(scrim);

  /* ── prefs ── */
  const pref = { get: (k: string, d = '') => { try { return localStorage.getItem('ferrn-bob-' + k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { localStorage.setItem('ferrn-bob-' + k, v); } catch {} } };
  rate.value = pref.get('rate', '1'); autoVoice.checked = pref.get('auto', '0') === '1';
  rate.addEventListener('input', () => { pref.set('rate', rate.value); audio && (audio.playbackRate = Number(rate.value)); });
  autoVoice.addEventListener('change', () => pref.set('auto', autoVoice.checked ? '1' : '0'));
  settingsBtn.addEventListener('click', () => { const open = settingsPanel.hidden; settingsPanel.hidden = !open; settingsBtn.setAttribute('aria-pressed', String(open)); if (open) populateVoices(); });

  /* ── voices ── */
  const bcp: Record<string, string> = { en: 'en-NG', yo: 'yo-NG', ig: 'ig-NG', ha: 'ha-NG', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', zh: 'zh-CN' };
  let serverVoiceOk: boolean | null = null; // learned on first /api/tts call
  const populateVoices = () => {
    const keep = voiceSel.value || pref.get('voice', 'auto');
    const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
    const want = bcp[lang] || 'en';
    const list = voices.filter((v) => v.lang.replace('_', '-').startsWith(want.slice(0, 2)));
    voiceSel.innerHTML = '<option value="auto">Automatic</option>' + (serverVoice !== 'browser' ? `<option value="server">${name} (Nigerian English)</option>` : '') +
      list.map((v) => `<option value="b:${v.name}">${v.name} (${v.lang})${/en-NG/i.test(v.lang) ? ' — Nigerian' : ''}</option>`).join('');
    voiceSel.value = [...voiceSel.options].some((o) => o.value === keep) ? keep : 'auto';
    voiceNote.textContent = serverVoice === 'browser' || serverVoiceOk === false
      ? 'Using your device’s voices. A device voice is only Nigerian if it says so.'
      : 'Automatic uses Ferrn’s Nigerian English voice when available, otherwise your device’s voice.';
  };
  voiceSel.addEventListener('change', () => pref.set('voice', voiceSel.value));
  if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', populateVoices);

  let audio: HTMLAudioElement | null = null, actx: AudioContext | null = null, analyser: AnalyserNode | null = null, levelRaf = 0;
  const meter = (src: AudioNode | null) => {
    cancelAnimationFrame(levelRaf);
    if (!src || !analyser || reduced) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => { analyser!.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } blobs.forEach((b) => b.level(Math.min(1, Math.sqrt(s / buf.length) * 4))); levelRaf = requestAnimationFrame(tick); };
    tick();
  };
  const stopMeter = () => { cancelAnimationFrame(levelRaf); blobs.forEach((b) => b.level(0)); };

  /** Speak text; resolves to a cancel function; calls onEnd when finished (not when cancelled). */
  async function speak(text: string, onEnd: () => void = () => {}): Promise<() => void> {
    const plain = text.replace(/https?:\/\/\S+/g, '').replace(/[*#_`]/g, '').trim();
    if (!plain) { onEnd(); return () => {}; }
    audio?.pause(); audio = null; if ('speechSynthesis' in window) speechSynthesis.cancel();
    const choice = voiceSel.value || pref.get('voice', 'auto');
    const tryServer = serverVoice !== 'browser' && choice !== 'auto' ? choice === 'server' : serverVoiceOk !== false;
    if (tryServer) {
      try {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: plain, lang }) });
        if (r.ok && (r.headers.get('content-type') || '').includes('audio')) {
          serverVoiceOk = true;
          const a = new Audio(URL.createObjectURL(await r.blob())); audio = a;
          a.playbackRate = Number(rate.value) || 1;
          try {
            actx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
            analyser ??= actx.createAnalyser(); analyser.fftSize = 512;
            const node = actx.createMediaElementSource(a); node.connect(analyser); analyser.connect(actx.destination);
            meter(node);
          } catch {}
          a.addEventListener('ended', () => { stopMeter(); if (audio === a) { audio = null; setState('idle'); onEnd(); } });
          setState('speaking');
          await a.play();
          return () => { a.pause(); stopMeter(); if (audio === a) audio = null; };
        }
        serverVoiceOk = false; populateVoices();
      } catch { serverVoiceOk = false; }
    }
    if (!('speechSynthesis' in window)) { onEnd(); return () => {}; }
    const u = new SpeechSynthesisUtterance(plain);
    const voices = speechSynthesis.getVoices();
    const picked = choice.startsWith('b:') ? voices.find((v) => v.name === choice.slice(2)) : null;
    const want = ['en', 'yo', 'ig', 'ha'].includes(lang) ? ['en-NG', 'en-GB', 'en'] : [bcp[lang] || lang];
    u.voice = picked || want.map((w) => voices.find((v) => v.lang.replace('_', '-').startsWith(w))).find(Boolean) || null;
    u.rate = Number(rate.value) || 1;
    // fake a gentle level for the blob while the browser speaks
    let fake = 0; const fakeTick = () => { fake += 0.18; blobs.forEach((b) => b.level(0.25 + Math.abs(Math.sin(fake)) * 0.4)); levelRaf = requestAnimationFrame(fakeTick); };
    if (!reduced) fakeTick();
    let done = false, silentTimer = 0;
    const t0 = performance.now();
    const finish = () => { if (done) return; done = true; stopMeter(); setState('idle'); onEnd(); };
    u.onend = () => {
      // Some devices have no usable voice and "finish" instantly. Keep the read-along timing so the
      // highlight still walks the page at reading pace instead of racing to the end.
      if (performance.now() - t0 < 150 && plain.length > 15) {
        const ms = Math.max(900, (plain.split(/\s+/).length / 2.8) * 1000 / (Number(rate.value) || 1));
        voiceNote.textContent = 'No voice is available on this device, so I’m highlighting the page at reading pace instead.';
        silentTimer = window.setTimeout(finish, ms);
        return;
      }
      finish();
    };
    u.onerror = u.onend as any;
    setState('speaking');
    speechSynthesis.speak(u);
    return () => { done = true; clearTimeout(silentTimer); speechSynthesis.cancel(); stopMeter(); };
  }
  const hush = () => { audio?.pause(); audio = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); stopMeter(); setState('idle'); };

  /* ── reader ── */
  const readRoot = $('[data-read-root]') || document.body;
  const reader = makeReader(readRoot, speak, {
    progress: $('[data-read-progress]', root)!, pos: $('[data-read-pos]', root)!, toggle: $<HTMLButtonElement>('[data-read-toggle]', root)!,
    panel: readerPanel, onState: setState,
  });
  readBtn.addEventListener('click', () => { if (reader.active) reader.stop(); else { add('bot', `Reading this page. Use the controls above to pause, restart or stop.`); reader.start(); } });
  $('[data-read-toggle]', root)!.addEventListener('click', () => reader.toggle());
  $('[data-read-restart]', root)!.addEventListener('click', () => reader.restart());
  $('[data-read-stop]', root)!.addEventListener('click', () => reader.stop());
  rate.addEventListener('change', () => reader.rerun());

  /* ── log ── */
  const KEY = 'ferrn-bob';
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch {}
  const session = (() => { try { let s = sessionStorage.getItem('ferrn-bob-s'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('ferrn-bob-s', s); } return s; } catch { return ''; } })();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const linkify = (s: string) => esc(s)
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(\/(?:marketplace|work|services|contact|team|about|insights|profile|links|careers|rfp)[\w\-/#]*)/g, '$1<a href="$2">$2</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  type Reply = { message: string; action?: { type: 'navigate'; href: string; label?: string } | { type: 'read' } | { type: 'scroll'; selector: string }; sources?: string[] };
  const ICON_SPEAK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  const add = (role: 'me' | 'bot', text: string, extra?: Reply) => {
    const d = document.createElement('div');
    d.className = `msg ${role}`;
    d.innerHTML = linkify(text);
    if (role === 'bot') {
      const acts = document.createElement('div'); acts.className = 'msg-actions';
      const sp = document.createElement('button'); sp.type = 'button'; sp.innerHTML = `${ICON_SPEAK} ${S.voice || 'Listen'}`;
      sp.addEventListener('click', () => (state === 'speaking' ? hush() : speak(text)));
      acts.appendChild(sp);
      if (extra?.action?.type === 'navigate') {
        const a = document.createElement('a'); a.href = extra.action.href; a.textContent = extra.action.label || 'Take me there →'; acts.appendChild(a);
      }
      if (extra?.action?.type === 'read') { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Read this page'; b.addEventListener('click', () => reader.start()); acts.appendChild(b); }
      d.appendChild(acts);
      if (extra?.sources?.length) { const s = document.createElement('div'); s.className = 'msg-src'; s.textContent = 'From: ' + extra.sources.join(', '); d.appendChild(s); }
    }
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  };
  const render = () => { log.innerHTML = ''; add('bot', (S.welcome || `Hi, I’m ${name}. Ask me anything about Ferrn, or ask me to read this page.`)); history.forEach((m) => add(m.role === 'user' ? 'me' : 'bot', m.content)); };

  /* ── open/close ── */
  let opened = false;
  const open = () => { root.dataset.open = '1'; sheet.hidden = false; scrim.classList.add('on'); openBtn.setAttribute('aria-expanded', 'true'); blobs.forEach((b) => b.start()); if (!opened) { render(); opened = true; } setTimeout(() => input.focus(), 350); };
  const close = () => { delete root.dataset.open; scrim.classList.remove('on'); openBtn.setAttribute('aria-expanded', 'false'); if (!reader.active) hush(); openBtn.focus(); };
  openBtn.addEventListener('click', open); closeBtn.addEventListener('click', close); scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.dataset.open) close(); });
  // The launcher orb idles quietly; animate only when visible and the tab is active.
  const io = new IntersectionObserver((en) => en.forEach((e) => (e.isIntersecting && document.visibilityState === 'visible' ? blobs[0]?.start() : blobs[0]?.stop())));
  io.observe(openBtn);
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? blobs.forEach((b) => b.start()) : blobs.forEach((b) => b.stop())));

  /* ── ask ── */
  const ask = async (q: string) => {
    q = q.trim(); if (!q) return;
    input.value = '';
    add('me', q);
    hush(); setState('thinking');
    const typing = document.createElement('div'); typing.className = 'msg bot typing'; typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing); log.scrollTop = log.scrollHeight;
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q, history, lang, path: location.pathname, session }) });
      const j = (await r.json()) as Reply & { ok?: boolean };
      typing.remove();
      add('bot', j.message, j);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: j.message });
      history = history.slice(-12);
      try { sessionStorage.setItem(KEY, JSON.stringify(history)); } catch {}
      setState('idle');
      if (autoVoice.checked || lastWasVoice) speak(j.message);
      lastWasVoice = false;
      if (j.action?.type === 'read') reader.start();
      else if (j.action?.type === 'scroll') { const el = $(j.action.selector); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('bob-nav-hl'); setTimeout(() => el.classList.remove('bob-nav-hl'), 2600); } }
      else if (j.action?.type === 'navigate' && /^\/[^/]/.test(j.action.href)) { const to = j.action.href; setTimeout(() => { location.href = to; }, autoVoice.checked ? 1800 : 900); }
    } catch { typing.remove(); setState('idle'); add('bot', S.error || 'Something went wrong — please try again.'); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  $$('[data-bob-ask]', root).forEach((b) => b.addEventListener('click', () => ask(b.dataset.bobAsk || b.textContent || '')));
  // Other parts of the page can open Bob with a question: <a data-bob-prompt="…">
  document.addEventListener('click', (e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bob-prompt]'); if (!el) return; e.preventDefault(); open(); ask(el.dataset.bobPrompt || ''); });

  /* ── mic (only on tap; never auto-starts) ── */
  let lastWasVoice = false;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const mic = $<HTMLButtonElement>('[data-bob-mic]', root)!;
  if (!SR) mic.hidden = true;
  else {
    let rec: any = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      hush();
      rec = new SR(); rec.lang = bcp[lang] || 'en-NG'; rec.interimResults = true;
      mic.classList.add('rec'); mic.setAttribute('aria-pressed', 'true'); setState('listening');
      let final = '';
      rec.onresult = (ev: any) => { let s = ''; for (const r of ev.results) s += r[0].transcript; input.value = s; if (ev.results[ev.results.length - 1].isFinal) final = s; blobs.forEach((b) => b.level(0.5)); };
      rec.onend = () => { mic.classList.remove('rec'); mic.setAttribute('aria-pressed', 'false'); rec = null; stopMeter(); setState('idle'); if (final.trim()) { lastWasVoice = true; ask(final); } };
      rec.onerror = rec.onend;
      try { rec.start(); } catch { rec.onend(); }
    });
  }

  return { open, close, ask, speak, reader, setState };
}
