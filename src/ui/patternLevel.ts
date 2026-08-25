/**
 * feedback #6: a tiny event bus for the constellation level-up flourish. When a
 * Constellation card levels a sentence pattern, useGame emits the pattern + old/new
 * level here and <PatternLevelUp/> (mounted in App) animates "Pattern Lv. N → N+1".
 * Kept off RunState — it's transient presentation, like the chromatic-reveal bus.
 */
export interface PatternLevelEvent {
  cardId: ConstellationId;
  pattern: PatternId;
  from: number;
  to: number;
}

export type PatternLevelTone = 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red';

export function patternLevelTone(level: number): PatternLevelTone {
  if (level <= 1) return 'white';
  if (level <= 3) return 'yellow';
  if (level <= 5) return 'orange';
  if (level <= 8) return 'green';
  if (level <= 12) return 'blue';
  if (level <= 16) return 'purple';
  return 'red';
}

export const patternLevelClass = (level: number): string =>
  `pattern-level-${patternLevelTone(level)}`;

type Listener = (e: PatternLevelEvent) => void;

class PatternLevelBus {
  private listeners = new Set<Listener>();
  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(e: PatternLevelEvent): void {
    this.listeners.forEach((l) => l(e));
  }
}

export const patternLevelBus = new PatternLevelBus();
import type { ConstellationId } from '../engine/constellations';
import type { PatternId } from '../engine/types';
