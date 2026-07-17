/// <reference types="node" />
/**
 * Slices ①–② headless scenario (GDD: "after each slice, write a tiny scenario
 * in src/sim exercising it headlessly"). Runs one blind with the real stub
 * lexicon, proving the engine runs in pure Node — no DOM, no Math.random.
 * Shows suit-multiplied settlement (§3.1) and the projected≥target early end (§7.2).
 *
 *   npm run sim
 */

import { newRun } from '../engine/run';
import { startBlind, discardTiles, submitWord, canEndEarly, endBlind } from '../engine/loop';
import { judgeSentence } from '../engine/patterns';
import { NO_LETTER } from '../engine/scoring';
import { JOKER_REGISTRY } from '../engine/jokers';
import { resolveBlind, currentTarget, kindForIndex } from '../engine/progression';
import { makeRng } from '../engine/rng';
import type { Lexicon } from '../engine/lexicon';
import type { BlindState, Tile } from '../engine/types';
import { loadStubLexicon } from './stub-lexicon';

/** Demo-only: find any valid word spellable from the hand (ordered, len ≤ 4). */
function findWord(hand: readonly Tile[], lex: Lexicon, maxLen = 4): Tile[] | null {
  // Stone tiles (letter: null) can never be part of a valid word — a "word"
  // containing one is gibberish by definition (GDD §6.4). Exclude them from
  // the search space entirely rather than routing the string through
  // NO_LETTER: findWord's whole purpose is finding VALID words, so a
  // candidate that can provably never match shouldn't be a search branch.
  const spellable = hand.filter((t) => t.letter !== null);
  const search = (prefix: Tile[], rest: Tile[]): Tile[] | null => {
    if (prefix.length >= 1 && lex.isWord(prefix.map((t) => t.letter).join(''))) return prefix;
    if (prefix.length >= maxLen) return null;
    for (let i = 0; i < rest.length; i++) {
      const next = search([...prefix, rest[i]!], [...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (next) return next;
    }
    return null;
  };
  return search([], spellable);
}

function main(): void {
  const lex = loadStubLexicon();
  const run = newRun('slice1-demo');
  // Slice ④: equip a proof-set of jokers spanning all three layers.
  run.jokers = [
    { defId: 'consonantBricklayer', state: {} }, // layer 1
    { defId: 'jackOfAllTrades', state: {} }, // layer 1
    { defId: 'grammarian', state: {} }, // layer 3
  ];
  let blind: BlindState = startBlind(run, makeRng(run.seed)); // target from the ante curve
  const target = blind.target;

  const jokerNames = run.jokers.map((j) => JOKER_REGISTRY.get(j.defId)?.nameEn ?? j.defId);
  console.log(`Slices ①–⑤ demo — seed "${run.seed}", ante ${run.ante} ${blind.kind} (target ${target})`);
  console.log(`  jokers: ${jokerNames.join(', ')} · gold ${run.gold}`);
  console.log(`  dealt hand (${blind.hand.length}): ${blind.hand.map((t) => t.letter ?? NO_LETTER).join('')}`);
  console.log(`  bag remaining: ${blind.bag.length}, discards: ${blind.discardsLeft}\n`);

  // One discard: dump the three lowest-value-looking tiles (just the first 3).
  const dump = blind.hand.slice(0, 3).map((t) => t.id);
  blind = discardTiles(blind, dump);
  console.log(`Discarded 3 tiles → new hand: ${blind.hand.map((t) => t.letter ?? NO_LETTER).join('')}`);
  console.log(`  discards left: ${blind.discardsLeft}\n`);

  // Play until phases run out — or stop early once projected ≥ target (§7.2).
  let endedEarly = false;
  while (blind.phasesUsed < blind.phasesTotal && blind.hand.length > 0) {
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, Math.min(3, blind.hand.length));
    const ids = word.map((t) => t.id);
    const { blind: after, submission } = submitWord(blind, run, lex, ids);
    blind = after;
    const tag = submission.isGibberish ? 'GIBBERISH (hole)' : `[${submission.suit} suit]`;
    const judged = judgeSentence(blind.sequence, lex);
    const patt = judged.match ? judged.match.pattern.toUpperCase() : '—';
    const uni = judged.unison ? ` +unison(${judged.unison.suit})` : '';
    console.log(
      `Phase ${blind.phasesUsed}: "${submission.text}" +${submission.settledScore} ${tag}` +
        `  → pattern ${patt}${uni}  (projected ${blind.projectedScore}/${target})`,
    );
    if (canEndEarly(blind)) {
      endedEarly = true;
      console.log(`  ✔ projected ≥ target — early end available, cashing out.`);
      break;
    }
  }

  // Finalize the blind (GDD §7.4).
  const final = endBlind(blind, run, lex);
  console.log(`\nBlind over (${endedEarly ? 'early end' : 'phases exhausted'}).`);
  console.log(`  sequence: ${blind.sequence.map((s) => s.text).join(' · ')}`);
  console.log(
    `  final pattern: ${final.judgment.match?.pattern ?? 'none'}` +
      `${final.judgment.unison ? ` + unison(${final.judgment.unison.suit})` : ''}`,
  );
  console.log(`  final score: ${final.finalScore} vs target ${target}`);
  console.log(`  holes (gibberish): ${blind.sequence.filter((s) => s.isGibberish).length}`);

  // Slice ⑤: resolve the blind into gold + progression (GDD §9.1).
  const outcome = resolveBlind(run, blind, final.finalScore);
  if (outcome.cleared) {
    const e = outcome.earned;
    console.log(
      `  CLEARED → +${e.total} gold (reward ${e.reward} + ${final.phasesLeft} phases + ${e.interest} interest)` +
        `  → gold ${outcome.run.gold}`,
    );
    console.log(
      `  next: ante ${outcome.run.ante} ${kindForIndex(outcome.run.blindIndex)} blind` +
        ` (target ${currentTarget(outcome.run)})`,
    );
  } else {
    console.log(`  MISSED target → game over.`);
  }
}

main();
