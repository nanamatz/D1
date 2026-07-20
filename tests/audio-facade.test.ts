import { describe, it, expect } from 'vitest';
import { audio, effectiveGain, SFX_NAMES, type SfxName } from '../src/ui/audio';

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
    expect(SFX_NAMES.length).toBe(22);
    for (const n of SFX_NAMES) {
      expect(effectiveGain(n as SfxName, FULL)).toBeGreaterThan(0);
    }
  });

  it('setVolumes clamps out-of-range values instead of throwing', () => {
    expect(() => audio.setVolumes({ master: 999, music: -5, sfx: 50 })).not.toThrow();
  });
});
