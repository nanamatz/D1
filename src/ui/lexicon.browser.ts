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
  const lexicon = makeLexicon(words, rawTable as Record<string, LexiconEntryData>);
  // P0-1 acceptance: dictionary loads as a Set at startup; size logged.
  console.info(`[lexicon] ${lexicon.size} valid words loaded`);
  return lexicon;
}
