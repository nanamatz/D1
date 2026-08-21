/**
 * WooDak (우땅) mascot skins (2026-07-21). The ally mascot can be re-skinned with an
 * unlocked character; the choice is made in Collection → Mascots and persists as
 * `wj.settings.mascot`. Piyak (the shop proprietor) is a fixed role and is never re-skinned.
 *
 * These skins ARE the chromatic-unlock `{ kind: 'mascot', variant }` rows (GDD §13:
 * ALIEN/GHOST/DOG plus TURTLE) — "data slots now, art later." A skin becomes selectable
 * once it has art AND the active profile has unlocked it. All current variants
 * (ALIEN/GHOST/DOG/TURTLE) have art. Data-driven: adding a skin means filling
 * its portrait and cursor set here — never a hard-coded word check in a component
 * (CLAUDE.md guardrail).
 */
import { activeUnlocks } from './unlocks';
import { SETTINGS_KEY } from './settings';
import { readValue } from './storage';
import piyakUrl from './assets/piyak.png';
import woodakUrl from './assets/woodak.png';
import dogUrl from './assets/dog.png';
import ghostUrl from './assets/ghost.png';
import alienUrl from './assets/alien.png';
import turtleUrl from './assets/turtle.png';
import woodakCursorNormalMono from './assets/cursors/woodak-hand-normal-mono.png';
import woodakCursorNormalColor from './assets/cursors/woodak-hand-normal-color.png';
import woodakCursorHoverMono from './assets/cursors/woodak-hand-hover-mono.png';
import woodakCursorHoverColor from './assets/cursors/woodak-hand-hover-color.png';
import woodakCursorActiveMono from './assets/cursors/woodak-hand-active-mono.png';
import woodakCursorActiveColor from './assets/cursors/woodak-hand-active-color.png';
import dogCursorNormalMono from './assets/cursors/dog-hand-normal-mono.png';
import dogCursorNormalColor from './assets/cursors/dog-hand-normal-color.png';
import dogCursorHoverMono from './assets/cursors/dog-hand-hover-mono.png';
import dogCursorHoverColor from './assets/cursors/dog-hand-hover-color.png';
import dogCursorActiveMono from './assets/cursors/dog-hand-active-mono.png';
import dogCursorActiveColor from './assets/cursors/dog-hand-active-color.png';
import ghostCursorNormalMono from './assets/cursors/ghost-hand-normal-mono.png';
import ghostCursorNormalColor from './assets/cursors/ghost-hand-normal-color.png';
import ghostCursorHoverMono from './assets/cursors/ghost-hand-hover-mono.png';
import ghostCursorHoverColor from './assets/cursors/ghost-hand-hover-color.png';
import ghostCursorActiveMono from './assets/cursors/ghost-hand-active-mono.png';
import ghostCursorActiveColor from './assets/cursors/ghost-hand-active-color.png';
import alienCursorNormalMono from './assets/cursors/alien-hand-normal-mono.png';
import alienCursorNormalColor from './assets/cursors/alien-hand-normal-color.png';
import alienCursorHoverMono from './assets/cursors/alien-hand-hover-mono.png';
import alienCursorHoverColor from './assets/cursors/alien-hand-hover-color.png';
import alienCursorActiveMono from './assets/cursors/alien-hand-active-mono.png';
import alienCursorActiveColor from './assets/cursors/alien-hand-active-color.png';
import turtleCursorNormalMono from './assets/cursors/turtle-hand-normal-mono.png';
import turtleCursorNormalColor from './assets/cursors/turtle-hand-normal-color.png';
import turtleCursorHoverMono from './assets/cursors/turtle-hand-hover-mono.png';
import turtleCursorHoverColor from './assets/cursors/turtle-hand-hover-color.png';
import turtleCursorActiveMono from './assets/cursors/turtle-hand-active-mono.png';
import turtleCursorActiveColor from './assets/cursors/turtle-hand-active-color.png';
import type { WooDakSkin } from './mascotIds';

export type { WooDakSkin } from './mascotIds';

export interface MascotCursorSet {
  normal: { mono: string; color: string };
  hover: { mono: string; color: string };
  active: { mono: string; color: string };
}

