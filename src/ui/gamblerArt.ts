import barnSwallow from '../../docs/Arts/Cards/Gambler/Vector/BarnSwallow-preview.png';
import boar from '../../docs/Arts/Cards/Gambler/Vector/Boar-preview.png';
import bridge from '../../docs/Arts/Cards/Gambler/Vector/Bridge-preview.png';
import bushWarbler from '../../docs/Arts/Cards/Gambler/Vector/BushWarbler-preview.png';
import butterflies from '../../docs/Arts/Cards/Gambler/Vector/Butterflies-preview.png';
import craneAndSun from '../../docs/Arts/Cards/Gambler/Vector/CraneAndSun-preview.png';
import cuckoo from '../../docs/Arts/Cards/Gambler/Vector/Cuckoo-preview.png';
import curtain from '../../docs/Arts/Cards/Gambler/Vector/Curtain-preview.png';
import deer from '../../docs/Arts/Cards/Gambler/Vector/Deer-preview.png';
import fullMoon from '../../docs/Arts/Cards/Gambler/Vector/FullMoon-preview.png';
import geese from '../../docs/Arts/Cards/Gambler/Vector/Geese-preview.png';
import phoenix from '../../docs/Arts/Cards/Gambler/Vector/Phoenix-preview.png';
import rainman from '../../docs/Arts/Cards/Gambler/Vector/Rainman-preview.png';
import sakeCup from '../../docs/Arts/Cards/Gambler/Vector/SakeCup-preview.png';

/**
 * Art registry for the supplied Gambler card illustrations.
 *
 * This list is the Collection gallery for all fourteen implemented cards.
 * Effects and acquisition live in the engine; this file stays presentation-only.
 */
export const GAMBLER_CARDS = [
  { id: 'barnSwallow', art: barnSwallow },
  { id: 'boar', art: boar },
  { id: 'bridge', art: bridge },
  { id: 'bushWarbler', art: bushWarbler },
  { id: 'butterflies', art: butterflies },
  { id: 'craneAndSun', art: craneAndSun },
  { id: 'cuckoo', art: cuckoo },
  { id: 'curtain', art: curtain },
  { id: 'deer', art: deer },
  { id: 'fullMoon', art: fullMoon },
  { id: 'geese', art: geese },
  { id: 'phoenix', art: phoenix },
  { id: 'rainman', art: rainman },
  { id: 'sakeCup', art: sakeCup },
] as const;

const ART: Readonly<Record<string, string>> = Object.fromEntries(
  GAMBLER_CARDS.map((card) => [card.id, card.art]),
);

/** Illustration for a Gambler card id, or undefined for an unknown id. */
export const gamblerArt = (id: string): string | undefined => ART[id];
