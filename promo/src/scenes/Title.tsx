import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, clamp, Flash, Icon, Ink, kf, Pop, SANS, useSpring} from '../ui';

// Bars 2–3: the impact. "Don't tell it, show it" → the app icon lands.
export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.title;
  const linesOut = kf(f, [118, 140], [0, 1]);
  const icon = useSpring(126, {damping: 11, stiffness: 150, mass: 0.9});
  const word = useSpring(150, {damping: 16, stiffness: 140});
  const ring = interpolate(f, [126, 176], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Backdrop pulseAt={[0, 60, 126]} />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SANS,
          fontWeight: 900,
          color: '#fff',
          opacity: 1 - linesOut,
          transform: `translateY(${-linesOut * 120}px) scale(${1 + linesOut * 0.06})`,
          filter: linesOut > 0 ? `blur(${linesOut * 16}px)` : undefined,
        }}
      >
        <Pop at={0} y={60}>
          <div style={{fontSize: 150, letterSpacing: -3, color: 'rgba(255,255,255,0.62)', position: 'relative', lineHeight: 1.25}}>
            {t.l1a}
            <span style={{position: 'relative'}}>
              {t.l1b}
              <Ink stretch d="M -3 58 C 25 52, 70 60, 103 50" viewBox="0 0 100 100" from={28} to={50} width={14} />
            </span>
            {t.l1c}
          </div>
        </Pop>
        <Pop at={60} y={60}>
          <div style={{fontSize: 210, letterSpacing: -5, lineHeight: 1.2, position: 'relative'}}>
            {t.l2}
            <Ink stretch d="M 1 95 C 25 89, 60 91, 86 94 C 88 94.5, 89 95, 90 96" viewBox="0 0 100 100" from={74} to={100} width={16} />
          </div>
        </Pop>
      </AbsoluteFill>

      {f >= 120 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              position: 'absolute',
              width: 420,
              height: 420,
              borderRadius: '50%',
              border: `3px solid ${C.sky}`,
              transform: `scale(${0.6 + ring * 1.8})`,
              opacity: (1 - ring) * 0.8,
            }}
          />
          <div style={{display: 'flex', alignItems: 'center', gap: 56 * word}}>
            <div
              style={{
                transform: `scale(${icon}) rotate(${(1 - icon) * -20}deg)`,
                filter: 'drop-shadow(0 30px 80px rgba(41,102,255,0.65))',
              }}
            >
              <Icon size={300} />
            </div>
            <div
              style={{
                width: 720 * word,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 200,
                letterSpacing: -6,
                color: '#fff',
                opacity: word,
              }}
            >
              Pointo
            </div>
          </div>
          <Pop at={180} y={20} style={{position: 'absolute', top: 760}}>
            <div style={{fontFamily: SANS, fontSize: 40, color: C.dim, letterSpacing: 6}}>{t.sub}</div>
          </Pop>
        </AbsoluteFill>
      ) : null}
      <Flash at={0} len={16} max={0.85} />
    </AbsoluteFill>
  );
};