export interface WooDakSkinDef {
  /** stable id; the non-default ids match an UNLOCKS mascot variant. */
  id: WooDakSkin;
  /** the UNLOCKS id gating this skin, or null for the always-available default. */
  unlockId: string | null;
  /** i18n key for the display name. */
  nameKey: string;
  /** image URL, or null while the art does not exist yet (not selectable). */
  art: string | null;
  /** Native CSS cursor art for this skin; availability follows the portrait. */
  cursors: MascotCursorSet;
}

/** The default WooDak is always available; the rest are unlock variants. */
export const WOODAK_SKINS: readonly WooDakSkinDef[] = [
  {
    id: 'woodak', unlockId: null, nameKey: 'mascot.woodak', art: woodakUrl,
    cursors: {
      normal: { mono: woodakCursorNormalMono, color: woodakCursorNormalColor },
      hover: { mono: woodakCursorHoverMono, color: woodakCursorHoverColor },
      active: { mono: woodakCursorActiveMono, color: woodakCursorActiveColor },
    },
  },
  {
    id: 'dog', unlockId: 'DOG', nameKey: 'mascot.dog', art: dogUrl,
    cursors: {
      normal: { mono: dogCursorNormalMono, color: dogCursorNormalColor },
      hover: { mono: dogCursorHoverMono, color: dogCursorHoverColor },
      active: { mono: dogCursorActiveMono, color: dogCursorActiveColor },
    },
  },
  {
    id: 'ghost', unlockId: 'GHOST', nameKey: 'mascot.ghost', art: ghostUrl,
    cursors: {
      normal: { mono: ghostCursorNormalMono, color: ghostCursorNormalColor },
      hover: { mono: ghostCursorHoverMono, color: ghostCursorHoverColor },
      active: { mono: ghostCursorActiveMono, color: ghostCursorActiveColor },
    },
  },
  {
    id: 'alien', unlockId: 'ALIEN', nameKey: 'mascot.alien', art: alienUrl,
    cursors: {
      normal: { mono: alienCursorNormalMono, color: alienCursorNormalColor },
      hover: { mono: alienCursorHoverMono, color: alienCursorHoverColor },
      active: { mono: alienCursorActiveMono, color: alienCursorActiveColor },
    },
  },
  {
    id: 'turtle', unlockId: 'TURTLE', nameKey: 'mascot.turtle', art: turtleUrl,
    cursors: {
      normal: { mono: turtleCursorNormalMono, color: turtleCursorNormalColor },
      hover: { mono: turtleCursorHoverMono, color: turtleCursorHoverColor },
      active: { mono: turtleCursorActiveMono, color: turtleCursorActiveColor },
    },
  },
];

/** A skin is usable when it has art AND is unlocked (default is always unlocked). */
function isUsable(def: WooDakSkinDef, active: Set<string>): boolean {
  return def.art !== null && (def.unlockId === null || active.has(def.unlockId));
}

function effectiveWooDakSkin(selected: WooDakSkin, active: Set<string>): WooDakSkinDef {
  const selectedDef = WOODAK_SKINS.find((skin) => skin.id === selected);
  return selectedDef && isUsable(selectedDef, active) ? selectedDef : WOODAK_SKINS[0]!;
}

/**
 * The skins a player may currently pick: the default plus every unlocked, art-backed
 * skin. Used by tests and any compact read-only availability surface.
 */
export function availableWooDakSkins(active: Set<string>): WooDakSkinDef[] {
  return WOODAK_SKINS.filter((s) => isUsable(s, active));
}

/** Resolve WooDak's art for a selection, falling back to the default if the selected
 *  skin is no longer usable (unlock reset, art removed, unknown id). */
export function woodakArt(selected: WooDakSkin, active: Set<string>): string {
  return effectiveWooDakSkin(selected, active).art as string;
}

/** Resolve the selected skin's cursor set through the same art+unlock fallback. */
export function mascotCursorSet(selected: WooDakSkin, active: Set<string>): MascotCursorSet {
  return effectiveWooDakSkin(selected, active).cursors;
}

/** The six URLs that must be decoded before atomically switching cursor skins. */
export function mascotCursorUrls(selected: WooDakSkin, active: Set<string>): string[] {
  const cursors = mascotCursorSet(selected, active);
  return (['normal', 'hover', 'active'] as const).flatMap((state) => [
    cursors[state].mono,
    cursors[state].color,
  ]);
}

