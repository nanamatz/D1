import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Letter, ScoreEvent, Tile } from '../src/engine/types';
import { JokerPop } from '../src/ui/components/JokerShelf';

const tilesFor = (word: string): Tile[] => [...word.toUpperCase()].map((letter, index) => ({
  id: `joker-pop-${index}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
}));

const jokerEvent = (jokerId: string, word: string): Extract<ScoreEvent, { kind: 'joker' }> => {
  const run = newRun(`joker-pop-${jokerId}`);
  run.jokers = [{ defId: jokerId, state: {} }];
  const hand = tilesFor(word);
  const result = submitWord(
    { ...startBlind(run, makeRng(run.seed)), hand },
    run,
    makeLexicon([], { [word]: { suit: 'standard', pos: ['noun'] } }),
    hand.map((tile) => tile.id),
    makeRng('joker-pop'),
  );
  const event = result.events.find((candidate) => candidate.kind === 'joker');
  if (!event || event.kind !== 'joker') throw new Error(`Missing ${jokerId} score event`);
  return event;
};

describe('Emoji Tile trigger popup', () => {
  it('preserves multiply versus additive Mult semantics', () => {
    expect(jokerEvent('alphabetPress', 'abc').multFactor).toBeCloseTo(
      BALANCE.jokers.alphabetPress.factorPerPair ** 2,
    );
    expect(jokerEvent('equilibrist', 'at').multFactor).toBeUndefined();
  });

  it('renders symbolic values and the Applied fallback', () => {
    const effect = renderToStaticMarkup(
      <JokerPop chips={12} mult={3} multFactor={2} score={20} gold={4} applied="Applied" />,
    );
    expect(effect).toContain('chip-diamond');
    expect(effect).toContain('×2');
    expect(effect).toContain('tomato-icon');
    expect(effect).toContain('+$4');

    expect(renderToStaticMarkup(
      <JokerPop chips={0} mult={0} applied="Applied" />,
    )).toContain('Applied');

    expect(jokerEvent('sometimesY', 'yay')).toMatchObject({
      chipsDelta: 0,
      multDelta: 0,
    });
  });

  it('places large Emoji and letter trigger effects outside their source objects', () => {
    const shelf = readFileSync('src/ui/components/JokerShelf.tsx', 'utf8');
    const tile = readFileSync('src/ui/components/Tile.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');

    expect(shelf.indexOf('</Tooltip>')).toBeLessThan(shelf.indexOf('{firing && settle.jokerPop'));
    expect(tile).toContain('className="trigger-pop tile-effect-pop"');
    expect(tile).toContain('className="chip-diamond"');
    expect(css).toMatch(/\.trigger-pop\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.joker-pop\s*\{[^}]*top:\s*calc\(100% \+ 10px\)[^}]*triggerPopBelow/s);
    expect(css).toMatch(/\.tile-effect-pop\s*\{[^}]*bottom:\s*calc\(100% \+ 10px\)[^}]*triggerPopAbove/s);
    expect(css).toMatch(/\.hand \.tile\.trig-bounce\s*\{[^}]*jokerWiggle/s);
  });
});
