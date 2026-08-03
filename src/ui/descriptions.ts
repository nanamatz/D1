/**
 * Effect-text lookup for cards (spec §0 tooltip pattern). Names live on the
 * registries (nameEn/nameKo); the effect prose is i18n copy keyed by id, so it
 * translates and stays out of the engine.
 */
import { BALANCE } from '../engine/balance';
import type { JokerDef } from '../engine/events';
import { MATERIAL_REGISTRY } from '../engine/materials';
import { extinctLetterCount } from '../engine/jokers/outOfPrint';
import { pouchTagChips } from '../engine/jokers/pouchTag';
import type {
  ConsumableId,
  JokerEdition,
  OwnedJoker,
  RunState,
  TileFont,
  TileMaterial,
} from '../engine/types';
import { FABLE_REGISTRY, isFableId, jokerSellGoldValue } from '../engine/fables';
import { CONSTELLATION_PATTERN } from '../engine/constellations';
import type { TParams } from './i18n';
import { patternSymbol } from './patternSymbols';

type Translate = (key: string | string[], params?: TParams) => string;

export const jokerDescKey = (id: string): string => `jokerdesc.${id}`;
export const voucherDescKey = (id: string): string => `voucherdesc.${id}`;
export const consumableDescKey = (id: string): string => `consumabledesc.${id}`;
export const bossDescKey = (id: string): string => `bossdesc.${id}`;

/** Emoji Tile effect plus its separately presented edition enhancement. */
export function jokerTooltip(
  id: string,
  edition: JokerEdition,
  t: Translate,
): {
  body: string;
  tags: { label: string; tone: Exclude<JokerEdition, 'base'> }[];
  sub: { title: string; body: string; kind: 'edition' }[];
} {
  if (edition === 'base') return { body: t(jokerDescKey(id)), tags: [], sub: [] };
  const title = t(`edition.${edition}`);
  return {
    body: t(jokerDescKey(id)),
    tags: [{ label: title, tone: edition }],
    sub: [{ title, body: t(`editiondesc.${edition}`), kind: 'edition' }],
  };
}

/** Canonical consumable body used by shop, shelf, opened packs, and Collection. */
export function consumableTooltipBody(id: ConsumableId, t: Translate): string {
  const pattern = CONSTELLATION_PATTERN[id];
  return pattern
    ? t('pack.constellationLevels', {
        pattern: `${patternSymbol(pattern)} ${t(`pattern.${pattern}`)}`,
      })
    : t(consumableDescKey(id));
}

/** Run-dependent tooltip lines stay identical on every surface that has a run. */
export function consumableTooltipExtra(
  id: ConsumableId,
  run: RunState,
  t: Translate,
): string | null {
  return id === 'fable17'
    ? t('consumable.currentSellValue', { value: jokerSellGoldValue(run) })
    : null;
}

/** Font tooltip copy resolves through BALANCE.fontEffects — never hard-code the
 *  mapping (GDD §2.3): remapping a font in balance.ts must update every tooltip. */
export const fontDescKey = (font: TileFont): string =>
  font === 'medium' ? 'fontdesc.medium' : `fonteffectdesc.${BALANCE.fontEffects[font]}`;

const TILE_FONTS: readonly TileFont[] = ['medium', 'lightItalic', 'bold', 'inline', 'black'];
const TILE_MATERIALS: readonly TileMaterial[] = ['ceramic', ...MATERIAL_REGISTRY.keys()];
const REFERENCED_EDITIONS = [
  ['gray', 'G'],
  ['violet', 'v'],
  ['rainbow', 'r'],
  ['white', 'w'],
] as const satisfies readonly [Exclude<JokerEdition, 'base'>, string][];

/** Font names mentioned in effect copy get their canonical definition card. */
export function referencedFontTips(
  copy: string,
  t: Translate,
): { title: string; body: string; kind: 'font' }[] {
  // Property spans may contain names such as the Black & White Photo voucher;
  // those are object names, not font references.
  const effectCopy = copy.replace(/\[p:[^\]]*\]/g, '');
  return TILE_FONTS.flatMap((font) => {
    const title = t(`font.${font}`);
    return effectCopy.includes(title) ? [{ title, body: t(fontDescKey(font)), kind: 'font' }] : [];
  });
}

/** Material names mentioned in effect copy get their canonical definition card. */
export function referencedMaterialTips(
  copy: string,
  t: Translate,
): { title: string; body: string; kind: 'material' }[] {
  const effectCopy = copy.replace(/\[p:[^\]]*\]/g, '');
  return TILE_MATERIALS.flatMap((material) => {
    const title = t(`material.${material}`);
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const named = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
      .test(effectCopy);
    return named ? [{ title, body: t(`materialdesc.${material}`), kind: 'material' }] : [];
  });
}

/** Explicitly marked edition names get their canonical definition card. */
export function referencedEditionTips(
  copy: string,
  t: Translate,
): { title: string; body: string; kind: 'edition' }[] {
  return REFERENCED_EDITIONS.flatMap(([edition, tag]) => copy.includes(`[${tag}:`)
    ? [{
        title: t(`edition.${edition}`),
        body: t(`editiondesc.${edition}`),
        kind: 'edition' as const,
      }]
    : []);
}

/**
 * feedback #5: a consumable whose effect references a material (or, later, a font)
 * carries a supplemental definition explaining that material/font. Its placement follows
 * the shared count-aware tooltip layout. Returns null for consumables that reference neither. Data-driven off the
 * Fable registry — no per-consumable hard-coding.
 */
export function consumableAxisTip(
  id: ConsumableId,
  t: Translate,
): { title: string; body: string; kind: 'material' } | null {
  if (!isFableId(id)) return null;
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (effect?.kind === 'material') {
    return {
      title: t(`material.${effect.material}`),
      body: t(`materialdesc.${effect.material}`),
      kind: 'material',
    };
  }
  return null;
}

/**
 * A scaling joker's live grown value as a display string, or null when the
 * joker has no visible per-instance state (spec §0 "currently ×N"). The
 * Scaling Emoji Tiles write their factor into owned.state.
 */
export function grownValue(
  def: JokerDef,
  owned: OwnedJoker | undefined,
  t: Translate,
  pouchRemaining?: number,
  run?: RunState,
): string | null {
  if (def.id === 'pouchTag' && pouchRemaining !== undefined) {
    return t('joker.currentChips', { value: pouchTagChips(pouchRemaining) });
  }
  if (def.id === 'outOfPrint' && run) {
    const gone = extinctLetterCount(run.bag);
    return t('joker.currentChipsMult', {
      chips: gone * BALANCE.jokers.outOfPrint.chipsPerLetter,
      mult: gone * BALANCE.jokers.outOfPrint.multPerLetter,
    });
  }
  const display = def.growthDisplay;
  if (!display) return null;
  const value = owned?.state[display.stateKey] ?? display.initial;
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const suffix =
    display.kind === 'mult' ? 'Mult' : display.kind === 'multAdd' ? 'MultAdd' : 'Chips';
  return t(`joker.current${suffix}`, { value: formatted });
}
