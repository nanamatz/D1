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
  BlindState, ChanceResult, JokerRarity, Letter, LexiconEntry, OwnedJoker, RunState,
  SentenceScoringContext, Tile, WordScoringContext,
} from './types';
import type { Rng } from './rng';

// ---------- Event payloads ----------

/** Optional hook-authored scoring beats when one Emoji Tile must visibly fire
 * more than once. Their deltas must sum to that hook's total context change. */
export interface JokerScoreBeat {
  chipsDelta: number;
  multDelta: number;
  chipsFactor?: number;
  multFactor?: number;
  scoreDelta?: number;
  goldDelta?: number;
  tileId?: string;
  /** A tile-copy beat flies these new hand tiles out of the source tile. */
  createdTileIds?: string[];
  sourceTileId?: string;
}

/** A Blind Select hook that actually resolved. The owner reference lets the UI
 * find the same instance after another entry hook removes or reorders the shelf. */
export interface BlindSelectedJokerTrigger {
  joker: OwnedJoker;
  jokerIndex: number;
  createdTiles: Tile[];
}

export interface EngineEvents {
  /** blind is being set up; jokers may mutate phase count, discard budget, target */
  blindStart: { run: RunState; blind: BlindState };

  /** Blind Select was confirmed; hooks may permanently mutate the pouch/shelf. */
  blindSelected: {
    run: RunState;
    blind: BlindState;
    rng: Rng;
    createdTiles: Tile[];
    triggers: BlindSelectedJokerTrigger[];
  };

  /** Pure mutable spelling projection before lexicon lookup; scoring still uses every
   * submitted tile. The hook may mutate only spellingTiles, never run/blind/self state. */
  wordPrepare: { run: RunState; blind: BlindState; tiles: readonly Tile[]; spellingTiles: Tile[] };

  /** Rule-changing pass before shelf-ordered scoring hooks. It may rewrite
   * only ctx rule fields, never run/blind/self state; gibberish still keeps
   * suit/POS null. This pass is shared by preview and submission. */
  wordRules: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a word's chips/mult are being computed — THE main scoring hook.
   *  Mutate ctx.chips / ctx.mult. Runs before settlement (GDD §7.1 layer 1).
   *  Use this for per-WORD effects (a flat bonus, a suit-gated bonus). */
  wordScoring: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    /** Hooks may split one aggregate effect into ordered presentation beats. */
    scoreBeats?: JokerScoreBeat[];
    /** Seeded creation channel for effects that add permanent letter tiles. */
    rng?: Rng;
    createdTiles?: Tile[];
    /** Dictionary access for word-transform effects such as Golem. */
    lookup?: (word: string) => LexiconEntry | null;
  };

  /** An eligible word passed the debuff check and finished ordinary scoring. */
  wordChecked: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    debuffed: boolean;
  };

  /** Sole scoring seam for an otherwise short-circuited debuffed word. */
  debuffScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext };

  /** a SINGLE tile's chips have just been added. Per-letter Emoji Tiles hook here
   *  so their contribution interleaves with tile scoring. */
  tileScoring: {
    run: RunState;
    blind: BlindState;
    ctx: WordScoringContext;
    tile: Tile;
    /** Split one tile hook into ordered per-qualifying-unit beats. */
    scoreBeats?: JokerScoreBeat[];
  };

  /** a SINGLE tile remaining in hand is resolving. Held-tile Emoji Tiles hook
   * here so every contribution is attributed to that visible tile. */
  heldTileScoring: { run: RunState; blind: BlindState; ctx: WordScoringContext; tile: Tile };

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
    chanceResults?: readonly ChanceResult[];
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
    /** Permanently removed by discard-resolving Emoji Tiles. */
    destroyedTiles: Tile[];
  };

  /** tiles were actually discarded, whether by the player or an external effect */
  tilesDiscarded: { run: RunState; blind: BlindState; tiles: Tile[] };

  /** played tiles have left the hand; hooks may redirect their blind destination */
  tilesPlayed: {
    run: RunState;
    blind: BlindState;
    tiles: Tile[];
    enhancedTiles?: Array<{
      tile: Tile;
      jokerId: string;
      jokerInstanceId?: number;
    }>;
  };

  /** a Draft/Revision was skipped and the run-wide skip count has advanced */
  blindSkipped: { run: RunState };

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

  /** a Fable card was successfully consumed */
  fableUsed: { run: RunState };

  /** letter tiles left the permanent pouch */
  tilesDestroyed: { run: RunState; count: number };

  /** letter tiles entered the permanent pouch */
  tilesCreated: { run: RunState; count: number };

  /** existing letter tiles received a new material, font, or edition */
  tilesEnhanced: { run: RunState; count: number };

  /** blind ended. early=true when ended via the projected≥target trigger */
  blindEnd: { run: RunState; blind: BlindState; early: boolean; phasesLeft: number; rng: Rng; chanceResults: ChanceResult[] };

  /** Post-blind state cleanup, emitted after temporary boss debuffs are removed. */
  blindCleanup: { run: RunState; blind: BlindState };

  /** shop entered / left — for economy jokers */
  shopEnter: { run: RunState };

  /** one paid shop item-stock reroll resolved */
  shopRerolled: { run: RunState };

  /** blind-clear interest is being calculated; hooks may add to the line item */
  interestScoring: { run: RunState; interest: number };

  /** final blind-clear interest after every modifier; observers bank this exact payout */
  interestResolved: { run: RunState; interest: number };

  /** this Emoji Tile was sold; its hook may resolve against the remaining shelf */
  selfSold: { run: RunState; rng: Rng };
}

