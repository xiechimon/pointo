import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, ease, Fade, H, Key, kf, MONO, Reveal, SANS, Stage} from '../ui';
import {Desktop, KEYFRAMES} from './Desktop';

// Bars 4–10 (840 frames). A screen floating in 3D. ⌥⇧S → talk, click, draw; every
// keyframe peels off the screen as a glass slice and flies into a stack behind it;
// the camera orbits to show the stack; ⌥⇧S → slices line up as the contact sheet,
// and the bundle explodes into its files.

const P = 2200;
type Cam = {s: number; x: number; y: number; ry: number; rx: number};
const CAM: [number, Cam][] = [
  [0, {s: 0.32, x: 960, y: 620, ry: -42, rx: 22}],
  [90, {s: 0.66, x: 960, y: 540, ry: -6, rx: 3}],
  [130, {s: 0.78, x: 960, y: 540, ry: 0, rx: 0}],
  [205, {s: 1.8, x: 1380, y: 640, ry: 0, rx: 0}],
  [336, {s: 1.8, x: 1380, y: 640, ry: 0, rx: 0}],
  [380, {s: 1.5, x: 1280, y: 470, ry: 0, rx: 0}],
  [486, {s: 1.5, x: 1280, y: 470, ry: 0, rx: 0}],
  [540, {s: 0.36, x: 2000, y: 480, ry: 34, rx: 8}],
  [604, {s: 0.36, x: 2080, y: 480, ry: 26, rx: 6}],
  [660, {s: 1, x: 960, y: 540, ry: 0, rx: 0}],
];

const camAt = (f: number): Cam => {
  const keys = CAM.map(([k]) => k);
  const pick = (fn: (c: Cam) => number) => kf(f, keys, CAM.map(([, c]) => fn(c)));
  // never still: a slow push-in rides on top of every hold
  return {s: pick((c) => c.s) * (1 + f * 0.00007), x: pick((c) => c.x), y: pick((c) => c.y), ry: pick((c) => c.ry), rx: pick((c) => c.rx)};
};

const worldTransform = (c: Cam) => `translateZ(${P * (1 - 1 / c.s)}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) translate3d(${960 - c.x}px, ${540 - c.y}px, 0)`;

/** Where slice i sits: A = the stack behind the screen, B = the contact-sheet row. */
const ROW = {gap: 616, sc: 0.3};
const sliceAt = (i: number, f: number, t: number) => {
  const fly = kf(f, [t, t + 46], [0, 1], ease);
  const line = kf(f, [618 + i * 6, 668 + i * 6], [0, 1]);
  const A = {x: 640 * (i + 1), y: -60 * (i + 1), z: -360 * (i + 1), sc: 1, ry: -10};
  const B = {x: (i - 1) * ROW.gap, y: 0, z: 0, sc: ROW.sc, ry: 0};
  const lerp = (a: number, b: number) => a + (b - a) * line;
  // peel toward the camera and out to the right before settling into the stack
  const arc = Math.sin(Math.PI * fly) * (1 - line);
  return {
    x: A.x * fly + arc * 900 + (B.x - A.x) * line,
    y: A.y * fly - arc * 120 + (B.y - A.y) * line,
    z: A.z * fly + arc * 520 + (B.z - A.z) * line,
    sc: lerp(A.sc, B.sc),
    ry: A.ry * fly * (1 - line),
    fly,
    line,
  };
};

