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
 * This list is the COLLECTION gallery and holds all fourteen supplied cards,
 * including Rainman and Sake Cup — whose effects are still pending, so they have
 * no engine definition (`src/engine/gamblers.ts` ships the confirmed twelve).
 * Effects and acquisition live in the engine; this file stays presentation-only.
 */
export const GAMBLER_CARDS = [
  { id: 'barnSwallow', nameEn: 'Barn Swallow', nameKo: '제비', art: barnSwallow },
  { id: 'boar', nameEn: 'Boar', nameKo: '멧돼지', art: boar },
  { id: 'bridge', nameEn: 'Bridge', nameKo: '다리', art: bridge },
  { id: 'bushWarbler', nameEn: 'Bush Warbler', nameKo: '휘파람새', art: bushWarbler },
  { id: 'butterflies', nameEn: 'Butterflies', nameKo: '나비', art: butterflies },
  { id: 'craneAndSun', nameEn: 'Crane and Sun', nameKo: '학과 해', art: craneAndSun },
  { id: 'cuckoo', nameEn: 'Cuckoo', nameKo: '뻐꾸기', art: cuckoo },
  { id: 'curtain', nameEn: 'Curtain', nameKo: '휘장', art: curtain },
  { id: 'deer', nameEn: 'Deer', nameKo: '사슴', art: deer },
  { id: 'fullMoon', nameEn: 'Full Moon', nameKo: '보름달', art: fullMoon },
  { id: 'geese', nameEn: 'Geese', nameKo: '기러기', art: geese },
  { id: 'phoenix', nameEn: 'Phoenix', nameKo: '봉황', art: phoenix },
  { id: 'rainman', nameEn: 'Rainman', nameKo: '우중인', art: rainman },
  { id: 'sakeCup', nameEn: 'Sake Cup', nameKo: '사케 잔', art: sakeCup },
] as const;

const ART: Readonly<Record<string, string>> = Object.fromEntries(
  GAMBLER_CARDS.map((card) => [card.id, card.art]),
);

/** Illustration for a Gambler card id, or undefined for an unknown id. */
export const gamblerArt = (id: string): string | undefined => ART[id];
