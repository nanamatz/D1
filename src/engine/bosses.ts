/**
 * Bosses (GDD §8.3) — data + hooks, like jokers. Each boss attacks one system
 * (readable), is build-dependent (a check), and has counterplay. This is the
 * publishing-frame roster of 12 (수배 전단 … 유서); effects plug in at fixed
 * points in the loop pipeline:
 *   handSizeDelta   → shrink the opening draw before the hand is dealt (Budget Book)
 *   targetMult      → scale the blind target (Wanted)
 *   setup           → mutate the blind at start (phases, discards, flags)
 *   wordScoring     → mutate chips/mult (after jokers); gets {run, blind, lexicon}
 *   voids           → an allowed-but-zero submission (Forbidden Paper single-suit lock)
 *   blocks          → an illegal submission (unused by the current roster; kept as infra)
 *   goldPerWord     → economy drain per word (unused by the current roster)
 *   goldPerTile     → economy drain per tile played (Bond)
 *   discardOnPlay   → discard N random hand tiles after each play (Unopened Letter)
 *
 * Boss art (id → image) lives in the UI (`src/ui/bossArt.ts`) so the engine stays
 * headless; `emoji` here is only a text fallback.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import type { Rng } from './rng';
import { isVerb, submissionHasSuit, submissionSuits } from './types';
import type {
  BlindState,
  RunState,
  SentenceScoringContext,
  WordScoringContext,
  WordSubmission,
} from './types';

/** Read-only context a boss's wordScoring hook may inspect (GDD §8.3). */
export interface BossScoringEnv {
  run: RunState;
  blind: BlindState;
  lexicon: Lexicon;
}

export interface BossDef {
  id: string;
  nameEn: string;
  nameKo: string;
  emoji: string; // text fallback; the real emblem is an image (src/ui/bossArt.ts)
  /** opening-hand size change, applied BEFORE the hand is dealt (Budget Book −3) */
  handSizeDelta?: number;
  /** blind-target multiplier, applied at start and mirrored by Blind Select (Wanted ×2) */
  targetMult?: number;
  /** clear reward override; finisher bosses pay $8. */
  clearReward?: number;
  setup?: (blind: BlindState) => BlindState;
  /** Seeded one-shot mutations applied when Blind Select is confirmed. */
  enter?: (run: RunState, blind: BlindState, rng: Rng) => { run: RunState; blind: BlindState };
  /** Seeded state change after each submitted word. */
  afterPlay?: (run: RunState, blind: BlindState, rng: Rng) => { run: RunState; blind: BlindState };
  /** Reconcile hand-bound state after a consumable changes the hand. */
  handChanged?: (run: RunState, blind: BlindState, rng: Rng) => BlindState;
  wordScoring?: (ctx: WordScoringContext, env: BossScoringEnv) => void;
  /** Presentation-only factors for hooks implemented as equivalent deltas. */
  scoreFactors?: { chips?: number; mult?: number };
  sentenceScoring?: (ctx: SentenceScoringContext) => void;
  /** true → the submission is allowed but its word score is reduced to 0 */
  debuffs?: (
    submission: WordSubmission,
    env: BossScoringEnv,
    priorSequence: readonly WordSubmission[],
  ) => boolean;
  /** true → the submission is illegal and cannot be played */
  blocks?: (word: string, lexicon: Lexicon) => boolean;
  /** true → the submission is allowed but scores 0 */
  voids?: (submission: WordSubmission, priorSequence: readonly WordSubmission[]) => boolean;
  /** gold removed each time a word is submitted */
  goldPerWord?: number;
  /** gold removed per tile in a submission (Bond) */
  goldPerTile?: number;
  /** random hand tiles discarded after each play (Unopened Letter) */
  discardOnPlay?: number;
}

