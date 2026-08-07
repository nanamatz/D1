/**
 * Audio facade (work order B, phase 1 — SFX). One module singleton owns the
 * AudioContext and a master→group gain graph; components call `audio.play(name)`.
 *
 * Most sounds are synthesized via small oscillator/noise recipes. Selected
 * one-shot samples live behind the same facade, so call sites stay unchanged
 * (see assets/AUDIO_LICENSES.md).
 *
 * Autoplay policy: browsers only allow an AudioContext to make sound after a user
 * gesture. We install a one-shot pointerdown/keydown listener that resumes the
 * context; before that, and in Node/tests (no AudioContext), `play` is a silent
 * no-op — never a throw, never a buffer.
 */

import { clamp } from './math';
import packOpenSample from '../../Audio/cards-pack-open-2.ogg';
import rerollSample from '../../Audio/rollover1.ogg';
import chipLay1 from '../../Audio/chip-lay-1.ogg';
import chipLay2 from '../../Audio/chip-lay-2.ogg';
import chipsStack1 from '../../Audio/chips-stack-1.ogg';
import chipsStack2 from '../../Audio/chips-stack-2.ogg';
import chipsStack3 from '../../Audio/chips-stack-3.ogg';
import chipsStack5 from '../../Audio/chips-stack-5.ogg';
import chipsStack6 from '../../Audio/chips-stack-6.ogg';
import chipsHandle1 from '../../Audio/chips-handle-1.ogg';
import chipsHandle2 from '../../Audio/chips-handle-2.ogg';
import chipsHandle3 from '../../Audio/chips-handle-3.ogg';
import chipsHandle4 from '../../Audio/chips-handle-4.ogg';
import chipsCollide1 from '../../Audio/chips-collide-1.ogg';
import chipsCollide2 from '../../Audio/chips-collide-2.ogg';
import chipsCollide3 from '../../Audio/chips-collide-3.ogg';
import chipsCollide4 from '../../Audio/chips-collide-4.ogg';

export type SfxName =
  | 'tilePop' | 'countTick' | 'jokerBlip' | 'stamp' | 'multFill' | 'totalRoll'
  | 'clearFanfare' | 'failSting'
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'tileDeal' | 'dragSnap' | 'discardSwoosh'
  | 'submitThock' | 'buttonPress' | 'transitionWhoosh'
  | 'purchase' | 'sell' | 'reroll' | 'packOpen' | 'voucherRedeem' | 'catMeow'
  | 'tagSpawn' | 'gameOver' | 'gameClear' | 'rainbowShimmer'
  | 'jokerChips' | 'jokerMult' | 'jokerEffect'
  // D-3 ambient desk objects (feature-03): each click plays its own small sound.
  | 'deskCup' | 'deskBell' | 'deskCheck' | 'deskPour' | 'deskKeycap' | 'deskWaxCrunch'
  // feature-04 A-1 · money is never silent — a rising coin gain / falling coin loss,
  // distinguishable by contour, fired centrally on every gold change.
  | 'coinGain' | 'coinLoss'
  // feature-04 A-3 · object actions get an audible confirm.
  | 'consumableUse' | 'packPick'
  // feature-04 A-2 · per-material tile voices (played on selection AND when the tile
  // triggers during scoring). Mapped from TileMaterial via MATERIAL_SFX below.
  | 'matCeramic' | 'matPorcelain' | 'matChime' | 'matGlass' | 'matGlassBreak' | 'matStone'
  | 'matThunk' | 'matTock' | 'matRing' | 'matWood' | 'matDiceRattle';

type Wave = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

interface ToneLayer {
  wave: Wave;
  from: number;
  to?: number;
  delay?: number;
  detune?: number;
  sub?: boolean;
  gain?: number;
  dur?: number;
  attack?: number;
}

interface NoiseLayer {
  cutoff: number;
  to?: number;
  filter?: BiquadFilterType;
  q?: number;
  delay?: number;
  gain?: number;
  dur?: number;
  attack?: number;
  color?: 'white' | 'brown';
}

interface Recipe {
  /** base loudness 0..1, before master/sfx scaling */
  gain: number;
  /** overall length in seconds */
  dur: number;
  /** one or more tone layers; noise adds a filtered-noise burst */
  /** `delay` (seconds from recipe start) lets tones SEQUENCE (e.g. a coin jingle);
   *  omitted = starts at the recipe onset like before. */
  /** `detune` (cents) spawns a ±-detuned twin pair for chorus/body; `sub` adds a
   *  quiet sine one octave below for warmth. Both optional; omitted = single tone. */
  tones?: ToneLayer[];
  noise?: NoiseLayer | NoiseLayer[];
  /** Physical one-shot renderer: per-layer envelopes, resonances and filtered
   * noise bursts instead of one shared chiptune envelope. */
  textured?: boolean;
  cutoff?: number;
  /** 'music' routes through the music bus (none in phase 1) */
  bus?: 'sfx' | 'music';
}

