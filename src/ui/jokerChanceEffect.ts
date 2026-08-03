import type { ChanceResult } from '../engine/types';

type Listener = (results: readonly ChanceResult[]) => void;

class JokerChanceEffectBus {
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(results: readonly ChanceResult[]): void {
    if (results.length > 0) this.listeners.forEach((listener) => listener(results));
  }
}

export const jokerChanceEffectBus = new JokerChanceEffectBus();
