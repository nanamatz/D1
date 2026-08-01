import { describe, it, expect } from 'vitest';
import { judgeSentence } from '../src/engine/patterns';
import { makeLexicon } from '../src/engine/lexicon';
import type { Suit, WordSubmission } from '../src/engine/types';

const L = makeLexicon([], {
  wow: { suit: 'standard', pos: ['interjection'] },
  run: { suit: 'standard', pos: ['verbIntransitive', 'verbTransitive', 'noun'] },
  eat: { suit: 'standard', pos: ['verbTransitive'] },
  fish: { suit: 'standard', pos: ['noun'] },
  birds: { suit: 'standard', pos: ['noun'] },
  fly: { suit: 'standard', pos: ['verbIntransitive'] },
  pizza: { suit: 'standard', pos: ['noun'] },
  tastes: { suit: 'standard', pos: ['verbLinking'] },
  good: { suit: 'standard', pos: ['adjective'] },
  cat: { suit: 'standard', pos: ['noun'] },
  cats: { suit: 'standard', pos: ['noun'] },
  eats: { suit: 'standard', pos: ['verbTransitive'] },
  feels: { suit: 'standard', pos: ['verbIntransitive', 'verbLinking'] },
  i: { suit: 'standard', pos: ['noun'] },
  give: { suit: 'standard', pos: ['verbTransitive'] },
  him: { suit: 'standard', pos: ['noun'] },
  and: { suit: 'standard', pos: ['conjunction'] },
  dogs: { suit: 'standard', pos: ['noun'] },
  sleep: { suit: 'standard', pos: ['verbIntransitive'] },
  the: { suit: 'standard', pos: ['article'] },
  big: { suit: 'standard', pos: ['adjective'] },
  very: { suit: 'standard', pos: ['adverb'] },
  made: { suit: 'standard', pos: ['verbTransitive'] },
  called: { suit: 'standard', pos: ['verbTransitive'] },
  found: { suit: 'standard', pos: ['verbTransitive'] },
  she: { suit: 'standard', pos: ['noun'] },
  we: { suit: 'standard', pos: ['noun'] },
  me: { suit: 'standard', pos: ['noun'] },
  tom: { suit: 'standard', pos: ['noun'] },
  it: { suit: 'standard', pos: ['noun'] },
  happy: { suit: 'standard', pos: ['adjective'] },
  useful: { suit: 'standard', pos: ['adjective'] },
  are: { suit: 'standard', pos: ['verbLinking'] },
  you: { suit: 'standard', pos: ['noun'] },
  ready: { suit: 'standard', pos: ['adjective'] },
  do: { suit: 'standard', pos: ['verbTransitive'] },
  know: { suit: 'standard', pos: ['verbTransitive', 'verbIntransitive'] },
  where: { suit: 'standard', pos: ['adverb'] },
  not: { suit: 'standard', pos: ['adverb'] },
  never: { suit: 'standard', pos: ['adverb'] },
  isnt: { suit: 'standard', pos: [] },
  here: { suit: 'standard', pos: ['adverb'] },
  he: { suit: 'standard', pos: ['noun'] },
  lies: { suit: 'standard', pos: ['verbIntransitive'] },
  because: { suit: 'standard', pos: ['conjunction'] },
  when: { suit: 'standard', pos: ['conjunction', 'adverb'] },
  if: { suit: 'standard', pos: ['conjunction'] },
  rained: { suit: 'standard', pos: ['verbIntransitive'] },
  stayed: { suit: 'standard', pos: ['verbTransitive', 'verbIntransitive'] },
  home: { suit: 'standard', pos: ['noun'] },
  arrived: { suit: 'standard', pos: ['verbIntransitive'] },
  started: { suit: 'standard', pos: ['verbIntransitive'] },
  study: { suit: 'standard', pos: ['verbIntransitive'] },
  will: { suit: 'standard', pos: ['verbTransitive'] },
  pass: { suit: 'standard', pos: ['verbIntransitive'] },
});

// Minimal WordSubmission builder — judge only reads text / suit / isGibberish.
const seq = (spec: Array<string | { t: string; suit?: Suit | null; gib?: boolean }>): WordSubmission[] =>
  spec.map((s) => {
    const w = typeof s === 'string' ? { t: s } : s;
    const gib = 'gib' in w ? w.gib : false;
    return {
      tiles: [],
      text: w.t,
      isGibberish: gib ?? false,
      suit: gib ? null : (('suit' in w ? w.suit : 'standard') ?? 'standard'),
      posUsed: null,
      settledScore: 0,
    };
  });

const pattern = (words: Parameters<typeof seq>[0]) => judgeSentence(seq(words), L).match?.pattern ?? null;

