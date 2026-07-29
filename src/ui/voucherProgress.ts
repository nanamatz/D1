/**
 * Profile-scoped voucher unlock progress. This deliberately stays outside the
 * headless engine; only aggregate counters/unlocked upgrade ids are persisted.
 */
import type { VoucherId } from '../engine/types';
import { readValue, writeValue } from './storage';

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
  blankPaperUses: number;
  constellationUsed: number;
  fableUsed: number;
  interestStreak: number;
  maxInterestStreak: number;
  bossesSeen: string[];
  lowestHandSize: number;
  currentRunVoucherUses: number;
  maxRunVoucherUses: number;
  maxEditionedJokersOwned: number;
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
  blankPaperUses: 0,
  constellationUsed: 0,
  fableUsed: 0,
  interestStreak: 0,
  maxInterestStreak: 0,
  bossesSeen: [],
  lowestHandSize: Number.POSITIVE_INFINITY,
  currentRunVoucherUses: 0,
  maxRunVoucherUses: 0,
  maxEditionedJokersOwned: 0,
};

export type VoucherProgressEvent =
  | { kind: 'newRun'; handSize: number }
  | { kind: 'shopBuy'; item: 'fable' | 'constellation' | 'tile' | 'other'; spent: number }
  | { kind: 'reroll'; spent: number }
  | { kind: 'packBuy'; spent: number }
  | { kind: 'voucherBuy'; id: VoucherId; spent: number }
  | { kind: 'tilesPlayed'; count: number }
  | { kind: 'tilesDiscarded'; count: number }
  | { kind: 'consumableUsed'; family: 'fable' | 'constellation' | 'gambler' }
  | { kind: 'handSize'; size: number }
  | { kind: 'anteReached'; ante: number }
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
  { id: 'novel', conditionEn: 'Buy 50 Fable cards from the shop', conditionKo: '상점에서 우화 카드 50장 구매', met: (p) => p.fableBought >= 50 },
  { id: 'theLaw', conditionEn: 'Buy 50 Constellation cards from the shop', conditionKo: '상점에서 별자리 카드 50장 구매', met: (p) => p.constellationBought >= 50 },
  { id: 'fashionMagazine', conditionEn: 'Reroll the shop 100 times', conditionKo: '상점 새로고침 100회', met: (p) => p.shopRerolls >= 100 },
  { id: 'wantedPoster', conditionEn: 'Own 5 editioned Charm cards at once', conditionKo: '에디션 부적 카드 5장 동시 보유', met: (p) => p.maxEditionedJokersOwned >= 5 },
  { id: 'papyrus', conditionEn: 'Use 10 vouchers in one run', conditionKo: '한 번의 런에서 바우처 10장 사용', met: (p) => p.maxRunVoucherUses >= 10 },
  { id: 'notebook', conditionEn: 'Play 5,000 tiles', conditionKo: '타일 5,000장 플레이', met: (p) => p.tilesPlayed >= 5000 },
  { id: 'sheetMusic', conditionEn: 'Discard 5,000 tiles', conditionKo: '카드 5,000장 버리기', met: (p) => p.tilesDiscarded >= 5000 },
  { id: 'pictureDiary', conditionEn: 'Reduce hand size to 8', conditionKo: '손패 크기를 8장으로 감소', met: (p) => p.lowestHandSize <= 8 },
  { id: 'encyclopedia', conditionEn: 'Buy 20 tiles from the shop', conditionKo: '상점에서 타일 20장 구매', met: (p) => p.tilesBought >= 20 },
  { id: 'householdLedger', conditionEn: 'Reach maximum interest for 10 consecutive rounds', conditionKo: '10라운드 연속 최대 이자 획득', met: (p) => p.maxInterestStreak >= 10 },
  { id: 'portrait', conditionEn: 'Discover all 12 current boss blinds', conditionKo: '현재 보스 블라인드 12종 발견', met: (p) => p.bossesSeen.length >= 12 },
  { id: 'couponBook', conditionEn: 'Spend $2,500 in shops', conditionKo: '상점에서 총 $2,500 지출', met: (p) => p.goldSpent >= 2500 },
  { id: 'oldBook', conditionEn: 'Reach Ante 12', conditionKo: '앤티 12 도달', met: (p) => p.highestAnte >= 12 },
  { id: 'kungfuManual', conditionEn: 'Use Blank Paper 10 times', conditionKo: '백지 10회 사용', met: (p) => p.blankPaperUses >= 10 },
  { id: 'yearBook', conditionEn: 'Use 100 Constellation cards', conditionKo: '별자리 카드 100장 사용', met: (p) => p.constellationUsed >= 100 },
  { id: 'comicBook', conditionEn: 'Use 50 Fable cards', conditionKo: '우화 카드 50장 사용', met: (p) => p.fableUsed >= 50 },
];

export function loadVoucherProgress(): VoucherProgress {
  const stored = readValue<Partial<VoucherProgress>>(KEY);
  return stored ? { ...EMPTY, ...stored } : { ...EMPTY };
}

function store(p: VoucherProgress): void {
  writeValue(KEY, p);
}

export function unlockedVoucherSet(): Set<VoucherId> {
  return new Set(loadVoucherProgress().unlocked);
}

export function recordVoucherProgress(event: VoucherProgressEvent): VoucherProgress {
  const p = loadVoucherProgress();
  const next: VoucherProgress = { ...p, bossesSeen: [...p.bossesSeen], unlocked: [...p.unlocked] };
  switch (event.kind) {
    case 'newRun':
      next.currentRunVoucherUses = 0;
      next.lowestHandSize = Math.min(next.lowestHandSize, event.handSize);
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
      next.lowestHandSize = Math.min(next.lowestHandSize, event.size);
      break;
    case 'anteReached':
      next.highestAnte = Math.max(next.highestAnte, event.ante);
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
  for (const rule of VOUCHER_UNLOCK_RULES) {
    if (rule.met(next) && !next.unlocked.includes(rule.id)) next.unlocked.push(rule.id);
  }
  store(next);
  return next;
}
