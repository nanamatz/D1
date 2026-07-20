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

/** The 13 non-boss encounters (A-2). Per-boss encounters are a later slice. */
export type EncounterId =
  | 'firstJoker' | 'firstMaterial' | 'firstFont' | 'firstLetterHand'
  | 'firstPattern' | 'firstUnison' | 'firstGibberish' | 'shopFirstVisit'
  | 'firstConsumable' | 'firstVoucher' | 'firstPack' | 'pouchHover' | 'magnifier';

export type EncounterGroup = 'tiles' | 'scoring' | 'economy' | 'run';

export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: string;
}

export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'firstGibberish', group: 'scoring', icon: '🗯️' },
  { id: 'firstLetterHand', group: 'scoring', icon: '🃏' },
  { id: 'firstPattern', group: 'scoring', icon: '📝' },
  { id: 'firstUnison', group: 'scoring', icon: '🎵' },
  { id: 'firstMaterial', group: 'tiles', icon: '🧱' },
  { id: 'firstFont', group: 'tiles', icon: '🅰️' },
  { id: 'firstJoker', group: 'run', icon: '🤡' },
  { id: 'firstConsumable', group: 'economy', icon: '✏️' },
  { id: 'firstVoucher', group: 'economy', icon: '🎫' },
  { id: 'firstPack', group: 'economy', icon: '📦' },
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪' },
  { id: 'magnifier', group: 'economy', icon: '🔍' },
  { id: 'pouchHover', group: 'run', icon: '👝' },
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
