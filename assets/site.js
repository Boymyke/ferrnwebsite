(() => {
  const root = document.documentElement;
  const loader = document.querySelector('#pageLoader');
  const storedTheme = localStorage.getItem('ferrn-theme');
  if (storedTheme) root.dataset.theme = storedTheme;
  else root.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  const hideLoader = () => { if (loader) requestAnimationFrame(() => loader.classList.remove('active')); };
  if (document.readyState === 'complete') hideLoader(); else window.addEventListener('load', hideLoader, {once:true});
  window.addEventListener('pageshow', hideLoader);

  const updateIcons = () => {
    const themeIcon = document.querySelector('[data-theme-icon]');
    if (themeIcon) themeIcon.setAttribute('data-lucide', root.dataset.theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  };

  document.addEventListener('click', e => {
    const themeBtn = e.target.closest('[data-theme-toggle]');
    const menuBtn = e.target.closest('[data-menu-toggle]');
    const filterBtn = e.target.closest('[data-project-filter]');
    const faqBtn = e.target.closest('[data-faq-toggle]');

    if (themeBtn) {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ferrn-theme', root.dataset.theme);
      updateIcons();
      return;
    }
    if (menuBtn) {
      const open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      return;
    }
    if (filterBtn) {
      const filter = filterBtn.dataset.projectFilter;
      document.querySelectorAll('[data-project-filter]').forEach(b => b.classList.toggle('active', b === filterBtn));
      document.querySelectorAll('[data-project-category]').forEach(card => { card.hidden = card.dataset.projectCategory !== filter; });
      return;
    }
    if (faqBtn) {
      const item = faqBtn.closest('.faq-item');
      const open = !item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(el => {
        el.classList.remove('open');
        const btn = el.querySelector('[data-faq-toggle]');
        if (btn) btn.setAttribute('aria-expanded','false');
      });
      if (open) {
        item.classList.add('open');
        faqBtn.setAttribute('aria-expanded','true');
      }
      return;
    }

    if (e.target.closest('.mobile-panel a')) document.body.classList.remove('menu-open');

    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || url.protocol === 'mailto:' || url.protocol === 'tel:') return;
    const samePageHash = url.pathname === location.pathname && url.search === location.search && url.hash;
    if (samePageHash) return;
    e.preventDefault();
    if (loader) loader.classList.add('active');
    setTimeout(() => { location.href = url.href; }, 260);
  });

  const firstFilter = document.querySelector('[data-project-filter].active')?.dataset.projectFilter;
  if (firstFilter) document.querySelectorAll('[data-project-category]').forEach(card => { card.hidden = card.dataset.projectCategory !== firstFilter; });

  const navShell = document.querySelector('.nav-shell');
  if (navShell) window.addEventListener('scroll', () => navShell.classList.toggle('scrolled', window.scrollY > 24), {passive:true});

  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); reveal.unobserve(entry.target); }
  }), {threshold:.07, rootMargin:'0px 0px -30px 0px'});
  document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  /* Metrics count-up */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count || 0);
      const suffix = el.dataset.suffix || '';
      const duration = 1350;
      const start = performance.now();
      const tick = now => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target + suffix;
      };
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    }), {threshold:.55});
    counters.forEach(el => counterObserver.observe(el));
  }

  /* Testimonial slider */
  const slider = document.querySelector('[data-testimonial-slider]');
  if (slider) {
    const track = slider.querySelector('.testimonial-track');
    const slides = [...slider.querySelectorAll('.testimonial-slide')];
    const dots = [...slider.querySelectorAll('[data-testimonial-dot]')];
    const prev = slider.querySelector('[data-testimonial-prev]');
    const next = slider.querySelector('[data-testimonial-next]');
    let index = 0;
    let timer;
    const go = i => {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, n) => dot.classList.toggle('active', n === index));
    };
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(() => go(index + 1), 6000);
    };
    prev?.addEventListener('click', () => { go(index - 1); restart(); });
    next?.addEventListener('click', () => { go(index + 1); restart(); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { go(i); restart(); }));
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', restart);
    let touchX = 0;
    slider.addEventListener('touchstart', e => touchX = e.touches[0].clientX, {passive:true});
    slider.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].clientX - touchX;
      if (Math.abs(diff) > 45) { go(index + (diff < 0 ? 1 : -1)); restart(); }
    }, {passive:true});
    go(0);
    restart();
  }

  const contactForm = document.querySelector('#contactForm');
  if (contactForm) {
    const status = document.querySelector('#formStatus');
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = contactForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      if (status) status.textContent = 'Sending…';
      try {
        const res = await fetch('/api/lead.php', {method:'POST', body:new FormData(contactForm), headers:{'X-Requested-With':'XMLHttpRequest'}});
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not send your enquiry.');
        contactForm.reset();
        if (status) status.textContent = 'Received. We’ll reply from info@ferrnagency.com.';
      } catch (err) {
        if (status) status.textContent = err.message || 'Something went wrong. Email info@ferrnagency.com instead.';
      } finally { submit.disabled = false; }
    });
  }

  const insights = document.querySelector('#insightsGrid');
  if (insights) {
    fetch('/api/posts.php').then(r => r.json()).then(data => {
      if (!data.ok || !Array.isArray(data.posts) || data.posts.length === 0) return;
      insights.innerHTML = data.posts.slice(0,3).map(p => `<a class="article-card" href="/insights/${encodeURIComponent(p.slug)}"><div class="article-meta"><span>${escapeHtml(p.category || 'Insight')}</span><span>${escapeHtml(p.date_label || '')}</span></div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt || '')}</p><div class="article-link"><span>Read insight</span><i data-lucide="arrow-up-right"></i></div></a>`).join('');
      if (window.lucide) window.lucide.createIcons();
    }).catch(() => {});
  }

  function escapeHtml(str='') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  updateIcons();
})();
