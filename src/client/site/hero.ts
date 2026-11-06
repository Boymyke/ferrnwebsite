/* Home hero: one changing word, and an orange halftone dot texture that appears only where the pointer
   moves (WebGL, set up on the first move, idle when the pointer is still). Plus the growth calculator.
   Without WebGL or with reduced motion there is simply no texture. */
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
// Pass 1, one fragment per dot: how much light a dot gets from the pointer's recent path (a soft, noisy
// trail that fades out). Pass 2 draws the dots. Nothing is drawn when the pointer is still.
const TRAIL = 14;
const FIELD = `precision mediump float;
uniform vec2 uGrid;uniform float uCell;uniform float uTime;uniform vec3 uT[${TRAIL}];uniform float uR;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
void main(){
  vec2 g=vec2(gl_FragCoord.x,uGrid.y-gl_FragCoord.y);
  vec2 c=(floor(g)+.5)*uCell;
  float v=0.;
  for(int i=0;i<${TRAIL};i++){ vec3 t=uT[i]; vec2 d=c-t.xy; v+=t.z*exp(-dot(d,d)/(uR*uR)); }
  float cloud=n(c/(uR*.55)+vec2(uTime*.35,-uTime*.25))*.65+n(c/(uR*.22)-uTime*.4)*.35;
  v*=smoothstep(.28,.85,cloud);
  gl_FragColor=vec4(clamp(v,0.,.62),0.,0.,1.);
}`;
const DOTS = `precision mediump float;
uniform sampler2D uField;uniform vec2 uRes;uniform vec2 uGrid;uniform float uCell;uniform float uDpr;uniform float uAlpha;
void main(){
  vec2 f=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 g=floor(f/uCell);
  float v=texture2D(uField,vec2((g.x+.5)/uGrid.x,1.-(g.y+.5)/uGrid.y)).r;
  vec2 c=(g+.5)*uCell;
  float r=sqrt(v)*uCell*.5;
  float a=smoothstep(r,r-1.1*uDpr,length(f-c))*step(.02,v)*uAlpha;
  vec3 col=vec3(.976,.267,.024);
  gl_FragColor=vec4(col*a,a);
}`;

