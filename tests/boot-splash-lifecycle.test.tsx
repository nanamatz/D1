import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Effect = () => void | (() => void);
type PendingEffect = { index: number; effect: Effect };

const hooks = vi.hoisted(() => ({
  cursor: 0,
  values: [] as unknown[],
  deps: [] as (readonly unknown[] | undefined)[],
  effects: [] as (Effect | undefined)[],
  cleanups: [] as (((() => void) | undefined))[],
  pending: [] as PendingEffect[],
  motionOff: false,
}));

const startupAudio = vi.hoisted(() => ({
  dispose: vi.fn(),
  play: vi.fn(),
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
      if (!hooks.values[index]) hooks.values[index] = { current: initial };
      return hooks.values[index] as { current: T };
    },
    useState<T>(initial: T) {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = initial;
      const setValue = (next: T | ((current: T) => T)) => {
        const current = hooks.values[index] as T;
        hooks.values[index] = typeof next === 'function'
          ? (next as (value: T) => T)(current)
          : next;
      };
      return [hooks.values[index] as T, setValue] as const;
    },
    useEffect(effect: Effect, deps?: readonly unknown[]) {
      const index = hooks.cursor++;
      hooks.effects[index] = effect;
      if (depsChanged(hooks.deps[index], deps)) {
        hooks.deps[index] = deps;
        hooks.pending.push({ index, effect });
      }
    },
  };
});

vi.mock('../src/ui/motion', () => ({
  motionOff: () => hooks.motionOff,
}));

vi.mock('../src/ui/unlocks', () => ({
  activeUnlocks: () => new Set<string>(),
  UNLOCKS: [],
}));

vi.mock('../src/ui/startupAudio', () => ({
  playStartupIdentAudio: startupAudio.play,
}));

vi.mock('../src/ui/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key === 'startup.identContinue'
      ? 'Sweet Turtles — Press any key or click to continue'
      : key,
  }),
}));

import { DeveloperSplash } from '../src/ui/components/DeveloperSplash';

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  decode = vi.fn<() => Promise<void>>(() => Promise.resolve());

  constructor() {
    FakeImage.instances.push(this);
  }
}

type SplashProps = Parameters<typeof DeveloperSplash>[0];

function renderSplash(props: SplashProps): ReturnType<typeof DeveloperSplash> {
  hooks.cursor = 0;
  hooks.pending = [];
  const tree = DeveloperSplash(props);
  for (const { index, effect } of hooks.pending) {
    hooks.cleanups[index]?.();
    hooks.cleanups[index] = effect() ?? undefined;
  }
  return tree;
}

function unmountSplash(): void {
  for (const cleanup of hooks.cleanups) cleanup?.();
  hooks.cleanups = [];
}

function replayMountEffects(): void {
  for (let index = 0; index < hooks.effects.length; index += 1) {
    const effect = hooks.effects[index];
    if (!effect) continue;
    hooks.cleanups[index]?.();
    hooks.cleanups[index] = effect() ?? undefined;
  }
}

async function loadReady(): Promise<void> {
  const image = FakeImage.instances.at(-1);
  expect(image).toBeDefined();
  image!.onload?.();
  await Promise.resolve();
}

