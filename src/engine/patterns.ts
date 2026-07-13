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
  PatternOp,
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
  // Imperative: bare verb OR verb + noun (prefer the tighter core → fewer absorbed).
  const impVN = matchSkeleton(words, [ANYVERB, NOUN]);
  const impV = matchSkeleton(words, [ANYVERB]);
  push('imperative', impVN ?? impV);
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

/** Loose views over the const balance tables (keys vary per pattern). */
interface PatternBalance {
  op: PatternOp;
  flatChips?: number;
  flatMult?: number;
  perRepeatChips?: number;
  perRepeatMult?: number;
  totalMult?: number;
}
interface LevelBalance {
  chips?: number;
  mult?: number;
  perRepeatChips?: number;
  perRepeatMult?: number;
  totalMult?: number;
}

export interface FinalScore {
  flatBonus: number;
  totalMultiplier: number;
  /** (totalBefore + flatBonus) × totalMultiplier */
  total: number;
}

/**
 * Fold a judgment into the blind total (GDD §7.4): four clean steps live below
 * the already-settled letter/suit layers — pattern bonus, modifier absorption,
 * punctuation levels, then unison. Additive patterns contribute flat chips×mult;
 * multiplicative patterns and non-standard unison multiply the running total.
 */
export function finalizeScore(
  totalBefore: number,
  judgment: SentenceJudgment,
  levels: Record<PatternId, number>,
): FinalScore {
  let flatBonus = 0;
  let totalMultiplier = 1;

  const m = judgment.match;
  if (m) {
    const lvl = levels[m.pattern] ?? 1;
    const P = BALANCE.patterns[m.pattern] as PatternBalance;
    const Lv = ((BALANCE.punctuationLevel as Record<string, LevelBalance>)[m.pattern] ?? {}) as LevelBalance;
    const mods = m.absorbedModifiers;

    if (P.op === 'add') {
      let chips: number;
      let mult: number;
      if (m.pattern === 'chant') {
        const r = m.repeats ?? 0;
        chips = ((P.perRepeatChips ?? 0) + (lvl - 1) * (Lv.perRepeatChips ?? 0)) * r;
        mult = ((P.perRepeatMult ?? 0) + (lvl - 1) * (Lv.perRepeatMult ?? 0)) * r;
      } else {
        chips = (P.flatChips ?? 0) + (lvl - 1) * (Lv.chips ?? 0);
        mult = (P.flatMult ?? 1) + (lvl - 1) * (Lv.mult ?? 0);
      }
      chips += BALANCE.modifierAbsorption.addPatternChips * mods;
      flatBonus += chips * mult;
    } else {
      let mm = (P.totalMult ?? 1) + (lvl - 1) * (Lv.totalMult ?? 0);
      mm += BALANCE.modifierAbsorption.multiplyPatternMult * mods;
      totalMultiplier *= mm;
    }
  }

  const u = judgment.unison;
  if (u) {
    const U = BALANCE.unison[u.suit] as { flatChips?: number; totalMult?: number };
    if (U.flatChips !== undefined) flatBonus += U.flatChips;
    if (U.totalMult !== undefined) totalMultiplier *= U.totalMult;
  }

  return { flatBonus, totalMultiplier, total: (totalBefore + flatBonus) * totalMultiplier };
}
