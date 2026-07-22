/**
 * WooDak (우땅) mascot skins (2026-07-21). The ally mascot can be re-skinned with an
 * unlocked character; the choice lives in Settings (`wj.settings.mascot`). Piyak (the
 * shop proprietor) is a fixed role and is never re-skinned.
 *
 * These skins ARE the chromatic-unlock `{ kind: 'mascot', variant }` rows (GDD §13:
 * ALIEN/GHOST/DOG/CAT) — "data slots now, art later." A skin becomes selectable once
 * it has art AND the player has unlocked it (played its word, or the C-4 override is on).
 * DOG/GHOST/ALIEN have art; CAT stays `art: null`. Data-driven: adding a skin = fill in
 * its `art` field — never a hard-coded word check in a component (CLAUDE.md guardrail).
 */
import { activeUnlocks } from './unlocks';
import { SETTINGS_KEY } from './settings';
import piyakUrl from './assets/piyak.png';
import woodakUrl from './assets/woodak.png';
import dogUrl from './assets/dog.png';
import ghostUrl from './assets/ghost.png';
import alienUrl from './assets/alien.png';

export type WooDakSkin = 'woodak' | 'alien' | 'ghost' | 'dog' | 'cat';

export interface WooDakSkinDef {
  /** stable id; the non-default ids match an UNLOCKS mascot variant. */
  id: WooDakSkin;
  /** the UNLOCKS id gating this skin, or null for the always-available default. */
  unlockId: string | null;
  /** i18n key for the display name. */
  nameKey: string;
  /** image URL, or null while the art does not exist yet (not selectable). */
  art: string | null;
}

/** The default WooDak is always available; the rest are unlock variants. */
export const WOODAK_SKINS: readonly WooDakSkinDef[] = [
  { id: 'woodak', unlockId: null, nameKey: 'mascot.woodak', art: woodakUrl },
  { id: 'dog', unlockId: 'DOG', nameKey: 'mascot.dog', art: dogUrl },
  { id: 'ghost', unlockId: 'GHOST', nameKey: 'mascot.ghost', art: ghostUrl },
  { id: 'alien', unlockId: 'ALIEN', nameKey: 'mascot.alien', art: alienUrl },
  { id: 'cat', unlockId: 'CAT', nameKey: 'mascot.cat', art: null },
];

/** A skin is usable when it has art AND is unlocked (default is always unlocked). */
function isUsable(def: WooDakSkinDef, active: Set<string>): boolean {
  return def.art !== null && (def.unlockId === null || active.has(def.unlockId));
}

/**
 * The skins a player may currently pick: the default plus every unlocked, art-backed
 * skin. Used by the Options picker (and to decide whether to show it at all).
 */
export function availableWooDakSkins(active: Set<string>): WooDakSkinDef[] {
  return WOODAK_SKINS.filter((s) => isUsable(s, active));
}

/** Resolve WooDak's art for a selection, falling back to the default if the selected
 *  skin is no longer usable (unlock reset, art removed, unknown id). */
export function woodakArt(selected: WooDakSkin, active: Set<string>): string {
  const def = WOODAK_SKINS.find((s) => s.id === selected);
  if (def && isUsable(def, active)) return def.art as string;
  return woodakUrl; // default fallback (== the 'woodak' registry entry's art)
}

/** Art for a mascot unlock variant (alien/ghost/dog/cat), or null if none exists yet.
 *  Used by the unlock celebration to show the newly-won ally instead of a placeholder. */
export function mascotVariantArt(variant: string): string | null {
  return WOODAK_SKINS.find((s) => s.id === variant)?.art ?? null;
}

/** Read the live selection + override straight from localStorage (mirrors readTips):
 *  the tutorial host is long-lived, so we never trust a stale React copy. */
function readSelection(): { mascot: WooDakSkin; unlockAll: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const p = (raw ? JSON.parse(raw) : {}) as { mascot?: WooDakSkin; unlockAll?: boolean };
    return { mascot: p.mascot ?? 'woodak', unlockAll: !!p.unlockAll };
  } catch {
    return { mascot: 'woodak', unlockAll: false };
  }
}

/**
 * THE single image resolver for every mascot render site. 'piyak' is fixed; 'woodak'
 * applies the player's selected skin (with default fallback). Reads current state from
 * storage, so callers need not sit inside the settings React tree.
 */
export function mascotSrc(role: 'piyak' | 'woodak'): string {
  if (role === 'piyak') return piyakUrl;
  const { mascot, unlockAll } = readSelection();
  return woodakArt(mascot, activeUnlocks(unlockAll));
}
