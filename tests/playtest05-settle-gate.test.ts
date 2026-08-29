import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  settleDurationMs,
  accumulate,
  playImpactDurationMs,
  playImpactFamily,
  playImpactIntensity,
  settlePresentationSnapshot,
  foldScoreTypewriterEvents,
} from '../src/ui/settle';
import type { ScoreEvent, TileMaterial } from '../src/engine/types';

/**
 * playtest-05 A: the round-clear UI is gated on the settlement-sequence completion
 * signal, never on the raw final score (recurrence of 04 A-1). The signal fires at
 * `settleDurationMs`, which must track the ACTUAL settle length — the prior bug was
 * a fixed delay that shorter than a long word's settle, so the verdict fired before
 * the count-up landed. These assert the signal timing is proportional, not fixed.
 */

const tile = (id: string): ScoreEvent => ({ kind: 'tile', tileId: id, letter: 'A', chips: 10 });
const suit = (): ScoreEvent => ({ kind: 'suit', suit: 'standard', mult: 1 });
const joker = (id: string): ScoreEvent => ({ kind: 'joker', jokerId: id, chipsDelta: 5, multDelta: 1 });
const settle = (): ScoreEvent => ({ kind: 'settle', chips: 0, mult: 0, total: 0 });

/** A submission's event log: `n` tiles + suit + `j` jokers + the settle bookkeeping frame. */
const play = (n: number, j = 0): ScoreEvent[] => [
  ...Array.from({ length: n }, (_, i) => tile(`t${i}`)),
  suit(),
  ...Array.from({ length: j }, (_, i) => joker(`j${i}`)),
  settle(),
];

describe('settleDurationMs — the clear signal tracks the settle length', () => {
  it('grows with the number of scoring beats', () => {
    const short = settleDurationMs(play(2), 1, false);
    const long = settleDurationMs(play(8, 3), 1, false);
    expect(long).toBeGreaterThan(short);
  });

  it('scales inversely with game speed', () => {
    const at1x = settleDurationMs(play(6, 2), 1, false);
    const at2x = settleDurationMs(play(6, 2), 2, false);
    expect(at2x).toBeCloseTo(at1x / 2);
  });

  it.each([[1, 600], [2, 300], [4, 150]])(
    'runs an ordinary score beat at %ix in %ims',
    (speed, duration) => {
      const oneBeat = settleDurationMs([tile('t0'), settle()], speed, false);
      expect(oneBeat - 650 / speed).toBe(duration);
    },
  );

  it('excludes the settle bookkeeping frame from the beat count', () => {
    // Same scoring beats with/without the trailing settle frame → same duration.
    const withFrame = settleDurationMs(play(4), 1, false);
    const withoutFrame = settleDurationMs(play(4).filter((e) => e.kind !== 'settle'), 1, false);
    expect(withFrame).toBe(withoutFrame);
  });

  it('reduced motion is a constant hold, independent of beat count', () => {
    expect(settleDurationMs(play(2), 1, true)).toBe(700);
    expect(settleDurationMs(play(12, 5), 4, true)).toBe(700);
  });

  it('is zero when there are no scoring beats (nothing to wait for)', () => {
    expect(settleDurationMs([settle()], 1, false)).toBe(0);
    expect(settleDurationMs([], 1, false)).toBe(0);
  });

  it('a long word outlasts the old fixed 1900ms delay (the regression)', () => {
    // The bug: a fixed ~1900ms verdict delay fired before a long settle landed.
    // A 7-tile word with 2 jokers (10 beats) settles for 6650ms at 1× — the clear
    // must now wait for THIS, not a constant that undershoots it.
    const longPlay = settleDurationMs(play(7, 2), 1, false);
    expect(longPlay).toBeGreaterThan(1900);
  });
});

