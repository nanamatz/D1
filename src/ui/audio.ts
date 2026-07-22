/**
 * Audio facade (work order B, phase 1 — SFX). One module singleton owns the
 * AudioContext and a master→group gain graph; components call `audio.play(name)`.
 *
 * Every sound is SYNTHESIZED (no asset files) via small oscillator/noise recipes,
 * so this whole layer is swappable for real chiptune later without touching a
 * single call site — that is the point of the facade (see assets/AUDIO_LICENSES.md).
 *
 * Autoplay policy: browsers only allow an AudioContext to make sound after a user
 * gesture. We install a one-shot pointerdown/keydown listener that resumes the
 * context; before that, and in Node/tests (no AudioContext), `play` is a silent
 * no-op — never a throw, never a buffer.
 */

export type SfxName =
  | 'tilePop' | 'countTick' | 'jokerBlip' | 'stamp' | 'multFill' | 'totalRoll'
  | 'clearFanfare' | 'failSting'
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'tileDeal' | 'dragSnap' | 'discardSwoosh'
  | 'submitThock' | 'buttonPress' | 'transitionWhoosh'
  | 'purchase' | 'sell' | 'reroll' | 'packOpen' | 'voucherRedeem' | 'catMeow';

type Wave = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

interface Recipe {
  /** base loudness 0..1, before master/sfx scaling */
  gain: number;
  /** overall length in seconds */
  dur: number;
  /** one or more tone layers; noise adds a filtered-noise burst */
  /** `delay` (seconds from recipe start) lets tones SEQUENCE (e.g. a coin jingle);
   *  omitted = starts at the recipe onset like before. */
  tones?: { wave: Wave; from: number; to?: number; delay?: number }[];
  noise?: { cutoff: number };
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
  tileSelect:       { gain: 0.22, dur: 0.06, tones: [{ wave: 'square', from: 150, to: 90 }], noise: { cutoff: 2200 } },
  tileDeal:         { gain: 0.16, dur: 0.07, tones: [{ wave: 'triangle', from: 520, to: 380 }], noise: { cutoff: 3000 } },
  dragSnap:         { gain: 0.16, dur: 0.05, tones: [{ wave: 'square', from: 300, to: 500 }] },
  discardSwoosh:    { gain: 0.24, dur: 0.18, noise: { cutoff: 1600 } },
  submitThock:      { gain: 0.30, dur: 0.10, tones: [{ wave: 'square', from: 160, to: 90 }], noise: { cutoff: 700 } },
  buttonPress:      { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 380, to: 300 }] },
  transitionWhoosh: { gain: 0.20, dur: 0.22, noise: { cutoff: 1200 } },
  purchase:         { gain: 0.26, dur: 0.22, tones: [{ wave: 'triangle', from: 784 }, { wave: 'triangle', from: 1046, delay: 0.05 }, { wave: 'triangle', from: 1318, delay: 0.10 }], noise: { cutoff: 3000 } },
  sell:             { gain: 0.22, dur: 0.16, tones: [{ wave: 'triangle', from: 988 }, { wave: 'triangle', from: 1318, delay: 0.05 }], noise: { cutoff: 2600 } },
  reroll:           { gain: 0.22, dur: 0.12, tones: [{ wave: 'sawtooth', from: 300, to: 600 }] },
  packOpen:         { gain: 0.30, dur: 0.30, tones: [{ wave: 'square', from: 440, to: 880 }], noise: { cutoff: 2000 } },
  voucherRedeem:    { gain: 0.28, dur: 0.24, tones: [{ wave: 'triangle', from: 660 }, { wave: 'triangle', from: 990 }] },
  catMeow:          { gain: 0.30, dur: 0.30, tones: [{ wave: 'sawtooth', from: 620, to: 780 }] },
};

export const SFX_NAMES = Object.keys(RECIPES) as readonly SfxName[];

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// BGM (work order B phase 2) — a tiny looping chiptune SEQUENCER, same synth-only
// philosophy as the SFX above (no asset files → swappable for bespoke tracks
// later, see assets/AUDIO_LICENSES.md). Four loop-safe tracks; the Deadline/boss
// blind swaps to a tenser variant of the play track (faster, minor, sawtooth).
// ---------------------------------------------------------------------------

