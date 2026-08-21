import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord, endBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { resolveBlind } from '../src/engine/progression';
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
    const { blind: after, submission } = play(blind, run, 'run'); // RUN = R+U+N = 3+3+3 = 9 chips
    // standard ×1.0 + length 3 => 9 × 4.0 = 36
    expect(submission.settledScore).toBe(36);
    expect(after.committedScore).toBe(36); // layer 1 unchanged
    expect(after.projectedScore).toBe(36); // no imperative → projected mirrors committed
  });

  it('verb + noun projects the Imperative bonus over committed', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'eats')); // EATS = E3+A3+T3+S3 = 12 chips, length 4
    ({ blind: b } = play(b, run, 'fish')); // FISH = F12+I3+S3+H12 = 30 chips, length 4 → EATS FISH = Imperative
    // EATS settled = 12 × (1.0 + 4) = 60; FISH settled = 30 × (1.0 + 4) = 150
    // committed = 60 + 150 = 210. Sentence bonus is unaffected by word length
    // (pattern/unison values are fixed in BALANCE, not derived from letter chips):
    // both standard → Unison standard (+50 chips); Imperative base 40 chips × mult 1.
    expect(b.committedScore).toBe(210);
    expect(b.projectedScore).toBe(300); // (210 + 40 + 50) × 1
  });

  it('builds a Transitive sentence across phases and multiplies the total', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'eats'));
    ({ blind: b } = play(b, run, 'fish'));
    // CAT = 15 chips, length 3, standard: 15 × (1.0 + 3) = 60
    // EATS = 12 chips, length 4, standard: 12 × (1.0 + 4) = 60
    // FISH = 30 chips, length 4, standard: 30 × (1.0 + 4) = 150
    // committed = 60 + 60 + 150 = 270. Sentence bonus is unaffected by word length:
    // all standard → Unison standard (+50 chips) folds into the current round Chips.
    expect(b.committedScore).toBe(270);
    expect(b.projectedScore).toBe(740); // (270 + 50 + 50) × 2
  });

  it('a gibberish hole collapses the sentence bonus — projected falls back to committed', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'zzz')); // not a word → hole
    ({ blind: b } = play(b, run, 'fish'));
    expect(b.projectedScore).toBe(b.committedScore); // no pattern survives the hole
  });

  it('Broken Sentence clears from the live projection before a loss can resolve', () => {
    const { run } = freshBlind(800);
    run.jokers = [{ defId: 'brokenSentence', state: {} }];
    const { blind } = play(startBlind(run, makeRng('broken-live'), { target: 800 }), run, 'zzz');

    // Gibberish ZZZ commits 90. With no sentence pattern, Broken Sentence adds
    // 125 Chips and ×4 Mult: (90 + 125) × 4 = 860, already above the target.
    expect(blind.committedScore).toBe(90);
    expect(blind.projectedScore).toBe(860);

    const final = endBlind(blind, run, lex);
    expect(final.finalScore).toBe(blind.projectedScore);
    expect(resolveBlind(run, blind, final.finalScore).cleared).toBe(true);
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
    // committed 270 (CAT 60 + EATS 60 + FISH 150, see above), then
    // (270 + 50 pattern + 50 unison) × 2 transitive = 740
    expect(result.finalScore).toBe(740);
    expect(result.phasesLeft).toBe(b.phasesTotal - b.phasesUsed); // 5 - 3 = 2
  });

  it('endBlind surfaces the sentence-bonus chips/mult breakdown', () => {
    const { run } = freshBlind();
    let b = startBlind(run, makeRng('s3'), { target: 1000 });
    ({ blind: b } = play(b, run, 'cat'));
    ({ blind: b } = play(b, run, 'eats'));
    ({ blind: b } = play(b, run, 'fish'));
    const result = endBlind(b, run, lex);
    // Transitive pattern chips 50 + Unison standard 50 = 100; Transitive mult 2.
    expect(result.sentenceChips).toBe(100);
    expect(result.sentenceMult).toBe(2);
    expect(result.bonus).toBe(470);
    expect(result.finalScore).toBe(740); // (committed 270 + sentence Chips 100) × 2
    expect(result.breakdown).toEqual({
      modifierCount: 0,
      modifierChips: 0,
      unisonSuit: 'standard',
      unisonChips: 50,
      unisonMult: 1,
      effectChips: 0,
      effectMult: 1,
      effectScore: 0,
      pouchId: null,
      pouchChipsDelta: 0,
      pouchMultDelta: 0,
    });
  });

  it('attributes Broken Sentence so its owned Emoji Tile plays a trigger beat', () => {
    const { run, blind } = freshBlind();
    run.jokers = [{ defId: 'brokenSentence', state: {} }];
    const result = endBlind(blind, run, lex);

    expect(result.breakdown.jokerTriggers).toEqual([{
      jokerId: 'brokenSentence',
      jokerIndex: 0,
      chipsDelta: 125,
      multFactor: 4,
    }]);
  });
});
