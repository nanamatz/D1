/**
 * Two-tier voucher registry (GDD §9.4).
 *
 * Effects are either applied once on purchase (resource knobs) or exposed as
 * pure derived helpers for the engine systems that consume them.
 */
import { BALANCE } from './balance';
import type { JokerEdition, PatternId, RunState, VoucherId } from './types';
import {
  CONSTELLATION_PATTERN,
  PATTERN_CONSTELLATION,
} from './constellations';

export interface VoucherDef {
  id: VoucherId;
  nameEn: string;
  nameKo: string;
  /** Text fallback only; UI uses voucherArt(id). */
  emoji: string;
  price: number;
  tier: 'base' | 'upgrade';
  baseId?: VoucherId;
}

const base = (id: VoucherId, nameEn: string, nameKo: string): VoucherDef => ({
  id, nameEn, nameKo, emoji: '🎟️', price: BALANCE.voucherPrice, tier: 'base',
});
const upgrade = (
  id: VoucherId,
  baseId: VoucherId,
  nameEn: string,
  nameKo: string,
): VoucherDef => ({
  id, baseId, nameEn, nameKo, emoji: '🎟️', price: BALANCE.voucherPrice, tier: 'upgrade',
});

const VOUCHERS: readonly VoucherDef[] = [
  base('storyBook', 'Story Book', '이야기책'),
  upgrade('novel', 'storyBook', 'Novel', '소설'),
  base('bible', 'Bible', '성경'),
  upgrade('theLaw', 'bible', 'The Law', '법전'),
  base('fashionBook', 'Fashion Book', '패션북'),
  upgrade('fashionMagazine', 'fashionBook', 'Fashion Magazine', '패션 잡지'),
  base('newspaper', 'Newspaper', '신문'),
  upgrade('papyrus', 'newspaper', 'Papyrus', '파피루스'),
  base('flyer', 'Flyer', '전단지'),
  upgrade('wantedPoster', 'flyer', 'Wanted Poster', '수배 전단'),
  base('memo', 'Memo', '메모'),
  upgrade('notebook', 'memo', 'Notebook', '노트'),
  base('poetryBook', 'Poetry Book', '시집'),
  upgrade('sheetMusic', 'poetryBook', 'Sheet Music', '악보'),
  base('fourCutPhoto', 'Four-cut Photo', '네컷 사진'),
  upgrade('pictureDiary', 'fourCutPhoto', 'Picture Diary', '그림일기'),
  base('enKoDictionary', 'EN-KO Dictionary', '영한사전'),
  upgrade('encyclopedia', 'enKoDictionary', 'Encyclopedia', '백과사전'),
  base('receipt', 'Receipt', '영수증'),
  upgrade('householdLedger', 'receipt', 'Household Ledger', '가계부'),
  base('sketchBook', 'Sketch Book', '스케치북'),
  upgrade('portrait', 'sketchBook', 'Portrait', '초상화'),
  base('catalog', 'Catalog', '카탈로그'),
  upgrade('couponBook', 'catalog', 'Coupon Book', '쿠폰북'),
  base('historyBook', 'History Book', '역사책'),
  upgrade('oldBook', 'historyBook', 'Old Book', '고서'),
  base('blankPaper', 'Blank Paper', '백지'),
  upgrade('kungfuManual', 'blankPaper', 'Kung Fu Manual', '무공비급'),
  base('bwPhoto', 'B&W Photo', '흑백사진'),
  upgrade('yearBook', 'bwPhoto', 'Yearbook', '졸업앨범'),
  base('zeroScore', 'Zero Score', '0점 시험지'),
  upgrade('comicBook', 'zeroScore', 'Comic Book', '만화책'),
];

export const VOUCHER_REGISTRY: ReadonlyMap<VoucherId, VoucherDef> =
  new Map(VOUCHERS.map((v) => [v.id, v]));
export const ALL_VOUCHER_IDS: readonly VoucherId[] = VOUCHERS.map((v) => v.id);
export const BASE_VOUCHER_IDS: readonly VoucherId[] =
  VOUCHERS.filter((v) => v.tier === 'base').map((v) => v.id);
export const hasVoucher = (run: RunState, id: VoucherId): boolean => run.vouchers.includes(id);

/** Base vouchers are always eligible. An upgrade also needs its profile unlock
 * and its base voucher in the current run. */
