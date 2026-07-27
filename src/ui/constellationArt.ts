import type { ConstellationId } from '../engine/constellations';
import aquarius from '../../docs/Arts/Cards/Constellation/Vector/Aquarius.svg';
import aries from '../../docs/Arts/Cards/Constellation/Vector/Aries.svg';
import cancer from '../../docs/Arts/Cards/Constellation/Vector/Cancer.svg';
import capricorn from '../../docs/Arts/Cards/Constellation/Vector/Capricorn.svg';
import gemini from '../../docs/Arts/Cards/Constellation/Vector/Gemini.svg';
import leo from '../../docs/Arts/Cards/Constellation/Vector/Leo.svg';
import libra from '../../docs/Arts/Cards/Constellation/Vector/Libra.svg';
import pisces from '../../docs/Arts/Cards/Constellation/Vector/Pisces.svg';
import sagittarius from '../../docs/Arts/Cards/Constellation/Vector/Sagittarius.svg';
import scorpio from '../../docs/Arts/Cards/Constellation/Vector/Scorpio.svg';
import taurus from '../../docs/Arts/Cards/Constellation/Vector/Taurus.svg';
import virgo from '../../docs/Arts/Cards/Constellation/Vector/Virgo.svg';

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
