import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_KEYS,
  readValue,
  remove,
  resetStorageCache,
  writeRaw,
  writeValue,
  type StorageBridge,
} from '../src/ui/storage';

// jsdom is not configured project-wide; provide a minimal localStorage shim,
// matching what the existing persistence tests do.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

function fakeBridge(snapshot: Record<string, string> = {}, fresh = false) {
  const writes: [string, string][] = [];
  const removes: string[] = [];
  const bridge: StorageBridge = {
    snapshot,
    fresh,
    write: (k, j) => { writes.push([k, j]); },
    remove: (k) => { removes.push(k); },
  };
  return { bridge, writes, removes };
}

function installBridge(b: StorageBridge | null) {
  if (b) (globalThis as { wj?: StorageBridge }).wj = b;
  else delete (globalThis as { wj?: StorageBridge }).wj;
  resetStorageCache();
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  installBridge(null);
});

describe('web backend (no bridge)', () => {
  it('sends a save key to localStorage', () => {
    writeValue('wj.lifetime', { runs: 3 });
    expect(localStorage.getItem('wj.lifetime')).toBe('{"runs":3}');
    expect(readValue<{ runs: number }>('wj.lifetime')).toEqual({ runs: 3 });
  });

  it('sends a preference key to localStorage', () => {
    writeValue('wj.lang', 'ko');
    expect(readValue<string>('wj.lang')).toBe('ko');
  });
});

describe('desktop backend (bridge present)', () => {
  it('sends a save key to the bridge, not localStorage', () => {
    const { bridge, writes } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.lifetime', { runs: 3 });
    expect(writes).toEqual([['wj.lifetime', '{"runs":3}']]);
    expect(localStorage.getItem('wj.lifetime')).toBeNull();
  });

  it('keeps preference keys in localStorage even with a bridge', () => {
    const { bridge, writes } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.settings', { tips: false });
    expect(writes).toEqual([]);
    expect(localStorage.getItem('wj.settings')).toBe('{"tips":false}');
  });

  it('reads a save key back without a reload (write-through cache)', () => {
    const { bridge } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.unlocks', ['red']);
    expect(readValue<string[]>('wj.unlocks')).toEqual(['red']);
  });

  it('seeds reads from the boot snapshot', () => {
    const { bridge } = fakeBridge({ 'wj.collection': '{"cat":1}' });
    installBridge(bridge);
    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ cat: 1 });
  });

  it('returns null for a save key absent from the snapshot', () => {
    const { bridge } = fakeBridge();
    installBridge(bridge);
    expect(readValue('wj.vouchers')).toBeNull();
  });

  it('remove drops from the cache and tells the bridge', () => {
    const { bridge, removes } = fakeBridge({ 'wj.tutorial': '{"a":1}' });
    installBridge(bridge);
    remove('wj.tutorial');
    expect(readValue('wj.tutorial')).toBeNull();
    expect(removes).toEqual(['wj.tutorial']);
  });
});

describe('parsing', () => {
  it('returns null for a missing key', () => {
    expect(readValue('wj.lifetime')).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem('wj.lifetime', '{not json');
    expect(readValue('wj.lifetime')).toBeNull();
  });

  it('writeValue(undefined) is a no-op, not a literal "undefined"', () => {
    writeValue('wj.lifetime', undefined);
    expect(localStorage.getItem('wj.lifetime')).toBeNull();
  });

  it('writeRaw stores the string as given', () => {
    writeRaw('wj.run', '{"version":4}');
    expect(readValue<{ version: number }>('wj.run')).toEqual({ version: 4 });
  });
});

describe('one-time migration', () => {
  it('imports localStorage save keys when the bridge reports fresh', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    localStorage.setItem('wj.lang', '"ko"');
    const { bridge, writes } = fakeBridge({}, true);
    installBridge(bridge);

    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ cat: 1 });
    // Preference keys are NOT save data and must not be imported.
    expect(writes).toEqual([['wj.collection', '{"cat":1}']]);
  });

  it('does not import when the bridge is not fresh', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    const { bridge, writes } = fakeBridge({}, false);
    installBridge(bridge);

    expect(readValue('wj.collection')).toBeNull();
    expect(writes).toEqual([]);
  });

  it('never overwrites a key the snapshot already has', () => {
    localStorage.setItem('wj.collection', '{"stale":1}');
    const { bridge, writes } = fakeBridge({ 'wj.collection': '{"fresh":2}' }, true);
    installBridge(bridge);

    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ fresh: 2 });
    expect(writes).toEqual([]);
  });

  it('runs at most once even across many reads', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    const { bridge, writes } = fakeBridge({}, true);
    installBridge(bridge);

    readValue('wj.collection');
    readValue('wj.lifetime');
    readValue('wj.collection');
    expect(writes).toHaveLength(1);
  });
});

describe('SAVE_KEYS', () => {
  it('is exactly the eight progress keys', () => {
    expect([...SAVE_KEYS].sort()).toEqual([
      'wj.collection',
      'wj.collectionSeen',
      'wj.lifetime',
      'wj.run',
      'wj.tutorial',
      'wj.tutorialIntro',
      'wj.unlocks',
      'wj.vouchers',
    ]);
  });
});
