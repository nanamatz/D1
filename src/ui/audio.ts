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
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'dragSnap' | 'discardSwoosh'
  | 'submitThock' | 'buttonPress' | 'transitionWhoosh'
  | 'purchase' | 'sell' | 'reroll' | 'packOpen' | 'voucherRedeem' | 'catMeow';

type Wave = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

interface Recipe {
  /** base loudness 0..1, before master/sfx scaling */
  gain: number;
  /** overall length in seconds */
  dur: number;
  /** one or more tone layers; noise adds a filtered-noise burst */
  tones?: { wave: Wave; from: number; to?: number }[];
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
  tileSelect:       { gain: 0.16, dur: 0.04, tones: [{ wave: 'square', from: 700 }] },
  dragSnap:         { gain: 0.16, dur: 0.05, tones: [{ wave: 'square', from: 300, to: 500 }] },
  discardSwoosh:    { gain: 0.24, dur: 0.18, noise: { cutoff: 1600 } },
  submitThock:      { gain: 0.30, dur: 0.10, tones: [{ wave: 'square', from: 160, to: 90 }], noise: { cutoff: 700 } },
  buttonPress:      { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 380, to: 300 }] },
  transitionWhoosh: { gain: 0.20, dur: 0.22, noise: { cutoff: 1200 } },
  purchase:         { gain: 0.28, dur: 0.16, tones: [{ wave: 'square', from: 784 }, { wave: 'square', from: 1046 }] },
  sell:             { gain: 0.24, dur: 0.12, tones: [{ wave: 'square', from: 660, to: 440 }] },
  reroll:           { gain: 0.22, dur: 0.12, tones: [{ wave: 'sawtooth', from: 300, to: 600 }] },
  packOpen:         { gain: 0.30, dur: 0.30, tones: [{ wave: 'square', from: 440, to: 880 }], noise: { cutoff: 2000 } },
  voucherRedeem:    { gain: 0.28, dur: 0.24, tones: [{ wave: 'triangle', from: 660 }, { wave: 'triangle', from: 990 }] },
  catMeow:          { gain: 0.30, dur: 0.30, tones: [{ wave: 'sawtooth', from: 620, to: 780 }] },
};

export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

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
    void this.ctx.resume().then(() => { this.unlocked = true; }).catch(() => {});
    // Some browsers resume synchronously; reflect that immediately too.
    if (this.ctx.state === 'running') this.unlocked = true;
  }

  isUnlocked(): boolean { return this.unlocked; }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.vol = {
      master: clamp(v.master, 0, 100),
      music: clamp(v.music, 0, 100),
      sfx: clamp(v.sfx, 0, 100),
    };
  }

  play(name: SfxName, opts?: { step?: number }): void {
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
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from * bend, now);
      if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to * bend, now + r.dur);
      osc.connect(out);
      osc.start(now);
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