const Slice: React.FC<{i: number}> = ({i}) => {
  const f = useCurrentFrame();
  const k = KEYFRAMES[i];
  if (f < k.t) return null;
  const s = sliceAt(i, f, k.t);
  return (
    <div
      style={{
        position: 'absolute',
        width: 1920,
        height: 1080,
        left: -960,
        top: -540,
        transformStyle: 'preserve-3d',
        transform: `translate3d(${s.x}px, ${s.y}px, ${s.z}px) rotateY(${s.ry}deg) scale(${s.sc})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 28 / Math.max(s.sc, 0.3),
          overflow: 'hidden',
          opacity: 0.55 + 0.45 * Math.max(s.fly, s.line),
          boxShadow: `0 0 0 ${3 / s.sc}px rgba(255,255,255,${0.6 + 0.4 * (1 - s.fly)}), 0 ${50}px ${120}px rgba(13,13,15,0.28)`,
        }}
      >
        <Desktop t={k.t + 2} showChips={false} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,0.22), transparent 40%)'}} />
        <div
          style={{
            position: 'absolute',
            left: 28 / s.sc,
            top: 28 / s.sc,
            width: 54 / s.sc,
            height: 54 / s.sc,
            borderRadius: 12 / s.sc,
            background: C.red,
            color: '#fff',
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 30 / s.sc,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          }}
        >
          {k.n}
        </div>
      </div>
    </div>
  );
};

/** During the orbit: what each keyframe slice holds. */
const SliceList: React.FC = () => (
  <div style={{position: 'absolute', right: 80, bottom: 80, width: 640}}>
    <Fade at={508} out={600} y={30}>
      <div style={{padding: '28px 34px', borderRadius: 26, background: C.card, boxShadow: '0 30px 70px rgba(13,13,15,0.18)'}}>
        {COPY.demo.slices.map((line, i) => (
          <Fade key={i} at={516 + i * 10} y={10} dur={20}>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '10px 0', fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.ink}}>
              <span style={{width: 44, height: 44, borderRadius: 10, background: C.red, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{i + 1}</span>
              {line}
            </div>
          </Fade>
        ))}
        <Fade at={550} y={8} dur={20}>
          <div style={{marginTop: 10, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.dim}}>{COPY.demo.quote}</div>
        </Fade>
      </div>
    </Fade>
  </div>
);

const Hud: React.FC<{at: number; out: number; label: string}> = ({at, out, label}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 64, display: 'flex', justifyContent: 'center'}}>
    <Fade at={at - 14} out={out} y={30}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px 16px 30px',
          borderRadius: 30,
          background: C.ink,
          boxShadow: '0 30px 60px rgba(13,13,15,0.3)',
        }}
      >
        <span style={{fontFamily: SANS, fontSize: 40, color: C.text, fontWeight: 700, marginRight: 14}}>{label}</span>
        <Key label="⌥" at={at} />
        <Key label="⇧" at={at + 30} />
        <Key label="S" at={at + 60} />
      </div>
    </Fade>
  </div>
);

const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const caps = COPY.demo.captions;
  let idx = -1;
  caps.forEach((c, i) => {
    if (f >= c.from) idx = i;
  });
  const o = kf(f, [160, 172], [0, 1]) * kf(f, [482, 496], [1, 0]);
  if (idx < 0 || o <= 0 || f < caps[0].from + 2) return null;
  const cap = caps[idx];
  const prev = idx > 0 && cap.text.startsWith(caps[idx - 1].text) ? caps[idx - 1].text.length : 0;
  const rest = cap.text.slice(prev);
  const n = Math.round(interpolate(f, [cap.from, cap.from + rest.length * 2.6], [0, Array.from(rest).length], clamp));
  const shown = cap.text.slice(0, prev) + Array.from(rest).slice(0, n).join('');
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 72, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * 16}px)`}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '20px 40px',
          borderRadius: 28,
          background: C.ink,
          boxShadow: '0 30px 60px rgba(13,13,15,0.3)',
          fontFamily: SANS,
          color: C.text,
          fontSize: 58,
          fontWeight: 700,
        }}
      >
        <span style={{width: 16, height: 16, borderRadius: 8, background: C.red}} />
        <span style={{fontFamily: MONO, fontSize: 34, color: C.textDim}}>{cap.ts}</span>
        <span>{shown}</span>
      </div>
    </div>
  );
};

// ---------- bar 10: the bundle, exploded ----------

const FileCard: React.FC<{i: number; title: string; note: string; children: React.ReactNode}> = ({i, title, note, children}) => {
  const f = useCurrentFrame();
  const out = kf(f, [18 + i * 6, 58 + i * 6], [0, 1], ease);
  return (
    <div
      style={{
        position: 'absolute',
        left: -560,
        top: -330,
        width: 1120,
        height: 660,
        transform: `translate3d(${out * (i * 150)}px, ${out * (i * -40)}px, ${-out * i * 330}px)`,
        opacity: i === 0 ? 1 : out,
        borderRadius: 26,
        background: C.card,
        boxShadow: '0 40px 90px rgba(60,40,140,0.25)',
        padding: 36,
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 26}}>
        <span style={{fontFamily: MONO, fontSize: 34, color: C.ink}}>{title}</span>
        <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.dim}}>{note}</span>
      </div>
      {children}
    </div>
  );
};

