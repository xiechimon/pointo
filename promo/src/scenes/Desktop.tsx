import React from 'react';
import {getLength, getPointAtLength as rawPoint} from '@remotion/paths';
import {COPY} from '../copy';
import {C, Cursor, Icon, Ink, kf, MONO, Ripple, SANS} from '../ui';

const getPointAtLength = (d: string, len: number) => rawPoint(d, len) ?? {x: 0, y: 0};

// A mock desktop in 1920×1080 screen coordinates whose whole state is a pure
// function of `t` (the frame inside the demo), so the same screen renders live
// under the camera and as frozen keyframe thumbnails in the bundle.

const WIN = {x: 160, y: 92, w: 1600, h: 920};
export const BUTTON = {x: 1544, y: 676, w: 144, h: 48};
export const CLICK = {x: 1612, y: 704, at: 300};
export const CIRCLE = 'M 1700 662 C 1718 642, 1600 638, 1546 646 C 1512 652, 1506 712, 1530 740 C 1562 762, 1692 758, 1716 734 C 1732 714, 1728 682, 1694 662';
export const RECT = 'M 1478 156 C 1560 148, 1680 150, 1750 155 C 1756 180, 1753 206, 1748 230 C 1660 235, 1560 233, 1472 228 C 1467 204, 1469 178, 1482 150';
export const INK = {circle: [380, 440], rect: [464, 492]} as const;
export const KEYFRAMES = [
  {n: 1, t: 304, x: 1700, y: 610},
  {n: 2, t: 442, x: 1730, y: 600},
  {n: 3, t: 494, x: 1420, y: 150},
];
export const REC_AT = 75;

const circleLen = getLength(CIRCLE);
const rectLen = getLength(RECT);

export const cursorAt = (t: number) => {
  const [c0, c1] = INK.circle;
  const [r0, r1] = INK.rect;
  if (t >= c0 && t <= c1) return getPointAtLength(CIRCLE, kf(t, [c0, c1], [0, circleLen]));
  if (t >= r0 && t <= r1) return getPointAtLength(RECT, kf(t, [r0, r1], [0, rectLen]));
  const cs = getPointAtLength(CIRCLE, 0);
  const ce = getPointAtLength(CIRCLE, circleLen);
  const rs = getPointAtLength(RECT, 0);
  const re = getPointAtLength(RECT, rectLen);
  if (t < 300) return {x: kf(t, [170, 262], [1320, CLICK.x]), y: kf(t, [170, 262], [980, CLICK.y])};
  if (t < c0) return {x: kf(t, [312, 374], [CLICK.x, cs.x]), y: kf(t, [312, 374], [CLICK.y, cs.y])};
  if (t < r0) return {x: kf(t, [c1, r0 - 1], [ce.x, rs.x]), y: kf(t, [c1, r0 - 1], [ce.y, rs.y])};
  return {x: kf(t, [r1, 560], [re.x, 1250]), y: kf(t, [r1, 560], [re.y, 520])};
};

const Row: React.FC<{k: string; v: string; i: number}> = ({k, v, i}) => (
  <div style={{height: 86, display: 'flex', alignItems: 'center', padding: '0 32px', borderTop: i ? '1px solid #EFEFEC' : undefined}}>
    <div style={{width: 316, fontSize: 25, color: '#2B2B2B', fontWeight: 700}}>{k}</div>
    {v ? (
      <div style={{flex: 1, height: 46, borderRadius: 10, border: '1px solid #E3E3DF', background: '#FCFCFB', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 24, color: '#1E1E1E'}}>
        {v}
        {k === '时区' ? <span style={{marginLeft: 'auto', color: '#9A9A95', fontSize: 14}}>▾</span> : null}
      </div>
    ) : (
      <div style={{width: 52, height: 30, borderRadius: 15, background: '#1E1E1E', position: 'relative'}}>
        <div style={{position: 'absolute', right: 3, top: 3, width: 24, height: 24, borderRadius: 12, background: '#fff'}} />
      </div>
    )}
  </div>
);

