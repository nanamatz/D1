/**
 * feature-04 D · spring-physics drag for the hand + staged rows (UI_DESIGN §4.10).
 *
 * Native HTML5 drag-and-drop can't feel alive — the browser owns the drag image, so
 * there is no way to spring-follow, rotate by velocity, or overshoot on release. This
 * replaces it with a pointer-driven controller:
 *
 *   - one rAF spring loop moves the grabbed card via a GPU `transform` — NEVER a
 *     per-frame React re-render (the hard rule for many-cards-at-once, §4.10);
 *   - rotation is driven by horizontal velocity (clamped ±12°) — the "weight" cue;
 *   - neighbours yield: siblings spring aside to open the insertion gap;
 *   - release springs into the slot with overshoot, then commits the reorder ONCE.
 *
 * React state changes only on drop. A move below the click threshold is left as a
 * plain click (so tap-to-select still works). Reduced motion → instant, no springs.
 * Pointer capture keeps a fast drag from dropping the card.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { clamp } from './math';
import { motionOff as reduced } from './motion';

/** Drop the per-tile pointer-parallax state so it can't fight the drag/drop transform. */
function clearTilt(node: HTMLElement): void {
  node.classList.remove('tilting');
  node.style.removeProperty('--tilt-x');
  node.style.removeProperty('--tilt-y');
  node.style.removeProperty('--tilt-k');
}

export interface StageDragCallbacks {
  /** hand→staged (stage a tile) */
  stage: (id: string, toId: string | null) => void;
  /** staged→hand (unstage) */
  unstage: (id: string, toId: string | null) => void;
  /** reorder within the hand: move `fromId` before `toId` (toId null = append) */
  reorderHand: (fromId: string, toId: string | null) => void;
  /** reorder within the staged row */
  reorderStaged: (fromId: string, toId: string | null) => void;
  /** small sounds; the controller fires grab/drop, callers keep their own */
  playGrab?: () => void;
  playDrop?: () => void;
}

const THRESHOLD = 5; // px of movement before a press becomes a drag (else it's a click)
const STIFF = 0.32; // spring follow factor per frame
const ROT_K = 0.75; // deg per px/frame of horizontal velocity
const ROT_MAX = 12;

/**
 * Wire spring-physics dragging onto the `.stage` container. Tiles must carry
 * `data-tile-id` and `data-zone` ("hand" | "staged"); this owns their pointer drag.
 */
