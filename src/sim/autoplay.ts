/// <reference types="node" />
/**
 * Slice ① headless scenario (GDD: "after each slice, write a tiny scenario in
 * src/sim exercising it headlessly"). Runs one blind with the real stub lexicon,
 * proving the engine runs in pure Node — no DOM, no Math.random.
 *
 *   npm run sim
 */

import { newRun } from '../engine/run';
import { startBlind, exchangeTiles, submitWord } from '../engine/loop';
import { makeRng } from '../engine/rng';
import type { Lexicon } from '../engine/lexicon';
import type { BlindState, Tile } from '../engine/types';
import { loadStubLexicon } from './stub-lexicon';

/** Demo-only: find any valid word spellable from the hand (ordered, len ≤ 4). */
function findWord(hand: readonly Tile[], lex: Lexicon, maxLen = 4): Tile[] | null {
  const search = (prefix: Tile[], rest: Tile[]): Tile[] | null => {
    if (prefix.length >= 1 && lex.isWord(prefix.map((t) => t.letter).join(''))) return prefix;
    if (prefix.length >= maxLen) return null;
    for (let i = 0; i < rest.length; i++) {
      const next = search([...prefix, rest[i]!], [...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (next) return next;
    }
    return null;
  };
  return search([], [...hand]);
}

function main(): void {
  const lex = loadStubLexicon();
  const run = newRun('slice1-demo');
  let blind: BlindState = startBlind(run, makeRng(run.seed));

  console.log(`Slice ① demo — seed "${run.seed}"`);
  console.log(`  dealt hand (${blind.hand.length}): ${blind.hand.map((t) => t.letter).join('')}`);
  console.log(`  bag remaining: ${blind.bag.length}, exchanges: ${blind.exchangesLeft}\n`);

  // One exchange: dump the three lowest-value-looking tiles (just the first 3).
  const dump = blind.hand.slice(0, 3).map((t) => t.id);
  blind = exchangeTiles(blind, dump, makeRng('exchange-1'));
  console.log(`Exchanged 3 tiles → new hand: ${blind.hand.map((t) => t.letter).join('')}`);
  console.log(`  exchanges left: ${blind.exchangesLeft}\n`);

  // Play until phases run out: a real word if we can find one, else gibberish.
  while (blind.phasesUsed < blind.phasesTotal && blind.hand.length > 0) {
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, Math.min(3, blind.hand.length));
    const ids = word.map((t) => t.id);
    const { blind: after, submission } = submitWord(blind, run, lex, ids);
    blind = after;
    const tag = submission.isGibberish ? 'GIBBERISH (hole)' : `word [${submission.suit}]`;
    console.log(
      `Phase ${blind.phasesUsed}: "${submission.text}" → +${submission.settledScore} ${tag}` +
        `  (committed ${blind.committedScore})`,
    );
  }

  console.log(`\nBlind over. Sequence: ${blind.sequence.map((s) => s.text).join(' · ')}`);
  console.log(`  committed score: ${blind.committedScore}`);
  console.log(`  holes (gibberish): ${blind.sequence.filter((s) => s.isGibberish).length}`);
}

main();