export function availableVoucherIds(
  run: RunState,
  profileUnlocked: ReadonlySet<VoucherId> = new Set(),
): VoucherId[] {
  return VOUCHERS.filter((def) => {
    if (run.vouchers.includes(def.id)) return false;
    if (def.tier === 'base') return true;
    return profileUnlocked.has(def.id) && !!def.baseId && run.vouchers.includes(def.baseId);
  }).map((def) => def.id);
}

/** Apply one-time resource changes and record ownership. */
export function applyVoucher(run: RunState, id: VoucherId): RunState {
  let r = run;
  switch (id) {
    case 'memo':
    case 'notebook':
      r = { ...r, basePhases: r.basePhases + 1 };
      break;
    case 'poetryBook':
    case 'sheetMusic':
      r = { ...r, baseDiscards: r.baseDiscards + 1 };
      break;
    case 'fourCutPhoto':
    case 'pictureDiary':
      r = { ...r, handSize: r.handSize + 1 };
      break;
    // History Book / Old Book send the run BACK an ante (feedback 5): ante −1
    // (may reach 0) while preserving the already-scheduled blind. Their secondary
    // effect matches the tooltip — History Book −1 hand, Old Book −1 discard.
    case 'historyBook':
      r = { ...r, ante: Math.max(0, r.ante - 1), handSize: Math.max(1, r.handSize - 1) };
      break;
    case 'oldBook':
      r = { ...r, ante: Math.max(0, r.ante - 1), baseDiscards: Math.max(0, r.baseDiscards - 1) };
      break;
    case 'kungfuManual':
      r = { ...r, jokerSlots: r.jokerSlots + 1 };
      break;
    case 'zeroScore':
      r = { ...r, consumableSlots: r.consumableSlots + 1 };
      break;
    default:
      break;
  }
  return { ...r, vouchers: [...r.vouchers, id] };
}

export const rerollDiscount = (run: RunState): number =>
  (hasVoucher(run, 'fashionBook') ? BALANCE.voucher.rerollDiscount : 0) +
  (hasVoucher(run, 'fashionMagazine') ? BALANCE.voucher.rerollDiscount : 0);

export const interestCap = (run: RunState): number =>
  hasVoucher(run, 'householdLedger')
    ? BALANCE.voucher.upgradedInterestCap
    : hasVoucher(run, 'receipt')
      ? BALANCE.voucher.baseInterestCap
      : BALANCE.interest.cap;

export const shopItemSlots = (run: RunState): number =>
  BALANCE.shop.itemSlots +
  (hasVoucher(run, 'catalog') ? 1 : 0) +
  (hasVoucher(run, 'couponBook') ? 1 : 0);

export const shopDiscount = (run: RunState): number =>
  hasVoucher(run, 'papyrus')
    ? BALANCE.voucher.upgradedShopDiscount
    : hasVoucher(run, 'newspaper')
      ? BALANCE.voucher.baseShopDiscount
      : 0;

export const discountedPrice = (run: RunState, price: number): number =>
  Math.max(1, Math.floor(price * (1 - shopDiscount(run))));

export const fableShopWeight = (run: RunState): number =>
  hasVoucher(run, 'novel')
    ? BALANCE.voucher.upgradedShopWeightMultiplier
    : hasVoucher(run, 'storyBook')
      ? BALANCE.voucher.baseShopWeightMultiplier
      : 1;

export const constellationShopWeight = (run: RunState): number =>
  hasVoucher(run, 'theLaw')
    ? BALANCE.voucher.upgradedShopWeightMultiplier
    : hasVoucher(run, 'bible')
      ? BALANCE.voucher.baseShopWeightMultiplier
      : 1;

export const editionRateMultiplier = (run: RunState): number =>
  hasVoucher(run, 'wantedPoster') ? 4 : hasVoucher(run, 'flyer') ? 2 : 1;

export const shopSellsTiles = (run: RunState): boolean => hasVoucher(run, 'enKoDictionary');
export const shopTilesCanBeEnhanced = (run: RunState): boolean => hasVoucher(run, 'encyclopedia');
export const fablePacksContainInk = (run: RunState): boolean => hasVoucher(run, 'comicBook');

export const bossRerollLimit = (run: RunState): number =>
  hasVoucher(run, 'portrait') ? Number.POSITIVE_INFINITY : hasVoucher(run, 'sketchBook') ? 1 : 0;

export const bossRerollPrice = (): number => BALANCE.voucher.bossRerollPrice;

