/** Headless smoke scenario for the curated MVP/VIP noun families. */
import { evaluateLetterHand } from '../engine/letterHands';
import { scoreWord } from '../engine/scoring';
import type { Letter, Tile } from '../engine/types';
import { loadStubLexicon } from './stub-lexicon';

const expected = { mvp: 120, vip: 96, mvps: 165, vips: 135 } as const;
const lexicon = loadStubLexicon();

const tiles = (word: string): Tile[] => [...word.toUpperCase()].map((letter, index) => ({
  id: `${word}-${index}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
}));

for (const [word, score] of Object.entries(expected)) {
  const submission = scoreWord(tiles(word), lexicon);
  if (submission.settledScore !== score || submission.suit !== 'standard') {
    throw new Error(`${word}: expected Standard ${score}, got ${submission.suit} ${submission.settledScore}`);
  }
  if (evaluateLetterHand(word.toUpperCase(), false) !== null) {
    throw new Error(`${word}: unexpected Word Hand`);
  }
}

console.log('Acronym sim: MVP 120, VIP 96, MVPS 165, VIPS 135; no Word Hands.');
