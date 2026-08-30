import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Effect = () => void | (() => void);

const hooks = vi.hoisted(() => ({
  cursor: 0,
  values: [] as unknown[],
  deps: [] as (readonly unknown[] | undefined)[],
  cleanups: [] as (((() => void) | undefined))[],
  pending: [] as Array<{ index: number; effect: Effect }>,
  dirty: false,
}));

function depsChanged(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  return !previous || !next || previous.length !== next.length
    || previous.some((value, index) => !Object.is(value, next[index]));
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef<T>(initial: T) {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = { current: initial };
      return hooks.values[index] as { current: T };
    },
    useState<T>(initial: T) {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = initial;
      const setValue = (next: T | ((current: T) => T)) => {
        const current = hooks.values[index] as T;
        const value = typeof next === 'function'
          ? (next as (item: T) => T)(current)
          : next;
        if (Object.is(current, value)) return;
        hooks.values[index] = value;
        hooks.dirty = true;
      };
      return [hooks.values[index] as T, setValue] as const;
    },
    useLayoutEffect(effect: Effect, deps?: readonly unknown[]) {
      const index = hooks.cursor++;
      if (!depsChanged(hooks.deps[index], deps)) return;
      hooks.deps[index] = deps;
      hooks.pending.push({ index, effect });
    },
  };
});

import { useFinalPatternNotice } from '../src/ui/useFinalPatternNotice';

type Source = Parameters<typeof useFinalPatternNotice>[1];

function renderUntilStable(phase: string, source: Source) {
  let notice!: ReturnType<typeof useFinalPatternNotice>;
  for (let count = 0; count < 8; count += 1) {
    hooks.cursor = 0;
    hooks.pending = [];
    hooks.dirty = false;
    notice = useFinalPatternNotice(phase, source, 1_700);
    for (const { index, effect } of hooks.pending) {
      hooks.cleanups[index]?.();
      hooks.cleanups[index] = effect() ?? undefined;
    }
    if (!hooks.dirty) return notice;
  }
  throw new Error('Final pattern notice hook harness did not settle');
}

describe('final pattern notice lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hooks.cursor = 0;
    hooks.values = [];
    hooks.deps = [];
    hooks.cleanups = [];
    hooks.pending = [];
    hooks.dirty = false;
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  });

  afterEach(() => {
    hooks.cleanups.forEach((cleanup) => cleanup?.());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears a Reduced-Motion cashout notice when Collect opens Shop before 1.7s', () => {
    const finalized = { pattern: 'simple', level: 3 } as const;

    expect(renderUntilStable('playing', finalized)).toEqual({
      id: 1,
      pattern: 'simple',
      level: 3,
    });
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(200);
    expect(renderUntilStable('cashout', finalized)).toEqual({
      id: 1,
      pattern: 'simple',
      level: 3,
    });
    expect(vi.getTimerCount()).toBe(1);

    expect(renderUntilStable('shop', null)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1_500);
    expect(renderUntilStable('shop', null)).toBeNull();
  });

  it('keeps the one-shot notice through cashout until the original 1.7s expires', () => {
    const finalized = { pattern: 'simple', level: 3 } as const;

    expect(renderUntilStable('playing', finalized)?.id).toBe(1);
    vi.advanceTimersByTime(200);
    expect(renderUntilStable('cashout', finalized)?.id).toBe(1);
    vi.advanceTimersByTime(1_499);
    expect(renderUntilStable('cashout', finalized)?.id).toBe(1);
    vi.advanceTimersByTime(1);
    expect(renderUntilStable('cashout', finalized)).toBeNull();
  });

  it('never announces a finalized Unison-only snapshot', () => {
    expect(renderUntilStable('playing', { pattern: null, level: null })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
