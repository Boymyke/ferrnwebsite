/* Ambient music for the control centre — generated live with WebAudio, so there is nothing to download, nothing
   to license and nothing that costs money. Three moods; slow chords, a breathing filter and a soft echo.
   Never starts on its own: the visitor presses play. */
type Mood = { name: string; sub: string; root: number; chords: number[][]; bpm: number; bright: number; wave: OscillatorType };
const MOODS: Mood[] = [
  { name: 'Signal', sub: 'Calm · warm pads', root: 55, chords: [[0, 7, 12, 16], [5, 12, 16, 19], [3, 10, 15, 19], [7, 14, 17, 21]], bpm: 7, bright: 900, wave: 'triangle' },
  { name: 'Workshop', sub: 'Focus · steady pulse', root: 65.4, chords: [[0, 7, 14, 19], [0, 5, 12, 19], [-2, 5, 12, 17], [-4, 3, 10, 15]], bpm: 10, bright: 1400, wave: 'sawtooth' },
  { name: 'Night shift', sub: 'Deep · slow and low', root: 41.2, chords: [[0, 12, 19, 26], [0, 10, 17, 24], [-2, 12, 19, 22], [-5, 7, 14, 19]], bpm: 5, bright: 600, wave: 'sine' },
];
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);

export function music() {
  const box = $('[data-music]'); if (!box) return;
  const toggle = $('[data-music-toggle]', box)!, next = $('[data-music-next]', box)!, vol = $<HTMLInputElement>('[data-music-vol]', box)!;
  const title = $('[data-music-title]', box)!, sub = $('[data-music-sub]', box)!;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) { box.hidden = true; return; }
  let ctx: AudioContext | null = null, master: GainNode, filter: BiquadFilterNode, voices: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode }[] = [];
  let mood = 0, step = 0, timer = 0, playing = false;
  try { mood = Number(localStorage.getItem('ferrn-music-mood') || 0) % MOODS.length; } catch {}
  const label = () => { title.textContent = `Ferrn ambient · ${MOODS[mood].name}`; sub.textContent = playing ? MOODS[mood].sub : 'Generated live — nothing to download'; };
  label();

  const build = () => {
    ctx = new AC();
    master = ctx!.createGain(); master.gain.value = 0;
    filter = ctx!.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .7;
    const delay = ctx!.createDelay(2); delay.delayTime.value = .42;
    const fb = ctx!.createGain(); fb.gain.value = .38;
    const wet = ctx!.createGain(); wet.gain.value = .35;
    const lfo = ctx!.createOscillator(), lfoG = ctx!.createGain(); lfo.frequency.value = .07; lfoG.gain.value = 320;
    lfo.connect(lfoG); lfoG.connect(filter.frequency); lfo.start();
    filter.connect(master); filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    master.connect(ctx!.destination);
    for (let i = 0; i < 4; i++) {
      const g = ctx!.createGain(); g.gain.value = 0;
      const o1 = ctx!.createOscillator(), o2 = ctx!.createOscillator();
      o1.detune.value = -6; o2.detune.value = 7;
      o1.connect(g); o2.connect(g); g.connect(filter); o1.start(); o2.start();
      voices.push({ o1, o2, g });
    }
  };
  const chord = () => {
    if (!ctx) return;
    const m = MOODS[mood], notes = m.chords[step % m.chords.length], t = ctx.currentTime, beat = 60 / m.bpm;
    filter.frequency.setTargetAtTime(m.bright, t, 2);
    voices.forEach((v, i) => {
      const f = m.root * Math.pow(2, notes[i] / 12);
      v.o1.type = m.wave; v.o2.type = i % 2 ? 'sine' : m.wave;
      v.o1.frequency.setTargetAtTime(f, t, .8); v.o2.frequency.setTargetAtTime(f * 2, t, .8);
      v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, .6);
      v.g.gain.setTargetAtTime(i === 3 ? .05 : .09, t + 1.2 + i * .35, 1.4);
    });
    step++;
    timer = window.setTimeout(chord, beat * 1000);
  };
  const volume = () => master && master.gain.setTargetAtTime(playing ? Number(vol.value) / 100 * .6 : 0, ctx!.currentTime, .3);
  const setPlaying = (on: boolean) => {
    playing = on; box.classList.toggle('playing', on); toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Pause ambient music' : 'Play ambient music');
    toggle.innerHTML = on
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    label();
  };
  toggle.addEventListener('click', async () => {
    if (!ctx) build();
    if (ctx!.state === 'suspended') await ctx!.resume();
    if (!playing) { setPlaying(true); if (!timer) chord(); volume(); }
    else { setPlaying(false); volume(); clearTimeout(timer); timer = 0; }
  });
  next.addEventListener('click', () => {
    mood = (mood + 1) % MOODS.length; step = 0; label();
    try { localStorage.setItem('ferrn-music-mood', String(mood)); } catch {}
    if (playing) { clearTimeout(timer); chord(); }
  });
  vol.addEventListener('input', volume);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) toggle.click(); });
}
