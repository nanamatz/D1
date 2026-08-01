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
  BlindState, JokerRarity, Letter, LexiconEntry, OwnedJoker, RunState,
  SentenceScoringContext, Tile, WordScoringContext,
} from './types';
import type { Rng } from './rng';

// ---------- Event payloads ----------

export interface EngineEvents {
  /** blind is being set up; jokers may mutate phase count, discard budget, target */
  blindStart: { run: RunState; blind: BlindState };

  /** mutable spelling projection before lexicon lookup; scoring still uses every submitted tile */
  wordPrepare: { run: RunState; blind: BlindState; tiles: readonly Tile[]; spellingTiles: Tile[] };

  /** rule-changing pass before shelf-ordered scoring hooks. It may extend
   *  ctx.scoringSuits, but never mutates submission.suit/POS. */
  wordRules: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a word's chips/mult are being computed — THE main scoring hook.
   *  Mutate ctx.chips / ctx.mult. Runs before settlement (GDD §7.1 layer 1).
   *  Use this for per-WORD effects (a flat bonus, a suit-gated bonus). */
  wordScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** boss legality/debuff checks have resolved, but a debuff has not zeroed the word yet */
  wordChecked: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    debuffed: boolean;
  };

  /** a SINGLE tile's chips have just been added. Per-letter Emoji Tiles hook here
   *  so their contribution interleaves with tile scoring. */
  tileScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext; tile: Tile };

  /** a material resolved for one tile trigger */
  materialScored: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    tile: Tile;
    triggerIndex: number;
    chipsDelta: number;
    multDelta: number;
    goldDelta: number;
    grewWood: boolean;
  };

  /** a permanent tile destruction is about to be committed; hooks may cancel it */
  tileDestroying: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    tile: Tile;
    cause: 'glass' | 'joker';
    cancelled: boolean;
  };

  /** a played letter tile produced gold through its material or font */
  tileGold: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    tile: Tile;
    gold: number;
  };

  /** word settled and appended to the sequence; counters have been updated */
  wordScored: { run: RunState; blind: BlindState; index: number };

  /** a discard was spent */
  discardUsed: {
    run: RunState;
    blind: BlindState;
    tiles: Tile[];
    gained: number;
    slotsBlocked: number;
  };

  /** sentence bonus is being finalized at blind end (GDD §7.4).
   *  Mutate ctx.sentenceChips / ctx.sentenceMult (the bonus = chips × mult). */
  sentenceScoring: {
    run: RunState;
    blind: BlindState;
    ctx: SentenceScoringContext;
    lookup?: (word: string) => LexiconEntry | null;
  };

  /** a Constellation card was consumed */
  constellationUsed: { run: RunState };

  /** letter tiles left the permanent pouch */
  tilesDestroyed: { run: RunState; count: number };

  /** letter tiles entered the permanent pouch */
  tilesCreated: { run: RunState; count: number };

  /** blind ended. early=true when ended via the projected≥target trigger */
  blindEnd: { run: RunState; blind: BlindState; early: boolean; phasesLeft: number; rng: Rng };

  /** shop entered / left — for economy jokers */
  shopEnter: { run: RunState };
}

export type EngineEventName = keyof EngineEvents;

export type JokerHandler<E extends EngineEventName> = (
  payload: EngineEvents[E],
  self: OwnedJoker,
  env: { index: number; lookup: (id: string) => JokerDef | undefined },
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
  /** Preserve multiplicative Mult semantics in the settle log so the UI can
   *  present ×factor instead of flattening the effect into an additive delta. */
  multOperation?: 'multiply';
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

export const isScoringVowel = (ctx: WordScoringContext, letter: Letter | null): boolean =>
  letter !== null && (ctx.scoringVowels?.has(letter) ?? false);

export const addTileRetrigger = (
  ctx: WordScoringContext,
  tileId: string,
  jokerId: string,
): void => {
  const sources = ctx.tileRetriggers?.get(tileId) ?? [];
  sources.push(jokerId);
  ctx.tileRetriggers?.set(tileId, sources);
};

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
    for (let index = 0; index < owned.length; index++) {
      const joker = owned[index]!;
      // Generic boss debuff marker. The owner stays in place, but every hook and
      // edition effect is inactive until the marker is cleared at blind end.
      if (joker.state.bossDisabled === 1) continue;
      const def = this.defs.get(joker.defId);
      const handler = def?.hooks[event];
      if (handler) handler(payload, joker, { index, lookup: (id) => this.defs.get(id) });
    }
  }
}
