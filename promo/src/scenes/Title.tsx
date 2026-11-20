import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Fade, Flash, H, Icon, kf, MONO, Reveal, Stage, useSpring} from '../ui';

// Bars 2–3. Impact: one huge red pen stroke rings the screen, "指给它看。" lands inside it.
// Then the camera flies through the ring and the icon resolves, with a light sweep.

const RING =
  'M -80 830 C 200 770, 250 300, 700 205 C 1100 115, 1630 185, 1730 470 C 1820 770, 1400 935, 960 935 C 520 935, 250 805, 262 565 C 274 380, 480 262, 780 232';

const Slash: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 26], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.7, 0.2, 1)});
  return (
    <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <filter id="inkglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={RING} pathLength={1} fill="none" stroke={C.red} strokeWidth={44} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - p} filter="url(#inkglow)" />
    </svg>
  );
};

export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.title;
  const through = interpolate(f, [100, 138], [0, 1], {...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0)});
  const icon = useSpring(122, {damping: 20, stiffness: 90});
  const sweep = kf(f, [150, 196], [-0.4, 1.4]);
  const tilt = Math.sin(f / 50) * 4;

  return (
    <Stage light={[50, 50]}>
      {/* red bloom behind everything right after the hit */}
      <AbsoluteFill style={{background: 'radial-gradient(closest-side at 50% 52%, rgba(242,59,52,0.22), transparent)', opacity: kf(f, [0, 10, 120], [0, 1, 0.4]) * (1 - through)}} />

      {f < 140 ? (
        <AbsoluteFill
          style={{
            transform: `scale(${1 + through * 7})`,
            opacity: 1 - kf(f, [118, 138], [0, 1]),
            filter: through > 0.02 ? `blur(${through * 30}px)` : undefined,
          }}
        >
          <CameraMotionBlur samples={6} shutterAngle={200}>
            <AbsoluteFill>
              <Slash />
            </AbsoluteFill>
          </CameraMotionBlur>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            <div style={{...H, fontSize: 52, color: C.dim, marginBottom: 6}}>
              <Reveal at={16}>{t.pre}</Reveal>
            </div>
            <div style={{...H, fontSize: 230, fontWeight: 600, letterSpacing: '-0.04em', color: C.text}}>
              <Reveal at={4} dur={30}>{t.main}</Reveal>
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {f >= 118 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', perspective: 1400}}>
          <div style={{position: 'absolute', width: 1000, height: 600, background: 'radial-gradient(closest-side, rgba(41,102,255,0.32), transparent)', opacity: icon}} />
          <div
            style={{
              position: 'relative',
              marginTop: -120,
              transform: `translateZ(${(1 - icon) * -600}px) rotateY(${tilt}deg) rotateX(${tilt * 0.4}deg)`,
              filter: icon < 0.98 ? `blur(${(1 - icon) * 26}px)` : undefined,
              opacity: interpolate(icon, [0, 0.4], [0, 1], clamp),
              WebkitBoxReflect: 'below 18px linear-gradient(transparent 62%, rgba(255,255,255,0.22))',
            }}
          >
            <div style={{position: 'relative', width: 240, height: 240, borderRadius: 54, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.6)'}}>
              <Icon size={240} style={{borderRadius: 0}} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(105deg, transparent ${sweep * 100 - 18}%, rgba(255,255,255,0.55) ${sweep * 100}%, transparent ${sweep * 100 + 18}%)`,
                  mixBlendMode: 'overlay',
                }}
              />
            </div>
          </div>
          <div style={{position: 'absolute', top: 690, ...H, fontWeight: 600, fontSize: 110, letterSpacing: '-0.04em', color: C.text}}>
            <Reveal at={146}>Pointo</Reveal>
          </div>
          <Fade at={178} y={10} style={{position: 'absolute', top: 840}}>
            <div style={{fontFamily: MONO, fontSize: 22, color: C.dim, letterSpacing: 3}}>{t.sub}</div>
          </Fade>
        </AbsoluteFill>
      ) : null}
      <Flash at={0} len={10} max={0.6} color="#FFE3E1" />
      <Flash at={124} len={16} max={0.25} />
    </Stage>
  );
};

