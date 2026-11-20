import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Fade, Flash, H, Icon, Ink, kf, MONO, Reveal, SANS, Stage, useSpring} from '../ui';

// Bars 15–17. Icon, wordmark, tagline (red mark on the key word), where to get it.
export const End: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.end;
  const icon = useSpring(0, {damping: 24, stiffness: 80});
  const float = Math.sin(f / 40) * 4;
  const fadeOut = kf(f, [326, 360], [0, 1]);

  return (
    <Stage light={[50, 30]}>
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 60,
          width: 900,
          height: 520,
          background: 'radial-gradient(closest-side, rgba(41,102,255,0.22), transparent)',
          opacity: icon,
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', paddingTop: 170}}>
        <div
          style={{
            transform: `translateY(${(1 - icon) * 40 + float}px) scale(${0.9 + icon * 0.1})`,
            filter: icon < 0.98 ? `blur(${(1 - icon) * 20}px)` : undefined,
            opacity: interpolate(icon, [0, 0.4], [0, 1], clamp),
          }}
        >
          <Icon size={180} style={{boxShadow: '0 30px 80px rgba(0,0,0,0.55)'}} />
        </div>
        <div style={{...H, fontWeight: 600, fontSize: 104, letterSpacing: '-0.035em', color: C.text, marginTop: 34}}>
          <Reveal at={12}>{d.name}</Reveal>
        </div>
        <div style={{...H, fontSize: 46, marginTop: 18, display: 'flex'}}>
          <Reveal at={26}>
            <span style={{color: C.text, position: 'relative'}}>
              {d.tagA}
              <Ink stretch viewBox="0 0 100 100" d="M 1 98 C 30 94, 60 95, 88 96" from={48} to={70} width={4} />
            </span>
          </Reveal>
          <Reveal at={32}>
            <span style={{color: C.dim}}>{d.tagB}</span>
          </Reveal>
        </div>
        <Fade at={64} y={14}>
          <div style={{display: 'flex', gap: 16, marginTop: 56}}>
            <div style={{padding: '16px 30px', borderRadius: 14, background: C.text, color: '#111', fontFamily: SANS, fontWeight: 500, fontSize: 24}}>{d.mac}</div>
            <div style={{padding: '16px 30px', borderRadius: 14, border: `1px solid rgba(255,255,255,0.22)`, color: C.text, fontFamily: SANS, fontWeight: 500, fontSize: 24}}>{d.win}</div>
          </div>
        </Fade>
        <Fade at={84} y={10}>
          <div style={{marginTop: 40, fontFamily: MONO, fontSize: 24, color: C.dim, display: 'flex', alignItems: 'center', gap: 12}}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill={C.dim}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {d.url}
          </div>
        </Fade>
      </AbsoluteFill>
      <div style={{position: 'absolute', bottom: 64, width: '100%', textAlign: 'center'}}>
        <Fade at={110} y={8}>
          <span style={{fontFamily: MONO, fontSize: 18, color: '#55565C', letterSpacing: 1}}>{d.keys}</span>
        </Fade>
      </div>
      <Flash at={0} len={22} max={0.4} />
      <AbsoluteFill style={{background: C.bg, opacity: fadeOut}} />
    </Stage>
  );
};
