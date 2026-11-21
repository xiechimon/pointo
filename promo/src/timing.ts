// The whole film sits on the soundtrack's grid: 120 BPM at 60 fps,
// so one beat is 30 frames and one bar is 120 frames (scripts/music.py).
export const FPS = 60;
export const BEAT = 30;
export const BAR = 120;
export const BARS = 18;
export const DURATION = BAR * BARS;
export const W = 1920;
export const H = 1080;

/** Frame of a bar (+ beats) on the global timeline. */
export const at = (bar: number, beat = 0) => Math.round((bar * 4 + beat) * BEAT);

// Scene layout in bars: [start, length]
export const SCENES = {
  hook: [0, 2],
  title: [2, 2],
  demo: [4, 7],
  deliver: [11, 2],
  local: [13, 2],
  end: [15, 3],
} as const;
