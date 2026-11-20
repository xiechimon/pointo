import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, kf, MONO, Pop, SANS, typed} from '../ui';

// Bars 13–14. Breakdown: speech becomes text on-device; then three facts on the beat.
export const Local: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.local;
  const push = kf(f, [214, 240], [0, 1]);

  if (f < 120) {
    const loud = kf(f, [8, 20], [0, 1]) * kf(f, [86, 104], [1, 0.15]);
    const heard = typed(d.heard, f, 30, 92);
    return (
      <AbsoluteFill>
        <Backdrop pulseAt={[0]} />
        <Pop at={2} y={30} style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center'}}>
          <div style={{fontFamily: SANS, fontWeight: 900, fontSize: 104, color: '#fff', letterSpacing: -2}}>{d.head}</div>
        </Pop>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{display: 'flex', gap: 9, alignItems: 'center', height: 200, marginTop: 20}}>
            {Array.from({length: 56}).map((_, i) => {
              const x = i / 55;
              const shape = Math.sin(Math.PI * x) ** 0.6;
              const h = 10 + loud * shape * (40 + 120 * Math.abs(Math.sin(f / 5 + i * 0.9) * Math.cos(f / 9 + i * 0.37)));
              const lit = x < Array.from(heard).length / Array.from(d.heard).length;
              return <div key={i} style={{width: 10, height: h, borderRadius: 5, background: lit ? C.sky : 'rgba(157,184,255,0.35)'}} />;
            })}
          </div>
        </AbsoluteFill>
        <div style={{position: 'absolute', top: 730, width: '100%', textAlign: 'center', fontFamily: SANS, fontSize: 58, fontWeight: 700, color: '#fff', minHeight: 80}}>
          {heard ? `“${heard}${heard.length < d.heard.length ? '' : '”'}` : ''}
        </div>
        <Pop at={56} y={20} style={{position: 'absolute', top: 880, width: '100%', display: 'flex', justifyContent: 'center'}}>
          <div style={{padding: '14px 30px', borderRadius: 999, border: '1.5px solid rgba(157,184,255,0.5)', background: 'rgba(41,102,255,0.15)', fontFamily: MONO, fontSize: 30, color: C.sky}}>{d.sub}</div>
        </Pop>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Backdrop pulseAt={[120, 150, 180]} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          paddingLeft: 330,
          gap: 34,
          transform: `scale(${1 + push * 0.35})`,
          opacity: 1 - push,
          filter: push > 0 ? `blur(${push * 18}px)` : undefined,
        }}
      >
        {d.facts.map((fact, i) => (
          <Pop key={fact} at={120 + i * 30} y={70} scale={0.85}>
            <div style={{display: 'flex', alignItems: 'center', gap: 40, fontFamily: SANS}}>
              <div style={{width: 104, height: 104, borderRadius: 30, background: i === 0 ? C.blue : i === 1 ? '#22B8CF' : C.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, fontWeight: 900, flexShrink: 0}}>
                ✓
              </div>
              <div style={{fontSize: 118, fontWeight: 900, color: '#fff', letterSpacing: -2}}>{fact}</div>
            </div>
          </Pop>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
