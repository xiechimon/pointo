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

  if (f < 120) {
    return (
      <Stage tone="ink" light={[50, 60]}>
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
          <div style={{marginTop: 26, fontFamily: MONO, fontSize: 32, color: C.textDim, letterSpacing: 3, opacity: kf(f, [50, 70], [0, 1])}}>{d.spec}</div>
        </AbsoluteFill>
      </Stage>
    );
  }

  const i = Math.min(2, Math.floor((f - 120) / 30));
  const at = 120 + i * 30;
  const k = kf(f, [at, at + 8], [0, 1], ease);
  const push = kf(f, [230, 240], [0, 1]);
  const tone = FACT_TONES[i];
  const fact = d.facts[i];
  return (
    <AbsoluteFill style={{background: GROUND[tone], alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'absolute', right: 80 - (f - at) * 1.2, bottom: -120, fontFamily: DISPLAY, fontSize: 760, lineHeight: 1, color: 'transparent', WebkitTextStroke: `4px ${C.lilacDeep}`, opacity: 0.35 * k}}>{fact.k}</div>
      <div style={{fontFamily: MONO, fontSize: 52, color: FG[tone], opacity: 0.6 * k, marginBottom: 30}}>{fact.k} / 03</div>
      <div
        style={{
          ...H,
          fontSize: 132,
          color: FG[tone],
          whiteSpace: 'nowrap',
          transform: `scale(${(1.35 - 0.35 * k) * (1 + (f - at) * 0.002) * (1 + push * 0.3)})`,
          filter: push > 0 ? `blur(${push * 16}px)` : undefined,
          opacity: 1 - push * 0.6,
        }}
      >
        {fact.v}
      </div>
    </AbsoluteFill>
  );
};
