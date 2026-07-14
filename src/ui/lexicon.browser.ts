/**
 * Browser lexicon loader. The engine's node loader uses fs; in the browser we
 * let Vite bundle the same data files (?raw text + JSON), then build the same
 * pure Lexicon. Keeps src/engine free of any browser/Node coupling.
 */
import dictText from '../../data/dictionary.txt?raw';
import rawTable from '../../data/lexicon.json';
import { makeLexicon, parseDictionary, type Lexicon, type LexiconEntryData } from '../engine/lexicon';

export function loadBrowserLexicon(): Lexicon {
  const words = parseDictionary(dictText);
  const table: Record<string, LexiconEntryData> = {};
  for (const [key, value] of Object.entries(rawTable as Record<string, unknown>)) {
    if (key.startsWith('_')) continue; // drop `_comment`
    table[key] = value as LexiconEntryData;
  }
  const lexicon = makeLexicon(words, table);
  // P0-1 acceptance: dictionary loads as a Set at startup; size logged.
  console.info(`[lexicon] ${lexicon.size} valid words loaded (${Object.keys(table).length} tagged)`);
  return lexicon;
}