export type EngineEventName = keyof EngineEvents;

export interface JokerGrowthTrigger {
  jokerId: string;
  jokerInstanceId?: number;
  kind: 'mult' | 'multAdd' | 'chips' | 'gold' | 'handSize';
  delta: number;
}

const pruneEchoNamespacesForOwner = (
  owner: OwnedJoker,
  shelf: readonly OwnedJoker[],
): void => {
  if (owner.defId !== 'echoChamber') return;
  const liveInstanceIds = new Set(shelf.flatMap((joker) =>
    joker.instanceId === undefined || joker.state.destroyed === 1 ? [] : [joker.instanceId],
  ));
  for (const key of Object.keys(owner.state)) {
    const match = /^echo:uid:(\d+):/.exec(key);
    if (match && !liveInstanceIds.has(Number(match[1]))) delete owner.state[key];
  }
};

/** Bound copied state to physical target instances that still exist. Reordering retains state. */
export const pruneEchoNamespaces = (run: RunState): RunState => {
  let changed = false;
  const jokers = run.jokers.map((owner) => {
    if (owner.defId !== 'echoChamber') return owner;
    const state = { ...owner.state };
    const copy = { ...owner, state };
    pruneEchoNamespacesForOwner(copy, run.jokers);
    if (Object.keys(state).length === Object.keys(owner.state).length) return owner;
    changed = true;
    return copy;
  });
  return changed ? { ...run, jokers } : run;
};

/** A self-destroyed owner retained only until its final trigger has been shown. */
export interface DestroyedJokerSnapshot {
  joker: OwnedJoker;
  index: number;
}

export type JokerHandler<E extends EngineEventName> = (
  payload: EngineEvents[E],
  self: OwnedJoker,
  env: {
    index: number;
    lookup: (id: string) => JokerDef | undefined;
    /** Record one qualifying growth cause without aggregating adjacent causes. */
    grow: (kind: JokerGrowthTrigger['kind'], delta: number) => void;
  },
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
  /** Execute the immediately-right active Emoji Tile's hook at this shelf position. */
  copiesRight?: boolean;
  /** Explicit exception: this definition's wordScoring hook may run on Gibberish. */
  scoresGibberish?: boolean;
  /** State for a newly acquired instance. Run-history scalers seed themselves
   * here so buying one late includes qualifying actions from earlier this run. */
  initialState?: (run: RunState) => Record<string, number>;
  scalingAxis?: keyof RunState['counters'];
  /** Preserve multiplicative scoring semantics in the settle log so the UI can
   * present ×factor instead of flattening the effect into an additive delta. */
  chipsOperation?: 'multiply';
  chipsDisplayFactor?: number;
  multOperation?: 'multiply';
  multDisplayFactor?: number;
  /** Optional live-value row for scaling Emoji Tile tooltips.
   *  `mult` = a ×factor, `multAdd` = additive +Mult, `chips` = additive +Chips,
   *  `gold` = added sell value, `handSize` = added hand capacity. */
  growthDisplay?: {
    kind: 'mult' | 'multAdd' | 'chips' | 'gold' | 'handSize';
    stateKey: string;
    initial: number;
    /** False for trigger-only counters that animate but are not a live mechanic. */
    showInTooltip?: boolean;
    /** Opt in when a mechanic's live-value loss should play as a trigger beat. */
    showDecrease?: boolean;
    /** False when another shared watcher already owns this state change's sound. */
    playSound?: boolean;
  };
  hooks: JokerHooks;
}

export const hasScoringSuit = (
  ctx: WordScoringContext,
  suit: import('./types').Suit,
): boolean => ctx.scoringSuits?.has(suit) ?? ctx.submission.suit === suit;

export const isScoringVowel = (ctx: WordScoringContext, letter: Letter | null): boolean =>
  letter !== null && (ctx.scoringVowels?.has(letter) ?? false);

/** Virtual letter for spelling/structure rules; the physical tile stays unchanged. */
export const scoringLetter = (ctx: WordScoringContext, tile: Tile): Letter | null =>
  ctx.spellingTiles?.find((candidate) => candidate.id === tile.id)?.letter ?? tile.letter;

