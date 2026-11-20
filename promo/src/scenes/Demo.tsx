import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, clamp, Fade, H, Key, kf, MONO, Reveal, SANS, Stage, typed, useSpring} from '../ui';
import {Desktop, KEYFRAMES} from './Desktop';

// Bars 4–10 (840 frames). ⌥⇧S → talk, click, draw → ⌥⇧S → the bundle.

type Cam = {s: number; x: number; y: number; tilt: number};
const CAM: [number, Cam][] = [
  [0, {s: 0.72, x: 960, y: 600, tilt: 18}],
  [70, {s: 0.78, x: 960, y: 560, tilt: 0}],
  [125, {s: 0.78, x: 960, y: 560, tilt: 0}],
  [205, {s: 1.8, x: 1380, y: 640, tilt: 0}],
  [336, {s: 1.8, x: 1380, y: 640, tilt: 0}],
  [380, {s: 1.5, x: 1280, y: 470, tilt: 0}],
  [480, {s: 1.5, x: 1280, y: 470, tilt: 0}],
  [520, {s: 0.6, x: 1520, y: 560, tilt: 0}],
  [596, {s: 0.6, x: 1520, y: 560, tilt: 0}],
  [640, {s: 0.78, x: 960, y: 560, tilt: 0}],
];

const camAt = (f: number): Cam => {
  const keys = CAM.map(([k]) => k);
  const pick = (fn: (c: Cam) => number) => kf(f, keys, CAM.map(([, c]) => fn(c)));
  return {s: pick((c) => c.s), x: pick((c) => c.x), y: pick((c) => c.y), tilt: pick((c) => c.tilt)};
};

const Hud: React.FC<{at: number; out: number; label: string}> = ({at, out, label}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 64, display: 'flex', justifyContent: 'center'}}>
    <Fade at={at - 14} out={out} y={30}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px 16px 30px',
          borderRadius: 26,
          background: 'rgba(16,16,18,0.78)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
        }}
      >
        <span style={{fontFamily: SANS, fontSize: 24, color: C.text, fontWeight: 500, marginRight: 10}}>{label}</span>
        <Key label="⌥" at={at} />
        <Key label="⇧" at={at + 30} />
        <Key label="S" at={at + 60} />
      </div>
    </Fade>
  </div>
);

