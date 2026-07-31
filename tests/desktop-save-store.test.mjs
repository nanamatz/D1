import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SAVE_KEYS,
  createSaveStore,
  loadSaveFile,
  saveSaveFile,
} from '../desktop/save-store.js';
import { SAVE_KEYS as ADAPTER_SAVE_KEYS } from '../src/ui/storage';

const dir = () => mkdtempSync(path.join(tmpdir(), 'wj-saves-'));

describe('loadSaveFile / saveSaveFile', () => {
  it('round-trips entries', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":3}' });
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":3}' });
  });

  it('writes human-readable JSON, not an escaped string blob', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":3}' });
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('"schema": 1');
    expect(text).toContain('"runs": 3');
    expect(text).not.toContain('\\"');
  });

  it('returns {} for a missing file', () => {
    expect(loadSaveFile(path.join(dir(), 'nope.json'))).toEqual({});
  });

  it('falls back to .bak when the primary is corrupt', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    writeFileSync(file, '{corrupt', 'utf8');
    // .bak holds the previous complete write
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });

  it('returns {} when both the primary and the backup are corrupt', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    writeFileSync(file, '{corrupt', 'utf8');
    writeFileSync(file + '.bak', 'also corrupt', 'utf8');
    expect(loadSaveFile(file)).toEqual({});
  });

  it('keeps .bak as the previous complete file', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    expect(existsSync(file + '.bak')).toBe(false); // nothing to back up on the first write
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    expect(loadSaveFile(file + '.bak')).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });

  it('drops an unparseable entry but still writes a valid file', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}', 'wj.unlocks': '{broken' });
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });

  it('reports a disk write failure', () => {
    const root = dir();
    const blocker = path.join(root, 'file-not-directory');
    writeFileSync(blocker, 'x', 'utf8');
    expect(saveSaveFile(path.join(blocker, 'profile.json'), {
      'wj.lifetime': '{"runs":1}',
    })).toBe(false);
  });
});

describe('createSaveStore', () => {
  it('reports fresh when the directory does not exist yet', () => {
    const d = path.join(dir(), 'saves');
    expect(createSaveStore(d).fresh).toBe(true);
  });

  it('reports not fresh once the directory exists', () => {
    const d = path.join(dir(), 'saves');
    const first = createSaveStore(d);
    first.set('wj.lifetime', '{"runs":1}');
    first.flush();
    expect(createSaveStore(d).fresh).toBe(false);
  });

  it('splits the run from the profile so a run reset cannot lose the profile', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.run', '{"version":4}');
    store.set('wj.lifetime', '{"runs":7}');
    store.flush();

    expect(loadSaveFile(path.join(d, 'run.json'))).toEqual({ 'wj.run': '{"version":4}' });
    expect(loadSaveFile(path.join(d, 'profile.json'))).toEqual({ 'wj.lifetime': '{"runs":7}' });
  });

  it('exposes both files in one snapshot', () => {
    const d = path.join(dir(), 'saves');
    const first = createSaveStore(d);
    first.set('wj.run', '{"version":4}');
    first.set('wj.lifetime', '{"runs":7}');
    first.flush();

    expect(createSaveStore(d).snapshot()).toEqual({
      'wj.run': '{"version":4}',
      'wj.lifetime': '{"runs":7}',
    });
  });

  it('remove deletes the key from the file', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.run', '{"version":4}');
    store.flush();
    store.remove('wj.run');
    store.flush();
    expect(loadSaveFile(path.join(d, 'run.json'))).toEqual({});
  });

  it('ignores a key that is not save data', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.settings', '{"tips":false}');
    store.set('../../evil', '"x"');
    store.flush();
    expect(createSaveStore(d).snapshot()).toEqual({});
  });

  it('publishes store health changes', () => {
    const root = dir();
    const blocker = path.join(root, 'file-not-directory');
    writeFileSync(blocker, 'x', 'utf8');
    const statuses = [];
    const store = createSaveStore(path.join(blocker, 'saves'), (ok) => statuses.push(ok));
    store.set('wj.lifetime', '{"runs":1}');
    store.flush();
    expect(statuses).toEqual([false]);
  });
});

describe('key list drift', () => {
  it('matches the adapter list in src/ui/storage.ts', () => {
    expect([...SAVE_KEYS].sort()).toEqual([...ADAPTER_SAVE_KEYS].sort());
  });
});
