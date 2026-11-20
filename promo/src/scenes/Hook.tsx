import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Fade, H, kf, MONO, Reveal, SANS, Stage} from '../ui';

// Bars 0–1. The camera flies through a fog of vague descriptions ("左边那个", "这里"…)
// in 3D, with depth of field. They stall, the line lands, and a red pen tip appears
// in the centre — the stroke that cuts through everything on bar 2.

const P = 1200; // perspective
const FOCUS = -700;
const BUBBLES = Array.from({length: 34}).map((_, i) => {
  const phrase = COPY.hook.phrases[i % COPY.hook.phrases.length];
  const a = random(`a${i}`) * Math.PI * 2;
  const r = 260 + random(`r${i}`) * 900;
  return {
    phrase,
    x: Math.cos(a) * r * 1.5,
    y: Math.sin(a) * r * 0.75,
    z0: -random(`z${i}`) * 4800,
    rot: (random(`rot${i}`) - 0.5) * 20,
    user: random(`u${i}`) > 0.35,
  };
});

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  // travel slows to a stall when the line lands
  const travel = f < 130 ? f * 26 : 130 * 26 + (1 - Math.exp(-(f - 130) / 20)) * 20 * 26;
  const scatter = kf(f, [196, 236], [0, 1]);
  const dimForLine = kf(f, [128, 150], [1, 0.32]);
  const tip = kf(f, [214, 240], [0, 1]);

  return (
    <Stage light={[50, 50]}>
      <AbsoluteFill style={{perspective: P, perspectiveOrigin: '50% 50%'}}>
        <div style={{position: 'absolute', left: 960, top: 540, transformStyle: 'preserve-3d'}}>
          {BUBBLES.map((b, i) => {
            let z = ((b.z0 + travel + 4800) % 5200) - 4800;
            z += scatter * 1600;
            const near = kf(z, [200, 520], [1, 0]);
            const far = kf(z, [-4800, -3600], [0, 1]);
            const blur = Math.min(14, Math.abs(z - FOCUS) / 160) + scatter * 10;
            const o = near * far * dimForLine * (1 - scatter);
            if (o <= 0.01) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  transform: `translate3d(${b.x * (1 + scatter * 0.6)}px, ${b.y * (1 + scatter * 0.6)}px, ${z}px) translate(-50%, -50%) rotate(${b.rot * 0.15}deg)`,
                  opacity: o,
                  filter: `blur(${blur}px)`,
                  whiteSpace: 'nowrap',
                  padding: '18px 30px',
                  borderRadius: 28,
                  fontFamily: SANS,
                  fontSize: 40,
                  fontWeight: 500,
                  color: b.user ? '#fff' : '#D8D9DE',
                  background: b.user ? 'linear-gradient(180deg,#2E6BFF,#1F55E6)' : 'rgba(255,255,255,0.09)',
                  border: b.user ? 'none' : '1px solid rgba(255,255,255,0.14)',
                  boxShadow: b.user ? '0 20px 60px rgba(41,102,255,0.35)' : undefined,
                }}
              >
                {b.phrase}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <div style={{position: 'absolute', top: 90, width: '100%', textAlign: 'center'}}>
        <Fade at={4} out={120} y={8}>
          <span style={{fontFamily: MONO, fontSize: 22, color: C.dim, letterSpacing: 4}}>{COPY.hook.lead}</span>
        </Fade>
      </div>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{...H, fontSize: 76, color: C.text, textShadow: '0 10px 60px rgba(0,0,0,0.9)'}}>
          <Reveal at={132} out={196}>{COPY.hook.line}</Reveal>
        </div>
      </AbsoluteFill>

      {/* pen tip: a red point that swells before the slash */}
      {tip > 0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              width: 18 + tip * 26,
              height: 18 + tip * 26,
              borderRadius: '50%',
              background: C.red,
              boxShadow: `0 0 ${40 + tip * 80}px ${10 + tip * 30}px rgba(242,59,52,${0.35 + tip * 0.3})`,
              opacity: kf(f, [214, 222], [0, 1]),
            }}
          />
        </AbsoluteFill>
      ) : null}
    </Stage>
  );
};
