import { describe, expect, it, vi } from 'vitest';
import { STEAM_STATS } from '../desktop/steam-achievements.js';
import { createSteamOwnershipController } from '../desktop/steam-ownership.js';

const payload = (n) => Object.fromEntries([['version', 1], ...STEAM_STATS.map((id) => [id, n])]);
const session = () => ({
  steamId64: '76561198000000001',
  sync: { submit: vi.fn(() => true), flush: vi.fn(() => Promise.resolve()) },
});
const store = (state = 'unowned', claim = true) => ({
  steamOwner: () => state === 'owned'
    ? { state, owner: { version: 1, steamId64: '76561198000000001' } }
    : state === 'mismatch'
      ? { state: 'owned', owner: { version: 1, steamId64: '76561198000000002' } }
      : { state },
  claimSteamOwner: vi.fn(() => claim),
});

describe('Steam ownership controller', () => {
  it('auto-binds zero evidence only after a durable claim', () => {
    const s = session(); const saves = store();
    const owner = createSteamOwnershipController({ session: s, store: saves });
    owner.submit(payload(0));
    expect(saves.claimSteamOwner).toHaveBeenCalledOnce();
    expect(owner.state()).toBe('eligible');
    expect(s.sync.submit).toHaveBeenCalledOnce();
  });

  it('requires confirmation for positive legacy evidence and can accept or decline', () => {
    const acceptedSession = session(); const acceptedStore = store();
    const accepted = createSteamOwnershipController({ session: acceptedSession, store: acceptedStore });
    accepted.submit(payload(2));
    expect(accepted.state()).toBe('claim-required');
    expect(acceptedSession.sync.submit).not.toHaveBeenCalled();
    expect(accepted.accept()).toBe(true);
    expect(acceptedSession.sync.submit).toHaveBeenCalledWith(payload(2));

    const declinedSession = session();
    const declined = createSteamOwnershipController({ session: declinedSession, store: store() });
    declined.submit(payload(2));
    expect(declined.decline()).toBe(true);
    expect(declined.state()).toBe('declined');
    expect(declinedSession.sync.submit).not.toHaveBeenCalled();
  });

  it('allows matches and blocks mismatch, invalid, unavailable, and failed claims', async () => {
    const matchedSession = session();
    const matched = createSteamOwnershipController({ session: matchedSession, store: store('owned') });
    matched.submit(payload(1));
    expect(matchedSession.sync.submit).toHaveBeenCalledOnce();

    for (const [saves, steamSession, expected] of [
      [store('mismatch'), session(), 'mismatch'],
      [store('invalid'), session(), 'invalid'],
      [store(), null, 'unavailable'],
      [store('unowned', false), session(), 'invalid'],
    ]) {
      const owner = createSteamOwnershipController({ session: steamSession, store: saves });
      owner.submit(payload(0));
      expect(owner.state()).toBe(expected);
      if (steamSession) {
        expect(steamSession.sync.submit).not.toHaveBeenCalled();
        await owner.flush();
        expect(steamSession.sync.flush).not.toHaveBeenCalled();
      }
    }
  });
});
