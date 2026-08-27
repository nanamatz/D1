/**
 * Profile-scoped voucher unlock progress. This deliberately stays outside the
 * headless engine; only aggregate counters/unlocked upgrade ids are persisted.
 */
import type { VoucherId } from '../engine/types';
import { BALANCE } from '../engine/balance';
import { CORE_BOSS_IDS } from '../engine/bosses';
import {
  activeProfile,
  readProfileValue,
  writeValue,
  type ProfileSlot,
} from './storage';

const KEY = 'wj.vouchers';

export interface VoucherProgress {
  unlocked: VoucherId[];
  fableBought: number;
  constellationBought: number;
  shopRerolls: number;
  tilesPlayed: number;
  tilesDiscarded: number;
  tilesBought: number;
  goldSpent: number;
  highestAnte: number;
  wins: number;
  blankPaperUses: number;
  constellationUsed: number;
  fableUsed: number;
  interestStreak: number;
  maxInterestStreak: number;
  bossesSeen: string[];
  /** null until a hand size has been observed; serializes without ambiguity. */
  lowestHandSize: number | null;
  currentRunVoucherUses: number;
  maxRunVoucherUses: number;
  maxEditionedJokersOwned: number;
  /** False for custom-seeded runs, whose play never advances Voucher achievements. */
  currentRunEligible: boolean;
}

const EMPTY: VoucherProgress = {
  unlocked: [],
  fableBought: 0,
  constellationBought: 0,
  shopRerolls: 0,
  tilesPlayed: 0,
  tilesDiscarded: 0,
  tilesBought: 0,
  goldSpent: 0,
  highestAnte: 0,
  wins: 0,
  blankPaperUses: 0,
  constellationUsed: 0,
  fableUsed: 0,
  interestStreak: 0,
  maxInterestStreak: 0,
  bossesSeen: [],
  lowestHandSize: null,
  currentRunVoucherUses: 0,
  maxRunVoucherUses: 0,
  maxEditionedJokersOwned: 0,
  currentRunEligible: true,
};

export type VoucherProgressEvent =
  | { kind: 'newRun'; handSize: number; customSeed: boolean }
  | { kind: 'resumeRun'; customSeed: boolean }
  | { kind: 'shopBuy'; item: 'fable' | 'constellation' | 'tile' | 'other'; spent: number }
  | { kind: 'reroll'; spent: number }
  | { kind: 'packBuy'; spent: number }
  | { kind: 'voucherBuy'; id: VoucherId; spent: number }
  | { kind: 'tilesPlayed'; count: number }
  | { kind: 'tilesDiscarded'; count: number }
  | { kind: 'consumableUsed'; family: 'fable' | 'constellation' | 'gambler' }
  | { kind: 'handSize'; size: number }
  | { kind: 'anteReached'; ante: number }
  | { kind: 'runWon' }
  | { kind: 'bossSeen'; id: string }
  | { kind: 'blindCleared'; ante: number; bossId: string | null; interest: number; interestCap: number; handSize: number }
  | { kind: 'editionedJokers'; count: number };

export interface VoucherUnlockRule {
  id: VoucherId;
  conditionEn: string;
  conditionKo: string;
  met: (p: VoucherProgress) => boolean;
}

export const VOUCHER_UNLOCK_RULES: readonly VoucherUnlockRule[] = [
  { id: 'novel', conditionEn: 'Buy 50 Fable cards from the Stationery Shop', conditionKo: '문방구에서 우화 카드 50장 구매', met: (p) => p.fableBought >= BALANCE.voucher.unlockTargets.novel },
  { id: 'theLaw', conditionEn: 'Buy 50 Constellation cards from the Stationery Shop', conditionKo: '문방구에서 별자리 카드 50장 구매', met: (p) => p.constellationBought >= BALANCE.voucher.unlockTargets.theLaw },
  { id: 'fashionMagazine', conditionEn: 'Reroll the Stationery Shop 100 times', conditionKo: '문방구 새로고침 100회', met: (p) => p.shopRerolls >= BALANCE.voucher.unlockTargets.fashionMagazine },
  { id: 'wantedPoster', conditionEn: 'Own 5 editioned Emoji Tiles at once', conditionKo: '에디션 이모지 타일 5장 동시 보유', met: (p) => p.maxEditionedJokersOwned >= BALANCE.voucher.unlockTargets.wantedPoster },
  { id: 'papyrus', conditionEn: 'Use 10 vouchers in one run', conditionKo: '한 번의 런에서 바우처 10장 사용', met: (p) => p.maxRunVoucherUses >= BALANCE.voucher.unlockTargets.papyrus },
  { id: 'notebook', conditionEn: 'Play 5,000 tiles', conditionKo: '타일 5,000장 플레이', met: (p) => p.tilesPlayed >= BALANCE.voucher.unlockTargets.notebook },
  { id: 'sheetMusic', conditionEn: 'Discard 5,000 tiles', conditionKo: '카드 5,000장 버리기', met: (p) => p.tilesDiscarded >= BALANCE.voucher.unlockTargets.sheetMusic },
  { id: 'pictureDiary', conditionEn: 'Reduce hand size to 8', conditionKo: '핸드 크기를 8장으로 감소', met: (p) => p.lowestHandSize !== null && p.lowestHandSize <= BALANCE.voucher.unlockTargets.pictureDiary },
  { id: 'encyclopedia', conditionEn: 'Buy 20 tiles from the Stationery Shop', conditionKo: '문방구에서 타일 20장 구매', met: (p) => p.tilesBought >= BALANCE.voucher.unlockTargets.encyclopedia },
  { id: 'householdLedger', conditionEn: 'Reach maximum interest for 10 consecutive rounds', conditionKo: '10라운드 연속 최대 이자 획득', met: (p) => p.maxInterestStreak >= BALANCE.voucher.unlockTargets.householdLedger },
  { id: 'portrait', conditionEn: 'Discover all 15 regular boss blinds', conditionKo: '일반 보스 블라인드 15종 발견', met: (p) => CORE_BOSS_IDS.filter((id) => p.bossesSeen.includes(id)).length >= BALANCE.voucher.unlockTargets.portrait },
  { id: 'couponBook', conditionEn: 'Spend $2,500 in Stationery Shops', conditionKo: '문방구에서 총 $2,500 지출', met: (p) => p.goldSpent >= BALANCE.voucher.unlockTargets.couponBook },
  { id: 'oldBook', conditionEn: 'Win a run', conditionKo: '8장 마감 승리', met: (p) => p.wins >= BALANCE.voucher.unlockTargets.oldBook },
  { id: 'kungfuManual', conditionEn: 'Use Blank Paper 10 times', conditionKo: '백지 10회 사용', met: (p) => p.blankPaperUses >= BALANCE.voucher.unlockTargets.kungfuManual },
  { id: 'yearBook', conditionEn: 'Use 100 Constellation cards', conditionKo: '별자리 카드 100장 사용', met: (p) => p.constellationUsed >= BALANCE.voucher.unlockTargets.yearBook },
  { id: 'comicBook', conditionEn: 'Use 50 Fable cards', conditionKo: '우화 카드 50장 사용', met: (p) => p.fableUsed >= BALANCE.voucher.unlockTargets.comicBook },
];

