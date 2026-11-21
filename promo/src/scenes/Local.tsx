import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, DISPLAY, ease, FG, GROUND, H, kf, MONO, Reveal, SANS, Stage, Tone, typed} from '../ui';

// Bars 13–14. The stop, on ink: a ring of sound bars turning in 3D, the words forming in its
// centre. Then the three facts slam in on bar 14's beats, each on its own colour field.

const BARS = 72;
const FACT_TONES: Tone[] = ['lilac', 'lilac', 'lilac'];

export const Local: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.local;
  const heard = typed(d.heard, f, 30, 94);
  const loud = kf(f, [6, 20], [0, 1]) * kf(f, [96, 116], [1, 0.15]);
  const spin = f * 0.6;

  const dim = kf(f, [116, 126], [1, 0.3]);
  const out = kf(f, [228, 240], [0, 1]);
  return (
    <Stage tone="ink" light={[50, 60]}>
      <AbsoluteFill style={{opacity: dim, filter: dim < 1 ? `blur(${(1 - dim) * 8}px)` : undefined}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center', ...H, fontSize: 76}}>
          <Reveal at={2}>
            <span style={{color: C.text}}>{d.headA}</span>
          </Reveal>
          <Reveal at={8}>
            <span style={{color: C.textDim, fontSize: 56}}>{d.headB}</span>
          </Reveal>
        </div>
        <AbsoluteFill style={{perspective: 1400}}>
          <div style={{position: 'absolute', left: 960, top: 660, transformStyle: 'preserve-3d', transform: `rotateX(68deg) rotateZ(${spin}deg)`}}>
            {Array.from({length: BARS}).map((_, i) => {
              const a = (i / BARS) * 360;
              const h = 16 + loud * 150 * Math.abs(Math.sin(f / 5 + i * 0.61) * Math.cos(f / 9 + i * 0.23));
              const lit = i / BARS < Array.from(heard).length / Array.from(d.heard).length;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: h,
                    left: -7,
                    top: 0,
                    borderRadius: 7,
                    background: lit ? C.red : 'rgba(244,244,242,0.28)',
                    transformOrigin: '50% 0%',
                    transform: `rotateZ(${a}deg) translateY(420px) rotateX(90deg)`,
                  }}
                />
              );
            })}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: 200}}>
          <div style={{fontFamily: SANS, fontSize: 64, fontWeight: 700, color: C.text, minHeight: 80}}>
            {heard ? `“${heard}${heard.length >= d.heard.length ? '”' : ''}` : ''}
          </div>
          <div style={{marginTop: 26, fontFamily: MONO, fontSize: 40, color: 'rgba(244,244,242,0.8)', letterSpacing: 3, opacity: kf(f, [50, 70], [0, 1])}}>{d.spec}</div>
        </AbsoluteFill>
      </AbsoluteFill>
      {d.facts.map((fact, i) => {
        const at = 120 + i * 30;
        const k = kf(f, [at, at + 7], [0, 1], ease);
        if (f < at) return null;
        const rot = [-4, 3, -2][i];
        return (
          <div key={fact.k} style={{position: 'absolute', left: 0, right: 0, top: 190 + i * 250, display: 'flex', justifyContent: 'center', opacity: 1 - out}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 30, padding: '26px 54px', borderRadius: 28, background: i === 1 ? C.text : C.red, color: C.ink, transform: `rotate(${rot * k}deg) scale(${(1.5 - 0.5 * k) * (1 + out * 0.2)})`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)'}}>
              <span style={{fontFamily: MONO, fontSize: 44, opacity: 0.6}}>{fact.k}</span>
              <span style={{...H, fontSize: 96, whiteSpace: 'nowrap'}}>{fact.v}</span>
            </div>
          </div>
        );
      })}
    </Stage>
  );
};