function dots(hero: HTMLElement, reduced: boolean) {
  const canvas = $<HTMLCanvasElement>('[data-dots]', hero);
  if (!canvas || reduced) return;
  let gl: WebGLRenderingContext | null = null;
  let ready = false, P1: WebGLProgram, P2: WebGLProgram, tex: WebGLTexture, fbo: WebGLFramebuffer;
  let U1: Record<string, WebGLUniformLocation | null> = {}, U2: Record<string, WebGLUniformLocation | null> = {};
  const dpr = Math.min(devicePixelRatio || 1, 2), CELL = 7 * dpr;
  let W = 0, H = 0, GW = 1, GH = 1;
  // Set WebGL up lazily, on the first pointer move, so it costs nothing on load.
  const init = () => {
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return false;
    const g = gl;
    const sh = (t: number, src: string) => { const x = g.createShader(t)!; g.shaderSource(x, src); g.compileShader(x); return x; };
    const link = (frag: string) => { const p = g.createProgram()!; const f = sh(g.FRAGMENT_SHADER, frag); g.attachShader(p, sh(g.VERTEX_SHADER, VERT)); g.attachShader(p, f); g.linkProgram(p); if (g.getProgramParameter(p, g.LINK_STATUS)) return p; console.warn('hero dots shader:', g.getShaderInfoLog(f)); return null; };
    const a = link(FIELD), b = link(DOTS); if (!a || !b) return false; P1 = a; P2 = b;
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    for (const p of [P1, P2]) { const l = g.getAttribLocation(p, 'p'); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, 2, g.FLOAT, false, 0, 0); }
    for (const k of ['uGrid', 'uCell', 'uTime', 'uT', 'uR']) U1[k] = g.getUniformLocation(P1, k);
    for (const k of ['uField', 'uRes', 'uGrid', 'uCell', 'uDpr', 'uAlpha']) U2[k] = g.getUniformLocation(P2, k);
    tex = g.createTexture()!; fbo = g.createFramebuffer()!;
    g.bindTexture(g.TEXTURE_2D, tex);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    size(); ready = true; return true;
  };
  const size = () => {
    if (!gl) return;
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width * dpr); H = Math.round(r.height * dpr); canvas.width = W; canvas.height = H;
    GW = Math.ceil(W / CELL); GH = Math.ceil(H / CELL);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  addEventListener('resize', () => { if (ready) size(); });
  // The trail: recent pointer positions, each fading out.
  const trail = new Float32Array(TRAIL * 3);
  let head = 0, lastX = -1, lastY = -1, raf = 0, t0 = performance.now(), failed = false;
  const light = matchMedia('(prefers-color-scheme: light)');
  const push = (x: number, y: number, s: number) => {
    trail[head * 3] = x * dpr; trail[head * 3 + 1] = y * dpr; trail[head * 3 + 2] = s; head = (head + 1) % TRAIL;
  };
  const move = (cx: number, cy: number) => {
    if (failed) return;
    if (!ready && !init()) { failed = true; return; }
    const r = hero.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    const d = lastX < 0 ? 99 : Math.hypot(x - lastX, y - lastY);
    if (d < 6) return;
    push(x, y, Math.min(0.55, 0.22 + d / 120)); lastX = x; lastY = y;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  function frame(now: number) {
    raf = 0;
    if (!hero.isConnected || !gl) return;
    let alive = 0;
    for (let i = 0; i < TRAIL; i++) { trail[i * 3 + 2] *= 0.93; if (trail[i * 3 + 2] > 0.01) alive++; else trail[i * 3 + 2] = 0; }
    const g = gl;
    g.bindFramebuffer(g.FRAMEBUFFER, fbo); g.viewport(0, 0, GW, GH); g.disable(g.BLEND); g.useProgram(P1);
    g.uniform2f(U1.uGrid, GW, GH); g.uniform1f(U1.uCell, CELL); g.uniform1f(U1.uTime, (now - t0) / 1000);
    g.uniform3fv(U1.uT, trail); g.uniform1f(U1.uR, 95 * dpr);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, W, H); g.useProgram(P2);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex); g.uniform1i(U2.uField, 0);
    g.uniform2f(U2.uRes, W, H); g.uniform2f(U2.uGrid, GW, GH); g.uniform1f(U2.uCell, CELL); g.uniform1f(U2.uDpr, dpr);
    g.uniform1f(U2.uAlpha, document.documentElement.dataset.theme === 'light' || (document.documentElement.dataset.theme !== 'dark' && light.matches) ? 0.7 : 0.75);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    if (alive) raf = requestAnimationFrame(frame); else lastX = -1; // stop drawing once the trail has faded
  }
  hero.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerleave', () => { lastX = -1; });
}

/* The changing word: one clean move, the old word lifts away, the next rises into place. */
function flick(hero: HTMLElement, reduced: boolean) {
  const box = $('[data-flick]', hero), word = box && $('.hx-flick-word', box);
  if (!box || !word) return;
  const words = (box.dataset.flick || '').split('|').filter(Boolean);
  if (words.length < 2) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden || !hero.isConnected) return;
    i = (i + 1) % words.length;
    if (reduced) { word.textContent = words[i]; return; }
    word.classList.remove('in'); word.classList.add('out');
    word.addEventListener('animationend', () => { word.textContent = words[i]; word.classList.remove('out'); void word.offsetWidth; word.classList.add('in'); }, { once: true });
  }, 2800);
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
  if (hero && !hero.dataset.ready) { hero.dataset.ready = '1'; dots(hero, reduced); flick(hero, reduced); }
  calc();
}
