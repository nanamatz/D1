/**
 * Effect-text lookup for cards (spec §0 tooltip pattern). Names live on the
 * registries (nameEn/nameKo); the effect prose is i18n copy keyed by id, so it
 * translates and stays out of the engine.
 */
import { BALANCE } from '../engine/balance';
import type { JokerDef } from '../engine/events';
import type { ConsumableId, OwnedJoker, TileFont } from '../engine/types';
import { FABLE_REGISTRY, isFableId } from '../engine/fables';

export const jokerDescKey = (id: string): string => `jokerdesc.${id}`;
export const voucherDescKey = (id: string): string => `voucherdesc.${id}`;
export const consumableDescKey = (id: string): string => `consumabledesc.${id}`;
export const bossDescKey = (id: string): string => `bossdesc.${id}`;

/** Font tooltip copy resolves through BALANCE.fontEffects — never hard-code the
 *  mapping (GDD §2.3): remapping a font in balance.ts must update every tooltip. */
export const fontDescKey = (font: TileFont): string =>
  font === 'medium' ? 'fontdesc.medium' : `fonteffectdesc.${BALANCE.fontEffects[font]}`;

/**
 * feedback #5: a consumable whose effect references a material (or, later, a font)
 * carries a SUB-tooltip explaining that material/font, shown below the card's own
 * tooltip. Returns null for consumables that reference neither. Data-driven off the
 * Fable registry — no per-consumable hard-coding.
 */
export function consumableAxisTip(
  id: ConsumableId,
  t: (key: string) => string,
): { title: string; body: string } | null {
  if (!isFableId(id)) return null;
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (effect?.kind === 'material') {
    return { title: t(`material.${effect.material}`), body: t(`materialdesc.${effect.material}`) };
  }
  return null;
}

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