export function mostPlayedPattern(run: RunState): PatternId | null {
  const rows = Object.entries(run.patternPlayCounts) as [PatternId, number][];
  const max = Math.max(0, ...rows.map(([, count]) => count));
  return max > 0 ? (rows.find(([, count]) => count === max)?.[0] ?? null) : null;
}

export const constellationPassiveFactor = (run: RunState, pattern: PatternId | null): number => {
  if (!pattern || !hasVoucher(run, 'yearBook')) return 1;
  const cardId = PATTERN_CONSUMABLE[pattern];
  if (!cardId) return 1;
  const copies = run.consumables.filter((id) => id === cardId).length;
  return Math.pow(BALANCE.edition.rainbowFactor, copies);
};

type JokerCapability = {
  slots?: number;
  shopDiscount?: number;
  allowsDuplicates?: boolean;
};

const JOKER_CAPABILITIES: Readonly<Record<string, JokerCapability>> = {
  bookOfMargins: { slots: BALANCE.jokers.bookOfMargins.slots },
  carteBlanche: { shopDiscount: BALANCE.jokers.carteBlanche.shopDiscount },
  copyEditor: { allowsDuplicates: true },
};

/** Resolve passive definition capabilities at each physical shelf position.
 * Echo chains walk right; target identity/edition is never copied. */
const effectiveJokerCapabilities = (run: RunState): JokerCapability[] => {
  const resolveAt = (index: number, visited: Set<number>): JokerCapability | null => {
    const owner = run.jokers[index];
    if (!owner || owner.state.destroyed === 1 || owner.state.bossDisabled === 1) return null;
    const identity = owner.instanceId ?? -(index + 1);
    if (visited.has(identity)) return null;
    visited.add(identity);
    if (owner.defId === 'towerOfBabel') return null;
    if (owner.defId === 'echoChamber') return resolveAt(index + 1, visited);
    return JOKER_CAPABILITIES[owner.defId] ?? null;
  };
  return run.jokers.flatMap((_, index) => {
    const capability = resolveAt(index, new Set());
    return capability ? [capability] : [];
  });
};

export const jokerSlotLimit = (run: RunState): number =>
  run.jokerSlots +
  run.jokers.filter((joker) =>
    joker.edition === 'white' && joker.state.destroyed !== 1 && joker.state.bossDisabled !== 1
  ).length +
  effectiveJokerCapabilities(run).reduce((sum, capability) => sum + (capability.slots ?? 0), 0);

export const emojiTileShopPrice = (run: RunState, price: number): number =>
  Math.max(
    0,
    price -
      effectiveJokerCapabilities(run).reduce(
        (sum, capability) => sum + (capability.shopDiscount ?? 0),
        0,
      ),
  );

/** Copy Editor is the sole persistent exception to ordinary ownership uniqueness. */
export const allowsDuplicateOffers = (run: RunState): boolean =>
  effectiveJokerCapabilities(run).some((capability) => capability.allowsDuplicates);

/** Central duplicate rule for ordinary Emoji Tile offers and acquisitions. */
export const canOwnJoker = (run: RunState, defId: string): boolean =>
  allowsDuplicateOffers(run) || !run.jokers.some((joker) => joker.defId === defId);

/** Profile progression is supplied by the UI; omitted means an unrestricted
 * headless simulation/test pool. */
export const isJokerProfileEligible = (
  defId: string,
  profileEligible?: ReadonlySet<string>,
): boolean => profileEligible === undefined || profileEligible.has(defId);

/** Shared uniqueness gate for Fable, Constellation, and Gambler cards. */
export const canOwnConsumable = (run: RunState, id: import('./types').ConsumableId): boolean =>
  id === 'magnifier' || allowsDuplicateOffers(run) || !run.consumables.includes(id);

export const canAddJoker = (
  run: RunState,
  defId: string,
  edition: JokerEdition = 'base',
  profileEligible?: ReadonlySet<string>,
): boolean =>
  isJokerProfileEligible(defId, profileEligible) &&
  canOwnJoker(run, defId) &&
  run.jokers.length < jokerSlotLimit(run) + (edition === 'white' ? 1 : 0);

export const PATTERN_CONSUMABLE: Record<PatternId, import('./types').ConsumableId> =
  PATTERN_CONSTELLATION;

export const CONSUMABLE_PATTERN: Partial<Record<import('./types').ConsumableId, PatternId>> =
  CONSTELLATION_PATTERN;
