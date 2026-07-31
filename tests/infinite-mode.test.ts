import { describe, expect, it } from 'vitest';
import {
  FINISHER_BOSS_IDS,
  afterBossPlay,
  bossPoolForAnte,
  bossPoolForId,
  clearBossJokerDebuffs,
  drawBoss,
  enterBossBlind,
  reconcileBossHand,
} from '../src/engine/bosses';
import { blindTarget, effectiveClearReward } from '../src/engine/economy';
import { discardTiles, startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { resolveBlind } from '../src/engine/progression';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { formatScore } from '../src/ui/formatScore';
import type { Letter, OwnedJoker, RunState, Tile } from '../src/engine/types';

const lexicon = makeLexicon(['bright'], {
  bright: { suit: 'standard', pos: ['adjective'] },
});

const owned = (defId: string): OwnedJoker => ({
  defId,
  edition: 'base',
  state: {},
});

const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((letter, index) => ({
    id: `endless-${word}-${index}`,
    letter: letter as Letter,
    material: 'ceramic',
    font: 'medium',
  }));

describe('endless chapter curve and finisher schedule', () => {
  it('uses finishers only on every eighth chapter', () => {
    expect(bossPoolForAnte(7)).toBe('core');
    expect(bossPoolForAnte(8)).toBe('finisher');
    expect(bossPoolForAnte(16)).toBe('finisher');
    expect(bossPoolForAnte(24)).toBe('finisher');
    expect(FINISHER_BOSS_IDS).toContain(drawBoss(makeRng('finisher'), 'finisher'));
  });

  it('keeps an already scheduled finisher after an ante-reducing voucher', () => {
    expect(bossPoolForId('blueprint')).toBe('finisher');
  });

  it('stays finite and increasing through chapter 38, then stops explicitly', () => {
    let previous = blindTarget(8, 'small');
    for (let ante = 9; ante <= 38; ante++) {
      const target = blindTarget(ante, 'small');
      expect(Number.isFinite(target)).toBe(true);
      expect(target).toBeGreaterThan(previous);
      previous = target;
    }
    expect(() => blindTarget(39, 'small')).toThrow(RangeError);
  });

  it('formats huge targets without Infinity or an overflowing digit wall', () => {
    expect(formatScore(123_456)).toBe('123,456');
    expect(formatScore(1_234_567_890)).toBe('1.2e9');
    expect(formatScore(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('finisher boss hooks', () => {
  it('Nokdo Script forces a playable tile but lets hand mutations replace it', () => {
    const run = newRun('nokdo');
    const base = startBlind(run, makeRng('nokdo-blind'), {
      kind: 'boss',
      bossId: 'nokdoScript',
      target: 1,
    });
    const entered = enterBossBlind(run, base, makeRng('nokdo-enter'));
    const forced = entered.blind.forcedTileId;
    expect(forced).not.toBeNull();
    expect(() =>
      discardTiles(entered.blind, run, [forced!], makeRng('nokdo-discard')),
    ).toThrow(/forced tile/);
    const other = entered.blind.hand.find((tile) => tile.id !== forced)!;
    expect(() =>
      submitWord(entered.blind, run, lexicon, [other.id], makeRng('nokdo-play')),
    ).toThrow(/forced tile/);

    const destroyed = {
      ...entered.blind,
      hand: entered.blind.hand.filter((tile) => tile.id !== forced),
    };
    const reconciled = reconcileBossHand(run, destroyed, makeRng('nokdo-reselect'));
    expect(reconciled.forcedTileId).not.toBe(forced);
    expect(reconciled.hand.some((tile) => tile.id === reconciled.forcedTileId)).toBe(true);
  });

  it('Blueprint shuffles once, hides identities, and does not disable effects', () => {
    const run: RunState = {
      ...newRun('blueprint'),
      jokers: [owned('longWordFan'), owned('shortAndSharp'), owned('miser')],
    };
    const base = startBlind(run, makeRng('blueprint-blind'), {
      kind: 'boss',
      bossId: 'blueprint',
      target: 1,
    });
    const entered = enterBossBlind(run, base, makeRng('blueprint-enter'));
    expect(entered.blind.jokersFaceDown).toBe(true);
    expect(entered.run.jokers.map((joker) => joker.defId).sort()).toEqual(
      run.jokers.map((joker) => joker.defId).sort(),
    );
    expect(afterBossPlay(entered.run, entered.blind, makeRng('blueprint-after'))).toEqual(entered);
  });

  it('Vital Sign is triple a normal boss target and finishers pay $8', () => {
    const run = newRun('vital');
    const normal = startBlind(run, makeRng('normal'), {
      kind: 'boss',
      bossId: 'contract',
    });
    const vital = startBlind(run, makeRng('vital'), {
      kind: 'boss',
      bossId: 'vitalSign',
    });
    expect(vital.target).toBe(normal.target * 3);
    expect(effectiveClearReward(run, 'boss', 'vitalSign')).toBe(8);
  });

  it('Ultrasound disables exactly one Emoji Tile and clears the marker at blind end', () => {
    const run: RunState = {
      ...newRun('ultrasound'),
      jokers: [owned('longWordFan'), owned('shortAndSharp'), owned('miser')],
    };
    const base = startBlind(run, makeRng('ultrasound-blind'), {
      kind: 'boss',
      bossId: 'ultrasound',
      target: 1,
    });
    const entered = enterBossBlind(run, base, makeRng('ultrasound-enter'));
    expect(entered.run.jokers.filter((joker) => joker.state.bossDisabled === 1)).toHaveLength(1);
    expect(
      clearBossJokerDebuffs(entered.run).jokers.some(
        (joker) => joker.state.bossDisabled === 1,
      ),
    ).toBe(false);
  });

  it('a disabled Emoji Tile contributes neither hooks nor edition scoring', () => {
    const hand = tilesFor('bright');
    const plain = newRun('ultrasound-score');
    const active: RunState = {
      ...plain,
      jokers: [{ ...owned('shortAndSharp'), edition: 'gray' }],
    };
    const disabled: RunState = {
      ...active,
      jokers: active.jokers.map((joker) => ({
        ...joker,
        state: { bossDisabled: 1 },
      })),
    };
    const blind = {
      ...startBlind(plain, makeRng('ultrasound-score-blind'), { target: 999_999 }),
      hand,
    };
    const ids = hand.map((tile) => tile.id);
    const baseScore = submitWord(blind, plain, lexicon, ids, makeRng('plain')).submission.settledScore;
    const activeScore = submitWord(blind, active, lexicon, ids, makeRng('active')).submission.settledScore;
    const disabledScore = submitWord(blind, disabled, lexicon, ids, makeRng('disabled')).submission.settledScore;
    expect(activeScore).toBeGreaterThan(baseScore);
    expect(disabledScore).toBe(baseScore);
  });
});

describe('victory handoff and endless endpoint', () => {
  it('offers the first victory after Chapter 8 Deadline', () => {
    const run: RunState = {
      ...newRun('victory'),
      ante: 8,
      blindIndex: 2,
      victorySecured: false,
    };
    const blind = startBlind(run, makeRng('victory-blind'), {
      kind: 'boss',
      bossId: 'nokdoScript',
      target: 1,
    });
    const outcome = resolveBlind(run, blind, blind.target);
    expect(outcome.won).toBe(true);
    expect(outcome.run.victorySecured).toBe(true);
    expect(outcome.run.ante).toBe(9);
  });

  it('ends safely after Chapter 38 Deadline', () => {
    const run: RunState = {
      ...newRun('endpoint'),
      ante: 38,
      blindIndex: 2,
      victorySecured: true,
    };
    const blind = startBlind(run, makeRng('endpoint-blind'), {
      kind: 'boss',
      bossId: 'contract',
      target: 1,
    });
    const outcome = resolveBlind(run, blind, blind.target);
    expect(outcome.endlessComplete).toBe(true);
    expect(outcome.run.ante).toBe(38);
    expect(outcome.run.blindIndex).toBe(2);
  });
});
