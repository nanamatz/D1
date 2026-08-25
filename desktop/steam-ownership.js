import { STEAM_STATS, validateSteamPayload } from './steam-achievements.js';

export const STEAM_OWNERSHIP_STATES = Object.freeze([
  'pending', 'claim-required', 'eligible', 'unavailable',
  'mismatch', 'invalid', 'declined',
]);

const isZero = (payload) => STEAM_STATS.every((name) => payload[name] === 0);
const merge = (left, right) => left ? Object.fromEntries([
  ['version', 1],
  ...STEAM_STATS.map((name) => [name, Math.max(left[name], right[name])]),
]) : { ...right };

/** Main-process-only policy gate; Steam ids never leave this closure. */
export function createSteamOwnershipController({ session, store, onState = () => {} }) {
  const stored = store.steamOwner();
  let state = !session ? 'unavailable'
    : stored.state === 'invalid' ? 'invalid'
    : stored.state === 'owned' ? (stored.owner.steamId64 === session.steamId64 ? 'eligible' : 'mismatch')
    : 'pending';
  let pendingPayload;
  const setState = (next) => {
    if (state === next) return;
    state = next;
    onState(next);
  };
  const bind = () => {
    if (!store.claimSteamOwner(session.steamId64)) {
      pendingPayload = undefined;
      setState('invalid');
      return false;
    }
    setState('eligible');
    return true;
  };

  return {
    state: () => state,
    submit(payload) {
      if (!validateSteamPayload(payload)) return false;
      if (state === 'eligible') return session.sync.submit(payload);
      if (state !== 'pending' && state !== 'claim-required') return false;
      pendingPayload = merge(pendingPayload, payload);
      if (state === 'pending' && isZero(pendingPayload)) {
        if (bind()) {
          const queued = pendingPayload;
          pendingPayload = undefined;
          return session.sync.submit(queued);
        }
        return false;
      }
      setState('claim-required');
      return false;
    },
    accept() {
      if (state !== 'claim-required' || !pendingPayload || !bind()) return false;
      const queued = pendingPayload;
      pendingPayload = undefined;
      return session.sync.submit(queued);
    },
    decline() {
      if (state !== 'claim-required') return false;
      pendingPayload = undefined;
      setState('declined');
      return true;
    },
    flush() {
      return state === 'eligible' ? session.sync.flush() : Promise.resolve();
    },
  };
}
