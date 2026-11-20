import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/600.css';
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {BAR, SCENES} from './timing';
import {FontFaces, FontWarmup} from './ui';
import {Hook} from './scenes/Hook';
import {Title} from './scenes/Title';
import {Demo} from './scenes/Demo';
import {Deliver} from './scenes/Deliver';
import {Local} from './scenes/Local';
import {End} from './scenes/End';

const PARTS: [keyof typeof SCENES, React.FC][] = [
  ['hook', Hook],
  ['title', Title],
  ['demo', Demo],
  ['deliver', Deliver],
  ['local', Local],
  ['end', End],
];

export const Promo: React.FC = () => (
  <AbsoluteFill style={{background: '#08090B'}}>
    <FontFaces />
    <FontWarmup />
    {PARTS.map(([key, Scene]) => {
      const [start, len] = SCENES[key];
      return (
        <Sequence key={key} name={key} from={start * BAR} durationInFrames={len * BAR}>
          <Scene />
        </Sequence>
      );
    })}
    <Audio src={staticFile('music.wav')} />
  </AbsoluteFill>
);
