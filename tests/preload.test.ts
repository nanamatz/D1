import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImagesWhenIdle } from '../src/ui/preload';

afterEach(() => vi.unstubAllGlobals());

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