// Chiptune palette: square/triangle blips, short envelopes, a couple of noise
// swooshes. Frequencies in Hz; `to` sweeps the pitch across `dur`.
const RECIPES: Record<SfxName, Recipe> = {
  tilePop:          { gain: 0.22, dur: 0.07, tones: [{ wave: 'square', from: 520, to: 640 }] },
  countTick:        { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 440 }] },
  jokerBlip:        { gain: 0.25, dur: 0.10, tones: [{ wave: 'triangle', from: 660, to: 990 }] },
  stamp:            { gain: 0.30, dur: 0.12, tones: [{ wave: 'square', from: 180, to: 120 }], noise: { cutoff: 900 } },
  multFill:         { gain: 0.24, dur: 0.14, tones: [{ wave: 'sawtooth', from: 300, to: 720 }] },
  totalRoll:        { gain: 0.20, dur: 0.20, tones: [{ wave: 'square', from: 400, to: 880 }] },
  clearFanfare:     { gain: 0.32, dur: 0.40, tones: [{ wave: 'square', from: 523 }, { wave: 'square', from: 784 }, { wave: 'triangle', from: 1046 }] },
  failSting:        { gain: 0.30, dur: 0.35, tones: [{ wave: 'sawtooth', from: 300, to: 90 }] },
  tilePick:         { gain: 0.18, dur: 0.05, tones: [{ wave: 'triangle', from: 600 }] },
  tilePlace:        { gain: 0.18, dur: 0.05, tones: [{ wave: 'triangle', from: 400 }] },
  tileSelect:       { gain: 0.24, dur: 0.07, tones: [{ wave: 'square', from: 150, to: 90, sub: true }], noise: { cutoff: 1400 } },
  tileDeal:         { gain: 0.17, dur: 0.08, tones: [{ wave: 'triangle', from: 480, to: 340, detune: 8, sub: true }], noise: { cutoff: 1800 } },
  dragSnap:         { gain: 0.16, dur: 0.05, tones: [{ wave: 'square', from: 300, to: 500 }] },
  discardSwoosh:    { gain: 0.24, dur: 0.18, noise: { cutoff: 1600 } },
  submitThock:      { gain: 0.30, dur: 0.10, tones: [{ wave: 'square', from: 160, to: 90 }], noise: { cutoff: 700 } },
  buttonPress:      { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 380, to: 300 }] },
  transitionWhoosh: { gain: 0.20, dur: 0.22, noise: { cutoff: 1200 } },
  purchase: {
    gain: 0.28, dur: 0.30, textured: true, cutoff: 7600,
    tones: [
      { wave: 'sine', from: 105, to: 72, gain: 0.7, dur: 0.16, sub: true },
      { wave: 'sine', from: 310, to: 250, gain: 0.22, delay: 0.015, dur: 0.09 },
    ],
    noise: [
      { cutoff: 2400, to: 900, filter: 'bandpass', gain: 0.42, dur: 0.08 },
      { cutoff: 4200, to: 1800, filter: 'highpass', gain: 0.18, delay: 0.11, dur: 0.13 },
    ],
  },
  sell: {
    gain: 0.25, dur: 0.28, textured: true, cutoff: 8000,
    tones: [{ wave: 'sine', from: 82, to: 108, gain: 0.55, delay: 0.08, dur: 0.16, sub: true }],
    noise: [
      { cutoff: 1800, to: 5200, filter: 'bandpass', gain: 0.34, dur: 0.15, attack: 0.01 },
      { cutoff: 700, to: 350, filter: 'lowpass', color: 'brown', gain: 0.28, delay: 0.08, dur: 0.15 },
    ],
  },
  reroll: {
    gain: 0.24, dur: 0.30, textured: true, cutoff: 8500,
    tones: [{ wave: 'sine', from: 118, to: 92, gain: 0.34, delay: 0.18, dur: 0.10 }],
    noise: [
      { cutoff: 2700, to: 900, filter: 'bandpass', gain: 0.38, dur: 0.07 },
      { cutoff: 3100, to: 1000, filter: 'bandpass', gain: 0.34, delay: 0.055, dur: 0.07 },
      { cutoff: 2500, to: 800, filter: 'bandpass', gain: 0.36, delay: 0.11, dur: 0.08 },
      { cutoff: 650, filter: 'lowpass', color: 'brown', gain: 0.22, delay: 0.18, dur: 0.10 },
    ],
  },
  packOpen: {
    gain: 0.32, dur: 0.48, textured: true, cutoff: 11000,
    tones: [{ wave: 'sine', from: 92, to: 62, gain: 0.32, delay: 0.30, dur: 0.14, sub: true }],
    noise: [
      { cutoff: 1300, to: 6400, filter: 'highpass', gain: 0.62, dur: 0.31, attack: 0.012 },
      { cutoff: 2300, to: 850, filter: 'bandpass', gain: 0.32, delay: 0.27, dur: 0.08 },
      { cutoff: 2600, to: 900, filter: 'bandpass', gain: 0.28, delay: 0.33, dur: 0.08 },
      { cutoff: 2100, to: 700, filter: 'bandpass', gain: 0.24, delay: 0.39, dur: 0.08 },
    ],
  },
  voucherRedeem:    { gain: 0.28, dur: 0.24, tones: [{ wave: 'triangle', from: 660 }, { wave: 'triangle', from: 990 }] },
  catMeow:          { gain: 0.30, dur: 0.30, tones: [{ wave: 'sawtooth', from: 620, to: 780 }] },
  tagSpawn: {
    gain: 0.30, dur: 0.42, textured: true, cutoff: 8500,
    tones: [
      { wave: 'sine', from: 78, to: 48, gain: 0.8, dur: 0.18, sub: true },
      { wave: 'sine', from: 620, to: 590, gain: 0.18, delay: 0.12, dur: 0.22 },
    ],
    noise: [
      { cutoff: 520, to: 260, filter: 'lowpass', color: 'brown', gain: 0.65, dur: 0.16 },
      { cutoff: 1800, to: 5200, filter: 'bandpass', gain: 0.22, delay: 0.12, dur: 0.20, attack: 0.008 },
    ],
  },
  gameOver:         { gain: 0.34, dur: 0.72, tones: [{ wave: 'sawtooth', from: 330, to: 82 }, { wave: 'triangle', from: 220, to: 110, delay: 0.18, sub: true }], noise: { cutoff: 700 } },
  gameClear:        { gain: 0.34, dur: 0.78, tones: [{ wave: 'triangle', from: 523, detune: 6 }, { wave: 'triangle', from: 659, delay: 0.12, detune: 6 }, { wave: 'triangle', from: 784, delay: 0.24, detune: 6 }, { wave: 'sine', from: 1046, delay: 0.38 }] },
  rainbowShimmer: {
    gain: 0.26, dur: 0.82, textured: true, cutoff: 12000,
    tones: [
      { wave: 'sine', from: 1174, to: 1148, gain: 0.42, dur: 0.58, detune: 5 },
      { wave: 'sine', from: 1763, to: 1728, gain: 0.30, delay: 0.07, dur: 0.62, detune: 7 },
      { wave: 'sine', from: 2637, to: 2580, gain: 0.22, delay: 0.16, dur: 0.60 },
      { wave: 'sine', from: 3520, to: 3450, gain: 0.13, delay: 0.25, dur: 0.50 },
    ],
    noise: { cutoff: 5200, to: 10000, filter: 'highpass', gain: 0.07, dur: 0.48, attack: 0.08 },
  },
  jokerChips: {
    gain: 0.29, dur: 0.22, textured: true, cutoff: 9000,
    tones: [
      { wave: 'sine', from: 720, to: 660, gain: 0.55, dur: 0.075 },
      { wave: 'sine', from: 1260, to: 1160, gain: 0.26, dur: 0.065 },
      { wave: 'sine', from: 680, to: 620, gain: 0.48, delay: 0.075, dur: 0.085 },
      { wave: 'sine', from: 1190, to: 1080, gain: 0.22, delay: 0.075, dur: 0.075 },
    ],
    noise: [
      { cutoff: 2400, filter: 'bandpass', gain: 0.24, dur: 0.045 },
      { cutoff: 2100, filter: 'bandpass', gain: 0.20, delay: 0.075, dur: 0.05 },
    ],
  },
  jokerMult: {
    gain: 0.32, dur: 0.34, textured: true, cutoff: 3200,
    tones: [
      { wave: 'sine', from: 74, to: 42, gain: 0.9, dur: 0.30, sub: true },
      { wave: 'triangle', from: 148, to: 82, gain: 0.28, dur: 0.18 },
    ],
    noise: { cutoff: 460, to: 180, filter: 'lowpass', color: 'brown', gain: 0.58, dur: 0.24 },
  },
  jokerEffect: {
    gain: 0.24, dur: 0.13, textured: true, cutoff: 10000,
    tones: [{ wave: 'sine', from: 290, to: 210, gain: 0.28, dur: 0.055 }],
    noise: [
      { cutoff: 3200, filter: 'highpass', gain: 0.55, dur: 0.025 },
      { cutoff: 2300, filter: 'bandpass', gain: 0.30, delay: 0.038, dur: 0.04 },
    ],
  },
  // D-3 desk objects use short physical layers instead of UI-note contours.
  deskCup: {
    gain: 0.4, dur: 0.86, textured: true, cutoff: 6200,
    tones: [
      { wave: 'sine', from: 175, to: 92, gain: 0.24, delay: 0.18, dur: 0.3, sub: true },
      { wave: 'sine', from: 145, to: 72, gain: 0.2, delay: 0.5, dur: 0.25, sub: true },
    ],
    noise: [
      { cutoff: 3600, to: 620, filter: 'bandpass', q: 0.6, gain: 0.72, dur: 0.72, attack: 0.035 },
      { cutoff: 1100, to: 330, filter: 'lowpass', color: 'brown', gain: 0.62, delay: 0.12, dur: 0.68, attack: 0.02 },
    ],
  },
  deskBell: {
    gain: 0.4, dur: 1.12, textured: true, cutoff: 12000,
    tones: [
      { wave: 'sine', from: 890, to: 872, gain: 0.95, dur: 1.05, attack: 0.001 },
      { wave: 'sine', from: 1768, to: 1735, gain: 0.5, delay: 0.002, dur: 0.88, attack: 0.001 },
      { wave: 'sine', from: 2475, to: 2410, gain: 0.3, delay: 0.004, dur: 0.62, attack: 0.001 },
      { wave: 'sine', from: 3260, to: 3150, gain: 0.16, delay: 0.006, dur: 0.38, attack: 0.001 },
    ],
    noise: [{ cutoff: 6800, filter: 'highpass', gain: 0.32, dur: 0.018, attack: 0.001 }],
  },
  deskCheck: {
    gain: 0.34, dur: 0.1, textured: true, cutoff: 7000,
    noise: [
      { cutoff: 2600, to: 1500, filter: 'bandpass', q: 1.5, color: 'brown', gain: 0.82, dur: 0.085, attack: 0.004 },
      { cutoff: 5200, filter: 'highpass', gain: 0.22, delay: 0.012, dur: 0.045 },
    ],
  },
  deskPour: {
    gain: 0.42, dur: 0.9, textured: true, cutoff: 9000,
    noise: [
      { cutoff: 6200, to: 1800, filter: 'bandpass', q: 0.5, gain: 0.9, dur: 0.82, attack: 0.055 },
      { cutoff: 8500, to: 3800, filter: 'highpass', gain: 0.34, delay: 0.03, dur: 0.72, attack: 0.04 },
      { cutoff: 1500, to: 420, filter: 'lowpass', color: 'brown', gain: 0.48, delay: 0.1, dur: 0.74, attack: 0.03 },
      { cutoff: 4200, filter: 'bandpass', gain: 0.55, delay: 0.22, dur: 0.05 },
      { cutoff: 3600, filter: 'bandpass', gain: 0.48, delay: 0.52, dur: 0.06 },
    ],
  },
  deskKeycap: {
    gain: 0.5, dur: 0.16, textured: true, cutoff: 10000,
    tones: [
      { wave: 'sine', from: 210, to: 135, gain: 0.48, dur: 0.038, attack: 0.001 },
      { wave: 'sine', from: 620, to: 410, gain: 0.3, delay: 0.074, dur: 0.042, attack: 0.001 },
    ],
    noise: [
      { cutoff: 5200, filter: 'highpass', gain: 0.9, dur: 0.022, attack: 0.001 },
      { cutoff: 3900, filter: 'bandpass', q: 1.7, gain: 0.72, delay: 0.072, dur: 0.032, attack: 0.001 },
    ],
  },
  deskWaxCrunch: {
    gain: 0.5, dur: 0.4, textured: true, cutoff: 7800,
    tones: [{ wave: 'sine', from: 130, to: 68, gain: 0.42, dur: 0.18, sub: true }],
    noise: [
      { cutoff: 2500, to: 780, filter: 'bandpass', q: 1.2, color: 'brown', gain: 1, dur: 0.085 },
      { cutoff: 4600, to: 1550, filter: 'bandpass', q: 1, gain: 0.92, delay: 0.045, dur: 0.095 },
      { cutoff: 1850, to: 480, filter: 'lowpass', color: 'brown', gain: 0.88, delay: 0.12, dur: 0.15 },
      { cutoff: 5200, to: 1350, filter: 'bandpass', gain: 0.7, delay: 0.22, dur: 0.09 },
      { cutoff: 3100, to: 900, filter: 'bandpass', color: 'brown', gain: 0.52, delay: 0.3, dur: 0.075 },
    ],
  },
  // Struck-metal partials plus a tiny contact transient: coins, not UI notes.
  coinGain: {
    gain: 0.27, dur: 0.38, textured: true, cutoff: 11000,
    tones: [
      { wave: 'sine', from: 1320, to: 1275, gain: 0.54, dur: 0.24, detune: 3 },
      { wave: 'sine', from: 2245, to: 2170, gain: 0.24, dur: 0.19 },
      { wave: 'sine', from: 1580, to: 1520, gain: 0.48, delay: 0.075, dur: 0.25, detune: 3 },
      { wave: 'sine', from: 2680, to: 2570, gain: 0.20, delay: 0.075, dur: 0.20 },
    ],
    noise: [
      { cutoff: 5200, filter: 'highpass', gain: 0.17, dur: 0.025 },
      { cutoff: 5600, filter: 'highpass', gain: 0.14, delay: 0.075, dur: 0.025 },
    ],
  },
  coinLoss: {
    gain: 0.25, dur: 0.38, textured: true, cutoff: 10500,
    tones: [
      { wave: 'sine', from: 1510, to: 1430, gain: 0.50, dur: 0.23, detune: 3 },
      { wave: 'sine', from: 2550, to: 2380, gain: 0.22, dur: 0.18 },
      { wave: 'sine', from: 1120, to: 1010, gain: 0.46, delay: 0.085, dur: 0.24, detune: 3 },
      { wave: 'sine', from: 1900, to: 1720, gain: 0.18, delay: 0.085, dur: 0.18 },
    ],
    noise: [
      { cutoff: 5200, filter: 'highpass', gain: 0.16, dur: 0.025 },
      { cutoff: 4700, filter: 'highpass', gain: 0.13, delay: 0.085, dur: 0.025 },
    ],
  },
  // A-3 object actions.
  consumableUse:    { gain: 0.26, dur: 0.22, tones: [{ wave: 'triangle', from: 523 }, { wave: 'triangle', from: 784, delay: 0.06 }, { wave: 'sine', from: 1046, delay: 0.12 }] },
  packPick:         { gain: 0.24, dur: 0.12, tones: [{ wave: 'square', from: 660, to: 990 }] },
  // Each material is an impact model: contact noise + its own damped resonances.
  matCeramic: {
    gain: 0.23, dur: 0.20, textured: true, cutoff: 8500,
    tones: [
      { wave: 'sine', from: 930, to: 875, gain: 0.55, dur: 0.16 },
      { wave: 'sine', from: 1620, to: 1510, gain: 0.24, dur: 0.12 },
    ],
    noise: { cutoff: 2600, filter: 'bandpass', gain: 0.25, dur: 0.035 },
  },
  matPorcelain: {
    gain: 0.22, dur: 0.30, textured: true, cutoff: 10500,
    tones: [
      { wave: 'sine', from: 1360, to: 1310, gain: 0.52, dur: 0.25, detune: 2 },
      { wave: 'sine', from: 2380, to: 2290, gain: 0.23, dur: 0.20 },
    ],
    noise: { cutoff: 4100, filter: 'bandpass', gain: 0.17, dur: 0.028 },
  },
  matChime: {
    gain: 0.21, dur: 0.34, textured: true, cutoff: 10000,
    tones: [
      { wave: 'sine', from: 820, to: 800, gain: 0.42, dur: 0.30, detune: 4 },
      { wave: 'sine', from: 1480, to: 1440, gain: 0.17, dur: 0.24 },
    ],
    noise: { cutoff: 3600, to: 6200, filter: 'highpass', gain: 0.10, dur: 0.10, attack: 0.015 },
  },
  matGlass: {
    gain: 0.22, dur: 0.48, textured: true, cutoff: 12000,
    tones: [
      { wave: 'sine', from: 1480, to: 1450, gain: 0.42, dur: 0.42, detune: 2 },
      { wave: 'sine', from: 2370, to: 2320, gain: 0.25, dur: 0.36 },
      { wave: 'sine', from: 3610, to: 3520, gain: 0.12, dur: 0.27 },
    ],
    noise: { cutoff: 6200, filter: 'highpass', gain: 0.12, dur: 0.025 },
  },
  matGlassBreak: {
    gain: 0.33, dur: 0.52, textured: true, cutoff: 13000,
    tones: [
      { wave: 'sine', from: 3100, to: 1450, gain: 0.18, delay: 0.03, dur: 0.18 },
      { wave: 'sine', from: 4200, to: 1800, gain: 0.13, delay: 0.11, dur: 0.16 },
      { wave: 'sine', from: 2700, to: 1200, gain: 0.11, delay: 0.19, dur: 0.14 },
    ],
    noise: [
      { cutoff: 1800, to: 8500, filter: 'highpass', gain: 0.65, dur: 0.22 },
      { cutoff: 5400, to: 2400, filter: 'bandpass', gain: 0.28, delay: 0.16, dur: 0.20 },
      { cutoff: 4200, to: 1800, filter: 'bandpass', gain: 0.20, delay: 0.29, dur: 0.16 },
    ],
  },
  matStone: {
    gain: 0.30, dur: 0.30, textured: true, cutoff: 2200,
    tones: [{ wave: 'sine', from: 92, to: 48, gain: 0.75, dur: 0.27, sub: true }],
    noise: [
      { cutoff: 420, to: 170, filter: 'lowpass', color: 'brown', gain: 0.72, dur: 0.22 },
      { cutoff: 1100, to: 480, filter: 'bandpass', gain: 0.20, dur: 0.08 },
    ],
  },
  matThunk: {
    gain: 0.31, dur: 0.34, textured: true, cutoff: 3000,
    tones: [
      { wave: 'sine', from: 68, to: 38, gain: 0.82, dur: 0.31, sub: true },
      { wave: 'sine', from: 285, to: 210, gain: 0.20, dur: 0.16 },
    ],
    noise: { cutoff: 620, to: 260, filter: 'lowpass', color: 'brown', gain: 0.58, dur: 0.24 },
  },
  matTock: {
    gain: 0.24, dur: 0.24, textured: true, cutoff: 6400,
    tones: [
      { wave: 'sine', from: 460, to: 390, gain: 0.55, dur: 0.19 },
      { wave: 'sine', from: 760, to: 650, gain: 0.20, dur: 0.14 },
    ],
    noise: { cutoff: 1800, filter: 'bandpass', gain: 0.30, dur: 0.045 },
  },
  matRing: {
    gain: 0.24, dur: 0.58, textured: true, cutoff: 11000,
    tones: [
      { wave: 'sine', from: 730, to: 710, gain: 0.48, dur: 0.52, detune: 3 },
      { wave: 'sine', from: 1170, to: 1135, gain: 0.27, dur: 0.44 },
      { wave: 'sine', from: 1910, to: 1840, gain: 0.15, dur: 0.34 },
    ],
    noise: { cutoff: 4600, filter: 'highpass', gain: 0.12, dur: 0.03 },
  },
  matWood: {
    gain: 0.27, dur: 0.22, textured: true, cutoff: 4200,
    tones: [
      { wave: 'sine', from: 280, to: 210, gain: 0.55, dur: 0.16 },
      { wave: 'sine', from: 510, to: 390, gain: 0.16, dur: 0.11 },
    ],
    noise: { cutoff: 980, to: 420, filter: 'bandpass', color: 'brown', gain: 0.48, dur: 0.10 },
  },
  matDiceRattle: {
    gain: 0.27, dur: 0.38, textured: true, cutoff: 9000,
    tones: [
      { wave: 'sine', from: 720, to: 590, gain: 0.22, dur: 0.05 },
      { wave: 'sine', from: 920, to: 710, gain: 0.20, delay: 0.07, dur: 0.05 },
      { wave: 'sine', from: 650, to: 520, gain: 0.20, delay: 0.14, dur: 0.05 },
      { wave: 'sine', from: 830, to: 630, gain: 0.18, delay: 0.21, dur: 0.06 },
    ],
    noise: [
      { cutoff: 2800, filter: 'bandpass', gain: 0.28, dur: 0.04 },
      { cutoff: 3400, filter: 'bandpass', gain: 0.25, delay: 0.07, dur: 0.04 },
      { cutoff: 2500, filter: 'bandpass', gain: 0.24, delay: 0.14, dur: 0.04 },
      { cutoff: 3100, filter: 'bandpass', gain: 0.22, delay: 0.21, dur: 0.05 },
    ],
  },
};