export function useStageDrag(
  stageRef: RefObject<HTMLElement | null>,
  handRef: RefObject<HTMLElement | null>,
  stagedRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  cb: StageDragCallbacks,
): void {
  // Keep the latest callbacks without re-attaching listeners every render.
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enabled) return;

    let raf = 0;
    let dragging = false;
    let justDragged = false;
    let el: HTMLElement | null = null;
    let pointerId = -1;
    let zone: 'hand' | 'staged' = 'hand';
    let startX = 0;
    let startY = 0;
    let grabDX = 0; // pointer offset within the card
    let grabDY = 0;
    let homeX = 0; // card's page-space top-left at grab
    let homeY = 0;
    let targetX = 0; // desired top-left (pointer - grab offset)
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let prevX = 0;
    let rot = 0;
    let cardW = 0; // local px (offsetWidth + gap) for neighbour yield
    // The board is `zoom`-scaled (screens.css), so getBoundingClientRect is in POST-zoom
    // viewport px while a CSS `transform` is applied in PRE-zoom local px. Dividing the
    // follow delta by this scale keeps the card pinned under the cursor instead of lagging.
    let scale = 1;
    let insertBefore: string | null = null;
    let origin: HTMLElement | null = null;

    const zoneOf = (node: HTMLElement): 'hand' | 'staged' =>
      (node.dataset.zone as 'hand' | 'staged') ?? 'hand';

    // Split the space halfway between both rows. Unlike the old unbounded Y test,
    // dragging above the board or far below it still resolves to the nearest row.
    const zoneAt = (clientY: number): 'hand' | 'staged' => {
      const stagedRect = stagedRef.current?.getBoundingClientRect();
      const handRect = handRef.current?.getBoundingClientRect();
      if (!stagedRect) return 'hand';
      if (!handRect) return 'staged';
      return clientY < (stagedRect.bottom + handRect.top) / 2 ? 'staged' : 'hand';
    };

    // The tile the cursor is BEFORE within a zone (null → append past the last).
    const targetAt = (container: HTMLElement | null, clientX: number): string | null => {
      if (!container) return null;
      for (const c of Array.from(container.querySelectorAll<HTMLElement>('[data-tile-id]'))) {
        if (c === el) continue; // ignore the card being dragged
        const r = c.getBoundingClientRect();
        if (clientX < r.left + r.width / 2) return c.dataset.tileId ?? null;
      }
      return null;
    };

    const clearDropVisuals = () => {
      for (const container of [handRef.current, stagedRef.current]) {
        if (!container) continue;
        container.classList.remove('drag-over', 'drop-append');
        for (const tile of container.querySelectorAll<HTMLElement>('.drop-target')) {
          tile.classList.remove('drop-target');
        }
      }
    };

    const showDropVisuals = (dropZone: 'hand' | 'staged') => {
      clearDropVisuals();
      const container = dropZone === 'staged' ? stagedRef.current : handRef.current;
      if (!container) return;
      container.classList.add('drag-over');
      const target = insertBefore
        ? container.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(insertBefore)}"]`)
        : null;
      if (target) target.classList.add('drop-target');
      else container.classList.add('drop-append');
    };

    const showOrigin = () => {
      if (!el || origin) return;
      const stageRect = stage.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      origin = document.createElement('span');
      origin.className = 'drag-origin';
      origin.setAttribute('aria-hidden', 'true');
      Object.assign(origin.style, {
        left: `${(rect.left - stageRect.left) / scale}px`,
        top: `${(rect.top - stageRect.top) / scale}px`,
        width: `${el.offsetWidth}px`,
        height: `${el.offsetHeight}px`,
      });
      stage.append(origin);
    };

    // Spring siblings aside to open the gap at the current insertion point (transform
    // only — no React). Cards from the insertion index onward shift right by a card.
    const layoutNeighbours = (dropZone: 'hand' | 'staged', clientX: number) => {
      const container = dropZone === 'staged' ? stagedRef.current : handRef.current;
      if (!container) return;
      insertBefore = targetAt(container, clientX);
      let passedGap = false;
      for (const c of Array.from(container.querySelectorAll<HTMLElement>('[data-tile-id]'))) {
        if (c === el) continue;
        if (c.dataset.tileId === insertBefore) passedGap = true;
        const shift = passedGap ? cardW : 0;
        c.style.transform = shift ? `translateX(${shift}px)` : '';
        c.style.transition = 'transform 0.18s cubic-bezier(.2,.8,.3,1.2)';
      }
      showDropVisuals(dropZone);
    };

    const clearNeighbours = () => {
      for (const container of [handRef.current, stagedRef.current]) {
        if (!container) continue;
        for (const c of Array.from(container.querySelectorAll<HTMLElement>('[data-tile-id]'))) {
          if (c === el) continue;
          c.style.transform = '';
          c.style.transition = '';
        }
      }
      clearDropVisuals();
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) return;
      prevX = curX;
      curX += (targetX - curX) * STIFF;
      curY += (targetY - curY) * STIFF;
      const vel = curX - prevX;
      // rotation eases toward the velocity-driven angle, and back to 0 when slow.
      rot += (clamp(vel * ROT_K, -ROT_MAX, ROT_MAX) - rot) * 0.25;
      // `!important` so the drag beats `.tile.tilting`'s own !important transform (the
      // per-tile pointer-parallax fires under the captured pointer and would otherwise win).
      el.style.setProperty(
        'transform',
        `translate(${(curX - homeX) / scale}px, ${(curY - homeY) / scale}px) rotate(${rot.toFixed(2)}deg) scale(1.08)`,
        'important',
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // left button only (right-click = discard mark)
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tile-id]');
      if (!t || !stage.contains(t)) return;
      el = t;
      pointerId = e.pointerId;
      zone = zoneOf(t);
      startX = e.clientX;
      startY = e.clientY;
      const r = t.getBoundingClientRect();
      grabDX = e.clientX - r.left;
      grabDY = e.clientY - r.top;
      homeX = r.left;
      homeY = r.top;
      curX = targetX = r.left;
      curY = targetY = r.top;
      prevX = r.left;
      scale = t.offsetWidth ? r.width / t.offsetWidth : 1;
      cardW = t.offsetWidth + 8; // local px, for the neighbour shift
      rot = 0;
      dragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!el || e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return;
        // Threshold crossed → begin the drag.
        dragging = true;
        try { el.setPointerCapture(pointerId); } catch { /* ignore */ }
        el.classList.add('grabbed');
        stage.classList.add('drag-active');
        showOrigin();
        cbRef.current.playGrab?.();
        if (reduced()) {
          // No spring — the card just tracks the pointer via a plain transform.
        } else if (!raf) {
          raf = requestAnimationFrame(tick);
        }
      }
      targetX = e.clientX - grabDX;
      targetY = e.clientY - grabDY;
      if (reduced() && el) {
        el.style.transform = `translate(${(targetX - homeX) / scale}px, ${(targetY - homeY) / scale}px)`;
      }
      layoutNeighbours(zoneAt(e.clientY), e.clientX);
    };

    const finishDrop = (clientY: number) => {
      if (!el) return;
      const dropZone = zoneAt(clientY);
      const id = el.dataset.tileId!;
      clearNeighbours();
      // Commit only after release; pointer motion itself never updates React state.
      if (dropZone === 'staged') {
        if (zone === 'hand') cbRef.current.stage(id, insertBefore);
        else if (insertBefore !== id) cbRef.current.reorderStaged(id, insertBefore);
      } else {
        if (zone === 'staged') cbRef.current.unstage(id, insertBefore);
        else if (insertBefore !== id) cbRef.current.reorderHand(id, insertBefore);
      }
      cbRef.current.playDrop?.();
    };

    const resetDrag = () => {
      if (!el) return;
      const node = el;
      try { node.releasePointerCapture(pointerId); } catch { /* ignore */ }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      clearNeighbours();
      origin?.remove();
      origin = null;
      stage.classList.remove('drag-active');
      node.classList.remove('grabbed');
      clearTilt(node);
      node.style.removeProperty('transform');
      node.style.transition = '';
      dragging = false;
      el = null;
      pointerId = -1;
      insertBefore = null;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!el || e.pointerId !== pointerId) return;
      const wasDragging = dragging;
      if (wasDragging) {
        // A real drag doesn't fire a click in most browsers, but pointer capture can
        // synthesize one — swallow only a click landing in the next 60ms, then let
        // normal clicks (tap-to-select) through again.
        justDragged = true;
        window.setTimeout(() => { justDragged = false; }, 60);
        finishDrop(e.clientY);
        // Settle: clear our (important) transform + tilt state and hand the card to its
        // new slot. `.dropping` makes useFlip SKIP it (so it doesn't teleport back to the
        // old slot and fly across) and plays a small settle-pop; neighbours FLIP normally.
        const node = el;
        node.classList.add('dropping');
        window.setTimeout(() => node.classList.remove('dropping'), 300);
      }
      resetDrag();
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (!el || e.pointerId !== pointerId) return;
      resetDrag();
    };

    // Swallow the click that follows a real drag so it doesn't also toggle selection.
    const onClickCapture = (e: MouseEvent) => {
      if (justDragged) {
        e.stopPropagation();
        e.preventDefault();
        justDragged = false;
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('click', onClickCapture, true);
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      stage.removeEventListener('click', onClickCapture, true);
      resetDrag();
    };
    // cb is read through cbRef so it is intentionally not a dependency (re-attaching
    // the pointer listeners every render would drop an in-flight drag).
  }, [stageRef, handRef, stagedRef, enabled]);
}

