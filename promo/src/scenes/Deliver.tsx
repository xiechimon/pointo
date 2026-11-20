import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, Chapter, Fade, H, Icon, kf, MONO, Reveal, SANS, Stage, typed} from '../ui';

// Bars 11–12. The bundle lands in the project, an agent reads it and fixes the bug;
// then the tool names light up one per eighth note.

const Finder: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const fly = kf(f, [0, 22], [0, 1]);
  return (
    <div style={{position: 'absolute', left: 160, top: 470, width: 600}}>
      <Fade at={2} y={20}>
        <div style={{borderRadius: 18, background: C.bg2, border: `1px solid ${C.line}`, padding: '22px 26px', fontFamily: MONO, fontSize: 21, lineHeight: 2, color: C.text}}>
          {d.folders.map((name, i) => {
            const last = i === d.folders.length - 1;
            const o = kf(f, last ? [20, 30] : [4 + i * 3, 14 + i * 3], [0, 1]);
            return (
              <div key={name} style={{paddingLeft: i * 28, opacity: o, color: last ? C.text : i === 0 ? C.text : C.dim, display: 'flex', alignItems: 'center', gap: 12}}>
                <span style={{color: last ? C.red : '#5A5B62'}}>{last ? '●' : '›'}</span>
                {name}
              </div>
            );
          })}
          <div style={{paddingLeft: 28, opacity: kf(f, [28, 38], [0, 1]), color: C.dim}}>
            <span style={{color: '#5A5B62'}}>› </span>
            {d.latest} <span style={{color: '#5A5B62'}}>→</span> pointo-1794650000000
          </div>
        </div>
      </Fade>
      {f < 26 ? (
        <div style={{position: 'absolute', left: kf(f, [0, 22], [-300, 300]), top: kf(f, [0, 22], [-260, 150]), opacity: 1 - kf(f, [16, 24], [0, 1]), transform: `scale(${1 - fly * 0.6})`}}>
          <Icon size={96} style={{boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}} />
        </div>
      ) : null}
      <Fade at={24} y={10} dur={20}>
        <div style={{marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: SANS, fontSize: 22, color: C.text}}>
          <span style={{color: C.green}}>✓</span>
          {d.toast}
        </div>
      </Fade>
    </div>
  );
};

const Terminal: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const colors: Record<string, string> = {dim: C.dim, txt: C.text, add: C.green, ok: C.green};
  const marks: Record<string, string> = {dim: '⏺ ', txt: '  ', add: '  ', ok: '✓ '};
  return (
    <Fade at={8} y={40} style={{position: 'absolute', left: 860, top: 210, width: 900}}>
      <div style={{borderRadius: 18, overflow: 'hidden', background: '#0E0F12', border: `1px solid ${C.line}`, boxShadow: '0 50px 100px rgba(0,0,0,0.6)'}}>
        <div style={{height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: `1px solid ${C.faint}`}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: '#2C2D33'}} />
          ))}
          <div style={{flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 15, color: C.dim, marginRight: 50}}>{d.termTitle}</div>
        </div>
        <div style={{padding: '26px 30px', fontFamily: MONO, fontSize: 22, lineHeight: 1.85, minHeight: 420}}>
          <div style={{color: C.text}}>
            <span style={{color: C.dim}}>› </span>
            {typed(d.prompt, f, 24, 50)}
            {f < 58 && Math.floor(f / 12) % 2 === 0 ? <span style={{color: C.dim}}>▌</span> : null}
          </div>
          <div style={{height: 12}} />
          {d.lines.map((l, i) => {
            const at = 56 + i * 9;
            const o = kf(f, [at, at + 8], [0, 1]);
            return (
              <div key={i} style={{color: colors[l.c], opacity: o, whiteSpace: 'pre'}}>
                <span style={{color: l.c === 'ok' ? C.green : C.dim}}>{marks[l.c]}</span>
                {l.t}
              </div>
            );
          })}
        </div>
      </div>
    </Fade>
  );
};

const Tools: React.FC = () => {
  // local 0 = bar 12; one name lights per eighth note (15 frames)
  const f = useCurrentFrame();
  const d = COPY.deliver;
  return (
    <Stage light={[50, 50]}>
      <Chapter n={5} label={COPY.chapters[4]} at={0} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Fade at={0} y={10}>
          <div style={{fontFamily: SANS, fontSize: 26, color: C.dim, textAlign: 'center', marginBottom: 56}}>{d.toolsHead}</div>
        </Fade>
        <div style={{display: 'flex', gap: 64, alignItems: 'baseline'}}>
          {d.tools.map((name, i) => {
            const on = kf(f, [8 + i * 15, 16 + i * 15], [0, 1]);
            const all = kf(f, [92, 110], [0, 1]);
            return (
              <div
                key={name}
                style={{
                  ...H,
                  fontSize: 64,
                  color: on > 0.5 ? C.text : '#3A3B40',
                  opacity: 0.35 + on * 0.65,
                  transform: `translateY(${(1 - on) * 8}px)`,
                  filter: on < 1 && on > 0 ? `blur(${(1 - on) * 4}px)` : undefined,
                  textShadow: on > 0 && all < 1 && f < 16 + i * 15 + 14 ? '0 0 30px rgba(255,255,255,0.35)' : undefined,
                }}
              >
                {name}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

export const Deliver: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={120} layout="none">
      <Stage light={[30, 30]}>
        <Chapter n={5} label={COPY.chapters[4]} at={0} out={108} />
        <div style={{position: 'absolute', left: 160, top: 210, ...H, fontSize: 64}}>
          <Reveal at={0} out={108}>
            <span style={{color: C.text}}>{COPY.deliver.headA}</span>
          </Reveal>
          <Reveal at={6} out={108}>
            <span style={{color: C.dim}}>{COPY.deliver.headB}</span>
          </Reveal>
        </div>
        <Finder />
        <Terminal />
      </Stage>
    </Sequence>
    <Sequence from={120} layout="none">
      <Tools />
    </Sequence>
  </AbsoluteFill>
);