const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const caps = COPY.demo.captions;
  let idx = -1;
  caps.forEach((c, i) => {
    if (f >= c.from) idx = i;
  });
  const o = kf(f, [160, 172], [0, 1]) * kf(f, [482, 496], [1, 0]);
  if (idx < 0 || o <= 0 || f < caps[0].from + 2) return null;
  const cap = caps[idx];
  const prev = idx > 0 && cap.text.startsWith(caps[idx - 1].text) ? caps[idx - 1].text.length : 0;
  const rest = cap.text.slice(prev);
  const shown = cap.text.slice(0, prev) + typed(rest, f, cap.from, cap.from + rest.length * 2.6);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 72, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * 16}px)`}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '16px 28px',
          borderRadius: 22,
          background: 'rgba(16,16,18,0.8)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
          fontFamily: SANS,
          color: C.text,
          fontSize: 34,
          fontWeight: 500,
        }}
      >
        <span style={{width: 10, height: 10, borderRadius: 5, background: C.red}} />
        <span style={{fontFamily: MONO, fontSize: 22, color: C.dim}}>{cap.ts}</span>
        <span>{shown}</span>
      </div>
    </div>
  );
};

const Points: React.FC = () => (
  <div style={{position: 'absolute', left: 1330, top: 330, width: 520}}>
    {COPY.demo.points.map((p, i) => (
      <Fade key={p.k} at={508 + i * 22} out={588} y={30}>
        <div style={{display: 'flex', gap: 28, alignItems: 'baseline', padding: '26px 0', borderTop: i ? `1px solid ${C.line}` : undefined}}>
          <span style={{...H, fontSize: 60, color: i === 2 ? C.red : C.text}}>{p.k}</span>
          <span style={{fontFamily: SANS, fontSize: 26, color: C.dim}}>{p.v}</span>
        </div>
      </Fade>
    ))}
  </div>
);

// Each keyframe thumbnail shows a 16:9 region around the button and the toast corner.
const CROP = {x: 640, y: 110, w: 1280};
const TW = 520;

const Compile: React.FC = () => {
  // local frame 0 = demo frame 720 (bar 10)
  const f = useCurrentFrame();
  const d = COPY.demo;
  const springs = KEYFRAMES.map((_, i) => useSpring(6 + i * 7, {damping: 24, stiffness: 110}));
  return (
    <Stage tone="paper" light={[30, 20]}>
      <Chapter n={4} label={COPY.chapters[3]} tone="paper" at={2} />
      <div style={{position: 'absolute', left: 160, top: 150, ...H, fontSize: 64}}>
        <Reveal at={2}>
          <span style={{color: C.paperInk}}>{d.compileA}</span>
          <span style={{color: C.paperDim}}>{d.compileB}</span>
        </Reveal>
      </div>

      {/* contact sheet */}
      <div style={{position: 'absolute', left: 160, top: 290}}>
        <Fade at={6} y={10}>
          <div style={{fontFamily: MONO, fontSize: 18, color: C.paperDim, marginBottom: 14}}>contact-sheet.png</div>
        </Fade>
        <div style={{display: 'flex', gap: 20}}>
          {KEYFRAMES.map((k, i) => {
            const s = springs[i];
            return (
              <div
                key={k.n}
                style={{
                  position: 'relative',
                  width: TW,
                  height: (TW * 9) / 16,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 20px 40px rgba(40,30,10,0.14)',
                  transform: `translateY(${(1 - s) * 60}px)`,
                  opacity: interpolate(s, [0, 0.4], [0, 1], clamp),
                  filter: s < 0.95 ? `blur(${(1 - s) * 10}px)` : undefined,
                }}
              >
                <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${TW / CROP.w}) translate(${-CROP.x}px, ${-CROP.y}px)`, transformOrigin: '0 0'}}>
                  <Desktop t={k.t + 2} showChips={false} />
                </div>
                <div style={{position: 'absolute', left: 10, top: 10, width: 30, height: 30, borderRadius: 7, background: '#fff', color: '#111', fontFamily: SANS, fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'}}>
                  {k.n}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* summary.md excerpt */}
      <div style={{position: 'absolute', left: 160, top: 640, width: 900}}>
        <Fade at={28} y={10}>
          <div style={{fontFamily: MONO, fontSize: 18, color: C.paperDim, marginBottom: 14}}>summary.md</div>
        </Fade>
        <div style={{fontFamily: MONO, fontSize: 22, lineHeight: 1.75}}>
          {d.summary.map((line, i) => (
            <Fade key={i} at={32 + i * 6} y={10} dur={24}>
              <div style={{color: line.startsWith('##') ? C.paperInk : '#6E6C66'}}>{line}</div>
            </Fade>
          ))}
        </div>
      </div>

      {/* file tree */}
      <div style={{position: 'absolute', left: 1240, top: 640}}>
        <Fade at={22} y={10}>
          <div style={{fontFamily: MONO, fontSize: 18, color: C.paperDim, marginBottom: 14}}>.pointo</div>
        </Fade>
        <div style={{fontFamily: MONO, fontSize: 22, lineHeight: 1.75, whiteSpace: 'pre'}}>
          {d.tree.map((line, i) => (
            <Fade key={i} at={26 + i * 5} y={0} dur={20} style={{transform: `translateX(${(1 - kf(f, [26 + i * 5, 46 + i * 5], [0, 1])) * 16}px)`}}>
              <span style={{color: i === 0 ? C.paperInk : '#6E6C66'}}>{line}</span>
            </Fade>
          ))}
        </div>
      </div>
    </Stage>
  );
};

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const leave = kf(f, [700, 724], [0, 1]);
  const appear = kf(f, [0, 40], [0, 1]);
  const shutter = KEYFRAMES.reduce((m, k) => Math.max(m, f >= k.t && f < k.t + 10 ? 1 - (f - k.t) / 10 : 0), 0);
  const s = cam.s * (1 - leave * 0.15);
  const framed = s < 1.2;
  const radius = interpolate(s, [0.9, 1.2], [26, 0], clamp) / s;

  return (
    <Stage light={[50, 20]}>
      {f < 726 ? (
        <AbsoluteFill style={{opacity: appear * (1 - leave), filter: leave > 0 ? `blur(${leave * 16}px)` : undefined, }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 1920,
              height: 1080,
              transformOrigin: '0 0',
              transform: `translate(${960 - cam.x * s}px, ${540 - cam.y * s}px) scale(${s})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transformOrigin: '50% 100%',
                transform: `perspective(2400px) rotateX(${cam.tilt}deg)`,
                borderRadius: radius,
                overflow: 'hidden',
                boxShadow: framed ? `0 0 0 ${1 / s}px rgba(255,255,255,0.14), 0 ${60 / s}px ${140 / s}px rgba(0,0,0,0.7)` : undefined,
              }}
            >
              <Desktop t={f} />
              {shutter > 0 ? <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: shutter * 0.18}} /> : null}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {f < 720 ? <Chapter n={3} label={COPY.chapters[2]} out={700} /> : null}
      <Hud at={0} out={108} label={COPY.demo.hudStart} />
      <Caption />
      <Points />
      <Hud at={600} out={694} label={COPY.demo.hudStop} />

      <Sequence from={720} layout="none">
        <Compile />
      </Sequence>
    </Stage>
  );
};
