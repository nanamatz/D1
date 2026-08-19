import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImagesWhenIdle, scheduleWhenIdle } from '../src/ui/preload';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('idle task scheduling', () => {
  it('defers and cancels an idle callback task', () => {
    let callback: IdleRequestCallback | null = null;
    const cancelIdle = vi.fn();
    const task = vi.fn();
    vi.stubGlobal('requestIdleCallback', (next: IdleRequestCallback) => {
      callback = next;
      return 7;
    });
    vi.stubGlobal('cancelIdleCallback', cancelIdle);

    const cancel = scheduleWhenIdle(task);
    expect(task).not.toHaveBeenCalled();
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);
    callback!({ didTimeout: false, timeRemaining: () => 10 });
    expect(task).not.toHaveBeenCalled();
  });

  it('uses a deferred timer fallback when idle callbacks are unavailable', () => {
    vi.useFakeTimers();
    const task = vi.fn();
    scheduleWhenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(task).toHaveBeenCalledOnce();
  });
});

describe('idle image preloading', () => {
  it('deduplicates URLs and decodes only one image per idle turn', async () => {
    const callbacks: IdleRequestCallback[] = [];
    const sources: string[] = [];
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    vi.stubGlobal('Image', class {
      set src(value: string) { sources.push(value); }
      decode() { return Promise.resolve(); }
    });

    preloadImagesWhenIdle(['first.png', 'second.png', 'first.png']);
    expect(sources).toEqual([]);

    callbacks.shift()!({ didTimeout: false, timeRemaining: () => 10 });
    expect(sources).toEqual(['first.png']);
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));

    callbacks.shift()!({ didTimeout: false, timeRemaining: () => 10 });
    expect(sources).toEqual(['first.png', 'second.png']);
  });
});
