import { useEffect, useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import type { ConsumableId, JokerRarity } from '../../engine/types';
import type { PackOption } from '../../engine/packs';
import { NO_LETTER } from '../../engine/scoring';
import { consumableDescKey, jokerDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { packArt } from '../packArt';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';
import { tileTooltip } from '../game';
import { Tooltip, type TooltipClassification } from './Tooltip';
import { canAddJoker } from '../../engine/vouchers';
import { isFableId } from '../../engine/fables';
import { isConstellationId } from '../../engine/constellations';
import { FableCardArt } from './FableCardArt';
import { ConstellationCardArt } from './ConstellationCardArt';
import { TiltCard } from './TiltCard';
import { consumableClassification } from '../cardClassification';

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
  classification?: TooltipClassification | undefined;
}

function OptionCard({
  option,
  label,
  name,
  blockKey,
  tip,
  picked,
  onPick,
}: {
  option: PackOption;
  label: string;
  name: string;
  /** i18n key for why this pick is non-selectable (slots full), or undefined */
  blockKey?: string | undefined;
  /** hover tooltip (item 4) — shown on joker/consumable options regardless of blocked */
  tip?: Tip | undefined;
  /** feature-04 C: this card is the one just chosen — lifts, pulses, gains an outline */
  picked?: boolean;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const edition =
    option.kind === 'joker' ? option.edition
      : option.kind === 'tile' ? (option.tile.edition ?? 'base')
        : 'base';
  const card = (
    <TiltCard
      idle
      className={['shopitem', `edition-${edition}`, blockKey && 'blocked', picked && 'picked']
        .filter(Boolean)
        .join(' ')}
    >
      {option.kind === 'tile' ? (
        <TileView tile={option.tile} />
      ) : option.kind === 'punctuation' && isConstellationId(option.id) ? (
        <ConstellationCardArt
          id={option.id}
          className="shop-consumable-art"
          title={name}
        />
      ) : option.kind === 'consumable' && isFableId(option.id) ? (
        <FableCardArt
          id={option.id}
          className="shop-consumable-art"
          title={name}
        />
      ) : (
        <span className="e">{optionEmoji(option)}</span>
      )}
      <span className="n">{name}</span>
      {edition !== 'base' && <span className="edition-badge">{edition}</span>}
      {blockKey ? (
        <span className="pack-block">{t(blockKey)}</span>
      ) : (
        <button className="btn exchange sm" onClick={onPick}>
          {label}
        </button>
      )}
    </TiltCard>
  );
  // The tooltip wraps the whole card, so it shows on hover even when the pick is
  // blocked (item 4) — hover is CSS-driven and independent of the block state.
  return tip ? (
    <Tooltip
      title={tip.title}
      body={tip.body}
      rarity={tip.rarity}
      classification={tip.classification}
      down
    >
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
  // feature-04 C: the card just chosen (a stable option key), held for a short beat
  // so its lift + pulse + outline is SEEN before the pick applies and the fan re-arcs
  // (or the overlay closes on the last pick) — selecting used to do nothing visible.
  const [picking, setPicking] = useState<string | null>(null);
  useEffect(() => {
    if (!opening) return;
    const id = setTimeout(() => setOpening(false), BURST_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!pack) return null;

  const PICK_BEAT = motionOff() ? 0 : 320;
  const doPick = (i: number, key: string) => {
    if (picking) return; // one selection resolving at a time
    audio.play('packPick'); // confirm SFX on selection (A-4 / C)
    setPicking(key);
    window.setTimeout(() => {
      g.pickPackOption(i);
      setPicking(null);
    }, PICK_BEAT);
  };

  const optionName = (o: PackOption): string => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return def ? (lang === 'ko' ? def.nameKo : def.nameEn) : o.id;
    }
    if (o.kind === 'tile') return o.tile.letter ?? NO_LETTER;
    return t(`consumable.${o.id}`); // consumable / punctuation
  };

  // Hover tooltip for every revealed option (feature-04 B — opened-pack contents were
  // the known gap). Tiles get the shared 3-axis tooltip too, so a Foil Lead-plate tile
  // in a pack reads the same as one in hand.
  const optionTip = (o: PackOption): Tip | undefined => {
    if (o.kind === 'tile') return tileTooltip(o.tile, t);
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return { title: optionName(o), body: t(jokerDescKey(o.id)), rarity: def?.rarity };
    }
    if (o.kind === 'punctuation') {
      // Explain it levels the mapped pattern immediately (feature-02 B).
      return {
        title: optionName(o),
        body: t('pack.constellationLevels', { pattern: t(`pattern.${o.pattern}`) }),
        classification: 'constellation',
      };
    }
    if (o.kind === 'consumable') {
      return {
        title: optionName(o),
        body: t(consumableDescKey(o.id)),
        classification: consumableClassification(o.id),
      };
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
        {/* Explicit "Pick N of M" (§2.6.1) — N picks remaining, of the M still shown. */}
        <div className="money">{t('pack.pickOf', { n: pack.picksLeft, m: pack.offer.options.length })}</div>
        {/* A single, always-available Skip — unpicked contents are discarded. */}
        <button className="btn cash" onClick={g.closePack}>
          {t('pack.skip')}
        </button>
      </div>
      <div className="panel">
        {/* Balatro fan: cards arc across the centre at full size (§2.6.1). Each card's
            rotation + arc-drop comes from its position; the middle sits highest. */}
        <div className="pack-fan">
          {pack.offer.options.map((o, i) => {
            // A pick is blocked when the matching slot is full (item 5: consumables
            // now block too, not just jokers) — the engine no-ops such a pick anyway.
            const takesConsumableSlot = o.kind === 'consumable' || o.kind === 'punctuation';
            const blockKey =
              o.kind === 'joker' && !canAddJoker(g.state.run, o.edition)
                ? 'pack.jokersFull'
                : takesConsumableSlot &&
                    g.state.run.consumables.length >= g.state.run.consumableSlots
                  ? 'pack.consumablesFull'
                  : undefined;
            const N = pack.offer.options.length;
            const mid = (N - 1) / 2;
            const key = o.kind === 'tile' ? `t:${o.tile.id}` : `${o.kind}:${o.id}:${i}`;
            const fanStyle = {
              ['--fan-rot' as string]: `${(i - mid) * 7}deg`,
              ['--fan-y' as string]: `${Math.abs(i - mid) ** 1.4 * 7}px`,
            };
            return (
              <div key={key} className="pack-fan-card" style={fanStyle}>
                <OptionCard
                  option={o}
                  name={optionName(o)}
                  label={t('pack.pick')}
                  blockKey={blockKey}
                  tip={optionTip(o)}
                  picked={picking === key}
                  onPick={() => doPick(i, key)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
