import React from 'react';
import {getLength, getPointAtLength as rawPoint} from '@remotion/paths';

const getPointAtLength = (d: string, len: number) => rawPoint(d, len) ?? {x: 0, y: 0};
import {COPY} from '../copy';
import {C, Cursor, Icon, Ink, kf, MONO, SANS} from '../ui';

// A mock desktop (1920×1080 screen coordinates) whose whole state is a pure
// function of `t`, the frame inside the demo. That lets the same screen render
// live under the camera and as frozen keyframe thumbnails in the bundle.

export const BUTTON = {x: 720, y: 716, w: 480, h: 68};
export const CLICK = {x: 1000, y: 754, at: 300};
export const CIRCLE =
  'M 1222 736 C 1236 686, 1010 674, 900 680 C 760 686, 688 724, 700 762 C 712 808, 860 822, 990 818 C 1124 814, 1244 794, 1236 746 C 1230 716, 1190 700, 1126 694';
const ARROW_SHAFT = 'M 1420 570 C 1350 590, 1280 640, 1160 672';
export const ARROW = `${ARROW_SHAFT} M 1160 672 L 1192 642 M 1160 672 L 1202 688`;
export const INK = {circle: [380, 440], arrow: [452, 476]} as const;
export const KEYFRAMES = [
  {n: 1, t: 302, x: CLICK.x + 30, y: CLICK.y - 70},
  {n: 2, t: 442, x: 1250, y: 720},
  {n: 3, t: 478, x: 1440, y: 510},
];
export const REC_AT = 75;

const circleLen = getLength(CIRCLE);
const arrowLen = getLength(ARROW);

export const cursorAt = (t: number) => {
  const [c0, c1] = INK.circle;
  const [a0, a1] = INK.arrow;
  if (t >= c0 && t <= c1) return getPointAtLength(CIRCLE, kf(t, [c0, c1], [0, circleLen]));
  if (t >= a0 && t <= a1) return getPointAtLength(ARROW, kf(t, [a0, a1], [0, arrowLen]));
  const start = getPointAtLength(CIRCLE, 0);
  const arrowStart = getPointAtLength(ARROW, 0);
  const circleEnd = getPointAtLength(CIRCLE, circleLen);
  if (t < 300) return {x: kf(t, [150, 290], [1560, CLICK.x]), y: kf(t, [150, 290], [980, CLICK.y])};
  if (t < c0) return {x: kf(t, [310, 372], [CLICK.x, start.x]), y: kf(t, [310, 372], [CLICK.y, start.y])};
  if (t < a0) return {x: kf(t, [c1, a0 - 2], [circleEnd.x, arrowStart.x]), y: kf(t, [c1, a0 - 2], [circleEnd.y, arrowStart.y])};
  const end = getPointAtLength(ARROW, getLength(ARROW_SHAFT));
  return {x: kf(t, [a1, 560], [end.x, 1500]), y: kf(t, [a1, 560], [end.y, 820])};
};

const Field: React.FC<{label: string; value?: string; top: number; dots?: boolean}> = ({label, value, top, dots}) => (
  <div style={{position: 'absolute', left: 40, right: 40, top}}>
    <div style={{fontSize: 20, color: '#5A607A', marginBottom: 10, fontWeight: 500}}>{label}</div>
    <div
      style={{
        height: 60,
        borderRadius: 14,
        border: '1.5px solid #D8DDEB',
        background: '#F8F9FD',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: 22,
        color: '#14182B',
        letterSpacing: dots ? 6 : 0,
      }}
    >
      {dots ? '••••••••••' : value}
    </div>
  </div>
);

