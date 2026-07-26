import type { ConstellationId } from '../engine/constellations';
import aquarius from '../../docs/Arts/Cards/Constellation/Aquarius.png';
import aries from '../../docs/Arts/Cards/Constellation/Aries.png';
import cancer from '../../docs/Arts/Cards/Constellation/Cancer.png';
import capricorn from '../../docs/Arts/Cards/Constellation/Capricorn.png';
import gemini from '../../docs/Arts/Cards/Constellation/Gemini.png';
import leo from '../../docs/Arts/Cards/Constellation/Leo.png';
import libra from '../../docs/Arts/Cards/Constellation/Libra.png';
import pisces from '../../docs/Arts/Cards/Constellation/Pisces.png';
import sagittarius from '../../docs/Arts/Cards/Constellation/Sagittarius.png';
import scorpio from '../../docs/Arts/Cards/Constellation/Scorpio.png';
import taurus from '../../docs/Arts/Cards/Constellation/Taurus.png';
import virgo from '../../docs/Arts/Cards/Constellation/Virgo.png';

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
