/// <reference types="node" />
/**
 * Eight-Chapter balance sweep using the real blind, boss, shop, pack, Joker,
 * material, economy, and progression pipelines.
 *
 * Two cohorts keep unlike questions separate:
 * - natural: stops when the bot misses a target; measures survivability.
 * - exposure: pays/advances as if each miss cleared; measures the full 8-Chapter
 *   acquisition market without survivor bias. Its clear rate is not reported.
 *
 * The bot is intentionally simple: best base-score word, chase a 3+ letter word
 * with available discards, buy offered Emoji Tiles, then Charm/Tile Packs, and
 * pick enhanced tiles. It does not use Fables or reroll shops.
 *
 * Run: npm run sim:full-run
 * Fast sample: npx tsx src/sim/full-run-balance.ts --seeds=50
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BALANCE } from '../engine/balance';
import { packBuyPrice } from '../engine/economy';
import {
  BOSS_REGISTRY,
  bossAllowsDiscard,
  bossPoolForAnte,
  drawBossFromCycle,
  enterBossBlind,
} from '../engine/bosses';
import { VOUCHER_REGISTRY } from '../engine/vouchers';
import {
  blindExhausted,
  canEndEarly,
  discardTiles,
  endBlind,
  enterJokerBlind,
  prepareWordSubmission,
  startBlind,
  submitWord,
} from '../engine/loop';
import {
  ALL_JOKERS,
  createOwnedJoker,
  JOKER_REGISTRY,
  onBlindEndedWithDestroyedJokers,
  onConstellationUsed,
  onTilesDestroyed,
} from '../engine/jokers';
import { applyPackPick, rollPack, type PackOption } from '../engine/packs';
import type { PackOffer } from '../engine/packs';
import {
  canUseFableFromPack,
  fablePickCount,
  fableTargetsTiles,
  isBlindOnlyConsumable,
  isFableId,
  useFable,
  useFableOnPouch,
} from '../engine/fables';
import {
  canUseUnheldGambler,
  gamblerTargetsTiles,
  isGamblerId,
  useGambler,
} from '../engine/gamblers';
import { resolveBlind } from '../engine/progression';
import { makeRng } from '../engine/rng';
import { newRun } from '../engine/run';
import { buyItem, buyVoucher, prepareShop, rollVoucherOffer } from '../engine/shop';
import {
  consumeNextBlindBonus,
  isImmediateSkipReward,
  isNextShopSkipReward,
  rollSkipOffers,
  skipCurrentBlind,
} from '../engine/skipRewards';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
  JokerRarity,
  Letter,
  PouchId,
  RecordId,
  RunState,
  ScoreEvent,
  ShopState,
  SkipRewardId,
  SkipRewardOffer,
  Tile,
  TileMaterial,
} from '../engine/types';
import { loadStubLexicon } from './stub-lexicon';

const MATERIALS: readonly TileMaterial[] = [
  'ceramic',
  'porcelain',
  'polished',
  'glass',
  'stone',
  'leadPlate',
  'ivory',
  'brass',
  'wood',
];

const argNumber = (name: string, fallback: number): number => {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const SEEDS = argNumber('seeds', 1_000);
const CHAPTERS = Math.min(argNumber('chapters', 8), BALANCE.endless.maxAnte);
const TRACE = process.argv.includes('--trace');

interface Candidate {
  word: string;
  score: number;
}

interface Choice {
  word: string;
  tileIds: string[];
  score: number;
}

const signature = (letters: readonly string[]): string =>
  letters.map((letter) => letter.toLowerCase()).sort().join('');

/** Exact-letter signature index: one hand needs at most 2^N cheap lookups. */
export class WordSolver {
  private readonly bySignature = new Map<string, Candidate[]>();

  constructor(lexicon: Lexicon) {
    for (const word of lexicon.words()) {
      if (word.length === 0 || word.length > 12) continue;
      const entry = lexicon.lookup(word);
      const chips = [...word].reduce(
        (sum, letter) => sum + (BALANCE.letterChips[letter.toUpperCase()] ?? 0),
        0,
      );
      const mult = (entry ? BALANCE.suitMult[entry.suit] : 1)
        + word.length * BALANCE.wordLength.multPerLetter;
      const key = signature([...word]);
      const bucket = this.bySignature.get(key) ?? [];
      bucket.push({ word, score: chips * mult });
      this.bySignature.set(key, bucket);
    }
    for (const bucket of this.bySignature.values()) {
      bucket.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    }
  }

  best(
    hand: readonly Tile[],
    excluded: ReadonlySet<string>,
    forcedTileId: string | null,
    accepts: (tileIds: readonly string[]) => boolean = () => true,
  ): Choice | null {
    const spellable = hand.filter((tile) => tile.letter !== null);
    let best: Choice | null = null;
    const masks = 1 << spellable.length;
    for (let mask = 1; mask < masks; mask += 1) {
      const selected = spellable.filter((_, index) => (mask & (1 << index)) !== 0);
      if (forcedTileId && !selected.some((tile) => tile.id === forcedTileId)) continue;
      const candidates = this.bySignature.get(
        signature(selected.map((tile) => tile.letter as Letter)),
      );
      if (!candidates) continue;
      const candidate = candidates.find(({ word }) => !excluded.has(word));
      if (!candidate) continue;
      const quality = selected.filter((tile) =>
        tile.material !== 'ceramic'
        || tile.font !== 'medium'
        || (tile.edition ?? 'base') !== 'base'
      ).length;
      const rank = candidate.score + quality / 100;
      if (best && rank <= best.score) continue;

      const buckets = new Map<Letter, Tile[]>();
      for (const tile of selected) {
        const letter = tile.letter as Letter;
        const bucket = buckets.get(letter) ?? [];
        bucket.push(tile);
        buckets.set(letter, bucket);
      }
      const tileIds = [...candidate.word].map((letter) =>
        buckets.get(letter.toUpperCase() as Letter)!.shift()!.id
      );
      if (!accepts(tileIds)) continue;
      best = { word: candidate.word, tileIds, score: rank };
    }
    return best;
  }
}

