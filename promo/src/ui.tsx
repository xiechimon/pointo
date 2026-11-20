import React, {useEffect, useId, useState} from 'react';
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

// Restrained palette: near-black and warm paper, warm greys, one accent (Pointo's red ink).
export const C = {
  bg: '#08090B',
  bg2: '#111216',
  paper: '#F4F3EF',
  paperInk: '#121212',
  paperDim: '#8C8A84',
  text: '#F2F2EF',
  dim: '#7D7E85',
  faint: 'rgba(255,255,255,0.08)',
  line: 'rgba(255,255,255,0.10)',
  red: '#F23B34',
  blue: '#2966FF',
  green: '#3DDC97',
};

export const SANS = '"Noto Sans SC", "PingFang SC", sans-serif';
export const MONO = '"JetBrains Mono", "Noto Sans SC", monospace';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ease = Easing.bezier(0.16, 1, 0.3, 1); // expo-out
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Map frame through keyframes with clamping and a smooth curve. */
export const kf = (f: number, input: number[], output: number[], easing = easeInOut) =>
  interpolate(f, input, output, {...clamp, easing});

export const useSpring = (from: number, config: {damping?: number; stiffness?: number; mass?: number} = {}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - from, fps, config: {damping: 20, stiffness: 120, mass: 1, ...config}});
};

/** Masked line reveal: the line slides up out of a clip and sharpens. */
export const Reveal: React.FC<{at: number; out?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  at,
  out,
  dur = 34,
  style,
  children,
}) => {
  const f = useCurrentFrame();
  const p = kf(f, [at, at + dur], [0, 1], ease);
  const o = out === undefined ? 0 : kf(f, [out, out + 18], [0, 1], easeInOut);
  if (p <= 0) return null;
  return (
    <div style={{overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em', ...style}}>
      <div
        style={{
          transform: `translateY(${(1 - p) * 105 - o * 30}%)`,
          opacity: Math.min(1, p * 1.5) * (1 - o),
          filter: p < 1 || o > 0 ? `blur(${(1 - p) * 8 + o * 10}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Fade + rise + unblur for blocks that are not single lines. */
export const Fade: React.FC<{at: number; out?: number; y?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  at,
  out,
  y = 24,
  dur = 30,
  style,
  children,
}) => {
  const f = useCurrentFrame();
  const p = kf(f, [at, at + dur], [0, 1], ease);
  const o = out === undefined ? 0 : kf(f, [out, out + 16], [0, 1]);
  if (p <= 0 || o >= 1) return null;
  return (
    <div
      style={{
        opacity: p * (1 - o),
        transform: `translateY(${(1 - p) * y - o * 12}px)`,
        filter: p < 1 || o > 0 ? `blur(${(1 - p) * 10 + o * 8}px)` : undefined,
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

/** Near-black (or warm paper) stage, one soft light, film grain. */
export const Stage: React.FC<{light?: [number, number]; tone?: 'dark' | 'paper'; children?: React.ReactNode}> = ({
  light = [50, 30],
  tone = 'dark',
  children,
}) => {
  const f = useCurrentFrame();
  const [lx, ly] = light;
  const paper = tone === 'paper';
  return (
    <AbsoluteFill style={{background: paper ? C.paper : C.bg}}>
      <AbsoluteFill
        style={{
          background: paper
            ? `radial-gradient(1400px 900px at ${lx}% ${ly}%, #FFFFFF 0%, transparent 70%)`
            : `radial-gradient(1300px 800px at ${lx + Math.sin(f / 120) * 3}% ${ly}%, rgba(120,130,160,0.16) 0%, transparent 65%)`,
        }}
      />
      {children}
      <Grain strength={paper ? 0.035 : 0.045} />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{strength?: number}> = ({strength = 0.07}) => {
  const f = useCurrentFrame();
  const k = (f * 7919) % 600;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('grain.png')})`,
        backgroundPosition: `${k}px ${(k * 3) % 600}px`,
        opacity: strength,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Small editorial chapter label, top-left. */
export const Chapter: React.FC<{n: number; label: string; at?: number; out?: number; tone?: 'dark' | 'paper'}> = ({n, label, at = 4, out, tone = 'dark'}) => (
  <div style={{position: 'absolute', left: 96, top: 72}}>
    <Fade at={at} out={out} y={8}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: 19, letterSpacing: 1}}>
        <span style={{width: 8, height: 8, borderRadius: 4, background: C.red}} />
        <span style={{color: tone === 'paper' ? C.paperDim : C.dim}}>{String(n).padStart(2, '0')}</span>
        <span style={{color: tone === 'paper' ? C.paperInk : C.text, fontFamily: SANS, fontWeight: 500, fontSize: 20}}>{label}</span>
      </div>
    </Fade>
  </div>
);

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
}> = ({d, from, to, width = 6, color = C.red, viewBox = '0 0 1920 1080', style, frame, stretch}) => {
  const cur = useCurrentFrame();
  const id = useId().replace(/:/g, '');
  const f = frame ?? cur;
  const p = interpolate(f, [from, to], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.25, 1)});
  if (p <= 0) return null;
  if (stretch) {
    return (
      <svg viewBox={viewBox} preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', ...style}}>
        <defs>
          <clipPath id={id}>
            <rect x={-10} y={-50} width={p * 120} height={200} />
          </clipPath>
        </defs>
        <path d={d} clipPath={`url(#${id})`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={stretch ? 'none' : undefined}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', ...style}}
    >
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
      />
    </svg>
  );
};

export const Cursor: React.FC<{x: number; y: number; scale?: number; press?: number}> = ({x, y, scale = 1, press = 0}) => (
  <svg
    width={30}
    height={42}
    viewBox="0 0 17 24"
    style={{
      position: 'absolute',
      left: x - 3 * scale,
      top: y - 2 * scale,
      transform: `scale(${scale * (1 - press * 0.12)})`,
      transformOrigin: '3px 2px',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
    }}
  >
    <path d="M1.5 1.5 L1.5 19.5 L6 15.3 L9.2 22.4 L12.3 21 L9.2 14.1 L15.2 14.1 Z" fill="#111" stroke="#fff" strokeWidth={1.3} strokeLinejoin="round" />
  </svg>
);

/** Soft click ripple. */
export const Ripple: React.FC<{x: number; y: number; at: number; frame?: number}> = ({x, y, at, frame}) => {
  const cur = useCurrentFrame();
  const t = (frame ?? cur) - at;
  if (t < 0 || t > 36) return null;
  const k = interpolate(t, [0, 30], [0, 1], {...clamp, easing: ease});
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 50,
        top: y - 50,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(41,102,255,0.22)',
        border: '2px solid rgba(41,102,255,0.6)',
        transform: `scale(${0.2 + k * 0.9})`,
        opacity: 1 - k,
      }}
    />
  );
};

