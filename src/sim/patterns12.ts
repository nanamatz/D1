/** Tiny headless smoke scenario for the four expanded sentence patterns. */
import { makeLexicon } from '../engine/lexicon';
import { judgeSentence } from '../engine/patterns';
import type { POS, WordSubmission } from '../engine/types';

const entries: Record<string, { suit: 'standard'; pos: POS[] }> = {
  i: { suit: 'standard', pos: ['noun'] },
  made: { suit: 'standard', pos: ['verbTransitive'] },
  him: { suit: 'standard', pos: ['noun'] },
  happy: { suit: 'standard', pos: ['adjective'] },
  are: { suit: 'standard', pos: ['verbLinking'] },
  you: { suit: 'standard', pos: ['noun'] },
  ready: { suit: 'standard', pos: ['adjective'] },
  never: { suit: 'standard', pos: ['adverb'] },
  lie: { suit: 'standard', pos: ['verbIntransitive'] },
  because: { suit: 'standard', pos: ['conjunction'] },
  birds: { suit: 'standard', pos: ['noun'] },
  fly: { suit: 'standard', pos: ['verbIntransitive'] },
  cats: { suit: 'standard', pos: ['noun'] },
  sleep: { suit: 'standard', pos: ['verbIntransitive'] },
};
const lexicon = makeLexicon([], entries);
const submit = (text: string): WordSubmission => ({
  tiles: [],
  text,
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
});

for (const words of [
  ['I', 'MADE', 'HIM', 'HAPPY'],
  ['ARE', 'YOU', 'READY'],
  ['I', 'NEVER', 'LIE'],
  ['BECAUSE', 'BIRDS', 'FLY', 'CATS', 'SLEEP'],
]) {
  const result = judgeSentence(words.map(submit), lexicon);
  console.log(`${words.join(' ')} -> ${result.match?.pattern ?? 'none'}`);
}
