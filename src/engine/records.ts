import { BALANCE } from './balance';
import type { RecordId, RunState } from './types';

export interface RecordDef {
  id: RecordId;
  /** White LP is base; every other record unlocks by winning the previous tier. */
  requiresWin: RecordId | null;
}

export const RECORD_DEFS: readonly RecordDef[] = [
  { id: 'whiteLp', requiresWin: null },
  { id: 'redLp', requiresWin: 'whiteLp' },
  { id: 'greenLp', requiresWin: 'redLp' },
  { id: 'blueLp', requiresWin: 'greenLp' },
  { id: 'yellowLp', requiresWin: 'blueLp' },
  { id: 'clearLp', requiresWin: 'yellowLp' },
  { id: 'cd', requiresWin: 'clearLp' },
  { id: 'dvd', requiresWin: 'cd' },
];

export const RECORD_IDS: readonly RecordId[] = RECORD_DEFS.map((def) => def.id);

const rank = (id: RecordId): number => RECORD_IDS.indexOf(id);
const includes = (selected: RecordId, penalty: RecordId): boolean =>
  rank(selected) >= rank(penalty);

export function isRecordUnlocked(id: RecordId, wins: ReadonlySet<RecordId>): boolean {
  const requires = RECORD_DEFS.find((def) => def.id === id)?.requiresWin;
  return requires === null || requires === undefined || wins.has(requires);
}

/** Apply cumulative resource penalties once at run creation. */
export function applyStartingRecord(run: RunState): RunState {
  return {
    ...run,
    handSize: Math.max(
      1,
      run.handSize + (includes(run.recordId, 'blueLp') ? BALANCE.records.blueHandSize : 0),
    ),
    baseDiscards: Math.max(
      0,
      run.baseDiscards +
        (includes(run.recordId, 'yellowLp') ? BALANCE.records.yellowDiscards : 0),
    ),
    basePhases: Math.max(
      1,
      run.basePhases + (includes(run.recordId, 'clearLp') ? BALANCE.records.clearPhases : 0),
    ),
    jokerSlots: Math.max(
      0,
      run.jokerSlots + (includes(run.recordId, 'cd') ? BALANCE.records.cdJokerSlots : 0),
    ),
  };
}

export const recordRemovesDraftReward = (run: RunState): boolean =>
  includes(run.recordId, 'redLp');

export const recordDisablesInterest = (run: RunState): boolean =>
  includes(run.recordId, 'dvd');

export const recordTargetMultiplier = (run: RunState, ante: number): number =>
  includes(run.recordId, 'greenLp')
    ? Math.pow(BALANCE.records.greenTargetGrowth, ante - 1)
    : 1;
