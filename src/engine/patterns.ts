/**
 * Sentence pattern matching (GDD §5) — the game's "poker hand" table.
 *
 * Level-1 judgment only (GDD §4.1): assign each word a POS from its allowed set
 * and match the whole sequence against the eight patterns. No NLP.
 *
 * Matching rules (§5.1):
 *   1. Whole-sequence match; a gibberish hole (§6.4) voids ALL matches.
 *   2. Highest single pattern only.
 *   3. Modifiers (article/adjective/adverb) are flesh, not skeleton — absorbed,
 *      not skeleton-breaking; each absorbed modifier feeds the bonus (§5 scoring).
 *
 * Unison (§5.3) is independent of the pattern: 2+ words all sharing one suit.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import { isModifier, isVerb } from './types';
import type {
  PatternId,
  PatternMatch,
  POS,
  SentenceJudgment,
  Suit,
  UnisonResult,
  WordSubmission,
} from './types';

/** A word reduced to what matching needs: its text and its allowed POS set. */
interface POSWord {
  text: string;
  pos: readonly POS[];
}

const can = (w: POSWord, pos: POS): boolean => w.pos.includes(pos);
const canVerb = (w: POSWord): boolean => w.pos.some(isVerb);
const canMod = (w: POSWord): boolean => w.pos.some(isModifier);

type Slot = (w: POSWord) => boolean;
const NOUN: Slot = (w) => can(w, 'noun');
const ADJ: Slot = (w) => can(w, 'adjective');
const INTRANS: Slot = (w) => can(w, 'verbIntransitive');
const TRANS: Slot = (w) => can(w, 'verbTransitive');
const LINKING: Slot = (w) => can(w, 'verbLinking');
const INTERJECTION: Slot = (w) => can(w, 'interjection');
const ANYVERB: Slot = (w) => canVerb(w);

/**
 * Match a core skeleton against the words, allowing modifiers to be absorbed
 * anywhere. Returns the absorbed-modifier count, or null if no parse exists.
 * (When a parse exists, absorbed is always words.length − skeleton.length.)
 */
function matchSkeleton(words: readonly POSWord[], skeleton: readonly Slot[]): number | null {
  const walk = (i: number, j: number): number | null => {
    if (j === skeleton.length) {
      // trailing words must all be absorbable modifiers
      for (let k = i; k < words.length; k++) if (!canMod(words[k]!)) return null;
      // every non-core word is an absorbed modifier (core count == skeleton.length)
      return words.length - skeleton.length;
    }
    if (i === words.length) return null;
    // prefer filling the skeleton slot, fall back to absorbing this word
    if (skeleton[j]!(words[i]!)) {
      const r = walk(i + 1, j + 1);
      if (r !== null) return r;
    }
    if (canMod(words[i]!)) {
      const r = walk(i + 1, j);
      if (r !== null) return r;
    }
    return null;
  };
  return walk(0, 0);
}

/** The clause skeletons a Compound half may be (everything with a verb, no nesting). */
const CLAUSE_SKELETONS: readonly Slot[][] = [
  [ANYVERB, NOUN], // imperative (verb + noun)
  [ANYVERB], // imperative (bare verb)
  [NOUN, INTRANS], // simple
  [NOUN, LINKING, ADJ], // descriptive
  [NOUN, TRANS, NOUN], // transitive
  [NOUN, TRANS, NOUN, NOUN], // ditransitive
];

const matchesAnyClause = (words: readonly POSWord[]): boolean =>
  CLAUSE_SKELETONS.some((sk) => matchSkeleton(words, sk) !== null);

/** Try Compound: split at a conjunction into two clauses, each independently valid. */
function matchCompound(words: readonly POSWord[]): number | null {
  for (let k = 1; k < words.length - 1; k++) {
    if (!can(words[k]!, 'conjunction')) continue;
    const left = words.slice(0, k);
    const right = words.slice(k + 1);
    if (matchesAnyClause(left) && matchesAnyClause(right)) {
      // conjunction is skeleton; absorbed = everything that isn't a core word.
      // Core = both clause skeletons + the conjunction; count via re-derivation.
      const absorbed = countCompoundAbsorbed(left) + countCompoundAbsorbed(right);
      return absorbed;
    }
  }
  return null;
}

/** Smallest-skeleton absorbed count for a clause (mods beyond the tightest core). */
function countCompoundAbsorbed(words: readonly POSWord[]): number {
  let best: number | null = null;
  for (const sk of CLAUSE_SKELETONS) {
    const a = matchSkeleton(words, sk);
    if (a !== null && (best === null || a < best)) best = a;
  }
  return best ?? 0;
}

/** Chant: 3+ occurrences of the identical word, each usable as a verb. */
function matchChant(words: readonly POSWord[]): number | null {
  if (words.length < 3) return null;
  const first = words[0]!.text.toLowerCase();
  const allSame = words.every((w) => w.text.toLowerCase() === first && canVerb(w));
  return allSame ? words.length : null;
}

interface Candidate {
  id: PatternId;
  absorbed: number;
  repeats?: number;
}

