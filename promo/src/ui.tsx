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

// Palette: neutral paper and ink, two hues with one meaning each —
// red = the human's ink (pointing, marking), lilac = the AI's side (reading, fixing).
export const C = {
  paper: '#EEEEEC',
  paper2: '#E2E2DF',
  card: '#FFFFFF',
  ink: '#0D0D0F',
  dim: '#6E6E73',
  text: '#F4F4F2',
  textDim: 'rgba(244,244,242,0.6)',
  line: 'rgba(13,13,15,0.12)',
  red: '#FF3B2F',
  lilac: '#C4B5FF',
  lilacDeep: '#6F55F2',
  green: '#16A34A',
};

export const SANS = '"Noto Sans SC", "PingFang SC", sans-serif';
export const DISPLAY = '"Anton", "Noto Sans SC", sans-serif';
export const HAND = '"Caveat", "Noto Sans SC", cursive';
export const UI = '"Inter", "Noto Sans SC", sans-serif';
export const MONO = '"JetBrains Mono", "Noto Sans SC", monospace';

export type Tone = 'paper' | 'ink' | 'red' | 'lilac';
export const GROUND: Record<Tone, string> = {paper: C.paper, ink: C.ink, red: C.red, lilac: C.lilac};
export const FG: Record<Tone, string> = {paper: C.ink, ink: C.text, red: C.ink, lilac: C.ink};

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

/** A lit colour field with film grain. */
export const Stage: React.FC<{tone?: Tone; light?: [number, number]; children?: React.ReactNode}> = ({tone = 'paper', light = [50, 35], children}) => {
  const [lx, ly] = light;
  const dark = tone === 'ink';
  return (
    <AbsoluteFill style={{background: GROUND[tone]}}>
      <AbsoluteFill
        style={{
          background: dark
            ? `radial-gradient(1400px 900px at ${lx}% ${ly}%, rgba(255,255,255,0.07), transparent 70%)`
            : `radial-gradient(1500px 1000px at ${lx}% ${ly}%, rgba(255,255,255,0.45), transparent 70%), radial-gradient(1600px 900px at 50% 120%, rgba(0,0,0,0.10), transparent 70%)`,
        }}
      />
      {children}
      <Grain strength={dark ? 0.05 : 0.06} />
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
    const weights = [500, 700, 900];
    Promise.all([
      ...weights.map((w) => document.fonts.load(`${w} 40px "Noto Sans SC"`, ALL_TEXT)),
      document.fonts.load(`400 40px "JetBrains Mono"`, 'abc'),
      document.fonts.load(`400 40px "Anton"`, 'POINTO 0123'),
      document.fonts.load(`600 40px "Caveat"`, 'here'),
      document.fonts.load(`500 40px "Inter"`, 'Inter'),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return (
    <div style={{position: 'absolute', opacity: 0, pointerEvents: 'none', left: -9999}}>
      {[500, 700, 900].map((w) => (
        <span key={w} style={{fontFamily: SANS, fontWeight: w}}>
          {ALL_TEXT}
        </span>
      ))}
      <span style={{fontFamily: MONO}}>{ALL_TEXT}</span>
      <span style={{fontFamily: DISPLAY}}>POINTO</span>
      <span style={{fontFamily: HAND, fontWeight: 600}}>here</span>
      <span style={{fontFamily: UI}}>Inter</span>
    </div>
  );
};

export const FontFaces: React.FC = () => (
  <style>{`
    @font-face { font-family: "JetBrains Mono"; src: url(${staticFile('JetBrainsMono-Regular.ttf')}) format("truetype"); font-weight: 400; }
    @font-face { font-family: "Anton"; src: url(${staticFile('fonts/Anton-400.woff')}) format("woff"); font-weight: 400; }
    @font-face { font-family: "Caveat"; src: url(${staticFile('fonts/Caveat-600.woff')}) format("woff"); font-weight: 600; }
    @font-face { font-family: "Inter"; src: url(${staticFile('fonts/Inter-var.woff')}) format("woff"); font-weight: 100 900; }
  `}</style>
);

/** Quick fade from a colour (cuts on impacts). */
export const Flash: React.FC<{at: number; len?: number; max?: number; color?: string}> = ({at, len = 14, max = 0.9, color = '#fff'}) => {
  const f = useCurrentFrame();
  if (f < at || f > at + len) return null;
  return <AbsoluteFill style={{background: color, opacity: max * (1 - (f - at) / len) ** 2, pointerEvents: 'none'}} />;
};

/** Headline type: medium weight, tight tracking. */
export const H: React.CSSProperties = {fontFamily: SANS, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.12};

/** A word whose letters rise out of a mask one after another. */
export const Rise: React.FC<{text: string; at: number; stagger?: number; dur?: number; style?: React.CSSProperties}> = ({text, at, stagger = 2, dur = 16, style}) => {
  const f = useCurrentFrame();
  return (
    <div style={{display: 'flex', ...style}}>
      {Array.from(text).map((ch, i) => {
        const k = kf(f, [at + i * stagger, at + i * stagger + dur], [0, 1], ease);
        return (
          <span key={i} style={{display: 'inline-block', overflow: 'hidden', paddingBottom: '0.04em'}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - k) * 105}%)`}}>{ch}</span>
          </span>
        );
      })}
    </div>
  );
};
