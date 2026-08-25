import { describe, expect, it, vi } from 'vitest';
import {
  STEAM_ACHIEVEMENTS,
  STEAM_STATS,
  createSteamSync,
  initializeSteamSync,
  reconcileSteamStats,
  validateSteamPayload,
} from '../desktop/steam-achievements.js';
import { assertAllowedSteamPaths, validateSteamBuildConfig } from '../scripts/check-steam-package.mjs';
import packageConfig from '../package.json' with { type: 'json' };

const payload = (value = 1) => Object.fromEntries([
  ['version', 1], ...STEAM_STATS.map((name) => [name, value]),
]);

describe('desktop Steam achievement boundary', () => {
  it('packages only the four Windows runtime module files', () => {
    expect(() => validateSteamBuildConfig(packageConfig)).not.toThrow();
    const allowed = packageConfig.build.files.filter((file) => file.startsWith('node_modules/steamworks.js/'));
    expect(allowed).toHaveLength(4);
    expect(() => assertAllowedSteamPaths(allowed)).not.toThrow();
    expect(() => assertAllowedSteamPaths([...allowed,
      'node_modules/steamworks.js/dist/linux64/steamworksjs.linux-x64-gnu.node',
    ])).toThrow(/foreign/);
    expect(() => assertAllowedSteamPaths([...allowed,
      'node_modules/steamworks.js/dist/win64/steam_api64.lib',
    ])).toThrow(/link-time/);
  });
  it('owns the fixed public registry and accepts only an exact versioned payload', () => {
    expect(STEAM_ACHIEVEMENTS).toHaveLength(16);
    expect(new Set(STEAM_ACHIEVEMENTS.map(([, stat]) => stat))).toEqual(new Set(STEAM_STATS));
    expect(validateSteamPayload(payload())).toBe(true);
    expect(validateSteamPayload({ ...payload(), arbitrary: 1 })).toBe(false);
    expect(validateSteamPayload({ ...payload(), std_runs: -1 })).toBe(false);
    expect(validateSteamPayload({ ...payload(), std_runs: 1.5 })).toBe(false);
  });

  it('reconciles monotonically with remote Steam stats', () => {
    expect(reconcileSteamStats(payload(2), { ...payload(3), std_wins: 1 }))
      .toMatchObject({ std_runs: 3, std_wins: 2 });
  });

  it('initializes only from a packaged Windows x64 Steam launch AppID', async () => {
    const init = vi.fn(() => ({ stats: { getInt: () => 0, setInt: () => {}, store: () => {} } }));
    const load = vi.fn(async () => ({ default: { init } }));
    expect(await initializeSteamSync({ packaged: false, platform: 'win32', arch: 'x64',
      env: { SteamAppId: '123' }, load })).toBeNull();
    expect(await initializeSteamSync({ packaged: true, platform: 'win32', arch: 'x64',
      env: {}, load })).toBeNull();
    const sync = await initializeSteamSync({ packaged: true, platform: 'win32', arch: 'x64',
      env: { SteamAppId: '123' }, load });
    expect(sync).not.toBeNull();
    expect(init).toHaveBeenCalledWith(123);
  });

  it('coalesces bursts into one store and never decreases remote values', async () => {
    vi.useFakeTimers();
    const remote = Object.fromEntries(STEAM_STATS.map((name) => [name, 5]));
    const adapter = {
      getInt: vi.fn((name) => remote[name]),
      setInt: vi.fn((name, value) => { remote[name] = value; }),
      store: vi.fn(),
    };
    const sync = createSteamSync(adapter);
    sync.submit(payload(2));
    sync.submit({ ...payload(7), std_wins: 4 });
    await vi.runAllTimersAsync();
    expect(adapter.store).toHaveBeenCalledTimes(1);
    expect(remote.std_runs).toBe(7);
    expect(remote.std_wins).toBe(5);
    vi.useRealTimers();
  });

  it('does nothing when every remote stat is already equal, including a repeat', async () => {
    const adapter = {
      getInt: vi.fn(() => 2), setInt: vi.fn(), store: vi.fn(),
    };
    const sync = createSteamSync(adapter);
    sync.submit(payload(2));
    await sync.flush();
    sync.submit(payload(2));
    await sync.flush();
    expect(adapter.setInt).not.toHaveBeenCalled();
    expect(adapter.store).not.toHaveBeenCalled();
  });

  it('retries an explicit SetStat false result without storing', async () => {
    vi.useFakeTimers();
    let succeeds = false;
    const remote = Object.fromEntries(STEAM_STATS.map((name) => [name, 0]));
    const adapter = {
      getInt: vi.fn((name) => remote[name]),
      setInt: vi.fn((name, value) => {
        if (!succeeds) return false;
        remote[name] = value;
        return true;
      }),
      store: vi.fn(() => true),
    };
    const sync = createSteamSync(adapter);
    sync.submit(payload());
    await vi.advanceTimersByTimeAsync(500);
    expect(adapter.store).not.toHaveBeenCalled();
    succeeds = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(adapter.store).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('retries StoreStats false even when the local Steam cache now equals the batch', async () => {
    vi.useFakeTimers();
    const remote = Object.fromEntries(STEAM_STATS.map((name) => [name, 0]));
    let stores = 0;
    const adapter = {
      getInt: vi.fn((name) => remote[name]),
      setInt: vi.fn((name, value) => { remote[name] = value; return true; }),
      store: vi.fn(() => ++stores > 1),
    };
    const sync = createSteamSync(adapter);
    sync.submit(payload());
    await vi.advanceTimersByTimeAsync(500);
    expect(adapter.store).toHaveBeenCalledTimes(1);
    const sets = adapter.setInt.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(adapter.setInt).toHaveBeenCalledTimes(sets);
    expect(adapter.store).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('keeps failed work and retries through one scheduled flight', async () => {
    vi.useFakeTimers();
    let fail = true;
    const adapter = {
      getInt: vi.fn(() => { if (fail) throw new Error('offline'); return 0; }),
      setInt: vi.fn(), store: vi.fn(),
    };
    const sync = createSteamSync(adapter, { debounceMs: 50, retryBaseMs: 10, retryMaxMs: 40 });
    sync.submit(payload());
    await vi.advanceTimersByTimeAsync(50);
    expect(adapter.store).not.toHaveBeenCalled();
    fail = false;
    await vi.advanceTimersByTimeAsync(10);
    expect(adapter.store).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('backs off exponentially to the cap and resets after success', async () => {
    let fail = true;
    const schedule = vi.fn((_fn, ms) => ms);
    const sync = createSteamSync({
      getInt: () => { if (fail) throw new Error('offline'); return 0; },
      setInt: () => true,
      store: () => true,
    }, { schedule, cancel: () => {}, debounceMs: 500 });
    sync.submit(payload());
    for (let i = 0; i < 6; i += 1) await sync.flush();
    expect(schedule.mock.calls.map(([, ms]) => ms).filter((ms) => ms !== 500))
      .toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
    fail = false;
    await sync.flush();
    fail = true;
    sync.submit(payload(2));
    await sync.flush();
    expect(schedule.mock.calls.at(-1)[1]).toBe(5_000);
  });
});