interface MaterialStats {
  offers: number;
  acquisitions: number;
  plays: number;
  triggerChips: number;
  triggerMult: number;
  gold: number;
  runsOffered: number;
  runsAcquired: number;
  finalOwned: number;
}

export interface JokerStats {
  id: string;
  rarity: JokerRarity;
  layer: 1 | 2 | 3;
  offers: number;
  acquisitions: number;
  ownedBlinds: number;
  ownedWords: number;
  triggers: number;
  chipsDelta: number;
  multDelta: number;
  chipsFactor: number;
  multFactor: number;
  scoreDelta: number;
  goldDelta: number;
  growthDelta: number;
  stateChanges: number;
}

export interface Cohort {
  runs: number;
  chapters: number;
  forceProgression: boolean;
  reached: number[];
  deadlinesCleared: number[];
  wins: number;
  blinds: number;
  shops: number;
  charmPacks: number;
  tilePacks: number;
  jokersBought: number;
  vouchersBought: number;
  materials: Record<TileMaterial, MaterialStats>;
  jokers: Record<string, JokerStats>;
}

export const freshCohort = (
  runs: number,
  forceProgression: boolean,
  chapters = CHAPTERS,
): Cohort => ({
  runs,
  chapters,
  forceProgression,
  reached: Array(chapters + 1).fill(0),
  deadlinesCleared: Array(chapters + 1).fill(0),
  wins: 0,
  blinds: 0,
  shops: 0,
  charmPacks: 0,
  tilePacks: 0,
  jokersBought: 0,
  vouchersBought: 0,
  materials: Object.fromEntries(
    MATERIALS.map((material) => [
      material,
      {
        offers: 0,
        acquisitions: 0,
        plays: 0,
        triggerChips: 0,
        triggerMult: 0,
        gold: 0,
        runsOffered: 0,
        runsAcquired: 0,
        finalOwned: 0,
      },
    ]),
  ) as Record<TileMaterial, MaterialStats>,
  jokers: Object.fromEntries(ALL_JOKERS.map((def) => [
    def.id,
    {
      id: def.id,
      rarity: def.rarity,
      layer: def.layer,
      offers: 0,
      acquisitions: 0,
      ownedBlinds: 0,
      ownedWords: 0,
      triggers: 0,
      chipsDelta: 0,
      multDelta: 0,
      chipsFactor: 0,
      multFactor: 0,
      scoreDelta: 0,
      goldDelta: 0,
      growthDelta: 0,
      stateChanges: 0,
    },
  ])) as Record<string, JokerStats>,
});

const growWood = (tile: Tile, ids: readonly string[]): Tile =>
  ids.includes(tile.id)
    ? {
        ...tile,
        woodBonusChips:
          (tile.woodBonusChips ?? BALANCE.materials.wood.baseChips)
          + BALANCE.materials.wood.chipsPerPlay,
      }
    : tile;

const jokerState = (run: RunState): Map<string, string> => new Map(
  run.jokers.map((joker) => [joker.defId, JSON.stringify(joker.state)]),
);

function recordStateChanges(cohort: Cohort, before: ReadonlyMap<string, string>, run: RunState): void {
  const remaining = new Set(run.jokers.map((joker) => joker.defId));
  for (const id of before.keys()) {
    if (!remaining.has(id)) cohort.jokers[id]!.stateChanges += 1;
  }
  for (const joker of run.jokers) {
    if (before.get(joker.defId) !== JSON.stringify(joker.state)) {
      cohort.jokers[joker.defId]!.stateChanges += 1;
    }
  }
}

export function recordBlindSelectedTelemetry(
  cohort: Cohort,
  before: ReadonlyMap<string, string>,
  selected: Pick<ReturnType<typeof enterJokerBlind>, 'run' | 'triggers'>,
): void {
  for (const trigger of selected.triggers) cohort.jokers[trigger.joker.defId]!.triggers += 1;
  recordStateChanges(cohort, before, selected.run);
}

function recordJokerEvent(cohort: Cohort, event: Extract<ScoreEvent, { kind: 'joker' }>): void {
  const stats = cohort.jokers[event.jokerId];
  if (!stats) throw new Error(`unknown public Emoji Tile event: ${event.jokerId}`);
  stats.triggers += 1;
  stats.chipsDelta += event.chipsDelta;
  stats.multDelta += event.multDelta;
  stats.chipsFactor += event.chipsFactor ?? 0;
  stats.multFactor += event.multFactor ?? 0;
  stats.scoreDelta += event.scoreDelta ?? 0;
  stats.goldDelta += event.goldDelta ?? 0;
  stats.growthDelta += event.growthDelta ?? 0;
}

function submissionAllowed(
  tileIds: readonly string[],
  run: RunState,
  blind: BlindState,
  lexicon: Lexicon,
): boolean {
  const byId = new Map(blind.hand.map((tile) => [tile.id, tile]));
  const tiles = tileIds.map((id) => byId.get(id)).filter((tile): tile is Tile => tile !== undefined);
  if (tiles.length !== tileIds.length) return false;
  const prepared = prepareWordSubmission(tiles, lexicon, run, blind);
  return !(BOSS_REGISTRY.get(blind.bossId ?? '')?.blocks?.(
    prepared.submission,
    { run, blind, lexicon },
  ) ?? false);
}

