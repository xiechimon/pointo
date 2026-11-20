import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, clamp, ease, Fade, H, Icon, kf, MONO, Reveal, SANS, Stage, typed} from '../ui';

// Bars 11–12. The bundle (the glowing point from bar 10) shoots into the project; a
// terminal tilted in 3D reads it and fixes the bug. Then the tool names hit full
// screen, one per eighth note, with motion blur.

const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const colors: Record<string, string> = {dim: C.dim, txt: C.text, add: C.green, ok: C.green};
  const marks: Record<string, string> = {dim: '⏺ ', txt: '  ', add: '  ', ok: '✓ '};
  const fly = kf(f, [0, 20], [0, 1], ease);
  const ry = kf(f, [0, 120], [-16, -8], (x) => x);
  return (
    <Stage light={[60, 40]}>
      <AbsoluteFill>
        <div style={{position: 'absolute', left: -300, top: 100, width: 1200, height: 900, background: 'radial-gradient(closest-side, rgba(41,102,255,0.25), transparent)'}} />
      </AbsoluteFill>
      <Chapter n={5} label={COPY.chapters[4]} at={0} out={108} />
      <div style={{position: 'absolute', left: 140, top: 250, ...H, fontSize: 70}}>
        <Reveal at={2} out={108}>
          <span style={{color: C.text}}>{d.headA}</span>
        </Reveal>
        <Reveal at={8} out={108}>
          <span style={{color: C.dim}}>{d.headB}</span>
        </Reveal>
        <Fade at={22} out={108} y={10}>
          <div style={{marginTop: 46, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: MONO, fontSize: 24, color: C.dim, lineHeight: 1.7}}>
            {d.folders.map((name, i) => (
              <span key={name} style={{paddingLeft: i * 26, color: i === d.folders.length - 1 ? C.text : C.dim}}>
                {i === d.folders.length - 1 ? <span style={{color: C.red}}>● </span> : '› '}
                {name}
              </span>
            ))}
            <span style={{marginTop: 18, color: C.green, fontFamily: SANS, fontSize: 24}}>✓ {d.toast}</span>
          </div>
        </Fade>
      </div>

      {/* the bundle flying in from where the exploded files collapsed */}
      {f < 22 ? (
        <div style={{position: 'absolute', left: interpolate(fly, [0, 1], [1030, 210]), top: interpolate(fly, [0, 1], [570, 650]), transform: `scale(${1 - fly * 0.5})`, opacity: 1 - kf(f, [16, 22], [0, 1])}}>
          <Icon size={64} style={{boxShadow: '0 0 60px 20px rgba(41,102,255,0.6)'}} />
        </div>
      ) : null}

      <AbsoluteFill style={{perspective: 2000}}>
        <div style={{position: 'absolute', left: 960, top: 190, width: 860, transform: `rotateY(${ry}deg) rotateX(4deg)`, transformOrigin: '0% 50%'}}>
          <Fade at={6} y={40}>
            <div style={{borderRadius: 22, overflow: 'hidden', background: 'rgba(14,15,18,0.94)', border: `1px solid ${C.line}`, boxShadow: '0 60px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset'}}>
              <div style={{height: 46, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', borderBottom: `1px solid ${C.faint}`}}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: '#2C2D33'}} />
                ))}
                <div style={{flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 15, color: C.dim, marginRight: 50}}>{d.termTitle}</div>
              </div>
              <div style={{padding: '30px 34px', fontFamily: MONO, fontSize: 24, lineHeight: 1.9, minHeight: 560}}>
                <div style={{color: C.text}}>
                  <span style={{color: C.dim}}>› </span>
                  {typed(d.prompt, f, 22, 48)}
                  {f < 56 && Math.floor(f / 12) % 2 === 0 ? <span style={{color: C.dim}}>▌</span> : null}
                </div>
                <div style={{height: 14}} />
                {d.lines.map((l, i) => {
                  const at = 54 + i * 9;
                  const o = kf(f, [at, at + 8], [0, 1]);
                  return (
                    <div key={i} style={{color: colors[l.c], opacity: o, transform: `translateX(${(1 - o) * 14}px)`, whiteSpace: 'pre'}}>
                      <span style={{color: l.c === 'ok' ? C.green : C.dim}}>{marks[l.c]}</span>
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

const ToolName: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const idx = Math.min(d.tools.length - 1, Math.floor(f / STEP));
  const local = f - idx * STEP;
  // each name punches in from depth and slides slightly; alternate direction
  const dir = idx % 2 ? -1 : 1;
  const k = interpolate(local, [0, 7], [0, 1], {...clamp, easing: ease});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          ...H,
          fontWeight: 600,
          fontSize: 250,
          letterSpacing: '-0.045em',
          color: C.text,
          whiteSpace: 'nowrap',
          transform: `translateX(${(1 - k) * 260 * dir}px) scale(${1.25 - 0.25 * k + local * 0.002})`,
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
  const gather = kf(f, [end, end + 24], [0, 1], ease);
  return (
    <Stage light={[50, 50]}>
      <Chapter n={5} label={COPY.chapters[4]} at={0} />
      {f < end ? (
        <CameraMotionBlur samples={6} shutterAngle={220}>
          <ToolName />
        </CameraMotionBlur>
      ) : (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{fontFamily: SANS, fontSize: 28, color: C.dim, marginBottom: 54, opacity: gather}}>{d.toolsHead}</div>
          <div style={{display: 'flex', gap: 56, alignItems: 'baseline'}}>
            {d.tools.map((name, i) => (
              <div key={name} style={{...H, fontSize: 66, color: C.text, opacity: kf(f, [end + i * 3, end + 14 + i * 3], [0, 1]), transform: `translateY(${(1 - kf(f, [end + i * 3, end + 20 + i * 3], [0, 1], ease)) * 30}px)`}}>
                {name}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      )}
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