export interface ShelfDragCallbacks {
  /** move the joker at `from` to index `to` (splice-move, matching reorderJokers) */
  reorder: (from: number, to: number) => void;
  playGrab?: () => void;
  playDrop?: () => void;
}

/**
 * Single-zone spring-physics reorder for the Emoji-Tile (joker) shelf — the same
 * feel as the hand (§4.10), minus cross-zone/staging. Children carry `data-drag-idx`
 * (their joker index); a press below the click threshold stays a click (opens the
 * Sell menu). Commits `reorder(from, to)` once on drop; motion is transform-only.
 */
export function useShelfDrag(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  cb: ShelfDragCallbacks,
): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    let raf = 0;
    let dragging = false;
    let justDragged = false;
    let el: HTMLElement | null = null;
    let pointerId = -1;
    let fromIdx = -1;
    let toIdx = -1;
    let startX = 0;
    let startY = 0;
    let grabDX = 0;
    let grabDY = 0;
    let homeX = 0;
    let homeY = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let prevX = 0;
    let rot = 0;
    let cardW = 0;
    let scale = 1; // board zoom (see useStageDrag) — keeps the follow pinned to the cursor

    const cards = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-drag-idx]'));

    const layoutNeighbours = (clientX: number) => {
      let insertIdx = -1;
      const list = cards();
      for (const c of list) {
        if (c === el) continue;
        const r = c.getBoundingClientRect();
        if (clientX < r.left + r.width / 2) {
          insertIdx = Number(c.dataset.dragIdx);
          break;
        }
      }
      toIdx = insertIdx === -1 ? list.length - 1 : insertIdx;
      let passed = false;
      for (const c of list) {
        if (c === el) continue;
        if (Number(c.dataset.dragIdx) === insertIdx) passed = true;
        c.style.transform = passed && insertIdx !== -1 ? `translateX(${cardW}px)` : '';
        c.style.transition = 'transform 0.18s cubic-bezier(.2,.8,.3,1.2)';
      }
    };
    const clearNeighbours = () => {
      for (const c of cards()) {
        if (c === el) continue;
        c.style.transform = '';
        c.style.transition = '';
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) return;
      prevX = curX;
      curX += (targetX - curX) * STIFF;
      curY += (targetY - curY) * STIFF;
      rot += (clamp((curX - prevX) * ROT_K, -ROT_MAX, ROT_MAX) - rot) * 0.25;
      el.style.setProperty(
        'transform',
        `translate(${(curX - homeX) / scale}px, ${(curY - homeY) / scale}px) rotate(${rot.toFixed(2)}deg) scale(1.08)`,
        'important',
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-drag-idx]');
      if (!t || !container.contains(t)) return;
      el = t;
      pointerId = e.pointerId;
      fromIdx = Number(t.dataset.dragIdx);
      startX = e.clientX;
      startY = e.clientY;
      const r = t.getBoundingClientRect();
      grabDX = e.clientX - r.left;
      grabDY = e.clientY - r.top;
      homeX = curX = targetX = prevX = r.left;
      homeY = curY = targetY = r.top;
      scale = t.offsetWidth ? r.width / t.offsetWidth : 1;
      cardW = t.offsetWidth + 8;
      rot = 0;
      dragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!el || e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return;
        dragging = true;
        try { el.setPointerCapture(pointerId); } catch { /* ignore */ }
        el.classList.add('grabbed');
        cbRef.current.playGrab?.();
        if (!reduced() && !raf) raf = requestAnimationFrame(tick);
      }
      targetX = e.clientX - grabDX;
      targetY = e.clientY - grabDY;
      if (reduced() && el) {
        el.style.setProperty('transform', `translate(${(targetX - homeX) / scale}px, ${(targetY - homeY) / scale}px)`, 'important');
      }
      layoutNeighbours(e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!el || e.pointerId !== pointerId) return;
      if (dragging) {
        justDragged = true;
        window.setTimeout(() => { justDragged = false; }, 60);
        clearNeighbours();
        if (toIdx >= 0 && toIdx !== fromIdx) cbRef.current.reorder(fromIdx, toIdx);
        cbRef.current.playDrop?.();
        const node = el;
        node.classList.remove('grabbed');
        clearTilt(node);
        node.classList.add('dropping');
        node.style.removeProperty('transform');
        node.style.transition = '';
        window.setTimeout(() => node.classList.remove('dropping'), 300);
      }
      try { el.releasePointerCapture(pointerId); } catch { /* ignore */ }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      dragging = false;
      el = null;
      pointerId = -1;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (justDragged) { e.stopPropagation(); e.preventDefault(); justDragged = false; }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', onClickCapture, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef, enabled]);
}
