/* Bob's launcher, the only part of Bob in the main bundle. A ghost that floats, blinks and watches the
   pointer. Clicking it (or anything with data-bob-prompt) loads the full assistant (/assets/bob.js + bob.css)
   once. Also: the visitor's first name personalises a few headlines, and the contact form picks up what the
   guided tour collected. */
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

type BobApi = { open: (mode?: string) => void; ask: (q: string) => void; resume: () => void };
declare global { interface Window { FerrnBob?: BobApi; __ferrnBobLoading?: Promise<BobApi> } }

export function loadBob(): Promise<BobApi> {
  if (window.FerrnBob) return Promise.resolve(window.FerrnBob);
  if (window.__ferrnBobLoading) return window.__ferrnBobLoading;
  const root = $('[data-bob]');
  const src = root?.dataset.bobSrc || '/assets/bob.js', css = root?.dataset.bobCss || '/assets/bob.css';
  window.__ferrnBobLoading = new Promise((resolve, reject) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => (window.FerrnBob ? resolve(window.FerrnBob) : reject(new Error('Bob did not start')));
    s.onerror = () => { window.__ferrnBobLoading = undefined; reject(new Error('Bob could not load')); };
    document.head.appendChild(s);
  });
  return window.__ferrnBobLoading;
}

/* ── first name: validation shared with the assistant ── */
export const NAME_KEY = 'ferrn-name';
export function readName(): string { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }

/** Headlines that greet the visitor by name: "Not for show, Michael." */
const PERSONAL = ['.hx-rest', '.footer-title .grad'];
export function personalise(name = readName()) {
  for (const sel of PERSONAL) {
    for (const el of $$<HTMLElement>(sel)) {
      if (el.dataset.orig === undefined) el.dataset.orig = el.textContent || '';
      const orig = el.dataset.orig;
      el.textContent = name ? orig.replace(/\s*([.!?…])?\s*$/, (_m, p) => `, ${name}${p || ''}`) : orig;
      el.classList.toggle('is-personal', !!name);
    }
  }
  // section headlines carry a {, Name} slot anywhere in the sentence: filled when known, empty otherwise
  for (const el of $$<HTMLElement>('[data-nm]')) el.textContent = name ? (el.dataset.nm || '').replace('%', name) : '';
  dispatchEvent(new CustomEvent('ferrn:name', { detail: name }));
}

/** The tour leaves a prefilled message for the contact form; fill it in when the form is on the page. */
export function prefillContact() {
  let p: Record<string, string> | null = null;
  try { p = JSON.parse(sessionStorage.getItem('ferrn-prefill') || 'null'); } catch {}
  const form = $<HTMLFormElement>('form[data-form="contact"]');
  if (!p || !form) return;
  for (const [k, v] of Object.entries(p)) {
    const f = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (f && v && !f.value) f.value = v;
  }
  const more = $<HTMLDetailsElement>('.cform-more', form);
  if (more && (p.phone || p.company || p.need)) more.open = true;
}

export function bobLauncher() {
  const root = $('[data-bob]'); if (!root) return;
  const btn = $<HTMLButtonElement>('[data-bob-open]', root)!;
  const eyes = $<SVGGElement>('.ghost-eyes', root);
  const open = (mode?: string) => {
    root.classList.add('loading');
    loadBob().then((b) => b.open(mode)).catch(() => { root.classList.remove('loading'); location.href = '/contact'; })
      .finally(() => root.classList.remove('loading'));
  };
  btn.addEventListener('click', () => open());
  // "Try Bob" buttons and the like: <button data-bob-prompt="…"> (empty prompt just opens, "tour" starts the tour)
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bob-prompt]'); if (!el) return;
    e.preventDefault();
    const q = el.dataset.bobPrompt || '';
    if (q === 'tour') return open('present');
    loadBob().then((b) => { b.open('chat'); if (q) b.ask(q); }).catch(() => {});
  });
  // Blink now and then (a class flip, not an endless animation that would restyle the page every frame).
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const blink = () => {
      if (document.visibilityState === 'visible') { btn.classList.add('blink'); setTimeout(() => btn.classList.remove('blink'), 140); }
      setTimeout(blink, 3800 + Math.random() * 3200);
    };
    setTimeout(blink, 3000);
  }
  // The eyes follow the pointer (cheap: one transform per frame at most).
  if (eyes && matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let raf = 0, x = 0, y = 0;
    // The launcher is fixed, so its centre only moves on resize: measure then, never per frame.
    let cx = 0, cy = 0;
    const measure = () => { const r = btn.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; };
    measure(); addEventListener('resize', measure, { passive: true });
    // Only while the pointer is near the ghost, about 30 times a second, and only when the eyes would actually move.
    let last = '', t = 0;
    const look = (tx: number, ty: number) => {
      const k = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
      if (k !== last) { last = k; eyes.style.transform = k; }
    };
    addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (raf || e.timeStamp - t < 33) return;
      t = e.timeStamp;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!cx) measure();
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > 420) return look(0, 0);
        const a = Math.atan2(y - cy, x - cx), d = Math.min(1, dist / 300);
        look(Math.cos(a) * 4 * d, Math.sin(a) * 3 * d);
      });
    }, { passive: true });
  }
  personalise();
  prefillContact();
  // A tour or an open chat carries on after a page change.
  let resume = false;
  try { resume = !!sessionStorage.getItem('ferrn-bob-tour') || sessionStorage.getItem('ferrn-bob-open') === '1'; } catch {}
  if (resume) loadBob().then((b) => b.resume()).catch(() => {});
}
