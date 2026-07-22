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
export interface FlipOpts {
  /** Viewport coords of the draw origin (the pouch). Entering (freshly drawn)
   *  tiles fly from here. Omit for containers that should NOT animate enters
   *  (e.g. the staged row) — then only reorder/shift animate, as before. */
  enterOrigin?: () => { x: number; y: number } | null;
  /** Fired once per entering tile in DOM order (0-based) so the caller can play
   *  a staggered per-tile sound. Fires even under reduced motion (sound ≠ motion). */
  onEnter?: (index: number) => void;
}

export function useFlip(ref: RefObject<HTMLElement | null>, key: string, opts?: FlipOpts): void {
  const prev = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Every id ever seen in this container. A tile absent from `prev` but present in
  // `seen` returned from the staged row (do NOT fly it from the pouch); a tile absent
  // from both is a genuine fresh draw (fly it in).
  const seen = useRef<Set<string>>(new Set());
  const optsRef = useRef(opts);
  optsRef.current = opts;
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
    const reduce = reducedMotion();
    const o = optsRef.current;
    const origin = o?.enterOrigin?.() ?? null;
    let enterIdx = 0;
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (!id) continue;
      const now = next.get(id)!;
      const isEnter = !seen.current.has(id);
      if (isEnter && o?.enterOrigin) {
        // Freshly drawn tile — pouch enter (staggered), plus the per-tile sound.
        o.onEnter?.(enterIdx);
        if (!reduce) {
          const ox = origin ? origin.x - base.left : now.x;
          const oy = origin ? origin.y - base.top : base.height + 40;
          const dx = ox - now.x;
          const dy = oy - now.y;
          k.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 340, delay: enterIdx * 60, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
          );
        }
        enterIdx++;
      } else if (!reduce) {
        // Reorder / shift (tile existed last layout) — the original FLIP.
        const old = prev.current.get(id);
        if (old) {
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
    for (const id of next.keys()) seen.current.add(id);
    prev.current = next;
  }, [key, ref]);
}
