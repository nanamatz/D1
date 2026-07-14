/**
 * Word collection tracking (playtest-01 P2-2). Records the first time each word
 * is played, in localStorage, accumulating across sessions. Gibberish is
 * excluded by the caller (it has no dictionary word). The collection *screen*
 * (도감) is a later milestone — this is just the tracking hook.
 */

const KEY = 'wj.collection';

/** word (lowercase) → first-played epoch ms. */
export type Collection = Record<string, number>;

export function loadCollection(): Collection {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Collection) : {};
  } catch {
    return {};
  }
}

/**
 * Record a played word if new. Returns true if it was newly collected, false if
 * already present. Case-insensitive.
 */
export function recordWord(word: string, now: number = Date.now()): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  const collection = loadCollection();
  if (collection[w] !== undefined) return false;
  collection[w] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(collection));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  return true;
}

export function collectionSize(): number {
  return Object.keys(loadCollection()).length;
}
