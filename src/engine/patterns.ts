/**
 * Sentence pattern matching (GDD §5) — the game's "poker hand" table.
 *
 * Level-1 judgment only (GDD §4.1): assign each word a POS from its allowed set
 * and match the whole sequence against the twelve patterns. No external NLP.
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
import { isModifier, isVerb, submissionSuits } from './types';
import type {
  PatternId,
  PatternMatch,
  POS,
  SentenceJudgment,
  RegisterSynergyResult,
  Suit,
  UnisonResult,
  WordSubmission,
} from './types';

/** Run Info hides these until their first authoritative activation in the run. */
export const HIDDEN_PATTERN_IDS = [
  'objectComplement',
  'ditransitive',
  'complex',
] as const satisfies readonly PatternId[];

export function isHiddenPattern(id: unknown): id is (typeof HIDDEN_PATTERN_IDS)[number] {
  return HIDDEN_PATTERN_IDS.includes(id as (typeof HIDDEN_PATTERN_IDS)[number]);
}

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
const LINKING: Slot = (w) => can(w, 'verbLinking');
const INTERJECTION: Slot = (w) => can(w, 'interjection');
const ANYVERB: Slot = (w) => canVerb(w);

const OBJECT_COMPLEMENT_VERBS = new Set([
  'make', 'makes', 'made',
  'call', 'calls', 'called',
  'find', 'finds', 'found',
  'name', 'names', 'named',
  'keep', 'keeps', 'kept',
  'consider', 'considers', 'considered',
  'elect', 'elects', 'elected',
  'paint', 'paints', 'painted',
]);
const DITRANSITIVE_VERBS = new Set([
  'give', 'gives', 'gave', 'given', 'giving',
  'tell', 'tells', 'told', 'telling',
  'send', 'sends', 'sent', 'sending',
  'show', 'shows', 'showed', 'shown', 'showing',
]);
const DITRANSITIVE: Slot = (word) =>
  can(word, 'verbTransitive') && DITRANSITIVE_VERBS.has(word.text.toLowerCase());
const QUESTION_OPENERS = new Set([
  'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how',
  'am', 'is', 'are', 'was', 'were',
  'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'shall', 'should',
  'have', 'has', 'had', 'may', 'might', 'must',
]);
const NEGATIVE_WORDS = new Set([
  'not', 'never',
  'dont', 'isnt', 'arent', 'wasnt', 'werent',
  'cant', 'couldnt', 'wont', 'wouldnt', 'shouldnt',
  'hasnt', 'havent', 'hadnt', 'didnt', 'doesnt',
]);
const CONTRACTED_NEGATIVES = new Set(
  [...NEGATIVE_WORDS].filter((word) => word !== 'not' && word !== 'never'),
);
const SUBORDINATORS = new Set([
  'because', 'when', 'if', 'although', 'while', 'unless', 'since', 'after', 'before',
]);

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
  [NOUN, ANYVERB], // simple
  [NOUN, LINKING, ADJ], // descriptive
  [NOUN, ANYVERB, NOUN], // transitive
  [NOUN, DITRANSITIVE, NOUN, NOUN], // ditransitive
  [NOUN, ANYVERB, ANYVERB], // auxiliary + lexical verb
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

/** Chant: 2+ occurrences of the identical word, each usable as a verb. */
function matchChant(words: readonly POSWord[]): number | null {
  if (words.length < BALANCE.patterns.chant.repeatFloor) return null;
  const first = words[0]!.text.toLowerCase();
  const allSame = words.every((w) => w.text.toLowerCase() === first && canVerb(w));
  return allSame ? words.length : null;
}

/** S + object-complement verb + O + adjective/noun complement. */
function matchObjectComplement(words: readonly POSWord[]): number | null {
  const predicate: Slot = (word) =>
    can(word, 'verbTransitive') && OBJECT_COMPLEMENT_VERBS.has(word.text.toLowerCase());
  const adjective = matchSkeleton(words, [NOUN, predicate, NOUN, ADJ]);
  const noun = matchSkeleton(words, [NOUN, predicate, NOUN, NOUN]);
  if (adjective === null) return noun;
  if (noun === null) return adjective;
  return Math.min(adjective, noun);
}

