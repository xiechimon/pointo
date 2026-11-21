import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {COPY} from '../copy';
import {C, clamp, Cursor, DISPLAY, ease, Fade, FG, GROUND, H, kf, MONO, Reveal, Ripple, SANS, Stage, Tone, typed} from '../ui';
import {Cap, Shot} from './Real';

// Bars 11–12. The real fix: the agent's merged reply, then Save survives a reload. Then the tool
// names hit full screen on the eighths, each on its own colour field, and gather into one row.

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
    <Sequence durationInFrames={60} layout="none">
      <Shot from={75} rate={4.5} len={60} a={{x: 1150, y: 760, s: 1.35}} b={{x: 1150, y: 720, s: 1.45}} />
      <Cap text={COPY.real.caps[8]} />
    </Sequence>
    <Sequence from={60} durationInFrames={60} layout="none">
      <Shot from={112.8} rate={3} len={60} a={{x: 1100, y: 520, s: 1.6}} b={{x: 1100, y: 520, s: 1.75}} />
      <Cap text={COPY.real.caps[9]} />
    </Sequence>
    <Sequence from={120} layout="none">
      <Tools />
    </Sequence>
  </AbsoluteFill>
);
