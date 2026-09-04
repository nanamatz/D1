import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { consumableEffectBus } from '../consumableEffect';
import { formatScore } from '../formatScore';
import { motionOff as reducedMotion } from '../motion';

export const MONEY_LEDGER_BEAT_MS = 720;
const MONEY_LEDGER_LAST_BEAT_MS = 700;
const MONEY_LEDGER_REDUCED_MS = 2400;
const MONEY_TOTAL_MOTION_MS = 480;

export function moneyDeltaText(delta: number): string {
  return delta < 0
    ? `-$${formatScore(Math.abs(delta))}`
    : `+$${formatScore(delta)}`;
}

/** Real Shop Use Now ledger renderer. */
export function MoneyLedger({
  deltas,
  sequence = 0,
  reduced = false,
  className = '',
  style,
}: {
  deltas: readonly number[];
  sequence?: number;
  reduced?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const visible = deltas.filter((delta) => delta !== 0);
  if (visible.length === 0) return null;
  return (
    <span
      className={['money-ledger', reduced ? 'is-reduced' : '', className].filter(Boolean).join(' ')}
      data-sequence={sequence}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={style}
    >
      {visible.map((delta, index) => (
        <span
          className={['money-ledger-beat', delta < 0 ? 'down' : 'up'].join(' ')}
          key={`${index}-${delta}`}
          style={{ '--money-ledger-delay': `${index * MONEY_LEDGER_BEAT_MS}ms` } as CSSProperties}
        >
          {moneyDeltaText(delta)}
        </span>
      ))}
    </span>
  );
}

interface QueuedLedger {
  id: number;
  deltas: number[];
  reduced: boolean;
  left: number;
  top: number;
}

export function resolveMoneyLedgerEvent(
  currentGold: number,
  eventGold: number,
  deltas: readonly number[],
  presentLedger: boolean,
): { suppressValue: number | null; ledgerDeltas: number[] } {
  const visible = deltas.filter((delta) => delta !== 0);
  return {
    suppressValue: visible.length > 0 && eventGold !== currentGold ? eventGold : null,
    ledgerDeltas: presentLedger ? visible : [],
  };
}

/**
 * A gold readout ($N) that floats ordinary net changes. Money-gaining Fables
 * bought with Shop Use Now instead show the event's ordered cost/full-payout
 * ledger above the shared consumable vignette; the underlying state stays atomic.
 */
export function MoneyValue({
  value,
  presentLedger = false,
}: {
  value: number;
  /** Exactly one co-mounted Shop readout owns the signed Use Now ledger. */
  presentLedger?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const idRef = useRef(0);
  const suppressValue = useRef<number | null>(null);
  const [pop, setPop] = useState<{ delta: number; id: number } | null>(null);
  const [totalMotion, setTotalMotion] = useState<{ direction: 'up' | 'down'; id: number } | null>(null);
  const [ledgerQueue, setLedgerQueue] = useState<QueuedLedger[]>([]);
  const activeLedger = ledgerQueue[0] ?? null;

  useEffect(() => {
    if (!presentLedger) setLedgerQueue([]);
  }, [presentLedger]);

  useEffect(() => consumableEffectBus.on((event) => {
    const presentation = resolveMoneyLedgerEvent(
      prev.current,
      event.run.gold,
      event.moneyDeltas,
      presentLedger,
    );
    if (presentation.suppressValue !== null) suppressValue.current = presentation.suppressValue;
    if (presentation.ledgerDeltas.length === 0) return;
    const rect = anchor.current?.getBoundingClientRect();
    idRef.current += 1;
    setLedgerQueue((queue) => [...queue, {
      id: idRef.current,
      deltas: presentation.ledgerDeltas,
      reduced: reducedMotion(),
      left: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      top: rect ? Math.max(64, rect.top - 8) : 96,
    }]);
  }), [presentLedger]);

  useEffect(() => {
    if (!activeLedger) return;
    const duration = activeLedger.reduced
      ? MONEY_LEDGER_REDUCED_MS
      : (activeLedger.deltas.length - 1) * MONEY_LEDGER_BEAT_MS + MONEY_LEDGER_LAST_BEAT_MS;
    const timer = window.setTimeout(
      () => setLedgerQueue((queue) => queue.slice(1)),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [activeLedger]);

  useEffect(() => {
    if (prev.current === value) return;
    const delta = value - prev.current;
    prev.current = value;
    const reduced = reducedMotion();
    let totalTimer: ReturnType<typeof setTimeout> | undefined;
    if (reduced) {
      setTotalMotion(null);
    } else {
      idRef.current += 1;
      const id = idRef.current;
      setTotalMotion({ direction: delta < 0 ? 'down' : 'up', id });
      totalTimer = setTimeout(
        () => setTotalMotion((motion) => (motion?.id === id ? null : motion)),
        MONEY_TOTAL_MOTION_MS,
      );
    }
    if (suppressValue.current === value) {
      suppressValue.current = null;
      return () => clearTimeout(totalTimer);
    }
    if (reduced || delta === 0) return () => clearTimeout(totalTimer);
    idRef.current += 1;
    const id = idRef.current;
    setPop({ delta, id });
    const timer = setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), 800);
    return () => {
      clearTimeout(totalTimer);
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <span ref={anchor} className="money money-wrap">
      <span
        key={totalMotion?.id ?? 'idle'}
        className={['money-total', totalMotion?.direction].filter(Boolean).join(' ')}
      >
        ${formatScore(value)}
      </span>
      {pop && (
        <span key={pop.id} className={['money-pop', pop.delta < 0 ? 'down' : 'up'].join(' ')}>
          {pop.delta < 0
            ? `-$${formatScore(Math.abs(pop.delta))}`
            : `+$${formatScore(pop.delta)}`}
        </span>
      )}
      {presentLedger && activeLedger && typeof document !== 'undefined' && createPortal(
        <MoneyLedger
          key={activeLedger.id}
          deltas={activeLedger.deltas}
          sequence={activeLedger.id}
          reduced={activeLedger.reduced}
          className="money-ledger-live"
          style={{ left: activeLedger.left, top: activeLedger.top }}
        />,
        document.body,
      )}
    </span>
  );
}
