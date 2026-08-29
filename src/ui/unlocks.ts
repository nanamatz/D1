/**
 * Chromatic unlocks (feature-02 C) — "writing the world into color."
 *
 * The game begins DESATURATED and SILENT; playing specific words permanently
 * unlocks presentation layers (a color group, an audio bus, or a mascot skin).
 * Persistent PER PROFILE (via storage.ts — a save key,
 * so on desktop it lives in the save files), data-driven: adding a future unlock
 * is adding a row to UNLOCKS — never a hard-coded word check in a component
 * (CLAUDE.md guardrail).
 *
 * Valid words only unlock (gibberish never does — enforced by the caller).
 */

import { audio } from './audio';
import {
  activeProfile,
  readProfileValue,
  remove as removeKey,
  writeValue,
  type ProfileSlot,
} from './storage';

export type UnlockGroup = 'red' | 'yellow' | 'green' | 'blue';

export type UnlockEffect =
  | { kind: 'color'; group: UnlockGroup }
  | { kind: 'audio'; bus: 'music' | 'sfx' }
  | { kind: 'mascot'; variant: 'alien' | 'ghost' | 'dog' | 'turtle' };

export interface UnlockDef {
  /** stable id (== the triggering word, uppercase) */
  id: string;
  word: string;
  effect: UnlockEffect;
}

/** The initial unlock table (C-2). Mascot rows are data slots — no art yet. */
export const UNLOCKS: readonly UnlockDef[] = [
  { id: 'RED', word: 'RED', effect: { kind: 'color', group: 'red' } },
  { id: 'YELLOW', word: 'YELLOW', effect: { kind: 'color', group: 'yellow' } },
  { id: 'GREEN', word: 'GREEN', effect: { kind: 'color', group: 'green' } },
  { id: 'BLUE', word: 'BLUE', effect: { kind: 'color', group: 'blue' } },
  { id: 'MUSIC', word: 'MUSIC', effect: { kind: 'audio', bus: 'music' } },
  { id: 'SOUND', word: 'SOUND', effect: { kind: 'audio', bus: 'sfx' } },
  { id: 'ALIEN', word: 'ALIEN', effect: { kind: 'mascot', variant: 'alien' } },
  { id: 'GHOST', word: 'GHOST', effect: { kind: 'mascot', variant: 'ghost' } },
  { id: 'DOG', word: 'DOG', effect: { kind: 'mascot', variant: 'dog' } },
  { id: 'TURTLE', word: 'TURTLE', effect: { kind: 'mascot', variant: 'turtle' } },
];

const BY_WORD = new Map(UNLOCKS.map((u) => [u.word, u]));
const KEY = 'wj.unlocks';
export const PRESENTATION_CHANGED_EVENT = 'wj:presentation-changed';

/** The set of ids the player has actually PLAYED (celebrated + recorded). */
export function loadPlayed(slot: ProfileSlot = activeProfile()): Set<string> {
  return new Set(readProfileValue<string[]>(KEY, slot) ?? []);
}

export function isPlayed(id: string): boolean {
  return loadPlayed().has(id);
}

function savePlayed(set: Set<string>): void {
  writeValue(KEY, [...set]);
}

export function markPlayed(id: string): void {
  const set = loadPlayed();
  if (set.has(id)) return;
  set.add(id);
  savePlayed(set);
}

export function playedCount(slot: ProfileSlot = activeProfile()): number {
  return loadPlayed(slot).size;
}

export function resetUnlocks(): void {
  removeKey(KEY);
}

/** The active profile's actually discovered unlock ids. */
export function activeUnlocks(): Set<string> {
  return loadPlayed();
}

/** Rec. 709 luminance row — the value a locked (desaturated) channel takes. */
const LUM = [0.2126, 0.7152, 0.0722] as const;

/** RGB channels each colour group restores. YELLOW is red+green (2026-07-30). */
const CHROMA_CHANNELS: Record<UnlockGroup, readonly number[]> = {
  red: [0],
  yellow: [0, 1],
  green: [1],
  blue: [2],
};

/**
 * The `feColorMatrix values` for `#unlock-chroma`, the shared raster-art chroma gate.
 * Each output channel is either its own value (its group is unlocked) or the
 * luminance (locked): `out_c = lum + k_c × (c − lum)`. So no unlocks is exactly
 * `grayscale(1)`, all four is the identity, and a locked hue lands on the same
 * grey full greyscale would give it — never black. 20 numbers: 3 colour rows of
 * `r g b a offset`, then the untouched alpha row.
 */
export function chromaMatrix(active: ReadonlySet<string>): string {
  const gates = [0, 0, 0];
  for (const u of UNLOCKS) {
    if (u.effect.kind !== 'color' || !active.has(u.id)) continue;
    for (const c of CHROMA_CHANNELS[u.effect.group]) gates[c] = 1;
  }
  const rows = gates.map((k, c) =>
    [0, 1, 2].map((i) => (1 - k) * LUM[i]! + (i === c ? k : 0)).join(' '),
  );
  return `${rows.map((row) => `${row} 0 0`).join(' ')} 0 0 0 1 0`;
}

/**
 * Apply the presentation state to the DOM + audio buses. Idempotent — call on
 * mount and whenever the played set changes. Color groups toggle a
 * `unlock-<group>` class on <html> (tokens.css swaps the desaturated defaults
 * for the true values); audio buses gate SFX/music (C-6).
 */
export function applyPresentation(): void {
  const active = activeUnlocks();
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    let anyColor = false;
    for (const u of UNLOCKS) {
      if (u.effect.kind === 'color') {
        const on = active.has(u.id);
        root.classList.toggle(`unlock-${u.effect.group}`, on);
        anyColor = anyColor || on;
      }
      // mascot skins have no DOM/class effect here — they are resolved at each render
      // site by mascots.ts `mascotSrc` (Collection → Mascots picker), not by a root class.
    }
    // "Truly monochrome" guard: greyscale the whole board until ANY colour is
    // unlocked, so hard-coded fills the tokens don't reach are B&W too (C-3 revised).
    root.classList.toggle('world-mono', !anyColor);
    // Shared raster-art chroma gate (expanded 2026-08-28): the palette and object
    // art reveal progressively from the same active set.
    const chroma = document.querySelector('#unlock-chroma feColorMatrix');
    if (chroma) chroma.setAttribute('values', chromaMatrix(active));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRESENTATION_CHANGED_EVENT));
  }
  audio.setBusEnabled('sfx', active.has('SOUND'));
  audio.setBusEnabled('music', active.has('MUSIC'));
}

/**
 * A valid word was played: if it matches an unlock not yet played, record it and
 * return the def so the caller can fire the celebration. Returns null otherwise.
 * (Gibberish must never reach here — the caller gates on validity.)
 */
export function checkWordPlayed(word: string): UnlockDef | null {
  const u = BY_WORD.get(word.toUpperCase());
  if (!u || isPlayed(u.id)) return null;
  markPlayed(u.id);
  return u;
}

/** Celebration bus — decouples the trigger site from the reveal host (audio-singleton shape). */
class UnlockBus {
  private subs = new Set<(def: UnlockDef) => void>();
  emit(def: UnlockDef): void {
    for (const fn of this.subs) fn(def);
  }
  subscribe(fn: (def: UnlockDef) => void): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }
}

export const unlockBus = new UnlockBus();