const BOSSES: readonly BossDef[] = [
  // 1. Wanted (수배 전단): XL blind — target ×2.
  {
    id: 'wanted', nameEn: 'Wanted', nameKo: '수배 전단', emoji: '📜',
    targetMult: BALANCE.boss.wantedTargetMult,
  },
  // 2. Unopened Letter (미개봉 편지): each play discards up to 4 random hand tiles.
  {
    id: 'letter', nameEn: 'Unopened Letter', nameKo: '미개봉 편지', emoji: '✉️',
    discardOnPlay: BALANCE.boss.letterDiscardOnPlay,
  },
  // 3. Ancient Paper (고대 문서): all vowel tiles are drawn face-down (info attack,
  //    UI-only — they score normally when played).
  {
    id: 'ancientPaper', nameEn: 'Ancient Paper', nameKo: '고대 문서', emoji: '🗞️',
    setup: (blind) => ({ ...blind, vowelsHidden: true }),
  },
  // 4. Forbidden Paper (금서): single-suit lock — once a suit is established this
  //    blind, words of any OTHER suit void to 0. Gibberish (null suit) is exempt.
  {
    id: 'forbiddenPaper', nameEn: 'Forbidden Paper', nameKo: '금서', emoji: '🔥',
    voids: (submission, prior) => {
      const current = submissionSuits(submission);
      if (current.length === 0) return false; // gibberish always plays (GDD §6.4)
      const established = prior.map(submissionSuits).find((suits) => suits.length > 0);
      return established !== undefined && !current.some((suit) => established.includes(suit));
    },
  },
  // 5. Bond (채권): −$1 per tile played this blind.
  {
    id: 'bond', nameEn: 'Bond', nameKo: '채권', emoji: '💵',
    goldPerTile: BALANCE.boss.bondGoldPerTile,
  },
  // 6. History Book (역사책): this boss blind gets 2 fewer phases.
  {
    id: 'historyBook', nameEn: 'History Book', nameKo: '역사책', emoji: '📚',
    setup: (blind) => ({
      ...blind,
      phasesTotal: Math.max(1, blind.phasesTotal - BALANCE.boss.historyBookPhaseReduction),
    }),
  },
  // 7. Memoirs (회고록): any word already played THIS ante is debuffed (scores 0).
  {
    id: 'memoirs', nameEn: 'Memoirs', nameKo: '회고록', emoji: '📖',
    debuffs: (submission, env) => {
      if (submission.isGibberish) return false; // gibberish is never a tracked word
      const played = env.run.wordsThisAnte ?? [];
      return played.includes(submission.text.toLowerCase());
    },
  },
  // 8. Budget Book (가계부): hand size −3.
  {
    id: 'budgetBook', nameEn: 'Budget Book', nameKo: '가계부', emoji: '🧾',
    handSizeDelta: BALANCE.boss.budgetBookHandDelta,
  },
  // 9. Contract (계약서): start with 0 discards.
  {
    id: 'contract', nameEn: 'Contract', nameKo: '계약서', emoji: '🖋️',
    setup: (blind) => ({ ...blind, discardsLeft: 0 }),
  },
  // 10. Burnt Paper (그을린 종이): all verbs debuffed (score 0).
  {
    id: 'burntPaper', nameEn: 'Burnt Paper', nameKo: '그을린 종이', emoji: '🕯️',
    debuffs: (submission, env) => {
      if (submission.isGibberish) return false;
      const entry = env.lexicon.lookup(submission.text);
      return entry !== null && entry.pos.some(isVerb);
    },
  },
  // 11. White Paper (백지): all vulgar words debuffed (score 0).
  {
    id: 'whitePaper', nameEn: 'White Paper', nameKo: '백지', emoji: '📄',
    debuffs: (submission) => submissionHasSuit(submission, 'vulgar'),
  },
  // 12. Will (유서): base chips and mult halved.
  {
    id: 'will', nameEn: 'Will', nameKo: '유서', emoji: '🪦',
    scoreFactors: { chips: BALANCE.boss.willScale, mult: BALANCE.boss.willScale },
    wordScoring: (ctx) => {
      ctx.chips *= BALANCE.boss.willScale;
      ctx.mult *= BALANCE.boss.willScale;
    },
  },
];

const forceRandomTile = (blind: BlindState, rng: Rng): BlindState => {
  if (blind.forcedTileId && blind.hand.some((tile) => tile.id === blind.forcedTileId)) return blind;
  return {
    ...blind,
    forcedTileId: blind.hand.length > 0 ? blind.hand[rng.int(blind.hand.length)]!.id : null,
  };
};

const disableRandomJoker = (run: RunState, blind: BlindState, rng: Rng) => {
  const jokers = run.jokers.map((joker) => {
    const state = { ...joker.state };
    delete state.bossDisabled;
    return { ...joker, state };
  });
  if (jokers.length > 0) jokers[rng.int(jokers.length)]!.state.bossDisabled = 1;
  return { run: { ...run, jokers }, blind };
};

