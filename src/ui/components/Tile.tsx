import type { Tile } from '../../engine/types';
import { fontClass, materialClass, tileGlyph, tileValue } from '../game';

interface Props {
  tile: Tile;
  mini?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** A ceramic letter tile (UI_DESIGN §3). Interactive unless `mini` or no handler. */
export function TileView({ tile, mini = false, selected = false, onSelect }: Props) {
  const interactive = !mini && !!onSelect;
  const className = ['tile', mini && 'mini', selected && 'sel', materialClass(tile.material), fontClass(tile.font)]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `${tileGlyph(tile)} tile, ${tileValue(tile)} chips` : undefined}
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
