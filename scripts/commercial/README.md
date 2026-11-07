# Ferrn commercial (home page film)

The film at `public/assets/home/reel.mp4` is rendered from these files.

1. Voiceover: `pip install kokoro-onnx soundfile`, then download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from
   github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0) into this folder and run `python3 vo.py af_heart 0.88`.
   That writes `vo.wav` and `timeline.json`. The script lives in `script.json`; "Ferrn" is spelled "Fern" there so
   it is pronounced correctly. The narrator is the open Kokoro "af_heart" voice, not a Nigerian voice.
2. Picture: put `timeline.json` next to `index.html`, add an `assets/` folder (the `shot-*.webp` files and
   `ferrn-logo-on-dark.svg`) and a `frames/<clip>/0001.jpg…` folder per clip (`ffmpeg -i clinic.mp4 -vf fps=30 frames/clinic/%04d.jpg`).
   Serve the folder (`python3 -m http.server 8799`) and run `node render.js full` to render every frame into `out/`.
3. Music and mix: `python3 ../reel/music.py <total> music.wav`, then duck the music under the voice and encode
   (see docs/WEBSITE.md, "Ferrn film").
4. Update `home.reel.chapters` with the scene start times (each line's start minus 0.35s).
