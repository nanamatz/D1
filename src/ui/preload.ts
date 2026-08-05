const decoded = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** Fetch and decode one image without blocking the screen that will use it. */
export function preloadImage(url: string): Promise<void> {
  if (decoded.has(url)) return Promise.resolve();
  const existing = pending.get(url);
  if (existing) return existing;

  const image = new Image();
  let task: Promise<void>;
  if (typeof image.decode === 'function') {
    image.src = url;
    task = image.decode().catch(() => undefined);
  } else {
    task = new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = url;
    });
  }

  const tracked = task.finally(() => {
    decoded.add(url);
    pending.delete(url);
  });
  pending.set(url, tracked);
  return tracked;
}

/** Decode at most one image per idle turn so background warming never becomes a spike. */
export function preloadImagesWhenIdle(urls: readonly string[]): () => void {
  const queue = [...new Set(urls)].filter((url) => !decoded.has(url));
  let stopped = false;
  let idleHandle: number | null = null;
  let timerHandle: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (stopped || queue.length === 0) return;
    if (typeof requestIdleCallback === 'function') {
      idleHandle = requestIdleCallback(run, { timeout: 1000 });
    } else {
      timerHandle = setTimeout(run, 50);
    }
  };
  const run = () => {
    idleHandle = null;
    timerHandle = null;
    const url = queue.shift();
    if (!url || stopped) return;
    void preloadImage(url).finally(schedule);
  };

  schedule();
  return () => {
    stopped = true;
    if (idleHandle !== null && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(idleHandle);
    }
    if (timerHandle !== null) clearTimeout(timerHandle);
  };
}