export const SFX_NAMES = Object.keys(RECIPES) as readonly SfxName[];
const SAMPLES: Partial<Record<SfxName, string>> = {
  packOpen: packOpenSample,
  reroll: rerollSample,
};
export const SAMPLED_SFX_NAMES = Object.keys(SAMPLES) as readonly SfxName[];
export type ChipSoundTier = 'lay' | 'stack' | 'handle' | 'collide';
const CHIP_SAMPLES: Record<ChipSoundTier, readonly string[]> = {
  lay: [chipLay1, chipLay2],
  stack: [chipsStack1, chipsStack2, chipsStack3, chipsStack5, chipsStack6],
  handle: [chipsHandle1, chipsHandle2, chipsHandle3, chipsHandle4],
  collide: [chipsCollide1, chipsCollide2, chipsCollide3, chipsCollide4],
};

/** Denser chip recordings track the magnitude of the Chips operation. */
export function chipSoundTier(chips: number): ChipSoundTier {
  const amount = Math.abs(chips);
  if (amount <= 10) return 'lay';
  if (amount <= 40) return 'stack';
  if (amount <= 100) return 'handle';
  return 'collide';
}
export const TEXTURED_SFX_NAMES = Object.entries(RECIPES)
  .filter(([, recipe]) => recipe.textured)
  .map(([name]) => name as SfxName);