export function legalFallback(
  run: RunState,
  blind: BlindState,
  lexicon: Lexicon,
): string[] | null {
  const candidates = blind.hand;
  const masks = 1 << candidates.length;
  for (let mask = 1; mask < masks; mask += 1) {
    const chosen = candidates.filter((_, index) => (mask & (1 << index)) !== 0);
    if (blind.forcedTileId && !chosen.some((tile) => tile.id === blind.forcedTileId)) continue;
    const ids = chosen.map((tile) => tile.id);
    if (submissionAllowed(ids, run, blind, lexicon)) return ids;
  }
  return null;
}

export function mergeDiscardResult(
  run: RunState,
  result: ReturnType<typeof discardTiles>,
): RunState {
  return {
    ...run,
    jokers: result.jokers,
    bag: result.bag,
    discardedLetters: result.discardedLetters,
    discardedLetterCounts: result.discardedLetterCounts,
    gold: Math.max(0, run.gold + result.goldDelta),
    consumables: [...run.consumables, ...result.gained],
  };
}

export function mergeSubmitResult(
  run: RunState,
  result: ReturnType<typeof submitWord>,
): RunState {
  const grow = (tile: Tile) => growWood(tile, result.grownWoodTileIds);
  return onTilesDestroyed(
    {
      ...run,
      jokers: result.jokers,
      counters: result.counters,
      playedWords: result.playedWords,
      playedLetterHands: result.playedLetterHands,
      letterHandPlayCounts: result.letterHandPlayCounts,
      lastLetterHand: result.lastLetterHand,
      discardedLetters: result.discardedLetters,
      discardedLetterCounts: result.discardedLetterCounts,
      gold: Math.max(0, run.gold + result.goldDelta),
      bag: run.bag
        .filter((tile) => !result.destroyedTileIds.includes(tile.id))
        .map((tile) => result.updatedTiles.find((updated) => updated.id === tile.id) ?? tile)
        .map(grow)
        .concat(result.createdTiles),
      wordsThisAnte: result.submission.isGibberish
        ? run.wordsThisAnte
        : [...run.wordsThisAnte, result.submission.text.toLowerCase()],
    },
    result.destroyedTileIds.length,
  );
}

function playBlind(
  runAtStart: RunState,
  blindAtStart: BlindState,
  lexicon: Lexicon,
  solver: WordSolver,
  seed: string,
  cohort: Cohort,
): { run: RunState; blind: BlindState; failed: boolean } {
  let run = runAtStart;
  let blind = blindAtStart;
  let action = 0;
  while (blind.phasesUsed < blind.phasesTotal && !blindExhausted(blind)) {
    const excluded = blind.bossId === 'memoirs'
      ? new Set(run.wordsThisAnte)
      : new Set<string>();
    const accepts = (ids: readonly string[]) => submissionAllowed(ids, run, blind, lexicon);
    let choice = solver.best(blind.hand, excluded, blind.forcedTileId ?? null, accepts);

    while (blind.discardsLeft > 0 && (!choice || choice.tileIds.length < 3)) {
      const keep = new Set(choice?.tileIds ?? []);
      if (blind.forcedTileId) keep.add(blind.forcedTileId);
      const discarded = blind.hand
        .filter((tile) => !keep.has(tile.id) && bossAllowsDiscard(blind, tile))
        .map((tile) => tile.id);
      if (discarded.length === 0) break;
      const result = discardTiles(
        blind,
        run,
        discarded,
        makeRng(`${seed}#discard-${action++}`),
      );
      run = mergeDiscardResult(run, result);
      blind = result.blind;
      choice = solver.best(blind.hand, excluded, blind.forcedTileId ?? null, accepts);
    }

    const tileIds = choice?.tileIds.length ? choice.tileIds : legalFallback(run, blind, lexicon);
    if (!tileIds?.length) return { run, blind, failed: true };

    const beforeState = jokerState(run);
    for (const joker of run.jokers) cohort.jokers[joker.defId]!.ownedWords += 1;
    const result = submitWord(
      blind,
      run,
      lexicon,
      tileIds,
      makeRng(`${seed}#play-${action++}`),
    );
    if (TRACE && seed.startsWith('full-run-0#0')) {
      console.log(
        `[trace] ${result.submission.text} len=${tileIds.length} `
        + `score=${Math.round(result.submission.settledScore)} `
        + `committed=${Math.round(result.blind.committedScore)}/${blind.target}`,
      );
    }
    for (const tile of result.submission.tiles) {
      cohort.materials[tile.material].plays += 1;
    }
    for (const event of result.events) {
      if (event.kind === 'joker') recordJokerEvent(cohort, event);
      if (event.kind !== 'material') continue;
      cohort.materials[event.material].triggerChips += event.chipsDelta;
      cohort.materials[event.material].triggerMult += event.multDelta;
    }
    if (result.goldDelta > 0 && result.submission.tiles.some((tile) => tile.material === 'leadPlate')) {
      cohort.materials.leadPlate.gold += result.goldDelta;
    }

    const grow = (tile: Tile) => growWood(tile, result.grownWoodTileIds);
    blind = result.grownWoodTileIds.length
      ? {
          ...result.blind,
          hand: result.blind.hand.map(grow),
          bag: result.blind.bag.map(grow),
          discardedThisBlind: result.blind.discardedThisBlind.map(grow),
        }
      : result.blind;
    run = mergeSubmitResult(run, result);
    recordStateChanges(cohort, beforeState, run);
    if (canEndEarly(blind)) break;
  }
  return { run, blind, failed: false };
}

export const packOptionRank = (option: PackOption): number => {
  if (option.kind === 'joker') {
    const rarity = JOKER_REGISTRY.get(option.id)?.rarity;
    return rarity === 'rare' ? 400 : rarity === 'uncommon' ? 300 : 200;
  }
  if (option.kind !== 'tile') return 1;
  const enhanced =
    option.tile.material !== 'ceramic'
    || option.tile.font !== 'medium'
    || (option.tile.edition ?? 'base') !== 'base';
  return enhanced ? 100 : 0;
};