const Pill: React.FC<{t: number}> = ({t}) => {
  if (t < REC_AT) return null;
  const grow = kf(t, [REC_AT, REC_AT + 16], [0, 1]);
  const state = t >= 600 ? 'done' : t >= 572 ? 'working' : 'rec';
  const secs = Math.floor(Math.max(0, Math.min(t, 572) - REC_AT) / 60);
  const width = state === 'done' ? 420 : state === 'working' ? 200 : 290;
  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        left: 960 - (width * grow) / 2,
        width: width * grow,
        height: 56,
        borderRadius: 28,
        background: 'rgba(20,20,22,0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: SANS,
        fontSize: 24,
        fontWeight: 700,
        color: '#fff',
        opacity: grow,
      }}
    >
      {state === 'rec' ? (
        <>
          <div style={{width: 10, height: 10, borderRadius: 5, background: C.red, opacity: 0.55 + 0.45 * Math.abs(Math.sin(t / 14)), flexShrink: 0}} />
          <span>{COPY.demo.rec}</span>
          <span style={{fontFamily: MONO, color: 'rgba(255,255,255,0.6)'}}>0:0{secs}</span>
          <div style={{display: 'flex', gap: 3, alignItems: 'center', height: 20}}>
            {Array.from({length: 6}).map((_, i) => {
              const talking = (t > 160 && t < 330) || (t > 384 && t < 480);
              const h = talking ? 4 + Math.abs(Math.sin(t / 4 + i * 1.7) * Math.cos(t / 7 + i)) * 14 : 3;
              return <div key={i} style={{width: 3, height: h, borderRadius: 2, background: 'rgba(255,255,255,0.8)'}} />;
            })}
          </div>
        </>
      ) : state === 'working' ? (
        <>
          <div style={{width: 14, height: 14, borderRadius: 7, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', transform: `rotate(${t * 14}deg)`, flexShrink: 0}} />
          <span>{COPY.demo.working}</span>
        </>
      ) : (
        <>
          <span style={{color: C.green, fontWeight: 700}}>✓</span>
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
  const L = (x: number) => x - WIN.x;
  const T = (y: number) => y - WIN.y;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden', fontFamily: SANS}}>
      {/* painterly wallpaper */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(1000px 800px at 15% 15%, #E7E0FF 0%, transparent 62%),
            radial-gradient(1100px 900px at 90% 85%, #A893FF 0%, transparent 60%),
            radial-gradient(800px 700px at 85% 10%, #FFC9C2 0%, transparent 60%),
            linear-gradient(160deg, #D7CEFF, #B6A4FF)`,
        }}
      />
      {/* menu bar */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 32, background: 'rgba(30,26,24,0.18)', backdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24, color: '#fff', fontSize: 15, fontWeight: 500}}>
        <span style={{fontWeight: 600}}>Browser</span>
        <span style={{opacity: 0.85}}>File</span>
        <span style={{opacity: 0.85}}>Edit</span>
        <span style={{opacity: 0.85}}>View</span>
        <div style={{flex: 1}} />
        <Icon size={18} style={{borderRadius: 5, boxShadow: t >= REC_AT && t < 572 ? `0 0 0 2px ${C.red}` : undefined}} />
        <span style={{fontFamily: MONO, opacity: 0.9, fontSize: 14}}>10:24</span>
      </div>

      {/* window */}
      <div
        style={{
          position: 'absolute',
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#FFFFFF',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 30px 80px rgba(20,10,0,0.35), 0 8px 20px rgba(20,10,0,0.18)',
        }}
      >
        <div style={{height: 48, background: '#F4F4F2', borderBottom: '1px solid #E6E6E2', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 8}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c}} />
          ))}
          <div style={{margin: '0 auto', width: 520, height: 30, borderRadius: 8, background: '#E9E9E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 14, color: '#6B6B66'}}>
            {d.url}
          </div>
        </div>
        {/* sidebar */}
        <div style={{position: 'absolute', left: 0, top: 48, bottom: 0, width: 240, background: '#F8F8F6', borderRight: '1px solid #EEEEEB', padding: '26px 16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, color: '#1A1A1A', padding: '0 10px 26px'}}>
            <div style={{width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg,#F29B5B,#E5484D)'}} />
            {d.app}
          </div>
          {d.nav.map((n, i) => (
            <div key={n} style={{height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 21, color: i === 4 ? '#111' : '#5E5E59', background: i === 4 ? '#ECECE8' : undefined, fontWeight: i === 4 ? 500 : 400, marginBottom: 2}}>
              {n}
            </div>
          ))}
        </div>
        {/* main */}
        <div style={{position: 'absolute', left: 312, top: T(196), fontSize: 44, fontWeight: 900, color: '#111', letterSpacing: '-0.01em'}}>{d.title}</div>
        <div style={{position: 'absolute', left: 312, top: T(256), fontSize: 22, color: '#85857F'}}>{d.subtitle}</div>
        <div style={{position: 'absolute', left: 312, top: T(300), width: 1216, borderRadius: 14, border: '1px solid #ECECE8', background: '#fff'}}>
          {d.rows.map((r, i) => (
            <Row key={r.k} k={r.k} v={r.v} i={i} />
          ))}
        </div>
        <div style={{position: 'absolute', left: L(1428), top: T(676), width: 100, height: 48, borderRadius: 10, border: '1px solid #E3E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, color: '#333'}}>{d.cancel}</div>
        <div
          style={{
            position: 'absolute',
            left: L(BUTTON.x),
            top: T(BUTTON.y),
            width: BUTTON.w,
            height: BUTTON.h,
            borderRadius: 10,
            background: pressedBtn ? '#2A2A2A' : '#111',
            color: '#fff',
            fontSize: 21,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${pressedBtn ? 0.97 : 1})`,
          }}
        >
          {d.save}
        </div>
      </div>

      <Ripple x={CLICK.x} y={CLICK.y} at={CLICK.at} frame={t} />
      {/* the toast that should have appeared, sketched where the box is drawn */}
      {t >= 486 ? (
        <div
          style={{
            position: 'absolute',
            left: 1500,
            top: 168,
            width: 230,
            height: 50,
            borderRadius: 12,
            border: `3px dashed ${C.red}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 22,
            color: C.red,
            opacity: kf(t, [486, 496], [0, 0.9]),
          }}
        >
          这里该有提示
        </div>
      ) : null}
      <Ink d={CIRCLE} from={INK.circle[0]} to={INK.circle[1]} frame={t} width={5} />
      <Ink d={RECT} from={INK.rect[0]} to={INK.rect[1]} frame={t} width={5} />

      {/* keyframe number chips (Pointo's small white corner chip) */}
      {showChips &&
        KEYFRAMES.map((k) => {
          const s = kf(t, [k.t, k.t + 10], [0, 1]);
          const o = kf(t, [k.t + 50, k.t + 64], [1, 0]);
          if (s <= 0 || o <= 0) return null;
          return (
            <div
              key={k.n}
              style={{
                position: 'absolute',
                left: k.x,
                top: k.y,
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#fff',
                color: '#111',
                fontWeight: 600,
                fontSize: 19,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                transform: `scale(${0.6 + s * 0.4})`,
                opacity: s * o,
              }}
            >
              {k.n}
            </div>
          );
        })}

      <Pill t={t} />
      {showCursor && t >= 150 ? <Cursor x={cur.x} y={cur.y} press={press} /> : null}
    </div>
  );
};
