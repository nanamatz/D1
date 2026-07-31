import { BALANCE } from './balance';
import { GAMBLER_IDS } from './gamblers';
import type { Rng } from './rng';
import { applyVoucher } from './vouchers';
import { isVowel } from './types';
import type {
  ConsumableId,
  Letter,
  PouchId,
  RecordId,
  RunState,
  VoucherId,
} from './types';

export type PouchUnlock =
  | { kind: 'default' }
  | { kind: 'words'; count: number }
  | { kind: 'pouchWin'; id: PouchId }
  | { kind: 'recordWin'; id: RecordId };

export interface PouchDef {
  id: PouchId;
  unlock: PouchUnlock;
}

export const POUCH_DEFS: readonly PouchDef[] = [
  { id: 'yellow', unlock: { kind: 'default' } },
  { id: 'blue', unlock: { kind: 'words', count: BALANCE.pouches.unlockWords.blue } },
  { id: 'green', unlock: { kind: 'words', count: BALANCE.pouches.unlockWords.green } },
  { id: 'purple', unlock: { kind: 'words', count: BALANCE.pouches.unlockWords.purple } },
  { id: 'lucky', unlock: { kind: 'pouchWin', id: 'yellow' } },
  { id: 'fiveColor', unlock: { kind: 'pouchWin', id: 'blue' } },
  { id: 'golden', unlock: { kind: 'pouchWin', id: 'green' } },
  { id: 'leather', unlock: { kind: 'pouchWin', id: 'purple' } },
  { id: 'military', unlock: { kind: 'recordWin', id: 'whiteLp' } },
  { id: 'luxury', unlock: { kind: 'recordWin', id: 'redLp' } },
  { id: 'pencilCase', unlock: { kind: 'recordWin', id: 'greenLp' } },
  { id: 'lunchBag', unlock: { kind: 'recordWin', id: 'blueLp' } },
  { id: 'shoppingBasket', unlock: { kind: 'recordWin', id: 'yellowLp' } },
  { id: 'coinPurse', unlock: { kind: 'recordWin', id: 'clearLp' } },
];

export const POUCH_IDS: readonly PouchId[] = POUCH_DEFS.map((def) => def.id);

export interface PouchUnlockProgress {
  discoveredWords: number;
  pouchWins: ReadonlySet<PouchId>;
  recordWins: ReadonlySet<RecordId>;
}

export function isPouchUnlocked(id: PouchId, progress: PouchUnlockProgress): boolean {
  const unlock = POUCH_DEFS.find((def) => def.id === id)?.unlock;
  if (!unlock || unlock.kind === 'default') return true;
  if (unlock.kind === 'words') return progress.discoveredWords >= unlock.count;
  if (unlock.kind === 'pouchWin') return progress.pouchWins.has(unlock.id);
  return progress.recordWins.has(unlock.id);
}

const addVouchers = (run: RunState, ids: readonly VoucherId[]): RunState =>
  ids.reduce((current, id) => applyVoucher(current, id), run);

const addConsumables = (run: RunState, ids: readonly ConsumableId[]): RunState => ({
  ...run,
  consumables: [...run.consumables, ...ids],
});

/**
 * Apply the selected starting pouch once, before Chapter 1 stock and boss rolls.
 * Random setup uses its own seeded RNG supplied by newRun.
 */
export function applyStartingPouch(run: RunState, rng: Rng): RunState {
  let next = run;
  switch (run.pouchId) {
    case 'yellow':
      next = { ...next, baseDiscards: next.baseDiscards + BALANCE.pouches.yellow.discards };
      break;
    case 'blue':
      next = { ...next, basePhases: next.basePhases + BALANCE.pouches.blue.phases };
      break;
    case 'green':
      next = { ...next, gold: next.gold + BALANCE.pouches.green.gold };
      break;
    case 'lucky':
      next = addConsumables(next, [GAMBLER_IDS[rng.int(GAMBLER_IDS.length)]!]);
      break;
    case 'fiveColor':
      next = {
        ...next,
        handSize: next.handSize + BALANCE.pouches.fiveColor.handSize,
        jokerSlots: Math.max(0, next.jokerSlots + BALANCE.pouches.fiveColor.jokerSlots),
      };
      break;
    case 'golden':
      next = {
        ...next,
        bag: next.bag.map((tile) =>
          isVowel(tile.letter) ? { ...tile, material: 'brass' as const } : tile,
        ),
      };
      break;
    case 'leather':
      next = {
        ...next,
        jokerSlots: Math.max(0, next.jokerSlots + BALANCE.pouches.leather.jokerSlots),
        basePhases: Math.max(1, next.basePhases + BALANCE.pouches.leather.phases),
      };
      break;
    case 'military':
      next = addVouchers(
        {
          ...next,
          consumableSlots: Math.max(
            0,
            next.consumableSlots + BALANCE.pouches.military.consumableSlots,
          ),
        },
        ['bwPhoto'],
      );
      break;
    case 'luxury':
      next = addConsumables(addVouchers(next, ['newspaper']), ['fable9', 'fable9']);
      break;
    case 'pencilCase':
      next = addConsumables(addVouchers(next, ['zeroScore']), ['fable2', 'fable2']);
      break;
    case 'shoppingBasket':
      next = addVouchers(next, ['storyBook', 'bible', 'catalog']);
      break;
    case 'coinPurse': {
      const alphabet = Object.keys(BALANCE.bagComposition) as Letter[];
      next = {
        ...next,
        bag: next.bag.map((tile) => ({ ...tile, letter: alphabet[rng.int(alphabet.length)]! })),
      };
      break;
    }
    case 'purple':
    case 'lunchBag':
      break;
  }
  return next;
}

export const pouchDisablesInterest = (run: RunState): boolean => run.pouchId === 'purple';

export const pouchPhaseGoldRate = (run: RunState): number =>
  run.pouchId === 'purple'
    ? BALANCE.pouches.purple.phaseGold
    : BALANCE.goldPerRemainingPhase;

export const pouchDiscardGoldRate = (run: RunState): number =>
  run.pouchId === 'purple' ? BALANCE.pouches.purple.discardGold : 0;

export const pouchTargetMultiplier = (run: RunState): number =>
  run.pouchId === 'lunchBag' ? BALANCE.pouches.lunchBag.targetMult : 1;

export const pouchAllowsGamblerShop = (run: RunState): boolean => run.pouchId === 'lucky';

/** Briefcase balances both score axes after all normal hooks. */
export function balancePouchAxes(
  run: RunState,
  chips: number,
  mult: number,
): { chips: number; mult: number } {
  if (run.pouchId !== 'lunchBag') return { chips, mult };
  const mean = (chips + mult) / 2;
  return { chips: mean, mult: mean };
}
