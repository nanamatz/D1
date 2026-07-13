/**
 * Lexicon — word validity + the baked register/POS table (GDD §3.2, §4.2).
 *
 * Two inputs, kept as pure strings so the engine stays Node/browser-agnostic
 * (the caller reads the files):
 *   - dictionary.txt  → the set of valid words (one lowercase word per line)
 *   - lexicon.json    → { word: { suit, pos[] } } hand-tagged table
 *
 * Lookup policy (GDD §3.2 "everything standard except a tagged set"):
 *   - tagged word      → its baked entry
 *   - valid, untagged  → { suit: 'standard', pos: [] }
 *   - not a word       → null  (caller routes to the gibberish path, §6.4)
 */

import type { LexiconEntry, POS, Suit } from './types';

/** The tagged-table shape (a LexiconEntry without the redundant `word` key). */
export interface LexiconEntryData {
  suit: Suit;
  pos: POS[];
}

export interface Lexicon {
  /** number of valid words */
  readonly size: number;
  isWord(text: string): boolean;
  /** baked entry, or null if `text` is not a valid word */
  lookup(text: string): LexiconEntry | null;
}

const norm = (text: string): string => text.trim().toLowerCase();

export function makeLexicon(
  words: Iterable<string>,
  entries: Record<string, LexiconEntryData>,
): Lexicon {
  const valid = new Set<string>();
  for (const w of words) valid.add(norm(w));

  const tagged = new Map<string, LexiconEntryData>();
  for (const [w, data] of Object.entries(entries)) {
    const key = norm(w);
    tagged.set(key, data);
    valid.add(key); // a tagged word is always valid
  }

  return {
    get size() {
      return valid.size;
    },
    isWord(text) {
      return valid.has(norm(text));
    },
    lookup(text) {
      const key = norm(text);
      if (!valid.has(key)) return null;
      const t = tagged.get(key);
      return t
        ? { word: key, suit: t.suit, pos: t.pos }
        : { word: key, suit: 'standard', pos: [] };
    },
  };
}

/** Parse dictionary.txt: one lowercase word per line; blanks and `#` comments dropped. */
export function parseDictionary(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.toLowerCase());
}

/** Parse lexicon.json into the tagged table. */
export function parseLexiconTable(json: string): Record<string, LexiconEntryData> {
  return JSON.parse(json) as Record<string, LexiconEntryData>;
}
