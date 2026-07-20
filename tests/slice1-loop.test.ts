import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, discardTiles, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import type { Letter, Tile } from '../src/engine/types';

const lex = makeLexicon(['cat', 'run', 'dog'], {});
const BAG_TOTAL = Object.values(BALANCE.bagComposition).reduce((a, b) => a + b, 0);

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
    expect(run.bag.length).toBe(BAG_TOTAL);
    expect(run.handSize).toBe(BALANCE.handSize);
    expect(run.baseDiscards).toBe(BALANCE.discardsPerBlind);
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
    expect(blind.bag.length).toBe(BAG_TOTAL - run.handSize);
    expect(blind.discardsLeft).toBe(run.baseDiscards);
    expect(blind.phasesUsed).toBe(0);
    expect(blind.sequence).toEqual([]);
    expect(blind.committedScore).toBe(0);
  });

  it('does not mutate the run bag (permanent asset is untouched)', () => {
    const run = newRun('blind-seed');
    startBlind(run, makeRng('blind-seed'));
    expect(run.bag.length).toBe(BAG_TOTAL);
  });

  it('a freshly started blind carries no residual state (playtest-04 B-1)', () => {
    // Play a full blind, then start the next — it must be clean, no remnants.
    const run = newRun('b1');
    let blind = startBlind(run, makeRng('b1'));
    blind = discardTiles(blind, run, blind.hand.slice(0, 2).map((t) => t.id), makeRng('b1-discard')).blind;
    submitWord(blind, run, lex, blind.hand.slice(0, 3).map((t) => t.id), makeRng('test'));

    const next = startBlind(run, makeRng('b1-next'));
    expect(next.sequence).toEqual([]);
    expect(next.committedScore).toBe(0);
    expect(next.projectedScore).toBe(0);
    expect(next.discardedThisBlind).toEqual([]);
    expect(next.phasesUsed).toBe(0);
    expect(next.hand.length).toBe(run.handSize);
  });
});

describe('slice1 loop — discard budget is PER BLIND (GDD §6.3)', () => {
  const setup = () => {
    const run = newRun('exch');
    const blind = startBlind(run, makeRng('exch'));
    const rng = makeRng('exch-discard');
    return { run, blind, rng };
  };

  it('spends one discard and keeps the hand full', () => {
    const { run, blind, rng } = setup();
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const next = discardTiles(blind, run, ids, rng).blind;
    expect(next.discardsLeft).toBe(blind.discardsLeft - 1);
    expect(next.hand.length).toBe(blind.hand.length); // removed + redrawn same count
  });

  it('discarded tiles EXIT for the blind — not redrawn, moved to discardedThisBlind (A-1)', () => {
    const { run, blind, rng } = setup();
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const next = discardTiles(blind, run, ids, rng).blind;
    const handIds = new Set(next.hand.map((t) => t.id));
    const bagIds = new Set(next.bag.map((t) => t.id));
    for (const id of ids) {
      expect(handIds.has(id)).toBe(false); // cannot be drawn again this blind
      expect(bagIds.has(id)).toBe(false); // did not return to the bag mid-blind
    }
    expect(next.discardedThisBlind.map((t) => t.id)).toEqual(expect.arrayContaining(ids));
  });

  it('throws once the per-blind budget is exhausted', () => {
    const { run, blind: initialBlind, rng } = setup();
    let blind = initialBlind;
    for (let i = 0; i < BALANCE.discardsPerBlind; i++) {
      const ids = blind.hand.slice(0, 1).map((t) => t.id);
      blind = discardTiles(blind, run, ids, rng).blind;
    }
    expect(blind.discardsLeft).toBe(0);
    const ids = blind.hand.slice(0, 1).map((t) => t.id);
    expect(() => discardTiles(blind, run, ids, rng)).toThrow(/budget/i);
  });

  it('has no per-use tile cap — one discard dumps any number of tiles (D-4)', () => {
    const { run, blind, rng } = setup();
    const many = blind.hand.map((t) => t.id); // the whole hand at once
    const next = discardTiles(blind, run, many, rng).blind;
    expect(next.discardsLeft).toBe(blind.discardsLeft - 1); // still one discard spent
  });

  it('rejects discarding a tile not in hand', () => {
    const { run, blind, rng } = setup();
    expect(() => discardTiles(blind, run, ['not-a-real-id'], rng)).toThrow(/hand/i);
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
    const { blind: after, submission } = submitWord(blind, run, lex, ids, makeRng('test'));
    expect(submission.text).toBe('CAT');
    expect(submission.settledScore).toBe(5);
    expect(after.committedScore).toBe(5); // layer 1 immediate (GDD §7.1)
    expect(after.sequence).toHaveLength(1);
    expect(after.phasesUsed).toBe(1);
  });

  it('draws back up by the number of tiles used (GDD §6.1)', () => {
    const { run, blind } = controlledBlind();
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(blind, run, lex, ids, makeRng('test'));
    expect(after.hand.length).toBe(blind.hand.length); // played 3, drew 3
  });

  it('routes an invalid word through the gibberish hole (GDD §6.4)', () => {
    const { run, blind } = controlledBlind();
    // Spell T A C — not a word in our lexicon
    const [c, a, t] = blind.hand;
    const { blind: after, submission } = submitWord(
      blind,
      run,
      lex,
      [t!.id, a!.id, c!.id],
      makeRng('test'),
    );
    expect(submission.text).toBe('TAC');
    expect(submission.isGibberish).toBe(true);
    expect(submission.posUsed).toBeNull();
    expect(after.committedScore).toBe(submission.settledScore);
  });

  it('does not refill when the bag is empty — hand shrinks (GDD §6.6)', () => {
    const { run, blind } = controlledBlind();
    const drained = { ...blind, bag: [] as Tile[] };
    const ids = drained.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(drained, run, lex, ids, makeRng('test'));
    expect(after.hand.length).toBe(drained.hand.length - 3);
  });

  it('rejects submitting a tile not in hand', () => {
    const { run, blind } = controlledBlind();
    expect(() => submitWord(blind, run, lex, ['ghost-id'], makeRng('test'))).toThrow(/hand/i);
  });
});
