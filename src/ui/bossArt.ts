/**
 * Boss + blind emblem art (id → bundled image URL). Kept out of the engine
 * (`src/engine/bosses.ts` stays headless) — the UI maps boss ids and blind kinds
 * to their pixel-art emblems here. Source art lives in `docs/Arts/`; the files
 * used at runtime are copied under `src/ui/assets/bosses/` so Vite bundles them.
 */
import type { BlindKind } from '../engine/types';

import wanted from './assets/bosses/T_Wanted.png';
import letter from './assets/bosses/T_Letter.png';
import ancientPaper from './assets/bosses/T_AncientPaper.png';
import forbiddenPaper from './assets/bosses/T_ForbiddenPaper.png';
import bond from './assets/bosses/T_Bond.png';
import historyBook from './assets/bosses/T_HitoryBook.png';
import memoirs from './assets/bosses/T_Memoirs.png';
import budgetBook from './assets/bosses/T_BudgetBook.png';
import contract from './assets/bosses/T_Contract.png';
import burntPaper from './assets/bosses/T_BurntPaper.png';
import whitePaper from './assets/bosses/T_WhitePaper.png';
import will from './assets/bosses/T_will.png';
import draft from './assets/bosses/T_Draft.png';
import revision from './assets/bosses/T_Revision.png';

/** Boss id → emblem image. Keys match `BOSS_REGISTRY` ids in engine/bosses.ts. */
export const BOSS_ART: Record<string, string> = {
  wanted,
  letter,
  ancientPaper,
  forbiddenPaper,
  bond,
  historyBook,
  memoirs,
  budgetBook,
  contract,
  burntPaper,
  whitePaper,
  will,
};

/** Non-boss blind emblems: Draft (small) / Revision (big). Boss blinds use BOSS_ART. */
export const BLIND_ART: Partial<Record<BlindKind, string>> = {
  small: draft,
  big: revision,
};

/** The emblem image for a blind: the boss art on a boss blind, else the kind art. */
export function blindEmblem(kind: BlindKind, bossId: string | null): string | undefined {
  if (kind === 'boss' && bossId) return BOSS_ART[bossId];
  return BLIND_ART[kind];
}
