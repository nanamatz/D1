/// <reference types="node" />
/**
 * Tile-pool rebalance simulation (playtest-04 C-2). Scrabble's distribution
 * assumes board-adjacency; standalone-word spelling wants a flatter curve. We
 * shrink the total and compress the extremes (cut the E-glut, raise rare
 * letters), then MEASURE candidates headlessly instead of hand-picking numbers.
 *
 * Run: `npx tsx src/sim/tile-pool.ts`
 *
 * Metrics per candidate, over many random hands at hand size 11:
 *  - avgMaxLen      average length of the LONGEST makeable word
 *  - avgMakeable    average count of makeable words
 *  - zeroWordRate   % of hands with NO makeable word (gibberish-forced)
 *  - rarePerHand    average rare letters (J K Q V W X Y Z) in a hand
 */

import { loadStubLexicon } from './stub-lexicon';
import { findSpellableWords } from '../engine/hint';
import { makeRng } from '../engine/rng';
import { BALANCE } from '../engine/balance';
import type { Letter, Tile } from '../engine/types';

type Comp = Record<string, number>;

const RARE = new Set(['J', 'K', 'Q', 'V', 'W', 'X', 'Y', 'Z']);
const HAND = BALANCE.handSize; // 11
const HANDS = 4000;

// Current Scrabble-derived distribution (baseline, 98 tiles).
const CURRENT: Comp = { ...BALANCE.bagComposition };

// Candidates: shrink to ~60–70, compress extremes (fewer vowels, rares 2–3).
const CAND_A: Comp = {
  A: 5, E: 6, I: 5, O: 4, U: 3, // 23 vowels
  B: 2, C: 2, D: 3, F: 2, G: 2, H: 2, J: 2, K: 2, L: 3, M: 2, N: 3,
  P: 2, Q: 2, R: 3, S: 3, T: 3, V: 2, W: 2, X: 2, Y: 2, Z: 2,
};
const CAND_B: Comp = {
  A: 5, E: 7, I: 5, O: 5, U: 3, // 25 vowels
  B: 2, C: 2, D: 3, F: 2, G: 2, H: 2, J: 2, K: 2, L: 3, M: 2, N: 4,
  P: 2, Q: 2, R: 4, S: 3, T: 4, V: 2, W: 2, X: 2, Y: 2, Z: 2,
};
const CAND_C: Comp = {
  A: 6, E: 8, I: 6, O: 6, U: 4, // 30 vowels
  B: 2, C: 2, D: 3, F: 2, G: 3, H: 2, J: 2, K: 2, L: 4, M: 2, N: 4,
  P: 2, Q: 2, R: 5, S: 4, T: 5, V: 2, W: 2, X: 2, Y: 2, Z: 2,
};
// Tightened target (~68): flat-ish, rares at 2, commons slightly higher.
const CHOSEN: Comp = {
  A: 5, E: 6, I: 5, O: 4, U: 3, // 23 vowels
  B: 2, C: 2, D: 2, F: 2, G: 2, H: 2, J: 2, K: 2, L: 2, M: 2, N: 3,
  P: 2, Q: 2, R: 3, S: 2, T: 3, V: 2, W: 2, X: 2, Y: 2, Z: 2,
};

const total = (c: Comp): number => Object.values(c).reduce((a, b) => a + b, 0);

function buildBag(c: Comp): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const [letter, count] of Object.entries(c)) {
    for (let i = 0; i < count; i++) {
      tiles.push({ id: `t${id++}`, letter: letter as Letter, case: 'upper', material: 'ceramic', font: 'medium' });
    }
  }
  return tiles;
}

interface Metrics {
  name: string;
  total: number;
  vowels: number;
  avgMaxLen: number;
  avgMakeable: number;
  zeroWordRate: number;
  rarePerHand: number;
}

function measure(name: string, comp: Comp, lex: ReturnType<typeof loadStubLexicon>): Metrics {
  const bag = buildBag(comp);
  const vowels = ['A', 'E', 'I', 'O', 'U'].reduce((s, v) => s + (comp[v] ?? 0), 0);
  let maxLenSum = 0;
  let makeableSum = 0;
  let zero = 0;
  let rareSum = 0;

  for (let i = 0; i < HANDS; i++) {
    const rng = makeRng(`${name}-${i}`);
    const hand = rng.shuffle(bag).slice(0, HAND);
    rareSum += hand.filter((t) => RARE.has(t.letter)).length;
    const words = findSpellableWords(hand, lex, 100000);
    if (words.length === 0) {
      zero++;
      continue;
    }
    makeableSum += words.length;
    let maxLen = 0;
    for (const w of words) if (w.word.length > maxLen) maxLen = w.word.length;
    maxLenSum += maxLen;
  }
  return {
    name,
    total: total(comp),
    vowels,
    avgMaxLen: maxLenSum / HANDS,
    avgMakeable: makeableSum / HANDS,
    zeroWordRate: (zero / HANDS) * 100,
    rarePerHand: rareSum / HANDS,
  };
}

function main(): void {
  const lex = loadStubLexicon();
  console.log(`Tile-pool sim — ${HANDS} hands of ${HAND} tiles each, lexicon ${lex.size} words\n`);

  const rows = [
    measure('Current(98)', CURRENT, lex),
    measure('CandA', CAND_A, lex),
    measure('CandB', CAND_B, lex),
    measure('CandC', CAND_C, lex),
    measure('CHOSEN', CHOSEN, lex),
  ];

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(
    pad('candidate', 14) + pad('total', 7) + pad('vowels', 8) + pad('avgMaxLen', 11) +
      pad('avgMakeable', 13) + pad('zeroWord%', 11) + 'rare/hand',
  );
  for (const r of rows) {
    console.log(
      pad(r.name, 14) +
        pad(r.total, 7) +
        pad(r.vowels, 8) +
        pad(r.avgMaxLen.toFixed(2), 11) +
        pad(r.avgMakeable.toFixed(1), 13) +
        pad(r.zeroWordRate.toFixed(2), 11) +
        r.rarePerHand.toFixed(2),
    );
  }
}

main();
