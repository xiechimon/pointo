import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Cursor, DISPLAY, ease, Flash, H, HAND, Icon, Ink, kf, MONO, SANS, Stage, UI, useSpring} from '../ui';
import {Desktop} from './Desktop';

// Bars 15–17. The drop: a "launch-day group photo". Everything the film showed flies in from
// every side and lands around the wordmark — a keyframe slice, the caption, the ink, the keys,
// the terminal's fix, the manifest, the waveform — while the camera eases back.

type Piece = {at: number; x: number; y: number; r: number; from: [number, number]; el: React.ReactNode};

const card: React.CSSProperties = {background: C.card, borderRadius: 22, boxShadow: '0 24px 60px rgba(13,13,15,0.16)'};

const PIECES: Piece[] = [
  {
    at: 12, x: 90, y: 90, r: -6, from: [-900, -300],
    el: (
      <div style={{...card, width: 440, height: 260, padding: 10}}>
        <div style={{position: 'relative', width: 420, height: 240, borderRadius: 14, overflow: 'hidden'}}>
          <div style={{position: 'absolute', transform: 'scale(0.328) translate(-640px, -110px)', transformOrigin: '0 0'}}>
            <Desktop t={444} showChips={false} />
          </div>
          <div style={{position: 'absolute', left: 10, top: 10, width: 38, height: 38, borderRadius: 9, background: C.red, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>2</div>
        </div>
      </div>
    ),
  },
  {
    at: 21, x: 1210, y: 100, r: 3, from: [900, -500],
    el: (
      <div style={{padding: '18px 30px', borderRadius: 24, background: C.ink, color: C.text, fontFamily: SANS, fontWeight: 700, fontSize: 36, display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap'}}>
        <span style={{width: 12, height: 12, borderRadius: 6, background: C.red}} />
        {COPY.demo.quote}
      </div>
    ),
  },
  {
    at: 30, x: 1480, y: 330, r: -4, from: [800, 0],
    el: (
      <div style={{position: 'relative', width: 340, height: 160}}>
        <div style={{position: 'absolute', left: 60, top: 52, padding: '12px 26px', borderRadius: 12, background: C.ink, color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 30}}>{COPY.demo.save}</div>
        <Ink viewBox="0 0 340 160" d="M 300 40 C 330 10, 120 0, 50 30 C 0 60, 20 130, 120 140 C 230 150, 320 120, 310 70 C 305 50, 280 38, 240 36" from={30} to={52} width={6} />
        <div style={{position: 'absolute', right: -40, top: -50, fontFamily: HAND, fontWeight: 600, fontSize: 60, color: C.red, transform: 'rotate(-8deg)'}}>{COPY.title.note}</div>
      </div>
    ),
  },
  {
    at: 39, x: 1410, y: 770, r: 4, from: [700, 600],
    el: (
      <div style={{padding: '22px 30px', borderRadius: 20, background: C.ink, fontFamily: MONO, fontSize: 28, color: C.text, lineHeight: 1.6}}>
        <div style={{color: 'rgba(244,244,242,0.45)'}}>+ 绑定 onSubmit</div>
        <div style={{color: '#7CE3A4', fontWeight: 700}}>✓ 已修复</div>
      </div>
    ),
  },
  {
    at: 48, x: 120, y: 790, r: 5, from: [-700, 600],
    el: (
      <div style={{display: 'flex', gap: 12, padding: 16, borderRadius: 24, background: C.ink}}>
        {['⌥', '⇧', 'S'].map((k) => (
          <div key={k} style={{width: 76, height: 76, borderRadius: 14, background: '#fff', boxShadow: '0 4px 0 #B9B9B4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 36, color: C.ink}}>{k}</div>
        ))}
      </div>
    ),
  },
  {
    at: 57, x: 70, y: 450, r: 6, from: [-800, 0],
    el: (
      <div style={{...card, padding: '20px 26px', fontFamily: MONO, fontSize: 24, color: C.dim, lineHeight: 1.55, whiteSpace: 'pre'}}>
        <div style={{color: C.ink, marginBottom: 4}}>pointo.json</div>
        {'"keyframes": 3,\n"type": "click",\n"target": "保存更改"'}
      </div>
    ),
  },
  {
    at: 64, x: 720, y: 70, r: -2, from: [0, -500],
    el: (
      <div style={{display: 'flex', gap: 6, alignItems: 'center', padding: '16px 24px', borderRadius: 999, background: C.lilac}}>
        {Array.from({length: 22}).map((_, i) => (
          <div key={i} style={{width: 7, height: 10 + 30 * Math.abs(Math.sin(i * 1.3)), borderRadius: 4, background: C.ink}} />
        ))}
      </div>
    ),
  },
];

const Flyer: React.FC<{p: Piece}> = ({p}) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [p.at, p.at + 18], [0, 1], {...clamp, easing: ease});
  if (k <= 0) return null;
  const bob = Math.sin((f + p.at * 7) / 40) * 6;
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x + p.from[0] * (1 - k),
        top: p.y + p.from[1] * (1 - k) + bob,
        transform: `rotate(${p.r * k + (1 - k) * p.r * 4}deg) scale(${0.85 + 0.15 * k})`,
      }}
    >
      {p.el}
    </div>
  );
};

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const d = COPY.end;
  const icon = useSpring(2, {damping: 12, stiffness: 170, mass: 0.8});
  const word = kf(f, [6, 26], [0, 1], ease);
  const cam = kf(f, [0, 360], [1.08, 1], (x) => x);
  const fadeOut = kf(f, [330, 360], [0, 1]);
  const cur = {x: kf(f, [80, 110], [1800, 1290], ease), y: kf(f, [80, 110], [1000, 610], ease)};

  return (
    <Stage tone="paper" light={[50, 45]}>
      <AbsoluteFill style={{transform: `scale(${cam})`}}>
        {PIECES.map((p, i) => (
          <Flyer key={i} p={p} />
        ))}

        <AbsoluteFill style={{alignItems: 'center', paddingTop: 255}}>
          <div style={{transform: `scale(${icon}) rotate(${(1 - icon) * 30}deg)`}}>
            <Icon size={150} style={{boxShadow: '0 24px 50px rgba(13,13,15,0.25)'}} />
          </div>
          <div style={{fontFamily: DISPLAY, fontSize: 250, lineHeight: 1, color: C.ink, letterSpacing: 4, marginTop: 18, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`}}>POINTO</div>
          <div style={{...H, fontSize: 60, marginTop: 20, opacity: kf(f, [20, 34], [0, 1]), transform: `translateY(${(1 - kf(f, [20, 40], [0, 1], ease)) * 20}px)`}}>
            <span style={{color: C.ink}}>指给 AI 看，</span>
            <span style={{color: C.red}}>而不是讲给它听。</span>
          </div>
          <div style={{display: 'flex', gap: 18, marginTop: 44, opacity: kf(f, [40, 54], [0, 1])}}>
            <div style={{padding: '18px 36px', borderRadius: 16, background: C.ink, color: C.text, fontFamily: SANS, fontWeight: 700, fontSize: 34}}>{d.mac}</div>
            <div style={{padding: '18px 36px', borderRadius: 16, border: `3px solid ${C.ink}`, color: C.ink, fontFamily: SANS, fontWeight: 700, fontSize: 34}}>{d.win}</div>
          </div>
          <div style={{marginTop: 30, fontFamily: UI, fontWeight: 600, fontSize: 36, color: C.dim, opacity: kf(f, [52, 66], [0, 1])}}>{d.url}</div>
        </AbsoluteFill>
        {f >= 80 ? <Cursor x={cur.x} y={cur.y} scale={1.6} press={f >= 112 && f < 122 ? 1 - (f - 112) / 10 : 0} /> : null}
      </AbsoluteFill>
      <Flash at={0} len={10} max={0.9} color={C.red} />
      <AbsoluteFill style={{background: C.ink, opacity: fadeOut}} />
    </Stage>
  );
};

