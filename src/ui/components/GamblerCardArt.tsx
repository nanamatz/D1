import type { GamblerId } from '../../engine/gamblers';
import { gamblerArt } from '../gamblerArt';
import { FamilyCardArt } from './FamilyCardArt';

interface Props {
  id: GamblerId;
  className?: string;
  title?: string;
}

/**
 * One normalized SVG surface for the Gambler illustrations (GDD §10.3) — the
 * same 5:7 path-only canvas and shared frame the Fable and Constellation
 * families use, so all three read as one system.
 */
export function GamblerCardArt({ id, className, title }: Props) {
  const src = gamblerArt(id);
  if (!src) return null;
  return (
    <FamilyCardArt
      src={src}
      className={['gambler-svg-art', className].filter(Boolean).join(' ')}
      {...(title ? { title } : {})}
    />
  );
}
