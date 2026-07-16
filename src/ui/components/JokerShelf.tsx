import { useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import { sellValue } from '../../engine/economy';
import type { ConsumableId, RunState } from '../../engine/types';
import { consumableDescKey, jokerDescKey, grownValue } from '../descriptions';
import { useI18n } from '../i18n';
import { useSettleView } from '../settle';
import { Tooltip } from './Tooltip';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** The firing joker's contribution popup during settle (B step 3). */
function JokerPop({ chips, mult }: { chips: number; mult: number }) {
  const parts = [chips ? `+${chips}` : '', mult ? `+${fmtMult(mult)}×` : ''].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="joker-pop">{parts.join(' ')}</span>;
}

interface Props {
  run: RunState;
  onUseConsumable?: (id: ConsumableId) => void;
  onSellConsumable?: (index: number) => void;
  /** when set (shop), clicking an owned joker opens a Sell menu (D-1) */
  onSellJoker?: (index: number) => void;
}

/** Owned jokers (top-left) + consumables (top-right), per UI_DESIGN §2. */
export function JokerShelf({ run, onUseConsumable, onSellConsumable, onSellJoker }: Props) {
  const { t, lang } = useI18n();
  const settle = useSettleView();
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [jokerMenuIdx, setJokerMenuIdx] = useState<number | null>(null);
  return (
    <div className="shelf">
      {/* The count sits OUTSIDE the group box, directly beneath it, so the box's
          height is the joker tile's alone (playtest-06 #1–2). */}
      <div className="shelf-col jokers-col">
        <div className="shelf-group jokers-group">
          <div className="jokers">
          {run.jokers.map((owned, i) => {
            const def = JOKER_REGISTRY.get(owned.defId);
            if (!def) return null;
            const name = lang === 'ko' ? def.nameKo : def.nameEn;
            const accent = def.rarity !== 'common' ? def.rarity : undefined;
            const firing = settle.active && settle.activeJokerId === def.id;
            const className = ['joker', accent, firing ? 'firing' : ''].filter(Boolean).join(' ');
            return (
              <div key={i} className="joker-slot">
                <Tooltip title={name} body={t(jokerDescKey(def.id))} extra={grownValue(def, owned)} accent={accent} down>
                  <div
                    className={className}
                    tabIndex={0}
                    role={onSellJoker ? 'button' : undefined}
                    aria-haspopup={onSellJoker ? 'menu' : undefined}
                    aria-expanded={onSellJoker ? jokerMenuIdx === i : undefined}
                    onClick={onSellJoker ? () => setJokerMenuIdx(jokerMenuIdx === i ? null : i) : undefined}
                  >
                    <span className="e">{def.emoji}</span>
                    <span className="n">{name}</span>
                    {firing && settle.jokerPop && (
                      <JokerPop chips={settle.jokerPop.chips} mult={settle.jokerPop.mult} />
                    )}
                  </div>
                </Tooltip>
                {onSellJoker && jokerMenuIdx === i && (
                  <div className="consumable-menu" role="menu">
                    <button
                      role="menuitem"
                      onClick={() => {
                        onSellJoker(i);
                        setJokerMenuIdx(null);
                      }}
                    >
                      {t('shop.sell', { value: sellValue(BALANCE.jokerPrice[def.rarity]) })}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, BALANCE.jokerSlots - run.jokers.length) }, (_, i) => (
            <div key={`empty-${i}`} className="joker empty" aria-hidden />
          ))}
          </div>
        </div>
        <div className="shelf-count left">
          {run.jokers.length}/{BALANCE.jokerSlots}
        </div>
      </div>
      <div className="shelf-col consumables-col">
        <div className="shelf-group consumables-group">
          <div className="consumables">
        {run.consumables.map((c, i) => (
          <div key={i} className="consumable-slot">
            <Tooltip title={t(`consumable.${c}`)} body={t(consumableDescKey(c))} down>
              <div
                className="consumable use"
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
                <span className="e">{CONSUMABLE_EMOJI[c] ?? '📄'}</span>
                <span className="n">{t(`consumable.${c}`)}</span>
              </div>
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
                    onSellConsumable?.(i);
                    setMenuIdx(null);
                  }}
                >
                  {t('consumable.sellAction', { value: sellValue(BALANCE.consumablePrice) })}
                </button>
                {onUseConsumable && (
                  <button
                    className="use"
                    role="menuitem"
                    onClick={() => {
                      onUseConsumable(c);
                      setMenuIdx(null);
                    }}
                  >
                    {t('consumable.useAction')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, run.consumableSlots - run.consumables.length) }, (_, i) => (
          <div key={`empty-${i}`} className="consumable empty" aria-hidden />
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
