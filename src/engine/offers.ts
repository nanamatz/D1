/**
 * Emoji Tile (Charm) offer pool — the SINGLE shared filter + sampler that both the
 * shop item slots and Charm Packs call (feature-03 C-1/C-2, GDD §9.2). Keeping one
 * implementation is the point: two copies drifted apart is exactly the bug C-2
 * forbids. Rarity odds live in BALANCE.emoji.rarityWeights (Common 70 / Uncommon 25
 * / Rare 5); Legendary is absent → weight 0 → it never rolls (no route yet, §12).
 */
import { BALANCE } from './balance';
import { ALL_JOKERS } from './jokers';
import type { JokerDef } from './events';
import type { Rng } from './rng';
import type { JokerRarity, RunState } from './types';

/** Offer weight for a joker by its rarity. 0 = never offered (Legendary, until §12
 *  gives it a route — an absent rarity key resolves to 0 here). */
export function jokerRarityWeight(def: JokerDef): number {
  return BALANCE.emoji.rarityWeights[def.rarity] ?? 0;
}

/**
 * The shared no-duplicate filter (C-2): jokers the run does NOT already own and
 * whose rarity is offerable (weight > 0, so Legendary is out). Selling a joker
 * removes it from run.jokers, so it returns to this pool automatically — no extra
 * bookkeeping. The `owned` exclusion is the ONE place a future duplicate-breaker
 * item (Showman-equivalent, §9.2 explicit-effect exception / §12 open) would relax;
 * gate it here and both the shop and Charm Packs inherit it.
 */
export function availableJokerDefs(run: RunState): JokerDef[] {
  const owned = new Set(run.jokers.map((j) => j.defId));
  return ALL_JOKERS.filter((j) => !owned.has(j.id) && jokerRarityWeight(j) > 0);
}

/**
 * Sample up to `count` distinct offerable jokers, weighted by rarity (C-1) — the
 * rarity-honest draw shared by the shop and Charm Packs. Balatro's two-step model,
 * so a single slot's odds are exactly the rarity weights (70/25/5) regardless of
 * how many jokers sit in each rarity: pick a RARITY by weight, then a UNIFORM joker
 * within it. Sampling is WITHOUT replacement (a tile can't be offered twice in one
 * roll); a rarity drops out of the weighting once its jokers are exhausted, and the
 * whole draw returns fewer than `count` when the pool empties (the shrinking-pool
 * "nothing new" effect, C-4).
 */
export function sampleJokerDefs(run: RunState, count: number, rng: Rng): JokerDef[] {
  const remaining = availableJokerDefs(run);
  const picked: JokerDef[] = [];
  while (picked.length < count && remaining.length > 0) {
    const byRarity = new Map<JokerRarity, JokerDef[]>();
    for (const j of remaining) {
      const group = byRarity.get(j.rarity);
      if (group) group.push(j);
      else byRarity.set(j.rarity, [j]);
    }
    const rarities = [...byRarity.keys()];
    const total = rarities.reduce((s, r) => s + (BALANCE.emoji.rarityWeights[r] ?? 0), 0);
    let x = rng.next() * total;
    let chosen = rarities[rarities.length - 1]!;
    for (const r of rarities) {
      x -= BALANCE.emoji.rarityWeights[r] ?? 0;
      if (x < 0) {
        chosen = r;
        break;
      }
    }
    const group = byRarity.get(chosen)!;
    const j = group[rng.int(group.length)]!;
    picked.push(j);
    remaining.splice(remaining.indexOf(j), 1);
  }
  return picked;
}
