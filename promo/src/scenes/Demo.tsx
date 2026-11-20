import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, clamp, Keycap, kf, MONO, Pop, Ripple, SANS, typed, useSpring} from '../ui';
import {CLICK, Desktop, KEYFRAMES} from './Desktop';

// Bars 4–10 (840 frames). ⌥⇧S → talk, click, draw → ⌥⇧S → the bundle.

type Cam = {s: number; x: number; y: number};
const CAM: [number, Cam][] = [
  [0, {s: 1.1, x: 960, y: 540}],
  [40, {s: 1, x: 960, y: 540}],
  [120, {s: 1, x: 960, y: 540}],
  [200, {s: 1.55, x: 980, y: 650}],
  [470, {s: 1.55, x: 1010, y: 640}],
  [515, {s: 0.7, x: 1330, y: 560}],
  [596, {s: 0.7, x: 1330, y: 560}],
  [640, {s: 0.8, x: 960, y: 560}],
];

const camAt = (f: number): Cam => {
  const keys = CAM.map(([k]) => k);
  const pick = (fn: (c: Cam) => number) => kf(f, keys, CAM.map(([, c]) => fn(c)));
  return {s: pick((c) => c.s), x: pick((c) => c.x), y: pick((c) => c.y)};
};

const Keys: React.FC<{at: number; out: number}> = ({at, out}) => {
  const f = useCurrentFrame();
  const o = kf(f, [out, out + 14], [1, 0]);
  if (f < at - 12 || o <= 0) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120, opacity: o, transform: `translateY(${(1 - o) * 30}px)`}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(6,10,24,0.85) 100%)'}} />
      <div style={{display: 'flex', gap: 34, alignItems: 'center'}}>
        <Keycap label="⌥" sub="option" at={at} size={170} />
        <Keycap label="⇧" sub="shift" at={at + 30} size={170} />
        <Keycap label="S" at={at + 60} size={170} />
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const caps = COPY.demo.captions;
  let idx = -1;
  caps.forEach((c, i) => {
    if (f >= c.from) idx = i;
  });
  const o = kf(f, [150, 162], [0, 1]) * kf(f, [478, 492], [1, 0]);
  if (idx < 0 || o <= 0 || f < caps[0].from + 2) return null;
  const cap = caps[idx];
  const prev = idx > 0 && cap.text.startsWith(caps[idx - 1].text) ? caps[idx - 1].text.length : 0;
  const rest = cap.text.slice(prev);
  const shown = cap.text.slice(0, prev) + typed(rest, f, cap.from, cap.from + rest.length * 3);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 70, opacity: o}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '20px 34px',
          borderRadius: 24,
          background: 'rgba(8,11,24,0.82)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          fontFamily: SANS,
          color: '#fff',
          fontSize: 46,
          fontWeight: 700,
        }}
      >
        <span style={{fontFamily: MONO, fontSize: 30, color: C.sky, fontWeight: 400}}>{cap.ts}</span>
        <span>“{shown}”</span>
      </div>
    </AbsoluteFill>
  );
};

