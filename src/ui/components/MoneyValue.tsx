import { useEffect, useRef, useState } from 'react';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A gold readout ($N) that floats a delta pop whenever the amount changes (item 3),
 * mirroring the score-box pops. An increase shows +$N and rises (same animation as the
 * score pops); a decrease shows −$N (never "+−N", item 5) and drops with its own
 * animation. Honors reduced-motion (updates the number, no pop).
 */
export function MoneyValue({ value }: { value: number }) {
  const prev = useRef(value);
  const idRef = useRef(0);
  const [pop, setPop] = useState<{ delta: number; id: number } | null>(null);

  useEffect(() => {
    if (prev.current === value) return;
    const delta = value - prev.current;
    prev.current = value;
    if (reducedMotion() || delta === 0) return;
    idRef.current += 1;
    const id = idRef.current;
    setPop({ delta, id });
    const timer = setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), 800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span className="money money-wrap">
      ${value}
      {pop && (
        <span key={pop.id} className={['money-pop', pop.delta < 0 ? 'down' : 'up'].join(' ')}>
          {pop.delta < 0 ? `-$${Math.abs(pop.delta)}` : `+$${pop.delta}`}
        </span>
      )}
    </span>
  );
}
