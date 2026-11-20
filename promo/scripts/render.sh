#!/usr/bin/env bash
# Build the soundtrack, render the film, then master the audio to -14 LUFS
# (what TikTok / Bilibili normalize to) and write a web-ready MP4 plus covers.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/music.py
npx remotion render PointoPromo out/raw.mkv --codec=h264 --crf=10 --x264-preset=slow \
  --audio-codec=pcm-16 --log=error
ffmpeg -hide_banner -loglevel error -y -i out/raw.mkv -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 320k \
  -movflags +faststart out/pointo-promo-1080p60.mp4
npx remotion still PointoPromo out/cover-title.png --frame=345 --log=error
npx remotion still PointoPromo out/cover-end.png --frame=2040 --log=error
rm -f out/raw.mkv
ls -la out/*.mp4 out/*.png
