import { useLayoutEffect, useRef, useState } from 'react';
import type { PatternId } from '../engine/types';

export interface FinalPatternNotice {
  id: number;
  pattern: PatternId;
  level: number;
}

type FinalPatternSource = {
  pattern: PatternId | null;
  level: number | null;
} | null;

/**
 * Shows a finalized BUILD pattern once, but clears it before the first Shop
 * paint when Collect removes the finalized snapshot. Phase changes alone must
 * not shorten the title's 1.7-second cashout-visible lifetime.
 */
export function useFinalPatternNotice(
  phase: string,
  source: FinalPatternSource,
  durationMs: number,
): FinalPatternNotice | null {
  const sequence = useRef(0);
  const [notice, setNotice] = useState<FinalPatternNotice | null>(null);

  useLayoutEffect(() => {
    if (!source?.pattern) {
      setNotice(null);
      return;
    }
    if (phase !== 'playing') return;
    sequence.current += 1;
    setNotice({
      id: sequence.current,
      pattern: source.pattern,
      level: source.level ?? 1,
    });
    const timer = window.setTimeout(() => setNotice(null), durationMs);
    return () => window.clearTimeout(timer);
    // The finalized snapshot is the publication/clear signal. Cashout phase
    // changes deliberately do not restart or cancel its presentation timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return notice;
}
