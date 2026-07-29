import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIZE,
  MIN_SIZE,
  defaultBounds,
  isVisibleOn,
  loadState,
  restoreBounds,
  saveState,
} from '../desktop/window-state.js';

const BIG = { x: 0, y: 0, width: 2560, height: 1440 };
const LAPTOP = { x: 0, y: 0, width: 1366, height: 768 };

describe('defaultBounds', () => {
  it('uses the default size on a large work area', () => {
    const b = defaultBounds(BIG);
    expect(b.width).toBe(DEFAULT_SIZE.width);
    expect(b.height).toBe(DEFAULT_SIZE.height);
  });

  it('centres the window in the work area', () => {
    const b = defaultBounds(BIG);
    expect(b.x).toBe((2560 - DEFAULT_SIZE.width) / 2);
    expect(b.y).toBe((1440 - DEFAULT_SIZE.height) / 2);
  });

  it('clamps to the work area on a small laptop so the window is never off-screen', () => {
    const b = defaultBounds(LAPTOP);
    expect(b.width).toBe(1366);
    expect(b.height).toBe(768);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
  });

  it('never returns bounds smaller than the minimum size', () => {
    const b = defaultBounds({ x: 0, y: 0, width: 640, height: 400 });
    expect(b.width).toBe(MIN_SIZE.width);
    expect(b.height).toBe(MIN_SIZE.height);
  });
});

describe('isVisibleOn', () => {
  const displays = [{ workArea: LAPTOP }];

  it('accepts a window inside the display', () => {
    expect(isVisibleOn({ x: 100, y: 100, width: 800, height: 600 }, displays)).toBe(true);
  });

  it('rejects a window entirely off the display (unplugged second monitor)', () => {
    expect(isVisibleOn({ x: 2000, y: 100, width: 800, height: 600 }, displays)).toBe(false);
  });

  it('rejects a window overlapping by only a sliver', () => {
    expect(isVisibleOn({ x: 1356, y: 100, width: 800, height: 600 }, displays)).toBe(false);
  });

  it('accepts a window straddling two displays', () => {
    const two = [{ workArea: LAPTOP }, { workArea: { x: 1366, y: 0, width: 1920, height: 1080 } }];
    expect(isVisibleOn({ x: 1300, y: 100, width: 800, height: 600 }, two)).toBe(true);
  });
});

describe('restoreBounds', () => {
  const displays = [{ workArea: LAPTOP }];

  it('falls back to defaults when nothing is saved', () => {
    expect(restoreBounds(null, displays, LAPTOP)).toEqual(defaultBounds(LAPTOP));
  });

  it('restores saved bounds that are still visible', () => {
    const saved = { x: 50, y: 60, width: 1000, height: 700, maximized: false, fullScreen: false };
    expect(restoreBounds(saved, displays, LAPTOP)).toEqual({ x: 50, y: 60, width: 1000, height: 700 });
  });

  it('falls back to defaults when the saved display is gone', () => {
    const saved = { x: 3000, y: 60, width: 1000, height: 700, maximized: false, fullScreen: false };
    expect(restoreBounds(saved, displays, LAPTOP)).toEqual(defaultBounds(LAPTOP));
  });

  it('raises a saved size below the minimum up to the minimum', () => {
    const saved = { x: 0, y: 0, width: 400, height: 300, maximized: false, fullScreen: false };
    const b = restoreBounds(saved, displays, LAPTOP);
    expect(b.width).toBe(MIN_SIZE.width);
    expect(b.height).toBe(MIN_SIZE.height);
  });
});

describe('loadState / saveState', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wj-window-state-'));

  it('round-trips a saved state', () => {
    const file = path.join(dir, 'round-trip.json');
    const state = { x: 10, y: 20, width: 1200, height: 800, maximized: true, fullScreen: false };
    saveState(file, state);
    expect(loadState(file)).toEqual(state);
  });

  it('returns null for a missing file rather than throwing', () => {
    expect(loadState(path.join(dir, 'does-not-exist.json'))).toBeNull();
  });

  it('returns null for a corrupt file rather than throwing', () => {
    const file = path.join(dir, 'corrupt.json');
    writeFileSync(file, '{not json', 'utf8');
    expect(loadState(file)).toBeNull();
  });

  it('swallows an unwritable path so a failed save never blocks quitting', () => {
    // A directory path is never writable as a file.
    expect(() => saveState(dir, { x: 0, y: 0, width: 1, height: 1 })).not.toThrow();
  });
});
