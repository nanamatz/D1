import { describe, it, expect, beforeEach } from 'vitest';
import { serializeRun, writeRun, loadRun, clearRun } from '../src/ui/persist';
import { newRun } from '../src/engine/run';
import { createOwnedJoker } from '../src/engine/jokers';
import type { GameState } from '../src/ui/useGame';

/**
 * playtest-06: the run persists across a reload so the New Run screen's Continue
 * tab can resume it. Two properties matter and are easy to regress:
 *   1. a save is a RESTING snapshot — no half-finished settle animation is stored,
 *      because the settle replays from a per-submission log that can't be resumed;
 *   2. a bad save never bricks the boot — it's discarded for a fresh run instead.
 */

// persist.ts is pure + localStorage (GameState is an `import type`, erased at
// runtime), so a plain Map-backed stub is enough to exercise it headlessly.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

/** A run caught mid-settle, with every transient field dirty. */
const dirty = (): GameState =>
  ({
    observationId: 'observation-1',
    seed: 'seed-1',
    rngCounter: 3,
    run: {
      ante: 2,
      blindIndex: 1,
      gold: 7,
      jokers: [
        { defId: 'ceramicArtisan', state: {} },
        { defId: 'foldingManuscript', state: { handSize: 0, destroyed: 1 } },
      ],
    },
    blind: { kind: 'big', hand: [{ id: 't1' }], committedScore: 120 },
    phase: 'playing',
    stats: { wordsPlayed: 4 },
    shop: null,
    pack: null,
    cashout: null,
    pendingRun: null,
    gameover: null,
    runStarted: true,
    // transient / animation-only — all of these must be scrubbed
    selected: ['t1', 't2'],
    message: { key: 'boss.blocked' },
    hint: [{ word: 'cat' }],
    lastPlayed: { text: 'cat', isGibberish: false },
    lastEvents: [{ kind: 'tile', tileId: 't1', letter: 'C', chips: 3 }],
    settleId: 9,
    committedBefore: 80,
    settleComplete: false,
    finalScore: 175,
    sentenceBonus: {
      chips: 90,
      mult: 3,
      pattern: 'transitive',
      level: 1,
      modifierCount: 0,
      modifierChips: 0,
      unisonSuit: 'standard',
      unisonChips: 50,
      unisonMult: 1,
      effectChips: 0,
      effectMult: 1,
      pouchId: null,
      pouchChipsDelta: 0,
      pouchMultDelta: 0,
    },
    pendingEnd: true,
  }) as unknown as GameState;

beforeEach(() => store.clear());

