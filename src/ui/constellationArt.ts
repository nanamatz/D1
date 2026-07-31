import type { ConstellationId } from '../engine/constellations';
import aquarius from '../../docs/Arts/Cards/Constellation/Vector/Aquarius-preview.png';
import aries from '../../docs/Arts/Cards/Constellation/Vector/Aries-preview.png';
import cancer from '../../docs/Arts/Cards/Constellation/Vector/Cancer-preview.png';
import capricorn from '../../docs/Arts/Cards/Constellation/Vector/Capricorn-preview.png';
import gemini from '../../docs/Arts/Cards/Constellation/Vector/Gemini-preview.png';
import leo from '../../docs/Arts/Cards/Constellation/Vector/Leo-preview.png';
import libra from '../../docs/Arts/Cards/Constellation/Vector/Libra-preview.png';
import pisces from '../../docs/Arts/Cards/Constellation/Vector/Pisces-preview.png';
import sagittarius from '../../docs/Arts/Cards/Constellation/Vector/Sagittarius-preview.png';
import scorpio from '../../docs/Arts/Cards/Constellation/Vector/Scorpio-preview.png';
import taurus from '../../docs/Arts/Cards/Constellation/Vector/Taurus-preview.png';
import virgo from '../../docs/Arts/Cards/Constellation/Vector/Virgo-preview.png';

export const CONSTELLATION_ART: Record<ConstellationId, string> = {
  libra,
  leo,
  aquarius,
  aries,
  taurus,
  gemini,
  cancer,
  virgo,
  scorpio,
  sagittarius,
  capricorn,
  pisces,
};

export const constellationArt = (id: ConstellationId): string => CONSTELLATION_ART[id];
