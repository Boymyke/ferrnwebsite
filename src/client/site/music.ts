/* Control-centre music player, free Pixabay tracks streamed from R2 (/media/music/…). Previous / play / next,
   a seek bar and volume. The chosen track loops until the visitor changes it. While it plays, links swap pages
   in place (softNav in main.ts) so the music carries on; if a page does fully reload, it picks up where it
   was. Never starts on its own the first time; pauses when the tab is hidden. */
type Track = { title: string; artist: string; src: string; length: string; page: string };
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const fmt = (t: number) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');
const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';

export function music() {
  const box = $('[data-music]'); if (!box) return;
  let list: Track[] = [];
  try { list = JSON.parse(box.dataset.music || '[]'); } catch {}
  if (!list.length) { box.hidden = true; return; }
  const toggle = $('[data-music-toggle]', box)!, title = $('[data-music-title]', box)!, sub = $('[data-music-sub]', box)!;
  const seek = $<HTMLInputElement>('[data-music-seek]', box)!, vol = $<HTMLInputElement>('[data-music-vol]', box)!;
  const time = $('[data-music-time]', box)!, dur = $('[data-music-dur]', box)!;
  const audio = new Audio(); audio.preload = 'none'; audio.loop = true;
  let i = 0, seeking = false, hiddenPause = false, resumeAt = 0, wasOn = false;
  try {
    const s = JSON.parse(sessionStorage.getItem('ferrn-music') || '{}');
    i = (s.i ?? 0) % list.length; if (s.v != null) vol.value = String(s.v);
    resumeAt = Number(s.t) || 0; wasOn = !!s.on;
  } catch {}
  audio.volume = Number(vol.value) / 100;
  const save = () => { try { sessionStorage.setItem('ferrn-music', JSON.stringify({ i, v: Number(vol.value), t: Math.floor(audio.currentTime || 0), on: !audio.paused })); } catch {} };
  const load = (n: number, play: boolean) => {
    i = (n + list.length) % list.length;
    const t = list[i];
    audio.src = t.src; title.textContent = t.title; sub.textContent = t.artist; dur.textContent = t.length; time.textContent = '0:00'; seek.value = '0';
    save();
    if (play) audio.play().catch(() => {});
  };
  load(i, false);
  // A full page load while music was on: carry on from the same moment. Browsers may block sound until the
  // visitor touches the page, so then a small "Resume music" button appears instead.
  if (wasOn) {
    audio.preload = 'auto';
    audio.addEventListener('loadedmetadata', () => { if (resumeAt && resumeAt < audio.duration) audio.currentTime = resumeAt; }, { once: true });
    audio.play().catch(() => {
      const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'music-resume';
      chip.innerHTML = `${PLAY}<span>Resume music · ${list[i].title}</span>`;
      const go = () => { audio.play().catch(() => {}); chip.remove(); removeEventListener('pointerdown', go); };
      chip.addEventListener('click', go); addEventListener('pointerdown', go, { once: true });
      document.body.appendChild(chip); requestAnimationFrame(() => chip.classList.add('in'));
      setTimeout(() => chip.isConnected && chip.classList.remove('in'), 12000);
    });
  }
  const state = () => {
    const on = !audio.paused;
    box.classList.toggle('playing', on); toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Pause music' : 'Play music'); toggle.innerHTML = on ? PAUSE : PLAY;
  };
  toggle.addEventListener('click', () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
  $('[data-music-next]', box)?.addEventListener('click', () => load(i + 1, !audio.paused));
  $('[data-music-prev]', box)?.addEventListener('click', () => { if (audio.currentTime > 4) audio.currentTime = 0; else load(i - 1, !audio.paused); });
  audio.addEventListener('play', () => { state(); save(); }); audio.addEventListener('pause', () => { state(); if (!document.hidden) save(); });
  let lastSave = 0;
  audio.addEventListener('timeupdate', () => { if (Date.now() - lastSave > 2000) { lastSave = Date.now(); save(); } });
  addEventListener('pagehide', save);
  audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    time.textContent = fmt(audio.currentTime);
    if (!seeking && audio.duration) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
  });
  seek.addEventListener('input', () => { seeking = true; if (audio.duration) time.textContent = fmt((Number(seek.value) / 1000) * audio.duration); });
  seek.addEventListener('change', () => { seeking = false; if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration; });
  vol.addEventListener('input', () => { audio.volume = Number(vol.value) / 100; save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) { save(); hiddenPause = true; audio.pause(); }
    else if (!document.hidden && hiddenPause) { hiddenPause = false; audio.play().catch(() => {}); }
  });
}
