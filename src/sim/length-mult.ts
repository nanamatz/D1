/// <reference types="node" />
/**
 * Word-length multiplier sweep (2026-07-30): length adds to Mult
 * (BALANCE.wordLength.multPerLetter), so the ante target curve has to move with it.
 *
 * For each ante 1–4, plays ~200 seeded "small" blinds: greedy best-word each phase
 * (same DFS word-finder as autoplay.ts/feel-chip-scale.ts — finds *a* spellable
 * word, not an exhaustively optimal one, the established convention here), no
 * discards, then reports clear% and average margin vs the ante's target.
 *
 * Read it against feel-chip-scale.ts's recorded baseline: ante 1 ~77.5% clear,
 * antes 2-4 falling off sharply. Re-tune anteBaseTargets to restore that shape.
 *
 * Run: npm run sim:length-mult
 */

import { newRun } from '../engine/run';
import { startBlind, submitWord, endBlind, blindExhausted } from '../engine/loop';
import { makeRng } from '../engine/rng';
import { blindTarget } from '../engine/economy';
import { BALANCE } from '../engine/balance';
import { loadStubLexicon } from './stub-lexicon';
import { findWord } from './find-word';

const SEEDS = 200;
const ANTES = [1, 2, 3, 4] as const;

function playAnte(ante: number, seed: string): { finalScore: number; target: number } {
  const lex = loadStubLexicon();
  const run = { ...newRun(seed), ante, blindIndex: 0 as const };
  const target = blindTarget(ante, 'small');
  let blind = startBlind(run, makeRng(seed), { target });

  while (blind.phasesUsed < blind.phasesTotal && !blindExhausted(blind)) {
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, Math.min(3, blind.hand.length));
    const ids = word.map((t) => t.id);
    const result = submitWord(blind, run, lex, ids, makeRng(`${seed}#w${blind.phasesUsed}`));
    blind = result.blind;
  }

  const final = endBlind(blind, run, lex);
  return { finalScore: final.finalScore, target: blind.target };
}

console.log(
  `Length-mult sweep — multPerLetter ${BALANCE.wordLength.multPerLetter}, ${SEEDS} seeds/ante\n`,
);
console.log(`  anteBaseTargets ${BALANCE.anteBaseTargets.slice(0, 4).join('/')}...\n`);

for (const ante of ANTES) {
  let cleared = 0;
  let marginSum = 0;
  let scoreSum = 0;
  let target = 0;
  for (let i = 0; i < SEEDS; i++) {
    const { finalScore, target: t } = playAnte(ante, `length-mult-${ante}-${i}`);
    target = t;
    scoreSum += finalScore;
    if (finalScore >= t) cleared++;
    marginSum += (finalScore - t) / t;
  }
  const clearPct = ((cleared / SEEDS) * 100).toFixed(1);
  const avgMargin = ((marginSum / SEEDS) * 100).toFixed(1);
  const avgScore = Math.round(scoreSum / SEEDS);
  console.log(
    `  Ante ${ante} (target ${target}): clear ${clearPct}%  avg score ${avgScore}  avg margin ${avgMargin}%  (${cleared}/${SEEDS})`,
  );
}
