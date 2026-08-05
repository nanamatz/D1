import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import { startBlind, submitWord } from '../src/engine/loop';
import { judgeSentence } from '../src/engine/patterns';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Letter, ScoreEvent, Tile } from '../src/engine/types';
import { JokerPop } from '../src/ui/components/JokerShelf';
import { SentenceTray } from '../src/ui/components/SentenceTray';
import { I18nProvider } from '../src/ui/i18n';
import { accumulate } from '../src/ui/settle';

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
    expect(jokerEvent('alphabetPress', 'abc').multFactor)
      .toBe(BALANCE.jokers.alphabetPress.factorPerPair);
    expect(jokerEvent('tyrant', 'cat').multFactor).toBe(BALANCE.jokers.tyrant.vulgarFactor);
    expect(jokerEvent('rareEarth', 'q').chipsFactor).toBe(BALANCE.jokers.rareEarth.factor);
    expect(jokerEvent('equilibrist', 'at').multFactor).toBeUndefined();
  });

  it('fires Type Orchestra once per distinct font instead of one aggregate beat', () => {
    const run = newRun('type-orchestra-beats');
    run.jokers = [{ defId: 'typeOrchestra', state: {} }];
    const hand = tilesFor('cat');
    hand[0]!.font = 'medium';
    hand[1]!.font = 'bold';
    hand[2]!.font = 'inline';
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } }),
      hand.map((tile) => tile.id),
      makeRng('type-orchestra-play'),
    );
    const beats = result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'typeOrchestra',
    );

    expect(beats).toHaveLength(3);
    for (let index = 0; index < beats.length; index += 1) {
      const beat = beats[index]!;
      expect(beat.kind === 'joker' ? beat.multFactor : undefined)
        .toBe(BALANCE.jokers.typeOrchestra.factorPerFont);
      expect(beat.kind === 'joker' ? beat.tileId : undefined).toBe(hand[index]!.id);
    }
  });

  it('attributes every played-tile Emoji effect to the tile that triggered it', () => {
    const cases: {
      jokerId: string;
      word: string;
      expected: number[];
      prepare?: (tiles: Tile[]) => void;
    }[] = [
      { jokerId: 'ceramicArtisan', word: 'ab', expected: [0, 1] },
      { jokerId: 'rareEarth', word: 'qaz', expected: [0, 2] },
      { jokerId: 'alphabetSoup', word: 'aba', expected: [0, 1] },
      { jokerId: 'leftMargin', word: 'at', expected: [0] },
      { jokerId: 'rightMargin', word: 'at', expected: [1] },
      { jokerId: 'alphabetPress', word: 'abc', expected: [1, 2] },
      { jokerId: 'vowelChoir', word: 'area', expected: [0, 2] },
      { jokerId: 'consonantChoir', word: 'letter', expected: [3] },
      {
        jokerId: 'glasswork', word: 'cat', expected: [0, 2],
        prepare: (tiles) => { tiles[0]!.material = 'glass'; tiles[2]!.material = 'glass'; },
      },
      {
        jokerId: 'glassCannon', word: 'cat', expected: [0, 2],
        prepare: (tiles) => { tiles[0]!.material = 'glass'; tiles[2]!.material = 'glass'; },
      },
      {
        jokerId: 'materialSampler', word: 'cat', expected: [0, 1],
        prepare: (tiles) => { tiles[1]!.material = 'glass'; },
      },
      {
        jokerId: 'materialPrism', word: 'cat', expected: [0, 1],
        prepare: (tiles) => { tiles[1]!.material = 'glass'; },
      },
      {
        jokerId: 'growthRings', word: 'a', expected: [0],
        prepare: (tiles) => { tiles[0]!.material = 'wood'; },
      },
      {
        jokerId: 'woodpecker', word: 'a', expected: [0],
        prepare: (tiles) => { tiles[0]!.material = 'wood'; },
      },
      {
        jokerId: 'lightTouch', word: 'a', expected: [0],
        prepare: (tiles) => { tiles[0]!.font = 'lightItalic'; },
      },
      {
        jokerId: 'heavyPress', word: 'a', expected: [0],
        prepare: (tiles) => { tiles[0]!.font = 'bold'; },
      },
      {
        jokerId: 'typeOrchestra', word: 'cat', expected: [0, 1],
        prepare: (tiles) => { tiles[1]!.font = 'bold'; },
      },
      {
        jokerId: 'typesettingMachine', word: 'cat', expected: [0, 2, 2],
        prepare: (tiles) => { tiles[0]!.font = 'bold'; tiles[2]!.font = 'black'; },
      },
      { jokerId: 'longFormSerial', word: 'letters', expected: [5, 6] },
      { jokerId: 'bloodTypeA', word: 'boa', expected: [1, 2] },
      {
        jokerId: 'woodblockPress', word: 'a', expected: [0],
        prepare: (tiles) => { tiles[0]!.material = 'wood'; },
      },
    ];

    for (const testCase of cases) {
      const run = newRun(`tile-trigger-${testCase.jokerId}`);
      run.jokers = [{ defId: testCase.jokerId, state: {} }];
      const hand = tilesFor(testCase.word);
      testCase.prepare?.(hand);
      const result = submitWord(
        { ...startBlind(run, makeRng(run.seed)), hand },
        run,
        makeLexicon([], { [testCase.word]: { suit: 'standard', pos: ['noun'] } }),
        hand.map((tile) => tile.id),
        makeRng(`tile-trigger-play-${testCase.jokerId}`),
      );
      const beats = result.events.filter(
        (event) => event.kind === 'joker' && event.jokerId === testCase.jokerId,
      );
      const tileBeats = beats.filter(
        (event) => event.kind === 'joker' && event.tileId !== undefined,
      );

      expect(tileBeats.map((event) => event.kind === 'joker' ? event.tileId : undefined), testCase.jokerId)
        .toEqual(testCase.expected.map((index) => hand[index]!.id));
      if (testCase.jokerId !== 'woodblockPress' && testCase.jokerId !== 'bloodTypeA') {
        expect(beats).toEqual(tileBeats);
      }
      for (const beat of tileBeats) {
        if (beat.kind !== 'joker' || !beat.tileId) continue;
        const tileBeat = result.events.findIndex(
          (event) => event.kind === 'tile' && event.tileId === beat.tileId,
        );
        expect(result.events.indexOf(beat), testCase.jokerId).toBeGreaterThan(tileBeat);
      }
      const replayed = result.events
        .filter((event) => event.kind !== 'settle')
        .reduce((score, event) => accumulate(score.chips, score.mult, event), { chips: 0, mult: 0 });
      const settled = result.events.at(-1);
      expect(settled?.kind).toBe('settle');
      if (settled?.kind === 'settle') {
        expect(replayed.chips, testCase.jokerId).toBeCloseTo(settled.chips);
        expect(replayed.mult, testCase.jokerId).toBeCloseTo(settled.mult);
      }
    }
  });

  it('resolves held-tile Emoji effects once per visible held tile', () => {
    const run = newRun('held-tile-triggers');
    run.jokers = [
      { defId: 'fullDesk', state: {} },
      { defId: 'twentyFifthBlessing', state: {} },
    ];
    const hand = tilesFor('ayb');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon([], { a: { suit: 'standard', pos: ['noun'] } }),
      [hand[0]!.id],
      makeRng('held-tile-trigger-play'),
      [hand[2]!.id, hand[1]!.id],
    );
    const fullDeskBeats = result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'fullDesk',
    );
    const blessingBeats = result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'twentyFifthBlessing',
    );

    expect(fullDeskBeats.map((event) => event.kind === 'joker' ? event.tileId : undefined))
      .toEqual([hand[2]!.id, hand[1]!.id]);
    expect(blessingBeats).toEqual([
      expect.objectContaining({ tileId: hand[1]!.id, multFactor: BALANCE.jokers.twentyFifthBlessing.factorPerHeldY }),
    ]);
  });

  it('marks Emoji Tile retrigger announcements and renders Again/다시 labels', () => {
    const run = newRun('retrigger-label');
    run.jokers = [{ defId: 'twinPeaks', state: {} }];
    const hand = tilesFor('letter');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon([], { letter: { suit: 'standard', pos: ['noun'] } }),
      hand.map((tile) => tile.id),
      makeRng('retrigger-label-play'),
    );
    const announcements = result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'twinPeaks' && event.retrigger,
    );
    const tileView = readFileSync('src/ui/components/Tile.tsx', 'utf8');
    const shelf = readFileSync('src/ui/components/JokerShelf.tsx', 'utf8');

    expect(announcements).toHaveLength(2);
    expect(tileView).toContain("t('settle.retrigger')");
    expect(shelf).toContain('settle.jokerPop?.retrigger');
  });

  it('records scaling growth as its own trigger beat', () => {
    const run = newRun('joker-growth-word-hunter');
    run.jokers = [{ defId: 'wordHunter', state: {} }];
    const hand = tilesFor('cat');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } }),
      hand.map((tile) => tile.id),
      makeRng('joker-growth'),
    );
    const growth = result.events.find((event) => event.kind === 'joker' && event.growthDelta);
    expect(growth).toMatchObject({
      jokerId: 'wordHunter',
      chipsDelta: 0,
      multDelta: 0,
      growthKind: 'mult',
    });
    expect(growth?.kind === 'joker' ? growth.growthDelta : undefined)
      .toBeCloseTo(BALANCE.jokers.wordHunter.factorPerNewWord);
  });

  it('renders symbolic values and the Applied fallback', () => {
    const effect = renderToStaticMarkup(
      <JokerPop chips={12} mult={3} multFactor={2} score={20} gold={4} applied="Applied" />,
    );
    expect(effect).toContain('chip-diamond');
    expect(effect).toContain('×2');
    expect(effect).toContain('tomato-icon');
    expect(effect).toContain('+$4');

    const chipFactor = renderToStaticMarkup(
      <JokerPop chips={60} chipsFactor={3} mult={0} applied="Applied" />,
    );
    expect(chipFactor).toContain('×3');
    expect(chipFactor).not.toContain('+60');

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

    expect(shelf.indexOf('</Tooltip>')).toBeLessThan(shelf.indexOf('{firing && (growthPop || settle.jokerPop)'));
    expect(shelf).toContain('animatedGrowthEvents');
    expect(tile).toContain('className="trigger-pop tile-effect-pop"');
    expect(tile).toContain('className="chip-diamond"');
    expect(css).toMatch(/\.trigger-pop\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.joker-pop\s*\{[^}]*top:\s*calc\(100% \+ 10px\)[^}]*triggerPopBelow/s);
    expect(css).toMatch(/\.tile-effect-pop\s*\{[^}]*bottom:\s*calc\(100% \+ 10px\)[^}]*triggerPopAbove/s);
    expect(css).toMatch(/\.hand \.tile\.trig-bounce\s*\{[^}]*jokerWiggle/s);
  });

  it('keeps the White edition filter while its Emoji Tile fires', () => {
    const css = readFileSync('src/ui/styles/play.css', 'utf8');

    expect(css).toMatch(
      /\.edition-white:not\(\.tile\)\s*\{[^}]*--emoji-edition-filter:\s*invert\(0\.88\) hue-rotate\(180deg\)/s,
    );
    expect(css).toMatch(
      /\.joker\.firing\s*\{[^}]*filter:\s*var\(--emoji-edition-filter, brightness\(1\)\) brightness\(1\.25\)/s,
    );
  });

  it('removes every edition treatment from face-down Emoji Tiles', () => {
    const shelf = readFileSync('src/ui/components/JokerShelf.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');

    expect(shelf).toContain("jokersFaceDown ? '' : `edition-${owned.edition ?? 'base'}`");
    expect(css).toMatch(/\.emoji-tile-image-only\.face-down\s*\{[^}]*box-shadow:\s*none;[^}]*filter:\s*none;/s);
  });
});

