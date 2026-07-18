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

// ---------- Event payloads ----------

export interface EngineEvents {
  /** blind is being set up; jokers may mutate phase count, discard budget, target */
  blindStart: { run: RunState; blind: BlindState };

  /** a word's chips/mult are being computed — THE main scoring hook.
   *  Mutate ctx.chips / ctx.mult. Runs before settlement (GDD §7.1 layer 1).
   *  Use this for per-WORD effects (a flat bonus, a suit-gated bonus). */
  wordScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a SINGLE tile's chips have just been added — per-LETTER jokers (Vowel Praise,
   *  Consonant Bricklayer) hook here so their contribution interleaves with the tile
   *  scoring and animates on that tile (item 3). Mutate ctx.chips / ctx.mult. */
  tileScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext; tile: Tile };

  /** word settled and appended to the sequence; counters have been updated */
  wordScored: { run: RunState; blind: BlindState; index: number };

  /** a discard was spent */
  discardUsed: { run: RunState; blind: BlindState; tiles: Tile[] };

  /** sentence bonus is being finalized at blind end (GDD §7.4).
   *  Mutate ctx.flatBonus / ctx.totalMultiplier. */
  sentenceScoring: { run: RunState; blind: BlindState; ctx: SentenceScoringContext };

  /** blind ended. early=true when ended via the projected≥target trigger */
  blindEnd: { run: RunState; blind: BlindState; early: boolean; phasesLeft: number };

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
  hooks: JokerHooks;
}

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

// ---------- Example def (implementation reference) ----------
//
// #1 Vowel Praise (Common, layer 1): +2 Mult per vowel in the word.
// Fires on gibberish too — layer 1 reads letters only (GDD §6.4).
//
// export const vowelPraise: JokerDef = {
//   id: 'vowelPraise', gddNumber: 1,
//   nameKo: '모음 예찬', nameEn: 'Vowel Praise', emoji: '🅰️',
//   rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
//   hooks: {
//     wordScoring: ({ ctx }) => {
//       const vowels = ctx.submission.tiles.filter(t => isVowel(t.letter)).length;
//       ctx.mult += BALANCE.jokers.vowelPraise.multPerVowel * vowels;
//     },
//   },
// };
