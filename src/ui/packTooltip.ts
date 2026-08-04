/**
 * Pack tooltip content ((type, size) → title / body / grade badge).
 *
 * Both the shop pack row and the 도감 pack gallery render the same tooltip, so the
 * copy lives here once instead of being rebuilt (and drifting) in two components.
 *
 * The body is family-and-size-aware: Charm/Ink expose fewer choices than the
 * other families, while Premium packs permit two picks.
 *
 * Highlight markup ([n:…] counts, [k:…] card-kind) is written into the locale
 * strings — see richtext.tsx for why the tags live in the copy.
 */
import { packSizeRules } from '../engine/balance';
import type { PackSize, PackType } from '../engine/types';
import type { TParams } from './i18n';

export interface PackTooltipContent {
  /** the pack's name — type only; the size reads off the grade badge instead */
  title: string;
  /** size-aware description carrying [n:]/[k:] highlight markup */
  body: string;
  /** drives the grade badge (기본/클래식/프리미엄) under the description plate */
  grade: PackSize;
}

export function packTooltip(
  type: PackType,
  size: PackSize,
  t: (key: string, params?: TParams) => string,
): PackTooltipContent {
  const { show, pick } = packSizeRules(type, size);
  return {
    title: t(`pack.type.${type}`),
    body: t(`packdesc.${type}`, { show, pick }),
    grade: size,
  };
}