export interface FreePackResolution {
  run: RunState;
  blind: BlindState;
  candidateTiles: Tile[];
  picksUsed: number;
  heldFables: string[];
  usedFables: string[];
  usedGamblers: string[];
  levelledPatterns: string[];
}

const syncPackCandidates = (candidates: readonly Tile[], run: RunState): Tile[] => {
  const byId = new Map(run.bag.map((tile) => [tile.id, tile]));
  return candidates.flatMap((candidate) => {
    const current = byId.get(candidate.id);
    return current ? [current] : [];
  });
};

const candidateSelections = (
  candidates: readonly Tile[],
  min: number,
  max: number,
): string[][] => {
  const result: string[][] = [];
  const ids = candidates.map(({ id }) => id);
  const visit = (start: number, left: number, chosen: string[]): void => {
    if (left === 0) {
      result.push(chosen);
      return;
    }
    for (let index = start; index <= ids.length - left; index += 1) {
      visit(index + 1, left - 1, [...chosen, ids[index]!]);
    }
  };
  for (let size = Math.min(max, ids.length); size >= min; size -= 1) visit(0, size, []);
  return result;
};

/** Resolve a free skip Pack through the same headless use paths as the UI. */
export function resolveFreePackOptions(
  runAtStart: RunState,
  blindAtStart: BlindState,
  offer: PackOffer,
  initialCandidates: readonly Tile[],
  seed: string,
): FreePackResolution {
  let run = runAtStart;
  let blind = blindAtStart;
  let candidateTiles = [...initialCandidates];
  let picksUsed = 0;
  const heldFables: string[] = [];
  const usedFables: string[] = [];
  const usedGamblers: string[] = [];
  const levelledPatterns: string[] = [];
  const ranked = offer.options
    .map((option, index) => ({ option, index, rank: packOptionRank(option) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index);

  // Tile/Charm Packs keep the existing acquisition fold. Immediate-use and
  // failed-choice arbitration applies only to Fable/Constellation/Ink Packs.
  if (offer.type === 'tile' || offer.type === 'joker') {
    for (const { option } of ranked.slice(0, offer.pick)) {
      const next = applyPackPick(run, option);
      if (next === run) continue;
      run = next;
      picksUsed += 1;
    }
    return {
      run,
      blind,
      candidateTiles,
      picksUsed,
      heldFables,
      usedFables,
      usedGamblers,
      levelledPatterns,
    };
  }

  for (const { option } of ranked) {
    if (picksUsed >= offer.pick) break;
    let resolved = false;
    const actionRng = makeRng(`${seed}#use-${picksUsed}`);
    if (option.kind === 'punctuation') {
      const from = run.patternLevels[option.pattern] ?? 1;
      run = onConstellationUsed({
        ...run,
        lastFableOrConstellation: option.id,
        patternLevels: { ...run.patternLevels, [option.pattern]: from + 1 },
      });
      levelledPatterns.push(option.pattern);
      resolved = true;
    } else if (option.kind === 'consumable' && isFableId(option.id)) {
      const id = option.id;
      if (isBlindOnlyConsumable(id)) {
        if (canUseFableFromPack(id, run, blind, [])) {
          const next = applyPackPick(run, option);
          if (next !== run) {
            run = next;
            heldFables.push(id);
            resolved = true;
          }
        }
      } else if (fableTargetsTiles(id)) {
        const count = fablePickCount(id);
        const targets = candidateSelections(candidateTiles, count.min, count.max)
          .find((ids) => canUseFableFromPack(id, run, blind, ids));
        if (targets) {
          const staged = { ...run, consumables: [...run.consumables, id] };
          const result = useFableOnPouch(id, staged, targets, actionRng);
          if (result.ok) {
            run = result.run;
            usedFables.push(id);
            resolved = true;
          }
        }
      } else if (canUseFableFromPack(id, run, blind, [])) {
        const staged = { ...run, consumables: [...run.consumables, id] };
        const result = useFable(id, staged, blind, [], actionRng);
        if (result.ok) {
          run = result.run;
          blind = result.blind;
          usedFables.push(id);
          resolved = true;
        }
      }
    } else if (option.kind === 'consumable' && isGamblerId(option.id)) {
      const id = option.id;
      const targets = gamblerTargetsTiles(id)
        ? candidateSelections(candidateTiles, 1, 1)
          .find((ids) => canUseUnheldGambler(id, run, candidateTiles, ids))
        : canUseUnheldGambler(id, run, candidateTiles, []) ? [] : undefined;
      if (targets) {
        const staged = { ...run, consumables: [...run.consumables, id] };
        const result = useGambler(
          id,
          staged,
          blind,
          candidateTiles,
          targets,
          actionRng,
        );
        if (result.ok) {
          run = result.run;
          blind = result.blind;
          usedGamblers.push(id);
          resolved = true;
        }
      }
    } else {
      const next = applyPackPick(run, option);
      if (next !== run) {
        run = next;
        resolved = true;
      }
    }
    if (!resolved) continue;
    picksUsed += 1;
    candidateTiles = syncPackCandidates(candidateTiles, run);
  }
  return {
    run,
    blind,
    candidateTiles,
    picksUsed,
    heldFables,
    usedFables,
    usedGamblers,
    levelledPatterns,
  };
}

export function visitShop(
  runAtStart: RunState,
  seed: string,
  shopIndex: number,
  cohort: Cohort,
  offered: Set<TileMaterial>,
  acquired: Set<TileMaterial>,
  allowJokerAcquisition = true,
  onShopTags?: (attempt: {
    before: readonly SkipRewardId[];
    applied: readonly SkipRewardId[];
    after: readonly SkipRewardId[];
  }) => void,
): RunState {
  let run = runAtStart;
  const pendingBefore = [...(run.pendingShopTags ?? [])];
  const prepared = prepareShop(run, makeRng(`${seed}#shop-${shopIndex}`));
  onShopTags?.({
    before: pendingBefore,
    applied: prepared.appliedTags,
    after: [...(prepared.run.pendingShopTags ?? [])],
  });
  run = prepared.run;
  let shop: ShopState = prepared.shop;
  cohort.shops += 1;

  const itemOrder = shop.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item?.kind === 'joker' || item?.kind === 'tile')
    .sort((a, b) => {
      const rank = (entry: typeof a): number => {
        if (entry.item?.kind === 'joker') {
          const rarity = JOKER_REGISTRY.get(entry.item.id)?.rarity;
          return rarity === 'rare' ? 3 : rarity === 'uncommon' ? 2 : 1;
        }
        return entry.item?.kind === 'tile' ? packOptionRank({ kind: 'tile', tile: entry.item.tile }) : 0;
      };
      return rank(b) - rank(a);
    });
  for (const item of shop.items) {
    if (item?.kind === 'joker') cohort.jokers[item.id]!.offers += 1;
  }
  for (const { item, index } of itemOrder) {
    if (!item) continue;
    if (item.kind === 'joker' && !allowJokerAcquisition) continue;
    if (item.kind === 'tile') {
      cohort.materials[item.tile.material].offers += 1;
      offered.add(item.tile.material);
      if (packOptionRank({ kind: 'tile', tile: item.tile }) === 0) continue;
    }
    const beforeJokers = run.jokers.length;
    const beforeTiles = run.bag.length;
    const result = buyItem(run, shop, index);
    if (!result.ok) continue;
    run = result.run;
    shop = result.shop;
    if (run.jokers.length > beforeJokers) {
      cohort.jokersBought += 1;
      if (item.kind === 'joker') cohort.jokers[item.id]!.acquisitions += 1;
    }
    if (item.kind === 'tile' && run.bag.length > beforeTiles) {
      cohort.materials[item.tile.material].acquisitions += 1;
      acquired.add(item.tile.material);
    }
  }

  const packOrder = shop.packs
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot?.type === 'joker' || slot?.type === 'tile')
    .sort((a, b) => (a.slot?.type === 'joker' ? -1 : b.slot?.type === 'joker' ? 1 : 0));
  for (const { slot, index } of packOrder) {
    if (!slot) continue;
    if (slot.type === 'joker' && !allowJokerAcquisition) continue;
    const price = packBuyPrice(run, slot);
    if (run.gold < price) continue;
    const offer = rollPack(slot, run, makeRng(`${seed}#shop-${shopIndex}-pack-${index}`));
    run = { ...run, gold: run.gold - price };
    if (slot.type === 'joker') cohort.charmPacks += 1;
    else cohort.tilePacks += 1;
    for (const option of offer.options) {
      if (option.kind === 'joker') cohort.jokers[option.id]!.offers += 1;
      if (option.kind !== 'tile') continue;
      cohort.materials[option.tile.material].offers += 1;
      offered.add(option.tile.material);
    }
    const choices = offer.options
      .map((option, optionIndex) => ({ option, optionIndex, rank: packOptionRank(option) }))
      .filter(({ option, rank }) => rank > 0 && (option.kind !== 'joker' || allowJokerAcquisition))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, offer.pick);
    for (const { option } of choices) {
      const beforeJokers = run.jokers.length;
      const beforeTiles = run.bag.length;
      const next = applyPackPick(run, option);
      if (next === run) continue;
      run = next;
      if (run.jokers.length > beforeJokers) {
        cohort.jokersBought += 1;
        if (option.kind === 'joker') cohort.jokers[option.id]!.acquisitions += 1;
      }
      if (option.kind === 'tile' && run.bag.length > beforeTiles) {
        cohort.materials[option.tile.material].acquisitions += 1;
        acquired.add(option.tile.material);
      }
    }
  }

  // Keep a small operating reserve; skip History Book because its Chapter rewind
  // changes the fixed 8-Chapter exposure horizon this scenario is measuring.
  if (shop.voucher && shop.voucher !== 'historyBook' && run.gold >= BALANCE.voucherPrice + 5) {
    const result = buyVoucher(run, shop);
    if (result.ok) {
      run = result.run;
      cohort.vouchersBought += 1;
    }
  }
  return run;
}