/**
 * feature-04 A-2 · TileMaterial → its voice. The map lives in the facade (never
 * call-site branching, per the work order); any material without an entry falls
 * back to the default tile sound so nothing is ever silent. Keyed by the engine's
 * TileMaterial string (kept loose to avoid an engine import in the audio layer).
 */
export const MATERIAL_SFX: Record<string, SfxName> = {
  ceramic: 'matCeramic',
  porcelain: 'matPorcelain',
  polished: 'matChime',
  glass: 'matGlass',
  stone: 'matStone',
  leadPlate: 'matThunk',
  ivory: 'matTock',
  brass: 'matRing',
  wood: 'matWood',
};


// ---------------------------------------------------------------------------
// BGM (work order B phase 2) — a tiny looping chiptune sequencer. Menu and run
// each keep one loop. The shop keeps the run loop playing through a low-pass;
// Deadline/boss blinds deliberately keep the ordinary run music.
// ---------------------------------------------------------------------------

export type MusicTrack = 'menu' | 'play';

/** BGM sits UNDER the SFX in the mix; this scales the whole music bus. */
const MUSIC_HEADROOM = 0.5;
const MUSIC_FILTER_OPEN_HZ = 5000;
const MUSIC_FILTER_MUFFLED_HZ = 560;
const MUSIC_FILTER_RAMP_SECONDS = 0.08;

