import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {Backdrop, C, clamp, Flash, Icon, kf, MONO, Pop, SANS, typed, useSpring} from '../ui';

// Bars 11–12. The bundle lands in the project; an agent reads it and fixes the bug.
// Then the tool names flash by on the eighth notes.

const Folder: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const fly = useSpring(0, {damping: 16, stiffness: 120});
  const bounce = f >= 22 ? Math.exp(-(f - 22) / 8) * Math.sin((f - 22) / 2.2) : 0;
  const toast = useSpring(22, {damping: 14, stiffness: 200});
  return (
    <div style={{position: 'absolute', left: 110, top: 270, width: 640}}>
      <div
        style={{
          padding: 36,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          fontFamily: MONO,
          fontSize: 28,
          color: '#fff',
          lineHeight: 2,
          transform: `scale(${1 + bounce * 0.03})`,
        }}
      >
        {d.folders.map((name, i) => {
          const last = i === d.folders.length - 1;
          const show = kf(f, [last ? 20 : 2 + i * 3, (last ? 20 : 2 + i * 3) + 8], [0, 1]);
          return (
            <div key={name} style={{paddingLeft: i * 34, opacity: show, display: 'flex', alignItems: 'center', gap: 14, color: last ? C.sky : i === 0 ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: last || i === 0 ? 700 : 400}}>
              <span style={{color: last ? C.sky : '#FFC542'}}>{last ? '◆' : '▸'}</span>
              {name}
              {i === 0 ? <span style={{fontFamily: SANS, fontSize: 22, color: 'rgba(255,255,255,0.45)', fontWeight: 400}}>你的项目</span> : null}
            </div>
          );
        })}
        <div style={{paddingLeft: 34, opacity: kf(f, [26, 34], [0, 1]), color: 'rgba(255,255,255,0.55)'}}>{d.latest}</div>
      </div>
      {/* the bundle flying in */}
      {f < 24 ? (
        <div
          style={{
            position: 'absolute',
            left: interpolate(fly, [0, 1], [-420, 420]),
            top: interpolate(fly, [0, 1], [420, 210]),
            transform: `scale(${interpolate(fly, [0, 1], [1.3, 0.4])}) rotate(${(1 - fly) * -25}deg)`,
            opacity: kf(f, [16, 24], [1, 0]),
          }}
        >
          <Icon size={140} style={{boxShadow: '0 20px 60px rgba(41,102,255,0.7)'}} />
        </div>
      ) : null}
      <div
        style={{
          marginTop: 30,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 28px',
          borderRadius: 999,
          background: 'rgba(61,220,151,0.14)',
          border: `1.5px solid ${C.green}`,
          color: '#fff',
          fontFamily: SANS,
          fontSize: 32,
          fontWeight: 700,
          opacity: interpolate(toast, [0, 0.3], [0, 1], clamp),
          transform: `translateY(${(1 - toast) * 30}px) scale(${0.8 + toast * 0.2})`,
        }}
      >
        <span style={{width: 34, height: 34, borderRadius: 17, background: C.green, color: '#06281A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900}}>✓</span>
        {d.toast}
      </div>
    </div>
  );
};

const Terminal: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const colors: Record<string, string> = {dim: 'rgba(255,255,255,0.55)', txt: '#E8ECF8', add: C.green, ok: C.green};
  const prompt = typed(d.prompt, f, 26, 52);
  return (
    <Pop at={6} y={60} style={{position: 'absolute', left: 840, top: 230, width: 980}}>
      <div style={{borderRadius: 24, overflow: 'hidden', background: '#0D0F17', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)'}}>
        <div style={{height: 52, background: '#171A25', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
          ))}
          <div style={{flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 18, color: 'rgba(255,255,255,0.5)', marginRight: 60}}>{d.termTitle}</div>
        </div>
        <div style={{padding: '30px 36px', fontFamily: MONO, fontSize: 27, lineHeight: 1.75, minHeight: 470}}>
          <div style={{color: '#fff'}}>
            <span style={{color: C.sky}}>› </span>
            {prompt}
            {f < 60 && Math.floor(f / 12) % 2 === 0 ? <span style={{color: C.sky}}>▌</span> : null}
          </div>
          <div style={{height: 14}} />
          {d.lines.map((l, i) => {
            const at = 58 + i * 9;
            const o = kf(f, [at, at + 6], [0, 1]);
            return (
              <div key={i} style={{color: colors[l.c], opacity: o, transform: `translateY(${(1 - o) * 10}px)`, fontWeight: l.c === 'ok' ? 700 : 400, whiteSpace: 'pre'}}>
                {l.t}
              </div>
            );
          })}
        </div>
      </div>
    </Pop>
  );
};

const Tools: React.FC = () => {
  // local 0 = bar 12
  const f = useCurrentFrame();
  const d = COPY.deliver;
  const step = 15;
  const idx = Math.min(d.tools.length - 1, Math.floor(f / step));
  const gather = useSpring(d.tools.length * step + 4, {damping: 16, stiffness: 140});
  const flashing = f < d.tools.length * step + 4;
  const local = f - idx * step;
  return (
    <AbsoluteFill>
      <Backdrop hue="blue" />
      <Pop at={0} y={20} style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: SANS, fontSize: 44, fontWeight: 700, color: 'rgba(255,255,255,0.85)'}}>{d.toolsHead}</div>
      </Pop>
      {flashing ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 210,
              letterSpacing: -6,
              color: '#fff',
              transform: `scale(${interpolate(local, [0, 6, 15], [1.18, 1, 0.97], clamp)})`,
              opacity: interpolate(local, [0, 3], [0.2, 1], clamp),
              textShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            {d.tools[idx]}
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 26, width: 1500}}>
            {d.tools.map((name, i) => (
              <div
                key={name}
                style={{
                  padding: '24px 44px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 58,
                  color: '#fff',
                  transform: `translateY(${(1 - gather) * (i % 2 ? 80 : -80)}px) scale(${0.85 + gather * 0.15})`,
                  opacity: gather,
                }}
              >
                {name}
              </div>
            ))}
            <div style={{padding: '24px 30px', fontFamily: SANS, fontWeight: 700, fontSize: 58, color: 'rgba(255,255,255,0.7)', opacity: gather}}>…</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const Deliver: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={120} layout="none">
      <AbsoluteFill>
        <Backdrop pulseAt={[22]} />
        <Folder />
        <Terminal />
      </AbsoluteFill>
    </Sequence>
    <Sequence from={120} layout="none">
      <Tools />
    </Sequence>
    <Flash at={120} len={10} max={0.5} />
  </AbsoluteFill>
);