export interface SimulationOptions {
  focalJokerId?: string;
  disableJokerAcquisition?: boolean;
  pouchId?: PouchId;
  recordId?: RecordId;
  /** Zero-based reached Draft/Revision decisions to skip; omitted preserves the legacy bot. */
  skipDecisionIndices?: readonly number[];
  /** Test-only disclosed offers substituted at matching decision indices. */
  forcedSkipRewards?: Readonly<Record<number, SkipRewardOffer>>;
  /** Opt in when a no-skip control still needs offer/decision telemetry. */
  collectSkipTelemetry?: boolean;
}

export interface SkipSimulationTelemetry {
  decisionsReached: number;
  offered: SkipRewardId[];
  selected: SkipRewardId[];
  resolved: SkipRewardId[];
  /** Selected rewards still stored when the simulation terminates. */
  pending: SkipRewardId[];
  /** Pending rewards whose named resolution opportunity occurred but left them stored. */
  unresolved: SkipRewardId[];
  shopTagAttempts: {
    before: SkipRewardId[];
    applied: SkipRewardId[];
    after: SkipRewardId[];
  }[];
  freePacksOpened: number;
  events: {
    decision: number;
    chapter: number;
    blindIndex: 0 | 1;
    id: SkipRewardId;
    scoring: false;
    feeSettlement: false;
    shopVisited: false;
  }[];
}

