import { useEffect, useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import type { ConsumableId, JokerRarity } from '../../engine/types';
import type { PackOption } from '../../engine/packs';
import { NO_LETTER } from '../../engine/scoring';
import { consumableDescKey, jokerDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import { packArt } from '../packArt';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';
import { Tooltip } from './Tooltip';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };
const PUNCTUATION_EMOJI: Partial<Record<ConsumableId, string>> = {
  ellipsis: '…', exclamation: '❗', doubleExclamation: '‼️', period: '。',
  colon: '：', semicolon: '；', dash: '—', comma: '，',
};

/** Emoji/glyph for a non-tile option. */
function optionEmoji(option: PackOption): string {
  if (option.kind === 'joker') return JOKER_REGISTRY.get(option.id)?.emoji ?? '🃏';
  if (option.kind === 'punctuation') return PUNCTUATION_EMOJI[option.id] ?? '✒️';
  if (option.kind === 'consumable') return CONSUMABLE_EMOJI[option.id] ?? '📄';
  return '📄'; // tile carries its own face; never reached here
}

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
        <span className="e">{optionEmoji(option)}</span>
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

/** True when motion should be suppressed (OS setting or the app's reduced-motion toggle). */
function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('force-reduced-motion')
  );
}

const BURST_MS = 900;

/** Pack selection screen (GDD §9.3): pick up to `pick` of the shown options. */
export function PackOpening({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const pack = g.state.pack;
  // Shared open sequence (shake → burst → cards fly in). Plays once per pack — this
  // component mounts fresh each time a pack is opened. Skipped under reduced motion.
  const [opening, setOpening] = useState(() => !motionOff());
  useEffect(() => {
    if (!opening) return;
    const id = setTimeout(() => setOpening(false), BURST_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!pack) return null;

  const optionName = (o: PackOption): string => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return def ? (lang === 'ko' ? def.nameKo : def.nameEn) : o.id;
    }
    if (o.kind === 'tile') return o.tile.letter ?? NO_LETTER;
    return t(`consumable.${o.id}`); // consumable / punctuation
  };

  // Hover tooltip for non-tile options (item 4) — tiles carry their own.
  const optionTip = (o: PackOption): Tip | undefined => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return { title: optionName(o), body: t(jokerDescKey(o.id)), rarity: def?.rarity };
    }
    if (o.kind === 'punctuation') {
      // Explain it levels the mapped pattern immediately (feature-02 B).
      return { title: optionName(o), body: t('pack.punctuationLevels', { pattern: t(`pattern.${o.pattern}`) }) };
    }
    if (o.kind === 'consumable') {
      return { title: optionName(o), body: t(consumableDescKey(o.id)) };
    }
    return undefined;
  };

  const artSrc = packArt(pack.offer.type, pack.offer.size, pack.offer.artVariant);

  return (
    <div className={['shop', 'pack-opening', opening ? 'opening' : 'revealed'].join(' ')}>
      {/* Open sequence overlay: the pack shakes, flashes, and bursts; then the option
          cards fly in beneath (they mount immediately but are hidden until reveal). */}
      {opening && (
        <div className="pack-open-fx" aria-hidden>
          <div className="pack-open-flash" />
          {artSrc ? (
            <img className="pack-open-burst" src={artSrc} alt="" />
          ) : (
            <div className="pack-open-burst generic">📦</div>
          )}
          <div className="pack-open-particles">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="pack-particle" style={{ ['--a' as string]: `${i * 36}deg` }} />
            ))}
          </div>
        </div>
      )}
      <div className="shop-head panel">
        {/* Tile / Charm / Ink packs have art; Consumable shows none. */}
        {artSrc && <img className="pack-open-art" src={artSrc} alt="" />}
        <div className="kind">
          {t(`pack.type.${pack.offer.type}`)} · {t(`pack.size.${pack.offer.size}`)}
        </div>
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
            const takesConsumableSlot = o.kind === 'consumable';
            const blockKey =
              o.kind === 'joker' && g.state.run.jokers.length >= BALANCE.jokerSlots
                ? 'pack.jokersFull'
                : takesConsumableSlot &&
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