export function loadVoucherProgress(slot: ProfileSlot = activeProfile()): VoucherProgress {
  const stored = readProfileValue<Partial<VoucherProgress>>(KEY, slot);
  if (!stored) return { ...EMPTY };
  return {
    ...EMPTY,
    ...stored,
    lowestHandSize:
      typeof stored.lowestHandSize === 'number' && Number.isFinite(stored.lowestHandSize)
        ? stored.lowestHandSize
        : null,
  };
}

function store(p: VoucherProgress): void {
  writeValue(KEY, p);
}

export function unlockedVoucherSet(): Set<VoucherId> {
  return new Set(loadVoucherProgress().unlocked);
}

export function recordVoucherProgress(event: VoucherProgressEvent): VoucherProgress {
  const p = loadVoucherProgress();
  if (event.kind !== 'newRun' && event.kind !== 'resumeRun' && !p.currentRunEligible) return p;
  const next: VoucherProgress = { ...p, bossesSeen: [...p.bossesSeen], unlocked: [...p.unlocked] };
  if (event.kind === 'resumeRun') {
    next.currentRunEligible = !event.customSeed;
    store(next);
    return next;
  }
  switch (event.kind) {
    case 'newRun':
      next.currentRunVoucherUses = 0;
      next.currentRunEligible = !event.customSeed;
      if (next.currentRunEligible) {
        next.lowestHandSize = Math.min(next.lowestHandSize ?? event.handSize, event.handSize);
      }
      break;
    case 'shopBuy':
      next.goldSpent += event.spent;
      if (event.item === 'fable') next.fableBought += 1;
      if (event.item === 'constellation') next.constellationBought += 1;
      if (event.item === 'tile') next.tilesBought += 1;
      break;
    case 'reroll':
      next.shopRerolls += 1;
      next.goldSpent += event.spent;
      break;
    case 'packBuy':
      next.goldSpent += event.spent;
      break;
    case 'voucherBuy':
      next.goldSpent += event.spent;
      next.currentRunVoucherUses += 1;
      next.maxRunVoucherUses = Math.max(next.maxRunVoucherUses, next.currentRunVoucherUses);
      if (event.id === 'blankPaper') next.blankPaperUses += 1;
      break;
    case 'tilesPlayed':
      next.tilesPlayed += event.count;
      break;
    case 'tilesDiscarded':
      next.tilesDiscarded += event.count;
      break;
    case 'consumableUsed':
      // Gambler cards are their own family: no voucher unlock counts them yet
      // (Comic Book counts Fables, Yearbook counts Constellations — GDD §9.4).
      if (event.family === 'fable') next.fableUsed += 1;
      else if (event.family === 'constellation') next.constellationUsed += 1;
      break;
    case 'handSize':
      next.lowestHandSize = Math.min(next.lowestHandSize ?? event.size, event.size);
      break;
    case 'anteReached':
      next.highestAnte = Math.max(next.highestAnte, event.ante);
      break;
    case 'runWon':
      next.wins += 1;
      break;
    case 'bossSeen':
      if (!next.bossesSeen.includes(event.id)) next.bossesSeen.push(event.id);
      break;
    case 'blindCleared':
      next.highestAnte = Math.max(next.highestAnte, event.ante);
      next.interestStreak = event.interest >= event.interestCap ? next.interestStreak + 1 : 0;
      next.maxInterestStreak = Math.max(next.maxInterestStreak, next.interestStreak);
      break;
    case 'editionedJokers':
      next.maxEditionedJokersOwned = Math.max(next.maxEditionedJokersOwned, event.count);
      break;
  }
  if (!next.currentRunEligible) {
    store(next);
    return next;
  }
  for (const rule of VOUCHER_UNLOCK_RULES) {
    if (rule.met(next) && !next.unlocked.includes(rule.id)) next.unlocked.push(rule.id);
  }
  store(next);
  return next;
}
