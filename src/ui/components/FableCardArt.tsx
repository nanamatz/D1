import type { FableId } from '../../engine/fables';
import { fableArt } from '../fableArt';
import { FamilyCardArt } from './FamilyCardArt';

interface Props {
  id: FableId;
  className?: string;
  title?: string;
}

/**
 * One normalized SVG surface for all supplied Fable illustrations.
 *
 * Each illustration is a path-only, pixel-art SVG normalized to a 5:7 canvas.
 * This outer surface owns the shared safe inset, rounded clipping, and frame.
 * The normalized assets already share the exact same visible image bounds.
 */
export function FableCardArt({ id, className, title }: Props) {
  return (
    <FamilyCardArt
      src={fableArt(id)}
      className={['fable-svg-art', className].filter(Boolean).join(' ')}
      {...(title ? { title } : {})}
    />
  );
}
