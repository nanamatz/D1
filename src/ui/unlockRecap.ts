import { CHALLENGE_DEFS, isChallengeUnlocked } from '../engine/challenges';
import { POUCH_DEFS, isPouchUnlocked } from '../engine/pouches';
import { RECORD_DEFS, isRecordUnlocked } from '../engine/records';
import type { PouchId, RunState, VoucherId } from '../engine/types';
import { collectionSize } from './collection';
import { EMOJI_UNLOCK_RULES, loadEmojiUnlockProgress } from './emojiUnlocks';
import { loadLifetime, recordWinsForPouch } from './lifetime';
import { UNLOCKS, activeUnlocks } from './unlocks';
import { VOUCHER_UNLOCK_RULES, loadVoucherProgress } from './voucherProgress';

export type UnlockCategory = 'palette' | 'emoji' | 'voucher' | 'pouch' | 'record' | 'challenge';

export interface UnlockNotice {
  category: UnlockCategory;
  id: string;
  /** Record availability is per Pouch, so its card always carries that context. */
  contextId?: PouchId;
}

const CATEGORIES: readonly UnlockCategory[] = [
  'palette', 'emoji', 'voucher', 'pouch', 'record', 'challenge',
];
const categorySet = new Set<string>(CATEGORIES);
const paletteIds = new Set(UNLOCKS.map((def) => def.id));
const emojiIds = new Set(EMOJI_UNLOCK_RULES.map((rule) => rule.id));
const voucherIds = new Set(VOUCHER_UNLOCK_RULES.map((rule) => rule.id));
const pouchIds = new Set(POUCH_DEFS.filter((def) => def.unlock.kind !== 'default').map((def) => def.id));
const recordContextIds = new Set(POUCH_DEFS.map((def) => def.id));
const recordIds = new Set(RECORD_DEFS.filter((def) => def.requiresWin !== null).map((def) => def.id));
const challengeIds = new Set(CHALLENGE_DEFS.slice(1).map((def) => def.id));
const keyOf = ({ category, id, contextId }: UnlockNotice): string =>
  category === 'record' ? `${category}:${contextId}:${id}` : `${category}:${id}`;

/** One codec boundary validates both arity and live registry membership. */
function isKnownUnlockNotice(notice: UnlockNotice): boolean {
  switch (notice.category) {
    case 'palette': return paletteIds.has(notice.id);
    case 'emoji': return emojiIds.has(notice.id);
    case 'voucher': return voucherIds.has(notice.id as VoucherId);
    case 'pouch': return pouchIds.has(notice.id as PouchId);
    case 'record':
      return notice.contextId !== undefined && recordContextIds.has(notice.contextId) &&
        recordIds.has(notice.id as (typeof RECORD_DEFS)[number]['id']);
    case 'challenge': return challengeIds.has(notice.id as (typeof CHALLENGE_DEFS)[number]['id']);
  }
}

export function decodeUnlockNotice(value: string): UnlockNotice | null {
  const parts = value.split(':');
  const [category, first, second] = parts;
  if (!category || !categorySet.has(category) || !first) return null;
  if (category === 'record') {
    if (parts.length !== 3 || !second) return null;
    const notice: UnlockNotice = { category, contextId: first as PouchId, id: second };
    return isKnownUnlockNotice(notice) ? notice : null;
  }
  if (parts.length !== 2) return null;
  const notice: UnlockNotice = { category: category as UnlockCategory, id: first };
  return isKnownUnlockNotice(notice) ? notice : null;
}

/** Current real availability gates only; discovery/mastery surfaces are deliberately absent. */
export function captureUnlockSnapshot(): string[] {
  const palette = activeUnlocks();
  const emoji = new Set(loadEmojiUnlockProgress().unlocked);
  const vouchers = new Set(loadVoucherProgress().unlocked);
  const lifetime = loadLifetime();
  const pouchProgress = {
    discoveredWords: collectionSize(),
    pouchWins: new Set(lifetime.pouchWins),
    recordWins: new Set(lifetime.recordWins),
  };
  const completedChallenges = new Set(lifetime.completedChallenges);
  const notices: UnlockNotice[] = [
    ...UNLOCKS.filter((def) => palette.has(def.id))
      .map((def) => ({ category: 'palette' as const, id: def.id })),
    ...EMOJI_UNLOCK_RULES.filter((rule) => emoji.has(rule.id))
      .map((rule) => ({ category: 'emoji' as const, id: rule.id })),
    ...VOUCHER_UNLOCK_RULES.filter((rule) => vouchers.has(rule.id))
      .map((rule) => ({ category: 'voucher' as const, id: rule.id })),
    ...POUCH_DEFS.filter((def) => def.unlock.kind !== 'default' && isPouchUnlocked(def.id, pouchProgress))
      .map((def) => ({ category: 'pouch' as const, id: def.id })),
    ...POUCH_DEFS.flatMap((pouch) => {
      const wins = recordWinsForPouch(lifetime, pouch.id);
      return RECORD_DEFS
        .filter((record) => record.requiresWin !== null && isRecordUnlocked(record.id, wins))
        .map((record) => ({ category: 'record' as const, contextId: pouch.id, id: record.id }));
    }),
    ...CHALLENGE_DEFS.slice(1)
      .filter((def) => isChallengeUnlocked(def.id, completedChallenges))
      .map((def) => ({ category: 'challenge' as const, id: def.id })),
  ];
  return notices.map(keyOf);
}

