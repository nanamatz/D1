import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Effect = () => void | (() => void);
type PendingEffect = { index: number; effect: Effect; layout: boolean };

const hooks = vi.hoisted(() => ({
  cursor: 0,
  values: [] as unknown[],
  deps: [] as (readonly unknown[] | undefined)[],
  cleanups: [] as (((() => void) | undefined))[],
  subscriptions: [] as (((() => void) | undefined))[],
  pending: [] as PendingEffect[],
  dirty: false,
}));

const audio = vi.hoisted(() => ({ play: vi.fn() }));

function depsChanged(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  return !previous || !next || previous.length !== next.length
    || previous.some((value, index) => !Object.is(value, next[index]));
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const effectHook = (layout: boolean) => (effect: Effect, deps?: readonly unknown[]) => {
    const index = hooks.cursor++;
    if (!depsChanged(hooks.deps[index], deps)) return;
    hooks.deps[index] = deps;
    hooks.pending.push({ index, effect, layout });
  };
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
    useMemo<T>(factory: () => T, deps?: readonly unknown[]) {
      const index = hooks.cursor++;
      if (depsChanged(hooks.deps[index], deps)) {
        hooks.deps[index] = deps;
        hooks.values[index] = factory();
      }
      return hooks.values[index] as T;
    },
    useEffect: effectHook(false),
    useLayoutEffect: effectHook(true),
    useSyncExternalStore(
      subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => boolean,
    ) {
      const index = hooks.cursor++;
      if (!hooks.subscriptions[index]) {
        hooks.subscriptions[index] = subscribe(() => { hooks.dirty = true; });
      }
      return getSnapshot();
    },
  };
});

vi.mock('react-dom', () => ({ createPortal: (children: unknown) => children }));
vi.mock('../src/ui/audio', () => ({ audio }));

import { ScoreTypewriter } from '../src/ui/components/ScoreTypewriter';

class FakeMediaQueryList {
  matches = false;
  readonly listeners = new Set<() => void>();
  addEventListener = vi.fn((_type: string, listener: () => void) => this.listeners.add(listener));
  removeEventListener = vi.fn((_type: string, listener: () => void) => this.listeners.delete(listener));
  addListener = vi.fn((listener: () => void) => this.listeners.add(listener));
  removeListener = vi.fn((listener: () => void) => this.listeners.delete(listener));

  setMatches(matches: boolean): void {
    this.matches = matches;
    for (const listener of [...this.listeners]) listener();
  }
}

const query = new FakeMediaQueryList();
type Props = Parameters<typeof ScoreTypewriter>[0];

function runEffects(layout: boolean): void {
  const selected = hooks.pending.filter((item) => item.layout === layout);
  hooks.pending = hooks.pending.filter((item) => item.layout !== layout);
  for (const { index, effect } of selected) {
    hooks.cleanups[index]?.();
    hooks.cleanups[index] = effect() ?? undefined;
  }
}

function renderUntilStable(props: Props): NonNullable<ReturnType<typeof ScoreTypewriter>> {
  let tree!: ReturnType<typeof ScoreTypewriter>;
  for (let count = 0; count < 12; count += 1) {
    hooks.cursor = 0;
    hooks.pending = [];
    hooks.dirty = false;
    tree = ScoreTypewriter(props);
    runEffects(true);
    if (hooks.dirty) continue;
    runEffects(false);
    if (!hooks.dirty) {
      if (tree === null) throw new Error('ScoreTypewriter unexpectedly rendered null');
      return tree;
    }
  }
  throw new Error('ScoreTypewriter hook harness did not settle');
}

function unmount(): void {
  hooks.cleanups.forEach((cleanup) => cleanup?.());
  hooks.subscriptions.forEach((unsubscribe) => unsubscribe?.());
  hooks.cleanups = [];
  hooks.subscriptions = [];
}

describe('Score Keyboard OS Reduced Motion lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hooks.cursor = 0;
    hooks.values = [];
    hooks.deps = [];
    hooks.cleanups = [];
    hooks.subscriptions = [];
    hooks.pending = [];
    hooks.dirty = false;
    audio.play.mockReset();
    query.matches = false;
    query.listeners.clear();
    query.addEventListener.mockClear();
    query.removeEventListener.mockClear();
    vi.stubGlobal('window', { matchMedia: () => query });
    vi.stubGlobal('document', {
      body: { classList: { contains: () => false } },
    });
  });

  afterEach(() => {
    unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cancels an active clear cycle and its audio when the OS turns Reduced Motion on', () => {
    const common = {
      primaryKeyId: 'Enter',
      liveTotal: 1_000,
      target: 100,
      blindKey: '1-0',
      settleId: 7,
      gameSpeed: 1,
      screenshake: 100,
      reducedMotion: false,
      resolutionActive: true,
    } satisfies Partial<Props>;

    const active = renderUntilStable({
      ...common,
      active: true,
      tier: 5,
      beatId: 'score-7-15',
      holdActive: false,
    } as Props);
    expect(active.props.className).toContain('typewriter-tier-5');
    expect(active.props.className).toContain('is-active');
    const repeating = renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      holdActive: true,
    } as Props);
    expect(repeating.props.className).toContain('is-clear-cycle');
    expect(repeating.props.className).toContain('typewriter-tier-5');
    expect(repeating.props.className).toContain('is-active');
    expect(query.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    query.setMatches(true);
    expect(hooks.dirty).toBe(true);
    const reduced = renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      holdActive: true,
    } as Props);

    expect(reduced.props.className).toContain('is-clear-held');
    expect(reduced.props.className).toContain('is-reduced');
    expect(reduced.props.className).not.toContain('is-clear-cycle');
    expect(reduced.props['data-tier']).toBe(5);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(audio.play).not.toHaveBeenCalled();

    unmount();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(query.listeners.size).toBe(0);
  });
});
