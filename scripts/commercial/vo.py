import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.95
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
lines = json.load(open('script.json'))
sr0 = None; parts = []; timeline = []; t = 0.6
lead = None
for ln in lines:
    a, sr = k.create(ln['vo'], voice=VOICE, speed=SPEED, lang='en-us')
    sr0 = sr
    # trim leading/trailing near-silence so the timing is tight
    thr = 0.01; idx = np.where(np.abs(a) > thr)[0]
    a = a[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)] if len(idx) else a
    d = len(a) / sr
    timeline.append({'id': ln['id'], 'vo': ln['vo'], 'start': round(t, 3), 'dur': round(d, 3), 'end': round(t + d, 3), 'next': round(t + d + ln['pause'], 3)})
    parts.append((t, a)); t += d + ln['pause']
total = t + 0.4
out = np.zeros(int(total * sr0), dtype=np.float32)
for st, a in parts:
    i = int(st * sr0); out[i:i + len(a)] += a
sf.write('vo.wav', out, sr0)
json.dump({'voice': VOICE, 'total': round(total, 3), 'lines': timeline}, open('timeline.json', 'w'), indent=1)
print(VOICE, round(total, 2), [(l['id'], l['start'], l['dur']) for l in timeline])
