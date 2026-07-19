import { useState } from 'react';
import { useI18n } from '../i18n';
import piyakUrl from '../assets/piyak.png';
import cushionUrl from '../assets/piyak-cushion.png';

/** Size of the mascot.welcome.N pool in the locale files. */
const MASCOT_WELCOME_COUNT = 8;

/**
 * 삐약이 (Piyak), the tuxedo-cat shop proprietor (UI_DESIGN §6): idle decoration
 * with one random welcome line per shop visit. UI-only cosmetic, so plain
 * Math.random is fine — the seeded-RNG rule covers the engine only.
 */
export function ShopMascot() {
  const { t } = useI18n();
  const [line] = useState(() => Math.floor(Math.random() * MASCOT_WELCOME_COUNT));
  return (
    <div className="mascot">
      <div className="mascot-bubble">{t(`mascot.welcome.${line}`)}</div>
      <div className="mascot-seat">
        <img className="mascot-cat" src={piyakUrl} alt="" />
        <img className="mascot-cushion" src={cushionUrl} alt="" />
      </div>
    </div>
  );
}
