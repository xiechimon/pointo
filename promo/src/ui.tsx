import React, {useEffect, useState} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {ALL_TEXT} from './copy';

export const C = {
  blue: '#2966FF',
  blueDeep: '#052BD1',
  sky: '#9DB8FF',
  navy: '#0B1B4D',
  night: '#060A18',
  ink: '#14182B',
  red: '#F23B34',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.56)',
  green: '#3DDC97',
};

export const SANS = '"Noto Sans SC", "PingFang SC", sans-serif';
export const MONO = '"JetBrains Mono", "Noto Sans SC", monospace';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Map frame through keyframes with clamping and a smooth curve. */
export const kf = (f: number, input: number[], output: number[], easing = easeInOut) =>
  interpolate(f, input, output, {...clamp, easing});

export const useSpring = (from: number, config: {damping?: number; stiffness?: number; mass?: number} = {}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - from, fps, config: {damping: 15, stiffness: 170, mass: 0.9, ...config}});
};

/** Spring-in wrapper: rise, unblur and scale up from `at`. */
export const Pop: React.FC<{
  at: number;
  out?: number;
  y?: number;
  scale?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({at, out, y = 40, scale = 0.92, style, children}) => {
  const frame = useCurrentFrame();
  const s = useSpring(at);
  const o = out === undefined ? 1 : kf(frame, [out, out + 12], [1, 0]);
  const blur = interpolate(s, [0, 1], [12, 0], clamp);
  return (
    <div
      style={{
        opacity: Math.min(interpolate(s, [0, 0.4], [0, 1], clamp), o),
        transform: `translateY(${(1 - s) * y + (1 - o) * -20}px) scale(${scale + (1 - scale) * s})`,
        filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Text typed in over a frame range. */
export const typed = (text: string, f: number, from: number, to: number) => {
  const chars = Array.from(text);
  const n = Math.round(interpolate(f, [from, to], [0, chars.length], clamp));
  return chars.slice(0, n).join('');
};

/** Dark stage with drifting brand-blue light and a faint grid. */
export const Backdrop: React.FC<{hue?: 'night' | 'blue'; pulseAt?: number[]}> = ({hue = 'night', pulseAt = []}) => {
  const f = useCurrentFrame();
  const drift = f / 60;
  const pulse = pulseAt.reduce((m, p) => Math.max(m, f >= p ? Math.exp(-(f - p) / 14) : 0), 0);
  if (hue === 'blue') {
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 620px at ${78 + Math.sin(drift * 0.6) * 6}% ${12 + Math.cos(drift * 0.5) * 6}%, rgba(5,43,209,0.75), transparent 70%),
            radial-gradient(900px 700px at 10% 100%, rgba(157,184,255,0.35), transparent 70%),
            linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`,
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{background: C.night}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${30 + Math.sin(drift * 0.5) * 10}% ${30 + Math.cos(drift * 0.4) * 8}%, rgba(41,102,255,${0.28 + pulse * 0.25}), transparent 70%),
            radial-gradient(800px 600px at ${75 + Math.cos(drift * 0.45) * 8}% ${75 + Math.sin(drift * 0.35) * 8}%, rgba(5,43,209,0.30), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          backgroundPosition: `${-f * 0.3}px ${-f * 0.3}px`,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
    </AbsoluteFill>
  );
};

/** A hand-drawn red stroke that draws itself between `from` and `to`. */
export const Ink: React.FC<{
  d: string;
  from: number;
  to: number;
  width?: number;
  color?: string;
  viewBox?: string;
  style?: React.CSSProperties;
  frame?: number;
  stretch?: boolean;
}> = ({d, from, to, width = 7, color = C.red, viewBox = '0 0 1920 1080', style, frame, stretch}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const p = interpolate(f, [from, to], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.25, 1)});
  if (p <= 0) return null;
  return (
    <svg viewBox={viewBox} preserveAspectRatio={stretch ? 'none' : undefined} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', ...style}}>
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
        vectorEffect={stretch ? 'non-scaling-stroke' : undefined}
        style={{filter: `drop-shadow(0 0 6px ${color}55)`}}
      />
    </svg>
  );
};

export const Cursor: React.FC<{x: number; y: number; scale?: number; press?: number}> = ({x, y, scale = 1, press = 0}) => (
  <svg
    width={34}
    height={48}
    viewBox="0 0 17 24"
    style={{
      position: 'absolute',
      left: x - 3 * scale,
      top: y - 2 * scale,
      transform: `scale(${scale * (1 - press * 0.15)})`,
      transformOrigin: '3px 2px',
      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))',
    }}
  >
    <path d="M1.5 1.5 L1.5 19.5 L6 15.3 L9.2 22.4 L12.3 21 L9.2 14.1 L15.2 14.1 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** Concentric click ripple. */
export const Ripple: React.FC<{x: number; y: number; at: number; color?: string}> = ({x, y, at, color = C.sky}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > 40) return null;
  return (
    <>
      {[0, 8].map((delay) => {
        const k = interpolate(t - delay, [0, 30], [0, 1], {...clamp, easing: ease});
        return (
          <div
            key={delay}
            style={{
              position: 'absolute',
              left: x - 60,
              top: y - 60,
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: `4px solid ${color}`,
              transform: `scale(${0.2 + k})`,
              opacity: (1 - k) * (t >= delay ? 1 : 0),
            }}
          />
        );
      })}
    </>
  );
};

/** Big physical-looking keycap that presses down at `at`. */
export const Keycap: React.FC<{label: string; at: number; size?: number; sub?: string}> = ({label, at, size = 150, sub}) => {
  const f = useCurrentFrame();
  const appear = useSpring(at - 10, {damping: 13, stiffness: 200, mass: 0.7});
  const press = f >= at ? Math.max(0, 1 - (f - at) / 9) : 0;
  const lit = f >= at ? Math.exp(-(f - at) / 40) : 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: `linear-gradient(180deg, #2A3045 0%, #171B29 100%)`,
        boxShadow: `0 ${10 - press * 8}px 0 #0A0D16, 0 ${18 - press * 10}px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 ${60 * lit}px rgba(41,102,255,${0.9 * lit})`,
        border: `2px solid rgba(157,184,255,${0.15 + lit * 0.7})`,
        transform: `translateY(${press * 8}px) scale(${interpolate(appear, [0, 1], [0.6, 1])})`,
        opacity: interpolate(appear, [0, 0.3], [0, 1], clamp),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.white,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
    >
      {label}
      {sub ? <span style={{fontSize: size * 0.13, marginTop: size * 0.08, color: C.dim, fontWeight: 400}}>{sub}</span> : null}
    </div>
  );
};

/** Ghost logo image. */
export const Icon: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => (
  <img src={staticFile('icon.png')} width={size} height={size} style={{display: 'block', borderRadius: size * 0.22, ...style}} />
);

/** Mount once: loads every glyph the film uses in every weight, then lets rendering continue. */
export const FontWarmup: React.FC = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const weights = [400, 500, 700, 900];
    Promise.all([
      ...weights.map((w) => document.fonts.load(`${w} 40px "Noto Sans SC"`, ALL_TEXT)),
      document.fonts.load(`400 40px "JetBrains Mono"`, 'abc'),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return (
    <div style={{position: 'absolute', opacity: 0, pointerEvents: 'none', left: -9999}}>
      {[400, 500, 700, 900].map((w) => (
        <span key={w} style={{fontFamily: SANS, fontWeight: w}}>
          {ALL_TEXT}
        </span>
      ))}
      <span style={{fontFamily: MONO}}>{ALL_TEXT}</span>
    </div>
  );
};

export const FontFaces: React.FC = () => (
  <style>{`@font-face { font-family: "JetBrains Mono"; src: url(${staticFile('JetBrainsMono-Regular.ttf')}) format("truetype"); font-weight: 400; }`}</style>
);

/** White flash that decays (cuts on impacts). */
export const Flash: React.FC<{at: number; len?: number; max?: number; color?: string}> = ({at, len = 14, max = 0.9, color = '#fff'}) => {
  const f = useCurrentFrame();
  if (f < at || f > at + len) return null;
  return <AbsoluteFill style={{background: color, opacity: max * (1 - (f - at) / len), pointerEvents: 'none'}} />;
};