describe('register-changing Emoji Tile triggers', () => {
  const playRegister = (jokerId: string, word: string, valid: boolean) => {
    const run = newRun(`register-${jokerId}`);
    run.jokers = [{ defId: jokerId, state: {} }];
    const hand = tilesFor(word);
    const lexicon = makeLexicon(
      [],
      valid ? { [word]: { suit: 'standard', pos: ['noun'] } } : {},
    );
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      lexicon,
      hand.map((tile) => tile.id),
      makeRng(`register-${jokerId}-play`),
    );
    return { lexicon, result, run };
  };

  it('stores the final registers and emits a visible trigger beat on Play', () => {
    const dadaist = playRegister('dadaist', 'zzq', false).result;
    expect(dadaist.submission).toMatchObject({ suit: null, effectiveSuits: ['slang'] });
    expect(dadaist.events).toContainEqual(expect.objectContaining({ kind: 'joker', jokerId: 'dadaist' }));

    const tyrant = playRegister('tyrant', 'cat', true).result;
    expect(tyrant.submission).toMatchObject({ suit: 'vulgar', effectiveSuits: ['vulgar'] });
    expect(tyrant.events).toContainEqual(expect.objectContaining({ kind: 'joker', jokerId: 'tyrant' }));

    const babel = playRegister('towerOfBabel', 'cat', true).result;
    expect(babel.submission.effectiveSuits).toEqual(['standard', 'formal', 'slang', 'vulgar']);
    expect(babel.events).toContainEqual(expect.objectContaining({ kind: 'joker', jokerId: 'towerOfBabel' }));
  });

  it('renders every final register tag, including Slang on a gibberish hole', () => {
    const renderPlay = (jokerId: string, word: string, valid: boolean) => {
      const { lexicon, result, run } = playRegister(jokerId, word, valid);
      return renderToStaticMarkup(
        <I18nProvider>
          <SentenceTray
            blind={result.blind}
            judgment={judgeSentence(result.blind.sequence, lexicon)}
            lexicon={lexicon}
            patternLevels={run.patternLevels}
          />
        </I18nProvider>,
      );
    };

    expect(renderPlay('dadaist', 'zzq', false)).toContain('class="suit-tag slang">SLG');
    expect(renderPlay('tyrant', 'cat', true)).toContain('class="suit-tag vulgar">VLG');
    const babel = renderPlay('towerOfBabel', 'cat', true);
    for (const [suit, tag] of [
      ['standard', 'STD'],
      ['formal', 'FRM'],
      ['slang', 'SLG'],
      ['vulgar', 'VLG'],
    ]) expect(babel).toContain(`class="suit-tag ${suit}">${tag}`);
  });
});
