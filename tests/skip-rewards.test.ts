import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { startBlind } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { RunState } from '../src/engine/types';
import {
  consumeNextBlindBonus,
  rollSkipOffers,
  SKIP_REWARD_IDS,
  skipCurrentBlind,
} from '../src/engine/skipRewards';

describe('blind skip rewards', () => {
  it('rolls two reproducible offers from the twenty-seven-entry uniform pool', () => {
    const run = newRun('skip-roll');
    expect(new Set(SKIP_REWARD_IDS).size).toBe(27);
    expect(rollSkipOffers(run, makeRng('offers'))).toEqual(
      rollSkipOffers(run, makeRng('offers')),
    );
  });

  it('skips Draft without payout or shop and grants the disclosed reward', () => {
    const run: RunState = {
      ...newRun('advance'),
      skipOffers: [{ id: 'advancePayment' }, { id: 'copyPass' }],
    };
    const { run: next } = skipCurrentBlind(run, makeRng('advance-skip'));
    expect(next.blindIndex).toBe(1);
    expect(next.gold).toBe(run.gold + BALANCE.skipRewards.advanceGold);
    expect(next.skippedThisChapter).toEqual([0]);
    expect(next.skippedBlinds).toBe(1);
  });

  it('carries stacked bonuses across another skip until Play is chosen', () => {
    const run: RunState = {
      ...newRun('carry'),
      skipOffers: [{ id: 'extraPages' }, { id: 'copyPass' }],
    };
    const { run: afterDraft } = skipCurrentBlind(run, makeRng('carry-draft'));
    const { run: afterRevision } = skipCurrentBlind(afterDraft, makeRng('carry-revision'));
    const deadline = startBlind(afterRevision, makeRng('deadline'), {
      kind: 'boss',
      bossId: 'ancientPaper',
    });
    expect(deadline.phasesTotal).toBe(afterRevision.basePhases + BALANCE.skipRewards.phases);
    expect(deadline.discardsLeft).toBe(afterRevision.baseDiscards + BALANCE.skipRewards.discards);
    expect(consumeNextBlindBonus(afterRevision).nextBlindBonus).toEqual({
      phases: 0,
      discards: 0,
      handSize: 0,
      targetMultiplier: 1,
      startingScore: 0,
    });
  });

  it('applies the exact disclosed pattern level and delayed clear reward', () => {
    const patterned: RunState = {
      ...newRun('pattern'),
      skipOffers: [
        { id: 'houseStyle', pattern: 'complex' },
        { id: 'publicity' },
      ],
    };
    const { run: afterDraft } = skipCurrentBlind(patterned, makeRng('pattern-draft'));
    expect(afterDraft.patternLevels.complex).toBe(patterned.patternLevels.complex + 1);

    const { run: afterRevision } = skipCurrentBlind(afterDraft, makeRng('pattern-revision'));
    const blind = startBlind(afterRevision, makeRng('payout'), {
      kind: 'boss',
      bossId: 'ancientPaper',
      target: 1,
    });
    const outcome = resolveBlind(afterRevision, blind, 1);
    expect(outcome.earned.reward).toBe(
      BALANCE.clearReward.boss + BALANCE.skipRewards.clearReward,
    );
    expect(outcome.run.pendingClearReward).toBe(0);
  });

  it('never allows Deadline to be skipped', () => {
    const run = { ...newRun('deadline-lock'), blindIndex: 2 as const };
    expect(() => skipCurrentBlind(run, makeRng('deadline-skip'))).toThrow(
      'Deadline cannot be skipped',
    );
  });
});
