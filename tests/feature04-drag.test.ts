/**
 * feature-04 D — spring-physics drag contract. The drag itself is pointer/rAF DOM
 * behaviour (verified in-app), but these lock the structural pieces that must not
 * silently regress: native HTML5 drag is OFF on tiles, and the grabbed-lift CSS
 * exists. (Same source-assertion style as card-motion.test.ts.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cancelTouchHoldArbitration,
  completeTouchHoldArbitration,
  stageDragThresholdReached,
  startTouchHoldArbitration,
  touchSyntheticSuppressionMatches,
  TOUCH_MARK_HOLD_MS,
  TOUCH_SYNTHETIC_SUPPRESSION_MS,
} from '../src/ui/drag';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('feature-04 D — drag physics wiring', () => {
  it('tiles no longer use native HTML5 drag (the controller owns pointer drag)', () => {
    const tile = read('../src/ui/components/Tile.tsx');
    expect(tile).toContain('draggable={false}');
    expect(tile).toContain('data-zone={zone}');
    // the old native handler must be gone
    expect(tile).not.toContain('dataTransfer.setData');
  });

  it('the stage wires the spring-drag controller', () => {
    const stage = read('../src/ui/components/StagePanel.tsx');
    const drag = read('../src/ui/drag.ts');
    expect(stage).toContain('useStageDrag(');
    expect(stage).not.toContain('onDragOver');
    expect(stage).not.toContain('onStageDrop');
    expect(drag).toContain("container.classList.add('drag-over')");
    expect(drag).toContain("container.classList.add('drop-append')");
    expect(drag).toContain("origin.className = 'drag-origin'");
    expect(drag).toContain("window.addEventListener('pointercancel', onPointerCancel)");
  });

  it('honours the shown insertion point when moving between hand and staged rows', () => {
    const drag = read('../src/ui/drag.ts');
    const stage = read('../src/ui/components/StagePanel.tsx');
    expect(drag).toContain('cbRef.current.stage(id, insertBefore)');
    expect(drag).toContain('cbRef.current.unstage(id, insertBefore)');
    expect(stage).toContain('if (toId) g.reorderStaged(id, toId)');
    expect(stage).toContain('const next = reorderIds(ids, id, toId)');
  });

  it('does not enable manual sort when a hand drop keeps the same order', () => {
    const stage = read('../src/ui/components/StagePanel.tsx');
    const noOpGuard = stage.indexOf('if (next.every((id, index) => id === ids[index])) return;');
    expect(noOpGuard).toBeGreaterThan(-1);
    expect(stage.indexOf("setSortMode('manual');", noOpGuard)).toBeGreaterThan(noOpGuard);
  });

  it('the Emoji-Tile shelf uses the spring controller, not native DnD', () => {
    const shelf = read('../src/ui/components/JokerShelf.tsx');
    expect(shelf).toContain('useShelfDrag(');
    expect(shelf).toContain("'data-drag-idx'");
    expect(shelf).not.toContain('dataTransfer.setData');
  });

  it('the grabbed-lift CSS exists for tiles and shelf cards', () => {
    const play = read('../src/ui/styles/play.css');
    expect(play).toContain('.tile.grabbed');
    expect(play).toContain('.tile.dropping');
    expect(play).toContain('.joker-slot.grabbed');
  });

  it('keeps sub-5px touch jitter in the hold and starts drag at exactly 5px', () => {
    expect(stageDragThresholdReached(4.99, 0)).toBe(false);
    expect(stageDragThresholdReached(3, 3.99)).toBe(false);
    expect(stageDragThresholdReached(3, 4)).toBe(true);
    expect(stageDragThresholdReached(5, 0)).toBe(true);
  });

  it('wires one 500ms primary-touch hand hold to the existing discard mark path', () => {
    const drag = read('../src/ui/drag.ts');
    const stage = read('../src/ui/components/StagePanel.tsx');
    expect(TOUCH_MARK_HOLD_MS).toBe(500);
    expect(TOUCH_SYNTHETIC_SUPPRESSION_MS).toBeGreaterThan(TOUCH_MARK_HOLD_MS);
    expect(drag).toContain("e.pointerType === 'touch'");
    expect(drag).toContain('e.isPrimary');
    const down = drag.slice(drag.indexOf('const onPointerDown'));
    expect(down.indexOf("e.pointerType === 'touch' && !e.isPrimary")).toBeLessThan(
      down.indexOf('clearTouchSuppression();'),
    );
    expect(down.indexOf('if (el && e.pointerId !== pointerId) return;')).toBeLessThan(
      down.indexOf('clearTouchSuppression();'),
    );
    expect(drag).toContain("t.dataset.zone === 'hand'");
    expect(drag).toContain("!t.classList.contains('discard-locked')");
    expect(drag).toContain('cbRef.current.mark?.(id)');
    expect(stage).toContain('mark: toggleMark');
  });

  it('resolves the hold at 500ms, never at 499ms', () => {
    const hold = startTouchHoldArbitration('tile-1', 0);
    expect(completeTouchHoldArbitration(hold, 'tile-1', 499)).toBe(false);
    expect(completeTouchHoldArbitration(hold, 'tile-1', 500)).toBe(true);
  });

  it('marks exactly once whether contextmenu or timer reaches completion first', () => {
    const contextFirst = startTouchHoldArbitration('tile-1', 0);
    const contextThenTimer = [500, 501]
      .filter((now) => completeTouchHoldArbitration(contextFirst, 'tile-1', now));
    expect(contextThenTimer).toHaveLength(1);

    const timerFirst = startTouchHoldArbitration('tile-1', 0);
    const timerThenContext = [500, 501]
      .filter((now) => completeTouchHoldArbitration(timerFirst, 'tile-1', now));
    expect(timerThenContext).toHaveLength(1);
  });

  it('rejects cancelled, already-resolved, and mismatched-id completions', () => {
    const cancelled = startTouchHoldArbitration('tile-1', 0);
    cancelTouchHoldArbitration(cancelled);
    expect(completeTouchHoldArbitration(cancelled, 'tile-1', 500)).toBe(false);

    const hold = startTouchHoldArbitration('tile-1', 0);
    expect(completeTouchHoldArbitration(hold, 'tile-2', 500)).toBe(false);
    expect(completeTouchHoldArbitration(hold, 'tile-1', 500)).toBe(true);
    expect(completeTouchHoldArbitration(hold, 'tile-1', 501)).toBe(false);
  });

  it('suppresses only the armed same-tile synthetic event inside its window', () => {
    expect(touchSyntheticSuppressionMatches('tile-1', 'tile-1', 750, 750)).toBe(true);
    expect(touchSyntheticSuppressionMatches('tile-1', 'tile-1', 750, 751)).toBe(false);
    expect(touchSyntheticSuppressionMatches('tile-1', 'tile-2', 750, 1)).toBe(false);
    expect(touchSyntheticSuppressionMatches(null, 'tile-1', 750, 1)).toBe(false);
  });

  it('arms touch drag/cancel before late contextmenu while mouse right-click passes', () => {
    const drag = read('../src/ui/drag.ts');
    const tile = read('../src/ui/components/Tile.tsx');
    const move = drag.slice(drag.indexOf('const onPointerMove'), drag.indexOf('const finishDrop'));
    const cancel = drag.slice(drag.indexOf('const onPointerCancel'), drag.indexOf('// Swallow the click'));
    expect(stageDragThresholdReached(6, 0)).toBe(true);
    expect(move).toContain("e.pointerType === 'touch' ? touchHold?.id : null");
    expect(move.indexOf('armTouchSuppression(touchDragId)')).toBeLessThan(
      move.indexOf('dragging = true'),
    );
    expect(cancel).toContain("e.pointerType === 'touch'");
    expect(cancel.indexOf('armTouchSuppression(el.dataset.tileId)')).toBeLessThan(
      cancel.indexOf('resetDrag();'),
    );
    expect(touchSyntheticSuppressionMatches('tile-1', 'tile-1', 750, 1)).toBe(true);
    expect(tile).toContain('onContextMenu={onMark ?');
    expect(tile).toContain('if (!markDisabled) onMark(tile.id);');
  });

  it('cancels the hold for drag/cancel/unmount and consumes only its synthetic events', () => {
    const drag = read('../src/ui/drag.ts');
    const tile = read('../src/ui/components/Tile.tsx');
    expect(drag).toContain('cancelTouchHold();');
    expect(drag).toContain('if (longPressed || touchGestureCancelled) return;');
    expect(drag).toContain('if (touchHold && !touchHoldStillEligible())');
    expect(drag).toContain("consumeTouchSynthetic(e, 'click')");
    expect(drag).toContain("consumeTouchSynthetic(e, 'contextmenu')");
    expect(drag.match(/completeTouchHoldArbitration\(touchHold/g)).toHaveLength(2);
    expect(drag).toContain("window.addEventListener('pointerup', onPointerUp, true)");
    expect(drag).toContain("window.addEventListener('pointercancel', onPointerCancel)");
    expect(tile).toContain("if (e.key === 'Enter' || e.key === ' ')");
    expect(tile).toContain('onContextMenu={onMark ?');
  });
});
