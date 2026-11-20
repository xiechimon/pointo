import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, DISPLAY, ease, Fade, FG, GROUND, H, Icon, kf, MONO, Reveal, SANS, Stage, Tone, typed} from '../ui';

// Bars 11–12. On the AI's lilac: the bundle shoots into the project and a terminal reads it
// and fixes the bug. Then the tool names hit full screen on the eighths, each on its own
// colour field, and gather into one row.

const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const colors: Record<string, string> = {dim: 'rgba(244,244,242,0.55)', txt: C.text, add: '#7CE3A4', ok: '#7CE3A4'};
  const marks: Record<string, string> = {dim: '⏺ ', txt: '  ', add: '  ', ok: '✓ '};
  const fly = kf(f, [0, 20], [0, 1], ease);
  const ry = kf(f, [0, 120], [-8, -3], (x) => x);
  return (
    <Stage tone="lilac" light={[25, 30]}>
      <div style={{position: 'absolute', left: 110, top: 210, ...H, fontSize: 84}}>
        <Reveal at={2}>
          <span style={{color: C.ink}}>{d.headA}</span>
        </Reveal>
        <Reveal at={8}>
          <span style={{color: '#4B2BD6'}}>{d.headB}</span>
        </Reveal>
        <Fade at={18} y={14}>
          <div style={{marginTop: 50, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: MONO, fontSize: 38, lineHeight: 1.6, letterSpacing: 0}}>
            {d.folders.map((name, i) => (
              <span key={name} style={{paddingLeft: i * 30, color: i === d.folders.length - 1 ? C.ink : 'rgba(13,13,15,0.6)'}}>
                {i === d.folders.length - 1 ? <span style={{color: C.red}}>● </span> : '› '}
                {name}
              </span>
            ))}
          </div>
        </Fade>
        <Fade at={24} y={10} dur={18}>
          <div style={{marginTop: 30, display: 'inline-flex', alignItems: 'center', gap: 14, padding: '14px 26px', borderRadius: 18, background: C.ink, color: C.text, fontFamily: SANS, fontWeight: 700, fontSize: 38, letterSpacing: 0}}>
            <span style={{color: '#7CE3A4'}}>✓</span>
            {d.toast}
          </div>
        </Fade>
      </div>


      <AbsoluteFill style={{perspective: 2000}}>
        <div style={{position: 'absolute', left: 800, top: 200, width: 1040, transform: `rotateY(${ry}deg) rotateX(3deg) scale(${1 + kf(f, [60, 110], [0, 0.06])})`, transformOrigin: '0% 50%'}}>
          <Fade at={0} y={40} dur={14}>
            <div style={{borderRadius: 26, overflow: 'hidden', background: C.ink, boxShadow: '0 60px 120px rgba(40,20,120,0.35)'}}>
              <div style={{height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
                {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
                  <div key={c} style={{width: 13, height: 13, borderRadius: 7, background: c}} />
                ))}
                <div style={{flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 20, color: 'rgba(244,244,242,0.5)', marginRight: 50}}>{d.termTitle}</div>
              </div>
              <div style={{padding: '34px 40px', fontFamily: MONO, fontSize: 36, lineHeight: 1.7}}>
                <div style={{color: C.text}}>
                  <span style={{color: C.lilac}}>› </span>
                  {typed(d.prompt, f, 0, 22)}
                  {f < 30 && Math.floor(f / 12) % 2 === 0 ? <span style={{color: C.lilac}}>▌</span> : null}
                </div>
                <div style={{height: 16}} />
                {d.lines.map((l, i) => {
                  const at = 24 + i * 9;
                  const o = kf(f, [at, at + 8], [0, 1]);
                  return (
                    <div key={i} style={{color: colors[l.c], opacity: o, transform: `translateX(${(1 - o) * 14}px) scale(${l.c === 'add' ? 1 + kf(f, [at + 6, at + 16], [0, 0.06], ease) : 1})`, transformOrigin: '0% 50%', whiteSpace: 'pre', fontWeight: l.c === 'ok' || l.c === 'add' ? 700 : 400, background: l.c === 'add' ? `linear-gradient(90deg, rgba(124,227,164,0.22) ${kf(f, [at + 4, at + 20], [0, 100])}%, transparent ${kf(f, [at + 4, at + 20], [0, 100])}%)` : undefined, borderRadius: 8, margin: l.c === 'add' ? '6px -10px' : undefined, padding: l.c === 'add' ? '2px 10px' : undefined}}>
                      <span style={{color: l.c === 'ok' ? '#7CE3A4' : 'rgba(244,244,242,0.4)'}}>{marks[l.c]}</span>
                      {l.t}
                    </div>
                  );
                })}
              </div>
            </div>
          </Fade>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

const STEP = 15;
const FIELDS: Tone[] = ['ink', 'red', 'paper', 'lilac', 'ink'];

const ToolName: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const idx = Math.min(d.tools.length - 1, Math.floor(f / STEP));
  const local = f - idx * STEP;
  const dir = idx % 2 ? -1 : 1;
  const k = interpolate(local, [0, 6], [0, 1], {...clamp, easing: ease});
  const tone = FIELDS[idx];
  return (
    <AbsoluteFill style={{background: GROUND[tone], alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: Math.min(330, 1600 / (d.tools[idx].length * 0.56)),
          lineHeight: 1,
          letterSpacing: 2,
          color: FG[tone],
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          transform: `translateX(${(1 - k) * 300 * dir}px) scale(${1.2 - 0.2 * k + local * 0.003})`,
        }}
      >
        {d.tools[idx]}
      </div>
    </AbsoluteFill>
  );
};

const Tools: React.FC = () => {
  // local 0 = bar 12
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const end = d.tools.length * STEP;
  return f < end ? (
    <CameraMotionBlur samples={6} shutterAngle={220}>
      <ToolName />
    </CameraMotionBlur>
  ) : (
    <Stage tone="paper">
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Fade at={end} y={10} dur={18}>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 48, color: C.dim, marginBottom: 50, textAlign: 'center'}}>{d.toolsHead}</div>
        </Fade>
        <div style={{display: 'flex', gap: 44, alignItems: 'baseline'}}>
          {d.tools.map((name, i) => (
            <div
              key={name}
              style={{
                fontFamily: DISPLAY,
                fontSize: 86,
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                color: i === 0 ? C.red : C.ink,
                opacity: kf(f, [end + i * 3, end + 12 + i * 3], [0, 1]),
                transform: `translateY(${(1 - kf(f, [end + i * 3, end + 20 + i * 3], [0, 1], ease)) * 40}px)`,
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

export const Deliver: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={120} layout="none">
      <Fix />
    </Sequence>
    <Sequence from={120} layout="none">
      <Tools />
    </Sequence>
  </AbsoluteFill>
);
