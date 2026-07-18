import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord, endBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';

const lex = makeLexicon([], {
  run: { suit: 'standard', pos: ['verbIntransitive'] },
  cat: { suit: 'standard', pos: ['noun'] },
  eats: { suit: 'standard', pos: ['verbTransitive'] },
  fish: { suit: 'standard', pos: ['noun'] },
});

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `w${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

/** Force a hand that spells `word`, submit it, return the new blind + submission. */
const play = (blind: BlindState, run: RunState, word: string) => {
  const hand = tilesFor(word);
  return submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id), makeRng('test'));
};

const freshBlind = (target = 1000) => {
  const run = newRun('s3');
  return { run, blind: startBlind(run, makeRng('s3'), { target }) };
};

describe('slice3 loop — projected now includes the sentence bonus (GDD §7.1)', () => {
  it('a bare verb no longer projects a sentence bonus (imperative needs an object)', () => {
    const { run, blind } = freshBlind();
    const { blind: after, submission } = play(blind, run, 'run'); // RUN = 3 chips
    expect(submission.settledScore).toBe(3);
    expect(after.committedScore).toBe(3); // layer 1 unchanged
    expect(after.projectedScore).toBe(3); // no imperative → projected mirrors committed
  });

  it('verb + noun projects the Imperative bonus over committed', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'eats')); // 4 chips
    ({ blind: b } = play(b, run, 'fish')); // 10 chips → EATS FISH = Imperative
    // committed = 14; both standard → Unison standard (+50 flat); Imperative +40×2.
    expect(b.committedScore).toBe(14);
    expect(b.projectedScore).toBe(144); // (14 + 40×2 + 50) × 1
  });

  it('builds a Transitive sentence across phases and multiplies the total', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'eats'));
    ({ blind: b } = play(b, run, 'fish'));
    // committed = CAT 5 + EATS 4 + FISH 10 = 19. All standard suit → Unison
    // standard (+50 flat) also fires: (19 + 50) × Transitive ×2 = 138.
    expect(b.committedScore).toBe(19);
    expect(b.projectedScore).toBe(138);
  });

  it('a gibberish hole collapses the sentence bonus — projected falls back to committed', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'zzz')); // not a word → hole
    ({ blind: b } = play(b, run, 'fish'));
    expect(b.projectedScore).toBe(b.committedScore); // no pattern survives the hole
  });
});

describe('slice3 loop — endBlind finalization (GDD §7.4)', () => {
  it('finalizes the sentence bonus and reports remaining phases', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'eats'));
    ({ blind: b } = play(b, run, 'fish'));
    const result = endBlind(b, run, lex);
    expect(result.judgment.match?.pattern).toBe('transitive');
    expect(result.judgment.unison?.suit).toBe('standard');
    expect(result.finalScore).toBe(138); // (19 + 50 unison) × 2 transitive
    expect(result.phasesLeft).toBe(b.phasesTotal - b.phasesUsed); // 4 - 3 = 1
  });
});
