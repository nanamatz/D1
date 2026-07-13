import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, exchangeTiles, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import type { Letter, Tile } from '../src/engine/types';

const lex = makeLexicon(['cat', 'run', 'dog'], {});

// A tiny helper to force a known hand so submissions are deterministic.
let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `h${idc++}`,
  letter,
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
});

describe('slice1 run — newRun initialization', () => {
  it('starts with a full 98-tile bag and base resources (GDD §6.2)', () => {
    const run = newRun('seed');
    expect(run.bag.length).toBe(98);
    expect(run.handSize).toBe(BALANCE.handSize);
    expect(run.baseExchanges).toBe(BALANCE.exchangesPerBlind);
    expect(run.gold).toBe(BALANCE.startingGold);
  });

  it('starts every sentence pattern at level 1 (GDD §5.4)', () => {
    const run = newRun('seed');
    for (const level of Object.values(run.patternLevels)) expect(level).toBe(1);
    expect(Object.keys(run.patternLevels).length).toBe(8);
  });
});

describe('slice1 loop — startBlind (GDD §6.1)', () => {
  it('fills the hand to handSize and leaves the rest in the blind bag', () => {
    const run = newRun('blind-seed');
    const blind = startBlind(run, makeRng('blind-seed'));
    expect(blind.hand.length).toBe(run.handSize);
    expect(blind.bag.length).toBe(98 - run.handSize);
    expect(blind.exchangesLeft).toBe(run.baseExchanges);
    expect(blind.phasesUsed).toBe(0);
    expect(blind.sequence).toEqual([]);
    expect(blind.committedScore).toBe(0);
  });

  it('does not mutate the run bag (permanent asset is untouched)', () => {
    const run = newRun('blind-seed');
    startBlind(run, makeRng('blind-seed'));
    expect(run.bag.length).toBe(98);
  });
});

describe('slice1 loop — exchange budget is PER BLIND (GDD §6.3)', () => {
  const setup = () => {
    const run = newRun('exch');
    const blind = startBlind(run, makeRng('exch'));
    return { run, blind };
  };

  it('spends one exchange and keeps the hand full', () => {
    const { blind } = setup();
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const next = exchangeTiles(blind, ids, makeRng('e1'));
    expect(next.exchangesLeft).toBe(blind.exchangesLeft - 1);
    expect(next.hand.length).toBe(blind.hand.length); // returned + redrawn same count
  });

  it('throws once the per-blind budget is exhausted', () => {
    let { blind } = setup();
    for (let i = 0; i < BALANCE.exchangesPerBlind; i++) {
      const ids = blind.hand.slice(0, 1).map((t) => t.id);
      blind = exchangeTiles(blind, ids, makeRng(`e${i}`));
    }
    expect(blind.exchangesLeft).toBe(0);
    const ids = blind.hand.slice(0, 1).map((t) => t.id);
    expect(() => exchangeTiles(blind, ids, makeRng('over'))).toThrow(/budget/i);
  });

  it('rejects exchanging more tiles than the per-exchange cap (GDD §6.3)', () => {
    const { blind } = setup();
    const tooMany = blind.hand.slice(0, BALANCE.tilesPerExchange + 1).map((t) => t.id);
    expect(() => exchangeTiles(blind, tooMany, makeRng('big'))).toThrow(/cap|tiles/i);
  });

  it('rejects exchanging a tile not in hand', () => {
    const { blind } = setup();
    expect(() => exchangeTiles(blind, ['not-a-real-id'], makeRng('x'))).toThrow(/hand/i);
  });
});

describe('slice1 loop — submitWord (GDD §6.1, §7.1)', () => {
  // Build a blind with a controlled hand: C A T then filler.
  const controlledBlind = () => {
    const run = newRun('submit');
    const blind = startBlind(run, makeRng('submit'));
    const hand: Tile[] = [tile('C'), tile('A'), tile('T'), ...blind.hand.slice(3)];
    return { run, blind: { ...blind, hand } };
  };

  it('settles the word score immediately and appends it to the sequence', () => {
    const { run, blind } = controlledBlind();
    const ids = blind.hand.slice(0, 3).map((t) => t.id); // C A T
    const { blind: after, submission } = submitWord(blind, run, lex, ids);
    expect(submission.text).toBe('CAT');
    expect(submission.settledScore).toBe(5);
    expect(after.committedScore).toBe(5); // layer 1 immediate (GDD §7.1)
    expect(after.sequence).toHaveLength(1);
    expect(after.phasesUsed).toBe(1);
  });

  it('draws back up by the number of tiles used (GDD §6.1)', () => {
    const { run, blind } = controlledBlind();
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(blind, run, lex, ids);
    expect(after.hand.length).toBe(blind.hand.length); // played 3, drew 3
  });

  it('routes an invalid word through the gibberish hole (GDD §6.4)', () => {
    const { run, blind } = controlledBlind();
    // Spell T A C — not a word in our lexicon
    const [c, a, t] = blind.hand;
    const { blind: after, submission } = submitWord(blind, run, lex, [t!.id, a!.id, c!.id]);
    expect(submission.text).toBe('TAC');
    expect(submission.isGibberish).toBe(true);
    expect(submission.posUsed).toBeNull();
    expect(after.committedScore).toBe(submission.settledScore);
  });

  it('does not refill when the bag is empty — hand shrinks (GDD §6.6)', () => {
    const { run, blind } = controlledBlind();
    const drained = { ...blind, bag: [] as Tile[] };
    const ids = drained.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(drained, run, lex, ids);
    expect(after.hand.length).toBe(drained.hand.length - 3);
  });

  it('rejects submitting a tile not in hand', () => {
    const { run, blind } = controlledBlind();
    expect(() => submitWord(blind, run, lex, ['ghost-id'])).toThrow(/hand/i);
  });
});
