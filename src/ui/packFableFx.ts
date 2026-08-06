import type { FableId } from '../engine/fables';

export interface HeldPackFableEvent {
  id: FableId;
  tileIds: string[];
  resolve: () => void;
}

type Listener = (event: HeldPackFableEvent) => void;

/** Transient bridge from the persistent consumable shelf to an open candidate-pack panel. */
class PackFableFxBus {
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: HeldPackFableEvent): boolean {
    this.listeners.forEach((listener) => listener(event));
    return this.listeners.size > 0;
  }
}

export const packFableFxBus = new PackFableFxBus();
