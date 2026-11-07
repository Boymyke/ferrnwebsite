"""Generates a soft, original background track for the showreel (no samples, no copyrighted material)."""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 45.0
OUT = sys.argv[2] if len(sys.argv) > 2 else 'music.wav'
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
N = int(SR * DUR)
t_all = np.arange(N) / SR
rng = np.random.default_rng(7)

def hz(m):  # midi to hz
    return 440 * 2 ** ((m - 69) / 12)

# Fmaj9, Em7, Dm9, Cmaj7 (two bars each feels calmer, so one chord per bar but slow pad)
CHORDS = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 67], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]]
ROOTS = [41, 40, 38, 36]

out = np.zeros(N)
pad = np.zeros(N)
bass = np.zeros(N)
arp = np.zeros(N)
drums = np.zeros(N)

def env_adsr(n, a, r, sustain=1.0):
    e = np.ones(n) * sustain
    na, nr = int(a * SR), int(r * SR)
    na = min(na, n); nr = min(nr, n - na)
    e[:na] = np.linspace(0, sustain, na)
    if nr > 0:
        e[n - nr:] = np.linspace(sustain, 0, nr)
    return e

def soft_saw(f, t, harmonics=10):
    s = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        s += np.sin(2 * np.pi * f * k * t) / k * (0.85 ** k)
    return s

bar_i = 0
start = 0.0
while start < DUR:
    ch = CHORDS[bar_i % 4]
    root = ROOTS[bar_i % 4]
    s0 = int(start * SR)
    n = min(int((BAR + 0.6) * SR), N - s0)
    if n <= 0:
        break
    t = np.arange(n) / SR
    # pad: detuned soft saws
    p = np.zeros(n)
    for m in ch:
        for det in (-0.12, 0.0, 0.11):
            p += soft_saw(hz(m) * (1 + det / 100), t + rng.random(), 7)
    p *= env_adsr(n, 0.7, 0.9) * 0.05
    pad[s0:s0 + n] += p
    # bass: root on beats 1 and 3
    for b in (0, 2):
        bs = s0 + int(b * BEAT * SR)
        bn = min(int(BEAT * 1.8 * SR), N - bs)
        if bn <= 0:
            continue
        tb = np.arange(bn) / SR
        bass[bs:bs + bn] += (np.sin(2 * np.pi * hz(root) * tb) + 0.25 * np.sin(4 * np.pi * hz(root) * tb)) * np.exp(-tb * 2.2) * env_adsr(bn, 0.01, 0.2) * 0.28
    # arp: eighth notes from chord tones, an octave up, from bar 3
    if bar_i >= 2:
        pattern = [0, 2, 4, 3, 1, 3, 4, 2]
        for e, idx in enumerate(pattern):
            es = s0 + int(e * BEAT / 2 * SR)
            en = min(int(0.5 * SR), N - es)
            if en <= 0:
                continue
            te = np.arange(en) / SR
            f = hz(ch[idx] + 12)
            tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * te))
            arp[es:es + en] += tri * np.exp(-te * 7) * 0.06 * (0.8 if e % 2 else 1.0)
    # drums from bar 2: soft kick each beat, hat on off-beats
    if bar_i >= 1:
        for b in range(4):
            ks = s0 + int(b * BEAT * SR)
            kn = min(int(0.3 * SR), N - ks)
            if kn > 0:
                tk = np.arange(kn) / SR
                f = 45 + 75 * np.exp(-tk * 30)
                ph = 2 * np.pi * np.cumsum(f) / SR
                drums[ks:ks + kn] += np.sin(ph) * np.exp(-tk * 11) * 0.33
            hs = s0 + int((b + 0.5) * BEAT * SR)
            hn = min(int(0.05 * SR), N - hs)
            if hn > 0:
                th = np.arange(hn) / SR
                drums[hs:hs + hn] += rng.standard_normal(hn) * np.exp(-th * 90) * 0.035
    bar_i += 1
    start += BAR

hp = butter(2, 6000, 'hp', fs=SR, output='sos')
drums_hat = drums.copy()
lp = butter(2, 2400, 'lp', fs=SR, output='sos')
pad = sosfilt(lp, pad)

# feedback delay on the arp (dotted eighth)
d = int(BEAT * 0.75 * SR)
arp_d = arp.copy()
for k in range(1, 5):
    arp_d[d * k:] += arp[:-d * k] * (0.38 ** k)

mix = pad + bass + arp_d + drums
# simple reverb: convolve with decaying noise
ir_n = int(1.6 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2)
ir = sosfilt(butter(1, 3000, 'lp', fs=SR, output='sos'), ir)
ir /= np.sqrt(np.sum(ir ** 2))
wet = fftconvolve(pad + arp_d, ir)[:N] * 0.35
mix = mix + wet

# fades
fi, fo = int(1.2 * SR), int(2.5 * SR)
mix[:fi] *= np.linspace(0, 1, fi)
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.5
mix = np.tanh(mix * 1.1)
mix /= np.max(np.abs(mix)) / 0.85
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR)) * 0.96 + mix * 0.04], axis=1)
wavfile.write(OUT, SR, (stereo * 32767).astype(np.int16))
print('wrote', OUT, DUR)
