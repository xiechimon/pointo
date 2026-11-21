import React from 'react';
import {AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, ease, Fade, H, Key, kf, MONO, SANS, Stage, UI} from '../ui';

// The real thing: a Pointo capture of a real Cairn bug (Save in Project settings loses the text),
// recorded on a Mac at 1920×1248. Each shot plays a stretch of that footage at a speed that fits
// the beat grid, under a camera that follows the action. Coordinates are footage pixels.

export const FOOTAGE = 'footage/cairn.mp4';
const FW = 1920;
const FH = 1248;
const FPS = 60;

type Cam = {x: number; y: number; s: number};

/** The footage from `from` seconds at `rate`, framed by a camera moving from `a` to `b`. */
export const Shot: React.FC<{
  from: number;
  rate: number;
  len: number;
  a: Cam;
  b?: Cam;
  freezeAt?: number;
  children?: React.ReactNode;
}> = ({from, rate, len, a, b = a, freezeAt, children}) => {
  const f = useCurrentFrame();
  const k = kf(f, [0, len], [0, 1], (x) => 1 - Math.pow(1 - x, 2));
  const x = a.x + (b.x - a.x) * k;
  const y = a.y + (b.y - a.y) * k;
  const s = a.s + (b.s - a.s) * k;
  const video = <OffthreadVideo src={staticFile(FOOTAGE)} trimBefore={Math.round(from * FPS)} playbackRate={rate} muted />;
  return (
    <AbsoluteFill style={{background: '#E9E7E2', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: FW, height: FH, transformOrigin: '0 0', transform: `translate(${960 - x * s}px, ${540 - y * s}px) scale(${s})`}}>
        <div style={{position: 'absolute', inset: 0}}>{freezeAt !== undefined ? <Freeze frame={freezeAt}>{video}</Freeze> : video}</div>
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** The caption: one line, bottom centre, in on the cut. */
export const Cap: React.FC<{text: string; at?: number}> = ({text, at = 0}) => {
  const f = useCurrentFrame();
  const k = kf(f, [at, at + 8], [0, 1], ease);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 64, display: 'flex', justifyContent: 'center', opacity: k, transform: `translateY(${(1 - k) * 18}px)`}}>
      <div style={{padding: '18px 40px', borderRadius: 26, background: C.ink, color: C.text, ...H, fontSize: 60, letterSpacing: '-0.01em', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
};

const Keys: React.FC<{labels: string[]; at: number; top?: number}> = ({labels, at, top = 700}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', gap: 18, transform: 'scale(1.6)'}}>
    {labels.map((l, i) => (
      <Key key={l} label={l} at={at + i * 4} w={l.length > 1 ? 120 : 76} />
    ))}
  </div>
);

/** The new capsule, drawn over the footage's (an older build said "sent to a project"). */
const Copied: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const k = kf(f, [at, at + 10], [0, 1], ease);
  if (f < at) return null;
  return (
    <div style={{position: 'absolute', left: 965, top: 100, transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * k})`, opacity: k}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 14px', borderRadius: 999, background: '#16161A', boxShadow: '0 10px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap'}}>
        <span style={{width: 18, height: 18, borderRadius: 9, background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900}}>✓</span>
        <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 15, color: '#F4F4F2'}}>{COPY.real.copied}</span>
        <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 13, color: '#fff', background: '#5B4BFF', borderRadius: 999, padding: '4px 12px'}}>{COPY.real.paste}</span>
      </div>
    </div>
  );
};

/** What the agent gets: the capture's real contact sheet and its summary lines. */
const Sheet: React.FC = () => {
  const f = useCurrentFrame();
  const r = COPY.real;
  const push = kf(f, [0, 150], [0.94, 1.02], (x) => x);
  return (
    <Stage tone="lilac" light={[30, 30]}>
      <div style={{position: 'absolute', left: 110, top: 96, ...H, fontSize: 72, color: C.ink}}>
        <Fade at={0} y={14} dur={12}>
          <span>{r.caps[5]}</span>
          <span style={{color: '#4B2BD6', fontSize: 44, marginLeft: 24}}>{r.sheetHead}</span>
        </Fade>
      </div>
      <div style={{position: 'absolute', left: 110, top: 230, width: 1100, transform: `scale(${push})`, transformOrigin: '0% 0%'}}>
        <Fade at={4} y={40} dur={16}>
          <Img src={staticFile('shots/contact-sheet.png')} style={{width: 1100, borderRadius: 18, boxShadow: '0 40px 90px rgba(40,20,120,0.35)', display: 'block'}} />
        </Fade>
      </div>
      <div style={{position: 'absolute', left: 1260, top: 250, width: 580, padding: '28px 30px', borderRadius: 22, background: C.ink, color: C.text, fontFamily: MONO, fontSize: 24, lineHeight: 1.7, boxShadow: '0 40px 90px rgba(40,20,120,0.35)'}}>
        <div style={{fontFamily: UI, fontWeight: 700, fontSize: 22, color: 'rgba(244,244,242,0.5)', marginBottom: 10}}>summary.md</div>
        {r.summary.map((l, i) => {
          const o = kf(f, [30 + i * 15, 40 + i * 15], [0, 1]);
          return (
            <div key={l} style={{opacity: o, transform: `translateX(${(1 - o) * 12}px)`, color: i === 2 ? '#FF8A80' : C.text, whiteSpace: 'nowrap'}}>
              {l}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// local frames on the demo's 14 s (bars 4–10); every cut is on a beat
const CAPSULE: Cam = {x: 965, y: 110, s: 2.4};
const FORM: Cam = {x: 1150, y: 470, s: 1.45};
const SAVE: Cam = {x: 1470, y: 640, s: 2.5};
const TEXT: Cam = {x: 1100, y: 520, s: 1.6};
const CHAT: Cam = {x: 1150, y: 860, s: 1.35};

export const Demo: React.FC = () => {
  const r = COPY.real;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={60} layout="none">
        <Shot from={1.0} rate={1} len={60} a={CAPSULE} b={{...CAPSULE, s: 2.7}} />
        <Keys labels={['⌥', '⇧', 'S']} at={2} />
        <Cap text={r.caps[0]} />
      </Sequence>
      <Sequence from={60} durationInFrames={150} layout="none">
        <Shot from={10.6} rate={2.92} len={150} a={FORM} b={{x: 1320, y: 560, s: 1.65}} />
        <Cap text={r.caps[1]} />
      </Sequence>
      <Sequence from={210} durationInFrames={150} layout="none">
        <Shot from={20.2} rate={1.28} len={150} a={SAVE} b={{...SAVE, s: 2.9}} />
        <Cap text={r.caps[2]} />
      </Sequence>
      <Sequence from={360} durationInFrames={90} layout="none">
        <Shot from={25.0} rate={2} len={90} a={TEXT} b={{...TEXT, s: 1.75}} />
        <Cap text={r.caps[3]} />
      </Sequence>
      <Sequence from={450} durationInFrames={60} layout="none">
        <Shot from={38.3} rate={1.15} len={60} a={CAPSULE} b={{...CAPSULE, s: 2.8}} >
          <Copied at={34} />
        </Shot>
        <Cap text={r.caps[4]} />
      </Sequence>
      <Sequence from={510} durationInFrames={150} layout="none">
        <Sheet />
      </Sequence>
      <Sequence from={660} durationInFrames={120} layout="none">
        <Shot from={55.5} rate={2.25} len={120} a={CHAT} b={{x: 1180, y: 820, s: 1.5}} />
        <Keys labels={['⌥', '⇧', 'V']} at={0} top={420} />
        <Cap text={r.caps[6]} />
      </Sequence>
      <Sequence from={780} durationInFrames={60} layout="none">
        <Shot from={60.5} rate={4.5} len={60} a={{x: 1150, y: 760, s: 1.3}} b={{x: 1150, y: 700, s: 1.4}} />
        <Cap text={r.caps[7]} />
      </Sequence>
    </AbsoluteFill>
  );
};
