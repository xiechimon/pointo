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
  const push = kf(f, [30, 240], [1, 1.06], (x) => x);
  const cta = kf(f, [22, 34], [0, 1], ease);
  const toBar = kf(f, [244, 272], [0, 1], ease);

  // icon path: centre of the card → the menu bar at the top right
  const ix = interpolate(toBar, [0, 1], [960, 1772]);
  const iy = interpolate(toBar, [0, 1], [320, 22]);
  const isz = interpolate(toBar, [0, 1], [160, 30]);

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
            <Ink viewBox="0 0 860 140" style={{left: -50, top: -28, width: 960, height: 170}} d="M 800 30 C 860 4, 400 -8, 120 18 C 10 30, -6 110, 140 128 C 380 150, 790 140, 850 96 C 880 70, 830 40, 740 30" from={180} to={204} width={8} />
          </div>
          <div style={{position: 'relative', marginTop: 30, height: 60, width: 1000, textAlign: 'center'}}>
            <div style={{position: 'absolute', inset: 0, fontFamily: MONO, fontSize: 34, color: C.dim, opacity: kf(f, [34, 46], [0, 1]) * kf(f, [250, 262], [1, 0])}}>{d.platforms}</div>
            <div style={{position: 'absolute', inset: 0, fontFamily: SANS, fontWeight: 900, fontSize: 44, color: C.ink, opacity: kf(f, [268, 280], [0, 1])}}>{d.menubar} ↗</div>
          </div>
        </AbsoluteFill>
        <div style={{position: 'absolute', left: 110, top: 610, fontFamily: HAND, fontWeight: 600, fontSize: 84, color: C.red, transform: 'rotate(-10deg)', opacity: kf(f, [200, 210], [0, 1])}}>{COPY.title.note}</div>
      </AbsoluteFill>

      {/* the menu bar the icon flies into */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 44, background: 'rgba(13,13,15,0.06)', borderBottom: '1px solid rgba(13,13,15,0.08)', opacity: kf(f, [250, 264], [0, 1]), display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 28px', gap: 26, fontFamily: UI, fontWeight: 600, fontSize: 20, color: C.ink}}>
        <span style={{width: 30}} />
        <span>10:24</span>
      </div>
      <div style={{position: 'absolute', left: ix - isz / 2 - (toBar > 0.99 ? 74 : 0) * 0, top: iy - isz / 2 + (1 - Math.min(1, icon)) * -400, transform: `rotate(${(1 - icon) * 30}deg)`}}>
        <Icon size={isz} style={{boxShadow: toBar > 0.5 ? undefined : '0 24px 50px rgba(13,13,15,0.25)', borderRadius: isz * 0.24}} />
      </div>
      {toBar > 0.98 ? (
        <div style={{position: 'absolute', right: 70, top: 58, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderBottom: `16px solid ${C.ink}`, opacity: kf(f, [272, 280], [0, 1])}} />
      ) : null}
      <Flash at={0} len={10} max={0.9} color={C.red} />
    </Stage>
  );
};
