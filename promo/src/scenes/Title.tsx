import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Fade, Flash, H, Icon, Ink, kf, MONO, Reveal, SANS, Stage, useSpring} from '../ui';

// Bars 2–3. "别讲给 AI 听，/ 指给它看。" then the icon resolves out of blur.
export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.title;
  const icon = useSpring(124, {damping: 22, stiffness: 90});
  const word = kf(f, [150, 186], [0, 1]);
  const scale = kf(f, [0, 120], [1.03, 1], (x) => x);

  return (
    <Stage light={[50, 45]}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${scale})`}}>
        <div style={{...H, fontSize: 132, textAlign: 'center'}}>
          <Reveal at={2} out={116}>
            <span style={{color: C.dim}}>{t.l1}</span>
          </Reveal>
          <Reveal at={58} out={118}>
            <span style={{color: C.text, position: 'relative'}}>
              {t.l2}
              <Ink stretch viewBox="0 0 100 100" d="M 2 96 C 25 90, 60 92, 88 95" from={72} to={98} width={7} />
            </span>
          </Reveal>
        </div>
      </AbsoluteFill>

      {f >= 120 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          {/* soft blue bloom under the icon */}
          <div
            style={{
              position: 'absolute',
              width: 900,
              height: 500,
              top: 250,
              background: 'radial-gradient(closest-side, rgba(41,102,255,0.28), transparent)',
              opacity: icon,
            }}
          />
          <div
            style={{
              transform: `translateY(${(1 - icon) * 40 - 60}px) scale(${0.86 + icon * 0.14})`,
              filter: icon < 0.98 ? `blur(${(1 - icon) * 24}px)` : undefined,
              opacity: interpolate(icon, [0, 0.5], [0, 1], clamp),
            }}
          >
            <Icon size={200} style={{boxShadow: '0 30px 80px rgba(0,0,0,0.5)'}} />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 640,
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 92,
              letterSpacing: '-0.03em',
              color: C.text,
              opacity: word,
              filter: word < 1 ? `blur(${(1 - word) * 12}px)` : undefined,
              transform: `translateY(${(1 - word) * 20}px)`,
            }}
          >
            Pointo
          </div>
          <Fade at={184} y={10} style={{position: 'absolute', top: 780}}>
            <div style={{fontFamily: MONO, fontSize: 22, color: C.dim, letterSpacing: 2}}>{t.sub}</div>
          </Fade>
        </AbsoluteFill>
      ) : null}
      <Flash at={0} len={20} max={0.35} />
    </Stage>
  );
};
