import type { ConstellationId } from '../../engine/constellations';
import { constellationArt } from '../constellationArt';
import { FamilyCardArt } from './FamilyCardArt';

interface Props {
  id: ConstellationId;
  className?: string;
  title?: string;
}

export function ConstellationCardArt({ id, className, title }: Props) {
  return (
    <FamilyCardArt
      src={constellationArt(id)}
      {...(className ? { className } : {})}
      {...(title ? { title } : {})}
    />
  );
}