const FeatureChips: React.FC = () => {
  const chips = COPY.demo.chips;
  const colors = [C.blue, '#22B8CF', C.red];
  return (
    <AbsoluteFill style={{left: 1440, right: 70, justifyContent: 'center', gap: 30, display: 'flex', flexDirection: 'column'}}>
      {chips.map((c, i) => (
        <Pop key={c.k} at={512 + i * 22} out={590} y={50}>
          <div style={{display: 'flex', alignItems: 'center', gap: 24, fontFamily: SANS}}>
            <div style={{width: 96, height: 96, borderRadius: 26, background: colors[i], color: '#fff', fontSize: 52, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 14px 40px ${colors[i]}66`, flexShrink: 0}}>
              {c.k}
            </div>
            <div style={{color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.3}}>{c.v}</div>
          </div>
        </Pop>
      ))}
    </AbsoluteFill>
  );
};

// Each keyframe thumbnail shows a 16:9 region of the screen around the login card,
// like Pointo's crop to the active region.
const CROP = {x: 330, y: 300, w: 1280};
const TW = 520;

const Compile: React.FC = () => {
  // local frame 0 = demo frame 720 (bar 10)
  const f = useCurrentFrame();
  const d = COPY.demo;
  const springs = KEYFRAMES.map((_, i) => useSpring(8 + i * 8, {damping: 14, stiffness: 150, mass: 0.8}));
  return (
    <AbsoluteFill>
      <Backdrop pulseAt={[0]} />
      <Pop at={2} y={30} style={{position: 'absolute', top: 64, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: SANS, fontWeight: 900, fontSize: 68, color: '#fff', letterSpacing: -1}}>{d.compileTitle}</div>
      </Pop>

      {/* contact sheet */}
      <div style={{position: 'absolute', left: 110, top: 190, width: 1700}}>
        <Pop at={4} y={20}>
          <div style={{fontFamily: MONO, fontSize: 24, color: C.sky, marginBottom: 14}}>contact-sheet.png</div>
        </Pop>
        <div style={{display: 'flex', gap: 24, padding: 24, borderRadius: 24, background: '#16171D', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)'}}>
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
                  transform: `translateY(${(1 - s) * 300}px) scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (i - 1) * 8}deg)`,
                  opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
                }}
              >
                <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${TW / CROP.w}) translate(${-CROP.x}px, ${-CROP.y}px)`, transformOrigin: '0 0'}}>
                  <Desktop t={k.t} showChips={false} />
                </div>
                <div style={{position: 'absolute', left: 12, top: 12, width: 40, height: 40, borderRadius: 9, background: '#fff', color: '#14182B', fontFamily: SANS, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.35)'}}>
                  {k.n}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* summary.md excerpt */}
      <div style={{position: 'absolute', left: 110, top: 630, width: 900}}>
        <Pop at={30} y={20}>
          <div style={{fontFamily: MONO, fontSize: 24, color: C.sky, marginBottom: 12}}>summary.md</div>
        </Pop>
        <div style={{fontFamily: MONO, fontSize: 27, lineHeight: 1.62}}>
          {d.summary.map((line, i) => (
            <Pop key={i} at={34 + i * 7} y={14}>
              <div style={{color: line.startsWith('##') ? '#fff' : 'rgba(255,255,255,0.62)', fontWeight: line.startsWith('##') ? 700 : 400}}>{line}</div>
            </Pop>
          ))}
        </div>
      </div>

      {/* file tree */}
      <div style={{position: 'absolute', left: 1080, top: 640, width: 730}}>
        <div style={{padding: '24px 34px', borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: MONO, fontSize: 25, lineHeight: 1.7, color: '#fff', whiteSpace: 'pre'}}>
          {d.tree.map((line, i) => {
            const at = 20 + i * 6;
            const [name, note] = line.split(/\s{2,}/);
            return (
              <Pop key={i} at={at} y={0} scale={1} style={{transform: `translateX(${(1 - Math.min(1, Math.max(0, (f - at) / 10))) * 30}px)`}}>
                <span style={{color: i === 0 ? C.sky : '#fff', fontWeight: i === 0 ? 700 : 400}}>{name}</span>
                {note ? <span style={{color: 'rgba(255,255,255,0.45)', fontFamily: SANS, fontSize: 22}}>{'   ' + note}</span> : null}
              </Pop>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const appear = useSpring(0, {damping: 18, stiffness: 120});
  const leave = kf(f, [698, 726], [0, 1]);
  const shutter = KEYFRAMES.reduce((m, k) => Math.max(m, f >= k.t && f < k.t + 10 ? 1 - (f - k.t) / 10 : 0), 0);

  return (
    <AbsoluteFill>
      <Backdrop />
      {f < 730 ? (
        <AbsoluteFill
          style={{
            opacity: interpolate(appear, [0, 0.4], [0, 1], clamp) * (1 - leave),
            filter: leave > 0 ? `blur(${leave * 20}px)` : undefined,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 1920,
              height: 1080,
              transformOrigin: '0 0',
              transform: `translate(${960 - cam.x * cam.s * (1 - leave * 0.5)}px, ${540 - cam.y * cam.s * (1 - leave * 0.5)}px) scale(${cam.s * (1 - leave * 0.5)})`,
              borderRadius: cam.s < 0.95 ? 22 / cam.s : 0,
              overflow: 'hidden',
              boxShadow: cam.s < 0.95 ? '0 50px 120px rgba(0,0,0,0.6)' : undefined,
            }}
          >
            <Desktop t={f} />
            <Ripple x={CLICK.x} y={CLICK.y} at={CLICK.at} />
            {shutter > 0 ? <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: shutter * 0.22}} /> : null}
          </div>
        </AbsoluteFill>
      ) : null}

      <Keys at={0} out={104} />
      <Caption />
      <FeatureChips />
      <Keys at={600} out={690} />

      <Sequence from={720} layout="none">
        <Compile />
      </Sequence>
    </AbsoluteFill>
  );
};
