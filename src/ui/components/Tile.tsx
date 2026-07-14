import type { Tile } from '../../engine/types';
import { fontClass, materialClass, tileGlyph, tileValue } from '../game';

interface Props {
  tile: Tile;
  mini?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** enables HTML5 drag-reorder; called with (draggedId, dropTargetId) */
  onReorder?: (fromId: string, toId: string) => void;
}

/** A ceramic letter tile (UI_DESIGN §3). Interactive unless `mini` or no handler. */
export function TileView({ tile, mini = false, selected = false, onSelect, onReorder }: Props) {
  const interactive = !mini && !!onSelect;
  const draggable = !!onReorder;
  const className = ['tile', mini && 'mini', selected && 'sel', draggable && 'draggable', materialClass(tile.material), fontClass(tile.font)]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-flip-id={tile.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `${tileGlyph(tile)} tile, ${tileValue(tile)} chips` : undefined}
      draggable={draggable}
      onDragStart={draggable ? (e) => e.dataTransfer.setData('text/plain', tile.id) : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData('text/plain');
              if (from && from !== tile.id) onReorder!(from, tile.id);
            }
          : undefined
      }
      onClick={interactive ? () => onSelect!(tile.id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect!(tile.id);
              }
            }
          : undefined
      }
    >
      {tileGlyph(tile)}
      <span className="val">{tileValue(tile)}</span>
    </div>
  );
}
