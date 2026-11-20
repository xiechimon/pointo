import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, DISPLAY, ease, Flash, H, HAND, Icon, Ink, kf, MONO, SANS, Stage, UI, useSpring} from '../ui';

// Bars 15–17, the musical peak. The mark lands on the hit (30.0 s); the one call to action, the
// GitHub address, by 30.5 s; the shortcut keys land at 31.0 s; at 33.0 s the red pen circles the
// address. At 34.0 s (the button hit) everything clears and the icon flies up into a menu bar:
// "它就住在你的菜单栏里". Cut to black on the last note (35.5 s).

// 30.0–32.0 s: the payoff montage, one shot per beat, on the loudest bars.
const Montage: React.FC = () => {
  const f = useCurrentFrame();
  const shot = Math.min(3, Math.floor(f / 30));
  const t = f - shot * 30;
  const k = interpolate(t, [0, 8], [0, 1], {...clamp, easing: ease});
  const zoom = 1.12 - 0.12 * k + t * 0.002;
  if (shot === 0) {
    return (
      <AbsoluteFill style={{background: C.paper, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{position: 'relative', transform: `scale(${zoom})`}}>
          <div style={{padding: '40px 90px', borderRadius: 36, background: C.ink, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 120}}>{COPY.demo.save}</div>
          <Ink viewBox="0 0 700 300" style={{left: -120, top: -70, width: 940, height: 400}} d="M 640 70 C 700 20, 300 -10, 120 40 C 0 80, 10 250, 260 270 C 500 290, 700 240, 680 140 C 670 90, 610 60, 520 56" from={2} to={20} width={14} />
        </div>
      </AbsoluteFill>
    );
  }
  if (shot === 1) {
    return (
      <AbsoluteFill style={{background: C.lilac, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', gap: 60}}>
          {[1, 2, 3].map((n, i) => {
            const s = interpolate(t, [i * 6, i * 6 + 8], [0, 1], {...clamp, easing: ease});
            return (
              <div key={n} style={{width: 260, height: 260, borderRadius: 48, background: '#fff', boxShadow: '0 30px 60px rgba(60,40,140,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontSize: 200, color: C.ink, transform: `scale(${1.6 - 0.6 * s}) rotate(${(1 - s) * (i - 1) * 20}deg)`, opacity: s}}>
                {n}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }
  if (shot === 2) {
    return (
      <AbsoluteFill style={{background: C.ink, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontFamily: MONO, fontSize: 84, fontWeight: 700, color: '#7CE3A4', transform: `scale(${zoom})`, whiteSpace: 'nowrap'}}>✓ 已修复 Form.tsx</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{background: C.red, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...H, fontSize: 300, color: C.ink, transform: `scale(${1.4 - 0.4 * k + t * 0.002})`, whiteSpace: 'nowrap'}}>{COPY.title.main}</div>
    </AbsoluteFill>
  );
};

export const End: React.FC = () => {
  const ff = useCurrentFrame();
  if (ff < 120)
    return (
      <AbsoluteFill>
        <Montage />
        <Flash at={0} len={8} max={0.7} color="#FFFFFF" />
      </AbsoluteFill>
    );
  return <Card />;
};

const Card: React.FC = () => {
  const f = useCurrentFrame() - 120; // the card lands at 32.0 s
  const d = COPY.end;
  const icon = useSpring(120, {damping: 12, stiffness: 180, mass: 0.8});
  const push = kf(f, [0, 240], [1, 1.04], (x) => x);
  const cta = kf(f, [10, 22], [0, 1], ease);
  const hit = f >= 120 ? Math.exp(-(f - 120) / 12) : 0; // the button hit at 34.0 s

  return (
    <Stage tone="paper" light={[50, 45]}>
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        <AbsoluteFill style={{alignItems: 'center', paddingTop: 410}}>
          <div style={{overflow: 'hidden', paddingBottom: 6}}>
            <div style={{fontFamily: DISPLAY, fontSize: 250, lineHeight: 1, color: C.ink, letterSpacing: 4, transform: `translateY(${(1 - kf(f, [0, 14], [0, 1], ease)) * 105}%)`}}>POINTO</div>
          </div>
          <div style={{...H, fontSize: 64, marginTop: 18, opacity: kf(f, [4, 14], [0, 1]), transform: `translateY(${(1 - kf(f, [4, 16], [0, 1], ease)) * 20}px)`}}>
            <span style={{color: C.ink}}>指给 AI 看，</span>
            <span style={{color: C.red}}>而不是讲给它听。</span>
          </div>
          <div style={{position: 'relative', marginTop: 50, opacity: cta, transform: `translateY(${(1 - cta) * 30}px)`}}>
            <div style={{padding: '22px 48px', borderRadius: 24, background: C.ink, color: C.text, fontFamily: UI, fontWeight: 700, fontSize: 64, letterSpacing: -0.5}}>{d.url}</div>
            <Ink viewBox="0 0 1000 200" style={{left: -70, top: -24, width: 1180, height: 196}} d="M 930 40 C 1010 6, 480 -10, 140 20 C 0 36, -10 170, 180 186 C 470 206, 950 196, 990 140 C 1016 100, 960 56, 860 46" from={40} to={62} width={8} />
          </div>
          <div style={{position: 'relative', marginTop: 44, height: 60, width: 1200, textAlign: 'center'}}>
            <div style={{position: 'absolute', inset: 0, fontFamily: MONO, fontSize: 40, color: '#3A3A3E', opacity: kf(f, [30, 42], [0, 1])}}>{d.platforms}</div>
          </div>
        </AbsoluteFill>
        <div style={{position: 'absolute', left: 190, top: 640, fontFamily: HAND, fontWeight: 600, fontSize: 84, color: C.red, transform: 'rotate(-10deg)', opacity: kf(f, [58, 68], [0, 1])}}>{COPY.title.note}</div>
      </AbsoluteFill>

      <div style={{position: 'absolute', left: 960 - 80, top: 320 - 80 + (1 - Math.min(1, icon)) * -400, transform: `rotate(${(1 - icon) * 30}deg) scale(${1 + hit * 0.08})`}}>
        <Icon size={160} style={{boxShadow: '0 24px 50px rgba(13,13,15,0.25)'}} />
      </div>
      <Flash at={120} len={8} max={0.5} color="#FFFFFF" />
    </Stage>
  );
};
