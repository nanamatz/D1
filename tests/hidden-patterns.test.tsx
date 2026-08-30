import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sentenceSequenceForBlind } from '../src/engine/bosses';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord, type SubmitResult } from '../src/engine/loop';
import {
  HIDDEN_PATTERN_IDS,
  judgeSentence,
} from '../src/engine/patterns';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { BlindState, RunState, Tile, WordSubmission } from '../src/engine/types';
import { RunInfo } from '../src/ui/components/RunInfo';
import { I18nProvider } from '../src/ui/i18n';

const lexicon = makeLexicon([], {
  i: { suit: 'standard', pos: ['noun'] },
  made: { suit: 'standard', pos: ['verbTransitive'] },
  give: { suit: 'standard', pos: ['verbTransitive'] },
  him: { suit: 'standard', pos: ['noun'] },
  fish: { suit: 'standard', pos: ['noun'] },
  happy: { suit: 'standard', pos: ['adjective'] },
  because: { suit: 'standard', pos: ['conjunction'] },
  it: { suit: 'standard', pos: ['noun'] },
  rained: { suit: 'standard', pos: ['verbIntransitive'] },
  stayed: { suit: 'standard', pos: ['verbIntransitive', 'verbTransitive'] },
  home: { suit: 'standard', pos: ['noun'] },
  wow: { suit: 'standard', pos: ['interjection'] },
  and: { suit: 'standard', pos: ['conjunction'] },
  dogs: { suit: 'standard', pos: ['noun'] },
  sleep: { suit: 'standard', pos: ['verbIntransitive'] },
});

const tileWord = (word: string, wordIndex: number): Tile[] =>
  [...word.toUpperCase()].map((letter, letterIndex) => ({
    id: `${wordIndex}-${letterIndex}`,
    letter: letter as Tile['letter'],
    material: 'ceramic',
    font: 'medium',
    edition: 'base',
  }));

const previewSequence = (words: readonly string[]): WordSubmission[] => words.map((text) => ({
  tiles: [],
  text,
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
}));

function playWords(
  words: readonly string[],
  seed = 'hidden-patterns',
  bossId: string | null = null,
): { run: RunState; blind: BlindState; results: SubmitResult[] } {
  let run = newRun(seed);
  let blind: BlindState = {
    ...startBlind(run, makeRng(`${seed}-blind`), {
      kind: bossId ? 'boss' : 'small',
      bossId,
      target: 1_000_000_000,
    }),
    phasesTotal: 20,
    bag: [],
  };
  const results: SubmitResult[] = [];

  words.forEach((word, wordIndex) => {
    const hand = tileWord(word, wordIndex);
    blind = { ...blind, hand, bag: [], handSizeTotal: Math.max(1, hand.length) };
    const result = submitWord(
      blind,
      run,
      lexicon,
      hand.map(({ id }) => id),
      makeRng(`${seed}-play-${wordIndex}`),
    );
    results.push(result);
    blind = result.blind;
    run = {
      ...run,
      jokers: result.jokers,
      counters: result.counters,
      discoveredPatterns: result.discoveredPatterns,
    };
  });

  return { run, blind, results };
}