/** Initial-loading wrapper using the live machine selection and active profile. */
export function activeMascotCursorUrls(): string[] {
  return mascotCursorUrls(readSelection(), activeUnlocks());
}

/** Write the six native cursor URL values consumed by cursor.css. */
export function applyMascotCursor(
  root: HTMLElement,
  selected: WooDakSkin,
  active: Set<string>,
): void {
  const cursors = mascotCursorSet(selected, active);
  for (const state of ['normal', 'hover', 'active'] as const) {
    const fallback = state === 'normal' ? 'default' : 'pointer';
    for (const tone of ['mono', 'color'] as const) {
      root.style.setProperty(
        `--mascot-cursor-${state}-${tone}`,
        `url(${JSON.stringify(cursors[state][tone])}) 3 3, ${fallback}`,
      );
    }
  }
}

/** Art for a mascot unlock variant (alien/ghost/dog/cat), or null if none exists yet.
 *  Used by the unlock celebration to show the newly-won ally instead of a placeholder. */
export function mascotVariantArt(variant: string): string | null {
  return WOODAK_SKINS.find((s) => s.id === variant)?.art ?? null;
}

/** Rows for the 도감 Mascots category (item 5.1): every skin, flagged unlocked (the
 *  default is always unlocked). Locked-but-art-backed rows render as silhouettes; the
 *  active profile's stored unlock set is the single source of truth. */
export function mascotCollectionRows(
  active: Set<string>,
): { id: WooDakSkin; nameKey: string; art: string | null; unlocked: boolean }[] {
  return WOODAK_SKINS.map((s) => ({
    id: s.id,
    nameKey: s.nameKey,
    art: s.art,
    unlocked: s.unlockId === null || active.has(s.unlockId),
  }));
}

/** Read the live selection straight from storage (mirrors readTips):
 *  the tutorial host is long-lived, so we never trust a stale React copy. */
function readSelection(): WooDakSkin {
  const p = readValue<{ mascot?: WooDakSkin }>(SETTINGS_KEY) ?? {};
  return p.mascot ?? 'woodak';
}

/**
 * THE single image resolver for every mascot render site. 'piyak' is fixed; 'woodak'
 * applies the player's selected skin (with default fallback). Reads current state from
 * storage, so callers need not sit inside the settings React tree.
 */
export function mascotSrc(role: 'piyak' | 'woodak'): string {
  if (role === 'piyak') return piyakUrl;
  return woodakArt(readSelection(), activeUnlocks());
}

/**
 * Fallback chain of locale keys for one mascot-voiced line.
 *
 * Piyak is a fixed role — she is never re-skinned, so her chain is a single key.
 * WooDak applies the player's selected skin and ALWAYS keeps `voice.woodak.<line>`
 * as the tail, so a skin that has not written a given line (or is no longer usable
 * — unlock reset, art removed, unknown id) degrades to WooDak's copy instead of
 * rendering a raw key. Pure so it can be tested without storage; `voicedKeys` is
 * the storage-reading wrapper callers use.
 */
export function voiceChain(
  line: string,
  role: 'woodak' | 'piyak',
  skin: WooDakSkin,
  active: Set<string>,
): string[] {
  if (role === 'piyak') return [`voice.piyak.${line}`];
  const def = WOODAK_SKINS.find((s) => s.id === skin);
  if (!def || def.id === 'woodak' || !isUsable(def, active)) return [`voice.woodak.${line}`];
  return [`voice.${def.id}.${line}`, `voice.woodak.${line}`];
}

/**
 * THE key resolver for every mascot render site — the only place that knows which
 * skin is speaking. Reads the live selection from storage (like `mascotSrc`), so
 * long-lived hosts such as TutorialHost never hold a stale copy. Pass the result
 * straight to `t()`, which resolves the chain (i18n.tsx).
 *
 * NEVER write a `voice.*` key literal at a call site — go through here.
 */
export function voicedKeys(line: string, role: 'woodak' | 'piyak' = 'woodak'): string[] {
  return voiceChain(line, role, readSelection(), activeUnlocks());
}
