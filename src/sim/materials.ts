/// <reference types="node" />
/**
 * Materials balance scenario (GDD §2.2). Measures the three predictions recorded
 * in docs/superpowers/specs/2026-07-17-tile-materials-design.md:
 *   1. Brass compounds to roughly ×11 off ~6 held tiles at hand size 11
 *   2. Porcelain's +30 dwarfs our Scrabble letter chips ("TASTE" = 5)
 *   3. Ivory / Lead plate economy values need no scaling
 *
 * Each trial builds an all-one-material bag (honoring the material 'stone' ⟺
 * letter null invariant), starts a blind, plays one word, and — since endBlind
 * is pure and side-effect-free (loop.ts: "the CALLER applies it") — also calls
 * endBlind on the resulting hand so Ivory's blind-end payout (prediction 3) is
 * measured directly rather than only inferred from a per-word gold column that
 * structurally reads 0 for it (Ivory pays at blind end, not per word).
 *
 * Run: npx tsx src/sim/materials.ts   (or: npm run sim:materials)
 */

import { newRun } from '../engine/run';
import { startBlind, submitWord, endBlind } from '../engine/loop';
import { makeRng } from '../engine/rng';
import { BALANCE } from '../engine/balance';
import { loadStubLexicon } from './stub-lexicon';
import { findWord } from './find-word';
import type { Tile, TileMaterial } from '../engine/types';

const TRIALS = 500;

function bagOf(material: TileMaterial): Tile[] {
  let i = 0;
  return Object.entries(BALANCE.bagComposition).flatMap(([letter, count]) =>
    Array.from({ length: count }, () => ({
      id: `s${i++}`,
      letter: material === 'stone' ? null : (letter as Tile['letter']),
      case: 'upper' as const,
      material,
      font: 'medium' as const,
    })),
  );
}

interface MaterialStats {
  score: number;
  /** per-word gold (Lead plate only — Ivory pays at blind end, reads 0 here) */
  gold: number;
  /** Ivory's blind-end payout, measured via endBlind().materialGold on the
   *  post-submission hand (~handSize tiles held after one phase). 0 for every
   *  material except Ivory. */
  blindEndGold: number;
}

function meanScore(material: TileMaterial): MaterialStats {
  const lex = loadStubLexicon();
  let score = 0;
  let gold = 0;
  let blindEndGold = 0;
  for (let i = 0; i < TRIALS; i++) {
    // The shuffle/hand seed is deliberately material-INDEPENDENT (I-3): every
    // material must be measured on the same hand samples (common random
    // numbers), or a material with genuinely zero scoring effect (Ivory has no
    // onTileScored) can still show a different mean than Ceramic purely from
    // sampling noise. `newRun`'s seed is carried along even though nothing in
    // this call path (startBlind/submitWord/endBlind) reads RunState.seed —
    // buildBag() is seedless and the bag is overridden by `bagOf` below — but
    // keeping it material-independent too avoids drift if that ever changes.
    const run = { ...newRun(`sim-${i}`), bag: bagOf(material) };
    const blind = startBlind(run, makeRng(`sim-${i}`));
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, 3);
    const r = submitWord(blind, run, lex, word.map((t) => t.id), makeRng(`roll-${i}`));
    score += r.submission.settledScore;
    gold += r.goldDelta;
    blindEndGold += endBlind(r.blind, run, lex).materialGold;
  }
  return { score: score / TRIALS, gold: gold / TRIALS, blindEndGold: blindEndGold / TRIALS };
}

const MATERIALS: TileMaterial[] = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass',
];

console.log(`Materials balance sweep — ${TRIALS} words per material, hand ${BALANCE.handSize}\n`);
const base = meanScore('ceramic').score;
for (const m of MATERIALS) {
  const { score, gold, blindEndGold } = meanScore(m);
  const ratio = base > 0 ? (score / base).toFixed(1) : 'n/a';
  console.log(
    `  ${m.padEnd(10)} mean score ${score.toFixed(1).padStart(9)}` +
      `  ×${ratio.padStart(6)} vs ceramic` +
      (gold !== 0 ? `   gold/word ${gold.toFixed(2)}` : '') +
      (blindEndGold !== 0 ? `   blind-end gold ${blindEndGold.toFixed(2)}` : ''),
  );
}
console.log(`\nAnte-1 Draft target for reference: ${BALANCE.anteBaseTargets[0]}`);
console.log(`Economy for reference: clearReward small/big/boss ${BALANCE.clearReward.small}/${BALANCE.clearReward.big}/${BALANCE.clearReward.boss} · interest cap ${BALANCE.interest.cap} · jokerPrice common ${BALANCE.jokerPrice.common}`);
console.log('Predictions: Brass ≈ ×11 · Porcelain heavily over base · Ivory/Lead plate economy unscaled.');
