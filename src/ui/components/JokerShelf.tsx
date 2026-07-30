import { useEffect, useRef, useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import { sellValue } from '../../engine/economy';
import type { ConsumableId, RunState } from '../../engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
  grownValue,
  jokerDescKey,
} from '../descriptions';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { useSettleView } from '../settle';
import { Tooltip } from './Tooltip';
import { TiltCard } from './TiltCard';
import { jokerSlotLimit } from '../../engine/vouchers';
import { fableTargetsTiles, isFableId } from '../../engine/fables';
import { isConstellationId } from '../../engine/constellations';
import { isGamblerId } from '../../engine/gamblers';
import { consumableClassification } from '../cardClassification';
import { useShelfDrag } from '../drag';
import { jokerArt } from '../jokerArt';
import { CardArt } from './CardArt';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** The firing joker's contribution popup during settle (B step 3). */
function JokerPop({
  chips,
  mult,
  score = 0,
  gold = 0,
}: {
  chips: number;
  mult: number;
  score?: number;
  gold?: number;
}) {
  const parts = [
    chips ? `+${chips}` : '',
    mult ? `+${fmtMult(mult)}` : '',
    score ? `+${score}` : '',
    gold ? `+$${gold}` : '',
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="joker-pop">{parts.join(' ')}</span>;
}

interface Props {
  run: RunState;
  onUseConsumable?: (id: ConsumableId) => void;
  canUseConsumable?: (id: ConsumableId) => boolean;
  onSellConsumable?: (index: number) => void;
  /** when set (shop), clicking an owned joker opens a Sell menu (D-1) */
  onSellJoker?: (index: number) => void;
  /** when set, the joker shelf supports drag-reorder (feature-02 D-1) */
  onReorderJoker?: (from: number, to: number) => void;
  /** An open Fable pack supplies pouch targets, so targeted Fables wait for its FX. */
  deferTargetFableUse?: boolean;
}

/** Owned jokers (top-left) + consumables (top-right), per UI_DESIGN §2. */
export function JokerShelf({
  run,
  onUseConsumable,
  canUseConsumable,
  onSellConsumable,
  onSellJoker,
  onReorderJoker,
  deferTargetFableUse = false,
}: Props) {
  const { t, lang } = useI18n();
  const settle = useSettleView();
  const emojiSlotLimit = jokerSlotLimit(run);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [jokerMenuIdx, setJokerMenuIdx] = useState<number | null>(null);
  // A-3: pair every object action with a brief on-object animation before it resolves
  // — pop/dissolve when consumed, slide-away when sold — so it never looks like nothing
  // happened. The state change is delayed one beat so the animation is seen.
  const [leaving, setLeaving] = useState<{ zone: 'consumable' | 'joker'; index: number; mode: 'use' | 'sell' } | null>(null);
  // Objects added while this shelf is mounted pop into their slot once. Initial
  // shelf contents and screen remounts stay quiet; this is acquisition feedback,
  // not a generic entrance animation.
  const previousCounts = useRef({ jokers: run.jokers.length, consumables: run.consumables.length });
  const [arriving, setArriving] = useState<{ zone: 'joker' | 'consumable'; from: number } | null>(null);
  useEffect(() => {
    const prev = previousCounts.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (run.jokers.length > prev.jokers) {
      setArriving({ zone: 'joker', from: prev.jokers });
      timer = setTimeout(() => setArriving(null), 520);
    } else if (run.consumables.length > prev.consumables) {
      setArriving({ zone: 'consumable', from: prev.consumables });
      timer = setTimeout(() => setArriving(null), 520);
    }
    previousCounts.current = { jokers: run.jokers.length, consumables: run.consumables.length };
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [run.jokers.length, run.consumables.length]);
  const beginLeave = (
    zone: 'consumable' | 'joker',
    index: number,
    mode: 'use' | 'sell',
    apply: () => void,
  ) => {
    const reduce =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('force-reduced-motion'));
    if (reduce) { apply(); return; }
    setLeaving({ zone, index, mode });
    window.setTimeout(() => { apply(); setLeaving(null); }, 260);
  };
  // feature-04 D: spring-physics reorder for the Emoji-Tile shelf (same feel as the
  // hand), replacing native DnD. Commits reorderJoker(from, to) once on drop.
  const jokersRef = useRef<HTMLDivElement>(null);
  useShelfDrag(jokersRef, !!onReorderJoker, {
    reorder: (from, to) => onReorderJoker?.(from, to),
    playGrab: () => audio.play('tilePick'),
    playDrop: () => audio.play('dragSnap'),
  });
  return (
    <div className="shelf">
      {/* The count sits OUTSIDE the group box, directly beneath it, so the box's
          height is the joker tile's alone (playtest-06 #1–2). */}
      <div className="shelf-col jokers-col">
        <div className="shelf-group jokers-group">
          <div className="jokers" ref={jokersRef}>
          {run.jokers.map((owned, i) => {
            const def = JOKER_REGISTRY.get(owned.defId);
            if (!def) return null;
            const name = lang === 'ko' ? def.nameKo : def.nameEn;
            const art = jokerArt(def.id);
            const firing = settle.active && settle.activeJokerId === def.id;
            const className = [
              'joker',
              'emoji-tile-image-only',
              `edition-${owned.edition ?? 'base'}`,
              firing ? 'firing' : '',
            ].filter(Boolean).join(' ');
            const jokerLeaving = leaving?.zone === 'joker' && leaving.index === i;
            return (
              <div
                key={i}
                className={[
                  'joker-slot',
                  jokerLeaving && 'leave-sell',
                  arriving?.zone === 'joker' && i >= arriving.from && 'slot-arriving',
                ].filter(Boolean).join(' ')}
                {...(onReorderJoker ? { 'data-drag-idx': i } : {})}
              >
                <Tooltip
                  title={name}
                  body={t(jokerDescKey(def.id))}
                  extra={grownValue(def, owned, t)}
                  rarity={def.rarity}
                  down
                >
                  <TiltCard
                    idle
                    className={className}
                    tabIndex={0}
                    role={onSellJoker ? 'button' : undefined}
                    aria-haspopup={onSellJoker ? 'menu' : undefined}
                    aria-expanded={onSellJoker ? jokerMenuIdx === i : undefined}
                    onClick={onSellJoker ? () => setJokerMenuIdx(jokerMenuIdx === i ? null : i) : undefined}
                  >
                    {art && <img className="joker-art" src={art} alt="" />}
                    {firing && settle.jokerPop && (
                      <JokerPop
                        chips={settle.jokerPop.chips}
                        mult={settle.jokerPop.mult}
                        score={settle.jokerPop.score}
                        gold={settle.jokerPop.gold}
                      />
                    )}
                  </TiltCard>
                </Tooltip>
                {onSellJoker && jokerMenuIdx === i && (
                  // Same `bare` menu the consumable shelf uses, so Sell looks and
                  // behaves identically on both shelves.
                  <div className="consumable-menu bare" role="menu">
                    <button
                      className="sell"
                      role="menuitem"
                      onClick={() => {
                        setJokerMenuIdx(null);
                        beginLeave('joker', i, 'sell', () => onSellJoker(i));
                      }}
                    >
                      {t('shop.sell', { value: sellValue(BALANCE.jokerPrice[def.rarity]) })}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
        <div className="shelf-count left">
          {run.jokers.length}/{emojiSlotLimit}
        </div>
      </div>
      <div className="shelf-col consumables-col">
        <div className="shelf-group consumables-group">
          <div className="consumables">
        {run.consumables.map((c, i) => (
          <div
            key={i}
            className={[
              'consumable-slot',
              menuIdx === i ? 'menu-open' : '',
              leaving?.zone === 'consumable' && leaving.index === i ? `leave-${leaving.mode}` : '',
              arriving?.zone === 'consumable' && i >= arriving.from ? 'slot-arriving' : '',
            ].filter(Boolean).join(' ')}
          >
            <Tooltip
              title={t(`consumable.${c}`)}
              body={consumableTooltipBody(c, t)}
              extra={consumableTooltipExtra(c, run, t)}
              classification={consumableClassification(c)}
              sub={consumableAxisTip(c, t) ?? undefined}
              down
            >
              <TiltCard
                idle
                className="consumable-object"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-expanded={menuIdx === i}
                onClick={() => setMenuIdx(menuIdx === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMenuIdx(menuIdx === i ? null : i);
                  } else if (e.key === 'Escape') {
                    // Stop here — otherwise RunView's window-level ESC handler
                    // also fires and opens the pause menu behind this one.
                    e.stopPropagation();
                    setMenuIdx(null);
                  }
                }}
              >
                <div className="consumable-object-art">
                  {isFableId(c) ? (
                    <CardArt family="fable"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : isConstellationId(c) ? (
                    <CardArt family="constellation"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : isGamblerId(c) ? (
                    <CardArt family="gambler"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : (
                    <span className="e">{CONSUMABLE_EMOJI[c] ?? '📄'}</span>
                  )}
                </div>
              </TiltCard>
            </Tooltip>
            {menuIdx === i && (
              // `bare` = no wrapping box; the buttons carry the meaning by colour
              // (use = pack-open green, sell = discard red) — playtest-06 item 3.
              <div className="consumable-menu bare" role="menu">
                {/* Sell sits above Use — reordered here rather than with CSS
                    `order` so keyboard/AT order follows the visual order. */}
                <button
                  className="sell"
                  role="menuitem"
                  onClick={() => {
                    setMenuIdx(null);
                    beginLeave('consumable', i, 'sell', () => onSellConsumable?.(i));
                  }}
                >
                  {t('consumable.sellAction', { value: sellValue(BALANCE.consumablePrice) })}
                </button>
                {onUseConsumable && (
                  <button
                    className="use"
                    role="menuitem"
                    disabled={canUseConsumable ? !canUseConsumable(c) : false}
                    onClick={() => {
                      setMenuIdx(null);
                      // Targeted Fables used against an open pack stay on the shelf
                      // until the pack-owned transformation animation commits them.
                      if (deferTargetFableUse && isFableId(c) && fableTargetsTiles(c)) {
                        onUseConsumable(c);
                      } else {
                        beginLeave('consumable', i, 'use', () => onUseConsumable(c));
                      }
                    }}
                  >
                    {t('consumable.useAction')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
          </div>
        </div>
        <div className="shelf-count right">
          {run.consumables.length}/{run.consumableSlots}
        </div>
      </div>
    </div>
  );
}
