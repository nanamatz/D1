import { describe, it, expect, beforeEach } from 'vitest';
import { serializeRun, writeRun, loadRun, clearRun } from '../src/ui/persist';
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
    seed: 'seed-1',
    rngCounter: 3,
    run: { ante: 2, blindIndex: 1, gold: 7, jokers: [{ defId: 'j1', state: {} }] },
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
    expect(saved.hint).toBeNull();
    expect(saved.message).toBeNull();
    expect(saved.lastPlayed).toBeNull();
    // Nothing left to animate, so the finalize effects are free to run on load.
    expect(saved.settleComplete).toBe(true);
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
    expect(back!.rngCounter).toBe(3);
    expect(back!.run.gold).toBe(7);
    expect(back!.run.ante).toBe(2);
    expect(back!.run.jokers).toEqual([{ defId: 'j1', state: {} }]);
    expect(back!.blind.committedScore).toBe(120);
    expect(back!.stats.wordsPlayed).toBe(4);
    expect(back!.runStarted).toBe(true);
  });

  it('returns null when there is no save', () => {
    expect(loadRun()).toBeNull();
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
