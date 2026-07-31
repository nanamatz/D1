/**
 * feature-04 D — spring-physics drag contract. The drag itself is pointer/rAF DOM
 * behaviour (verified in-app), but these lock the structural pieces that must not
 * silently regress: native HTML5 drag is OFF on tiles, and the grabbed-lift CSS
 * exists. (Same source-assertion style as card-motion.test.ts.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
});
