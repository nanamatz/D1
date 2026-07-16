/**
 * Run persistence (playtest-06). The run already survives leaving the run view —
 * `useGame` lives in App, so Options → Main Menu keeps it in memory — but a page
 * reload wiped it and greyed the New Run screen's Continue tab. This carries the
 * run across reloads so Continue always has something to resume.
 *
 * Only a RESTING snapshot is stored: the settle timeline is replayed from a
 * per-submission ScoreEvent log and cannot be resumed halfway, so the animation
 * fields are stripped on save and a reload never restores half an animation.
 * Everything else (run, blind, shop, pack, stats) is plain JSON — no Map/Set or
 * functions live in GameState, and the RNG is reproducible from `seed` +
 * `rngCounter` rather than held as an object.
 *
 * Nothing here throws: localStorage can be unavailable (privacy mode) or full, and
 * a save is a convenience — never a reason to fail to boot.
 */
import type { GameState } from './useGame';

const KEY = 'wj.run';

/**
 * Bump whenever GameState's shape changes. Mismatched saves are DISCARDED, not
 * migrated — a stale save that half-fits is worse than a fresh run.
 */
const VERSION = 1;

interface Envelope {
  version: number;
  state: GameState;
}

/**
 * Strip the transient/animation-only fields so a save is always a resting state.
 * `pendingEnd` is deliberately kept: a blind caught mid-resolution still resolves
 * on load, because `settleComplete: true` lets the finalize effects run (there is
 * no settle animation left to wait for).
 */
function atRest(state: GameState): GameState {
  return {
    ...state,
    selected: [],
    message: null,
    hint: null,
    lastPlayed: null,
    lastEvents: [],
    settleId: 0,
    committedBefore: 0,
    settleComplete: true,
    finalScore: null,
  };
}

/** The exact bytes that would be persisted — callers dedupe against this. */
export function serializeRun(state: GameState): string {
  const envelope: Envelope = { version: VERSION, state: atRest(state) };
  return JSON.stringify(envelope);
}

export function writeRun(json: string): void {
  try {
    localStorage.setItem(KEY, json);
  } catch {
    /* quota / privacy mode — the run just stays session-only */
  }
}

/** The saved run, or null if there is none, it's unreadable, or the schema moved. */
export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as Partial<Envelope> | null;
    if (!env || env.version !== VERSION || !env.state) return null;
    const s = env.state;
    // Cheap shape check: a corrupt or half-written save must never boot the game
    // into a broken state — fall back to a fresh bootstrap instead.
    if (
      typeof s.seed !== 'string' ||
      typeof s.phase !== 'string' ||
      !s.run ||
      !s.blind ||
      !Array.isArray(s.blind.hand) ||
      !Array.isArray(s.run.jokers)
    ) {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