/** Question mark tiles are unnecessary: an interrogative/auxiliary opener is the signal. */
function matchInterrogative(words: readonly POSWord[]): number | null {
  if (words.length < 2 || !QUESTION_OPENERS.has(words[0]!.text.toLowerCase())) return null;
  // Common elliptical question: the predicate is understood ("Why [is it] me?").
  if (words.length === 2 && words[0]!.text.toLowerCase() === 'why' && NOUN(words[1]!)) return 0;
  return words.some((word) => canVerb(word)) && words.some((word) => can(word, 'noun')) ? 0 : null;
}

/** NOT/NEVER and apostrophe-free contractions such as DONT/ISNT/CANT. */
function matchNegative(words: readonly POSWord[]): number | null {
  const texts = words.map((word) => word.text.toLowerCase());
  if (!texts.some((word) => NEGATIVE_WORDS.has(word))) return null;
  const hasSubject = words.some((word) => can(word, 'noun'));
  const hasPredicate =
    words.some((word) => canVerb(word)) ||
    texts.some((word) => CONTRACTED_NEGATIVES.has(word));
  return hasSubject && hasPredicate ? 0 : null;
}

/** Initial subordinator + complete subordinate clause + complete main clause. */
function matchComplex(words: readonly POSWord[]): number | null {
  if (words.length < 5 || !SUBORDINATORS.has(words[0]!.text.toLowerCase())) return null;
  for (let split = 3; split < words.length; split += 1) {
    if (
      matchesAnyClause(words.slice(1, split)) &&
      matchesAnyClause(words.slice(split))
    ) return 0;
  }
  return null;
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
  push('simple', matchSkeleton(words, [NOUN, ANYVERB]));
  push('descriptive', matchSkeleton(words, [NOUN, LINKING, ADJ]));
  push('transitive', matchSkeleton(words, [NOUN, ANYVERB, NOUN]));
  push('ditransitive', matchSkeleton(words, [NOUN, DITRANSITIVE, NOUN, NOUN]));

  const chant = matchChant(words);
  if (chant !== null) push('chant', 0, chant);

  const compound = matchCompound(words);
  if (compound !== null) push('compound', compound);

  push('objectComplement', matchObjectComplement(words));
  push('interrogative', matchInterrogative(words));
  push('negative', matchNegative(words));
  push('complex', matchComplex(words));

  return out;
}

/** Highest-ranked candidate. Pattern ranks are unique, so no tie-break is needed. */
function winningCandidate(words: readonly POSWord[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates(words)) {
    if (
      best === null ||
      BALANCE.patterns[candidate.id].rank > BALANCE.patterns[best.id].rank
    ) best = candidate;
  }
  return best;
}

/** Union of POS choices that preserve the exact winning pattern outcome. */
function compatiblePos(
  words: readonly POSWord[],
  winning: Candidate,
): readonly (readonly POS[])[] {
  return words.map((word, wordIndex) => word.pos.filter((pos) => {
    const constrained = words.map((candidate, index) =>
      index === wordIndex ? { ...candidate, pos: [pos] } : candidate,
    );
    return candidates(constrained).some((candidate) =>
      candidate.id === winning.id &&
      candidate.absorbed === winning.absorbed &&
      candidate.repeats === winning.repeats,
    );
  }));
}

/** Unison (§5.3): 2+ words sharing at least one final non-null register. */
function judgeUnison(sequence: readonly WordSubmission[]): UnisonResult | null {
  if (sequence.length < BALANCE.unison.minWords) return null;
  const common = new Set(submissionSuits(sequence[0]!));
  for (const word of sequence.slice(1)) {
    const suits = new Set(submissionSuits(word));
    for (const suit of common) if (!suits.has(suit)) common.delete(suit);
  }
  const first = common.values().next().value as Suit | undefined;
  return first === undefined ? null : { suit: first };
}

function judgeRegisterSynergy(
  sequence: readonly WordSubmission[],
): RegisterSynergyResult | null {
  if (sequence.length < BALANCE.registerSynergies.minWords) return null;
  const suits = new Set(sequence.flatMap((word) => submissionSuits(word)));
  const id = suits.size >= 3
    ? 'mishmash'
    : suits.size === 2 && suits.has('standard') && suits.has('formal')
      ? 'harmony'
      : suits.size === 2 && suits.has('slang') && suits.has('vulgar')
        ? 'contrast'
        : suits.size === 2 && suits.has('formal') && suits.has('vulgar')
          ? 'whiplash'
          : null;
  return id === null
    ? null
    : { id, chipsFactor: BALANCE.registerSynergies[id].chipsFactor };
}

