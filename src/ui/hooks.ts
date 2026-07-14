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
 */
export function useFlip(ref: RefObject<HTMLElement | null>, key: string): void {
  const prev = useRef<Map<string, DOMRect>>(new Map());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const next = new Map<string, DOMRect>();
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (id) next.set(id, k.getBoundingClientRect());
    }
    if (!reducedMotion()) {
      for (const k of kids) {
        const id = k.dataset.flipId;
        if (!id) continue;
        const old = prev.current.get(id);
        const now = next.get(id);
        if (old && now) {
          const dx = old.left - now.left;
          const dy = old.top - now.top;
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
