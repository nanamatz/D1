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
import { canOwnJoker } from './vouchers';

/** Offer weight for a joker by its rarity. 0 = never offered (Legendary, until §12
 *  gives it a route — an absent rarity key resolves to 0 here). */
export function jokerRarityWeight(def: JokerDef): number {
  return BALANCE.emoji.rarityWeights[def.rarity] ?? 0;
}

/**
 * The shared no-duplicate filter (C-2): jokers the run does NOT already own and
 * whose rarity is offerable (weight > 0, so Legendary is out). Selling a joker
 * removes it from run.jokers, so it returns to this pool automatically — no extra
 * bookkeeping. Copy Editor explicitly relaxes `canOwnJoker`; offers and final
 * acquisition checks both inherit that exception.
 */
export function availableJokerDefs(run: RunState): JokerDef[] {
  return ALL_JOKERS.filter((j) => canOwnJoker(run, j.id) && jokerRarityWeight(j) > 0);
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
  // Grouped ONCE, then drained. A Map keeps first-seen rarity order, which is what
  // the weighted walk below indexes into — so this draws the same sequence from the
  // same seed as regrouping per pick did, without the per-pick rebuild.
  const byRarity = new Map<JokerRarity, JokerDef[]>();
  for (const def of availableJokerDefs(run)) {
    const group = byRarity.get(def.rarity);
    if (group) group.push(def);
    else byRarity.set(def.rarity, [def]);
  }

  const picked: JokerDef[] = [];
  while (picked.length < count && byRarity.size > 0) {
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
    picked.push(group.splice(rng.int(group.length), 1)[0]!);
    // A drained rarity leaves the pool entirely, so it stops taking weight.
    if (group.length === 0) byRarity.delete(chosen);
  }
  return picked;
}
