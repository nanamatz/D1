import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChanceResult } from '../../engine/types';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { jokerTooltip } from '../descriptions';
import { useI18n } from '../i18n';
import { jokerArt } from '../jokerArt';
import { jokerChanceEffectBus } from '../jokerChanceEffect';
import { ChanceBadges } from './ChanceBadges';
import { Tooltip } from './Tooltip';

const DURATION_MS = 2400;

export function JokerChanceEffect() {
  const { t, lang } = useI18n();
  const [active, setActive] = useState<readonly ChanceResult[]>([]);

  useEffect(() => jokerChanceEffectBus.on(setActive), []);
  useEffect(() => {
    if (active.length === 0) return;
    const timer = window.setTimeout(() => setActive([]), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (active.length === 0) return null;
  return createPortal(
    <div className="joker-chance-effect" aria-live="polite">
      <div className="joker-chance-stage">
        {active.map((result, index) => {
          const id = result.sourceId;
          const def = id ? JOKER_REGISTRY.get(id) : undefined;
          const art = id ? jokerArt(id) : undefined;
          if (!id || !def || !art) return null;
          const edition = result.sourceEdition ?? 'base';
          const tip = jokerTooltip(id, edition, t);
          return (
            <div key={`${id}-${index}`} className={`joker-chance-entry chance-${result.outcome}`}>
              <Tooltip
                title={lang === 'ko' ? def.nameKo : def.nameEn}
                body={tip.body}
                rarity={def.rarity}
                tags={tip.tags}
                sub={tip.sub}
              >
                <div className={`joker-chance-source emoji-tile-image-only edition-${edition}`} tabIndex={0}>
                  <img src={art} alt="" />
                </div>
              </Tooltip>
              <strong>{lang === 'ko' ? def.nameKo : def.nameEn}</strong>
              <ChanceBadges results={[result]} />
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
