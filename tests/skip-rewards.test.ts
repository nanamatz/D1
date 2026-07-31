import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { startBlind } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { RunState } from '../src/engine/types';
import {
  consumeNextBlindBonus,
  IMMEDIATE_SKIP_REWARD_IDS,
  isImmediateSkipReward,
  isNextShopSkipReward,
  NEXT_SHOP_SKIP_REWARD_IDS,
  rollSkipOffers,
  SKIP_REWARD_IDS,
  skipCurrentBlind,
} from '../src/engine/skipRewards';

describe('blind skip rewards', () => {
  it('rolls two reproducible offers from the twenty-six-entry uniform pool', () => {
    const run = newRun('skip-roll');
    expect(new Set(SKIP_REWARD_IDS).size).toBe(26);
    expect(SKIP_REWARD_IDS).not.toContain('leadStory');
    expect(rollSkipOffers(run, makeRng('offers'))).toEqual(
      rollSkipOffers(run, makeRng('offers')),
    );
  });

  it('classifies skip-time rewards for the auto-redemption sequence', () => {
    expect(IMMEDIATE_SKIP_REWARD_IDS).toEqual([
      'advancePayment',
      'houseStyle',
      'bossTag',
      'tileTag',
      'fableTag',
      'constellationTag',
      'charmTag',
      'handyTag',
      'garbageTag',
      'inkTag',
      'economyTag',
    ]);
    for (const id of SKIP_REWARD_IDS) {
      expect(isImmediateSkipReward(id), id).toBe(IMMEDIATE_SKIP_REWARD_IDS.includes(
        id as (typeof IMMEDIATE_SKIP_REWARD_IDS)[number],
      ));
    }
  });

  it('classifies Tags that wait until a shop actually consumes them', () => {
    expect(NEXT_SHOP_SKIP_REWARD_IDS).toEqual([
      'uncommonTag',
      'rareTag',
      'whiteTag',
      'violetTag',
      'rainbowTag',
      'grayTag',
      'voucherTag',
      'couponTag',
    ]);
    for (const id of SKIP_REWARD_IDS) {
      expect(isNextShopSkipReward(id), id).toBe(NEXT_SHOP_SKIP_REWARD_IDS.includes(
        id as (typeof NEXT_SHOP_SKIP_REWARD_IDS)[number],
      ));
    }
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
