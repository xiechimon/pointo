import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, DISPLAY, ease, Flash, H, HAND, Icon, kf, MONO, Stage, useSpring} from '../ui';

// Bars 2–3. The hit: a red flood, "指给它看。" slams in, a black pen circles "它看" with a
// scribbled note. Bar 3: cut to paper, the icon drops in and "POINTO" in tall condensed type.

const CIRCLE = 'M 70 150 C 10 70, 120 8, 300 12 C 470 16, 560 80, 540 150 C 520 230, 330 262, 180 250 C 60 240, 0 190, 40 120';

export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.title;
  const slam = interpolate(f, [0, 8], [0, 1], {...clamp, easing: ease});
  const ring = interpolate(f, [16, 34], [0, 1], {...clamp, easing: Easing.bezier(0.3, 0.6, 0.3, 1)});
  const icon = useSpring(120, {damping: 13, stiffness: 160, mass: 0.8});
  const word = kf(f, [128, 146], [0, 1], ease);

  if (f < 120) {
    return (
      <AbsoluteFill style={{background: C.red}}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + f * 0.0022}) rotate(${-f * 0.012}deg) translateX(${-f * 0.5}px)`}}>
          <div style={{...H, fontSize: 72, color: C.ink, opacity: kf(f, [10, 22], [0, 1]), marginBottom: 6}}>{t.pre}</div>
          <div style={{position: 'relative', ...H, fontSize: 300, color: C.ink, whiteSpace: 'nowrap', transform: `scale(${1.5 - 0.5 * slam})`, opacity: slam}}>
            {t.main}
            {/* the pen circles 它看 */}
            <CameraMotionBlur samples={5} shutterAngle={180}>
              <AbsoluteFill style={{left: 560, top: -10, width: 600, height: 280}}>
                <svg viewBox="0 0 600 280" width={600} height={280} style={{overflow: 'visible'}}>
                  <path d={CIRCLE} pathLength={1} fill="none" stroke={C.ink} strokeWidth={12} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - ring} />
                </svg>
              </AbsoluteFill>
            </CameraMotionBlur>
            <div style={{position: 'absolute', right: -40, top: -150, fontFamily: HAND, fontWeight: 600, fontSize: 96, color: C.ink, transform: 'rotate(-8deg)', opacity: kf(f, [34, 42], [0, 1])}}>{t.note}</div>
          </div>
        </AbsoluteFill>
        <Flash at={0} len={8} max={0.8} color="#FFFFFF" />
      </AbsoluteFill>
    );
  }

  return (
    <Stage tone="paper">
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `scale(${1.06 - (f - 120) * 0.0011}) translateY(${(f - 120) * -0.25}px)`}}>
        <div style={{transform: `translateY(${(1 - icon) * -500 + Math.sin(f / 14) * 8}px) rotate(${(1 - icon) * -18 + Math.sin(f / 20) * 3}deg)`, marginTop: -150}}>
          <Icon size={210} style={{boxShadow: '0 30px 60px rgba(13,13,15,0.25)'}} />
        </div>
        <div style={{fontFamily: DISPLAY, fontSize: 300, lineHeight: 1, color: C.ink, letterSpacing: 4, marginTop: 30, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`}}>POINTO</div>
        <div style={{fontFamily: MONO, fontSize: 32, color: C.dim, marginTop: 26, opacity: kf(f, [170, 186], [0, 1])}}>{t.sub}</div>
      </AbsoluteFill>
    </Stage>
  );
};
