/**
 * Bosses (GDD §8.3) — data + hooks, like jokers. Each boss attacks one system
 * (readable), is build-dependent (a check), and has counterplay. Effects plug in
 * at fixed points in the loop pipeline:
 *   setup           → mutate the blind at start (phases, discards, flags)
 *   wordScoring     → mutate chips/mult (after jokers)
 *   sentenceScoring → mutate the sentence bonus (after jokers)
 *   blocks          → an illegal submission (The Noun Lock)
 *   voids           → an allowed-but-zero submission (The Purist)
 *   goldPerWord     → economy drain per word (The Taxman)
 *
 * The 2 ante-8 finishers (Proofreader, Babel) need extra run/phase state and are
 * deferred.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import { isVerb, isVowel } from './types';
import type {
  BlindState,
  SentenceScoringContext,
  WordScoringContext,
  WordSubmission,
} from './types';

export interface BossDef {
  id: string;
  nameEn: string;
  nameKo: string;
  emoji: string;
  setup?: (blind: BlindState) => BlindState;
  wordScoring?: (ctx: WordScoringContext) => void;
  sentenceScoring?: (ctx: SentenceScoringContext) => void;
  /** true → the submission is illegal and cannot be played */
  blocks?: (word: string, lexicon: Lexicon) => boolean;
  /** true → the submission is allowed but scores 0 */
  voids?: (submission: WordSubmission, priorSequence: readonly WordSubmission[]) => boolean;
  /** gold removed each time a word is submitted */
  goldPerWord?: number;
}

const vowelChips = (ctx: WordScoringContext): number => {
  let sum = 0;
  for (const t of ctx.submission.tiles) if (isVowel(t.letter)) sum += BALANCE.letterChips[t.letter] ?? 0;
  return sum;
};

const BOSSES: readonly BossDef[] = [
  // ----- suit attacks -----
  {
    id: 'censor', nameEn: 'The Censor', nameKo: '검열관', emoji: '🚫',
    wordScoring: (ctx) => {
      if (ctx.submission.suit === 'vulgar') {
        ctx.chips = 0;
        ctx.mult = 0;
      }
    },
  },
  {
    id: 'snob', nameEn: 'The Snob', nameKo: '속물', emoji: '🎩',
    wordScoring: (ctx) => {
      if (ctx.submission.suit === 'standard') ctx.mult *= BALANCE.boss.snobStandardMult;
    },
  },
  {
    id: 'purist', nameEn: 'The Purist', nameKo: '순수주의자', emoji: '⚗️',
    voids: (_sub, prior) => {
      const suits = new Set(prior.filter((w) => w.suit !== null).map((w) => w.suit));
      return suits.size >= 2; // 2+ distinct suits already played → subsequent words void
    },
  },
  // ----- sentence attacks -----
  {
    id: 'anarchist', nameEn: 'The Anarchist', nameKo: '무정부주의자', emoji: '💣',
    sentenceScoring: (ctx) => {
      ctx.flatBonus = 0;
      ctx.totalMultiplier = 1; // sentence bonuses do not trigger
    },
  },
  {
    id: 'nounLock', nameEn: 'The Noun Lock', nameKo: '명사 자물쇠', emoji: '🔒',
    blocks: (word, lexicon) => {
      const entry = lexicon.lookup(word);
      return entry !== null && entry.pos.some(isVerb);
    },
  },
  // ----- phase / early-end attacks -----
  {
    id: 'perfectionist', nameEn: 'The Perfectionist', nameKo: '완벽주의자', emoji: '📐',
    setup: (blind) => ({ ...blind, earlyEndDisabled: true }),
  },
  {
    id: 'guillotine', nameEn: 'The Guillotine', nameKo: '단두대', emoji: '🔪',
    setup: (blind) => ({
      ...blind,
      phasesTotal: Math.max(1, blind.phasesTotal + BALANCE.boss.guillotinePhaseDelta),
    }),
  },
  // ----- loop-resource attacks -----
  {
    id: 'hoarder', nameEn: 'The Hoarder', nameKo: '수집광', emoji: '🧺',
    setup: (blind) => ({ ...blind, discardsLeft: 0 }),
  },
  {
    id: 'editor', nameEn: 'The Editor', nameKo: '편집자', emoji: '✂️',
    wordScoring: (ctx) => {
      if (ctx.submission.tiles.length < BALANCE.boss.editorMinLength) {
        ctx.chips = 0;
        ctx.mult = 0;
      }
    },
  },
  {
    id: 'mute', nameEn: 'The Mute', nameKo: '침묵', emoji: '🤐',
    wordScoring: (ctx) => {
      ctx.chips -= vowelChips(ctx); // vowel tiles contribute 0 chips
    },
  },
  // ----- information attack -----
  {
    id: 'blindfold', nameEn: 'The Blindfold', nameKo: '눈가리개', emoji: '🙈',
    setup: (blind) => ({ ...blind, previewHidden: true }),
  },
  // ----- economy attack -----
  {
    id: 'taxman', nameEn: 'The Taxman', nameKo: '세금징수원', emoji: '💰',
    goldPerWord: BALANCE.boss.taxmanGoldPerWord,
  },
];

export const BOSS_REGISTRY: ReadonlyMap<string, BossDef> = new Map(BOSSES.map((b) => [b.id, b]));
export const CORE_BOSS_IDS: readonly string[] = BOSSES.map((b) => b.id);

/** Draw a boss for a boss blind (seeded). */
export function drawBoss(rng: { int: (n: number) => number }): string {
  return CORE_BOSS_IDS[rng.int(CORE_BOSS_IDS.length)]!;
}
