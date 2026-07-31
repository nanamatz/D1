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

import { BALANCE } from '../engine/balance';
import { bossPoolForAnte, drawBoss, enterBossBlind } from '../engine/bosses';
import { discountedPrice, VOUCHER_REGISTRY } from '../engine/vouchers';
import { blindExhausted, canEndEarly, discardTiles, endBlind, startBlind, submitWord } from '../engine/loop';
import { onBlindEnded, onTilesDestroyed } from '../engine/jokers';
import { JOKER_REGISTRY } from '../engine/jokers';
import { applyPackPick, rollPack, type PackOption } from '../engine/packs';
import { resolveBlind } from '../engine/progression';
import { makeRng } from '../engine/rng';
import { newRun } from '../engine/run';
import { buyItem, buyVoucher, rollShopStock, rollVoucherOffer } from '../engine/shop';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
  Letter,
  RunState,
  ShopState,
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
const CHAPTERS = Math.min(argNumber('chapters', 8), BALANCE.runAntes);
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
class WordSolver {
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

interface Cohort {
  runs: number;
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
}

const freshCohort = (runs: number, forceProgression: boolean): Cohort => ({
  runs,
  forceProgression,
  reached: Array(CHAPTERS + 1).fill(0),
  deadlinesCleared: Array(CHAPTERS + 1).fill(0),
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

function playBlind(
  runAtStart: RunState,
  blindAtStart: BlindState,
  lexicon: Lexicon,
  solver: WordSolver,
  seed: string,
  cohort: Cohort,
): { run: RunState; blind: BlindState } {
  let run = runAtStart;
  let blind = blindAtStart;
  let action = 0;
  while (blind.phasesUsed < blind.phasesTotal && !blindExhausted(blind)) {
    const excluded = blind.bossId === 'memoirs'
      ? new Set(run.wordsThisAnte)
      : new Set<string>();
    let choice = solver.best(blind.hand, excluded, blind.forcedTileId ?? null);

    while (blind.discardsLeft > 0 && (!choice || choice.tileIds.length < 3)) {
      const keep = new Set(choice?.tileIds ?? []);
      if (blind.forcedTileId) keep.add(blind.forcedTileId);
      const discarded = blind.hand.filter((tile) => !keep.has(tile.id)).map((tile) => tile.id);
      if (discarded.length === 0) break;
      const result = discardTiles(
        blind,
        run,
        discarded,
        makeRng(`${seed}#discard-${action++}`),
      );
      run = {
        ...run,
        jokers: result.jokers,
        gold: Math.max(0, run.gold + result.goldDelta),
        consumables: [...run.consumables, ...result.gained],
      };
      blind = result.blind;
      choice = solver.best(blind.hand, excluded, blind.forcedTileId ?? null);
    }

    const forced = blind.hand.find((tile) => tile.id === blind.forcedTileId);
    const fallback = [
      ...(forced ? [forced] : []),
      ...blind.hand.filter((tile) => tile !== forced && tile.letter !== null),
    ].slice(0, Math.max(1, Math.min(4, blind.hand.length)));
    const tileIds = choice?.tileIds.length ? choice.tileIds : fallback.map((tile) => tile.id);
    if (tileIds.length === 0) break;

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
    run = onTilesDestroyed(
      {
        ...run,
        jokers: result.jokers,
        counters: result.counters,
        gold: Math.max(0, run.gold + result.goldDelta),
        bag: run.bag
          .filter((tile) => !result.destroyedTileIds.includes(tile.id))
          .map(grow),
        wordsThisAnte: result.submission.isGibberish
          ? run.wordsThisAnte
          : [...run.wordsThisAnte, result.submission.text.toLowerCase()],
      },
      result.destroyedTileIds.length,
    );
    if (canEndEarly(blind)) break;
  }
  return { run, blind };
}

const packOptionRank = (option: PackOption): number => {
  if (option.kind === 'joker') {
    const rarity = JOKER_REGISTRY.get(option.id)?.rarity;
    return rarity === 'rare' ? 400 : rarity === 'uncommon' ? 300 : 200;
  }
  if (option.kind !== 'tile') return 0;
  const enhanced =
    option.tile.material !== 'ceramic'
    || option.tile.font !== 'medium'
    || (option.tile.edition ?? 'base') !== 'base';
  return enhanced ? 100 : 0;
};

function visitShop(
  runAtStart: RunState,
  seed: string,
  shopIndex: number,
  cohort: Cohort,
  offered: Set<TileMaterial>,
  acquired: Set<TileMaterial>,
): RunState {
  let run = runAtStart;
  let shop: ShopState = rollShopStock(run, makeRng(`${seed}#shop-${shopIndex}`));
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
  for (const { item, index } of itemOrder) {
    if (!item) continue;
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
    if (run.jokers.length > beforeJokers) cohort.jokersBought += 1;
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
    const price = discountedPrice(run, BALANCE.pack.size[slot.size].price);
    if (run.gold < price) continue;
    const offer = rollPack(slot, run, makeRng(`${seed}#shop-${shopIndex}-pack-${index}`));
    run = { ...run, gold: run.gold - price };
    if (slot.type === 'joker') cohort.charmPacks += 1;
    else cohort.tilePacks += 1;
    for (const option of offer.options) {
      if (option.kind !== 'tile') continue;
      cohort.materials[option.tile.material].offers += 1;
      offered.add(option.tile.material);
    }
    const choices = offer.options
      .map((option, optionIndex) => ({ option, optionIndex, rank: packOptionRank(option) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, offer.pick);
    for (const { option } of choices) {
      const beforeJokers = run.jokers.length;
      const beforeTiles = run.bag.length;
      const next = applyPackPick(run, option);
      if (next === run) continue;
      run = next;
      if (run.jokers.length > beforeJokers) cohort.jokersBought += 1;
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

function simulateRun(
  seed: string,
  lexicon: Lexicon,
  solver: WordSolver,
  cohort: Cohort,
): void {
  const base = newRun(seed);
  let run: RunState = {
    ...base,
    voucherOffer: rollVoucherOffer(base, makeRng(`${seed}#voucher-1`)),
    chapterBossId: drawBoss(makeRng(`${seed}#boss-1`), bossPoolForAnte(1)),
  };
  const reached = new Set<number>();
  const offered = new Set<TileMaterial>();
  const acquired = new Set<TileMaterial>();
  let blindNumber = 0;
  let shopNumber = 0;

  while (run.ante <= CHAPTERS && blindNumber < CHAPTERS * 3) {
    reached.add(run.ante);
    const chapter = run.ante;
    const blindIndex = run.blindIndex;
    let blind = startBlind(
      run,
      makeRng(`${seed}#blind-${blindNumber}`),
      { bossId: run.chapterBossId },
    );
    ({ run, blind } = enterBossBlind(
      run,
      blind,
      makeRng(`${seed}#boss-enter-${blindNumber}`),
    ));
    ({ run, blind } = playBlind(run, blind, lexicon, solver, `${seed}#${blindNumber}`, cohort));
    cohort.blinds += 1;

    const final = endBlind(blind, run, lexicon);
    if (TRACE && seed === 'full-run-0' && blindNumber === 0) {
      console.log(
        `[trace] final=${Math.round(final.finalScore)} target=${blind.target} `
        + `phases=${blind.phasesUsed}/${blind.phasesTotal}`,
      );
    }
    cohort.materials.ivory.gold += final.materialGold;
    const pattern = final.judgment.match?.pattern;
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
    settledRun = onBlindEnded(
      settledRun,
      blind,
      makeRng(`${seed}#joker-end-${blindNumber}`),
    );
    const naturallyCleared = final.finalScore >= blind.target;
    if (!naturallyCleared && !cohort.forceProgression) break;

    const outcome = resolveBlind(
      settledRun,
      blind,
      cohort.forceProgression ? Math.max(final.finalScore, blind.target) : final.finalScore,
    );
    run = outcome.run;
    if (blind.phasesUsed < blind.phasesTotal) {
      run = {
        ...run,
        counters: { ...run.counters, earlyEnds: run.counters.earlyEnds + 1 },
      };
    }
    if (blindIndex === 2) {
      if (naturallyCleared) cohort.deadlinesCleared[chapter]! += 1;
      run = {
        ...run,
        voucherOffer: rollVoucherOffer(run, makeRng(`${seed}#voucher-${run.ante}`)),
        voucherLocked: false,
        bossRerollsUsed: 0,
        chapterBossId: run.ante <= CHAPTERS
          ? drawBoss(makeRng(`${seed}#boss-${run.ante}`), bossPoolForAnte(run.ante))
          : null,
        wordsThisAnte: [],
      };
    }
    if (outcome.won && naturallyCleared) cohort.wins += 1;
    if (run.ante > CHAPTERS) break;
    run = visitShop(run, seed, shopNumber++, cohort, offered, acquired);
    blindNumber += 1;
  }

  for (const chapter of reached) cohort.reached[chapter]! += 1;
  for (const material of offered) cohort.materials[material].runsOffered += 1;
  for (const material of acquired) cohort.materials[material].runsAcquired += 1;
  for (const tile of run.bag) cohort.materials[tile.material].finalOwned += 1;
}

function printCohort(name: string, cohort: Cohort): void {
  const pct = (count: number) => `${(count / cohort.runs * 100).toFixed(1)}%`;
  console.log(`\n${name} — ${cohort.runs} seeds`);
  console.log('Chapter       ' + Array.from({ length: CHAPTERS }, (_, i) => String(i + 1).padStart(7)).join(''));
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

const lexicon = loadStubLexicon();
const solver = new WordSolver(lexicon);
const natural = freshCohort(SEEDS, false);
const exposure = freshCohort(SEEDS, true);
for (let i = 0; i < SEEDS; i += 1) {
  simulateRun(`full-run-${i}`, lexicon, solver, natural);
  simulateRun(`full-run-${i}`, lexicon, solver, exposure);
}

console.log(`Full-run balance sweep — ${SEEDS} seeds, ${CHAPTERS} Chapters`);
console.log('Bot: best base-score words; 3+ letter discard chase; Emoji Tile + Charm/Tile Pack buyer.');
printCohort('Natural survival', natural);
printCohort('Eight-Chapter market exposure (forced advancement after misses)', exposure);
