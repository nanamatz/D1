import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateLetterHand } from '../src/engine/letterHands';
import { judgeSentence } from '../src/engine/patterns';
import { scoreWord } from '../src/engine/scoring';
import type { Letter, Tile } from '../src/engine/types';
import { loadStubLexicon } from '../src/sim/stub-lexicon';
import { loadBrowserLexicon } from '../src/ui/lexicon.browser';

const lexicon = loadStubLexicon();
const surfaces = ['mvp', 'mvps', 'vip', 'vips'] as const;
const validitySurfaces = ['christ', 'christmas'] as const;

function tiles(word: string): Tile[] {
  return [...word.toUpperCase()].map((letter, index) => ({
    id: `${word}-${index}`,
    letter: letter as Letter,
    material: 'ceramic',
    font: 'medium',
  }));
}

describe('curated MVP/VIP acronym families', () => {
  it('bakes exactly the four singular/plural noun surfaces', () => {
    const curated = JSON.parse(readFileSync(
      'lexicon-pipeline/curated-abbreviations.json',
      'utf8',
    )) as { word: string; suit: string; pos: string[] }[];
    expect(curated.map(({ word }) => word)).toEqual(surfaces);

    for (const word of surfaces) {
      expect(lexicon.lookup(`  ${word.toUpperCase()}  `)).toEqual({
        word,
        suit: 'standard',
        pos: ['noun'],
      });
    }
  });

  it('does not admit punctuation or unrelated initialisms', () => {
    for (const word of ['ceo', 'cfo', 'm.v.p.', 'v.i.p.', 'pvm']) {
      expect(lexicon.isWord(word), word).toBe(false);
    }
  });

  it('keeps the browser bundle and headless loader identical', () => {
    const browser = loadBrowserLexicon();
    expect(browser.size).toBe(lexicon.size);
    expect(browser.registerTotals).toEqual(lexicon.registerTotals);
    for (const word of [...surfaces, ...validitySurfaces]) {
      expect(browser.lookup(word)).toEqual(lexicon.lookup(word));
    }
  });

  it.each([
    ['mvp', 120],
    ['vip', 96],
    ['mvps', 165],
    ['vips', 135],
  ] as const)('scores %s as Standard with no Word Hand', (word, score) => {
    const submission = scoreWord(tiles(word), lexicon);
    expect(submission).toMatchObject({
      text: word.toUpperCase(),
      isGibberish: false,
      suit: 'standard',
      settledScore: score,
    });
    expect(evaluateLetterHand(word.toUpperCase(), false)).toBeNull();
  });

  it('uses noun POS in patterns while a wrong order remains gibberish', () => {
    const sequence = ['mvp', 'eats', 'vip'].map((word) => scoreWord(tiles(word), lexicon));
    expect(judgeSentence(sequence, lexicon).match?.pattern).toBe('transitive');

    const wrongOrder = scoreWord(tiles('pvm'), lexicon);
    expect(wrongOrder).toMatchObject({
      isGibberish: true,
      suit: null,
      settledScore: 30,
    });
  });
});

describe('reviewed curated validity omissions', () => {
  it('bakes only the reviewed exact rows with reasons and authoritative metadata', () => {
    const curated = JSON.parse(readFileSync(
      'lexicon-pipeline/curated-validity.json',
      'utf8',
    )) as { word: string; suit: string; pos: string[]; reason: string }[];
    const dictionary = new Set(readFileSync('data/dictionary.txt', 'utf8').split(/\r?\n/));
    const pipelineSources = [
      'scripts/build-dictionary.mjs',
      'lexicon-pipeline/classify-wordnet.mjs',
      'lexicon-pipeline/classify-registers.mjs',
      'scripts/validate-data.mjs',
    ].map((file) => readFileSync(file, 'utf8'));

    expect(curated.map(({ word }) => word)).toEqual(validitySurfaces);
    for (const source of pipelineSources) expect(source).toContain('curated-validity.json');
    for (const entry of curated) {
      expect(entry).toMatchObject({ suit: 'standard', pos: ['noun'] });
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(dictionary.has(entry.word)).toBe(true);
      expect(lexicon.lookup(entry.word)).toEqual({
        word: entry.word,
        suit: 'standard',
        pos: ['noun'],
      });
      expect(scoreWord(tiles(entry.word), lexicon)).toMatchObject({
        isGibberish: false,
        suit: 'standard',
        posUsed: null,
      });
    }
  });

  it('does not create proper-name or derivative families implicitly', () => {
    for (const word of ['christs', 'christmases', 'christian']) {
      expect(lexicon.isWord(word), word).toBe(false);
    }
  });
});
