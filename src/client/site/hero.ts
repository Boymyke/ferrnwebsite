/* Home hero: an orange halftone light (WebGL) falling onto a showreel of client sites, words that flick,
   plus the growth calculator. Everything here is optional decoration: without WebGL the light becomes a
   soft CSS glow, and with reduced motion nothing moves on its own. */
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
// Halftone field: a beam of light lands on the top edge of the showreel, spreads along it, blooms into
// drifting clouds and runs down the right edge (after the reference video), drawn as a grid of orange dots.
// The pointer leans the beam and lifts the dots near it, gently.
const FRAG = `precision mediump float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uHover;uniform vec4 uCard;uniform float uCell;uniform float uDpr;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float field(vec2 p){
  float s=1./uDpr; vec2 q=p*s; vec4 c=uCard*s; vec2 res=uRes*s;
  float w=c.z-c.x; float top=c.y;
  float cx=mix(c.x,c.z,.5)+(uMouse.x-.5)*90.*uHover;
  float dy=top-q.y; float above=step(0.,dy);
  float fadeTop=smoothstep(top*.42,top*.97,q.y);
  float bw=2.2+dy*.012;
  float beam=exp(-pow((q.x-cx)/bw,2.))*above*fadeTop;
  float halo=exp(-pow((q.x-cx)/(10.+dy*.07),2.))*above*fadeTop*.35;
  float base=exp(-pow((q.x-cx)/(w*.17),2.)-pow(dy/64.,2.))*above;
  float edge=exp(-pow(dy/13.,2.))*smoothstep(w*.52,0.,abs(q.x-cx))*above;
  float t=uTime;
  float cl=fbm(q*.0048+vec2(t*.028,-t*.045));
  float cl2=fbm(q*.011-vec2(t*.05,t*.02));
  float mask=exp(-pow((q.x-cx)/(w*.3),2.)-pow((dy-95.)/120.,2.))*above;
  float clouds=smoothstep(.5,.9,cl*.72+cl2*.36)*mask;
  float rim=exp(-pow((q.x-c.z)/10.,2.))*smoothstep(top+260.,top,q.y)*step(top,q.y);
  float rimL=exp(-pow((q.x-c.x)/10.,2.))*smoothstep(top+120.,top,q.y)*step(top,q.y)*.45;
  vec2 m=uMouse*res; vec2 d=q-m;
  float mg=exp(-dot(d,d)/(2.*120.*120.))*uHover*(fbm(q*.012+t*.12)*.8+.2)*.38;
  float inside=step(c.x,q.x)*step(q.x,c.z)*step(c.y,q.y);
  float v=(beam*1.1+halo+base*.7+edge*.85+clouds*.65+rim*.55+rimL+mg)*.9;
  return clamp(v,0.,1.)*(1.-inside);
}
uniform vec2 uGrid;
void main(){
  // one fragment per dot: the cell centre in full-resolution pixels, y down
  vec2 g=vec2(gl_FragCoord.x,uGrid.y-gl_FragCoord.y);
  vec2 cell=(floor(g)+.5)*uCell;
  gl_FragColor=vec4(field(cell),0.,0.,1.);
}`;
const DOTS = `precision mediump float;
uniform sampler2D uField;uniform vec2 uRes;uniform vec2 uGrid;uniform float uCell;uniform float uDpr;
void main(){
  vec2 f=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 g=floor(f/uCell);
  float v=texture2D(uField,vec2((g.x+.5)/uGrid.x,1.-(g.y+.5)/uGrid.y)).r;
  vec2 cell=(g+.5)*uCell;
  float r=sqrt(v)*uCell*.5;
  float a=smoothstep(r,r-1.1*uDpr,length(f-cell))*step(.015,v);
  vec3 col=mix(vec3(.976,.267,.024),vec3(1.,.78,.6),smoothstep(.72,1.,v));
  gl_FragColor=vec4(col*a,a);
}`;