describe('settle presentation snapshot', () => {
  it('keeps original speed and latched Reduced Motion through the submission', () => {
    let snapshot = settlePresentationSnapshot(
      { settleId: 0, speed: 1, reduced: false },
      7,
      2,
      false,
    );
    snapshot = settlePresentationSnapshot(snapshot, 7, 4, true);
    expect(snapshot).toEqual({ settleId: 7, speed: 2, reduced: true });

    snapshot = settlePresentationSnapshot(snapshot, 7, 4, false);
    expect(snapshot).toEqual({ settleId: 7, speed: 2, reduced: true });

    expect(settlePresentationSnapshot(snapshot, 8, 4, false)).toEqual({
      settleId: 8,
      speed: 4,
      reduced: false,
    });
  });
});

describe('reduced Score Typewriter fold', () => {
  it('keeps the strongest local beat instead of classifying the aggregate', () => {
    const folded = foldScoreTypewriterEvents([
      { kind: 'suit', suit: 'standard', mult: 1 },
      tile('a'),
      { kind: 'tile', tileId: 'b', letter: 'A', chips: 20 },
      tile('c'),
    ], 100);
    expect(folded).toEqual({ chips: 40, mult: 1, flatScore: 0, tier: 1, delta: 20 });
    expect(foldScoreTypewriterEvents([], 100)).toEqual({
      chips: 0,
      mult: 0,
      flatScore: 0,
      tier: 0,
      delta: 0,
    });
  });
});

describe('physical Play impact prologue', () => {
  it.each([
    [1, 1, 650], [2, 1, 650], [10, 1, 650], [18, 1, 650],
    [1, 2, 400], [2, 2, 400], [10, 2, 400], [18, 2, 400],
    [1, 4, 280], [2, 4, 280], [10, 4, 280], [18, 4, 280],
  ])('scales %i tiles at %ix to %ims', (tiles, speed, duration) => {
    expect(playImpactDurationMs(tiles, speed, false)).toBe(duration);
  });

  it('adds the prologue before beat zero and removes it for reduced motion', () => {
    const base = settleDurationMs(play(1), 1, false);
    expect(base).toBe(1850); // two 600ms score beats + 650ms final hold
    expect(settleDurationMs(play(1), 1, false, 1)).toBe(base + 650);
    expect(playImpactDurationMs(10, 1, true)).toBe(0);
    expect(playImpactDurationMs(0, 1, false)).toBe(0);
  });

  it.each([[1, 650], [2, 400], [4, 280]])(
    'adds fixed impact + beats + hold to the single completion source at %ix',
    (speed, impact) => {
      expect(settleDurationMs([tile('t0'), settle()], speed, false, 18)).toBe(
        impact + 600 / speed + 650 / speed,
      );
      expect(playImpactDurationMs(18, speed, true)).toBe(0);
    },
  );

  it('keeps the rigid slam duration independent of word length', () => {
    for (const speed of [1, 2, 4]) {
      expect(playImpactDurationMs(18, speed, false)).toBe(
        playImpactDurationMs(1, speed, false),
      );
    }
  });

  it.each([[1, 650], [2, 400], [4, 280]])(
    'gives a settle-only debuffed play exactly one group slam at %ix',
    (speed, duration) => {
      expect(settleDurationMs([settle()], speed, false, 10)).toBe(duration);
    },
  );

  it('caps row impact intensity at seven tiles', () => {
    expect(playImpactIntensity(0)).toBe(0);
    expect(playImpactIntensity(1)).toBe(0.6);
    expect(playImpactIntensity(2)).toBeCloseTo(0.67);
    expect(playImpactIntensity(6)).toBeCloseTo(0.95);
    expect(playImpactIntensity(7)).toBe(1);
    expect(playImpactIntensity(18)).toBe(1);
  });

  it('maps all nine materials to a local impact family', () => {
    const expected: Record<TileMaterial, ReturnType<typeof playImpactFamily>> = {
      ceramic: 'paper',
      porcelain: 'paper',
      ivory: 'paper',
      polished: 'metal',
      leadPlate: 'metal',
      brass: 'metal',
      glass: 'brittle',
      stone: 'block',
      wood: 'block',
    };
    for (const [material, family] of Object.entries(expected)) {
      expect(playImpactFamily(material as TileMaterial)).toBe(family);
    }
  });

  it('wires one rigid contact tick with no tile stagger or final-tile special case', () => {
    const settleSource = readFileSync('src/ui/settle.tsx', 'utf8');
    const stageSource = readFileSync('src/ui/components/StagePanel.tsx', 'utf8');
    const runViewSource = readFileSync('src/ui/components/RunView.tsx', 'utf8');
    const traySource = readFileSync('src/ui/components/SentenceTray.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');

    expect(traySource).toContain('<span className="submitted-tiles">');
    expect(css).toContain('.submitted-tiles.play-impact-group');
    expect(css).toContain('.submitted-tiles.play-impact-reduced');
    expect(settleSource).toContain('impactTiles.forEach(({ el, family }) => {');
    expect(settleSource).toContain('let elapsed = impactDuration;');
    expect(settleSource).toContain('timers.forEach(clearTimeout);');
    expect(settleSource).toContain('clearPlayImpactRow(impactRow);');
    expect(runViewSource).toContain('reducedMotion={settings.reducedMotion}');
    expect(settleSource).toContain('const { speed: settleSpeed, reduced: settleReduced }');
    expect(settleSource).toContain('const screenShakeRef = useRef(screenShake);');
    expect(settleSource).toContain('screenShakeRef.current = screenShake;');
    expect(settleSource).toContain('const reduce = reducedMotion || motionOff();');
    expect(settleSource).toContain('!previous.reduce &&');
    expect(settleSource).toContain('activeSettleIdRef.current === settleId');
    expect(settleSource).toContain('setReducedRestart((value) => value + 1);');
    expect(settleSource).toContain('impactContactSettleIdRef.current !== settleId');
    expect(settleSource).toContain('shakeCleanups.push(triggerScreenShake(impactIntensity));');
    expect(settleSource).toContain('shakeCleanups.forEach((cleanup) => cleanup());');
    expect(settleSource).toContain('cleanups.forEach((cleanup) => cleanup());');
    expect(settleSource).toContain('const sourceAnimation = source?.animate(');
    expect(settleSource).toContain('cleanups.push(() => sourceAnimation.cancel());');
    expect(settleSource).toContain('let landingAnimation: Animation | null = null;');
    expect(settleSource).toContain('landingAnimation = target.animate(');
    expect(settleSource).toContain('landingAnimation?.cancel();');
    expect(settleSource).toContain('if (disposed) return;');
    expect(settleSource).toContain('}, [settleId, reducedRestart]);');
    expect(settleSource).not.toContain('}, [settleId, speed, screenShake]);');
    expect(settleSource.match(/audio\.play\('submitThock'\)/g)).toHaveLength(1);
    expect(settleSource.match(/triggerScreenShake\(impactIntensity\)/g)).toHaveLength(1);
    expect(stageSource).not.toContain("audio.play('submitThock')");
    expect(`${settleSource}\n${css}`).not.toMatch(/PLAY_IMPACT_STAGGER|impact-final|play-impact-final|play-impact-compress/);
  });
});

