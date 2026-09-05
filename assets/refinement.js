(() => {
  const hero = document.querySelector('.hero-editorial');
  if (hero && !hero.querySelector('.hero-reveal-stage')) {
    const original = hero.querySelector('.hero-inner');
    if (original) {
      const stage = document.createElement('div');
      stage.className = 'hero-reveal-stage';

      const front = document.createElement('div');
      front.className = 'hero-reveal-layer hero-layer-front';
      front.appendChild(original.cloneNode(true));

      const back = document.createElement('div');
      back.className = 'hero-reveal-layer hero-layer-back';
      back.appendChild(original.cloneNode(true));

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hero-reveal-svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.innerHTML = `<defs><filter id="ferrn-smudge-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="25"/><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -14"/></filter></defs><mask id="ferrn-smudge-mask"><g class="ferrn-smudge-blobs" filter="url(#ferrn-smudge-goo)"></g></mask>`;

      stage.append(front, back, svg);
      original.remove();
      hero.appendChild(stage);

      const blobs = svg.querySelector('.ferrn-smudge-blobs');
      let last = 0;
      const stamp = (x, y) => {
        if (!blobs) return;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', '22');
        circle.setAttribute('fill', 'white');
        blobs.prepend(circle);
        if (window.gsap) {
          window.gsap.to(circle, {attr:{r:105}, duration:.42, ease:'power2.out'});
          window.gsap.to(circle, {attr:{r:0}, duration:.85, delay:.42, ease:'power2.in', onComplete:()=>circle.remove()});
        } else {
          setTimeout(()=>circle.remove(), 1100);
        }
      };

      hero.addEventListener('pointermove', e => {
        const now = performance.now();
        if (now - last < 28) return;
        last = now;
        const r = hero.getBoundingClientRect();
        stamp(e.clientX - r.left, e.clientY - r.top);
      }, {passive:true});
    }
  }

  document.querySelectorAll('.testimonial-slide').forEach(slide => {
    if (slide.querySelector('.testimonial-card-inner')) return;
    const person = slide.querySelector('.testimonial-person');
    const img = person?.querySelector('img');
    const quote = slide.querySelector('.testimonial-quote');
    const audio = slide.querySelector('.testimonial-audio');
    if (!person || !img || !quote) return;

    const wrap = document.createElement('div');
    wrap.className = 'testimonial-card-inner';

    const portrait = img.cloneNode(true);
    portrait.className = 'testimonial-portrait';
    portrait.removeAttribute('loading');

    wrap.appendChild(portrait);
    wrap.appendChild(quote);
    if (audio) wrap.appendChild(audio);
    wrap.appendChild(person);
    slide.appendChild(wrap);
  });

  window.lucide?.createIcons();
})();
