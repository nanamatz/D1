/// <reference types="node" />
/**
 * Feel-pass item 1 scenario (2026-07-21): tile base chips ×3 (BALANCE.letterChips).
 * Verifies the raised chip floor doesn't trivialize the early ante curve.
 *
 * For each ante 1–4, plays ~200 seeded "small" blinds: greedy best-word each phase
 * (same DFS word-finder as autoplay.ts/materials.ts — finds *a* spellable word, not
 * an exhaustively optimal one, which is the established convention for these sims),
 * no discards, then reports clear% and average margin vs the ante's target.
 *
 * Run: npx tsx src/sim/feel-chip-scale.ts   (or: npm run sim:feel-chip-scale)
 */

import { newRun } from '../engine/run';
import { startBlind, submitWord, endBlind } from '../engine/loop';
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

  while (blind.phasesUsed < blind.phasesTotal && blind.hand.length > 0) {
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, Math.min(3, blind.hand.length));
    const ids = word.map((t) => t.id);
    const result = submitWord(blind, run, lex, ids, makeRng(`${seed}#w${blind.phasesUsed}`));
    blind = result.blind;
  }

  const final = endBlind(blind, run, lex);
  return { finalScore: final.finalScore, target: blind.target };
}

console.log(`Feel-pass item 1: chip ×3 clear-rate sweep — ${SEEDS} seeds/ante, antes ${ANTES.join(', ')}\n`);
console.log(`  letterChips (A/E/I/N/O/R/S/T=3 .. Q/Z=30) vs anteBaseTargets ${BALANCE.anteBaseTargets.slice(0, 4).join('/')}...\n`);

for (const ante of ANTES) {
  let cleared = 0;
  let marginSum = 0;
  let target = 0;
  for (let i = 0; i < SEEDS; i++) {
    const { finalScore, target: t } = playAnte(ante, `feel-chip-${ante}-${i}`);
    target = t;
    if (finalScore >= t) cleared++;
    marginSum += (finalScore - t) / t;
  }
  const clearPct = ((cleared / SEEDS) * 100).toFixed(1);
  const avgMargin = ((marginSum / SEEDS) * 100).toFixed(1);
  console.log(
    `  Ante ${ante} (target ${target}): clear ${clearPct}%  avg margin ${avgMargin}%  (${cleared}/${SEEDS})`,
  );
}