const FINISHERS: readonly BossDef[] = [
  {
    id: 'nokdoScript',
    nameEn: 'Nokdo Script',
    nameKo: '녹도 문자',
    emoji: '🦌',
    clearReward: BALANCE.boss.finisherReward,
    enter: (run, blind, rng) => ({ run, blind: forceRandomTile(blind, rng) }),
    afterPlay: (run, blind, rng) => ({ run, blind: forceRandomTile(blind, rng) }),
    handChanged: (_run, blind, rng) => forceRandomTile(blind, rng),
  },
  {
    id: 'blueprint',
    nameEn: 'Blueprint',
    nameKo: '블루프린트',
    emoji: '📐',
    clearReward: BALANCE.boss.finisherReward,
    enter: (run, blind, rng) => ({
      run: { ...run, jokers: rng.shuffle(run.jokers) },
      blind: { ...blind, jokersFaceDown: true },
    }),
  },
  {
    id: 'vitalSign',
    nameEn: 'Vital Sign',
    nameKo: '바이탈 사인',
    emoji: '💓',
    clearReward: BALANCE.boss.finisherReward,
    targetMult: BALANCE.boss.vitalSignTargetMult,
  },
  {
    id: 'ultrasound',
    nameEn: 'Ultrasound Photo',
    nameKo: '초음파 사진',
    emoji: '🩻',
    clearReward: BALANCE.boss.finisherReward,
    enter: disableRandomJoker,
    afterPlay: disableRandomJoker,
  },
];

export const BOSS_REGISTRY: ReadonlyMap<string, BossDef> = new Map(
  [...BOSSES, ...FINISHERS].map((boss) => [boss.id, boss]),
);
export const CORE_BOSS_IDS: readonly string[] = BOSSES.map((b) => b.id);
export const FINISHER_BOSS_IDS: readonly string[] = FINISHERS.map((boss) => boss.id);
export const ALL_BOSS_IDS: readonly string[] = [...CORE_BOSS_IDS, ...FINISHER_BOSS_IDS];
export type BossPool = 'core' | 'finisher';

export const bossPoolForAnte = (ante: number): BossPool =>
  ante > 0 && ante % BALANCE.runAntes === 0 ? 'finisher' : 'core';

export const bossPoolForId = (id: string | null): BossPool =>
  id && FINISHER_BOSS_IDS.includes(id) ? 'finisher' : 'core';

/**
 * Draw a boss for a boss blind (seeded).
 *
 * `exclude` removes an id from the pool BEFORE the draw — that is what makes a
 * paid reroll actually reroll. The UI used to draw once and re-draw only if it
 * matched, which still returns the same boss when both draws land on it: 0.69%
 * on the 12-boss core pool but 6.25% on the 4-boss finisher pool, i.e. one in
 * sixteen $10 rerolls on a final Chapter did nothing at all. Excluding is also
 * one seeded draw instead of two, so the RNG stream stays simple.
 *
 * A pool of one falls back to that id: a reroll that cannot change anything is
 * the caller's decision to prevent, not a reason to return nothing.
 */
export function drawBoss(
  rng: { int: (n: number) => number },
  pool: BossPool = 'core',
  exclude?: string | null,
): string {
  const all = pool === 'finisher' ? FINISHER_BOSS_IDS : CORE_BOSS_IDS;
  const ids = exclude ? all.filter((id) => id !== exclude) : all;
  const from = ids.length > 0 ? ids : all;
  return from[rng.int(from.length)]!;
}

export function enterBossBlind(
  run: RunState,
  blind: BlindState,
  rng: Rng,
): { run: RunState; blind: BlindState } {
  return BOSS_REGISTRY.get(blind.bossId ?? '')?.enter?.(run, blind, rng) ?? { run, blind };
}

export function afterBossPlay(
  run: RunState,
  blind: BlindState,
  rng: Rng,
): { run: RunState; blind: BlindState } {
  return BOSS_REGISTRY.get(blind.bossId ?? '')?.afterPlay?.(run, blind, rng) ?? { run, blind };
}

export function reconcileBossHand(run: RunState, blind: BlindState, rng: Rng): BlindState {
  return BOSS_REGISTRY.get(blind.bossId ?? '')?.handChanged?.(run, blind, rng) ?? blind;
}

export function clearBossJokerDebuffs(run: RunState): RunState {
  return {
    ...run,
    jokers: run.jokers.map((joker) => {
      const state = { ...joker.state };
      delete state.bossDisabled;
      return { ...joker, state };
    }),
  };
}