describe('Sweet Turtles splash lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hooks.cursor = 0;
    hooks.values = [];
    hooks.deps = [];
    hooks.effects = [];
    hooks.cleanups = [];
    hooks.pending = [];
    hooks.motionOff = false;
    startupAudio.dispose.mockReset();
    startupAudio.play.mockReset();
    startupAudio.play.mockReturnValue(startupAudio.dispose);
    FakeImage.instances = [];
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('window', {
      setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
      clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    });
  });

  afterEach(() => {
    unmountSplash();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for decode, then completes once after the normal beat', async () => {
    const onDone = vi.fn();
    let tree = renderSplash({ onDone, reducedMotion: false });
    expect(tree.props['aria-busy']).toBe(true);
    expect(tree.props.role).toBe('button');
    expect(tree.props.tabIndex).toBe(0);
    expect(tree.props.autoFocus).toBe(true);
    expect(tree.props['aria-disabled']).toBe(true);
    expect(tree.props['aria-label']).toBe('Sweet Turtles — Press any key or click to continue');
    expect(tree.props.children).toBe(false);
    expect(JSON.stringify(tree)).not.toContain('developer-splash__logo-frame');

    vi.advanceTimersByTime(1_800);
    expect(onDone).not.toHaveBeenCalled();
    await loadReady();
    tree = renderSplash({ onDone, reducedMotion: false });
    expect(tree.props['aria-busy']).toBe(false);
    expect(tree.props['aria-disabled']).toBe(false);

    vi.advanceTimersByTime(0);
    expect(startupAudio.play).toHaveBeenCalledOnce();
    expect(startupAudio.play).toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(3_849);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ignores and consumes preparing input, then finishes once from any ordinary key', async () => {
    const onDone = vi.fn();
    let tree = renderSplash({ onDone, reducedMotion: false });
    const preparingKey = {
      key: 'Escape', repeat: false, nativeEvent: { isComposing: false },
      ctrlKey: false, altKey: false, metaKey: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    tree.props.onKeyDown(preparingKey);
    tree.props.onPointerDown({
      isPrimary: true, button: 0,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    tree.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(preparingKey.preventDefault).toHaveBeenCalledOnce();
    expect(preparingKey.stopPropagation).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();

    await loadReady();
    tree = renderSplash({ onDone, reducedMotion: false });
    const readyKey = {
      key: 'ArrowRight', repeat: false, nativeEvent: { isComposing: false },
      ctrlKey: false, altKey: false, metaKey: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    tree.props.onKeyDown({ ...readyKey, repeat: true });
    tree.props.onKeyDown({ ...readyKey, nativeEvent: { isComposing: true } });
    expect(onDone).not.toHaveBeenCalled();
    tree.props.onKeyDown(readyKey);
    tree.props.onKeyDown({ ...readyKey, key: 'a' });
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(['Escape', 'a', 'ArrowRight', 'Enter', ' '])(
    'finishes once from the ordinary %j key',
    async (key) => {
      const onDone = vi.fn();
      renderSplash({ onDone, reducedMotion: false });
      await loadReady();
      const tree = renderSplash({ onDone, reducedMotion: false });
      const event = {
        key, repeat: false, nativeEvent: { isComposing: false },
        ctrlKey: false, altKey: false, metaKey: false,
        preventDefault: vi.fn(), stopPropagation: vi.fn(),
      };

      tree.props.onKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
      expect(onDone).toHaveBeenCalledOnce();
    },
  );

  it('cancels a queued ident cue when input finishes before its zero-delay start', async () => {
    const onDone = vi.fn();
    renderSplash({ onDone, reducedMotion: false });
    await loadReady();
    const tree = renderSplash({ onDone, reducedMotion: false });
    tree.props.onKeyDown({
      key: 'Escape', repeat: false, nativeEvent: { isComposing: false },
      ctrlKey: false, altKey: false, metaKey: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    unmountSplash();
    vi.advanceTimersByTime(0);
    expect(onDone).toHaveBeenCalledOnce();
    expect(startupAudio.play).not.toHaveBeenCalled();
    expect(startupAudio.dispose).not.toHaveBeenCalled();
  });

  it('accepts only a primary left pointer and keeps synthetic click one-shot', async () => {
    const onDone = vi.fn();
    renderSplash({ onDone, reducedMotion: false });
    await loadReady();
    const tree = renderSplash({ onDone, reducedMotion: false });
    const secondary = {
      isPrimary: true, button: 2,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    tree.props.onPointerDown(secondary);
    expect(secondary.stopPropagation).toHaveBeenCalledOnce();
    expect(secondary.preventDefault).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    const primary = {
      isPrimary: true, button: 0,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    tree.props.onPointerDown(primary);
    tree.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    vi.advanceTimersByTime(3_850);
    expect(primary.preventDefault).toHaveBeenCalledOnce();
    expect(primary.stopPropagation).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(['mouse', 'touch', 'pen'])('finishes once from a primary %s pointer', async (pointerType) => {
    const onDone = vi.fn();
    renderSplash({ onDone, reducedMotion: false });
    await loadReady();
    const tree = renderSplash({ onDone, reducedMotion: false });
    const event = {
      pointerType, isPrimary: true, button: 0,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };

    tree.props.onPointerDown(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('finishes fallback from an accessible synthetic click and disposes active ident audio on skip', async () => {
    const fallbackDone = vi.fn();
    let tree = renderSplash({ onDone: fallbackDone, reducedMotion: false });
    FakeImage.instances.at(0)!.onerror?.();
    tree = renderSplash({ onDone: fallbackDone, reducedMotion: false });
    const click = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    tree.props.onClick(click);
    vi.advanceTimersByTime(700);
    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(click.stopPropagation).toHaveBeenCalledOnce();
    expect(fallbackDone).toHaveBeenCalledTimes(1);

    unmountSplash();
    hooks.values = [];
    hooks.deps = [];
    hooks.effects = [];
    hooks.cleanups = [];
    FakeImage.instances = [];
    startupAudio.dispose.mockClear();
    startupAudio.play.mockClear();
    const readyDone = vi.fn();
    renderSplash({ onDone: readyDone, reducedMotion: false });
    await loadReady();
    tree = renderSplash({ onDone: readyDone, reducedMotion: false });
    vi.advanceTimersByTime(0);
    expect(startupAudio.play).toHaveBeenCalledOnce();
    tree.props.onPointerDown({
      isPrimary: true, button: 0,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    unmountSplash();
    expect(readyDone).toHaveBeenCalledOnce();
    expect(startupAudio.dispose).toHaveBeenCalledOnce();
  });

  it('uses the 2240ms reduced beat from either reduced-motion path', async () => {
    for (const [reducedMotion, osMotionOff] of [[true, false], [false, true]] as const) {
      unmountSplash();
      hooks.values = [];
      hooks.deps = [];
      hooks.effects = [];
      hooks.cleanups = [];
      FakeImage.instances = [];
      hooks.motionOff = osMotionOff;
      const onDone = vi.fn();

      renderSplash({ onDone, reducedMotion });
      await loadReady();
      renderSplash({ onDone, reducedMotion });
      vi.advanceTimersByTime(0);
      expect(startupAudio.play).toHaveBeenLastCalledWith(true);
      vi.advanceTimersByTime(2_239);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    }
  });

  it('survives StrictMode effect replay with one completion and cancels after unmount', async () => {
    const onDone = vi.fn();
    renderSplash({ onDone, reducedMotion: false });
    const staleLoad = FakeImage.instances.at(0)!.onload;
    replayMountEffects();

    staleLoad?.();
    await Promise.resolve();
    expect(FakeImage.instances).toHaveLength(2);
    await loadReady();
    renderSplash({ onDone, reducedMotion: false });
    vi.advanceTimersByTime(0);
    expect(startupAudio.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_850);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);

    unmountSplash();
    hooks.values = [];
    hooks.deps = [];
    hooks.effects = [];
    hooks.cleanups = [];
    FakeImage.instances = [];
    startupAudio.dispose.mockClear();
    startupAudio.play.mockClear();
    const unmountedDone = vi.fn();
    renderSplash({ onDone: unmountedDone, reducedMotion: false });
    await loadReady();
    renderSplash({ onDone: unmountedDone, reducedMotion: false });
    vi.advanceTimersByTime(0);
    unmountSplash();
    expect(startupAudio.dispose).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10_000);
    expect(unmountedDone).not.toHaveBeenCalled();
  });

  it('falls back on image error or 2s timeout and suppresses a late decode', async () => {
    for (const failure of ['error', 'timeout'] as const) {
      unmountSplash();
      hooks.values = [];
      hooks.deps = [];
      hooks.effects = [];
      hooks.cleanups = [];
      FakeImage.instances = [];
      const onDone = vi.fn();

      let tree = renderSplash({ onDone, reducedMotion: false });
      if (failure === 'error') FakeImage.instances.at(0)!.onerror?.();
      else vi.advanceTimersByTime(2_000);
      tree = renderSplash({ onDone, reducedMotion: false });
      expect(tree.props['aria-busy']).toBe(false);
      expect(JSON.stringify(tree)).not.toContain('developer-splash__logo-frame');
      vi.advanceTimersByTime(0);
      expect(startupAudio.play).not.toHaveBeenCalled();
      vi.advanceTimersByTime(699);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    }

    unmountSplash();
    hooks.values = [];
    hooks.deps = [];
    hooks.effects = [];
    hooks.cleanups = [];
    FakeImage.instances = [];
    let resolveDecode!: () => void;
    const pendingDecode = new Promise<void>((resolve) => { resolveDecode = resolve; });
    renderSplash({ onDone: vi.fn(), reducedMotion: false });
    FakeImage.instances.at(0)!.decode.mockReturnValueOnce(pendingDecode);
    FakeImage.instances.at(0)!.onload?.();
    let tree = renderSplash({ onDone: vi.fn(), reducedMotion: false });
    expect(FakeImage.instances.at(0)!.decode).toHaveBeenCalledOnce();
    expect(tree.props['aria-busy']).toBe(true);
    expect(JSON.stringify(tree)).not.toContain('developer-splash__logo-frame');
    vi.advanceTimersByTime(2_000);
    tree = renderSplash({ onDone: vi.fn(), reducedMotion: false });
    expect(JSON.stringify(tree)).not.toContain('developer-splash__logo-frame');
    resolveDecode();
    await Promise.resolve();
    tree = renderSplash({ onDone: vi.fn(), reducedMotion: false });
    expect(JSON.stringify(tree)).not.toContain('developer-splash__logo-frame');
  });
});
