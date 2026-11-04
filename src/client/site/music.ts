/* Control-centre music player — free Pixabay tracks streamed from R2 (/media/music/…). A playlist with
   previous / play / next, a seek bar and volume. Never starts on its own; pauses when the tab is hidden;
   remembers the track, position and volume for the session. */
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
  const audio = new Audio(); audio.preload = 'none';
  let i = 0, seeking = false, hiddenPause = false;
  try { const s = JSON.parse(sessionStorage.getItem('ferrn-music') || '{}'); i = (s.i ?? 0) % list.length; if (s.v != null) vol.value = String(s.v); } catch {}
  audio.volume = Number(vol.value) / 100;
  const save = () => { try { sessionStorage.setItem('ferrn-music', JSON.stringify({ i, v: Number(vol.value) })); } catch {} };
  const load = (n: number, play: boolean) => {
    i = (n + list.length) % list.length;
    const t = list[i];
    audio.src = t.src; title.textContent = t.title; sub.textContent = t.artist; dur.textContent = t.length; time.textContent = '0:00'; seek.value = '0';
    save();
    if (play) audio.play().catch(() => {});
  };
  load(i, false);
  const state = () => {
    const on = !audio.paused;
    box.classList.toggle('playing', on); toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Pause music' : 'Play music'); toggle.innerHTML = on ? PAUSE : PLAY;
  };
  toggle.addEventListener('click', () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
  $('[data-music-next]', box)?.addEventListener('click', () => load(i + 1, !audio.paused));
  $('[data-music-prev]', box)?.addEventListener('click', () => { if (audio.currentTime > 4) audio.currentTime = 0; else load(i - 1, !audio.paused); });
  audio.addEventListener('play', state); audio.addEventListener('pause', state);
  audio.addEventListener('ended', () => load(i + 1, true));
  audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    time.textContent = fmt(audio.currentTime);
    if (!seeking && audio.duration) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
  });
  seek.addEventListener('input', () => { seeking = true; if (audio.duration) time.textContent = fmt((Number(seek.value) / 1000) * audio.duration); });
  seek.addEventListener('change', () => { seeking = false; if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration; });
  vol.addEventListener('input', () => { audio.volume = Number(vol.value) / 100; save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) { hiddenPause = true; audio.pause(); }
    else if (!document.hidden && hiddenPause) { hiddenPause = false; audio.play().catch(() => {}); }
  });
}