function dots(hero: HTMLElement, reduced: boolean) {
  const canvas = $<HTMLCanvasElement>('[data-dots]', hero), card = $('[data-reel]', hero);
  if (!canvas || !card) return;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) { canvas.classList.add('fallback'); return; }
  const sh = (type: number, src: string) => { const x = gl.createShader(type)!; gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const link = (frag: string) => { const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
  const pField = link(FRAG), pDots = link(DOTS);
  if (!pField || !pDots) { canvas.classList.add('fallback'); return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (const p of [pField, pDots]) { const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); }
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  const F = { res: U(pField, 'uRes'), time: U(pField, 'uTime'), mouse: U(pField, 'uMouse'), hover: U(pField, 'uHover'), card: U(pField, 'uCard'), cell: U(pField, 'uCell'), dpr: U(pField, 'uDpr'), grid: U(pField, 'uGrid') };
  const D = { field: U(pDots, 'uField'), res: U(pDots, 'uRes'), grid: U(pDots, 'uGrid'), cell: U(pDots, 'uCell'), dpr: U(pDots, 'uDpr') };
  const tex = gl.createTexture(); const fbo = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const mobile = matchMedia('(max-width: 760px)').matches;
  const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  const CELL = 7 * dpr;
  let W = 0, H = 0, GW = 1, GH = 1;
  const size = () => {
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
    canvas.width = W; canvas.height = H;
    GW = Math.ceil(W / CELL); GH = Math.ceil(H / CELL);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  const cardBox = () => {
    const h = hero.getBoundingClientRect(), c = card.getBoundingClientRect();
    return [(c.left - h.left) * dpr, (c.top - h.top) * dpr, (c.right - h.left) * dpr, (c.bottom - h.top) * dpr];
  };
  size(); addEventListener('resize', size);
  let mx = 0.5, my = 0.3, tx = 0.5, ty = 0.3, hover = 0, th = 0;
  if (matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; th = 1; }, { passive: true });
    hero.addEventListener('pointerleave', () => { th = 0; });
  }
  let visible = true, raf = 0, t0 = performance.now(), last = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(hero);
  function frame(now: number) {
    raf = 0;
    if (!hero.isConnected) return; // page swapped away
    if (mobile && now - last < 33) { raf = requestAnimationFrame(frame); return; } // ~30 fps on phones
    last = now;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05; hover += (th - hover) * 0.04;
    const g = gl!;
    // pass 1 — the light field, one pixel per dot
    g.bindFramebuffer(g.FRAMEBUFFER, fbo); g.viewport(0, 0, GW, GH); g.disable(g.BLEND); g.useProgram(pField);
    g.uniform2f(F.res, W, H); g.uniform1f(F.time, reduced ? 4 : (now - t0) / 1000); g.uniform2f(F.mouse, mx, my); g.uniform1f(F.hover, hover);
    const b = cardBox(); g.uniform4f(F.card, b[0], b[1], b[2], b[3]); g.uniform1f(F.cell, CELL); g.uniform1f(F.dpr, dpr); g.uniform2f(F.grid, GW, GH);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    // pass 2 — dots
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, W, H); g.useProgram(pDots);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex); g.uniform1i(D.field, 0);
    g.uniform2f(D.res, W, H); g.uniform2f(D.grid, GW, GH); g.uniform1f(D.cell, CELL); g.uniform1f(D.dpr, dpr);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(frame); });
  if (reduced) { // one still frame, redrawn on resize
    addEventListener('resize', () => requestAnimationFrame(frame));
  }
  raf = requestAnimationFrame(frame);
}

/* Words that flick: a quick neon flicker while the letters scramble into the next word. */
function flick(hero: HTMLElement, reduced: boolean) {
  const box = $('[data-flick]', hero), word = box && $('.hx-flick-word', box);
  if (!box || !word) return;
  const words = (box.dataset.flick || '').split('|').filter(Boolean);
  if (words.length < 2) return;
  let i = 0;
  const glyphs = 'abcdefghijklmnopqrstuvwxyz';
  const show = (next: string) => {
    if (reduced) { word.textContent = next; return; }
    box.classList.remove('flicking'); void box.offsetWidth; box.classList.add('flicking');
    let step = 0; const steps = 9;
    const tick = () => {
      step++;
      const done = Math.floor((step / steps) * next.length);
      word.innerHTML = next.split('').map((ch, k) => (k < done || ch === ' ' ? ch : `<span class="g">${glyphs[(k + step) % glyphs.length]}</span>`)).join('');
      if (step < steps) setTimeout(tick, 38); else word.textContent = next;
    };
    tick();
  };
  setInterval(() => { if (document.hidden || !hero.isConnected) return; i = (i + 1) % words.length; show(words[i]); }, 2600);
}