export interface SimulationResult {
  seed: string;
  reachedChapter: number;
  won: boolean;
  endlessComplete: boolean;
  blindFailure: boolean;
  blindFailureContexts: {
    seed: string;
    chapter: number;
    blindIndex: number;
    bossId: string | null;
    focalJokerId: string | null;
  }[];
  finalGold: number;
  chapter8Score: number | null;
  chapter8Target: number | null;
  checkpoints: { chapter: number; score: number; target: number }[];
  furthestBlind: number;
  terminalScoreTarget: number | null;
  playedBlinds: number;
  shops: number;
  skip: SkipSimulationTelemetry;
}

export function simulateRun(
  seed: string,
  lexicon: Lexicon,
  solver: WordSolver,
  cohort: Cohort,
  options: SimulationOptions = {},
): SimulationResult {
  const base = newRun(seed, {
    ...(options.pouchId ? { pouchId: options.pouchId } : {}),
    ...(options.recordId ? { recordId: options.recordId } : {}),
  });
  if (options.focalJokerId) {
    if (!cohort.jokers[options.focalJokerId]) {
      throw new Error(`unknown focal Emoji Tile: ${options.focalJokerId}`);
    }
    base.jokers = [createOwnedJoker(base, options.focalJokerId)];
  }
  const firstBoss = drawBossFromCycle(makeRng(`${seed}#boss-1`), bossPoolForAnte(1));
  let run: RunState = {
    ...base,
    voucherOffer: rollVoucherOffer(base, makeRng(`${seed}#voucher-1`)),
    chapterBossId: firstBoss.bossId,
    bossHistory: firstBoss.history,
  };
  const reached = new Set<number>();
  const offered = new Set<TileMaterial>();
  const acquired = new Set<TileMaterial>();
  let blindNumber = 0;
  let shopNumber = 0;
  let playedBlinds = 0;
  let furthestBlind = 0;
  let terminalScoreTarget: number | null = null;
  let won = false;
  let endlessComplete = false;
  let blindFailure = false;
  const blindFailureContexts: SimulationResult['blindFailureContexts'] = [];
  let chapter8Score: number | null = null;
  let chapter8Target: number | null = null;
  const checkpoints: SimulationResult['checkpoints'] = [];
  const skipTargets = new Set(options.skipDecisionIndices ?? []);
  const collectSkipTelemetry = options.collectSkipTelemetry === true
    || skipTargets.size > 0
    || Object.keys(options.forcedSkipRewards ?? {}).length > 0;
  const skipSelections: { id: SkipRewardId; resolved: boolean }[] = [];
  const pendingNextBlind: number[] = [];
  const pendingNextShop: number[] = [];
  const pendingPublicity: number[] = [];
  const pendingInvestment: number[] = [];
  const failedShopAttempts = new Set<number>();
  const skipTelemetry: SkipSimulationTelemetry = {
    decisionsReached: 0,
    offered: [],
    selected: [],
    resolved: [],
    pending: [],
    unresolved: [],
    shopTagAttempts: [],
    freePacksOpened: 0,
    events: [],
  };
  const resolveSelections = (indices: readonly number[]): void => {
    for (const index of indices) {
      const selection = skipSelections[index];
      if (!selection || selection.resolved) continue;
      selection.resolved = true;
      skipTelemetry.resolved.push(selection.id);
    }
  };
  const recordShopTagAttempt = (attempt: {
    before: readonly SkipRewardId[];
    applied: readonly SkipRewardId[];
    after: readonly SkipRewardId[];
  }): void => {
    skipTelemetry.shopTagAttempts.push({
      before: [...attempt.before],
      applied: [...attempt.applied],
      after: [...attempt.after],
    });
    for (const id of attempt.applied) {
      const pendingIndex = pendingNextShop.findIndex((index) => (
        !skipSelections[index]?.resolved && skipSelections[index]?.id === id
      ));
      if (pendingIndex < 0) continue;
      const selectionIndex = pendingNextShop[pendingIndex]!;
      resolveSelections([selectionIndex]);
      failedShopAttempts.delete(selectionIndex);
      pendingNextShop.splice(pendingIndex, 1);
    }
    const remainingAfter = new Map<SkipRewardId, number>();
    for (const id of attempt.after) remainingAfter.set(id, (remainingAfter.get(id) ?? 0) + 1);
    const attemptedBefore = new Map<SkipRewardId, number>();
    for (const id of attempt.before) attemptedBefore.set(id, (attemptedBefore.get(id) ?? 0) + 1);
    for (const selectionIndex of pendingNextShop) {
      const id = skipSelections[selectionIndex]?.id;
      if (!id || (attemptedBefore.get(id) ?? 0) <= 0 || (remainingAfter.get(id) ?? 0) <= 0) continue;
      failedShopAttempts.add(selectionIndex);
      attemptedBefore.set(id, attemptedBefore.get(id)! - 1);
      remainingAfter.set(id, remainingAfter.get(id)! - 1);
    }
  };

  while (run.ante <= cohort.chapters && blindNumber < cohort.chapters * 3) {
    reached.add(run.ante);
    const chapter = run.ante;
    const blindIndex = run.blindIndex;
    furthestBlind = Math.max(furthestBlind, (chapter - 1) * 3 + blindIndex + 1);
    const skippableIndex = blindIndex === 0 || blindIndex === 1 ? blindIndex : null;
    if (skippableIndex !== null) {
      const decision = collectSkipTelemetry ? skipTelemetry.decisionsReached++ : -1;
      const forced = options.forcedSkipRewards?.[decision];
      if (forced) {
        const offers = [...run.skipOffers] as [SkipRewardOffer, SkipRewardOffer];
        offers[skippableIndex] = forced;
        run = { ...run, skipOffers: offers };
      }
      const currentOffer = run.skipOffers[skippableIndex];
      if (collectSkipTelemetry) skipTelemetry.offered.push(currentOffer.id);
      if (skipTargets.has(decision)) {
        const skipped = skipCurrentBlind(run, makeRng(`${seed}#skip-${decision}`));
        run = skipped.run;
        const selectionIndex = skipSelections.push({ id: currentOffer.id, resolved: false }) - 1;
        skipTelemetry.selected.push(currentOffer.id);
        skipTelemetry.events.push({
          decision,
          chapter,
          blindIndex: skippableIndex,
          id: currentOffer.id,
          scoring: false,
          feeSettlement: false,
          shopVisited: false,
        });
        if (skipped.freePack) {
          const packRng = makeRng(`${seed}#skip-${decision}-pack`);
          const pack = rollPack(skipped.freePack, run, packRng);
          const candidates = skipped.freePack.type === 'consumable' || skipped.freePack.type === 'ink'
            ? packRng.shuffle(run.bag).slice(0, 10)
            : [];
          const scratchBlind = startBlind(
            run,
            makeRng(`${seed}#skip-${decision}-pack-blind`),
            { bossId: run.chapterBossId },
          );
          run = resolveFreePackOptions(
            run,
            scratchBlind,
            pack,
            candidates,
            `${seed}#skip-${decision}-pack`,
          ).run;
          skipTelemetry.freePacksOpened += 1;
        }
        if (isImmediateSkipReward(currentOffer.id)) resolveSelections([selectionIndex]);
        else if (isNextShopSkipReward(currentOffer.id)) pendingNextShop.push(selectionIndex);
        else if (currentOffer.id === 'publicity') pendingPublicity.push(selectionIndex);
        else if (currentOffer.id === 'investmentTag') pendingInvestment.push(selectionIndex);
        else pendingNextBlind.push(selectionIndex);
        blindNumber += 1;
        continue;
      }
    }
    let blind = startBlind(
      run,
      makeRng(`${seed}#blind-${blindNumber}`),
      { bossId: run.chapterBossId },
    );
    const beforeSelect = jokerState(run);
    const selected = enterJokerBlind(
      run,
      blind,
      makeRng(`${seed}#joker-enter-${blindNumber}`),
    );
    run = selected.run;
    blind = selected.blind;
    recordBlindSelectedTelemetry(cohort, beforeSelect, selected);
    ({ run, blind } = enterBossBlind(
      run,
      blind,
      makeRng(`${seed}#boss-enter-${blindNumber}`),
    ));
    if (pendingNextBlind.length > 0) {
      run = consumeNextBlindBonus(run);
      resolveSelections(pendingNextBlind);
      pendingNextBlind.length = 0;
    }
    for (const joker of run.jokers) cohort.jokers[joker.defId]!.ownedBlinds += 1;
    const played = playBlind(run, blind, lexicon, solver, `${seed}#${blindNumber}`, cohort);
    ({ run, blind } = played);
    if (played.failed) {
      blindFailure = true;
      blindFailureContexts.push({
        seed,
        chapter,
        blindIndex,
        bossId: blind.bossId ?? null,
        focalJokerId: options.focalJokerId ?? null,
      });
    }
    cohort.blinds += 1;
    playedBlinds += 1;

    const final = endBlind(blind, run, lexicon);
    for (const [name, value] of [
      ['score', final.finalScore],
      ['target', blind.target],
      ['gold', run.gold],
    ] as const) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `${seed} chapter=${chapter} blind=${blindIndex} joker=${options.focalJokerId ?? 'market'} `
          + `${name}=${String(value)}`,
        );
      }
    }
    if (TRACE && seed === 'full-run-0' && blindNumber === 0) {
      console.log(
        `[trace] final=${Math.round(final.finalScore)} target=${blind.target} `
        + `phases=${blind.phasesUsed}/${blind.phasesTotal}`,
      );
    }
    cohort.materials.ivory.gold += final.materialGold;
    terminalScoreTarget = final.finalScore / blind.target;
    const pattern = final.judgment.match?.pattern;
    if (blindIndex === 2 && [9, 12, 16, 24, 32, 38].includes(chapter)) {
      checkpoints.push({ chapter, score: final.finalScore, target: blind.target });
    }
    if (blindIndex === 2 && chapter === BALANCE.runAntes) {
      chapter8Score = final.finalScore;
      chapter8Target = blind.target;
    }
    let settledRun: RunState = {
      ...run,
      gold: run.gold + final.materialGold,
      patternPlayCounts: pattern
        ? {
            ...run.patternPlayCounts,
            [pattern]: (run.patternPlayCounts[pattern] ?? 0) + 1,
          }
        : run.patternPlayCounts,
    };
    const beforeEnd = jokerState(settledRun);
    settledRun = onBlindEndedWithDestroyedJokers(
      settledRun,
      blind,
      makeRng(`${seed}#joker-end-${blindNumber}`),
    ).run;
    recordStateChanges(cohort, beforeEnd, settledRun);
    const naturallyCleared = final.finalScore >= blind.target;
    if (!naturallyCleared && !cohort.forceProgression) break;

    const pendingClearReward = settledRun.pendingClearReward;
    const pendingBossReward = settledRun.pendingBossReward ?? 0;
    const previousSkipOffers = settledRun.skipOffers;
    const outcome = resolveBlind(
      settledRun,
      blind,
      cohort.forceProgression ? Math.max(final.finalScore, blind.target) : final.finalScore,
    );
    run = outcome.run;
    if (run.pendingClearReward < pendingClearReward) {
      resolveSelections(pendingPublicity);
      pendingPublicity.length = 0;
    }
    if ((run.pendingBossReward ?? 0) < pendingBossReward) {
      resolveSelections(pendingInvestment);
      pendingInvestment.length = 0;
    }
    won ||= outcome.won && naturallyCleared;
    endlessComplete ||= outcome.endlessComplete;
    if (blind.phasesUsed < blind.phasesTotal) {
      run = {
        ...run,
        counters: { ...run.counters, earlyEnds: run.counters.earlyEnds + 1 },
      };
    }
    if (blindIndex === 2) {
      if (naturallyCleared) cohort.deadlinesCleared[chapter]! += 1;
      const previousVoucherOffer = run.voucherOffer;
      const nextBoss = !outcome.endlessComplete && run.ante <= cohort.chapters
        ? drawBossFromCycle(
            makeRng(`${seed}#boss-${run.ante}`),
            bossPoolForAnte(run.ante),
            run.bossHistory,
          )
        : null;
      run = {
        ...run,
        voucherOffer: rollVoucherOffer(
          run,
          makeRng(`${seed}#voucher-${run.ante}`),
          new Set(),
          previousVoucherOffer ? new Set([previousVoucherOffer]) : new Set(),
        ),
        voucherLocked: false,
        bossRerollsUsed: 0,
        chapterBossId: nextBoss?.bossId ?? null,
        bossHistory: nextBoss?.history ?? run.bossHistory ?? [],
        wordsThisAnte: [],
        skipOffers: nextBoss
          ? rollSkipOffers(run, makeRng(`${seed}#skip-offers-${run.ante}`), previousSkipOffers)
          : run.skipOffers,
        skippedThisChapter: [],
      };
    }
    if (outcome.won && naturallyCleared) cohort.wins += 1;
    if (outcome.endlessComplete || run.ante > cohort.chapters) break;
    run = visitShop(
      run,
      seed,
      shopNumber++,
      cohort,
      offered,
      acquired,
      !options.disableJokerAcquisition,
      collectSkipTelemetry ? recordShopTagAttempt : undefined,
    );
    blindNumber += 1;
  }

  for (const chapter of reached) cohort.reached[chapter]! += 1;
  for (const material of offered) cohort.materials[material].runsOffered += 1;
  for (const material of acquired) cohort.materials[material].runsAcquired += 1;
  for (const tile of run.bag) cohort.materials[tile.material].finalOwned += 1;
  const pendingSelectionIndices = skipSelections
    .map((selection, index) => ({ selection, index }))
    .filter(({ selection }) => !selection.resolved);
  skipTelemetry.pending = pendingSelectionIndices.map(({ selection }) => selection.id);
  skipTelemetry.unresolved = pendingSelectionIndices
    .filter(({ index }) => failedShopAttempts.has(index))
    .map(({ selection }) => selection.id);
  return {
    seed,
    reachedChapter: reached.size === 0 ? 0 : Math.max(...reached),
    won,
    endlessComplete,
    blindFailure,
    blindFailureContexts,
    finalGold: run.gold,
    chapter8Score,
    chapter8Target,
    checkpoints,
    furthestBlind,
    terminalScoreTarget,
    playedBlinds,
    shops: shopNumber,
    skip: skipTelemetry,
  };
}

