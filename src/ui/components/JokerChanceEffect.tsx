import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChanceResult } from '../../engine/types';
import { jokerChanceEffectBus } from '../jokerChanceEffect';
import { ChanceBadges } from './ChanceBadges';

const DURATION_MS = 600;

interface AnchoredChance {
  id: number;
  result: ChanceResult;
  x: number;
  y: number;
  placement: 'above' | 'below';
}

export function JokerChanceEffect() {
  const [active, setActive] = useState<readonly AnchoredChance[]>([]);
  const eventId = useRef(0);

  useEffect(() => jokerChanceEffectBus.on((results) => {
    const used = new Set<HTMLElement>();
    const anchors = [...document.querySelectorAll<HTMLElement>('.joker-slot[data-joker-id]')];
    const next = results.flatMap((result, index): AnchoredChance[] => {
      const slot = anchors.find((candidate) =>
        !used.has(candidate) && candidate.dataset.jokerId === result.sourceId);
      const card = slot?.querySelector<HTMLElement>('.joker');
      if (!slot || !card) return [];
      used.add(slot);
      const rect = card.getBoundingClientRect();
      const placement = rect.bottom + 64 <= window.innerHeight ? 'below' : 'above';
      card.classList.remove('firing');
      void card.offsetWidth;
      card.classList.add('firing');
      window.setTimeout(() => card.classList.remove('firing'), DURATION_MS);
      return [{
        id: eventId.current + index,
        result,
        x: rect.left + rect.width / 2,
        y: placement === 'below' ? rect.bottom + 10 : rect.top - 10,
        placement,
      }];
    });
    eventId.current += results.length;
    setActive(next);
  }), []);
  useEffect(() => {
    if (active.length === 0) return;
    const timer = window.setTimeout(() => setActive([]), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (active.length === 0) return null;
  return createPortal(
    <Fragment>
      {active.map(({ id, result, x, y, placement }) => (
        <span
          key={id}
          className={`trigger-pop joker-chance-pop ${placement} chance-${result.outcome}`}
          style={{ left: x, top: y }}
          role="status"
          aria-live="polite"
        >
          <ChanceBadges results={[result]} />
        </span>
      ))}
    </Fragment>,
    document.body,
  );
}
