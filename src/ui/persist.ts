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
import { readValue, remove, writeRaw } from './storage';
import { isKnownConsumableId } from '../engine/consumables';
import { JOKER_REGISTRY } from '../engine/jokers';
import { challengeDef, isChallengeId } from '../engine/challenges';
import type { GameState } from './useGame';
import { normalizeRunObservationId } from './runObservation';

const KEY = 'wj.run';

/**
 * Bump whenever GameState's shape changes. Mismatched saves are DISCARDED, not
 * migrated — a stale save that half-fits is worse than a fresh run.
 */
const VERSION = 12;

interface Envelope {
  version: number;
  state: GameState;
}

function hasValidChallengePreset(run: GameState['run'] | null | undefined): boolean {
  if (run?.challengeId == null) return true;
  if (!isChallengeId(run.challengeId) || run.customSeed) return false;
  const preset = challengeDef(run.challengeId);
  return run.pouchId === preset.pouchId && run.recordId === preset.recordId;
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
    run: {
      ...state.run,
      jokers: state.run.jokers.filter((joker) => joker.state.destroyed !== 1),
    },
    selected: state.blind.forcedTileId ? [state.blind.forcedTileId] : [],
    message: null,
    hint: null,
    shopTagRedemptions: [],
    lastPlayed: null,
    lastEvents: [],
    bossDiscard: null,
    blindEntryEffects: null,
    settleId: 0,
    committedBefore: 0,
    settleComplete: true,
    finalScore: null,
    sentenceBonus: null,
  };
}

/** The exact bytes that would be persisted — callers dedupe against this. */
export function serializeRun(state: GameState): string {
  const envelope: Envelope = { version: VERSION, state: atRest(state) };
  return JSON.stringify(envelope);
}

export function writeRun(json: string): void {
  writeRaw(KEY, json);
}

/** The saved run, or null if there is none, it's unreadable, or the schema moved. */
export function loadRun(): GameState | null {
  const env = readValue<Partial<Envelope>>(KEY);
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
  if (!hasValidChallengePreset(s.run) || !hasValidChallengePreset(s.pendingRun)) {
    return null;
  }
  // `sentenceBonus` is presentation-only. Older v4 snapshots could accidentally
  // retain it mid-landing; clearing it also prevents loading the pre-breakdown shape.
  // Drop anything the current build cannot resolve. Retiring a card or an Emoji
  // Tile is then a data change, not a save-version bump that discards the run.
  return {
    ...s,
    observationId: normalizeRunObservationId(s.observationId),
    stats: {
      ...s.stats,
      jokerBlindCounts: s.stats?.jokerBlindCounts ?? {},
    },
    shopTagRedemptions: s.shopTagRedemptions ?? [],
    blindEntryEffects: null,
    run: {
      ...s.run,
      challengeId: s.run.challengeId ?? null,
      jokers: s.run.jokers.filter(
        (joker) => JOKER_REGISTRY.has(joker.defId) && joker.state.destroyed !== 1,
      ),
      consumables: (s.run.consumables ?? []).filter(isKnownConsumableId),
    },
    pendingRun: s.pendingRun
      ? { ...s.pendingRun, challengeId: s.pendingRun.challengeId ?? null }
      : null,
    sentenceBonus: null,
  };
}

export function clearRun(): void {
  remove(KEY);
}
