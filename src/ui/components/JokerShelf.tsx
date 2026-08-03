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
  jokerTooltip,
} from '../descriptions';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { motionOff } from '../motion';
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
import { mascotSrc } from '../mascots';
import { UiIcon } from './UiIcon';
import type { UiIconId } from '../uiIcons';

const CONSUMABLE_ICON: Partial<Record<ConsumableId, UiIconId>> = { magnifier: 'magnifier' };

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** The firing joker's contribution popup during settle (B step 3). */
export function JokerPop({
  chips,
  mult,
  multFactor,
  score = 0,
  gold = 0,
  applied,
}: {
  chips: number;
  mult: number;
  multFactor?: number | undefined;
  score?: number;
  gold?: number;
  applied: string;
}) {
  const signed = (value: number) => `${value > 0 ? '+' : ''}${fmtMult(value)}`;
  const money = gold > 0 ? `+$${gold}` : `-$${Math.abs(gold)}`;
  const hasValue = chips !== 0 || mult !== 0 || multFactor !== undefined || score !== 0 || gold !== 0;
  return (
    <span className="trigger-pop joker-pop" aria-hidden>
      {chips !== 0 && (
        <span className="chip"><span className="chip-diamond" />{signed(chips)}</span>
      )}
      {(mult !== 0 || multFactor !== undefined) && (
        <span className="mult">
          {multFactor !== undefined ? `×${fmtMult(multFactor)}` : signed(mult)}
        </span>
      )}
      {score !== 0 && (
        <span className="score"><span className="tomato-icon" />{signed(score)}</span>
      )}
      {gold !== 0 && <span className="gold">{money}</span>}
      {!hasValue && <span className="applied">{applied}</span>}
    </span>
  );
}

interface Props {
  run: RunState;
  pouchRemaining: number;
  onUseConsumable?: (id: ConsumableId) => void;
  canUseConsumable?: (id: ConsumableId) => boolean;
  onSellConsumable?: (index: number) => void;
  /** when set (shop), clicking an owned joker opens a Sell menu (D-1) */
  onSellJoker?: (index: number) => void;
  /** when set, the joker shelf supports drag-reorder (feature-02 D-1) */
  onReorderJoker?: (from: number, to: number) => void;
  /** An open Fable pack supplies pouch targets, so targeted Fables wait for its FX. */
  deferTargetFableUse?: boolean;
  /** Blueprint: hide every Emoji Tile behind the selected WooDak skin. */
  jokersFaceDown?: boolean;
}

/** Owned jokers (top-left) + consumables (top-right), per UI_DESIGN §2. */
export function JokerShelf({
  run,
  pouchRemaining,
  onUseConsumable,
  canUseConsumable,
  onSellConsumable,
  onSellJoker,
  onReorderJoker,
  deferTargetFableUse = false,
  jokersFaceDown = false,
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
    if (motionOff()) { apply(); return; }
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
            const tip = jokerTooltip(def.id, owned.edition ?? 'base', t);
            const firing = settle.active && settle.activeJokerId === def.id;
            const enhancedFiring = firing && settle.activeJokerEnhanced;
            const className = [
              'joker',
              'emoji-tile-image-only',
              `edition-${owned.edition ?? 'base'}`,
              jokersFaceDown ? 'face-down' : '',
              owned.state.bossDisabled === 1 ? 'boss-disabled' : '',
              firing ? 'firing' : '',
              enhancedFiring ? 'enhanced-firing' : '',
            ].filter(Boolean).join(' ');
            const jokerLeaving = leaving?.zone === 'joker' && leaving.index === i;
            return (
              <div
                key={i}
                className={[
                  'joker-slot',
                  jokerMenuIdx === i && 'menu-open',
                  jokerLeaving && 'leave-sell',
                  arriving?.zone === 'joker' && i >= arriving.from && 'slot-arriving',
                ].filter(Boolean).join(' ')}
                {...(onReorderJoker ? { 'data-drag-idx': i } : {})}
              >
                <Tooltip
                  title={jokersFaceDown ? t('boss.faceDownJoker') : name}
                  body={jokersFaceDown
                    ? t('boss.faceDownJokerDesc')
                    : tip.body}
                  {...(!jokersFaceDown
                    ? {
                        extra: grownValue(def, owned, t, pouchRemaining),
                        rarity: def.rarity,
                        tags: tip.tags,
                        sub: tip.sub,
                      }
                    : {})}
                  down
                >
                  <TiltCard
                    idle
                    className={className}
                  >
                    {onSellJoker && (
                      <button
                        type="button"
                        className="owned-object-select"
                        aria-label={jokersFaceDown ? t('boss.faceDownJoker') : name}
                        aria-haspopup="menu"
                        aria-expanded={jokerMenuIdx === i}
                        onClick={() => setJokerMenuIdx(jokerMenuIdx === i ? null : i)}
                      />
                    )}
                    {jokersFaceDown ? (
                      <img className="joker-art joker-back-mascot" src={mascotSrc('woodak')} alt="" />
                    ) : (
                      art && <img className="joker-art" src={art} alt="" />
                    )}
                    {onSellJoker && jokerMenuIdx === i && (
                      <div className="consumable-menu bare" role="menu">
                        <button
                          className="sell"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJokerMenuIdx(null);
                            beginLeave('joker', i, 'sell', () => onSellJoker(i));
                          }}
                        >
                          {t('shop.sell', { value: sellValue(BALANCE.jokerPrice[def.rarity]) })}
                        </button>
                      </div>
                    )}
                  </TiltCard>
                </Tooltip>
                {firing && settle.jokerPop && (
                  <JokerPop
                    chips={settle.jokerPop.chips}
                    mult={settle.jokerPop.mult}
                    multFactor={settle.jokerPop.multFactor}
                    score={settle.jokerPop.score}
                    gold={settle.jokerPop.gold}
                    applied={t('settle.applied')}
                  />
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
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    // Stop here — otherwise RunView's window-level ESC handler
                    // also fires and opens the pause menu behind this one.
                    e.stopPropagation();
                    setMenuIdx(null);
                  }
                }}
              >
                <button
                  type="button"
                  className="owned-object-select"
                  aria-label={t(`consumable.${c}`)}
                  aria-haspopup="menu"
                  aria-expanded={menuIdx === i}
                  onClick={() => setMenuIdx(menuIdx === i ? null : i)}
                />
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
                    <UiIcon name={CONSUMABLE_ICON[c] ?? 'document'} className="object-ui-icon" />
                  )}
                </div>
                {menuIdx === i && (
                  // Keep actions inside TiltCard so pointer tilt transforms the
                  // card and buttons as one attached interaction object.
                  <div className="consumable-menu bare" role="menu">
                    <button
                      className="sell"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
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
              </TiltCard>
            </Tooltip>
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
