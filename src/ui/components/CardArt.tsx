import { constellationArt } from '../constellationArt';
import { fableArt } from '../fableArt';
import { gamblerArt } from '../gamblerArt';
import { FamilyCardArt } from './FamilyCardArt';

/** The three consumable card families that share the framed 5:7 canvas (GDD §10). */
export type CardFamily = 'fable' | 'constellation' | 'gambler';

const ART: Record<CardFamily, (id: string) => string | undefined> = {
  fable: fableArt as (id: string) => string | undefined,
  constellation: constellationArt as (id: string) => string | undefined,
  gambler: gamblerArt,
};

interface Props {
  family: CardFamily;
  id: string;
  className?: string;
  title?: string;
}

/**
 * One surface for every consumable card illustration. Adding a family is a row
 * in `ART`, not another wrapper component.
 *
 * Renders nothing for an id with no art — Rainman and Sake Cup are the reverse
 * case (art without an engine id), but a future id could ship before its art.
 */
export function CardArt({ family, id, className, title }: Props) {
  const src = ART[family](id);
  if (!src) return null;
  return (
    <FamilyCardArt
      src={src}
      className={[`${family}-svg-art`, className].filter(Boolean).join(' ')}
      {...(title ? { title } : {})}
    />
  );
}
