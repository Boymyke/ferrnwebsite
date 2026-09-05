(() => {
  const hero = document.querySelector('.hero-editorial');
  if (!hero) return;

  const original = hero.querySelector(':scope > .hero-inner');
  if (!original) return;

  // The server-rendered hero is always the source of truth and always remains visible.
  // The reveal is only a desktop/fine-pointer enhancement layered on top.
  const canReveal = window.matchMedia('(min-width: 901px) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canReveal || hero.querySelector('.hero-reveal-back')) return;

  const back = document.createElement('div');
  back.className = 'hero-reveal-back';

  const clone = original.cloneNode(true);
  clone.classList.add('hero-reveal-clone');
  back.appendChild(clone);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'hero-reveal-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs>
    <filter id="ferrn-smudge-goo">
      <feGaussianBlur in="SourceGraphic" stdDeviation="24"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 58 -13"/>
    </filter>
    <mask id="ferrn-smudge-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
      <g class="ferrn-smudge-blobs" filter="url(#ferrn-smudge-goo)"></g>
    </mask>
  </defs>`;

  hero.append(back, svg);

  const blobs = svg.querySelector('.ferrn-smudge-blobs');
  let last = 0;

  const stamp = (x, y) => {
    if (!blobs) return;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '18');
    circle.setAttribute('fill', 'white');
    blobs.prepend(circle);

    if (window.gsap) {
      window.gsap.to(circle, { attr: { r: 112 }, duration: .46, ease: 'power2.out' });
      window.gsap.to(circle, { attr: { r: 0 }, duration: .9, delay: .43, ease: 'power2.in', onComplete: () => circle.remove() });
    } else {
      setTimeout(() => circle.remove(), 1200);
    }
  };

  hero.addEventListener('pointermove', e => {
    const now = performance.now();
    if (now - last < 28) return;
    last = now;
    const rect = hero.getBoundingClientRect();
    stamp(e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: true });
})();
