"""Builds the home-page showreel from the product screenshots and screen recordings in the repo."""
import json
import subprocess

HOME = 'public/assets/home'
OUT_DIR = 'public/assets/home'
W, H, FPS, XF = 1280, 800, 30, 0.5

# (kind, file, seconds, label)
SEG = [
    ('still', 'shot-cedar-clinic.webp', 3.0, 'Clinic website'),
    ('clip', 'clinic.mp4', 8.0, 'Clinic booking app'),
    ('still', 'shot-northbridge-freight.webp', 3.0, 'Freight website'),
    ('clip', 'track.mp4', 8.0, 'Freight quotes and tracking'),
    ('still', 'shot-harbourline-homes.webp', 3.0, 'Property website'),
    ('still', 'shot-assistant.webp', 3.2, 'AI website assistant'),
    ('still', 'shot-brightpath-academy.webp', 3.0, 'School website'),
    ('still', 'shot-admissions.webp', 3.0, 'School admissions portal'),
    ('clip', 'automation.mp4', 7.5, 'WhatsApp reminders'),
    ('clip', 'studio.mp4', 9.0, 'Ferrn Studio dashboard'),
]

args = ['ffmpeg', '-v', 'error', '-y']
filters = []
for i, (kind, f, d, _) in enumerate(SEG):
    if kind == 'still':
        args += ['-loop', '1', '-framerate', str(FPS), '-t', f'{d}', '-i', f'{HOME}/{f}']
        # slow push in and a gentle drift down the page, like someone scrolling
        filters.append(
            f'[{i}:v]scale=1408:880,crop={W}:{H}:x=\'64*t/{d}\':y=\'80*t/{d}\',fps={FPS},setsar=1,format=yuv420p,settb=AVTB[v{i}]')
    else:
        args += ['-t', f'{d}', '-i', f'{HOME}/{f}']
        filters.append(f'[{i}:v]fps={FPS},scale={W}:{H},setsar=1,format=yuv420p,trim=duration={d},setpts=PTS-STARTPTS,settb=AVTB[v{i}]')

chapters, acc, prev = [], 0.0, 'v0'
chapters.append({'t': 0.0, 'label': SEG[0][3]})
acc = SEG[0][2]
for i in range(1, len(SEG)):
    off = acc - XF
    filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{i}]')
    chapters.append({'t': round(off + XF / 2, 2), 'label': SEG[i][3]})
    prev = f'x{i}'
    acc = off + SEG[i][2]
total = round(acc, 2)

subprocess.run(['python3', 'scripts/reel/music.py', str(total), '/tmp/reel-music.wav'], check=True)
args += ['-i', '/tmp/reel-music.wav']
filters.append(f'[{prev}]format=yuv420p[vout]')
args += ['-filter_complex', ';'.join(filters), '-map', '[vout]', '-map', f'{len(SEG)}:a',
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
         '-af', 'loudnorm=I=-19:TP=-2:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', f'{OUT_DIR}/reel.mp4']
subprocess.run(args, check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.5', '-i', f'{OUT_DIR}/reel.mp4', '-frames:v', '1', '-q:v', '80', f'{OUT_DIR}/reel-poster.webp'], check=True)
print(json.dumps({'total': total, 'chapters': chapters}))