const material = (id: string): ScoreEvent => ({
  kind: 'material',
  material: 'porcelain',
  tileId: id,
  chipsDelta: 30,
  multDelta: 0,
});

describe('settleDurationMs — material beats extend the timeline (GDD §2.2)', () => {
  it('a porcelain word settles longer than the same word in ceramic', () => {
    const ceramic = [...Array.from({ length: 3 }, (_, i) => tile(`t${i}`)), suit(), settle()];
    const porcelain = [
      tile('t0'), material('t0'),
      tile('t1'), material('t1'),
      tile('t2'), material('t2'),
      suit(), settle(),
    ];
    expect(settleDurationMs(porcelain, 1, false)).toBeGreaterThan(
      settleDurationMs(ceramic, 1, false),
    );
  });

  it('scales with speed like every other beat — never a fixed delay', () => {
    const beats = [tile('t0'), material('t0'), suit(), settle()];
    expect(settleDurationMs(beats, 1, false)).toBeGreaterThan(settleDurationMs(beats, 4, false));
  });

  it.each([1, 2, 4])('keeps Lead Plate probability results readable at %i×', (speed) => {
    const lead: ScoreEvent = {
      kind: 'material',
      material: 'leadPlate',
      tileId: 'lead',
      chipsDelta: 0,
      multDelta: 0,
      chanceResults: [{ chance: 0.5, label: 'mult', outcome: 'failure' }],
    };
    expect(settleDurationMs([lead, settle()], speed, false)).toBe(600 + 650 / speed);
    if (speed > 1) {
      expect(settleDurationMs([lead, settle()], speed, false)).toBeGreaterThan(
        settleDurationMs([material('plain'), settle()], speed, false),
      );
    }
  });
});

