import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, ease, H, kf, MONO, Reveal, SANS, Stage, typed} from '../ui';

// Bars 13–14. A ring of sound bars turning in 3D; the words form in its centre.
// Then the three facts slam in on bar 14's beats, full width.

const BARS = 72;

export const Local: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.local;
  const heard = typed(d.heard, f, 30, 94);
  const loud = kf(f, [6, 20], [0, 1]) * kf(f, [96, 116], [1, 0.15]);
  const ringOut = kf(f, [108, 122], [0, 1]);
  const spin = f * 0.6;

  return (
    <Stage light={[50, 50]}>
      <Chapter n={6} label={COPY.chapters[5]} out={222} />
      {f < 124 ? (
        <AbsoluteFill style={{opacity: 1 - ringOut, filter: ringOut > 0 ? `blur(${ringOut * 16}px)` : undefined}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', ...H, fontSize: 60}}>
            <Reveal at={2}>
              <span style={{color: C.text}}>{d.headA}</span>
              <span style={{color: C.dim}}>{d.headB}</span>
            </Reveal>
          </div>
          <AbsoluteFill style={{perspective: 1400}}>
            <div style={{position: 'absolute', left: 960, top: 600, transformStyle: 'preserve-3d', transform: `rotateX(68deg) rotateZ(${spin}deg)`}}>
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
                      background: lit ? `linear-gradient(0deg, ${C.blue}, #9DB8FF)` : 'rgba(255,255,255,0.22)',
                      boxShadow: lit ? '0 0 24px rgba(41,102,255,0.7)' : undefined,
                      transformOrigin: '50% 0%',
                      transform: `rotateZ(${a}deg) translateY(420px) rotateX(90deg)`,
                    }}
                  />
                );
              })}
            </div>
          </AbsoluteFill>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: 140}}>
            <div style={{fontFamily: SANS, fontSize: 52, fontWeight: 500, color: C.text, minHeight: 70, textShadow: '0 4px 40px rgba(0,0,0,0.8)'}}>
              {heard ? `“${heard}${heard.length >= d.heard.length ? '”' : ''}` : ''}
            </div>
            <div style={{marginTop: 24, fontFamily: MONO, fontSize: 20, color: C.dim, letterSpacing: 3, opacity: kf(f, [50, 70], [0, 1])}}>{d.spec}</div>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          {d.facts.map((fact, i) => {
            const at = 120 + i * 30;
            const next = at + 30;
            const k = kf(f, [at, at + 10], [0, 1], ease);
            const out = i < d.facts.length - 1 ? kf(f, [next, next + 8], [0, 1]) : kf(f, [214, 240], [0, 1]);
            if (f < at || out >= 1) return null;
            return (
              <AbsoluteFill key={fact.k} style={{alignItems: 'center', justifyContent: 'center'}}>
                <div style={{fontFamily: MONO, fontSize: 26, color: i === 0 ? C.red : C.dim, marginBottom: 30, opacity: k * (1 - out)}}>{fact.k} / 03</div>
                <div
                  style={{
                    ...H,
                    fontWeight: 600,
                    fontSize: 150,
                    letterSpacing: '-0.04em',
                    color: C.text,
                    whiteSpace: 'nowrap',
                    transform: `scale(${1.3 - 0.3 * k + out * 0.15})`,
                    opacity: k * (1 - out),
                    filter: k < 1 || out > 0 ? `blur(${(1 - k) * 18 + out * 18}px)` : undefined,
                  }}
                >
                  {fact.v}
                </div>
              </AbsoluteFill>
            );
          })}
        </AbsoluteFill>
      )}
    </Stage>
  );
};
