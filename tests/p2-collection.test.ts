import { describe, it, expect, beforeEach } from 'vitest';
import { collectionSize, loadCollection, recordWord } from '../src/ui/collection';

class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key() {
    return null;
  }
  get length() {
    return this.store.size;
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage();
});

describe('P2-2 — word collection tracking', () => {
  it('records a newly played word with a timestamp', () => {
    expect(recordWord('cat', 1000)).toBe(true);
    expect(loadCollection().cat).toBe(1000);
  });

  it('does not double-count a word (first-play only), case-insensitive', () => {
    expect(recordWord('cat', 1000)).toBe(true);
    expect(recordWord('cat', 2000)).toBe(false);
    expect(recordWord('CAT', 3000)).toBe(false);
    expect(loadCollection().cat).toBe(1000); // keeps first timestamp
  });

  it('accumulates distinct words across a session', () => {
    recordWord('cat');
    recordWord('run');
    recordWord('pizza');
    expect(collectionSize()).toBe(3);
  });

  it('persists across a reload (same storage → loadCollection sees prior writes)', () => {
    recordWord('gem', 500);
    // simulate a fresh read (as a later session would)
    expect(loadCollection().gem).toBe(500);
  });

  it('ignores blank input', () => {
    expect(recordWord('   ')).toBe(false);
    expect(collectionSize()).toBe(0);
  });
});
