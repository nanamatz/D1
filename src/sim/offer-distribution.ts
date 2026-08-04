/// <reference types="node" />
/**
 * Offer-distribution simulation (feature-03 C-4). The rarity/type/size weights in
 * BALANCE are guesses until the sim says otherwise — this measures what the shop
 * and packs ACTUALLY offer, headlessly, over many seeded rolls.
 *
 * Run: `npx tsx src/sim/offer-distribution.ts`
 *
 * Reports:
 *  1. Rarity distribution of offered Emoji Tiles (jokers) — shop slots + Charm Packs.
 *     Legendary must be 0 (excluded, GDD §9.2 / §12).
 *  2. Shop "nothing new" rate — how often a shop offers zero jokers as the owned
 *     pool grows (the shrinking-pool effect of the no-duplicate rule, C-2).
 *  3. Pack type & size distribution vs the configured weights (C-3).
 */
import { BALANCE } from '../engine/balance';
import { newRun } from '../engine/run';
import { makeRng } from '../engine/rng';
import { rollShopStock } from '../engine/shop';
import { rollPack } from '../engine/packs';
import { sampleJokerDefs } from '../engine/offers';
import { ALL_JOKERS } from '../engine/jokers';
import type { JokerRarity, PackSize, PackSlot, PackType, RunState } from '../engine/types';

const TRIALS = 20000;
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;

// ---- 1. Per-slot rarity odds (count=1 draws) — the fair test against 70/25/5.
//         A single fresh-run slot; multi-draw exhaustion (a mega pack showing 5 of
//         6 jokers) is measured separately as the shrinking pool in section 2. ----
function rarityDistribution() {
  const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
  let offered = 0;
  for (let i = 0; i < TRIALS; i++) {
    const [j] = sampleJokerDefs(newRun(`rar${i}`), 1, makeRng(`slot${i}`));
    if (!j) continue;
    counts[j.rarity] = (counts[j.rarity] ?? 0) + 1;
    offered++;
  }
  console.log('\n1. Per-slot Emoji-Tile rarity odds  (target 70 / 25 / 5, Legendary 0):');
  for (const r of ['common', 'uncommon', 'rare', 'legendary'] as JokerRarity[]) {
    console.log(`   ${r.padEnd(10)} ${pct(counts[r]!, offered)}  (${counts[r]})`);
  }
  console.log(`   total slots sampled: ${offered}`);
}

// ---- 2. Shop "nothing new" rate as the owned pool grows ----
function shrinkingPool() {
  console.log('\n2. Shop "no new Emoji Tile" rate by tiles already owned:');
  for (let owned = 0; owned <= ALL_JOKERS.length; owned++) {
    let empty = 0;
    for (let i = 0; i < 2000; i++) {
      // Own the first `owned` jokers (deterministic subset is enough for the rate).
      const run: RunState = {
        ...newRun(`np${owned}-${i}`),
        shopsVisited: 1,
        jokers: ALL_JOKERS.slice(0, owned).map((j) => ({ defId: j.id, edition: 'base', state: {} })),
      };
      const hasJoker = rollShopStock(run, makeRng(`s${owned}-${i}`)).items.some((it) => it?.kind === 'joker');
      if (!hasJoker) empty++;
    }
    console.log(`   owned ${owned}/${ALL_JOKERS.length}: ${pct(empty, 2000)} of shops offer no new tile`);
  }
}

// ---- 3. Pack type & size distribution ----
function packDistribution() {
  const types: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < TRIALS; i++) {
    const run = { ...newRun(`pk${i}`), shopsVisited: 1 };
    for (const p of rollShopStock(run, makeRng(`ps${i}`)).packs) {
      if (!p) continue;
      types[p.type] = (types[p.type] ?? 0) + 1;
      sizes[p.size] = (sizes[p.size] ?? 0) + 1;
      total++;
    }
  }
  console.log('\n3. Pack type distribution  (weights consumable/pattern/tile 4, joker 1.2, ink 0.6):');
  for (const tp of ['consumable', 'pattern', 'tile', 'joker', 'ink'] as PackType[]) {
    console.log(`   ${tp.padEnd(11)} ${pct(types[tp] ?? 0, total)}`);
  }
  console.log('   Pack size distribution  (weights normal 8 / jumbo 4 / mega 1):');
  for (const sz of ['normal', 'jumbo', 'mega'] as PackSize[]) {
    console.log(`   ${sz.padEnd(11)} ${pct(sizes[sz] ?? 0, total)}`);
  }
}

rarityDistribution();
shrinkingPool();
packDistribution();