export type MusicTrack = 'menu' | 'play' | 'shop' | 'boss';

/** BGM sits UNDER the SFX in the mix; this scales the whole music bus. */
const MUSIC_HEADROOM = 0.5;

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
export const MUSIC_TRACKS = ['menu', 'play', 'shop', 'boss'] as const;
export const MUSIC: Record<MusicTrack, TrackDef> = {
  // Calm major arpeggio — title/menu.
  menu: {
    bpm: 76,
    voices: [
      { wave: 'triangle', gain: 0.16, steps: ['C4', R, R, 'E4', R, R, 'G4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.09, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
  // Upbeat driving loop — the play board.
  play: {
    bpm: 96,
    voices: [
      { wave: 'triangle', gain: 0.15, steps: ['C4', R, 'E4', 'G4', R, 'E4', 'C4', R, 'D4', R, 'F4', 'A4', R, 'G4', 'E4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
  // Relaxed shop lounge — the Stationery Shop.
  shop: {
    bpm: 100,
    voices: [
      { wave: 'triangle', gain: 0.16, steps: ['E4', R, 'G4', 'A4', R, 'G4', 'E4', R, 'D4', R, 'E4', 'G4', R, 'D4', 'C4', R] },
      { wave: 'square',   gain: 0.09, steps: ['A1', R, R, R, 'E2', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
  // Tenser variant of `play`: minor, faster, sawtooth lead — the Deadline (boss).
  boss: {
    bpm: 140,
    voices: [
      { wave: 'sawtooth', gain: 0.13, steps: ['A3', 'C4', 'E4', 'C4', 'F4', 'E4', 'C4', 'A3', 'B3', 'D4', 'F4', 'D4', 'E4', 'C4', 'B3', 'E4'] },
      { wave: 'square',   gain: 0.11, steps: ['A1', R, 'A1', R, 'F1', R, 'F1', R, 'D1', R, 'D1', R, 'E1', R, 'E1', R] },
    ],
  },
};

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
  private currentTrack: MusicTrack | null = null;
  private pendingTrack: MusicTrack | null = null; // requested before the gesture unlock
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  // Chromatic unlock gating (feature-02 C-6): the game starts SILENT — the SFX and
  // music buses are OFF until the SOUND / MUSIC words are played (or the Settings
  // override enables them). setBusEnabled flips these; play()/playMusic() respect them.
  private busEnabled = { sfx: false, music: false };

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
      this.musicGain.connect(this.ctx.destination);
    }
    this.updateMusicGain();
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
      const horizon = this.ctx.currentTime + 0.12; // schedule ~120ms ahead
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
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(hz, when);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(v.gain, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g).connect(this.musicGain);
      osc.start(when);
      osc.stop(when + dur);
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

  play(name: SfxName, opts?: { step?: number }): void {
    if (!this.busEnabled.sfx) return; // bus gated off until SOUND is unlocked (C-6)
    if (!this.ctx || !this.unlocked) return; // pre-gesture / no Web Audio → drop
    const g = effectiveGain(name, this.vol);
    if (g <= 0) return;
    const r = RECIPES[name];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    // Percussive envelope: fast attack, exponential decay across the recipe dur.
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(g, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
    out.connect(ctx.destination);

    // Rising count-up tick: each consecutive tick steps the pitch up, resetting
    // per word (the caller passes an incrementing `step`, cleared between words).
    const semis = opts?.step ? Math.min(opts.step, 24) : 0;
    const bend = Math.pow(2, semis / 12);

    for (const t of r.tones ?? []) {
      const start = now + (t.delay ?? 0);
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from * bend, start);
      if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to * bend, now + r.dur);
      osc.connect(out);
      osc.start(start);
      osc.stop(now + r.dur);
    }
    if (r.noise) {
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
}

export const audio = new Audio();
