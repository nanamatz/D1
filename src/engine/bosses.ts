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
import { isVerb } from './types';
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
  setup?: (blind: BlindState) => BlindState;
  wordScoring?: (ctx: WordScoringContext, env: BossScoringEnv) => void;
  sentenceScoring?: (ctx: SentenceScoringContext) => void;
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

const zero = (ctx: WordScoringContext): void => {
  ctx.chips = 0;
  ctx.mult = 0;
};

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
      if (submission.suit === null) return false; // gibberish always plays (GDD §6.4)
      const established = prior.find((w) => w.suit !== null)?.suit ?? null;
      return established !== null && submission.suit !== established;
    },
  },
  // 5. Bond (채권): −$1 per tile played this blind.
  {
    id: 'bond', nameEn: 'Bond', nameKo: '채권', emoji: '💵',
    goldPerTile: BALANCE.boss.bondGoldPerTile,
  },
  // 6. History Book (역사책): only 2 phases.
  {
    id: 'historyBook', nameEn: 'History Book', nameKo: '역사책', emoji: '📚',
    setup: (blind) => ({
      ...blind,
      phasesTotal: Math.max(1, BALANCE.boss.historyBookPhases),
    }),
  },
  // 7. Memoirs (회고록): any word already played THIS ante is debuffed (scores 0).
  {
    id: 'memoirs', nameEn: 'Memoirs', nameKo: '회고록', emoji: '📖',
    wordScoring: (ctx, env) => {
      if (ctx.submission.isGibberish) return; // gibberish is never a tracked word
      const played = env.run.wordsThisAnte ?? [];
      if (played.includes(ctx.submission.text.toLowerCase())) zero(ctx);
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
    wordScoring: (ctx, env) => {
      if (ctx.submission.isGibberish) return;
      const entry = env.lexicon.lookup(ctx.submission.text);
      if (entry !== null && entry.pos.some(isVerb)) zero(ctx);
    },
  },
  // 11. White Paper (백지): all vulgar words debuffed (score 0).
  {
    id: 'whitePaper', nameEn: 'White Paper', nameKo: '백지', emoji: '📄',
    wordScoring: (ctx) => {
      if (ctx.submission.suit === 'vulgar') zero(ctx);
    },
  },
  // 12. Will (유서): base chips and mult halved.
  {
    id: 'will', nameEn: 'Will', nameKo: '유서', emoji: '🪦',
    wordScoring: (ctx) => {
      ctx.chips *= BALANCE.boss.willScale;
      ctx.mult *= BALANCE.boss.willScale;
    },
  },
];

export const BOSS_REGISTRY: ReadonlyMap<string, BossDef> = new Map(BOSSES.map((b) => [b.id, b]));
export const CORE_BOSS_IDS: readonly string[] = BOSSES.map((b) => b.id);

/** Draw a boss for a boss blind (seeded). */
export function drawBoss(rng: { int: (n: number) => number }): string {
  return CORE_BOSS_IDS[rng.int(CORE_BOSS_IDS.length)]!;
}
