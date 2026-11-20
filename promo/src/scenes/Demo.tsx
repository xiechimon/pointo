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
// Framing rule: the action sits in the upper two thirds so the caption at the bottom never
// covers it, and the camera never shows past the screen's edges (x ≤ 1920 − 960/s, y ≤ 1080 − 540/s).
const CAM: [number, Cam][] = [
  [0, {s: 0.5, x: 960, y: 600, ry: -34, rx: 16}],
  [36, {s: 0.72, x: 960, y: 600, ry: 0, rx: 0}],
  [62, {s: 0.76, x: 960, y: 600, ry: 0, rx: 0}],
  [80, {s: 2.1, x: 960, y: 258, ry: 0, rx: 0}], // close on Pointo's recording capsule
  [118, {s: 2.16, x: 960, y: 258, ry: 0, rx: 0}],
  [120, {s: 1.34, x: 1182, y: 660, ry: 0, rx: 0}], // cut on bar 5: medium on the form and the button
  [300, {s: 1.5, x: 1270, y: 680, ry: 0, rx: 0}], // pushing in through the click
  [336, {s: 1.56, x: 1300, y: 690, ry: 0, rx: 0}],
  [372, {s: 2.2, x: 1484, y: 735, ry: 0, rx: 0}], // close: ⇧ + the ink around the button
  [450, {s: 2.24, x: 1484, y: 735, ry: 0, rx: 0}],
  [462, {s: 1.2, x: 1120, y: 500, ry: 0, rx: 0}], // pull up: the toast corner and the ink both above the caption
  [500, {s: 1.23, x: 1120, y: 500, ry: 0, rx: 0}],
  [524, {s: 0.86, x: 960, y: 560, ry: 0, rx: 0}], // back out: stop the recording
  [604, {s: 0.9, x: 960, y: 560, ry: 0, rx: 0}],
  [646, {s: 0.4, x: 1760, y: 500, ry: 30, rx: 7}], // orbit: the keyframes peeled off
  [676, {s: 0.4, x: 1800, y: 500, ry: 26, rx: 6}],
  [706, {s: 1, x: 960, y: 540, ry: 0, rx: 0}], // the row: the contact sheet
];

const camAt = (f: number): Cam => {
  const keys = CAM.map(([k]) => k);
  const pick = (fn: (c: Cam) => number) => kf(f, keys, CAM.map(([, c]) => fn(c)));
  // never still: a slow push-in rides on top of every hold
  return {s: pick((c) => c.s), x: pick((c) => c.x), y: pick((c) => c.y), ry: pick((c) => c.ry), rx: pick((c) => c.rx)};
};

const worldTransform = (c: Cam) => `translateZ(${P * (1 - 1 / c.s)}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) translate3d(${960 - c.x}px, ${540 - c.y}px, 0)`;

/** Where slice i sits: A = the stack behind the screen, B = the contact-sheet row. */
const ROW = {gap: 616, sc: 0.3};
/** Keyframes peel off after the recording stops, one per beat of bar 9. */
export const PEEL = [600, 616, 632];
const sliceAt = (i: number, f: number, t: number) => {
  const fly = kf(f, [t, t + 36], [0, 1], ease);
  const line = kf(f, [672 + i * 4, 708 + i * 4], [0, 1]);
  const A = {x: 560 * (i + 1), y: -60 * (i + 1), z: -360 * (i + 1), sc: 1, ry: -10};
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
  if (f < PEEL[i]) return null;
  const s = sliceAt(i, f, PEEL[i]);
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
            background: '#fff',
            color: C.ink,
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
    <Fade at={644} out={690} y={30}>
      <div style={{padding: '28px 34px', borderRadius: 26, background: C.card, boxShadow: '0 30px 70px rgba(13,13,15,0.18)'}}>
        <div style={{fontFamily: MONO, fontSize: 30, color: C.dim, marginBottom: 6}}>summary.md</div>
        {COPY.demo.slices.map((line, i) => (
          <Fade key={i} at={648 + i * 6} y={10} dur={16}>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '10px 0', fontFamily: SANS, fontWeight: 700, fontSize: 40, color: C.ink}}>
              <span style={{width: 44, height: 44, borderRadius: 10, background: C.red, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{i + 1}</span>
              {line}
            </div>
          </Fade>
        ))}
        <Fade at={664} y={8} dur={16}>
          <div style={{marginTop: 10, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.dim}}>{COPY.demo.quote}</div>
        </Fade>
      </div>
    </Fade>
  </div>
);