describe('run-scoped hidden sentence patterns', () => {
  it('uses the exact three-pattern hidden roster and resets it for every new run', () => {
    expect(HIDDEN_PATTERN_IDS).toEqual(['objectComplement', 'ditransitive', 'complex']);
    expect(HIDDEN_PATTERN_IDS).not.toContain('compound');
    expect(newRun('first').discoveredPatterns).toEqual([]);
    expect(newRun('second').discoveredPatterns).toEqual([]);
  });

  it.each([
    ['objectComplement', ['I', 'MADE', 'HIM', 'HAPPY'], 4],
    ['ditransitive', ['I', 'GIVE', 'HIM', 'FISH'], 4],
    ['complex', ['BECAUSE', 'IT', 'RAINED', 'I', 'STAYED', 'HOME'], 5],
  ] as const)('reveals %s only on its successful winning submission and retains it', (id, words, triggerLength) => {
    const before = playWords(words.slice(0, triggerLength - 1), `${id}-before`);
    expect(before.run.discoveredPatterns).toEqual([]);

    const activated = playWords(words.slice(0, triggerLength), `${id}-activation`);
    expect(activated.results.at(-1)?.discoveredPatterns).toEqual([id]);
    expect(activated.run.patternPlayCounts[id]).toBe(0);

    const extraHand = tileWord('WOW', triggerLength);
    const afterLoss = submitWord(
      { ...activated.blind, hand: extraHand, bag: [], handSizeTotal: extraHand.length },
      activated.run,
      lexicon,
      extraHand.map(({ id: tileId }) => tileId),
      makeRng(`${id}-after-loss`),
    );
    expect(judgeSentence(afterLoss.blind.sequence, lexicon).match).toBeNull();
    expect(afterLoss.discoveredPatterns).toEqual([id]);
  });

  it('does not reveal from preview, failed input, debuffed words, or lower-priority clauses', () => {
    const previewRun = newRun('preview');
    expect(judgeSentence(previewSequence(['I', 'MADE', 'HIM', 'HAPPY']), lexicon).match?.pattern)
      .toBe('objectComplement');
    expect(previewRun.discoveredPatterns).toEqual([]);

    const failedBlind = startBlind(previewRun, makeRng('failed-blind'));
    expect(() => submitWord(failedBlind, previewRun, lexicon, ['missing'], makeRng('failed')))
      .toThrow('is not in hand');
    expect(previewRun.discoveredPatterns).toEqual([]);

    const debuffed = playWords(['I', 'MADE', 'HIM', 'HAPPY'], 'debuffed', 'burntPaper');
    expect(debuffed.results[1]?.submission.debuffed).toBe(true);
    expect(debuffed.run.discoveredPatterns).toEqual([]);

    const compoundRun = newRun('compound-with-hidden-clause');
    const compoundHand = tileWord('SLEEP', 6);
    const compoundBlind = {
      ...startBlind(compoundRun, makeRng('compound-with-hidden-clause-blind')),
      phasesTotal: 20,
      phasesUsed: 6,
      sequence: previewSequence(['I', 'GIVE', 'HIM', 'FISH', 'AND', 'DOGS']),
      hand: compoundHand,
      bag: [],
      handSizeTotal: compoundHand.length,
    };
    const compound = submitWord(
      compoundBlind,
      compoundRun,
      lexicon,
      compoundHand.map(({ id }) => id),
      makeRng('compound-with-hidden-clause-play'),
    );
    expect(judgeSentence(compound.blind.sequence, lexicon).match?.pattern).toBe('compound');
    expect(compound.discoveredPatterns).toEqual([]);
  });

  it.each(['missing', 'empty'] as const)(
    'does not reveal an existing hidden-winning sequence from a debuffed submission when discovery is %s',
    (discoveryState) => {
      const seed = `legacy-debuff-${discoveryState}`;
      const initialRun = newRun(seed);
      const { discoveredPatterns: _discarded, ...withoutDiscovery } = initialRun;
      const run: RunState = discoveryState === 'missing'
        ? withoutDiscovery
        : { ...initialRun, discoveredPatterns: [] };
      const hand = tileWord('SLEEP', 4);
      const blind: BlindState = {
        ...startBlind(run, makeRng(`${seed}-blind`), {
          kind: 'boss',
          bossId: 'burntPaper',
          target: 1_000_000_000,
        }),
        phasesTotal: 20,
        phasesUsed: 4,
        sequence: previewSequence(['I', 'MADE', 'HIM', 'HAPPY']),
        hand,
        bag: [],
        handSizeTotal: hand.length,
      };

      const result = submitWord(
        blind,
        run,
        lexicon,
        hand.map(({ id }) => id),
        makeRng(`${seed}-play`),
      );

      expect(result.submission.debuffed).toBe(true);
      expect(judgeSentence(sentenceSequenceForBlind(result.blind), lexicon).match?.pattern)
        .toBe('objectComplement');
      expect(result.discoveredPatterns).toEqual([]);
    },
  );

  it('uses the boss-transformed authoritative sequence and stays deterministic', () => {
    const words = ['WOW', 'I', 'MADE', 'HIM', 'HAPPY'];
    const first = playWords(words, 'orphan-hidden', 'orphanLine');
    const second = playWords(words, 'orphan-hidden', 'orphanLine');
    expect(first.run.discoveredPatterns).toEqual(['objectComplement']);
    expect(second.results.map(({ discoveredPatterns }) => discoveredPatterns))
      .toEqual(first.results.map(({ discoveredPatterns }) => discoveredPatterns));
  });

  it('omits hidden rows entirely from Run Info until each run discovery', () => {
    const run = newRun('run-info-hidden');
    const blind = startBlind(run, makeRng('run-info-hidden-blind'));
    const render = (state: RunState) => renderToStaticMarkup(
      <I18nProvider>
        <RunInfo run={state} blind={blind} discoveredLetterHands={new Set()} onClose={() => {}} />
      </I18nProvider>,
    );

    const initial = render(run);
    expect(initial.match(/class="ri-pat /g)).toHaveLength(9);
    expect(initial).toContain('Compound');
    expect(initial).not.toContain('Object Complement');
    expect(initial).not.toContain('Ditransitive');
    expect(initial).not.toContain('Complex');
    expect(initial).not.toContain('???');

    const revealed = render({ ...run, discoveredPatterns: ['ditransitive'] });
    expect(revealed.match(/class="ri-pat /g)).toHaveLength(10);
    expect(revealed).toContain('Ditransitive');
    expect(revealed).not.toContain('Object Complement');
    expect(revealed).not.toContain('Complex');
  });
});