const BASE = 'baseline:';
const PENDING = 'pending:';
const READY = 'recap-ready';
const MAX_LEDGER_ENTRIES = 512;
const MAX_LEDGER_ENTRY_LENGTH = 128;
const dedupe = (values: readonly string[]): string[] => [...new Set(values)];

/** Persistence boundary sanitizer: bounded, strings-only, and live-codec-valid. */
export function sanitizeUnlockLedger(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = value.slice(0, MAX_LEDGER_ENTRIES).filter((entry): entry is string => {
    if (typeof entry !== 'string' || entry.length > MAX_LEDGER_ENTRY_LENGTH) return false;
    if (entry === READY || paletteIds.has(entry)) return true;
    if (entry.startsWith(BASE)) return decodeUnlockNotice(entry.slice(BASE.length)) !== null;
    if (entry.startsWith(PENDING)) return decodeUnlockNotice(entry.slice(PENDING.length)) !== null;
    return false;
  });
  return dedupe(valid);
}

export function createUnlockLedger(snapshot: readonly string[] = captureUnlockSnapshot()): string[] {
  return dedupe(snapshot).map((key) => `${BASE}${key}`);
}

/** Upgrade palette-only legacy saves without claiming unrelated historic unlocks as new. */
export function normalizeUnlockLedger(
  ledger: readonly string[],
  snapshot: readonly string[] = captureUnlockSnapshot(),
): string[] {
  const values = dedupe(ledger);
  if (values.some((value) => value.startsWith(BASE))) return values;
  const legacyPalette = new Set(values.filter((value) => UNLOCKS.some((def) => def.id === value)));
  return [
    ...snapshot.filter((key) => {
      const notice = decodeUnlockNotice(key);
      return notice?.category !== 'palette' || !legacyPalette.has(notice.id);
    }).map((key) => `${BASE}${key}`),
    ...values,
  ];
}

function categoryEligible(category: UnlockCategory, run: RunState): boolean {
  if (run.customSeed) return category === 'palette' || category === 'pouch';
  if (run.challengeId != null) {
    return category === 'palette' || category === 'emoji' ||
      category === 'voucher' || category === 'pouch' || category === 'challenge';
  }
  return true;
}

/** Freeze the terminal recap payload into persisted GameState and force a React rerender. */
export function finalizeUnlockLedger(
  ledger: readonly string[],
  run: RunState,
  snapshot: readonly string[] = captureUnlockSnapshot(),
): string[] {
  const normalized = loadLifetime().unlockAllApplied
    ? [
        ...createUnlockLedger(snapshot),
        ...ledger.filter((value) => value.startsWith(PENDING) ||
          UNLOCKS.some((def) => def.id === value)),
      ]
    : normalizeUnlockLedger(ledger, snapshot);
  const baseline = new Set(normalized
    .filter((value) => value.startsWith(BASE))
    .map((value) => value.slice(BASE.length)));
  const pending = normalized
    .filter((value) => value.startsWith(PENDING))
    .map((value) => value.slice(PENDING.length));
  // Old raw ids are Palette notices in their actual play order.
  for (const value of normalized) {
    if (UNLOCKS.some((def) => def.id === value)) pending.push(`palette:${value}`);
  }
  for (const key of snapshot) {
    const notice = decodeUnlockNotice(key);
    if (notice && categoryEligible(notice.category, run) && !baseline.has(key)) pending.push(key);
  }
  return [
    ...normalized.filter((value) => value.startsWith(BASE)),
    ...dedupe(pending).map((key) => `${PENDING}${key}`),
    READY,
  ];
}

export const unlockRecapReady = (ledger: readonly string[]): boolean => ledger.includes(READY);

export const resetUnlockRecapTerminal = (ledger: readonly string[]): string[] =>
  ledger.filter((value) => value !== READY);

export function pendingUnlocks(ledger: readonly string[]): UnlockNotice[] {
  const keys = [
    ...ledger.filter((value) => value.startsWith(PENDING)).map((value) => value.slice(PENDING.length)),
    ...ledger.filter((value) => UNLOCKS.some((def) => def.id === value)).map((id) => `palette:${id}`),
  ];
  const seen = new Set<string>();
  return keys.flatMap((key) => {
    const notice = decodeUnlockNotice(key);
    if (!notice || seen.has(key)) return [];
    seen.add(key);
    return [notice];
  });
}

/** Confirming advances the baseline, so Published -> Endless cannot repeat old cards. */
export function acknowledgeUnlockLedger(ledger: readonly string[]): string[] {
  const baseline = ledger
    .filter((value) => value.startsWith(BASE))
    .map((value) => value.slice(BASE.length));
  const confirmed = pendingUnlocks(ledger).map(keyOf);
  return [...dedupe([...baseline, ...confirmed]).map((key) => `${BASE}${key}`), READY];
}