/** While the ink is drawn: ⇧ held down, said in words. */
const ShiftHud: React.FC = () => {
  const f = useCurrentFrame();
  const o = kf(f, [358, 368], [0, 1]) * kf(f, [496, 506], [1, 0]);
  if (o <= 0) return null;
  const down = f >= 372 && f < 494;
  return (
    <div style={{position: 'absolute', left: 70, top: 70, opacity: o, transform: `translateY(${(1 - o) * -30}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '18px 30px 18px 18px', borderRadius: 30, background: C.ink, boxShadow: '0 30px 60px rgba(13,13,15,0.3)'}}>
        <div style={{width: 120, height: 120, borderRadius: 22, background: down ? C.red : '#fff', color: down ? '#fff' : C.ink, boxShadow: down ? '0 2px 0 #9E1F17' : '0 8px 0 #B9B9B4', transform: `translateY(${down ? 6 : 0}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 64}}>⇧</div>
        <span style={{fontFamily: SANS, fontWeight: 900, fontSize: 52, color: C.text}}>按住 ⇧ 画圈</span>
      </div>
    </div>
  );
};

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
  const o = f >= 162 && f < 500 ? 1 : 0;
  if (idx < 0 || o <= 0) return null;
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
        <span style={{fontFamily: SANS, fontSize: 34, fontWeight: 700, color: C.ink, background: C.lilac, padding: '4px 14px', borderRadius: 12}}>🎙 你说</span>
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
        <Reveal at={0} dur={12} out={100}>
          <span style={{color: C.ink}}>{d.compileA}</span>
          <span style={{color: '#4B2BD6'}}>{d.compileB}</span>
        </Reveal>
      </div>
      <AbsoluteFill style={{perspective: P}}>
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 610,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${(1 - collapse * 0.9) * kf(f, [0, 40], [1.1, 1.0])})`,
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
              left: -760,
              top: -230,
              width: 1520,
              height: 460,
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
            <div style={{display: 'flex', gap: 18}}>
              {KEYFRAMES.map((k, i) => (
                <div key={k.n} style={{position: 'relative', width: 460, height: 288, borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(13,13,15,0.1)'}}>
                  <div style={{position: 'absolute', transform: `scale(0.4107) translate(-800px, -100px)`, transformOrigin: '0 0'}}>
                    <Desktop t={k.t + 2} showChips={false} />
                  </div>
                  <div style={{position: 'absolute', left: 10, top: 10, width: 40, height: 40, borderRadius: 9, background: '#fff', color: C.ink, fontFamily: SANS, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)'}}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      {/* the collapse leaves a glowing point that becomes the bundle */}
      {collapse > 0 ? (
        <div style={{position: 'absolute', left: 960 - 30, top: 610 - 30, width: 60, height: 60, borderRadius: 30, background: C.red, boxShadow: `0 0 ${60 * collapse}px ${20 * collapse}px rgba(255,59,47,0.6)`, opacity: collapse, transform: `scale(${collapse})`}} />
      ) : null}
    </Stage>
  );
};

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const shutter = PEEL.reduce((m, t) => Math.max(m, f >= t && f < t + 10 ? 1 - (f - t) / 10 : 0), 0);
  const screenAway = kf(f, [676, 708], [0, 1]);
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
          <ShiftHud />
          <SliceList />
          <Hud at={510} out={598} label={COPY.demo.hudStop} />
        </>
      ) : null}

      <Sequence from={720} layout="none">
        <Compile />
      </Sequence>
    </Stage>
  );
};
