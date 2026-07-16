import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** useState mirrored to localStorage (P1-1 persists the sort choice). */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [key, value]);
  return [value, setValue];
}

/**
 * FLIP: animate direct children (each tagged data-flip-id) from their previous
 * positions to their new ones whenever `key` changes. Used for hand reordering
 * (P1-1 sort, P1-2 drag). Honors prefers-reduced-motion.
 *
 * Positions are measured RELATIVE TO THE CONTAINER, never the viewport. The board
 * now mounts inside the screen transition's sliding pane, so a viewport rect taken
 * at round start is captured mid-transform and reads far to the right; the next
 * FLIP would diff against it and replay that offset — the whole hand visibly slid
 * right-to-left on the first tile selection of a round (playtest-06). An ancestor
 * transform offsets the container and its children equally, so container-relative
 * deltas cancel it out and only real reordering animates.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, key: string): void {
  const prev = useRef<Map<string, { x: number; y: number }>>(new Map());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const kids = Array.from(el.children) as HTMLElement[];
    const next = new Map<string, { x: number; y: number }>();
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (!id) continue;
      const r = k.getBoundingClientRect();
      next.set(id, { x: r.left - base.left, y: r.top - base.top });
    }
    if (!reducedMotion()) {
      for (const k of kids) {
        const id = k.dataset.flipId;
        if (!id) continue;
        const old = prev.current.get(id);
        const now = next.get(id);
        if (old && now) {
          const dx = old.x - now.x;
          const dy = old.y - now.y;
          if (dx || dy) {
            k.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
              { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' },
            );
          }
        }
      }
    }
    prev.current = next;
  }, [key, ref]);
}