/** Judge the whole sequence: best pattern + either Unison or one mixed-register synergy. */
export function judgeSentence(sequence: readonly WordSubmission[], lexicon: Lexicon): SentenceJudgment {
  // Rule 1: any gibberish hole voids all pattern matches.
  const hasHole = sequence.some((w) => w.isGibberish);
  if (hasHole || sequence.length === 0) {
    return {
      match: null,
      unison: hasHole ? null : judgeUnison(sequence),
      registerSynergy: null,
      compatiblePos: null,
    };
  }

  const words: POSWord[] = sequence.map((w) => ({
    text: w.text,
    pos: lexicon.lookup(w.text)?.pos ?? [],
  }));

  const winning = winningCandidate(words);
  const best: PatternMatch | null = winning === null
    ? null
    : winning.repeats === undefined
      ? {
          pattern: winning.id,
          rank: BALANCE.patterns[winning.id].rank,
          absorbedModifiers: winning.absorbed,
        }
      : {
          pattern: winning.id,
          rank: BALANCE.patterns[winning.id].rank,
          absorbedModifiers: winning.absorbed,
          repeats: winning.repeats,
        };

  const unison = judgeUnison(sequence);
  return {
    match: best,
    unison,
    registerSynergy: unison ? null : judgeRegisterSynergy(sequence),
    compatiblePos: winning ? compatiblePos(words, winning) : null,
  };
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

/** Sum of the fixed level increments above level 1. */
function patternLevelGrowth(level: number): number {
  const steps = Math.max(0, level - 1);
  const growth: number = BALANCE.patternLevelGrowthFactor;
  return growth === 1
    ? steps
    : (Math.pow(growth, steps) - 1) / (growth - 1);
}

const naturalScore = (value: number): number => Math.max(1, Math.round(value));

/** A pattern's current [chips × mult] at a given level (feature-02 A-3, Run Info). */
export function patternChipsMult(id: PatternId, level: number): { chips: number; mult: number } {
  const P = BALANCE.patterns[id] as PatternBalance;
  const accumulatedGrowth = patternLevelGrowth(level);
  return {
    chips: naturalScore(P.baseChips + accumulatedGrowth * P.levelChips),
    mult: naturalScore(P.baseMult + accumulatedGrowth * P.levelMult),
  };
}

export interface FinalScore {
  /** Chips added to committed after the mixed-register factor is materialized. */
  sentenceChips: number;
  /** Mult applied to the combined committed + sentence Chips axis */
  sentenceMult: number;
  /** Mixed-register X Chips applied before sentence hooks. */
  registerSynergyChipsFactor: number;
  /** score gained over totalBefore */
  bonus: number;
  /** (totalBefore + sentenceChips) × sentenceMult */
  total: number;
}

/** Apply sentence axes to the committed blind score (GDD §5.2). */
export const sentenceTotal = (totalBefore: number, chips: number, mult: number): number =>
  (totalBefore + chips) * mult;

/**
 * Compute the sentence bonus (GDD §5.2, feature-02 A). Every pattern owns a base
 * [Chips × Mult]; modifiers add +15 to the Chips side and Unison folds in.
 * When active, one mixed-register factor multiplies committed + raw Chips and
 * materializes its gain before sentence hooks. Mult then applies normally.
 *
 *   final = ((committed + rawSentenceChips) × registerChipsFactor)
 *         × (patternMult × unisonMult)
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
      const extra = Math.max(0, m.repeats - (P.repeatFloor ?? 2));
      chips += extra * naturalScore(
        (P.repeatChips ?? 0) + patternLevelGrowth(lvl) * (P.repeatLevelChips ?? 0),
      );
    }
    chips += BALANCE.modifierAbsorption.chips * m.absorbedModifiers;
  }

  const u = judgment.unison;
  if (u) {
    const U = BALANCE.unison[u.suit] as { chips?: number; mult?: number };
    if (U.chips !== undefined) chips += U.chips;
    if (U.mult !== undefined) mult *= U.mult;
  }

  const registerSynergyChipsFactor = judgment.registerSynergy?.chipsFactor ?? 1;
  chips = (totalBefore + chips) * registerSynergyChipsFactor - totalBefore;
  const total = sentenceTotal(totalBefore, chips, mult);
  return {
    sentenceChips: chips,
    sentenceMult: mult,
    registerSynergyChipsFactor,
    bonus: total - totalBefore,
    total,
  };
}
