import type { ChallengeId, PouchId, RecordId } from './types';

export interface ChallengeDef {
  id: ChallengeId;
  pouchId: PouchId;
  recordId: RecordId;
}

export const CHALLENGE_DEFS: readonly ChallengeDef[] = [
  { id: 'redPen', pouchId: 'yellow', recordId: 'redLp' },
  { id: 'risingQuota', pouchId: 'green', recordId: 'greenLp' },
  { id: 'narrowDesk', pouchId: 'fiveColor', recordId: 'yellowLp' },
  { id: 'threePasses', pouchId: 'leather', recordId: 'clearLp' },
  { id: 'balancedBurden', pouchId: 'lunchBag', recordId: 'cd' },
  { id: 'randomFinal', pouchId: 'coinPurse', recordId: 'dvd' },
];

export const CHALLENGE_IDS: readonly ChallengeId[] = CHALLENGE_DEFS.map((def) => def.id);

export function isChallengeId(value: unknown): value is ChallengeId {
  return typeof value === 'string' && CHALLENGE_IDS.includes(value as ChallengeId);
}

export function challengeDef(id: ChallengeId): ChallengeDef {
  return CHALLENGE_DEFS.find((def) => def.id === id)!;
}

export function isChallengeUnlocked(
  id: ChallengeId,
  completed: ReadonlySet<ChallengeId>,
): boolean {
  const index = CHALLENGE_IDS.indexOf(id);
  return index === 0 || completed.has(CHALLENGE_IDS[index - 1]!);
}
