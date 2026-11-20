import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, clamp, kf, Pop, SANS, typed, useSpring} from '../ui';

// Bars 0–1: someone tries to describe a UI bug to an AI in words, and it misses.
const SEND = 112;

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.hook;
  const sent = f >= SEND;
  const userSpring = useSpring(SEND, {damping: 16, stiffness: 200, mass: 0.8});
  const aiSpring = useSpring(SEND + 16);
  const punch = useSpring(186, {damping: 10, stiffness: 260, mass: 0.7});
  const shake = f >= 186 && f < 206 ? Math.sin(f * 2.3) * (206 - f) * 0.9 : 0;
  const dimCard = kf(f, [180, 196], [1, 0.25]);
  const camera = kf(f, [0, 240], [1.04, 1.12]);
  const caret = Math.floor(f / 15) % 2 === 0;

  const inputText = sent ? '' : typed(t.user, f, 8, 100);
  const aiTyping = f >= SEND + 16 && f < SEND + 40;
  const aiText = typed(t.ai, f, SEND + 40, SEND + 66);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{transform: `scale(${camera}) translateX(${shake}px)`, alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 1180,
            height: 660,
            borderRadius: 36,
            background: 'rgba(16,20,36,0.92)',
            border: '1.5px solid rgba(255,255,255,0.10)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 28,
            fontFamily: SANS,
            opacity: dimCard,
            filter: dimCard < 1 ? `blur(${(1 - dimCard) * 10}px)` : undefined,
          }}
        >
          {sent ? (
            <div style={{alignSelf: 'flex-end', transform: `translateY(${(1 - userSpring) * 60}px)`, opacity: userSpring}}>
              <div style={{background: C.blue, color: '#fff', fontSize: 38, fontWeight: 500, padding: '22px 30px', borderRadius: '28px 28px 8px 28px', maxWidth: 820, lineHeight: 1.45}}>
                {t.user}
              </div>
            </div>
          ) : null}
          {f >= SEND + 16 ? (
            <div style={{alignSelf: 'flex-start', display: 'flex', gap: 20, alignItems: 'flex-start', opacity: aiSpring, transform: `translateY(${(1 - aiSpring) * 40}px)`}}>
              <div style={{width: 60, height: 60, borderRadius: 30, background: 'linear-gradient(135deg,#8892B0,#4A5270)', flexShrink: 0}} />
              <div style={{background: 'rgba(255,255,255,0.08)', color: '#E8ECF8', fontSize: 38, padding: '22px 30px', borderRadius: '8px 28px 28px 28px', minWidth: 120, lineHeight: 1.45}}>
                {aiTyping ? (
                  <span style={{letterSpacing: 10}}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{opacity: 0.35 + 0.65 * Math.max(0, Math.sin((f - i * 5) / 4))}}>●</span>
                    ))}
                  </span>
                ) : (
                  aiText
                )}
              </div>
            </div>
          ) : null}
          <div
            style={{
              marginTop: 12,
              height: 96,
              borderRadius: 26,
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 32px',
              fontSize: 36,
              color: inputText ? '#fff' : 'rgba(255,255,255,0.35)',
            }}
          >
            <span style={{flex: 1}}>
              {inputText || t.placeholder}
              {!sent && inputText && caret ? <span style={{color: C.sky}}>|</span> : null}
            </span>
            <div style={{width: 58, height: 58, borderRadius: 29, background: inputText ? C.blue : 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30}}>↑</div>
          </div>
        </div>
      </AbsoluteFill>

      {f >= 186 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 260,
              color: '#fff',
              letterSpacing: -6,
              transform: `scale(${interpolate(punch, [0, 1], [1.6, 1])}) translateX(${shake * 1.5}px)`,
              opacity: interpolate(punch, [0, 0.25], [0, 1], clamp),
              textShadow: '0 20px 80px rgba(0,0,0,0.6)',
            }}
          >
            {t.punch}
          </div>
        </AbsoluteFill>
      ) : null}
      <Pop at={8} out={100} y={20} style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: SANS, fontSize: 30, color: C.dim, letterSpacing: 4}}>{t.lead}</span>
      </Pop>
    </AbsoluteFill>
  );
};
