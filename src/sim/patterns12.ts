/** Headless smoke scenarios and level-curve report for all sentence patterns. */
import { BALANCE } from '../engine/balance';
import { makeLexicon } from '../engine/lexicon';
import { judgeSentence, patternChipsMult, sentenceTotal } from '../engine/patterns';
import type { PatternId, POS, WordSubmission } from '../engine/types';

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

const patternIds = Object.keys(BALANCE.patterns) as PatternId[];
const axes = (id: PatternId, level: number): string => {
  const { chips, mult } = patternChipsMult(id, level);
  return `${chips} × ${mult}`;
};

console.log('\nPattern growth axes');
console.table(patternIds.map((id) => ({
  pattern: id,
  difficulty: BALANCE.patterns[id].difficulty,
  Lv1: axes(id, 1),
  Lv5: axes(id, 5),
  Lv10: axes(id, 10),
})));

const bonus = (id: PatternId, level: number, committed: number): number => {
  const { chips, mult } = patternChipsMult(id, level);
  return sentenceTotal(committed, chips, mult) - committed;
};
const firstLevelAtLeast = (
  id: PatternId,
  benchmark: PatternId,
  committed: number,
): number | null => {
  const target = bonus(benchmark, 1, committed);
  for (let level = 1; level <= 32; level += 1) {
    if (bonus(id, level, committed) >= target) return level;
  }
  return null;
};

const chapterCheckpoints = [
  { chapter: 1, committed: BALANCE.anteBaseTargets[0] },
  {
    chapter: BALANCE.anteBaseTargets.length,
    committed: BALANCE.anteBaseTargets.at(-1)!,
  },
];
const lowRankEasyPatterns: PatternId[] = ['outcry', 'imperative', 'simple'];

console.log('\nFirst level whose sentence bonus reaches Complex Lv1');
console.table(chapterCheckpoints.flatMap(({ chapter, committed }) =>
  lowRankEasyPatterns.map((pattern) => ({
    chapter,
    committed,
    pattern,
    firstLevel: firstLevelAtLeast(pattern, 'complex', committed),
  })),
));
