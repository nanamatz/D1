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
    const kids = Array.from(el.children) as HTMLElement[];
    // Measure LAYOUT positions via offsetLeft/offsetTop, NOT getBoundingClientRect.
    // offsetLeft/Top are the untransformed layout-box offsets (relative to the shared
    // offsetParent), so they are immune to in-flight CSS/WAAPI transforms — a tile
    // still mid draw-in flight reads at its slot, not at the pouch it is animating
    // from. getBoundingClientRect would capture the transformed box and store the
    // pouch position into `prev`, fanning every survivor ~700px out on the next
    // shift (the draw-in regression). This also cancels ancestor transforms (the
    // screen-transition slide, playtest-06) for free, since offsets ignore them too.
    const next = new Map<string, { x: number; y: number }>();
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (!id) continue;
      next.set(id, { x: k.offsetLeft, y: k.offsetTop });
    }
    const reduce = reducedMotion();
    const o = optsRef.current;
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
          // Flight vector from the tile's CLEAN live rect (it is brand-new, so not
          // yet transformed) to the pouch — both viewport coords. Fallback (pouch
          // not mounted): drop in from just below the row.
          const origin = o.enterOrigin();
          const kr = k.getBoundingClientRect();
          const dx = origin ? origin.x - (kr.left + kr.width / 2) : 0;
          const dy = origin ? origin.y - (kr.top + kr.height / 2) : el.clientHeight - k.offsetTop + 40;
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

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Balatro-style pointer parallax. While the cursor is over `ref`'s element, adds
 * the `tilting` class and writes `--tilt-x` / `--tilt-y` (unitless, -1..1); the CSS
 * turns them into a 3D rotate + lift. Resets on pointerleave. No-ops under reduced
 * motion or when `enabled` is false. rAF-throttled (one pending frame).
 */
export function usePointerTilt(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reducedMotion()) return;
    let raf = 0;
    let leaveTimer = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--tilt-y', String(nx)); // horizontal cursor → rotateY
      el.style.setProperty('--tilt-x', String(-ny)); // vertical cursor → rotateX (inverted)
    };
    const onMove = (e: PointerEvent) => {
      window.clearTimeout(leaveTimer); // cancel a pending flatten if we re-entered
      const r = el.getBoundingClientRect();
      nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      el.classList.add('tilting');
      el.style.setProperty('--tilt-k', '1'); // full intensity (drives lift/scale/sheen)
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      // Ease everything back to flat (vars → 0) WHILE .tilting is still applied, so the
      // transform transitions instead of snapping; drop the class after the transition.
      el.style.setProperty('--tilt-x', '0');
      el.style.setProperty('--tilt-y', '0');
      el.style.setProperty('--tilt-k', '0');
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        el.classList.remove('tilting');
        el.style.removeProperty('--tilt-x');
        el.style.removeProperty('--tilt-y');
        el.style.removeProperty('--tilt-k');
      }, 180);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(leaveTimer);
    };
  }, [ref, enabled]);
}
