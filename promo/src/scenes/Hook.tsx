import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Cursor, DISPLAY, ease, FG, GROUND, H, Ink, kf, SANS, Tone, UI} from '../ui';

// Bars 0–1. A burst of vague words, one per beat, then one per eighth (accelerating), the
// ground flipping with the cuts; at 3.0 s they pile up all at once; at 3.5 s the AI answers on
// a lilac flood; the last half beat is the held breath before the hit on bar 2.

type Shot = {at: number; len: number; text: string; tone: Tone; size: number; x: number; y: number; align: 'left' | 'right' | 'center'};

const SHOTS: Shot[] = [
  {at: 0, len: 30, text: COPY.hook.beats[0], tone: 'paper', size: 320, x: 120, y: 330, align: 'left'},
  {at: 30, len: 30, text: COPY.hook.beats[1], tone: 'paper', size: 230, x: 1800, y: 600, align: 'right'},
  {at: 60, len: 30, text: COPY.hook.beats[2], tone: 'paper', size: 360, x: 960, y: 330, align: 'center'},
  {at: 90, len: 30, text: COPY.hook.beats[3], tone: 'paper', size: 320, x: 120, y: 470, align: 'left'},
  {at: 120, len: 15, text: COPY.hook.eighths[0], tone: 'ink', size: 440, x: 960, y: 280, align: 'center'},
  {at: 135, len: 15, text: COPY.hook.eighths[1], tone: 'ink', size: 440, x: 960, y: 280, align: 'center'},
  {at: 150, len: 15, text: COPY.hook.eighths[2], tone: 'ink', size: 440, x: 960, y: 280, align: 'center'},
  {at: 165, len: 15, text: COPY.hook.eighths[3], tone: 'ink', size: 440, x: 960, y: 280, align: 'center'},
];

// where each word lands in the "all at once" pile (3.0–3.5 s)
const PILE = [
  {x: 120, y: 130, r: -6, s: 0.5},
  {x: 1060, y: 90, r: 4, s: 0.42},
  {x: 680, y: 760, r: -3, s: 0.55},
  {x: 1290, y: 640, r: 7, s: 0.45},
  {x: 160, y: 560, r: 5, s: 0.38},
  {x: 1500, y: 330, r: -8, s: 0.4},
  {x: 520, y: 330, r: 2, s: 0.36},
  {x: 1420, y: 880, r: -5, s: 0.36},
];

// The pointer darts somewhere different on every cut: pointing, but never at the right thing.
const POINTS: [number, number][] = [
  [1500, 260], [380, 860], [1600, 820], [1180, 200], [300, 300], [1640, 520], [820, 900], [1520, 160],
];

const Pointer: React.FC = () => {
  const f = useCurrentFrame();
  const idx = SHOTS.findIndex((s) => f >= s.at && f < s.at + s.len);
  if (idx < 0) return null;
  const s = SHOTS[idx];
  const [x1, y1] = POINTS[idx];
  const [x0, y0] = idx === 0 ? [1900, 1060] : POINTS[idx - 1];
  const k = interpolate(f - s.at, [0, Math.min(10, s.len - 4)], [0, 1], {...clamp, easing: ease});
  const ink = s.tone === 'ink';
  return (
    <div style={{position: 'absolute', inset: 0, filter: ink ? 'invert(1)' : undefined}}>
      <Cursor x={x0 + (x1 - x0) * k} y={y0 + (y1 - y0) * k} scale={3.2} press={k > 0.95 ? 0.6 : 0} />
    </div>
  );
};

const Word: React.FC<{s: Shot}> = ({s}) => {
  const f = useCurrentFrame();
  const t = f - s.at;
  const k = interpolate(t, [0, 6], [0, 1], {...clamp, easing: ease});
  const drift = 1 + t * 0.0018; // never still
  return (
    <AbsoluteFill style={{background: GROUND[s.tone]}}>
      <div
        style={{
          position: 'absolute',
          left: s.align === 'left' ? s.x : undefined,
          right: s.align === 'right' ? 1920 - s.x : undefined,
          top: s.y,
          width: s.align === 'center' ? '100%' : undefined,
          textAlign: s.align,
          ...H,
          fontSize: s.size,
          color: FG[s.tone],
          whiteSpace: 'nowrap',
          transform: `scale(${(1.12 - 0.12 * k) * drift})`,
          transformOrigin: s.align === 'left' ? '0% 50%' : s.align === 'right' ? '100% 50%' : '50% 50%',
        }}
      >
        {s.text}
      </div>
    </AbsoluteFill>
  );
};

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const shot = [...SHOTS].reverse().find((s) => f >= s.at && f < s.at + s.len);
  const pile = kf(f, [180, 196], [0, 1], ease);
  const ai = f >= 210;
  const aiK = kf(f, [210, 220], [0, 1], ease);

  return (
    <AbsoluteFill style={{background: C.paper}}>
      {shot ? <Word s={shot} /> : null}
      {shot ? <Pointer /> : null}
      {/* frame 0 already moves: the pen circles the first vague word */}
      {f < 30 ? (
        <Ink d="M 1460 470 C 1500 330, 980 280, 600 300 C 240 320, 60 420, 90 560 C 130 720, 700 740, 1100 720 C 1420 700, 1520 610, 1430 500" from={0} to={20} width={12} />
      ) : null}
      {/* the red pen in the first second and a half: circling the wrong thing */}
      {f >= 30 && f < 60 ? (
        <Ink d="M 1860 690 C 1890 600, 1500 572, 1200 584 C 900 596, 780 690, 820 790 C 860 900, 1400 916, 1680 878 C 1880 850, 1910 760, 1840 684" from={34} to={52} width={10} />
      ) : null}

      {f >= 180 && !ai ? (
        <AbsoluteFill style={{background: C.paper}}>
          {SHOTS.map((s, i) => {
            const p = PILE[i];
            const k = kf(f, [180 + i * 1.5, 194 + i * 1.5], [0, 1], ease);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: interpolate(k, [0, 1], [960, p.x]),
                  top: interpolate(k, [0, 1], [440, p.y]),
                  ...H,
                  fontSize: 220 * p.s,
                  color: i % 3 === 0 ? C.red : C.ink,
                  whiteSpace: 'nowrap',
                  transform: `rotate(${p.r * k}deg) scale(${0.6 + 0.4 * k + (f - 180) * 0.002})`,
                  opacity: Math.min(1, k * 2) * pile,
                }}
              >
                {s.text}
              </div>
            );
          })}
        </AbsoluteFill>
      ) : null}

      {ai ? (
        <AbsoluteFill style={{background: C.lilac, alignItems: 'center', justifyContent: 'center'}}>
          <div style={{fontFamily: DISPLAY, fontSize: 560, lineHeight: 0.9, color: C.ink, transform: `scale(${1.3 - 0.3 * aiK + (f - 210) * 0.003}) rotate(${Math.sin(f / 3) * 2}deg)`, marginTop: -200}}>?</div>
          <div style={{position: 'absolute', bottom: 120, display: 'flex', alignItems: 'center', gap: 26, padding: '26px 44px', borderRadius: '44px 44px 44px 10px', background: C.card, boxShadow: '0 24px 60px rgba(60,40,140,0.25)', opacity: aiK, transform: `translateY(${(1 - aiK) * 40}px)`}}>
            <span style={{fontFamily: UI, fontWeight: 800, fontSize: 40, letterSpacing: 2, color: C.lilacDeep}}>AI</span>
            <span style={{fontFamily: SANS, fontWeight: 900, fontSize: 80, color: C.ink}}>{COPY.hook.ai}</span>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
