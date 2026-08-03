/**
 * Tutorial Layer 2/3 foundation (work order A). Seen-flags persist beside the
 * word collection (wj.collection → wj.tutorial) via storage.ts — both are save
 * keys, so on desktop they live in the save files. The encounter registry is a
 * data table, and a tiny event bus lets any trigger site announce an encounter
 * without threading a callback through props — the same singleton shape as
 * src/ui/audio.ts.
 *
 * Copy is NOT here: titles use `tutorial.<id>.title`; dialogue resolves through
 * `voicedKeys('enc.<id>', role)` so the popup and Help share mascot-aware copy.
 */

import { readValue, remove as removeKey, writeValue } from './storage';
import type { UiIconId } from './uiIcons';

const KEY = 'wj.tutorial';

/** The 12 encounters (pack-opening coach mark retired; A-2 + first boss). */
export type EncounterId =
  | 'firstJoker' | 'firstMaterial' | 'firstFont' | 'firstLetterHand'
  | 'firstPattern' | 'firstUnison' | 'firstGibberish' | 'shopFirstVisit'
  | 'firstConsumable' | 'firstVoucher'
  | 'pouchHover' | 'firstBoss';

export type EncounterGroup = 'tiles' | 'scoring' | 'economy' | 'run';

export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: UiIconId;
  /** optional mascot portrait shown in the popup card (Piyak = shop, WooDak = mentor) */
  mascot?: 'piyak' | 'woodak';
  /** optional CSS selector — when set, the popup spotlights this element (coach-mark
   *  style) instead of a centered card */
  target?: string;
}

// Every encounter renders as a WooDak spotlight coach-mark (mascot + target),
// EXCEPT the shop-first-visit greeting, which keeps Piyak in her shop-owner role
// (GDD A-2). Targets are elements present when the encounter fires.
export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'firstGibberish', group: 'scoring', icon: 'speechBurst', mascot: 'woodak', target: '.tray' },
  { id: 'firstLetterHand', group: 'scoring', icon: 'letterHand', mascot: 'woodak', target: '.tray' },
  { id: 'firstPattern', group: 'scoring', icon: 'manuscript', mascot: 'woodak', target: '.tray' },
  { id: 'firstUnison', group: 'scoring', icon: 'musicNote', mascot: 'woodak', target: '.tray' },
  { id: 'firstMaterial', group: 'tiles', icon: 'brick', mascot: 'woodak', target: '.hand' },
  { id: 'firstFont', group: 'tiles', icon: 'letterA', mascot: 'woodak', target: '.hand' },
  { id: 'firstJoker', group: 'run', icon: 'jester', mascot: 'woodak', target: '.jokers-col' },
  { id: 'firstConsumable', group: 'economy', icon: 'pencil', mascot: 'woodak', target: '.consumables-col' },
  { id: 'firstVoucher', group: 'economy', icon: 'ticket', mascot: 'woodak', target: '.shop-sale-region' },
  { id: 'shopFirstVisit', group: 'economy', icon: 'storefront', mascot: 'piyak', target: '.shop-sale-region' },
  { id: 'pouchHover', group: 'run', icon: 'pouch', mascot: 'woodak', target: '.pouch-dock' },
  { id: 'firstBoss', group: 'run', icon: 'crown', mascot: 'woodak', target: '.bosseff' },
];

type Flags = Record<string, number>;

export function loadTutorial(): Flags {
  return readValue<Flags>(KEY) ?? {};
}

export function hasSeen(id: EncounterId): boolean {
  return loadTutorial()[id] !== undefined;
}

export function markSeen(id: EncounterId, now: number = Date.now()): void {
  const flags = loadTutorial();
  if (flags[id] !== undefined) return;
  flags[id] = now;
  writeValue(KEY, flags);
}

export function seenCount(): number {
  return Object.keys(loadTutorial()).length;
}

export function resetTutorial(): void {
  removeKey(KEY);
}

// ----- Guided first-run intro (A-1) — a separate one-shot flag -----
const INTRO_KEY = 'wj.tutorialIntro';

/**
 * The scripted first-run lesson (2026-07-21): the opening hand is rigged to contain this
 * word's letters so the guided steps can teach build → submit. The blind target is NOT
 * lowered — it stays the normal ante-1 value (100), so submitting YELLOW (~12 chips) teaches
 * the Palette and ends the lesson, then the board unlocks and the player plays on to clear.
 * The word MUST be a valid dictionary + colour-unlock word so submitting it teaches the
 * Palette. YELLOW = Y,E,L,L,O,W (Twin on the two L's).
 */
export const TUTORIAL_WORD = 'YELLOW';

/** How an intro step advances: a Next button, or automatically when the player performs
 *  the gated action (stages the full word / plays a word). */
export type IntroAdvance = 'next' | 'staged' | 'played';

export interface IntroStep {
  /** stable key → i18n copy `intro.step.<key>.title/.body` */
  key: string;
  /** CSS selector of the play-screen element to spotlight */
  selector: string;
  /** how this step advances (default 'next') */
  advance?: IntroAdvance;
}

/** The rebuilt lesson: frame the grey world → build YELLOW → submit it. Submitting washes the
 *  yellow palette in (ChromaticReveal) and clears the target-10 blind. Learn-by-doing: the
 *  build/submit steps auto-advance when the player actually does them (GuidedIntro). */
export const INTRO_STEPS: readonly IntroStep[] = [
  { key: 'frame', selector: '.round-panel', advance: 'next' },
  { key: 'build', selector: '.hand', advance: 'staged' },
  { key: 'submit', selector: '.play-btn', advance: 'played' },
];

/** Stored as a bare number: valid JSON, so older String(Date.now()) values still read. */
export function hasSeenIntro(): boolean {
  return readValue<number>(INTRO_KEY) !== null;
}

export function markIntroSeen(): void {
  writeValue(INTRO_KEY, Date.now());
}

export function resetIntro(): void {
  removeKey(INTRO_KEY);
}

/** Event bus — decouples trigger sites from the popup host (audio-singleton shape). */
class TutorialBus {
  private subs = new Set<(id: EncounterId) => void>();
  fire(id: EncounterId): void {
    for (const fn of this.subs) fn(id);
  }
  subscribe(fn: (id: EncounterId) => void): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }
}

export const tutorialBus = new TutorialBus();
