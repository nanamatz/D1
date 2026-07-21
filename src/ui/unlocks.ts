/**
 * Chromatic unlocks (feature-02 C) — "writing the world into color."
 *
 * The game begins DESATURATED and SILENT; playing specific words permanently
 * unlocks presentation layers (a color group, an audio bus, a mascot skin, or a
 * celebratory locale entry). Persistent PER PROFILE (localStorage), data-driven:
 * adding a future unlock is adding a row to UNLOCKS — never a hard-coded word
 * check in a component (CLAUDE.md guardrail).
 *
 * Valid words only unlock (gibberish never does — enforced by the caller).
 */

import { audio } from './audio';

export type UnlockGroup = 'red' | 'yellow' | 'green' | 'blue';

export type UnlockEffect =
  | { kind: 'color'; group: UnlockGroup }
  | { kind: 'audio'; bus: 'music' | 'sfx' }
  | { kind: 'locale'; lang: 'ko' }
  | { kind: 'mascot'; variant: 'monster' | 'ghost' | 'dog' | 'cat' };

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
  { id: 'KOREAN', word: 'KOREAN', effect: { kind: 'locale', lang: 'ko' } },
  { id: 'MONSTER', word: 'MONSTER', effect: { kind: 'mascot', variant: 'monster' } },
  { id: 'GHOST', word: 'GHOST', effect: { kind: 'mascot', variant: 'ghost' } },
  { id: 'DOG', word: 'DOG', effect: { kind: 'mascot', variant: 'dog' } },
  { id: 'CAT', word: 'CAT', effect: { kind: 'mascot', variant: 'cat' } },
];

const BY_WORD = new Map(UNLOCKS.map((u) => [u.word, u]));
const KEY = 'wj.unlocks';

/** The set of ids the player has actually PLAYED (celebrated + recorded). */
export function loadPlayed(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isPlayed(id: string): boolean {
  return loadPlayed().has(id);
}

function savePlayed(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function markPlayed(id: string): void {
  const set = loadPlayed();
  if (set.has(id)) return;
  set.add(id);
  savePlayed(set);
}

export function playedCount(): number {
  return loadPlayed().size;
}

export function resetUnlocks(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The set of unlock ids whose EFFECT is currently active = played, OR everything
 * when the Settings "unlock all" override is on (C-4). The override lights the
 * presentation but does NOT count as discovered — the collection record only
 * fires on the real first play (checkWordPlayed).
 */
export function activeUnlocks(unlockAll: boolean): Set<string> {
  if (unlockAll) return new Set(UNLOCKS.map((u) => u.id));
  return loadPlayed();
}

/**
 * Apply the presentation state to the DOM + audio buses. Idempotent — call on
 * mount and whenever the played set / override changes. Color groups toggle a
 * `unlock-<group>` class on <html> (tokens.css swaps the desaturated defaults
 * for the true values); audio buses gate SFX/music (C-6).
 */
export function applyPresentation(unlockAll: boolean): void {
  const active = activeUnlocks(unlockAll);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    let anyColor = false;
    for (const u of UNLOCKS) {
      if (u.effect.kind === 'color') {
        const on = active.has(u.id);
        root.classList.toggle(`unlock-${u.effect.group}`, on);
        anyColor = anyColor || on;
      }
      // mascot skins are data slots — no DOM effect until variant art exists.
    }
    // "Truly monochrome" guard: greyscale the whole board until ANY colour is
    // unlocked, so hard-coded fills the tokens don't reach are B&W too (C-3 revised).
    root.classList.toggle('world-mono', !anyColor);
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
