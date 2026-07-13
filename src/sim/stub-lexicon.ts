/// <reference types="node" />
/**
 * Node-side loader for the dev-stub lexicon files (data/dictionary.txt,
 * data/lexicon.json). Kept OUT of src/engine so the engine stays free of fs
 * (the browser UI will bundle the same data via Vite `?raw` imports instead).
 *
 * Strips `_`-prefixed keys from the JSON table (JSON has no comments, so the
 * stub uses `_comment`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  makeLexicon,
  parseDictionary,
  parseLexiconTable,
  type Lexicon,
  type LexiconEntryData,
} from '../engine/lexicon';

const dataFile = (name: string): string =>
  fileURLToPath(new URL(`../../data/${name}`, import.meta.url));

export function loadStubLexicon(): Lexicon {
  const words = parseDictionary(readFileSync(dataFile('dictionary.txt'), 'utf8'));
  const rawTable = parseLexiconTable(readFileSync(dataFile('lexicon.json'), 'utf8'));

  const table: Record<string, LexiconEntryData> = {};
  for (const [key, value] of Object.entries(rawTable)) {
    if (key.startsWith('_')) continue; // drop `_comment` etc.
    table[key] = value;
  }

  return makeLexicon(words, table);
}
