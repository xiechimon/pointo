import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, DISPLAY, ease, Flash, H, HAND, Icon, Ink, kf, MONO, Rise, SANS, Stage, UI, useSpring} from '../ui';

// Bars 15–17, the musical peak. The mark lands on the hit (30.0 s); the one call to action, the
// GitHub address, by 30.5 s; the shortcut keys land at 31.0 s; at 33.0 s the red pen circles the
// address. At 34.0 s (the button hit) everything clears and the icon flies up into a menu bar:
// "它就住在你的菜单栏里". Cut to black on the last note (35.5 s).

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.end;
  const icon = useSpring(0, {damping: 12, stiffness: 180, mass: 0.8});
  const push = kf(f, [30, 210], [1, 1.05], (x) => x) + kf(f, [210, 360], [0, 0.01], (x) => x);
  const cta = kf(f, [22, 34], [0, 1], ease);
  const hit = f >= 240 ? Math.exp(-(f - 240) / 12) : 0; // the button hit at 34.0 s

  return (
    <Stage tone="paper" light={[50, 45]}>
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        <AbsoluteFill style={{alignItems: 'center', paddingTop: 410}}>
          <Rise text="POINTO" at={0} stagger={2} dur={14} style={{fontFamily: DISPLAY, fontSize: 250, lineHeight: 1, color: C.ink, letterSpacing: 4}} />
          <div style={{...H, fontSize: 64, marginTop: 18, opacity: kf(f, [12, 24], [0, 1]), transform: `translateY(${(1 - kf(f, [12, 30], [0, 1], ease)) * 20}px)`}}>
            <span style={{color: C.ink}}>指给 AI 看，</span>
            <span style={{color: C.red}}>而不是讲给它听。</span>
          </div>
          <div style={{position: 'relative', marginTop: 50, opacity: cta, transform: `translateY(${(1 - cta) * 30}px)`}}>
            <div style={{padding: '20px 44px', borderRadius: 22, background: C.ink, color: C.text, fontFamily: UI, fontWeight: 700, fontSize: 54, letterSpacing: -0.5}}>{d.url}</div>
            <Ink viewBox="0 0 860 140" style={{left: -50, top: -28, width: 960, height: 170}} d="M 800 30 C 860 4, 400 -8, 120 18 C 10 30, -6 110, 140 128 C 380 150, 790 140, 850 96 C 880 70, 830 40, 740 30" from={60} to={84} width={8} />
          </div>
          <div style={{position: 'relative', marginTop: 30, height: 60, width: 1000, textAlign: 'center'}}>
            <div style={{position: 'absolute', inset: 0, fontFamily: MONO, fontSize: 36, color: C.dim, opacity: kf(f, [34, 46], [0, 1])}}>{d.platforms}</div>
          </div>
        </AbsoluteFill>
        <div style={{position: 'absolute', left: 190, top: 640, fontFamily: HAND, fontWeight: 600, fontSize: 84, color: C.red, transform: 'rotate(-10deg)', opacity: kf(f, [80, 90], [0, 1])}}>{COPY.title.note}</div>
      </AbsoluteFill>

      <div style={{position: 'absolute', left: 960 - 80, top: 320 - 80 + (1 - Math.min(1, icon)) * -400, transform: `rotate(${(1 - icon) * 30}deg) scale(${1 + hit * 0.08})`}}>
        <Icon size={160} style={{boxShadow: '0 24px 50px rgba(13,13,15,0.25)'}} />
      </div>
      <Flash at={0} len={10} max={0.9} color={C.red} />
    </Stage>
  );
};