function printCohort(name: string, cohort: Cohort): void {
  const pct = (count: number) => `${(count / cohort.runs * 100).toFixed(1)}%`;
  console.log(`\n${name} — ${cohort.runs} seeds`);
  console.log('Chapter       ' + Array.from({ length: cohort.chapters }, (_, i) => String(i + 1).padStart(7)).join(''));
  console.log('Reached       ' + cohort.reached.slice(1).map((n) => pct(n).padStart(7)).join(''));
  if (!cohort.forceProgression) {
    console.log('Deadline clear' + cohort.deadlinesCleared.slice(1).map((n) => pct(n).padStart(7)).join(''));
    console.log(`Wins: ${cohort.wins}/${cohort.runs} (${pct(cohort.wins)})`);
  }
  console.log(
    `Per run: ${(cohort.blinds / cohort.runs).toFixed(1)} blinds, `
    + `${(cohort.shops / cohort.runs).toFixed(1)} shops, `
    + `${(cohort.jokersBought / cohort.runs).toFixed(2)} Emoji Tiles, `
    + `${(cohort.charmPacks / cohort.runs).toFixed(2)} Charm Packs, `
    + `${(cohort.tilePacks / cohort.runs).toFixed(2)} Tile Packs, `
    + `${(cohort.vouchersBought / cohort.runs).toFixed(2)} Vouchers`,
  );
  console.log('\nMaterial      offered  acquired  copies/run  plays/run  direct Chips  direct Mult  gold/run');
  for (const material of MATERIALS) {
    const stats = cohort.materials[material];
    console.log(
      `${material.padEnd(12)}`
      + `${pct(stats.runsOffered).padStart(8)}`
      + `${pct(stats.runsAcquired).padStart(10)}`
      + `${(stats.acquisitions / cohort.runs).toFixed(2).padStart(12)}`
      + `${(stats.plays / cohort.runs).toFixed(2).padStart(11)}`
      + `${Math.round(stats.triggerChips / cohort.runs).toString().padStart(14)}`
      + `${(stats.triggerMult / cohort.runs).toFixed(1).padStart(13)}`
      + `${(stats.gold / cohort.runs).toFixed(2).padStart(10)}`,
    );
  }
}

export function runLegacySweep(seeds = SEEDS, chapters = CHAPTERS): void {
  const lexicon = loadStubLexicon();
  const solver = new WordSolver(lexicon);
  const natural = freshCohort(seeds, false, chapters);
  const exposure = freshCohort(seeds, true, chapters);
  for (let i = 0; i < seeds; i += 1) {
    simulateRun(`full-run-${i}`, lexicon, solver, natural);
    simulateRun(`full-run-${i}`, lexicon, solver, exposure);
  }

  console.log(`Full-run balance sweep — ${seeds} seeds, ${chapters} Chapters`);
  console.log('Bot: best base-score words; 3+ letter discard chase; Emoji Tile + Charm/Tile Pack buyer.');
  printCohort('Natural survival', natural);
  printCohort('Market exposure (forced advancement after misses)', exposure);
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isMain) runLegacySweep();