const Pill: React.FC<{t: number}> = ({t}) => {
  if (t < REC_AT) return null;
  const grow = kf(t, [REC_AT, REC_AT + 14], [0, 1]);
  const state = t >= 700 ? 'done' : t >= 660 ? 'working' : 'rec';
  const secs = Math.floor(Math.max(0, Math.min(t, 660) - REC_AT) / 60);
  const width = state === 'done' ? 400 : state === 'working' ? 230 : 290;
  const color = state === 'done' ? C.green : C.red;
  return (
    <div
      style={{
        position: 'absolute',
        top: 54,
        left: 960 - (width * grow) / 2,
        width: width * grow,
        height: 56,
        borderRadius: 28,
        background: 'rgba(14,16,26,0.86)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 22px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: SANS,
        fontSize: 22,
        fontWeight: 500,
        color: '#fff',
        opacity: grow,
      }}
    >
      {state === 'rec' ? (
        <>
          <div style={{width: 16, height: 16, borderRadius: 8, background: color, opacity: 0.55 + 0.45 * Math.abs(Math.sin(t / 14)), flexShrink: 0}} />
          <span>{COPY.demo.rec}</span>
          <span style={{fontFamily: MONO, color: 'rgba(255,255,255,0.7)'}}>0:0{secs}</span>
          <div style={{display: 'flex', gap: 4, alignItems: 'center', height: 28}}>
            {Array.from({length: 7}).map((_, i) => {
              const talking = (t > 160 && t < 330) || (t > 380 && t < 470);
              const h = talking ? 6 + Math.abs(Math.sin(t / 4 + i * 1.7) * Math.cos(t / 7 + i)) * 22 : 5;
              return <div key={i} style={{width: 4, height: h, borderRadius: 2, background: C.sky}} />;
            })}
          </div>
        </>
      ) : state === 'working' ? (
        <>
          <div style={{width: 20, height: 20, borderRadius: 10, border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', transform: `rotate(${t * 14}deg)`, flexShrink: 0}} />
          <span>{COPY.demo.working}</span>
        </>
      ) : (
        <>
          <div style={{width: 26, height: 26, borderRadius: 13, background: color, color: '#06281A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flexShrink: 0}}>✓</div>
          <span>{COPY.demo.done}</span>
        </>
      )}
    </div>
  );
};

export const Desktop: React.FC<{t: number; showCursor?: boolean; showChips?: boolean}> = ({t, showCursor = true, showChips = true}) => {
  const d = COPY.demo;
  const cur = cursorAt(t);
  const press = t >= CLICK.at && t < CLICK.at + 10 ? 1 - (t - CLICK.at) / 10 : 0;
  const pressedBtn = t >= CLICK.at && t < CLICK.at + 8;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden', fontFamily: SANS}}>
      {/* wallpaper */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(1200px 800px at 20% 10%, #5B7CFF 0%, transparent 60%), radial-gradient(1000px 700px at 90% 90%, #7B3FE4 0%, transparent 60%), linear-gradient(135deg, #1E2A78, #2A1458)',
        }}
      />
      {/* menu bar */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 36, background: 'rgba(20,20,40,0.35)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 28, color: '#fff', fontSize: 17, fontWeight: 500}}>
        <span style={{fontWeight: 700}}>Browser</span>
        <span style={{opacity: 0.85}}>File</span>
        <span style={{opacity: 0.85}}>Edit</span>
        <span style={{opacity: 0.85}}>View</span>
        <div style={{flex: 1}} />
        <Icon size={22} style={{borderRadius: 6, opacity: t >= REC_AT ? 1 : 0.7, boxShadow: t >= REC_AT && t < 660 ? `0 0 0 2px ${C.red}` : undefined}} />
        <span style={{fontFamily: MONO, opacity: 0.9}}>10:24</span>
      </div>

      {/* browser window */}
      <div style={{position: 'absolute', left: 210, top: 110, width: 1500, height: 900, borderRadius: 18, overflow: 'hidden', background: '#F3F5FB', boxShadow: '0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.15)'}}>
        <div style={{height: 56, background: '#E7EAF3', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, borderBottom: '1px solid #D5DAE8'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
          ))}
          <div style={{marginLeft: 120, flex: 1, maxWidth: 760, height: 34, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', fontFamily: MONO, fontSize: 16, color: '#5A607A'}}>
            {d.url}
          </div>
        </div>
        {/* page */}
        <div style={{position: 'absolute', left: 0, top: 56, right: 0, height: 64, background: '#fff', borderBottom: '1px solid #E6E9F2', display: 'flex', alignItems: 'center', padding: '0 36px', fontWeight: 900, fontSize: 26, color: '#14182B', gap: 12}}>
          <div style={{width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#FF8A3D,#F23B6B)'}} />
          {d.brand}
        </div>
        {/* login card */}
        <div style={{position: 'absolute', left: 470, top: 146, width: 560, height: 680, borderRadius: 26, background: '#fff', boxShadow: '0 20px 60px rgba(20,24,43,0.10), 0 0 0 1px #E6E9F2'}}>
          <div style={{position: 'absolute', left: 40, top: 48, fontSize: 40, fontWeight: 900, color: '#14182B'}}>{d.welcome}</div>
          <div style={{position: 'absolute', left: 40, top: 108, fontSize: 21, color: '#7A8099'}}>{d.welcomeSub}</div>
          <Field label={d.email} value={d.emailValue} top={176} />
          <Field label={d.password} top={286} dots />
          {/* the button: screen rect BUTTON */}
          <div
            style={{
              position: 'absolute',
              left: BUTTON.x - 680,
              top: BUTTON.y - 256,
              width: BUTTON.w,
              height: BUTTON.h,
              borderRadius: 16,
              background: pressedBtn ? '#1F55E0' : C.blue,
              color: '#fff',
              fontSize: 26,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${pressedBtn ? 0.98 : 1})`,
              boxShadow: '0 10px 24px rgba(41,102,255,0.35)',
            }}
          >
            {d.button}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 570, textAlign: 'center', fontSize: 19, color: '#7A8099'}}>{d.forgot}</div>
        </div>
      </div>

      {/* ⇧ ink, on screen like Pointo's overlay */}
      <Ink d={CIRCLE} from={INK.circle[0]} to={INK.circle[1]} frame={t} width={7} />
      <Ink d={ARROW} from={INK.arrow[0]} to={INK.arrow[1]} frame={t} width={7} />

      {/* keyframe number chips (white corner chip style) */}
      {showChips &&
        KEYFRAMES.map((k) => {
          const s = kf(t, [k.t, k.t + 8], [0, 1]);
          const o = kf(t, [k.t + 50, k.t + 64], [1, 0]);
          if (s <= 0 || o <= 0) return null;
          return (
            <div
              key={k.n}
              style={{
                position: 'absolute',
                left: k.x,
                top: k.y,
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#fff',
                color: '#14182B',
                fontWeight: 900,
                fontSize: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                transform: `scale(${0.5 + s * 0.5})`,
                opacity: s * o,
              }}
            >
              {k.n}
            </div>
          );
        })}

      {/* holding ⇧ badge */}
      {t >= 368 && t <= 486 ? (
        <div
          style={{
            position: 'absolute',
            left: cur.x + 34,
            top: cur.y + 38,
            padding: '4px 12px',
            borderRadius: 10,
            background: C.red,
            color: '#fff',
            fontSize: 22,
            fontWeight: 700,
            opacity: kf(t, [368, 376], [0, 1]) * kf(t, [478, 486], [1, 0]),
          }}
        >
          ⇧
        </div>
      ) : null}

      <Pill t={t} />
      {showCursor && t >= 150 ? <Cursor x={cur.x} y={cur.y} press={press} /> : null}
    </div>
  );
};
