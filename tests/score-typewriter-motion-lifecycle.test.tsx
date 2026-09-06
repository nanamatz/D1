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

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  scoreTypewriterKey: vi.fn(),
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
import { BALANCE } from '../src/engine/balance';
import {
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterKeySequence,
  scoreTypewriterKeyTiming,
} from '../src/ui/scoreTypewriter';

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
type PresentationTreeLayer = {
  props?: {
    className?: string;
    style?: Record<string, string>;
    'data-presentation-beat-id'?: unknown;
  };
};

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
    runEffects(false);
    if (!hooks.dirty) {
      if (tree === null) throw new Error('ScoreTypewriter unexpectedly rendered null');
      return tree;
    }
  }
  throw new Error('ScoreTypewriter hook harness did not settle');
}

function presentationLayers(
  tree: NonNullable<ReturnType<typeof ScoreTypewriter>>,
): PresentationTreeLayer[] {
  const children = Array.isArray(tree.props.children)
    ? tree.props.children
    : [tree.props.children];
  return children as PresentationTreeLayer[];
}

function presentationBeatIds(
  tree: NonNullable<ReturnType<typeof ScoreTypewriter>>,
): string[] {
  return presentationLayers(tree)
    .map((child) => child.props?.['data-presentation-beat-id'])
    .filter((id): id is string => typeof id === 'string');
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
    audio.scoreTypewriterKey.mockReset();
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
      screenshake: 100,
      reducedMotion: false,
      resolutionActive: true,
    } satisfies Partial<Props>;

    const active = renderUntilStable({
      ...common,
      active: true,
      tier: 6,
      beatId: 'score-7-15',
      holdActive: false,
    } as Props);
    expect(presentationLayers(active)[0]?.props?.className).toContain('typewriter-tier-6');
    expect(active.props.className).not.toContain('typewriter-tier-6');
    expect(active.props.className).toContain('is-active');
    const repeating = renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      holdActive: true,
    } as Props);
    expect(repeating.props.className).toContain('is-clear-cycle');
    expect(repeating.props.className).toContain('typewriter-tier-6');
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
    expect(reduced.props['data-tier']).toBe(6);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(audio.scoreTypewriterKey).not.toHaveBeenCalled();

    unmount();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(query.listeners.size).toBe(0);
  });

  it('plays the actual visible keys in each audible slot and accents only a clear-cycle Enter', () => {
    const beatId = 'score-audible-slots';
    const tier = 3;
    const primaryKeyId = 'KeyQ';
    renderUntilStable({
      active: true,
      tier,
      beatId,
      primaryKeyId,
      liveTotal: 10,
      target: 1_000,
      blindKey: '1-0',
      settleId: 8,
      resolutionActive: true,
      holdActive: false,
      screenshake: 0,
      reducedMotion: false,
    });

    vi.runAllTimers();
    const visualCount = BALANCE.scoreTypewriter.visualKeyCounts[tier];
    const audibleCount = BALANCE.scoreTypewriter.audibleKeyCounts[tier];
    const sequence = scoreTypewriterKeySequence(beatId, visualCount, primaryKeyId);
    const expected = Array.from({ length: audibleCount }, (_, index) => {
      const pressIndex = Math.floor(index * visualCount / audibleCount);
      return SCORE_TYPEWRITER_KEYCAPS[sequence[pressIndex]!]!.id;
    });
    expect(audio.scoreTypewriterKey.mock.calls).toEqual(expected.map((keyId) => [keyId]));

    audio.scoreTypewriterKey.mockClear();
    renderUntilStable({
      active: false,
      tier: 0,
      beatId: 'score-idle',
      primaryKeyId: 'Enter',
      liveTotal: 1_000,
      target: 100,
      blindKey: '1-0',
      settleId: 8,
      resolutionActive: true,
      holdActive: true,
      screenshake: 0,
      reducedMotion: false,
    });
    vi.advanceTimersByTime(0);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledWith('Enter', true);
  });

  it('lets an earlier fixed keyboard beat finish after a replacement arrives at 4x cadence', () => {
    const common = {
      primaryKeyId: 'KeyQ',
      liveTotal: 10,
      target: 1_000,
      blindKey: '1-0',
      settleId: 8,
      resolutionActive: false,
      holdActive: false,
      screenshake: 0,
      reducedMotion: false,
    } satisfies Partial<Props>;
    const firstBeatId = 'score-fast-first';
    const secondBeatId = 'score-fast-second';
    const firstTier = 6;

    renderUntilStable({
      ...common,
      active: true,
      tier: firstTier,
      beatId: firstBeatId,
    } as Props);
    vi.advanceTimersByTime(150);

    const visualCount = BALANCE.scoreTypewriter.visualKeyCounts[firstTier];
    const remainingFirstAudio = Array.from(
      { length: BALANCE.scoreTypewriter.audibleKeyCounts[firstTier] },
      (_, index) => Math.floor(index * visualCount
        / BALANCE.scoreTypewriter.audibleKeyCounts[firstTier]),
    ).filter((pressIndex) => scoreTypewriterKeyTiming(
      firstBeatId,
      firstTier,
      pressIndex,
      visualCount,
    ).delayMs > 150).length;
    expect(remainingFirstAudio).toBeGreaterThan(0);

    const overlapped = renderUntilStable({
      ...common,
      active: true,
      tier: 1,
      beatId: secondBeatId,
    } as Props);
    expect(presentationBeatIds(overlapped)).toEqual([firstBeatId, secondBeatId]);

    vi.advanceTimersByTime(0);
    audio.scoreTypewriterKey.mockClear();
    vi.advanceTimersByTime(310);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledTimes(remainingFirstAudio);

    const firstFinished = renderUntilStable({
      ...common,
      active: true,
      tier: 1,
      beatId: secondBeatId,
    } as Props);
    expect(presentationBeatIds(firstFinished)).toEqual([secondBeatId]);

    vi.advanceTimersByTime(150);
    const allFinished = renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-idle',
    } as Props);
    expect(presentationBeatIds(allFinished)).toEqual([]);
  });

  it('keeps Tier 1 visuals and shake local when a Tier 6 beat overlaps it', () => {
    const common = {
      primaryKeyId: 'KeyQ',
      liveTotal: 10,
      target: 1_000,
      blindKey: 'tier-overlap',
      settleId: 11,
      resolutionActive: false,
      holdActive: false,
      screenshake: 100,
      reducedMotion: false,
    } satisfies Partial<Props>;

    renderUntilStable({
      ...common,
      active: true,
      tier: 1,
      beatId: 'tier-1-first',
    } as Props);
    vi.advanceTimersByTime(150);
    const overlapped = renderUntilStable({
      ...common,
      active: true,
      tier: 6,
      beatId: 'tier-6-second',
    } as Props);
    const layers = presentationLayers(overlapped);

    expect(presentationBeatIds(overlapped)).toEqual(['tier-1-first', 'tier-6-second']);
    expect(layers[0]?.props?.className).toContain('typewriter-tier-1');
    expect(layers[0]?.props?.className).not.toContain('typewriter-tier-6');
    expect(layers[0]?.props?.style?.['--typewriter-shake'])
      .toBe(String(BALANCE.scoreTypewriter.shakeFactors[1]));
    expect(layers[1]?.props?.className).toContain('typewriter-tier-6');
    expect(layers[1]?.props?.style?.['--typewriter-shake'])
      .toBe(String(BALANCE.scoreTypewriter.shakeFactors[6]));
    expect(overlapped.props.className).not.toContain('typewriter-tier-6');
  });

  it('keeps one clear scheduler across cashout entry and cancels it on Collect', () => {
    const common = {
      primaryKeyId: 'Enter',
      liveTotal: 1_000,
      target: 100,
      blindKey: '1-0',
      settleId: 9,
      screenshake: 0,
      reducedMotion: false,
      resolutionActive: true,
    } satisfies Partial<Props>;

    renderUntilStable({
      ...common,
      active: true,
      tier: 3,
      beatId: 'score-9-4',
      holdActive: false,
    } as Props);
    renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      holdActive: true,
    } as Props);
    vi.advanceTimersByTime(0);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledTimes(2);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledWith('Enter', true);
    const callsAtCashout = audio.scoreTypewriterKey.mock.calls.length;

    // Playing -> live Fee Settlement keeps the same props that own the scheduler.
    renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      holdActive: true,
    } as Props);
    vi.advanceTimersByTime(0);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledTimes(callsAtCashout);

    // Collect -> Shop drops resolutionActive and synchronously clears future work.
    renderUntilStable({
      ...common,
      active: false,
      tier: 0,
      beatId: 'score-0',
      resolutionActive: false,
      holdActive: false,
    } as Props);
    vi.advanceTimersByTime(10_000);
    expect(audio.scoreTypewriterKey).toHaveBeenCalledTimes(callsAtCashout);
  });

  it('does not fire a target cue for a transient pre-boss crossing rejected by the engine', () => {
    const common = {
      active: false,
      tier: 0,
      beatId: 'will-transient',
      primaryKeyId: 'Enter',
      target: 100,
      targetCueEnabled: false,
      blindKey: 'will-1',
      settleId: 1,
      resolutionActive: false,
      holdActive: false,
      screenshake: 0,
      reducedMotion: false,
    } satisfies Omit<Props, 'liveTotal'>;

    renderUntilStable({ ...common, liveTotal: 90 });
    renderUntilStable({ ...common, liveTotal: 110 });
    vi.runAllTimers();

    expect(audio.scoreTypewriterKey).not.toHaveBeenCalledWith('Enter', true);
  });
});
