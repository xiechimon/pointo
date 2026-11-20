import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, DISPLAY, ease, Flash, H, HAND, Icon, kf, MONO, Rise, SANS, Stage, useSpring} from '../ui';

// Bars 2–3. The hit: a red flood, "指给它看。" slams in, a black pen circles "它看" with a
// scribbled note. Bar 3: cut to paper, the icon drops in and "POINTO" in tall condensed type.

const CIRCLE = 'M 84 260 C 10 117, 147 13, 368 18 C 588 23, 724 130, 701 260 C 676 403, 441 468, 242 447 C 84 429, 0 351, 52 221';

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
          <div style={{...H, fontSize: 72, color: C.ink, opacity: kf(f, [10, 22], [0, 1]), marginBottom: 120}}>{t.pre}</div>
          <div style={{position: 'relative', ...H, fontSize: 300, color: C.ink, whiteSpace: 'nowrap', transform: `scale(${1.5 - 0.5 * slam})`, opacity: slam}}>
            {t.main}
            {/* the pen circles 它看 */}
            <CameraMotionBlur samples={5} shutterAngle={180}>
              <AbsoluteFill style={{left: 530, top: -90, width: 740, height: 500}}>
                <svg viewBox="0 0 740 500" width={740} height={500} style={{overflow: 'visible'}}>
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

  // 7.0 s: the mark moves up and the shortcut takes the stage (no dead logo hold)
  const up = kf(f, [180, 204], [0, 1], ease);
  return (
    <Stage tone="paper">
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `translateY(${-up * 300}px) scale(${(1.06 - (f - 120) * 0.0009) * (1 - up * 0.45)})`}}>
        <div style={{transform: `translateY(${(1 - icon) * -500 + Math.sin(f / 14) * 8}px) rotate(${(1 - icon) * -18 + Math.sin(f / 20) * 3}deg)`, marginTop: -150}}>
          <Icon size={210} style={{boxShadow: '0 30px 60px rgba(13,13,15,0.25)'}} />
        </div>
        <div style={{overflow: 'hidden', paddingBottom: 6, marginTop: 30}}>
          <div style={{fontFamily: DISPLAY, fontSize: 300, lineHeight: 1, color: C.ink, letterSpacing: 4, transform: `translateY(${(1 - kf(f, [126, 142], [0, 1], ease)) * 105}%)`}}>POINTO</div>
        </div>
        <div style={{fontFamily: MONO, fontSize: 32, color: C.dim, marginTop: 26, opacity: kf(f, [150, 166], [0, 1]) * (1 - up)}}>{t.sub}</div>
      </AbsoluteFill>
      {f >= 186 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: 260}}>
          <div style={{display: 'flex', gap: 22}}>
            {['⌥', '⇧', 'S'].map((k, i) => {
              const s = kf(f, [186 + i * 5, 200 + i * 5], [0, 1], ease);
              return (
                <div key={k} style={{width: 150, height: 150, borderRadius: 28, background: C.card, boxShadow: '0 8px 0 #C9C9C4, 0 24px 40px rgba(13,13,15,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 72, color: C.ink, transform: `translateY(${(1 - s) * 80}px)`, opacity: s}}>
                  {k}
                </div>
              );
            })}
          </div>
          <div style={{marginTop: 40, ...H, fontSize: 60, color: C.ink, opacity: kf(f, [200, 214], [0, 1])}}>{t.keys}</div>
        </AbsoluteFill>
      ) : null}
    </Stage>
  );
};