describe('settleDurationMs — enhanced Emoji Tile beats stay readable', () => {
  it('holds a Joker edition trigger longer than an ordinary scoring beat', () => {
    const base = [joker('j0'), settle()];
    const enhanced: ScoreEvent[] = [
      {
        kind: 'edition',
        edition: 'gray',
        jokerId: 'j0',
        chipsDelta: 20,
        multDelta: 0,
      },
      settle(),
    ];
    expect(settleDurationMs(enhanced, 1, false)).toBeGreaterThan(
      settleDurationMs(base, 1, false),
    );
  });

  it.each([[1, 1000], [2, 500], [4, 250]])(
    'scales its longer slot at %ix to %ims',
    (speed, duration) => {
      const enhanced: ScoreEvent = {
        kind: 'edition',
        edition: 'gray',
        jokerId: 'j0',
        chipsDelta: 20,
        multDelta: 0,
      };
      expect(settleDurationMs([enhanced, settle()], speed, false) - 650 / speed).toBe(duration);
    },
  );
});

describe('settleDurationMs — tile creation stays visible at high speed', () => {
  it.each([[1, 600], [2, 480], [4, 480]])(
    'holds a Counterfeit copy beat at %i× for %ims',
    (speed, duration) => {
    const copy: ScoreEvent = {
      kind: 'joker',
      jokerId: 'counterfeit',
      chipsDelta: 0,
      multDelta: 0,
      sourceTileId: 'source',
      createdTileIds: ['copy'],
    };
      expect(settleDurationMs([copy, settle()], speed, false)).toBe(duration + 650 / speed);
    },
  );
});

/**
 * The critical bug: a `material` event with a nonzero multDelta (Polished,
 * Glass, mult-rolling Lead plate) lands in the log BEFORE `suit`, because
 * those materials mutate ctx.mult in the per-tile loop that precedes the
 * `suit` push (loop.ts). If the UI folds `suit` as an OVERWRITE
 * (`mult = e.mult`) instead of an accumulation, the material's contribution
 * is wiped out the instant `suit` is folded. `accumulate` must ADD every
 * mult-bearing event, `suit` included, so folding is order-independent.
 */
describe('accumulate — the chips/mult fold shared by both settle timelines', () => {
  const materialMult = (id: string, multDelta: number): ScoreEvent => ({
    kind: 'material',
    material: 'glass',
    tileId: id,
    chipsDelta: 0,
    multDelta,
  });

  it('a material multDelta preceding suit is NOT wiped out by the suit fold', () => {
    // Engine order for a Glass tile: tile, material(+1 multDelta, i.e. the
    // ctx.mult ×2 step captured as a delta around the suit-inclusive base),
    // suit, settle. UI starts at mult=0, so folding must land at 1 (material)
    // + 1 (suit) = 2 — matching the engine's post-suit ctx.mult of 2.0.
    const events: ScoreEvent[] = [
      tile('t0'),
      materialMult('t0', 1),
      suit(),
      settle(),
    ];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(mult).toBe(2);
  });

  it('a ceramic word (no material beats) still lands mult=1 from suit alone', () => {
    const events: ScoreEvent[] = [tile('t0'), suit(), settle()];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(chips).toBe(10);
    expect(mult).toBe(1);
  });

  it('tile chips accumulate additively regardless of material/suit folding', () => {
    const events: ScoreEvent[] = [
      tile('t0'),
      materialMult('t0', 1),
      suit(),
      settle(),
    ];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(chips).toBe(10);
  });
});
