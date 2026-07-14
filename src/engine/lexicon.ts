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

/**
 * Inflection → lemma inheritance (playtest-01 P0-2). Inflected forms are valid
 * (Scrabble convention) but usually untagged; they inherit their lemma's
 * suit/POS. Irregulars come from a small exceptions table; regulars from a few
 * suffix rules. Candidates are tried in order; the first that is tagged wins.
 */
const IRREGULAR: Record<string, string> = {
  ran: 'run', ate: 'eat', went: 'go', made: 'make', gave: 'give', took: 'take',
  saw: 'see', felt: 'feel', held: 'hold', kept: 'keep', slept: 'sleep', sang: 'sing',
  flew: 'fly', fell: 'fall', rose: 'rise', sat: 'sit', stood: 'stand', threw: 'throw',
  broke: 'break', built: 'build', found: 'find', thought: 'think', told: 'tell',
  said: 'say', knew: 'know', heard: 'hear', came: 'come', drank: 'drink',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth',
};

/** De-double a doubled final consonant (e.g. "runn" → "run"). */
const dedouble = (s: string): string => (/([bcdfghjklmnpqrstvwxz])\1$/.test(s) ? s.slice(0, -1) : s);

function lemmaCandidates(word: string): string[] {
  const out: string[] = [];
  const add = (w: string) => {
    if (w.length >= 2 && !out.includes(w)) out.push(w);
  };
  const irr = IRREGULAR[word];
  if (irr) add(irr);
  if (word.length >= 4 && word.endsWith('ies')) add(word.slice(0, -3) + 'y'); // flies→fly
  if (word.length >= 4 && word.endsWith('es')) add(word.slice(0, -2)); // boxes→box
  if (word.length >= 4 && word.endsWith('s')) add(word.slice(0, -1)); // pigs→pig
  if (word.length >= 5 && word.endsWith('ing')) {
    const s = word.slice(0, -3);
    add(s); // eating→eat
    add(s + 'e'); // making→make
    add(dedouble(s)); // running→run
  }
  if (word.length >= 4 && word.endsWith('ed')) {
    const s = word.slice(0, -2);
    add(s); // walked→walk
    add(s + 'e'); // used→use
    add(dedouble(s)); // stopped→stop
  }
  if (word.length >= 5 && word.endsWith('er')) {
    const s = word.slice(0, -2);
    add(s);
    add(dedouble(s)); // bigger→big
  }
  if (word.length >= 6 && word.endsWith('est')) {
    const s = word.slice(0, -3);
    add(s);
    add(dedouble(s)); // biggest→big
  }
  return out;
}

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
      const direct = tagged.get(key);
      if (direct) return { word: key, suit: direct.suit, pos: direct.pos };
      // Inherit from a tagged lemma if this is an inflected form (P0-2).
      for (const cand of lemmaCandidates(key)) {
        const lemma = tagged.get(cand);
        if (lemma) return { word: key, suit: lemma.suit, pos: lemma.pos };
      }
      return { word: key, suit: 'standard', pos: [] };
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
