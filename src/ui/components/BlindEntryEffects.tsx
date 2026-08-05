import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Tile } from '../../engine/types';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import { motionOff } from '../motion';
import type { BlindEntryEffectEvent } from '../useGame';
import { TileView } from './Tile';

const TRIGGER_MS = 760;
const REDUCED_TRIGGER_MS = 180;

interface ActiveTrigger {
  id: number;
  x: number;
  startY: number;
  popY: number;
  targetX: number;
  targetY: number;
  tiles: Tile[];
}

/** Plays successful Blind Select Emoji Tile hooks in shelf order. */
export function BlindEntryEffects({
  event,
  onComplete,
}: {
  event: BlindEntryEffectEvent | null;
  onComplete: (event: BlindEntryEffectEvent) => void;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<ActiveTrigger | null>(null);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    let sequence = 0;
    const timers: number[] = [];
    const firingCards = new Set<HTMLElement>();
    const reduced = motionOff();
    const beatMs = reduced ? REDUCED_TRIGGER_MS : TRIGGER_MS;

    const later = (fn: () => void, delay: number) => {
      timers.push(window.setTimeout(fn, delay));
    };
    const play = (index: number) => {
      if (cancelled) return;
      const trigger = event.triggers[index];
      if (!trigger) {
        setActive(null);
        onComplete(event);
        return;
      }
      const card = document.querySelector<HTMLElement>(
        `.joker-slot[data-joker-index="${trigger.jokerIndex}"] .joker`,
      );
      const pouch = document.querySelector<HTMLElement>('.pouch-widget');
      if (!card) {
        later(() => play(index + 1), 0);
        return;
      }

      const cardRect = card.getBoundingClientRect();
      const pouchRect = pouch?.getBoundingClientRect() ?? cardRect;
      const stones = trigger.jokerId === 'megalith' && !reduced ? trigger.createdTiles : [];
      card.classList.remove('firing');
      void card.offsetWidth;
      card.classList.add('firing');
      firingCards.add(card);
      audio.play('jokerEffect');
      setActive({
        id: sequence++,
        x: cardRect.left + cardRect.width / 2,
        startY: cardRect.top + cardRect.height / 2,
        popY: cardRect.bottom + 10,
        targetX: pouchRect.left + pouchRect.width / 2,
        targetY: pouchRect.top + pouchRect.height / 2,
        tiles: stones,
      });

      if (stones.length > 0 && pouch) {
        later(() => {
          if (cancelled) return;
          pouch.classList.add('receiving-tile');
          audio.play('matStone');
          later(() => pouch.classList.remove('receiving-tile'), 300);
        }, beatMs - 170);
      }
      later(() => {
        card.classList.remove('firing');
        firingCards.delete(card);
        setActive(null);
        play(index + 1);
      }, beatMs);
    };

    const frame = window.requestAnimationFrame(() => play(0));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      firingCards.forEach((card) => card.classList.remove('firing'));
      document.querySelector<HTMLElement>('.pouch-widget')?.classList.remove('receiving-tile');
    };
  }, [event, onComplete]);

  if (!active) return null;
  return createPortal(
    <>
      <span
        key={`pop-${active.id}`}
        className="trigger-pop blind-entry-trigger-pop"
        style={{ left: active.x, top: active.popY }}
        role="status"
        aria-live="polite"
      >
        {t('settle.applied')}
      </span>
      {active.tiles.map((tile, index) => {
        const midX = (active.targetX - active.x) * 0.45;
        const midY = (active.targetY - active.startY) * 0.3 - 70;
        const style = {
          left: active.x - 18,
          top: active.startY - 18,
          '--blind-fly-mid-x': `${midX}px`,
          '--blind-fly-mid-y': `${midY}px`,
          '--blind-fly-x': `${active.targetX - active.x}px`,
          '--blind-fly-y': `${active.targetY - active.startY}px`,
          animationDelay: `${index * 70}ms`,
        } as CSSProperties;
        return (
          <div key={tile.id} className="blind-entry-stone-fly" style={style} aria-hidden>
            <TileView tile={tile} mini tilt={false} />
          </div>
        );
      })}
    </>,
    document.body,
  );
}