const Compile: React.FC = () => {
  // local 0 = demo frame 720 (bar 10)
  const f = useCurrentFrame();
  const d = COPY.demo;
  const ry = kf(f, [10, 120], [-4, -26], (x) => x);
  const rx = kf(f, [10, 70], [0, 10]);
  const collapse = kf(f, [100, 120], [0, 1], (x) => x * x);
  const lineBg = (w: number, o = 1) => <div style={{height: 14, width: w, borderRadius: 7, background: `rgba(13,13,15,${0.1 * o})`, marginBottom: 16}} />;
  const files = d.files;
  return (
    <Stage tone="lilac" light={[30, 20]}>
      <div style={{position: 'absolute', left: 110, top: 90, ...H, fontSize: 76, zIndex: 2}}>
        <Reveal at={8} out={100}>
          <span style={{color: C.ink}}>{d.compileA}</span>
          <span style={{color: C.lilacDeep}}>{d.compileB}</span>
        </Reveal>
      </div>
      <AbsoluteFill style={{perspective: P}}>
        <div
          style={{
            position: 'absolute',
            left: 1060,
            top: 600,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${(1 - collapse * 0.9) * kf(f, [0, 40], [1, 0.82])})`,
            opacity: 1 - kf(f, [108, 120], [0, 1]),
          }}
        >
          {[3, 2, 1].map((i) => (
            <FileCard key={i} i={i} title={files[i].name} note={files[i].note}>
              {i === 1 ? (
                <div style={{fontFamily: MONO, fontSize: 28, lineHeight: 1.8}}>
                  {d.summary.map((l, j) => (
                    <div key={j} style={{color: l.startsWith('##') ? C.ink : C.dim}}>{l}</div>
                  ))}
                </div>
              ) : i === 2 ? (
                <div style={{fontFamily: MONO, fontSize: 28, lineHeight: 1.8, color: C.dim, whiteSpace: 'pre'}}>
                  {'{\n  "keyframes": 3,\n  "events": [\n    {"t": 2.1, "type": "click", "target": "保存更改"},\n    {"t": 4.0, "type": "ink", "shape": "circle"},\n    {"t": 5.0, "type": "ink", "shape": "rect"}\n  ]\n}'}
                </div>
              ) : (
                <div>
                  {lineBg(700)}
                  {lineBg(520)}
                  {lineBg(610)}
                </div>
              )}
            </FileCard>
          ))}
          {/* front card: the contact sheet the slices became */}
          <div
            style={{
              position: 'absolute',
              left: -560,
              top: -330,
              width: 1120,
              height: 660,
              borderRadius: 26,
              background: `rgba(255,255,255,${kf(f, [0, 20], [0, 1])})`,
              boxShadow: `0 40px 90px rgba(60,40,140,${kf(f, [0, 20], [0, 0.25])})`,
              padding: 36,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 26, opacity: kf(f, [6, 20], [0, 1])}}>
              <span style={{fontFamily: MONO, fontSize: 34, color: C.ink}}>{files[0].name}</span>
              <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.dim}}>{files[0].note}</span>
            </div>
            <div style={{display: 'flex', gap: 18, flexWrap: 'wrap'}}>
              {KEYFRAMES.map((k, i) => (
                <div key={k.n} style={{position: 'relative', width: 513, height: 288, borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(13,13,15,0.1)'}}>
                  <div style={{position: 'absolute', transform: `scale(${513 / 1280}) translate(-640px, -110px)`, transformOrigin: '0 0'}}>
                    <Desktop t={k.t + 2} showChips={false} />
                  </div>
                  <div style={{position: 'absolute', left: 10, top: 10, width: 36, height: 36, borderRadius: 8, background: C.red, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    {i + 1}
                  </div>
                </div>
              ))}
              <div style={{width: 513, height: 288, borderRadius: 12, border: `2px dashed ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.ink}}>
                {d.quote}
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      {/* the collapse leaves a glowing point that becomes the bundle */}
      {collapse > 0 ? (
        <div style={{position: 'absolute', left: 1060 - 30, top: 600 - 30, width: 60, height: 60, borderRadius: 30, background: C.red, boxShadow: `0 0 ${60 * collapse}px ${20 * collapse}px rgba(255,59,47,0.6)`, opacity: collapse, transform: `scale(${collapse})`}} />
      ) : null}
    </Stage>
  );
};

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const shutter = KEYFRAMES.reduce((m, k) => Math.max(m, f >= k.t && f < k.t + 10 ? 1 - (f - k.t) / 10 : 0), 0);
  const screenAway = kf(f, [612, 668], [0, 1]);
  const appear = kf(f, [0, 30], [0, 1]);
  const framed = cam.s < 1.2;

  return (
    <Stage tone="paper" light={[50, 30]}>
      {f < 720 ? (
        <>
              <AbsoluteFill style={{perspective: P, opacity: appear}}>
            <div style={{position: 'absolute', left: 960, top: 540, transformStyle: 'preserve-3d', transform: worldTransform(cam)}}>
              {/* the screen */}
              <div
                style={{
                  position: 'absolute',
                  width: 1920,
                  height: 1080,
                  left: -960,
                  top: -540,
                  transform: `translate3d(0, 0, ${-screenAway * 1400}px)`,
                  opacity: 1 - screenAway,
                  borderRadius: framed ? 30 : 0,
                  overflow: 'hidden',
                  boxShadow: framed ? '0 0 0 2px rgba(13,13,15,0.08), 0 70px 140px rgba(13,13,15,0.28)' : undefined,
                }}
              >
                <Desktop t={f} />
                {shutter > 0 ? <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: shutter * 0.35}} /> : null}
              </div>
              {KEYFRAMES.map((_, i) => (
                <Slice key={i} i={i} />
              ))}
            </div>
          </AbsoluteFill>
          <Hud at={0} out={108} label={COPY.demo.hudStart} />
          <Caption />
          <SliceList />
          <Hud at={600} out={690} label={COPY.demo.hudStop} />
        </>
      ) : null}

      <Sequence from={720} layout="none">
        <Compile />
      </Sequence>
    </Stage>
  );
};
