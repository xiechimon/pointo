import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, Fade, H, kf, MONO, Reveal, SANS, Stage, typed} from '../ui';

// Bars 13–14. Breakdown: speech becomes text on-device; then three facts on the beat.
export const Local: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.local;
  const heard = typed(d.heard, f, 34, 96);
  const loud = kf(f, [10, 24], [0, 1]) * kf(f, [96, 116], [1, 0.1]);
  const progress = Array.from(heard).length / Array.from(d.heard).length;
  const out = kf(f, [216, 240], [0, 1]);
  const waveOut = kf(f, [108, 124], [0, 1]);

  return (
    <Stage light={[50, 40]}>
      <Chapter n={6} label={COPY.chapters[5]} out={222} />
      <AbsoluteFill style={{opacity: 1 - out, filter: out > 0 ? `blur(${out * 14}px)` : undefined, transform: `scale(${1 + out * 0.04})`}}>
        <div style={{position: 'absolute', left: 160, top: 200, ...H, fontSize: 72}}>
          <Reveal at={2}>
            <span style={{color: C.text}}>{d.headA}</span>
          </Reveal>
          <Reveal at={10}>
            <span style={{color: C.dim}}>{d.headB}</span>
          </Reveal>
        </div>

        {/* waveform → transcript */}
        <div style={{position: 'absolute', left: 160, top: 470, width: 1600, opacity: 1 - waveOut, filter: waveOut > 0 ? `blur(${waveOut * 10}px)` : undefined, transform: `translateY(${-waveOut * 20}px)`}}>
          <div style={{display: 'flex', gap: 6, alignItems: 'center', height: 120}}>
            {Array.from({length: 120}).map((_, i) => {
              const x = i / 119;
              const h = 3 + loud * (0.25 + 0.75 * Math.sin(Math.PI * x) ** 0.5) * 100 * Math.abs(Math.sin(f / 5 + i * 0.73) * Math.cos(f / 11 + i * 0.29));
              return <div key={i} style={{width: 7, height: h, borderRadius: 4, background: x <= progress ? C.text : '#34353B'}} />;
            })}
          </div>
          <div style={{marginTop: 40, fontFamily: SANS, fontSize: 40, fontWeight: 500, color: C.text, minHeight: 60}}>
            {heard ? <span>“{heard}{progress >= 1 ? '”' : ''}</span> : null}
          </div>
          <Fade at={60} y={10}>
            <div style={{marginTop: 18, fontFamily: MONO, fontSize: 20, color: C.dim, letterSpacing: 2}}>{d.spec}</div>
          </Fade>
        </div>

        {/* facts, on bar 14's beats, where the waveform was */}
        <div style={{position: 'absolute', left: 160, top: 520, width: 1600, display: 'flex', gap: 40}}>
          {d.facts.map((fact, i) => (
            <Fade key={fact.k} at={120 + i * 30} y={24} style={{flex: 1}}>
              <div style={{borderTop: `1px solid ${C.line}`, paddingTop: 28}}>
                <div style={{fontFamily: MONO, fontSize: 20, color: i === 0 ? C.red : C.dim, marginBottom: 22}}>{fact.k}</div>
                <div style={{...H, fontSize: 42, color: C.text, whiteSpace: 'nowrap'}}>{fact.v}</div>
              </div>
            </Fade>
          ))}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
