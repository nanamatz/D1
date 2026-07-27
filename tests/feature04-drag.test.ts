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
    expect(stage).toContain('useStageDrag(');
    expect(stage).not.toContain('onDragOver');
    expect(stage).not.toContain('onStageDrop');
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
