/**
 * Joker hook system (GDD §11).
 *
 * Design: every joker is data (JokerDef) + a bag of event handlers.
 * The engine emits events at fixed points in the pipeline (GDD §7.4);
 * owned jokers' handlers run in acquisition order (Balatro left-to-right).
 *
 * Layer mapping (GDD §11):
 *  - layer 1 (letter/tile)   → mostly onWordScoring (fires on gibberish too, §6.4)
 *  - layer 2 (suit)          → onWordScoring gated by suit (never fires on gibberish: suit=null)
 *  - layer 3 (sentence/phase)→ onSentenceScoring / onBlindEnd / onEarlyEnd
 */

import type {
  BlindState, JokerRarity, OwnedJoker, RunState,
  SentenceScoringContext, Tile, WordScoringContext,
} from './types';
import type { Rng } from './rng';

// ---------- Event payloads ----------

export interface EngineEvents {
  /** blind is being set up; jokers may mutate phase count, discard budget, target */
  blindStart: { run: RunState; blind: BlindState };

  /** rule-changing pass before shelf-ordered scoring hooks. It may extend
   *  ctx.scoringSuits, but never mutates submission.suit/POS. */
  wordRules: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a word's chips/mult are being computed — THE main scoring hook.
   *  Mutate ctx.chips / ctx.mult. Runs before settlement (GDD §7.1 layer 1).
   *  Use this for per-WORD effects (a flat bonus, a suit-gated bonus). */
  wordScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a SINGLE tile's chips have just been added. Per-letter Emoji Tiles hook here
   *  so their contribution interleaves with tile scoring. */
  tileScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext; tile: Tile };

  /** word settled and appended to the sequence; counters have been updated */
  wordScored: { run: RunState; blind: BlindState; index: number };

  /** a discard was spent */
  discardUsed: { run: RunState; blind: BlindState; tiles: Tile[] };

  /** sentence bonus is being finalized at blind end (GDD §7.4).
   *  Mutate ctx.sentenceChips / ctx.sentenceMult (the bonus = chips × mult). */
  sentenceScoring: { run: RunState; blind: BlindState; ctx: SentenceScoringContext };

  /** a Constellation card was consumed */
  constellationUsed: { run: RunState };

  /** letter tiles left the permanent pouch */
  tilesDestroyed: { run: RunState; count: number };

  /** blind ended. early=true when ended via the projected≥target trigger */
  blindEnd: { run: RunState; blind: BlindState; early: boolean; phasesLeft: number; rng: Rng };

  /** shop entered / left — for economy jokers */
  shopEnter: { run: RunState };
}

export type EngineEventName = keyof EngineEvents;

export type JokerHandler<E extends EngineEventName> = (
  payload: EngineEvents[E],
  self: OwnedJoker,
) => void;

export type JokerHooks = { [E in EngineEventName]?: JokerHandler<E> };

// ---------- Joker definition ----------

export interface JokerDef {
  id: string;
  /** number in the GDD tables (§11.2–11.5), for cross-referencing */
  gddNumber: number;
  nameKo: string;
  nameEn: string;
  emoji: string;
  rarity: JokerRarity;
  layer: 1 | 2 | 3;
  price: number; // placeholder, see balance.ts
  scalingAxis?: keyof RunState['counters'];
  /** Optional live-value row for scaling Emoji Tile tooltips.
   *  `mult` = a ×factor, `multAdd` = an additive +Mult, `chips` = additive +Chips. */
  growthDisplay?: {
    kind: 'mult' | 'multAdd' | 'chips';
    stateKey: string;
    initial: number;
  };
  hooks: JokerHooks;
}

export const hasScoringSuit = (
  ctx: WordScoringContext,
  suit: import('./types').Suit,
): boolean => ctx.scoringSuits?.has(suit) ?? ctx.submission.suit === suit;

// ---------- Event bus ----------

export class JokerBus {
  constructor(
    private defs: ReadonlyMap<string, JokerDef>,
  ) {}

  /** Emit an event to all owned jokers, in acquisition order. */
  emit<E extends EngineEventName>(
    event: E,
    payload: EngineEvents[E],
    owned: OwnedJoker[],
  ): void {
    for (const joker of owned) {
      const def = this.defs.get(joker.defId);
      const handler = def?.hooks[event];
      if (handler) handler(payload, joker);
    }
  }
}
