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

export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'firstGibberish', group: 'scoring', icon: '🗯️' },
  { id: 'firstLetterHand', group: 'scoring', icon: '🃏' },
  { id: 'firstPattern', group: 'scoring', icon: '📝' },
  { id: 'firstUnison', group: 'scoring', icon: '🎵' },
  { id: 'firstMaterial', group: 'tiles', icon: '🧱' },
  { id: 'firstFont', group: 'tiles', icon: '🅰️' },
  { id: 'firstJoker', group: 'run', icon: '🤡', mascot: 'woodak', target: '.jokers-col' },
  { id: 'firstConsumable', group: 'economy', icon: '✏️', mascot: 'woodak', target: '.consumables-col' },
  { id: 'firstVoucher', group: 'economy', icon: '🎫' },
  { id: 'firstPack', group: 'economy', icon: '📦' },
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪', mascot: 'piyak', target: '.shop-sale-region' },
  { id: 'magnifier', group: 'economy', icon: '🔍' },
  { id: 'pouchHover', group: 'run', icon: '👝' },
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

export interface IntroStep {
  /** stable key → i18n copy `intro.step.<key>.title/.body` */
  key: string;
  /** CSS selector of the play-screen element to spotlight */
  selector: string;
}

/** The 6 core-loop steps, in order (selectors verified in the play screen). */
export const INTRO_STEPS: readonly IntroStep[] = [
  { key: 'hand', selector: '.hand' },
  { key: 'score', selector: '.score-panel' },
  { key: 'target', selector: '.bs-target' },
  { key: 'discard', selector: '.discard-btn' },
  { key: 'tray', selector: '.tray' },
  { key: 'clear', selector: '.round-panel' },
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
