import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Fade, Flash, H, Icon, Ink, kf, MONO, Reveal, SANS, Stage, useSpring} from '../ui';

// Bars 15–17. Impact → the icon swings in from depth with a light sweep and a floor
// reflection; wordmark, tagline (red mark on the key words), download buttons.
export const End: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.end;
  const icon = useSpring(0, {damping: 18, stiffness: 70});
  const sweep = kf(f, [26, 80], [-0.4, 1.4]);
  const tilt = Math.sin(f / 46) * 6;
  const fadeOut = kf(f, [326, 360], [0, 1]);

  return (
    <Stage light={[50, 30]}>
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 360, top: -120, width: 1200, height: 800, background: 'radial-gradient(closest-side, rgba(41,102,255,0.30), transparent)', opacity: icon}} />
        <div style={{position: 'absolute', left: 1100, top: 380, width: 900, height: 700, background: 'radial-gradient(closest-side, rgba(242,59,52,0.12), transparent)', opacity: icon}} />
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', paddingTop: 120, perspective: 1400}}>
        <div
          style={{
            transform: `translateZ(${(1 - icon) * -900}px) rotateY(${(1 - icon) * -70 + tilt}deg) rotateX(${tilt * 0.4}deg)`,
            opacity: interpolate(icon, [0, 0.3], [0, 1], clamp),
            WebkitBoxReflect: 'below 14px linear-gradient(transparent 64%, rgba(255,255,255,0.2))',
          }}
        >
          <div style={{position: 'relative', width: 200, height: 200, borderRadius: 45, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.6)'}}>
            <Icon size={200} style={{borderRadius: 0}} />
            <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sweep * 100 - 18}%, rgba(255,255,255,0.6) ${sweep * 100}%, transparent ${sweep * 100 + 18}%)`, mixBlendMode: 'overlay'}} />
          </div>
        </div>
        <div style={{...H, fontWeight: 600, fontSize: 120, letterSpacing: '-0.04em', color: C.text, marginTop: 70}}>
          <Reveal at={14}>{d.name}</Reveal>
        </div>
        <div style={{...H, fontSize: 48, marginTop: 14, display: 'flex'}}>
          <Reveal at={28}>
            <span style={{color: C.text, position: 'relative'}}>
              {d.tagA}
              <Ink stretch viewBox="0 0 100 100" d="M 1 98 C 30 94, 60 95, 88 96" from={50} to={72} width={5} />
            </span>
          </Reveal>
          <Reveal at={34}>
            <span style={{color: C.dim}}>{d.tagB}</span>
          </Reveal>
        </div>
        <Fade at={64} y={14}>
          <div style={{display: 'flex', gap: 16, marginTop: 50}}>
            <div style={{padding: '16px 30px', borderRadius: 14, background: C.text, color: '#111', fontFamily: SANS, fontWeight: 500, fontSize: 24}}>{d.mac}</div>
            <div style={{padding: '16px 30px', borderRadius: 14, border: `1px solid rgba(255,255,255,0.22)`, color: C.text, fontFamily: SANS, fontWeight: 500, fontSize: 24}}>{d.win}</div>
          </div>
        </Fade>
        <Fade at={84} y={10}>
          <div style={{marginTop: 34, fontFamily: MONO, fontSize: 24, color: C.dim, display: 'flex', alignItems: 'center', gap: 12}}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill={C.dim}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {d.url}
          </div>
        </Fade>
      </AbsoluteFill>
      <div style={{position: 'absolute', bottom: 56, width: '100%', textAlign: 'center'}}>
        <Fade at={110} y={8}>
          <span style={{fontFamily: MONO, fontSize: 18, color: '#55565C', letterSpacing: 1}}>{d.keys}</span>
        </Fade>
      </div>
      <Flash at={0} len={18} max={0.45} />
      <AbsoluteFill style={{background: C.bg, opacity: fadeOut}} />
    </Stage>
  );
};