export const addTileRetrigger = (
  ctx: WordScoringContext,
  tileId: string,
  jokerId: string,
  jokerInstanceId?: number,
): void => {
  const sources = ctx.tileRetriggers?.get(tileId) ?? [];
  sources.push(jokerId);
  ctx.tileRetriggers?.set(tileId, sources);
  const instances = ctx.tileRetriggerInstances?.get(tileId) ?? [];
  instances.push(jokerInstanceId);
  ctx.tileRetriggerInstances?.set(tileId, instances);
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
  ): JokerGrowthTrigger[] {
    const growth: JokerGrowthTrigger[] = [];
    const growthTrigger = (
      joker: OwnedJoker,
      kind: JokerGrowthTrigger['kind'],
      delta: number,
    ): JokerGrowthTrigger => ({
      jokerId: joker.defId,
      ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
      kind,
      delta,
    });
    const invokeRight = (
      eventName: E,
      payloadValue: EngineEvents[E],
      copier: OwnedJoker,
      shelfIndex: number,
      visited: Set<string>,
    ): void => {
      const targetIndex = shelfIndex + 1;
      const target = payloadValue.run.jokers[targetIndex];
      if (!target || target.state.destroyed === 1 || target.state.bossDisabled === 1 || target.defId === 'towerOfBabel') return;
      const targetIdentity = target.instanceId !== undefined
        ? `uid:${target.instanceId}`
        : `legacy:${targetIndex}:${target.defId}`;
      if (visited.has(targetIdentity)) return;
      const targetDef = this.defs.get(target.defId);
      if (!targetDef) return;
      if (eventName === 'wordScoring' &&
          (payloadValue as EngineEvents['wordScoring']).ctx.submission.isGibberish &&
          !targetDef.scoresGibberish) return;
      visited.add(targetIdentity);
      if (targetDef.copiesRight) {
        invokeRight(eventName, payloadValue, copier, targetIndex, visited);
        return;
      }
      const handler = targetDef.hooks[eventName];
      if (!handler) return;
      const prefix = `echo:${targetIdentity}:${target.defId}:`;
      const savedState = Object.fromEntries(
        Object.entries(copier.state)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key.slice(prefix.length), value]),
      );
      const virtualState = Object.keys(savedState).length > 0
        ? savedState
        : (targetDef.initialState?.(payloadValue.run) ?? {});
      const virtual: OwnedJoker = {
        defId: copier.defId,
        ...(copier.instanceId !== undefined ? { instanceId: copier.instanceId } : {}),
        edition: 'base',
        state: virtualState,
      };
      const blindSelected = eventName === 'blindSelected'
        ? payloadValue as EngineEvents['blindSelected']
        : null;
      const triggerStart = blindSelected?.triggers.length ?? 0;
      const display = targetDef.growthDisplay;
      const before = display ? virtual.state[display.stateKey] ?? display.initial : 0;
      const growthStart = growth.length;
      handler(payloadValue, virtual, {
        index: shelfIndex,
        lookup: (id) => this.defs.get(id),
        grow: (kind, delta) => growth.push(growthTrigger(copier, kind, delta)),
      });
      if (display && growth.length === growthStart) {
        const delta = (virtual.state[display.stateKey] ?? display.initial) - before;
        if (delta > 0 || (display.showDecrease && delta < 0)) {
          growth.push(growthTrigger(copier, display.kind, delta));
        }
      }
      if (blindSelected) {
        for (let index = triggerStart; index < blindSelected.triggers.length; index += 1) {
          blindSelected.triggers[index] = {
            ...blindSelected.triggers[index]!,
            joker: copier,
            jokerIndex: shelfIndex,
          };
        }
      }
      for (const key of Object.keys(copier.state)) if (key.startsWith(prefix)) delete copier.state[key];
      if (virtual.state.destroyed === 1) {
        copier.state.destroyed = 1;
        return;
      }
      for (const [key, value] of Object.entries(virtual.state)) copier.state[`${prefix}${key}`] = value;
    };
    for (let index = 0; index < owned.length; index++) {
      const joker = owned[index]!;
      // A destroyed owner may remain in the UI until its final trigger finishes.
      if (joker.state.destroyed === 1) continue;
      // Generic boss debuff marker. The owner stays in place, but every hook and
      // edition effect is inactive until the marker is cleared at blind end.
      if (joker.state.bossDisabled === 1) continue;
      const def = this.defs.get(joker.defId);
      const handler = def?.hooks[event];
      const display = def?.growthDisplay;
      const before = display ? joker.state[display.stateKey] ?? display.initial : 0;
      const growthStart = growth.length;
      const shelfIndex = payload.run.jokers.indexOf(joker);
      if (def?.copiesRight && shelfIndex >= 0) {
        pruneEchoNamespacesForOwner(joker, payload.run.jokers);
        const selfIdentity = joker.instanceId !== undefined
          ? `uid:${joker.instanceId}`
          : `legacy:${shelfIndex}:${joker.defId}`;
        invokeRight(event, payload, joker, shelfIndex, new Set([selfIdentity]));
      } else if (handler) {
        handler(payload, joker, {
          index: shelfIndex >= 0 ? shelfIndex : index,
          lookup: (id) => this.defs.get(id),
          grow: (kind, delta) => growth.push(growthTrigger(joker, kind, delta)),
        });
      } else continue;
      if (display && growth.length === growthStart) {
        const delta = (joker.state[display.stateKey] ?? display.initial) - before;
        if (delta > 0 || (display.showDecrease && delta < 0)) {
          growth.push(growthTrigger(joker, display.kind, delta));
        }
      }
    }
    return growth;
  }
}
