/**
 * Effect-text lookup for cards (spec §0 tooltip pattern). Names live on the
 * registries (nameEn/nameKo); the effect prose is i18n copy keyed by id, so it
 * translates and stays out of the engine.
 */
import type { JokerDef } from '../engine/events';
import type { OwnedJoker } from '../engine/types';

export const jokerDescKey = (id: string): string => `jokerdesc.${id}`;
export const voucherDescKey = (id: string): string => `voucherdesc.${id}`;
export const consumableDescKey = (id: string): string => `consumabledesc.${id}`;
export const bossDescKey = (id: string): string => `bossdesc.${id}`;

/**
 * A scaling joker's live grown value as a display string, or null when the
 * joker has no visible per-instance state (spec §0 "currently ×N"). The
 * proof-set jokers are flat / run-counter based, so this is null today; a future
 * joker that writes numbers into owned.state surfaces a "currently …" line for
 * free.
 */
export function grownValue(def: JokerDef, owned: OwnedJoker): string | null {
  void def;
  const entries = Object.entries(owned.state);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k} ${v}`).join(' · ');
}