/** Light keycap, laptop-keyboard style. */
export const Key: React.FC<{label: string; at: number; w?: number}> = ({label, at, w = 76}) => {
  const f = useCurrentFrame();
  const press = f >= at ? Math.max(0, 1 - (f - at) / 10) : 0;
  const on = f >= at;
  return (
    <div
      style={{
        width: w,
        height: 76,
        borderRadius: 14,
        background: on ? '#FFFFFF' : '#E9E9E6',
        boxShadow: `0 ${4 - press * 3}px 0 #B9B9B4, 0 ${10 - press * 6}px 24px rgba(0,0,0,0.35)`,
        transform: `translateY(${press * 3}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1A1A1A',
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: 34,
        opacity: on ? 1 : 0.55,
      }}
    >
      {label}
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
    const weights = [400, 500, 600];
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
      {[400, 500, 600].map((w) => (
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

/** Quick fade from a colour (cuts on impacts). */
export const Flash: React.FC<{at: number; len?: number; max?: number; color?: string}> = ({at, len = 14, max = 0.9, color = '#fff'}) => {
  const f = useCurrentFrame();
  if (f < at || f > at + len) return null;
  return <AbsoluteFill style={{background: color, opacity: max * (1 - (f - at) / len) ** 2, pointerEvents: 'none'}} />;
};

/** Headline type: medium weight, tight tracking. */
export const H: React.CSSProperties = {fontFamily: SANS, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.18};
