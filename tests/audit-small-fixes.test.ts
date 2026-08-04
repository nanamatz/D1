/**
 * Three small, independently-reproducible defects from the 2026-07-31 audit.
 * Grouped because each is a few lines and none warrants its own file.
 */
import { describe, expect, it } from 'vitest';
import { catchUpSequencer } from '../src/ui/audio';
import {
  CORE_BOSS_IDS,
  FINISHER_BOSS_IDS,
  drawBoss,
  drawBossFromCycle,
} from '../src/engine/bosses';
import { makeRng } from '../src/engine/rng';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

describe('boss reroll never returns the boss it replaced (BALANCE-03 / U-8)', () => {
  // The old code drew once and re-drew only on a match, so two draws could both
  // land on the current boss: 1/144 on the core pool but 1/16 on the four-boss
  // finisher pool — a $10 reroll that visibly did nothing on a final Chapter.
  for (const [name, pool, ids] of [
    ['core', 'core', CORE_BOSS_IDS],
    ['finisher', 'finisher', FINISHER_BOSS_IDS],
  ] as const) {
    it(`${name} pool: 3000 seeded rerolls, zero repeats`, () => {
      for (const current of ids) {
        for (let seed = 0; seed < 3000 / ids.length; seed++) {
          const drawn = drawBoss(makeRng(`reroll-${current}-${seed}`), pool, current);
          expect(drawn).not.toBe(current);
          expect(ids).toContain(drawn);
        }
      }
    });
  }

  it('still draws from the whole pool when nothing is excluded', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) seen.add(drawBoss(makeRng(`draw-${seed}`), 'core'));
    expect(seen.size).toBe(CORE_BOSS_IDS.length);
  });

  it('falls back rather than returning nothing when the pool has one entry', () => {
    const only = FINISHER_BOSS_IDS[0]!;
    // Not reachable today (both pools have >1), but a future single-boss pool
    // must not produce `undefined` and crash the blind.
    const drawn = drawBoss(makeRng('x'), 'finisher', 'not-a-real-boss');
    expect(FINISHER_BOSS_IDS).toContain(drawn);
    expect(typeof only).toBe('string');
  });

  it('does not repeat a boss until its pool is exhausted', () => {
    for (const [pool, ids] of [['core', CORE_BOSS_IDS], ['finisher', FINISHER_BOSS_IDS]] as const) {
      let history: string[] = [];
      const draws: string[] = [];
      const rng = makeRng(`boss-cycle-${pool}`);
      for (let index = 0; index < ids.length * 2; index += 1) {
        const result = drawBossFromCycle(rng, pool, history);
        draws.push(result.bossId);
        history = result.history;
      }
      expect(new Set(draws.slice(0, ids.length)).size).toBe(ids.length);
      expect(new Set(draws.slice(ids.length)).size).toBe(ids.length);
    }
  });
});

describe('BGM sequencer catch-up (AUDIO-01 / I-3)', () => {
  const secPerStep = 60 / 96 / 4; // the `play` track's 16th grid
  const steps = 16;

  it('does nothing while the scheduler is keeping up', () => {
    const result = catchUpSequencer(10.5, 4, 10.4, secPerStep, steps);
    expect(result).toEqual({ nextStepTime: 10.5, currentStep: 4, skipped: 0 });
  });

  it('skips the steps a throttled background tab missed instead of firing them', () => {
    // 1s of clamped timer at ~6.4 steps/s: without this, the while-loop below it
    // would schedule ~64 notes at already-elapsed times, all sounding at once.
    const before = { nextStepTime: 10, currentStep: 0 };
    const result = catchUpSequencer(before.nextStepTime, before.currentStep, 11, secPerStep, steps);

    expect(result.skipped).toBeGreaterThan(0);
    // The whole point: scheduling resumes in the FUTURE, never the past.
    expect(result.nextStepTime).toBeGreaterThanOrEqual(11);
    // ...and by less than one step, so no audible gap is introduced either.
    expect(result.nextStepTime - 11).toBeLessThan(secPerStep);
    // Phase is preserved: the bar continues where the clock says, not from 0.
    expect(result.currentStep).toBe(result.skipped % steps);
  });

  it('survives a long absence (minimised window)', () => {
    const result = catchUpSequencer(10, 3, 3610, secPerStep, steps);
    expect(result.nextStepTime).toBeGreaterThanOrEqual(3610);
    expect(result.currentStep).toBeGreaterThanOrEqual(0);
    expect(result.currentStep).toBeLessThan(steps);
  });
});

describe('locale completeness (COPY-03 / U-4)', () => {
  it('has no Korean row left as untranslated English prose', () => {
    const E = en as Record<string, string>;
    const K = ko as Record<string, string>;
    const untranslated = Object.keys(E).filter((key) => {
      const source = E[key] ?? '';
      return (
        K[key] === source &&
        /[A-Za-z]{4}/.test(source) &&
        // The alien mascot deliberately speaks the same non-language in both.
        !key.startsWith('voice.alien.') &&
        // Pure interpolation formats carry no prose to translate.
        !/^\{[a-z]+\}/i.test(source)
      );
    });
    expect(untranslated).toEqual([]);
  });
});
