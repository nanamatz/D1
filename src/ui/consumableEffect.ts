import type { ConsumableId, OwnedJoker, RunState, Tile } from '../engine/types';

export interface ConsumableEffectEvent {
  id: ConsumableId;
  removedTiles: Tile[];
  addedTiles: Tile[];
  changedTiles: Tile[];
  removedJokers: OwnedJoker[];
  addedJokers: OwnedJoker[];
  addedConsumables: ConsumableId[];
  goldDelta: number;
  handSizeDelta: number;
  patternLevelsGained: number;
}

const jokerKey = (joker: OwnedJoker): string => JSON.stringify([
  joker.defId,
  joker.edition ?? 'base',
  Object.entries(joker.state).sort(([a], [b]) => a.localeCompare(b)),
]);

const subtractBy = <T,>(source: readonly T[], remove: readonly T[], key: (value: T) => string): T[] => {
  const remaining = remove.map(key);
  return source.filter((value) => {
    const index = remaining.indexOf(key(value));
    if (index < 0) return true;
    remaining.splice(index, 1);
    return false;
  });
};

/** Snapshot the visible outcome once an engine consumable mutation has committed. */
export function buildConsumableEffect(
  id: ConsumableId,
  before: RunState,
  after: RunState,
): ConsumableEffectEvent {
  const beforeTiles = new Map(before.bag.map((tile) => [tile.id, tile]));
  const afterTiles = new Map(after.bag.map((tile) => [tile.id, tile]));
  return {
    id,
    removedTiles: before.bag.filter((tile) => !afterTiles.has(tile.id)),
    addedTiles: after.bag.filter((tile) => !beforeTiles.has(tile.id)),
    changedTiles: after.bag.filter((tile) => {
      const previous = beforeTiles.get(tile.id);
      return previous !== undefined && JSON.stringify(previous) !== JSON.stringify(tile);
    }),
    removedJokers: subtractBy(before.jokers, after.jokers, jokerKey),
    addedJokers: subtractBy(after.jokers, before.jokers, jokerKey),
    addedConsumables: subtractBy(after.consumables, before.consumables, String),
    goldDelta: after.gold - before.gold,
    handSizeDelta: after.handSize - before.handSize,
    patternLevelsGained: Object.entries(after.patternLevels).reduce(
      (sum, [pattern, level]) =>
        sum + Math.max(0, level - (before.patternLevels[pattern as keyof typeof before.patternLevels] ?? 0)),
      0,
    ),
  };
}

type Listener = (event: ConsumableEffectEvent) => void;

class ConsumableEffectBus {
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(id: ConsumableId, before: RunState, after: RunState): void {
    const event = buildConsumableEffect(id, before, after);
    this.listeners.forEach((listener) => listener(event));
  }
}

export const consumableEffectBus = new ConsumableEffectBus();
