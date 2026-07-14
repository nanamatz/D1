import { JOKER_REGISTRY } from '../../engine/jokers';
import type { RunState } from '../../engine/types';
import { useI18n } from '../i18n';

/** Owned jokers (top-left) + consumables (top-right), per UI_DESIGN §2. */
export function JokerShelf({ run }: { run: RunState }) {
  const { lang } = useI18n();
  return (
    <div className="shelf">
      <div className="jokers">
        {run.jokers.map((owned, i) => {
          const def = JOKER_REGISTRY.get(owned.defId);
          if (!def) return null;
          const name = lang === 'ko' ? def.nameKo : def.nameEn;
          const className = ['joker', def.rarity !== 'common' ? def.rarity : ''].filter(Boolean).join(' ');
          return (
            <div key={i} className={className} tabIndex={0} title={`${name} · ${def.rarity}`}>
              <span className="e">{def.emoji}</span>
              <span className="n">{name}</span>
            </div>
          );
        })}
      </div>
      <div className="consumables">
        {run.consumables.map((c, i) => (
          <div key={i} className="consumable">
            <span className="n">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
