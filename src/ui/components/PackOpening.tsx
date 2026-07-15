import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import type { ConsumableId } from '../../engine/types';
import type { PackOption } from '../../engine/packs';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

function OptionCard({
  option,
  label,
  name,
  blocked,
  onPick,
}: {
  option: PackOption;
  label: string;
  name: string;
  /** joker slots full → this joker pick is non-selectable (D-5) */
  blocked: boolean;
  onPick: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={['shopitem', blocked && 'blocked'].filter(Boolean).join(' ')}>
      {option.kind === 'tile' ? (
        <TileView tile={option.tile} />
      ) : (
        <span className="e">
          {option.kind === 'joker'
            ? (JOKER_REGISTRY.get(option.id)?.emoji ?? '🃏')
            : (CONSUMABLE_EMOJI[option.id] ?? '📄')}
        </span>
      )}
      <span className="n">{name}</span>
      {blocked ? (
        <span className="pack-block">{t('pack.jokersFull')}</span>
      ) : (
        <button className="btn exchange sm" onClick={onPick}>
          {label}
        </button>
      )}
    </div>
  );
}

/** Pack selection screen (GDD §9.3): pick up to `pick` of the shown options. */
export function PackOpening({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const pack = g.state.pack;
  if (!pack) return null;

  const optionName = (o: PackOption): string => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return def ? (lang === 'ko' ? def.nameKo : def.nameEn) : o.id;
    }
    if (o.kind === 'consumable') return t(`consumable.${o.id}`);
    return o.tile.letter; // tile
  };

  return (
    <div className="shop">
      <div className="shop-head panel">
        <div className="kind">{t(`pack.${pack.offer.kind}`)}</div>
        <div className="money">{t('pack.picksLeft', { n: pack.picksLeft })}</div>
        <button className="btn cash" onClick={g.closePack}>
          {t('pack.done')}
        </button>
      </div>
      <div className="panel">
        <div className="shop-row">
          {pack.offer.options.map((o, i) => (
            <OptionCard
              key={i}
              option={o}
              name={optionName(o)}
              label={t('pack.pick')}
              blocked={o.kind === 'joker' && g.state.run.jokers.length >= BALANCE.jokerSlots}
              onPick={() => g.pickPackOption(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
