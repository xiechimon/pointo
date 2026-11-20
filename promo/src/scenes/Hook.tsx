import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, Fade, H, Ink, kf, Reveal, SANS, Stage, typed} from '../ui';

// Bars 0–1. Editorial headline on the left, a real-looking chat on the right where
// the AI misses; the red pen then circles "说不清" — the film's one accent arrives.
const SEND = 104;

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = COPY.hook;
  const sent = f >= SEND;
  const input = sent ? '' : typed(t.user, f, 30, 98);
  const aiTyping = f >= SEND + 14 && f < SEND + 36;
  const aiText = typed(t.ai, f, SEND + 36, SEND + 70);
  const drift = kf(f, [0, 240], [0, -14], (x) => x);

  return (
    <Stage light={[70, 40]}>
      <Chapter n={1} label={COPY.chapters[0]} out={220} />
      <AbsoluteFill style={{transform: `translateY(${drift}px)`}}>
        <div style={{position: 'absolute', left: 160, top: 360, ...H, fontSize: 84, color: C.text}}>
          <Reveal at={6} out={222}>{t.l1}</Reveal>
          <Reveal at={14} out={224}>
            <span style={{color: C.dim}}>
              {t.l2a}
              <span style={{position: 'relative', color: C.dim}}>
                {t.l2b}
                <Ink viewBox="0 0 252 100" style={{width: 252, height: 100, left: 0, top: 0}} d="M 20 70 C -10 30, 60 -4, 160 4 C 250 10, 278 60, 226 88 C 170 112, 40 108, 10 78 C -2 64, 6 46, 26 34" from={180} to={212} width={4} />
              </span>
              {t.l2c}
            </span>
          </Reveal>
        </div>

        {/* chat */}
        <Fade at={22} out={224} y={40} style={{position: 'absolute', left: 1080, top: 330, width: 680}}>
          <div
            style={{
              minHeight: 380,
              borderRadius: 28,
              background: 'linear-gradient(180deg, #16171B 0%, #111215 100%)',
              border: `1px solid ${C.line}`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 80px rgba(0,0,0,0.5)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              gap: 18,
              fontFamily: SANS,
              fontSize: 25,
              lineHeight: 1.55,
            }}
          >
            {sent ? (
              <Fade at={SEND} y={16} dur={20} style={{alignSelf: 'flex-end', maxWidth: 520}}>
                <div style={{background: '#26272D', color: C.text, padding: '14px 20px', borderRadius: 18}}>{t.user}</div>
              </Fade>
            ) : null}
            {f >= SEND + 14 ? (
              <Fade at={SEND + 14} y={12} dur={20} style={{alignSelf: 'flex-start', maxWidth: 560}}>
                <div style={{color: '#C9CAD0', padding: '6px 4px', minHeight: 40}}>
                  {aiTyping ? (
                    <span style={{letterSpacing: 6, color: C.dim}}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{opacity: 0.3 + 0.7 * Math.max(0, Math.sin((f - i * 5) / 4))}}>●</span>
                      ))}
                    </span>
                  ) : (
                    aiText
                  )}
                </div>
              </Fade>
            ) : null}
            <div
              style={{
                marginTop: 8,
                minHeight: 64,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.line}`,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px 10px 20px',
                color: input ? C.text : C.dim,
                gap: 12,
              }}
            >
              <span style={{flex: 1}}>
                {input || t.placeholder}
                {input && Math.floor(f / 15) % 2 === 0 ? <span style={{color: C.text}}>|</span> : null}
              </span>
              <div style={{width: 40, height: 40, borderRadius: 20, background: input ? C.text : 'rgba(255,255,255,0.1)', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0}}>↑</div>
            </div>
          </div>
        </Fade>
      </AbsoluteFill>
    </Stage>
  );
};
