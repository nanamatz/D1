import { describe, it, expect } from 'vitest';
import { audio, effectiveGain, noteHz, MUSIC, MUSIC_TRACKS, SFX_NAMES, type SfxName } from '../src/ui/audio';

const FULL = { master: 100, music: 100, sfx: 100 };

describe('audio facade — pure logic (no Web Audio in Node)', () => {
  it('play() is a safe no-op in Node (no AudioContext) and does not throw', () => {
    expect(() => audio.play('tilePop')).not.toThrow();
    expect(audio.isUnlocked()).toBe(false); // never unlocks without a real context
  });

  it('unlock() is safe to call with no Web Audio present', () => {
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.isUnlocked()).toBe(false);
  });

  it('effectiveGain multiplies master × group × recipe gain', () => {
    const full = effectiveGain('tilePop', FULL);
    // half master → half gain
    expect(effectiveGain('tilePop', { ...FULL, master: 50 })).toBeCloseTo(full / 2, 5);
    // sfx group zeroed → silent
    expect(effectiveGain('tilePop', { ...FULL, sfx: 0 })).toBe(0);
    // master zeroed → silent
    expect(effectiveGain('tilePop', { ...FULL, master: 0 })).toBe(0);
  });

  it('every SfxName has a recipe (positive base gain) and SFX_NAMES is complete', () => {
    expect(SFX_NAMES.length).toBe(23);
    for (const n of SFX_NAMES) {
      expect(effectiveGain(n as SfxName, FULL)).toBeGreaterThan(0);
    }
  });

  it('setVolumes clamps out-of-range values instead of throwing', () => {
    expect(() => audio.setVolumes({ master: 999, music: -5, sfx: 50 })).not.toThrow();
  });
});

describe('BGM (phase 2) — pure data + no-op safety', () => {
  it('noteHz matches equal-temperament anchors (A4=440, A5=880, C4≈261.63)', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 3);
    expect(noteHz('A5')).toBeCloseTo(880, 3);
    expect(noteHz('C4')).toBeCloseTo(261.626, 2);
    expect(noteHz('nonsense')).toBe(0); // unparseable → 0 (skipped, never NaN)
  });

  it('every track exists and its note steps are all valid or rests', () => {
    for (const name of MUSIC_TRACKS) {
      const track = MUSIC[name];
      expect(track.voices.length).toBeGreaterThan(0);
      // all voices share one loop length so the sequencer wraps cleanly
      const len = track.voices[0]!.steps.length;
      for (const v of track.voices) {
        expect(v.steps.length).toBe(len);
        for (const s of v.steps) {
          if (s !== null) expect(noteHz(s)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('non-boss tracks carry a third (pad) voice for a fuller bed', () => {
    for (const name of MUSIC_TRACKS) {
      const expected = name === 'boss' ? 2 : 3;
      expect(MUSIC[name].voices.length).toBe(expected);
    }
  });

  it('playMusic / stopMusic are safe no-ops in Node (no AudioContext)', () => {
    expect(() => audio.playMusic('play')).not.toThrow();
    expect(() => audio.playMusic('boss')).not.toThrow();
    expect(() => audio.stopMusic()).not.toThrow();
  });
});