describe('run persistence', () => {
  it('saves a resting snapshot — no in-flight settle animation', () => {
    const saved = JSON.parse(serializeRun(dirty())).state as GameState;
    expect(saved.settleId).toBe(0);
    expect(saved.lastEvents).toEqual([]);
    expect(saved.committedBefore).toBe(0);
    expect(saved.selected).toEqual([]);
    expect(saved.finalScore).toBeNull();
    expect(saved.sentenceBonus).toBeNull();
    expect(saved.hint).toBeNull();
    expect(saved.message).toBeNull();
    expect(saved.lastPlayed).toBeNull();
    // Nothing left to animate, so the finalize effects are free to run on load.
    expect(saved.settleComplete).toBe(true);
    expect(saved.run.jokers).toEqual([{ defId: 'ceramicArtisan', instanceId: 1, state: {} }]);
  });

  it('keeps pendingEnd so a blind caught mid-resolution still resolves on load', () => {
    const saved = JSON.parse(serializeRun(dirty())).state as GameState;
    expect(saved.pendingEnd).toBe(true);
  });

  it('round-trips the run itself (progress, gold, jokers, stats, runStarted)', () => {
    writeRun(serializeRun(dirty()));
    const back = loadRun();
    expect(back).not.toBeNull();
    expect(back!.seed).toBe('seed-1');
    expect(back!.observationId).toBe('observation-1');
    expect(back!.rngCounter).toBe(3);
    expect(back!.run.gold).toBe(7);
    expect(back!.run.ante).toBe(2);
    expect(back!.run.jokers).toEqual([{ defId: 'ceramicArtisan', instanceId: 1, state: {} }]);
    expect(back!.blind.committedScore).toBe(120);
    expect(back!.stats.wordsPlayed).toBe(4);
    expect(back!.runStarted).toBe(true);
  });

  it('round-trips newly grown revised scalers without legacy reconversion', () => {
    const state = dirty();
    const run = newRun('revision-scaler-save');
    run.jokers = [
      createOwnedJoker(run, 'misbound'),
      { ...createOwnedJoker(run, 'serial'), instanceId: 2 },
      { ...createOwnedJoker(run, 'biochemistry'), instanceId: 3 },
    ];
    run.jokers[0]!.state.factor = 2;
    run.jokers[1]!.state.chips = 20;
    run.jokers[2]!.state.factor = 1.5;
    state.run = run;
    writeRun(serializeRun(state));
    const back = loadRun()!;
    expect(back.run.jokers.map((joker) => joker.state)).toMatchObject([
      { factor: 2, revision20260826: 1 },
      { chips: 20, revision20260826: 1 },
      { factor: 1.5, revision20260826: 1 },
    ]);
  });

  it('defensively fills additive observation fields missing from a version-12 save', () => {
    const env = JSON.parse(serializeRun(dirty()));
    delete env.state.observationId;
    delete env.state.stats.jokerBlindCounts;
    writeRun(JSON.stringify(env));
    const back = loadRun();
    expect(back?.observationId).toMatch(/^([0-9a-f-]{36}|run-)/);
    expect(back?.stats).toMatchObject({ wordsPlayed: 4, jokerBlindCounts: {} });
    expect(back?.run.challengeId).toBeNull();
  });

  it('sanitizes and bounds the persisted unlock ledger at the load boundary', () => {
    const env = JSON.parse(serializeRun(dirty()));
    env.state.runUnlocks = [
      null,
      {},
      'RED',
      'baseline:emoji:miser',
      'pending:record:yellow:redLp',
      'recap-ready',
      'pending:emoji:not-real',
      'emoji:miser:extra',
      'x'.repeat(129),
      ...Array.from({ length: 600 }, () => 'pending:voucher:novel'),
    ];
    writeRun(JSON.stringify(env));
    expect(loadRun()?.runUnlocks).toEqual([
      'RED',
      'baseline:emoji:miser',
      'pending:record:yellow:redLp',
      'recap-ready',
      'pending:voucher:novel',
    ]);

    for (const malformed of [null, {}, [null], [{}]]) {
      env.state.runUnlocks = malformed;
      writeRun(JSON.stringify(env));
      expect(loadRun()?.runUnlocks).toEqual([]);
    }
  });

  it('round-trips a valid Challenge preset and rejects invalid Challenge saves', () => {
    const env = JSON.parse(serializeRun(dirty()));
    env.state.run = newRun('challenge-save', { challengeId: 'redPen' });
    writeRun(JSON.stringify(env));
    expect(loadRun()?.run.challengeId).toBe('redPen');

    env.state.run.challengeId = 'retiredChallenge';
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();

    env.state.run.challengeId = 'redPen';
    env.state.run.customSeed = true;
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();

    env.state.run = newRun('challenge-save', { challengeId: 'redPen' });
    env.state.run.recordId = 'whiteLp';
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();

    env.state.run = newRun('challenge-save', { challengeId: 'redPen' });
    env.state.pendingRun = newRun('challenge-pending', { challengeId: 'risingQuota' });
    env.state.pendingRun.pouchId = 'yellow';
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();
  });

  it('discards version-11 runs so pre-observation Game Over cannot double-count', () => {
    const env = JSON.parse(serializeRun(dirty()));
    env.version = 11;
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();
  });

  it('returns null when there is no save', () => {
    expect(loadRun()).toBeNull();
  });

  it('drops retired Emoji Tiles from an older resting save', () => {
    const env = JSON.parse(serializeRun(dirty()));
    env.state.run.jokers.push({ defId: 'uppercasePremium', state: {} });
    writeRun(JSON.stringify(env));
    expect(loadRun()!.run.jokers).toEqual([
      { defId: 'ceramicArtisan', instanceId: 1, state: {} },
    ]);
  });

  it('discards a save from a different schema version rather than half-loading it', () => {
    const env = JSON.parse(serializeRun(dirty()));
    env.version = 999;
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();
  });

  it('discards corrupt or truncated saves instead of bricking the boot', () => {
    for (const junk of ['', '{', 'null', '[]', '{"version":1}', '{"version":1,"state":{}}']) {
      store.clear();
      writeRun(junk);
      expect(loadRun()).toBeNull();
    }
  });

  it('discards a save whose run/blind shape is wrong', () => {
    const env = JSON.parse(serializeRun(dirty()));
    delete env.state.blind.hand; // e.g. an older/incompatible blind shape
    writeRun(JSON.stringify(env));
    expect(loadRun()).toBeNull();
  });

  it('clearRun removes the save', () => {
    writeRun(serializeRun(dirty()));
    expect(loadRun()).not.toBeNull();
    clearRun();
    expect(loadRun()).toBeNull();
  });
});
