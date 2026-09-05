(() => {
  const status = document.querySelector('#formStatus');
  if (!status) return;

  let fired = false;
  const colors = ['#ff4100','#ff6a35','#ffffff','#111111','#ffb199'];

  const confetti = () => {
    if (fired || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    fired = true;
    const layer = document.createElement('div');
    layer.className = 'ferrn-confetti-layer';
    document.body.appendChild(layer);

    for (let i = 0; i < 72; i++) {
      const piece = document.createElement('i');
      piece.className = 'ferrn-confetti-piece';
      const angle = (Math.PI * 2 * i) / 72 + (Math.random() - .5) * .22;
      const distance = 180 + Math.random() * 520;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance + 130 + Math.random() * 180;
      piece.style.setProperty('--x', `${x}px`);
      piece.style.setProperty('--y', `${y}px`);
      piece.style.setProperty('--rot', `${Math.round((Math.random() * 880) - 440)}deg`);
      piece.style.setProperty('--delay', `${Math.random() * 140}ms`);
      piece.style.setProperty('--duration', `${980 + Math.random() * 650}ms`);
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      if (Math.random() > .55) piece.style.borderRadius = '50%';
      layer.appendChild(piece);
    }
    setTimeout(() => layer.remove(), 1900);
  };

  const observer = new MutationObserver(() => {
    const text = status.textContent.trim().toLowerCase();
    if (text.startsWith('received.')) confetti();
    if (!text || text.startsWith('sending') || text.includes('wrong') || text.includes('could not')) fired = false;
  });
  observer.observe(status, {childList:true,subtree:true,characterData:true});
})();