/* Showreel: each client site scrolls slowly from top to bottom, then fades into the next. */
function reel(hero: HTMLElement, reduced: boolean) {
  const root = $('[data-reel]', hero); if (!root) return;
  const screen = $('.hx-screen', root)!, urlEl = $('[data-reel-url]', root) as HTMLAnchorElement | null;
  let slides = $$<HTMLElement>('[data-slide]', root);
  const bars = $$('.hx-progress i', root);
  const DUR = 7000;
  slides.forEach((s, k) => {
    const img = $<HTMLImageElement>('img', s)!;
    img.addEventListener('error', () => {
      s.classList.add('broken'); bars[k]?.remove(); slides = slides.filter((x) => x !== s);
      if (!slides.length) { // no captures yet: fall back to a bundled still so the stage is never empty
        const f = document.createElement('div'); f.className = 'hx-slide on';
        f.innerHTML = '<img src="/assets/home/hero-clinic.webp" alt="" width="1800" height="1108">'; screen.appendChild(f); return;
      }
      if (s.classList.contains('on')) go(0);
    });
  });
  let i = 0, timer = 0, anim: Animation | null = null, paused = false;
  const go = (n: number) => {
    if (!slides.length) return;
    clearTimeout(timer); anim?.cancel();
    const prev = slides.find((s) => s.classList.contains('on'));
    i = (n + slides.length) % slides.length;
    const s = slides[i], img = $<HTMLImageElement>('img', s)!;
    if (prev && prev !== s) { prev.classList.remove('on'); prev.tabIndex = -1; }
    s.classList.add('on'); s.tabIndex = 0;
    const live = s.dataset.url || '';
    if (urlEl) { urlEl.href = live; const sp = $('span', urlEl); if (sp) sp.textContent = live.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }
    const allBars = $$('.hx-progress i', root);
    allBars.forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.remove('on'); });
    void root.offsetWidth; allBars[i]?.classList.add('on'); root.style.setProperty('--dur', DUR + 'ms');
    // preload the next one
    const nx = slides[(i + 1) % slides.length]; const ni = nx && $<HTMLImageElement>('img', nx); if (ni && ni.loading === 'lazy') ni.loading = 'eager';
    const run = () => {
      const travel = Math.max(0, img.getBoundingClientRect().height - screen.clientHeight);
      if (!reduced && travel > 0) {
        anim = img.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(0,${-Math.min(travel, screen.clientHeight * 2.6)}px,0)` }],
          { duration: DUR - 400, delay: 300, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
        if (paused) anim.pause();
      }
    };
    if (img.complete && img.naturalHeight) run(); else img.addEventListener('load', run, { once: true });
    timer = window.setTimeout(() => go(i + 1), DUR);
    if (paused) clearTimeout(timer);
  };
  const setPaused = (p: boolean) => {
    if (p === paused) return; paused = p; hero.classList.toggle('paused', p);
    if (p) { clearTimeout(timer); anim?.pause(); } else { anim?.play(); const left = anim ? Math.max(800, DUR - (Number(anim.currentTime) || 0)) : DUR; timer = window.setTimeout(() => go(i + 1), left); }
  };
  root.addEventListener('pointerenter', () => setPaused(true));
  root.addEventListener('pointerleave', () => setPaused(false));
  root.addEventListener('focusin', () => setPaused(true));
  root.addEventListener('focusout', () => setPaused(false));
  new IntersectionObserver(([e]) => setPaused(!e.isIntersecting)).observe(root);
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));
  go(0);
}

/* Growth calculator: visitors × conversion × sale value, today vs one extra point of conversion. */
function calc() {
  const box = $('[data-calc]'); if (!box) return;
  let cur: 'NGN' | 'USD' = 'NGN';
  try { if (localStorage.getItem('ferrn-currency') === 'USD') cur = 'USD'; } catch {}
  const input = (k: string) => $<HTMLInputElement>(`[data-calc-in="${k}"]`, box)!;
  const out = (k: string, v: string) => { const el = $(`[data-calc-out="${k}"]`, box); if (el) el.textContent = v; };
  // The sale slider is a log scale: ₦5k–₦50m or $5–$50k.
  const saleOf = (x: number) => { const [lo, hi] = cur === 'USD' ? [5, 50000] : [5000, 50000000]; const v = lo * Math.pow(hi / lo, x / 100); const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / mag) * mag; };
  const money = (n: number) => (cur === 'USD' ? '$' + Math.round(n).toLocaleString('en-US') : '₦' + Math.round(n).toLocaleString('en-NG'));
  const render = () => {
    const visits = Number(input('visits').value), sale = saleOf(Number(input('sale').value)), rate = Number(input('rate').value);
    const better = Math.min(rate + 1, rate * 2.5);
    const extraCustomers = Math.round((visits * (better - rate)) / 100);
    const extra = extraCustomers * sale;
    out('visits', visits.toLocaleString()); out('sale', money(sale)); out('rate', rate.toFixed(1) + '%'); out('better', better.toFixed(1) + '%');
    out('extra', '+' + money(extra)); out('customers', `+${extraCustomers.toLocaleString()} customer${extraCustomers === 1 ? '' : 's'}`); out('year', money(extra * 12) + ' a year');
  };
  $$('input[type=range]', box).forEach((r) => r.addEventListener('input', render));
  $$<HTMLButtonElement>('[data-calc-cur]', box).forEach((b) => {
    b.classList.toggle('active', b.dataset.calcCur === cur);
    b.addEventListener('click', () => { cur = b.dataset.calcCur as 'NGN' | 'USD'; $$('[data-calc-cur]', box).forEach((x) => x.classList.toggle('active', x === b)); render(); });
  });
  render();
}

export function home(reduced: boolean) {
  const hero = $<HTMLElement>('.hx[data-hero]');
  if (hero && !hero.dataset.ready) { hero.dataset.ready = '1'; dots(hero, reduced); flick(hero, reduced); reel(hero, reduced); }
  calc();
}
