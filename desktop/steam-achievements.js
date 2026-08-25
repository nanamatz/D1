/** Steam-facing achievement registry. Partner unlocks achievements from these stats. */
export const STEAM_ACHIEVEMENTS = Object.freeze([
  ['ACH_FIRST_DRAFT', 'std_runs', 1],
  ['ACH_REGULAR_COLUMN', 'std_runs', 10],
  ['ACH_PUBLISHED', 'std_wins', 1],
  ['ACH_TEN_PRINTINGS', 'std_wins', 10],
  ['ACH_TWENTY_FIVE_PRINTINGS', 'std_wins', 25],
  ['ACH_PACK_LIGHT', 'pouches_won', 3],
  ['ACH_POUCH_CABINET', 'pouches_won', 7],
  ['ACH_WORLD_IN_A_BAG', 'pouches_won', 14],
  ['ACH_B_SIDE', 'records_won', 4],
  ['ACH_FULL_DISCOGRAPHY', 'records_won', 8],
  ['ACH_CROSS_PRESS', 'pouch_record_pairs', 16],
  ['ACH_CHALLENGE_ACCEPTED', 'challenges_completed', 1],
  ['ACH_SIX_ASSIGNMENTS', 'challenges_completed', 6],
  ['ACH_FIRST_PROOF', 'emoji_mastered', 1],
  ['ACH_EMOJI_BOARD', 'emoji_mastered', 25],
  ['ACH_STICKER_ALBUM', 'emoji_record_sticker_tiers', 100],
]);

export const STEAM_STATS = Object.freeze([
  'std_runs',
  'std_wins',
  'pouches_won',
  'records_won',
  'pouch_record_pairs',
  'challenges_completed',
  'emoji_mastered',
  'emoji_record_sticker_tiers',
]);

const PAYLOAD_KEYS = Object.freeze(['version', ...STEAM_STATS].sort());
const INT32_MAX = 2_147_483_647;

export function validateSteamPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== PAYLOAD_KEYS.length || keys.some((key, i) => key !== PAYLOAD_KEYS[i])) return false;
  if (value.version !== 1) return false;
  return STEAM_STATS.every((name) => Number.isInteger(value[name]) && value[name] >= 0 && value[name] <= INT32_MAX);
}

export function reconcileSteamStats(local, remote) {
  return Object.fromEntries(STEAM_STATS.map((name) => [name, Math.max(local[name], remote[name] ?? 0)]));
}

/** Coalesces renderer bursts and retries failed Steam stores without blocking saves. */
export function createSteamSync(adapter, options = {}) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  const debounceMs = options.debounceMs ?? 500;
  const retryBaseMs = options.retryBaseMs ?? 5_000;
  const retryMaxMs = options.retryMaxMs ?? 60_000;
  let pending;
  let timer;
  let running;
  let dirty = false;
  let retryMs = retryBaseMs;

  const merge = (payload) => {
    pending = pending
      ? Object.fromEntries(['version', ...STEAM_STATS].map((key) => [key, key === 'version' ? 1 : Math.max(pending[key], payload[key])]))
      : { ...payload };
  };

  const arm = (ms) => {
    if (timer !== undefined) return;
    timer = schedule(() => {
      timer = undefined;
      void flush();
    }, ms);
  };

  const flush = async () => {
    if (timer !== undefined) {
      cancel(timer);
      timer = undefined;
    }
    if (running) {
      await running;
      return pending && timer === undefined ? flush() : undefined;
    }
    if (!pending) return;
    const batch = pending;
    pending = undefined;
    running = (async () => {
      try {
        const remote = Object.fromEntries(STEAM_STATS.map((name) => [name, adapter.getInt(name) ?? 0]));
        const next = reconcileSteamStats(batch, remote);
        for (const name of STEAM_STATS) {
          if (next[name] > remote[name]) {
            if (adapter.setInt(name, next[name]) === false) throw new Error('Steam SetStat failed');
            dirty = true;
          }
        }
        if (dirty && adapter.store() === false) throw new Error('Steam StoreStats failed');
        dirty = false;
        retryMs = retryBaseMs;
      } catch {
        merge(batch);
        arm(retryMs);
        retryMs = Math.min(retryMaxMs, retryMs * 2);
      }
    })();
    await running;
    running = undefined;
    if (pending && timer === undefined) arm(debounceMs);
  };

  return {
    submit(payload) {
      if (!validateSteamPayload(payload)) return false;
      merge(payload);
      arm(debounceMs);
      return true;
    },
    flush,
    dispose() {
      if (timer !== undefined) cancel(timer);
      timer = undefined;
      pending = undefined;
      dirty = false;
      retryMs = retryBaseMs;
    },
  };
}

/** Steam initializes only for a packaged Windows x64 process launched by Steam. */
export async function initializeSteamSync({
  packaged,
  platform,
  arch,
  env = process.env,
  load = () => import('steamworks.js'),
} = {}) {
  if (!packaged || platform !== 'win32' || arch !== 'x64') return null;
  const suppliedAppId = env.SteamAppId ?? env.STEAM_APP_ID;
  if (!/^\d+$/.test(suppliedAppId ?? '')) return null;
  try {
    const module = await load();
    const steamworks = module.default ?? module;
    // No id is embedded or read from a file: use only Steam's launch environment.
    const client = steamworks.init(Number(suppliedAppId));
    const steamId64 = client.localplayer.getSteamId().steamId64.toString();
    if (!/^[1-9]\d{16,19}$/.test(steamId64)) return null;
    return {
      steamId64,
      sync: createSteamSync({
        getInt: (name) => client.stats.getInt(name),
        setInt: (name, value) => client.stats.setInt(name, value),
        store: () => client.stats.store(),
      }),
    };
  } catch {
    return null;
  }
}
