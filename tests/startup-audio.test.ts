import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playStartupIdentAudio } from '../src/ui/startupAudio';

class FakeParam {
  value = 0;
  readonly values: Array<[number, number]> = [];
  readonly ramps: Array<[number, number]> = [];
  setValueAtTime = vi.fn((value: number, at: number) => { this.values.push([value, at]); });
  exponentialRampToValueAtTime = vi.fn((value: number, at: number) => {
    this.ramps.push([value, at]);
  });
}

class FakeNode {
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  start = vi.fn<(at: number) => void>();
  stop = vi.fn<(at?: number) => void>();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeAudioContext {
  static state: AudioContextState = 'running';
  static rejectResume = false;
  static failCreate = false;
  static instances: FakeAudioContext[] = [];

  state = FakeAudioContext.state;
  currentTime = 0;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  stateChangeListeners = new Set<EventListenerOrEventListenerObject>();
  resume = vi.fn(() => FakeAudioContext.rejectResume
    ? Promise.reject(new Error('autoplay blocked'))
    : Promise.resolve());
  close = vi.fn(async () => {
    this.state = 'closed';
    this.emitStateChange();
  });
  addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'statechange') this.stateChangeListeners.add(listener);
  });
  removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'statechange') this.stateChangeListeners.delete(listener);
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createDynamicsCompressor(): FakeCompressor {
    if (FakeAudioContext.failCreate) throw new Error('audio device failed');
    return new FakeCompressor();
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  emitStateChange(): void {
    const event = { type: 'statechange' } as Event;
    for (const listener of [...this.stateChangeListeners]) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }
}

function installFakeContext(): void {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('webkitAudioContext', undefined);
}

function firstContext(): FakeAudioContext {
  const context = FakeAudioContext.instances[0];
  if (!context) throw new Error('AudioContext was not constructed');
  return context;
}

describe('separate Sweet Turtles startup audio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.state = 'running';
    FakeAudioContext.rejectResume = false;
    FakeAudioContext.failCreate = false;
    FakeAudioContext.instances = [];
    installFakeContext();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses fixed gain and schedules opening, flip, contact, bounce, and front-lock tones', () => {
    const dispose = playStartupIdentAudio(false);
    const context = firstContext();

    expect(context.gains[0]?.gain.value).toBe(0.6);
    expect(context.oscillators).toHaveLength(19);
    expect(context.oscillators.slice(0, 3).map((oscillator) => (
      oscillator.frequency.values[0]?.[0]
    ))).toEqual([1120, 1687, 2779]);
    const starts = context.oscillators.map((oscillator) => oscillator.start.mock.calls[0]?.[0]);
    expect(starts).toContain(0.02); // opening appearance
    expect(starts).toContain(1.02); // visual first contact: 1000ms
    expect(starts).toContain(1.24); // visual bounce: 1220ms
    expect(starts).toContain(1.62); // exact front lock: 1600ms

    vi.advanceTimersByTime(1_999);
    expect(context.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(context.close).toHaveBeenCalledOnce();

    dispose();
    expect(context.close).toHaveBeenCalledOnce();
    for (const oscillator of context.oscillators) {
      expect(oscillator.disconnect).toHaveBeenCalledOnce();
    }
  });

  it('uses only the short two-tone landing cue for reduced motion', () => {
    playStartupIdentAudio(true);
    const context = firstContext();
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators.map((oscillator) => oscillator.start.mock.calls[0]?.[0]))
      .toEqual([0.1, 0.13]);
    vi.advanceTimersByTime(700);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('fails closed when autoplay is unavailable, suspended, rejected, or setup throws', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playStartupIdentAudio(false)()).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);

    vi.stubGlobal('AudioContext', class ThrowingAudioContext {
      constructor() { throw new Error('no audio device'); }
    });
    expect(() => playStartupIdentAudio(false)()).not.toThrow();

    installFakeContext();
    FakeAudioContext.state = 'suspended';
    FakeAudioContext.rejectResume = true;
    const suspendedDispose = playStartupIdentAudio(false);
    const suspended = FakeAudioContext.instances.at(-1)!;
    expect(suspended.resume).toHaveBeenCalledOnce();
    expect(suspended.close).toHaveBeenCalledOnce();
    expect(suspended.oscillators).toHaveLength(0);
    await Promise.resolve();
    expect(() => suspendedDispose()).not.toThrow();
    expect(suspended.close).toHaveBeenCalledOnce();

    FakeAudioContext.state = 'running';
    FakeAudioContext.failCreate = true;
    expect(() => playStartupIdentAudio(false)).not.toThrow();
    const failedSetup = FakeAudioContext.instances.at(-1)!;
    expect(failedSetup.close).toHaveBeenCalledOnce();
    expect(failedSetup.oscillators).toHaveLength(0);
  });

  it('stops and disconnects every source and closes its context once on disposal', () => {
    const dispose = playStartupIdentAudio(false);
    const context = firstContext();
    dispose();
    dispose();
    vi.advanceTimersByTime(10_000);

    expect(context.close).toHaveBeenCalledOnce();
    for (const oscillator of context.oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(2); // scheduled stop + disposal stop
      expect(oscillator.disconnect).toHaveBeenCalledOnce();
    }
  });

  it.each(['suspended', 'interrupted'] as const)(
    'immediately tears down a running cue when the context becomes %s',
    (nextState) => {
      const dispose = playStartupIdentAudio(false);
      const context = firstContext();
      expect(context.addEventListener).toHaveBeenCalledOnce();
      expect(context.stateChangeListeners.size).toBe(1);

      context.state = nextState as AudioContextState;
      context.emitStateChange();

      expect(context.removeEventListener).toHaveBeenCalledOnce();
      expect(context.stateChangeListeners.size).toBe(0);
      expect(context.close).toHaveBeenCalledOnce();
      for (const oscillator of context.oscillators) {
        expect(oscillator.stop).toHaveBeenCalledTimes(2);
        expect(oscillator.disconnect).toHaveBeenCalledOnce();
      }

      // close() emits statechange in this fake. Listener removal before close,
      // the cancelled lifetime timer, a late event, and caller disposal are all
      // required to remain re-entrant and idempotent.
      context.emitStateChange();
      dispose();
      vi.advanceTimersByTime(10_000);
      expect(context.close).toHaveBeenCalledOnce();
      expect(context.removeEventListener).toHaveBeenCalledOnce();
      for (const oscillator of context.oscillators) {
        expect(oscillator.stop).toHaveBeenCalledTimes(2);
        expect(oscillator.disconnect).toHaveBeenCalledOnce();
      }
    },
  );
});
