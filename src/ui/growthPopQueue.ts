export interface GrowthPopQueue<T> {
  enqueue(items: readonly T[]): void;
  setPaused(paused: boolean): void;
  reset(): void;
  dispose(): void;
}

/** One durable timer pumps an append-only FIFO; ordinary renders only append. */
export function createGrowthPopQueue<T>(
  show: (item: T) => void,
  clear: () => void,
  delay: number,
): GrowthPopQueue<T> {
  const pending: T[] = [];
  let active = false;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = (): void => {
    timer = null;
    clear();
    active = false;
    pump();
  };

  const arm = (): void => {
    if (!paused && active && timer === null) timer = setTimeout(finish, delay);
  };

  const pump = (): void => {
    if (paused || active) return;
    const item = pending.shift();
    if (item === undefined) return;
    active = true;
    show(item);
    arm();
  };

  const stop = (notify: boolean): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending.length = 0;
    active = false;
    if (notify) clear();
  };

  const reset = (): void => stop(true);

  return {
    enqueue(items) {
      if (items.length === 0) return;
      pending.push(...items);
      pump();
    },
    setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      if (paused) {
        if (timer) clearTimeout(timer);
        timer = null;
        if (active) {
          active = false;
          clear();
        }
      } else {
        pump();
      }
    },
    reset,
    dispose() {
      stop(false);
    },
  };
}