/** All patterns the sequence satisfies, so the caller can take the highest rank. */
function candidates(words: readonly POSWord[]): Candidate[] {
  const out: Candidate[] = [];
  const push = (id: PatternId, absorbed: number | null, repeats?: number) => {
    if (absorbed !== null) out.push(repeats === undefined ? { id, absorbed } : { id, absorbed, repeats });
  };

  push('outcry', matchSkeleton(words, [INTERJECTION]));
  // Imperative requires an object: verb + noun. A bare verb is NOT a pattern —
  // matching a lone verb spiked the projection off a single tile (changed from
  // the original "RUN alone counts" design; GDD §5.2 note).
  push('imperative', matchSkeleton(words, [ANYVERB, NOUN]));
  push('simple', matchSkeleton(words, [NOUN, INTRANS]));
  push('descriptive', matchSkeleton(words, [NOUN, LINKING, ADJ]));
  push('transitive', matchSkeleton(words, [NOUN, TRANS, NOUN]));
  push('ditransitive', matchSkeleton(words, [NOUN, TRANS, NOUN, NOUN]));

  const chant = matchChant(words);
  if (chant !== null) push('chant', 0, chant);

  const compound = matchCompound(words);
  if (compound !== null) push('compound', compound);

  return out;
}

/** Unison (§5.3): 2+ words, all the same non-null suit. */
function judgeUnison(sequence: readonly WordSubmission[]): UnisonResult | null {
  if (sequence.length < BALANCE.unison.minWords) return null;
  const first = sequence[0]!.suit;
  if (first === null) return null;
  return sequence.every((w) => w.suit === first) ? { suit: first as Suit } : null;
}

/** Judge the whole sequence: best pattern (highest rank) + unison. */
export function judgeSentence(sequence: readonly WordSubmission[], lexicon: Lexicon): SentenceJudgment {
  // Rule 1: any gibberish hole voids all pattern matches.
  const hasHole = sequence.some((w) => w.isGibberish);
  if (hasHole || sequence.length === 0) {
    return { match: null, unison: hasHole ? null : judgeUnison(sequence) };
  }

  const words: POSWord[] = sequence.map((w) => ({
    text: w.text,
    pos: lexicon.lookup(w.text)?.pos ?? [],
  }));

  const cands = candidates(words);
  let best: PatternMatch | null = null;
  for (const c of cands) {
    const rank = BALANCE.patterns[c.id].rank;
    if (best === null || rank > best.rank) {
      best =
        c.repeats === undefined
          ? { pattern: c.id, rank, absorbedModifiers: c.absorbed }
          : { pattern: c.id, rank, absorbedModifiers: c.absorbed, repeats: c.repeats };
    }
  }

  return { match: best, unison: judgeUnison(sequence) };
}

// ---------- Scoring the judgment (GDD §5.2, §7.3–7.4) ----------

/** Loose view over a pattern's balance row (chant carries the extra repeat keys). */
interface PatternBalance {
  baseChips: number;
  baseMult: number;
  levelChips: number;
  levelMult: number;
  repeatChips?: number;
  repeatLevelChips?: number;
  repeatFloor?: number;
}

/** A pattern's current [chips × mult] at a given level (feature-02 A-3, Run Info). */
export function patternChipsMult(id: PatternId, level: number): { chips: number; mult: number } {
  const P = BALANCE.patterns[id] as PatternBalance;
  return {
    chips: P.baseChips + (level - 1) * P.levelChips,
    mult: P.baseMult + (level - 1) * P.levelMult,
  };
}

export interface FinalScore {
  /** the sentence bonus' Chips side: patternChips + 15·mods + unisonChips */
  sentenceChips: number;
  /** the sentence bonus' Mult side: patternMult × unisonMult */
  sentenceMult: number;
  /** the sentence bonus itself: sentenceChips × sentenceMult */
  bonus: number;
  /** totalBefore + bonus */
  total: number;
}

/**
 * Compute the sentence bonus (GDD §5.2, feature-02 A). Every pattern owns a base
 * [Chips × Mult]; modifiers add +15 to the Chips side each and Unison folds in
 * (Standard on Chips, register mults on Mult). The result is a SELF-CONTAINED
 * bonus — `sentenceChips × sentenceMult` — ADDED to the committed total. Patterns
 * no longer multiply the running word score (the old add/multiply split is gone).
 *
 *   sentence bonus = (patternChips + 15·mods + unisonChips) × (patternMult × unisonMult)
 */
export function finalizeScore(
  totalBefore: number,
  judgment: SentenceJudgment,
  levels: Record<PatternId, number>,
): FinalScore {
  let chips = 0;
  let mult = 1;

  const m = judgment.match;
  if (m) {
    const lvl = levels[m.pattern] ?? 1;
    const P = BALANCE.patterns[m.pattern] as PatternBalance;
    const cm = patternChipsMult(m.pattern, lvl);
    chips += cm.chips;
    mult *= cm.mult;
    // Chant: +repeatChips per repeat beyond the floor (each +repeatLevelChips/level).
    if (m.pattern === 'chant' && m.repeats !== undefined) {
      const extra = Math.max(0, m.repeats - (P.repeatFloor ?? 3));
      chips += extra * ((P.repeatChips ?? 0) + (lvl - 1) * (P.repeatLevelChips ?? 0));
    }
    chips += BALANCE.modifierAbsorption.chips * m.absorbedModifiers;
  }

  const u = judgment.unison;
  if (u) {
    const U = BALANCE.unison[u.suit] as { chips?: number; mult?: number };
    if (U.chips !== undefined) chips += U.chips;
    if (U.mult !== undefined) mult *= U.mult;
  }

  const bonus = chips * mult;
  return { sentenceChips: chips, sentenceMult: mult, bonus, total: totalBefore + bonus };
}
