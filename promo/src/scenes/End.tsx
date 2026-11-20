import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, clamp, Flash, Icon, Ink, kf, MONO, Pop, SANS, useSpring} from '../ui';

// Bars 15–17. Impact → logo, tagline (same red mark as the website hero), where to get it.
export const End: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.end;
  const icon = useSpring(0, {damping: 10, stiffness: 140, mass: 1});
  const rings = [0, 10, 20].map((delay) => interpolate(f - delay, [0, 60], [0, 1], clamp));
  const float = Math.sin(f / 30) * 6;
  const fadeOut = kf(f, [330, 360], [0, 1]);

  return (
    <AbsoluteFill>
      <Backdrop hue="blue" />
      <AbsoluteFill style={{alignItems: 'center', paddingTop: 140}}>
        <div style={{position: 'relative', width: 280, height: 280}}>
          {rings.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 140 - 200,
                top: 140 - 200,
                width: 400,
                height: 400,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.8)',
                transform: `scale(${0.5 + r * 2})`,
                opacity: r > 0 ? (1 - r) * 0.6 : 0,
              }}
            />
          ))}
          <div style={{transform: `translateY(${float}px) scale(${icon}) rotate(${(1 - icon) * 25}deg)`, filter: 'drop-shadow(0 40px 60px rgba(0,0,30,0.45))'}}>
            <Icon size={280} />
          </div>
        </div>
        <Pop at={14} y={40}>
          <div style={{fontFamily: SANS, fontWeight: 900, fontSize: 150, letterSpacing: -5, color: '#fff', marginTop: 20, lineHeight: 1.1}}>{d.name}</div>
        </Pop>
        <Pop at={34} y={30}>
          <div style={{fontFamily: SANS, fontWeight: 900, fontSize: 70, color: '#fff', marginTop: 16, letterSpacing: -1}}>
            {d.tagA}
            <span style={{position: 'relative', whiteSpace: 'nowrap', isolation: 'isolate'}}>
              {d.tagB}
              <Ink stretch d="M 0 92 C 30 88, 70 90, 100 87" viewBox="0 0 100 100" from={50} to={70} width={11} style={{zIndex: -1}} />
            </span>
          </div>
        </Pop>
        <div style={{display: 'flex', gap: 18, marginTop: 54}}>
          {d.chips.map((chip, i) => (
            <Pop key={chip} at={70 + i * 8} y={24}>
              <div style={{padding: '14px 30px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.45)', fontFamily: SANS, fontWeight: 700, fontSize: 34, color: '#fff'}}>{chip}</div>
            </Pop>
          ))}
        </div>
        <Pop at={100} y={20}>
          <div style={{marginTop: 40, fontFamily: MONO, fontSize: 40, color: '#fff', display: 'flex', alignItems: 'center', gap: 16}}>
            <svg width="40" height="40" viewBox="0 0 16 16" fill="#fff">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {d.url}
          </div>
        </Pop>
        <Pop at={130} y={16}>
          <div style={{marginTop: 26, fontFamily: SANS, fontSize: 28, color: 'rgba(255,255,255,0.75)', letterSpacing: 2}}>{d.keys}</div>
        </Pop>
      </AbsoluteFill>
      <Flash at={0} len={18} max={1} />
      <AbsoluteFill style={{background: C.night, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
