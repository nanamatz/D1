import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import type { ConsumableId, JokerRarity } from '../../engine/types';
import type { PackOption } from '../../engine/packs';
import { NO_LETTER } from '../../engine/scoring';
import { consumableDescKey, jokerDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';
import { Tooltip } from './Tooltip';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

interface Tip {
  title: string;
  body: string;
  rarity?: JokerRarity | undefined;
}

function OptionCard({
  option,
  label,
  name,
  blockKey,
  tip,
  onPick,
}: {
  option: PackOption;
  label: string;
  name: string;
  /** i18n key for why this pick is non-selectable (slots full), or undefined */
  blockKey?: string | undefined;
  /** hover tooltip (item 4) — shown on joker/consumable options regardless of blocked */
  tip?: Tip | undefined;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const card = (
    <div className={['shopitem', blockKey && 'blocked'].filter(Boolean).join(' ')}>
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
      {blockKey ? (
        <span className="pack-block">{t(blockKey)}</span>
      ) : (
        <button className="btn exchange sm" onClick={onPick}>
          {label}
        </button>
      )}
    </div>
  );
  // The tooltip wraps the whole card, so it shows on hover even when the pick is
  // blocked (item 4) — hover is CSS-driven and independent of the block state.
  return tip ? (
    <Tooltip title={tip.title} body={tip.body} rarity={tip.rarity} down>
      {card}
    </Tooltip>
  ) : (
    card
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
    return o.tile.letter ?? NO_LETTER; // tile
  };

  // Hover tooltip for joker / consumable options (item 4) — tiles carry their own.
  const optionTip = (o: PackOption): Tip | undefined => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return { title: optionName(o), body: t(jokerDescKey(o.id)), rarity: def?.rarity };
    }
    if (o.kind === 'consumable') {
      return { title: optionName(o), body: t(consumableDescKey(o.id)) };
    }
    return undefined;
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
          {pack.offer.options.map((o, i) => {
            // A pick is blocked when the matching slot is full (item 5: consumables
            // now block too, not just jokers) — the engine no-ops such a pick anyway.
            const blockKey =
              o.kind === 'joker' && g.state.run.jokers.length >= BALANCE.jokerSlots
                ? 'pack.jokersFull'
                : o.kind === 'consumable' &&
                    g.state.run.consumables.length >= g.state.run.consumableSlots
                  ? 'pack.consumablesFull'
                  : undefined;
            return (
              <OptionCard
                key={i}
                option={o}
                name={optionName(o)}
                label={t('pack.pick')}
                blockKey={blockKey}
                tip={optionTip(o)}
                onPick={() => g.pickPackOption(i)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
