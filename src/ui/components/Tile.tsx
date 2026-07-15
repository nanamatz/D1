import type { Tile } from '../../engine/types';
import { faceClass, fontClass, inkClass, materialClass, tileGlyph, tileValue } from '../game';

interface Props {
  tile: Tile;
  mini?: boolean;
  selected?: boolean;
  hinted?: boolean;
  /** marked for discard (C-3) — distinct from staging */
  marked?: boolean;
  onSelect?: (id: string) => void;
  /** toggle the discard mark (right-click, C-3) */
  onMark?: (id: string) => void;
  /** drag zone this tile lives in (C-2); enables cross-zone drag when set */
  zone?: 'hand' | 'staged';
  /** anchored hover tooltip for the tile (C-4): chip value, material, font */
  tooltip?: { title: string; body: string };
}

/** A ceramic letter tile (UI_DESIGN §3). Interactive unless `mini` or no handler. */
export function TileView({
  tile,
  mini = false,
  selected = false,
  hinted = false,
  marked = false,
  onSelect,
  onMark,
  zone,
  tooltip,
}: Props) {
  const interactive = !mini && !!onSelect;
  const draggable = !mini && !!zone;
  const className = [
    'tile',
    mini && 'mini',
    selected && 'sel',
    hinted && 'hint',
    marked && 'marked',
    draggable && 'draggable',
    materialClass(tile.material),
    fontClass(tile.font),
    inkClass(tileValue(tile)),
    faceClass(tile),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-flip-id={tile.id}
      data-tile-id={tile.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `${tileGlyph(tile)} tile, ${tileValue(tile)} chips` : undefined}
      draggable={draggable}
      onDragStart={
        draggable ? (e) => e.dataTransfer.setData('text/plain', `${zone}:${tile.id}`) : undefined
      }
      onClick={interactive ? () => onSelect!(tile.id) : undefined}
      onContextMenu={
        onMark
          ? (e) => {
              e.preventDefault();
              onMark(tile.id);
            }
          : undefined
      }
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
      {tooltip && (
        <span className="tt-card tile-tt" role="tooltip">
          <span className="tt-title">{tooltip.title}</span>
          <span className="tt-body">{tooltip.body}</span>
        </span>
      )}
    </div>
  );
}
