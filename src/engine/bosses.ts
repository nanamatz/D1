/**
 * Bosses (GDD §8.3) — data + hooks, like jokers. Each boss attacks one system
 * (readable), is build-dependent (a check), and has counterplay. This is the
 * publishing-frame roster of 15 ordinary bosses plus 6 finishers; effects plug in at fixed
 * points in the loop pipeline:
 *   handSizeDelta   → shrink the opening draw before the hand is dealt (Budget Book)
 *   targetMult      → scale the blind target (Wanted)
 *   setup           → mutate the blind at start (phases, discards, flags)
 *   wordScoring     → mutate chips/mult (after jokers); gets {run, blind, lexicon}
 *   voids           → an allowed-but-zero submission (Forbidden Paper single-suit lock)
 *   blocks          → an illegal submission (unused by the current roster; kept as infra)
 *   goldPerWord     → economy drain per hand played (Bond)
 *   goldPerDiscardedTile → economy drain per discarded tile (Cleaning Sign)
 *   discardOnPlay   → discard N random hand tiles after each play (Unopened Letter)
 *
 * Boss art (id → image) lives in the UI (`src/ui/bossArt.ts`) so the engine stays
 * headless; `emoji` here is only a text fallback.
 */

import { BALANCE } from './balance';
import { setTileMaterial } from './materials';
import type { Lexicon } from './lexicon';
import type { Rng } from './rng';
import { isVerb, submissionHasSuit, submissionLength, submissionSuits } from './types';
import type {
  BlindState,
  RunState,
  SentenceScoringContext,
  WordScoringContext,
  WordSubmission,
  Tile,
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
  /** Transform only the sequence seen by sentence-pattern and Unison judging. */
  sentenceSequence?: (sequence: readonly WordSubmission[]) => WordSubmission[];
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
  /** gold removed each time a hand is played */
  goldPerWord?: number;
  /** gold removed for each tile in a player discard */
  goldPerDiscardedTile?: number;
  /** random hand tiles discarded after each play (Unopened Letter) */
  discardOnPlay?: number;
  /** Whether a tile may be included in a player discard action. */
  canDiscardTile?: (tile: Tile) => boolean;
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
  // 5. Bond (채권): −$1 per hand played this blind.
  {
    id: 'bond', nameEn: 'Bond', nameKo: '채권', emoji: '💵',
    goldPerWord: BALANCE.boss.bondGoldPerPlay,
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
  {
    id: 'deadLetter',
    nameEn: 'Dead Letter',
    nameKo: '사문자',
    emoji: '✉️',
    enter: (run, blind, rng) => {
      const counts = new Map<string, number>();
      for (const tile of [...blind.hand, ...blind.bag, ...blind.discardedThisBlind]) {
        if (tile.letter) counts.set(tile.letter, (counts.get(tile.letter) ?? 0) + 1);
      }
      const repeated = [...counts.entries()]
        .filter(([, count]) => count >= 2)
        .map(([letter]) => letter)
        .sort();
      const available = repeated.length > 0 ? repeated : [...counts.keys()].sort();
      return {
        run,
        blind: {
          ...blind,
          deadLetter: available.length > 0
            ? (available[rng.int(available.length)] as import('./types').Letter)
            : null,
        },
      };
    },
    debuffs: (submission, env) =>
      !submission.isGibberish &&
      !!env.blind.deadLetter &&
      submission.text.toUpperCase().includes(env.blind.deadLetter),
  },
  {
    id: 'stereotypePlate',
    nameEn: 'Stereotype Plate',
    nameKo: '스테레오타입 판',
    emoji: '▤',
    debuffs: (submission, _env, prior) =>
      !submission.isGibberish &&
      prior.some((word) =>
        !word.isGibberish && submissionLength(word) === submissionLength(submission)),
  },
  {
    id: 'orphanLine',
    nameEn: 'Orphan Line',
    nameKo: '고아행',
    emoji: '¶',
    sentenceSequence: (sequence) => sequence.slice(1),
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
    id: 'cleaningSign',
    nameEn: 'Cleaning Sign',
    nameKo: '청소 표지판',
    emoji: '⚠️',
    clearReward: BALANCE.boss.finisherReward,
    goldPerDiscardedTile: BALANCE.boss.cleaningSignGoldPerDiscardedTile,
  },
  {
    id: 'medusa',
    nameEn: 'Medusa',
    nameKo: '메두사',
    emoji: '🐍',
    clearReward: BALANCE.boss.finisherReward,
    canDiscardTile: (tile) => tile.material !== 'stone',
    afterPlay: (run, blind, rng) => {
      const targets = rng.shuffle(blind.hand.filter((tile) => tile.material !== 'stone'))
        .slice(0, BALANCE.boss.medusaStoneTiles);
      if (targets.length === 0) return { run, blind };
      const ids = new Set(targets.map((tile) => tile.id));
      const patch = (tiles: readonly Tile[]) => tiles.map((tile) =>
        ids.has(tile.id) ? setTileMaterial(tile, 'stone') : tile,
      );
      return {
        run: { ...run, bag: patch(run.bag) },
        blind: {
          ...blind,
          hand: patch(blind.hand),
          bag: patch(blind.bag),
          discardedThisBlind: patch(blind.discardedThisBlind),
        },
      };
    },
  },
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

/** Apply a boss's sentence-only transform without altering committed words. */
export function sentenceSequenceForBlind(
  blind: BlindState,
  sequence: readonly WordSubmission[] = blind.sequence,
): WordSubmission[] {
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  return boss?.sentenceSequence ? boss.sentenceSequence(sequence) : sequence.slice();
}

export const bossPoolForAnte = (ante: number): BossPool =>
  ante > 0 && ante % BALANCE.runAntes === 0 ? 'finisher' : 'core';

export const bossPoolForId = (id: string | null): BossPool =>
  id && FINISHER_BOSS_IDS.includes(id) ? 'finisher' : 'core';

/**
 * Draw a boss for a boss blind (seeded).
 *
 * `exclude` removes an id from the pool BEFORE the draw — that is what makes a
 * paid reroll actually reroll. The UI used to draw once and re-draw only if it
 * matched, which could return the same boss after a paid reroll. Excluding is
 * also one seeded draw instead of two, so the RNG stream stays simple.
 *
 * A pool of one falls back to that id: a reroll that cannot change anything is
 * the caller's decision to prevent, not a reason to return nothing.
 */
export function drawBoss(
  rng: { int: (n: number) => number },
  pool: BossPool = 'core',
  exclude?: string | readonly string[] | null,
): string {
  const all = pool === 'finisher' ? FINISHER_BOSS_IDS : CORE_BOSS_IDS;
  const excluded = new Set(Array.isArray(exclude) ? exclude : exclude ? [exclude] : []);
  const ids = all.filter((id) => !excluded.has(id));
  const from = ids.length > 0 ? ids : all;
  return from[rng.int(from.length)]!;
}

/** Draw without repeats until the selected pool is exhausted, then start a new cycle. */
export function drawBossFromCycle(
  rng: { int: (n: number) => number },
  pool: BossPool = 'core',
  history: readonly string[] = [],
  exclude?: string | null,
): { bossId: string; history: string[] } {
  const all = pool === 'finisher' ? FINISHER_BOSS_IDS : CORE_BOSS_IDS;
  const poolIds = new Set(all);
  const seededHistory = [...history];
  if (exclude && poolIds.has(exclude) && !seededHistory.includes(exclude)) {
    seededHistory.push(exclude);
  }
  const exhausted = new Set(seededHistory.filter((id) => poolIds.has(id))).size >= all.length;
  const retained = exhausted ? seededHistory.filter((id) => !poolIds.has(id)) : seededHistory;
  const blocked = [...retained, ...(exclude ? [exclude] : [])];
  const bossId = drawBoss(rng, pool, blocked);
  return { bossId, history: [...retained, bossId] };
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

export const bossAllowsDiscard = (blind: BlindState, tile: Tile): boolean =>
  BOSS_REGISTRY.get(blind.bossId ?? '')?.canDiscardTile?.(tile) ?? true;

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
