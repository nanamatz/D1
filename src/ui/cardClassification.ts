import { isConstellationId } from '../engine/constellations';
import { isFableId } from '../engine/fables';
import { isGamblerId } from '../engine/gamblers';
import type { ConsumableId } from '../engine/types';
import type { TooltipClassification } from './components/Tooltip';

/**
 * Presentation-only family label for implemented consumables.
 * Legacy compatibility ids have no current card family and therefore no badge.
 */
export function consumableClassification(
  id: ConsumableId,
): TooltipClassification | undefined {
  if (isFableId(id)) return 'fable';
  if (isConstellationId(id)) return 'constellation';
  if (isGamblerId(id)) return 'gambler';
  return undefined;
}
