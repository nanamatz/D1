/**
 * Tutorial Layer 2/3 foundation (work order A). Seen-flags live in localStorage
 * beside the word collection (wj.collection → wj.tutorial), the encounter
 * registry is a data table, and a tiny event bus lets any trigger site announce
 * an encounter without threading a callback through props — the same singleton
 * shape as src/ui/audio.ts.
 *
 * Copy is NOT here: each encounter's title/body are i18n keys
 * `tutorial.<id>.title` / `.body`, shared verbatim by the popup and the Help
 * glossary (single source).
 */

const KEY = 'wj.tutorial';

/** The 14 encounters (A-2 + first boss). */
export type EncounterId =
  | 'firstJoker' | 'firstMaterial' | 'firstFont' | 'firstLetterHand'
  | 'firstPattern' | 'firstUnison' | 'firstGibberish' | 'shopFirstVisit'
  | 'firstConsumable' | 'firstVoucher'
  | 'firstPack' | 'pouchHover' | 'magnifier' | 'firstBoss';

export type EncounterGroup = 'tiles' | 'scoring' | 'economy' | 'run';

export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: string;
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
  { id: 'firstGibberish', group: 'scoring', icon: '🗯️', mascot: 'woodak', target: '.tray' },
  { id: 'firstLetterHand', group: 'scoring', icon: '🃏', mascot: 'woodak', target: '.tray' },
  { id: 'firstPattern', group: 'scoring', icon: '📝', mascot: 'woodak', target: '.tray' },
  { id: 'firstUnison', group: 'scoring', icon: '🎵', mascot: 'woodak', target: '.tray' },
  { id: 'firstMaterial', group: 'tiles', icon: '🧱', mascot: 'woodak', target: '.hand' },
  { id: 'firstFont', group: 'tiles', icon: '🅰️', mascot: 'woodak', target: '.hand' },
  { id: 'firstJoker', group: 'run', icon: '🤡', mascot: 'woodak', target: '.jokers-col' },
  { id: 'firstConsumable', group: 'economy', icon: '✏️', mascot: 'woodak', target: '.consumables-col' },
  { id: 'firstVoucher', group: 'economy', icon: '🎫', mascot: 'woodak', target: '.shop-sale-region' },
  { id: 'firstPack', group: 'economy', icon: '📦', mascot: 'woodak', target: '.shop-sale-region' },
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪', mascot: 'piyak', target: '.shop-sale-region' },
  { id: 'magnifier', group: 'economy', icon: '🔍', mascot: 'woodak', target: '.consumables-col' },
  { id: 'pouchHover', group: 'run', icon: '👝', mascot: 'woodak', target: '.pouch-dock' },
  { id: 'firstBoss', group: 'run', icon: '👑', mascot: 'woodak', target: '.bosseff' },
];

type Flags = Record<string, number>;

export function loadTutorial(): Flags {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Flags) : {};
  } catch {
    return {};
  }
}

export function hasSeen(id: EncounterId): boolean {
  return loadTutorial()[id] !== undefined;
}

export function markSeen(id: EncounterId, now: number = Date.now()): void {
  const flags = loadTutorial();
  if (flags[id] !== undefined) return;
  flags[id] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function seenCount(): number {
  return Object.keys(loadTutorial()).length;
}

export function resetTutorial(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
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

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) !== null;
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_KEY, String(Date.now()));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function resetIntro(): void {
  try {
    localStorage.removeItem(INTRO_KEY);
  } catch {
    /* ignore */
  }
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