describe('slice3 patterns — the twelve matchers (GDD §5.2)', () => {
  it('Outcry: interjection alone', () => {
    expect(pattern(['WOW'])).toBe('outcry');
  });

  it('Imperative: a bare verb no longer matches (needs an object)', () => {
    expect(pattern(['RUN'])).toBeNull();
  });

  it('Imperative: verb + noun', () => {
    expect(pattern(['EAT', 'FISH'])).toBe('imperative');
  });

  it('Chant: same verb ×2+ (FLY FLY — a pure verb, so nothing outranks it)', () => {
    // NB: "run" is also a noun, so RUN RUN RUN matches the higher-ranked
    // Transitive (noun-verb-noun) under "highest pattern wins". Chant is the
    // top match only for words with no competing noun reading.
    const j = judgeSentence(seq(['FLY', 'FLY']), L);
    expect(j.match?.pattern).toBe('chant');
    expect(j.match?.repeats).toBe(2);
  });

  it('Simple: noun + intransitive verb (BIRDS FLY)', () => {
    expect(pattern(['BIRDS', 'FLY'])).toBe('simple');
  });

  it('Descriptive: noun + linking verb + adjective (PIZZA TASTES GOOD)', () => {
    expect(pattern(['PIZZA', 'TASTES', 'GOOD'])).toBe('descriptive');
  });

  it('Transitive: noun + transitive verb + noun (CAT EATS FISH)', () => {
    expect(pattern(['CAT', 'EATS', 'FISH'])).toBe('transitive');
  });

  it('Ditransitive: noun + TV + noun + noun (I GIVE HIM FISH)', () => {
    expect(pattern(['I', 'GIVE', 'HIM', 'FISH'])).toBe('ditransitive');
  });

  it('Compound: clause + conjunction + clause (CATS RUN AND DOGS SLEEP)', () => {
    expect(pattern(['CATS', 'RUN', 'AND', 'DOGS', 'SLEEP'])).toBe('compound');
  });

  it('Object Complement: subject + selected transitive verb + object + complement', () => {
    expect(pattern(['I', 'MADE', 'HIM', 'HAPPY'])).toBe('objectComplement');
    expect(pattern(['SHE', 'CALLED', 'ME', 'TOM'])).toBe('objectComplement');
    expect(pattern(['WE', 'FOUND', 'IT', 'USEFUL'])).toBe('objectComplement');
  });

  it('does not misclassify an ordinary ditransitive sentence as Object Complement', () => {
    expect(pattern(['I', 'GIVE', 'HIM', 'FISH'])).toBe('ditransitive');
  });

  it('Interrogative: detects openers without a question-mark tile', () => {
    expect(pattern(['ARE', 'YOU', 'READY'])).toBe('interrogative');
    expect(pattern(['DO', 'YOU', 'KNOW'])).toBe('interrogative');
    expect(pattern(['WHERE', 'ARE', 'YOU'])).toBe('interrogative');
    expect(pattern(['WHY', 'ME'])).toBe('interrogative');
  });

  it('Negative: accepts NOT, NEVER, and apostrophe-free contractions', () => {
    expect(pattern(['I', 'DO', 'NOT', 'KNOW'])).toBe('negative');
    expect(pattern(['SHE', 'ISNT', 'HERE'])).toBe('negative');
    expect(pattern(['HE', 'NEVER', 'LIES'])).toBe('negative');
  });

  it('Complex: subordinator + subordinate clause + main clause', () => {
    expect(pattern(['BECAUSE', 'IT', 'RAINED', 'I', 'STAYED', 'HOME'])).toBe('complex');
    expect(pattern(['WHEN', 'HE', 'ARRIVED', 'WE', 'STARTED'])).toBe('complex');
    expect(pattern(['IF', 'YOU', 'STUDY', 'YOU', 'WILL', 'PASS'])).toBe('complex');
  });
});

describe('slice3 patterns — matching rules (GDD §5.1)', () => {
  it('a gibberish hole voids all pattern matches (rule 1)', () => {
    const j = judgeSentence(seq(['CAT', { t: '???', gib: true }, 'FISH']), L);
    expect(j.match).toBeNull();
  });

  it('highest single pattern only — Descriptive beats Simple (rule 2)', () => {
    // CAT FEELS GOOD: matches Simple (GOOD absorbed) AND Descriptive; take Descriptive
    expect(pattern(['CAT', 'FEELS', 'GOOD'])).toBe('descriptive');
  });

  it('modifier absorption keeps the skeleton — THE BIG CAT EATS FISH is Transitive (rule 3)', () => {
    const j = judgeSentence(seq(['THE', 'BIG', 'CAT', 'EATS', 'FISH']), L);
    expect(j.match?.pattern).toBe('transitive');
    expect(j.match?.absorbedModifiers).toBe(2); // THE + BIG
  });

  it('absorbs an adverb in Descriptive (PIZZA TASTES VERY GOOD)', () => {
    const j = judgeSentence(seq(['PIZZA', 'TASTES', 'VERY', 'GOOD']), L);
    expect(j.match?.pattern).toBe('descriptive');
    expect(j.match?.absorbedModifiers).toBe(1); // VERY
  });

  it('no match for a bare noun', () => {
    expect(pattern(['CAT'])).toBeNull();
  });
});

describe('slice3 patterns — Unison bonus (GDD §5.3)', () => {
  it('fires when 2+ words all share a suit', () => {
    const j = judgeSentence(seq([{ t: 'EAT', suit: 'slang' }, { t: 'FISH', suit: 'slang' }]), L);
    expect(j.unison?.suit).toBe('slang');
  });

  it('does not fire on mixed suits', () => {
    const j = judgeSentence(seq([{ t: 'EAT', suit: 'slang' }, { t: 'FISH', suit: 'formal' }]), L);
    expect(j.unison).toBeNull();
  });

  it('does not fire on a single word (min 2)', () => {
    expect(judgeSentence(seq([{ t: 'RUN', suit: 'slang' }]), L).unison).toBeNull();
  });

  it('is voided by a gibberish hole (null suit breaks uniformity)', () => {
    const j = judgeSentence(seq([{ t: 'EAT', suit: 'slang' }, { t: '?', gib: true }]), L);
    expect(j.unison).toBeNull();
  });
});