/** Note name ("C3", "F#4") → frequency in Hz. Rests are represented as null. Exposed for tests. */
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteHz(name: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = (Number(m[3]) + 1) * 12 + SEMI[m[1]!]! + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface Voice {
  wave: Wave;
  gain: number;
  /** cents; when set, a detuned twin oscillator thickens the voice (chorus). */
  detune?: number;
  /** one note per 16th-step; null = rest. Loops when the sequencer wraps. */
  steps: (string | null)[];
}
interface TrackDef {
  bpm: number;
  voices: Voice[];
}

// 16-step (one-bar) loops. Placeholder chiptune — bass + lead, key of C/Am.
// `_` reads as a rest for legibility; expanded to null below.
const R = null;
export const MUSIC_TRACKS = ['menu', 'play'] as const;
export const MUSIC: Record<MusicTrack, TrackDef> = {
  // Calm major arpeggio — title/menu.
  menu: {
    bpm: 76,
    voices: [
      { wave: 'triangle', gain: 0.16, detune: 7, steps: ['C4', R, R, 'E4', R, R, 'G4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.09, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
      { wave: 'sine',     gain: 0.06, steps: ['C3', R, R, R, 'A2', R, R, R, 'F2', R, R, R, 'G2', R, R, R] },
    ],
  },
  // Upbeat driving loop — the play board.
  play: {
    bpm: 96,
    voices: [
      { wave: 'triangle', gain: 0.15, detune: 7, steps: ['C4', R, 'E4', 'G4', R, 'E4', 'C4', R, 'D4', R, 'F4', 'A4', R, 'G4', 'E4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
      { wave: 'sine',     gain: 0.06, steps: ['C3', R, R, R, 'A2', R, R, R, 'F2', R, R, R, 'G2', R, R, R] },
    ],
  },
};

/**
 * Re-sync a lookahead sequencer after the timer driving it was throttled.
 *
 * Browsers clamp background-tab `setInterval` to ~1s while the AudioContext
 * clock keeps advancing, so on return the next scheduled step sits in the PAST.
 * Scheduling the missed steps anyway fires them all at once — an audible burst.
 * Skip them instead, advancing the step index by the same amount so the loop
 * keeps its phase rather than restarting mid-bar.
 *
 * Returns the input unchanged when nothing was missed. Pure, so the burst case
 * is testable without a real AudioContext.
 */
export function catchUpSequencer(
  nextStepTime: number,
  currentStep: number,
  now: number,
  secPerStep: number,
  steps: number,
): { nextStepTime: number; currentStep: number; skipped: number } {
  if (nextStepTime >= now || secPerStep <= 0 || steps <= 0) {
    return { nextStepTime, currentStep, skipped: 0 };
  }
  const skipped = Math.ceil((now - nextStepTime) / secPerStep);
  return {
    nextStepTime: nextStepTime + skipped * secPerStep,
    currentStep: (currentStep + skipped) % steps,
    skipped,
  };
}

/** Pure gain computation — master × group × recipe, each 0..1. Exposed for tests. */
export function effectiveGain(
  name: SfxName,
  v: { master: number; music: number; sfx: number },
): number {
  const r = RECIPES[name];
  const group = r.bus === 'music' ? v.music : v.sfx;
  return clamp(v.master, 0, 100) / 100 * (clamp(group, 0, 100) / 100) * r.gain;
}

class Audio {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private vol = { master: 80, music: 70, sfx: 80 };
  // BGM state (phase 2). The music bus is a single gain node all notes route
  // through; a lookahead scheduler retriggers the current track's loop.
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicMuffled = false;
  private currentTrack: MusicTrack | null = null;
  private pendingTrack: MusicTrack | null = null; // requested before the gesture unlock
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  // Chromatic unlock gating (feature-02 C-6): the game starts SILENT — the SFX and
  // music buses are OFF until the SOUND / MUSIC words are played (or the Settings
  // override enables them). setBusEnabled flips these; play()/playMusic() respect them.
  private busEnabled = { sfx: false, music: false };
  private chipSampleIndex = 0;

  constructor() {
    // Install the one-shot unlock gesture listener as soon as this module loads
    // in a browser. Guarded for Node/SSR where `window` is undefined.
    if (typeof window !== 'undefined') {
      const onGesture = () => this.unlock();
      window.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
    }
  }

  private AC(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
  }

  unlock(): void {
    const AC = this.AC();
    if (!AC) return; // no Web Audio (Node/tests) — stay a no-op
    if (!this.ctx) {
      try { this.ctx = new AC(); } catch { return; }
    }
    const done = () => {
      this.unlocked = true;
      // A track requested before the gesture starts now (playMusic no-ops on a
      // double call, so the sync + async paths are safe).
      if (this.pendingTrack) this.playMusic(this.pendingTrack);
    };
    void this.ctx.resume().then(done).catch(() => {});
    // Some browsers resume synchronously; reflect that immediately too.
    if (this.ctx.state === 'running') done();
  }

  isUnlocked(): boolean { return this.unlocked; }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.vol = {
      master: clamp(v.master, 0, 100),
      music: clamp(v.music, 0, 100),
      sfx: clamp(v.sfx, 0, 100),
    };
    this.updateMusicGain(); // live-apply to a playing track
  }

  // ----- BGM (phase 2) -----

  /** Start (or switch to) a looping track. No-ops if it's already the current
   *  track; before the audio gesture-unlock it's remembered and starts on unlock. */
  playMusic(track: MusicTrack): void {
    if (this.currentTrack === track && this.schedTimer !== null) return;
    if (!this.ctx || !this.unlocked) { this.pendingTrack = track; return; }
    this.stopScheduler();
    this.currentTrack = track; // remembered even when the bus is gated off (C-6)
    this.pendingTrack = null;
    if (!this.busEnabled.music) return; // MUSIC not unlocked yet → hold the track
    this.ensureMusicGraph();
    this.startScheduler();
  }

  /** Stop BGM and fade out any notes still ringing. */
  stopMusic(): void {
    this.pendingTrack = null;
    this.currentTrack = null;
    this.stopScheduler();
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
  }

  private ensureMusicGraph(): void {
    if (!this.ctx) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.Q.value = 0.9;
      this.musicGain.connect(this.musicFilter).connect(this.ctx.destination);
    }
    this.updateMusicFilter();
    this.updateMusicGain();
  }

  /** Keep the current track running while smoothly closing/opening the music
   * low-pass. Shop entry owns this flag; it never swaps the composition. */
  setMusicMuffled(muffled: boolean): void {
    this.musicMuffled = muffled;
    this.updateMusicFilter();
  }

  private updateMusicFilter(): void {
    if (!this.ctx || !this.musicFilter) return;
    this.musicFilter.frequency.setTargetAtTime(
      this.musicMuffled ? MUSIC_FILTER_MUFFLED_HZ : MUSIC_FILTER_OPEN_HZ,
      this.ctx.currentTime,
      MUSIC_FILTER_RAMP_SECONDS,
    );
  }

  private updateMusicGain(): void {
    if (!this.ctx || !this.musicGain) return;
    const level =
      clamp(this.vol.master, 0, 100) / 100 *
      (clamp(this.vol.music, 0, 100) / 100) *
      MUSIC_HEADROOM;
    this.musicGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.03);
  }

  private stopScheduler(): void {
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
  }

  private startScheduler(): void {
    if (!this.ctx || !this.currentTrack) return;
    const track = MUSIC[this.currentTrack];
    const secPerStep = 60 / track.bpm / 4; // 16th-note grid
    const steps = track.voices[0]?.steps.length ?? 16;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.currentStep = 0;
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const now = this.ctx.currentTime;
      // Drop anything a throttled background tab made us miss (see above).
      const synced = catchUpSequencer(this.nextStepTime, this.currentStep, now, secPerStep, steps);
      this.nextStepTime = synced.nextStepTime;
      this.currentStep = synced.currentStep;
      const horizon = now + 0.12; // schedule ~120ms ahead
      while (this.nextStepTime < horizon) {
        this.scheduleStep(track, this.currentStep, this.nextStepTime, secPerStep);
        this.nextStepTime += secPerStep;
        this.currentStep = (this.currentStep + 1) % steps;
      }
    };
    tick();
    this.schedTimer = setInterval(tick, 25);
  }

  private scheduleStep(track: TrackDef, step: number, when: number, secPerStep: number): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dur = secPerStep * 0.9; // slight gap between notes
    for (const v of track.voices) {
      const name = v.steps[step];
      if (!name) continue;
      const hz = noteHz(name);
      if (!hz) continue;
      // Main oscillator + optional detuned twin (chorus body for leads). The peak is
      // divided across the layers so a detuned voice thickens WITHOUT doubling loudness.
      const dets = v.detune ? [0, v.detune] : [0];
      const peak = v.gain / dets.length;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      g.connect(this.musicGain);
      for (const d of dets) {
        const osc = ctx.createOscillator();
        osc.type = v.wave;
        osc.frequency.setValueAtTime(hz, when);
        if (d) osc.detune.setValueAtTime(d, when);
        osc.connect(g);
        osc.start(when);
        osc.stop(when + dur);
      }
    }
  }

  /** Enable/disable a bus (chromatic unlock, C-6). SFX off by default (silent start). */
  setBusEnabled(bus: 'sfx' | 'music', enabled: boolean): void {
    this.busEnabled[bus] = enabled;
    if (bus === 'music') {
      if (enabled) {
        // resume the requested track if one is queued but not scheduling
        if (this.currentTrack && this.schedTimer === null) {
          this.ensureMusicGraph();
          this.startScheduler();
        }
      } else {
        this.stopScheduler();
        if (this.ctx && this.musicGain) {
          this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
        }
      }
    }
  }

  isBusEnabled(bus: 'sfx' | 'music'): boolean { return this.busEnabled[bus]; }

  /**
   * A-2 · play a tile material's voice. Falls back to the default tile sound for any
   * material without a sample, so a tile is never silent. `step` lets Wood's knock
   * climb as its +Chips grows (the caller passes its growth count).
   */
  material(name: string, opts?: { step?: number }): void {
    this.play(MATERIAL_SFX[name] ?? 'tilePop', opts);
  }

  /** A-1 · money is never silent: a rising coin on gain, a falling one on loss. */
  money(delta: number): void {
    if (delta > 0) this.play('coinGain');
    else if (delta < 0) this.play('coinLoss');
  }

  play(name: SfxName, opts?: { step?: number }): void {
    const sample = SAMPLES[name];
    if (sample) {
      this.playSample(sample, effectiveGain(name, this.vol), () => this.playRecipe(name, opts));
      return;
    }
    this.playRecipe(name, opts);
  }

  /** Play a physical chip sample whose density matches the Chips delta. */
  chips(amount: number): void {
    if (amount === 0) return;
    const samples = CHIP_SAMPLES[chipSoundTier(amount)];
    const sample = samples[this.chipSampleIndex++ % samples.length]!;
    this.playSample(sample, effectiveGain('jokerChips', this.vol));
  }

  private playSample(src: string, gain: number, fallback?: () => void): void {
    if (!this.busEnabled.sfx || !this.unlocked || typeof window === 'undefined' || gain <= 0) return;
    const sound = new window.Audio(src);
    sound.volume = gain;
    void sound.play().catch(() => fallback?.());
  }

  private playRecipe(name: SfxName, opts: { step?: number } | undefined): void {
    if (!this.busEnabled.sfx) return; // gated until SOUND is unlocked (C-6)
    if (!this.ctx || !this.unlocked) return; // pre-gesture / no Web Audio → drop
    const g = effectiveGain(name, this.vol);
    if (g <= 0) return;
    const r = RECIPES[name];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const semis = opts?.step ? Math.min(opts.step, 24) : 0;
    const bend = Math.pow(2, semis / 12);
    if (r.textured) {
      this.playTexturedRecipe(ctx, r, now, g, bend);
      return;
    }
    const out = ctx.createGain();
    // Percussive envelope: softened 12ms attack (was 6ms — removes the tinny click),
    // exponential decay across the recipe dur.
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(g, now + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
    // Global tone rounding: one gentle lowpass warms every SFX (rolls off the harsh
    // upper harmonics of square/saw blips). The noise path keeps its own per-recipe
    // lowpass and is softened further by this one — intended.
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 3000;
    warm.Q.value = 0.7;
    out.connect(warm).connect(ctx.destination);

    for (const t of r.tones ?? []) {
      const start = now + (t.delay ?? 0);
      // Layers: main, optional ±detuned twins, optional sub-octave sine. `weight` is a
      // RELATIVE mix balance — the set is normalized to sum to 1.0 below, so adding twins
      // or a sub thickens the TIMBRE without raising the peak amplitude (warmer, not louder).
      const layers: { freqMul: number; weight: number; det: number; sub: boolean }[] = [
        { freqMul: 1, weight: 1, det: 0, sub: false },
      ];
      if (t.detune) {
        layers.push({ freqMul: 1, weight: 0.7, det: t.detune, sub: false });
        layers.push({ freqMul: 1, weight: 0.7, det: -t.detune, sub: false });
      }
      if (t.sub) layers.push({ freqMul: 0.5, weight: 0.5, det: 0, sub: true });
      const totalWeight = layers.reduce((s, l) => s + l.weight, 0);
      for (const L of layers) {
        const gainMul = L.weight / totalWeight;
        const osc = ctx.createOscillator();
        osc.type = L.sub ? 'sine' : t.wave; // sub is a pure sine for fundamental body
        osc.frequency.setValueAtTime(t.from * bend * L.freqMul, start);
        if (t.to !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(t.to * bend * L.freqMul, now + r.dur);
        }
        if (L.det) osc.detune.setValueAtTime(L.det, start);
        if (gainMul !== 1) {
          const lg = ctx.createGain();
          lg.gain.value = gainMul;
          osc.connect(lg).connect(out);
        } else {
          osc.connect(out);
        }
        osc.start(start);
        osc.stop(now + r.dur);
      }
    }
    if (r.noise && !Array.isArray(r.noise)) {
      const frames = Math.floor(ctx.sampleRate * r.dur);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = r.noise.cutoff;
      src.connect(lp).connect(out);
      src.start(now);
      src.stop(now + r.dur);
    }
  }

  private playTexturedRecipe(
    ctx: AudioContext,
    recipe: Recipe,
    now: number,
    gain: number,
    bend: number,
  ): void {
    const out = ctx.createGain();
    out.gain.value = gain;
    const toneColor = ctx.createBiquadFilter();
    toneColor.type = 'lowpass';
    toneColor.frequency.value = recipe.cutoff ?? 7200;
    toneColor.Q.value = 0.35;
    out.connect(toneColor).connect(ctx.destination);

    const envelope = (
      node: GainNode,
      start: number,
      dur: number,
      peak: number,
      attack: number,
    ) => {
      const top = Math.max(0.0001, peak);
      node.gain.setValueAtTime(0.0001, start);
      node.gain.exponentialRampToValueAtTime(top, start + Math.min(attack, dur * 0.45));
      node.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    };

    for (const tone of recipe.tones ?? []) {
      const start = now + (tone.delay ?? 0);
      const dur = tone.dur ?? Math.max(0.025, recipe.dur - (tone.delay ?? 0));
      const hit = ctx.createGain();
      envelope(hit, start, dur, tone.gain ?? 1, tone.attack ?? 0.003);
      hit.connect(out);
      const voices: { frequency: number; detune: number; wave: Wave; weight: number }[] = [
        { frequency: 1, detune: 0, wave: tone.wave, weight: 1 },
      ];
      if (tone.detune) {
        voices.push({ frequency: 1, detune: tone.detune, wave: tone.wave, weight: 0.65 });
        voices.push({ frequency: 1, detune: -tone.detune, wave: tone.wave, weight: 0.65 });
      }
      if (tone.sub) voices.push({ frequency: 0.5, detune: 0, wave: 'sine', weight: 0.45 });
      const weight = voices.reduce((sum, voice) => sum + voice.weight, 0);
      for (const voice of voices) {
        const osc = ctx.createOscillator();
        osc.type = voice.wave;
        osc.frequency.setValueAtTime(tone.from * bend * voice.frequency, start);
        if (tone.to !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(
            tone.to * bend * voice.frequency,
            start + dur,
          );
        }
        if (voice.detune) osc.detune.setValueAtTime(voice.detune, start);
        const level = ctx.createGain();
        level.gain.value = voice.weight / weight;
        osc.connect(level).connect(hit);
        osc.start(start);
        osc.stop(start + dur);
      }
    }

    const noiseLayers = !recipe.noise
      ? []
      : Array.isArray(recipe.noise) ? recipe.noise : [recipe.noise];
    for (const noise of noiseLayers) {
      const start = now + (noise.delay ?? 0);
      const dur = noise.dur ?? Math.max(0.025, recipe.dur - (noise.delay ?? 0));
      const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < frames; i += 1) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = noise.color === 'brown' ? brown * 3.5 : white;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = noise.filter ?? 'bandpass';
      filter.frequency.setValueAtTime(noise.cutoff, start);
      if (noise.to !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(noise.to, start + dur);
      }
      filter.Q.value = noise.q ?? 0.8;
      const hit = ctx.createGain();
      envelope(hit, start, dur, noise.gain ?? 0.5, noise.attack ?? 0.002);
      source.connect(filter).connect(hit).connect(out);
      source.start(start);
      source.stop(start + dur);
    }
  }
}

export const audio = new Audio();
