(() => {
  const slider = document.querySelector('[data-testimonial-slider]');
  if (!slider) return;

  const clone = slider.cloneNode(false);
  clone.className = 'testimonial-slider-v2 reveal visible';
  clone.removeAttribute('data-testimonial-slider');
  slider.replaceWith(clone);

  const viewport = document.createElement('div');
  viewport.className = 'testimonial-viewport-v2';
  const track = document.createElement('div');
  track.className = 'testimonial-track-v2';
  viewport.appendChild(track);

  const prev = document.createElement('button');
  prev.className = 'testimonial-arrow-v2 prev';
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous testimonial');
  prev.innerHTML = '<i data-lucide="arrow-left"></i>';

  const next = document.createElement('button');
  next.className = 'testimonial-arrow-v2 next';
  next.type = 'button';
  next.setAttribute('aria-label', 'Next testimonial');
  next.innerHTML = '<i data-lucide="arrow-right"></i>';

  const dots = document.createElement('div');
  dots.className = 'testimonial-dots-v2';
  clone.append(viewport, prev, next, dots);

  let items = [];
  let index = 0;
  let autoplay = null;
  let currentAudio = null;
  let audioPlaying = false;
  let transitioning = false;

  const waveHeights = [10,18,25,14,29,21,12,27,33,18,26,14,30,20,12,24,32,15,28,21,11,26,34,17,24,13,29,22,16,31,19,11,25,30,14,27,20,12,33,18,24,15,29,21,10,26,31,16];
  const esc = s => String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const personKey = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    audioPlaying = false;
  }

  function makeCard(t, actualIndex, state) {
    const el = document.createElement('article');
    el.className = `testimonial-card-v2 ${state}`;
    el.dataset.actualIndex = String(actualIndex);
    el.dataset.person = personKey(t.name);
    el.innerHTML = `<img class="testimonial-image-v2" src="${esc(t.image)}" alt="${esc(t.name)}" loading="lazy"><div class="audio-wave-v2"><button class="audio-play-v2" type="button" aria-label="Play ${esc(t.name)} testimonial"><i data-lucide="play"></i></button><div class="audio-wave-bars">${waveHeights.map(h=>`<i style="height:${h}px"></i>`).join('')}</div><span class="audio-time-v2">0:00</span></div><div class="testimonial-meta-v2"><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></div>`;

    const audio = new Audio(t.audio);
    audio.preload = 'metadata';
    const play = el.querySelector('.audio-play-v2');
    const bars = [...el.querySelectorAll('.audio-wave-bars i')];
    const wave = el.querySelector('.audio-wave-bars');
    const time = el.querySelector('.audio-time-v2');

    const icon = playing => {
      play.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
      window.lucide?.createIcons();
    };

    play.addEventListener('click', e => {
      e.stopPropagation();
      if (transitioning) return;
      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      if (audio.paused) {
        audio.play().then(() => {
          currentAudio = audio;
          audioPlaying = true;
          clearInterval(autoplay);
          icon(true);
        }).catch(() => {});
      } else {
        audio.pause();
        currentAudio = null;
        audioPlaying = false;
        icon(false);
        restart();
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = audio.currentTime / audio.duration;
      const played = Math.floor(pct * bars.length);
      bars.forEach((b, n) => b.classList.toggle('played', n <= played));
      const s = Math.floor(audio.currentTime);
      time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    });

    audio.addEventListener('ended', () => {
      currentAudio = null;
      audioPlaying = false;
      icon(false);
      bars.forEach(b => b.classList.remove('played'));
      time.textContent = '0:00';
      restart();
    });

    wave.addEventListener('click', e => {
      e.stopPropagation();
      if (!audio.duration) return;
      const r = wave.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
    });

    if (state !== 'active') el.addEventListener('click', () => go(actualIndex, true));
    return el;
  }

  function render(settle = false) {
    if (!items.length) return;
    track.innerHTML = '';
    const p = (index - 1 + items.length) % items.length;
    const n = (index + 1) % items.length;
    track.append(makeCard(items[p], p, 'near'), makeCard(items[index], index, 'active'), makeCard(items[n], n, 'near'));
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === index));
    if (settle) {
      track.classList.remove('settle');
      void track.offsetWidth;
      track.classList.add('settle');
      setTimeout(() => track.classList.remove('settle'), 540);
    }
    window.lucide?.createIcons();
  }

  function directionTo(target) {
    const nextIndex = (index + 1) % items.length;
    const prevIndex = (index - 1 + items.length) % items.length;
    if (target === prevIndex) return -1;
    if (target === nextIndex) return 1;
    const forward = (target - index + items.length) % items.length;
    const backward = (index - target + items.length) % items.length;
    return forward <= backward ? 1 : -1;
  }

  function go(target, user = false) {
    if (!items.length || transitioning) return;
    target = (target + items.length) % items.length;
    if (target === index) return;
    if (user) stopCurrent();

    const dir = directionTo(target);
    transitioning = true;
    clearInterval(autoplay);
    track.classList.add('is-animating', dir > 0 ? 'slide-next' : 'slide-prev');

    setTimeout(() => {
      index = target;
      track.classList.remove('slide-next', 'slide-prev', 'is-animating');
      render(true);
      transitioning = false;
      if (!audioPlaying) restart();
    }, 390);
  }

  function restart() {
    clearInterval(autoplay);
    if (!audioPlaying && !transitioning && items.length > 1) {
      autoplay = setInterval(() => go(index + 1, false), 6500);
    }
  }

  prev.addEventListener('click', () => go(index - 1, true));
  next.addEventListener('click', () => go(index + 1, true));

  fetch('/api/testimonials.php', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      items = Array.isArray(data.testimonials) ? data.testimonials : [];
      if (!items.length) {
        clone.remove();
        return;
      }
      dots.innerHTML = '';
      items.forEach((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
        d.addEventListener('click', () => go(i, true));
        dots.appendChild(d);
      });
      render(true);
      restart();
    })
    .catch(() => clone.remove());
})();
