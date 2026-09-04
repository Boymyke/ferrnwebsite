(() => {
  const root = document.documentElement;
  const storedTheme = localStorage.getItem('ferrn-theme');
  if (storedTheme) root.dataset.theme = storedTheme;
  else root.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.mono = localStorage.getItem('ferrn-mono') || 'false';

  const updateIcons = () => {
    const themeIcon = document.querySelector('[data-theme-icon]');
    if (themeIcon) themeIcon.setAttribute('data-lucide', root.dataset.theme === 'dark' ? 'sun' : 'moon');
    document.querySelectorAll('[data-mono-label]').forEach(el => el.textContent = root.dataset.mono === 'true' ? 'COLOR' : 'B/W');
    if (window.lucide) window.lucide.createIcons();
  };

  document.addEventListener('click', e => {
    const themeBtn = e.target.closest('[data-theme-toggle]');
    const monoBtn = e.target.closest('[data-mono-toggle]');
    const menuBtn = e.target.closest('[data-menu-toggle]');
    if (themeBtn) {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ferrn-theme', root.dataset.theme);
      updateIcons();
    }
    if (monoBtn) {
      root.dataset.mono = root.dataset.mono === 'true' ? 'false' : 'true';
      localStorage.setItem('ferrn-mono', root.dataset.mono);
      updateIcons();
    }
    if (menuBtn) {
      const open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    }
    if (e.target.closest('.mobile-panel a')) document.body.classList.remove('menu-open');
  });

  const navShell = document.querySelector('.nav-shell');
  if (navShell) window.addEventListener('scroll', () => navShell.classList.toggle('scrolled', window.scrollY > 24), {passive:true});

  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      reveal.unobserve(entry.target);
    }
  }), {threshold:.07, rootMargin:'0px 0px -30px 0px'});
  document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

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
        if (status) status.textContent = 'Received. We’ll reply from michael@ferrnagency.com.';
      } catch (err) {
        if (status) status.textContent = err.message || 'Something went wrong. Email michael@ferrnagency.com instead.';
      } finally { submit.disabled = false; }
    });
  }

  const insights = document.querySelector('#insightsGrid');
  if (insights) {
    fetch('/api/posts.php')
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !Array.isArray(data.posts) || data.posts.length === 0) return;
        insights.innerHTML = data.posts.slice(0,3).map(p => `
          <a class="article-card" href="/insights/${encodeURIComponent(p.slug)}">
            <div class="article-meta"><span>${escapeHtml(p.category || 'Insight')}</span><span>${escapeHtml(p.date_label || '')}</span></div>
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.excerpt || '')}</p>
            <div class="article-link"><span>Read insight</span><i data-lucide="arrow-up-right"></i></div>
          </a>`).join('');
        if (window.lucide) window.lucide.createIcons();
      }).catch(() => {});
  }

  function escapeHtml(str='') {
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  updateIcons();
})();
