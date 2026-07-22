import { useRef } from 'react';
import type { Tile } from '../../engine/types';
import { faceClass, fontClass, inkClass, materialClass, tileGlyph, tileValue } from '../game';
import { useI18n } from '../i18n';
import { usePointerTilt } from '../hooks';
import { richText } from '../richtext';

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
  /** D-2: this tile is the current drag origin (dashed outline) */
  dragging?: boolean;
  /** D-2: the live insertion gap lands before this tile (dashed bar) */
  dropTarget?: boolean;
  /** Ancient Paper (고대 문서): render the tile face-down — its letter/value are
   *  hidden (info attack) until it is played. Still selectable. */
  faceDown?: boolean;
  /** Locked by the first-run lesson: dimmed and non-interactive (not the next YELLOW
   *  letter). Distinct from faceDown — the letter is still visible. */
  disabled?: boolean;
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
  dragging = false,
  dropTarget = false,
  faceDown = false,
  disabled = false,
  tooltip,
}: Props) {
  const { t } = useI18n();
  const interactive = !mini && !!onSelect && !disabled;
  const draggable = !mini && !!zone && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  usePointerTilt(rootRef, !mini && !disabled);
  // A letterless tile (Stone, GDD §2.2) has no glyph to identify it — fall back
  // to its material name so a screen reader announces "Stone tile, 0 chips"
  // instead of the identity-less " tile, 0 chips" (M-4).
  const idLabel =
    tileGlyph(tile) || (tile.material !== 'ceramic' ? t(`material.${tile.material}`) : '');
  const className = [
    'tile',
    mini && 'mini',
    selected && 'sel',
    hinted && 'hint',
    marked && 'marked',
    draggable && 'draggable',
    dragging && 'dragging',
    dropTarget && 'drop-target',
    materialClass(tile.material),
    fontClass(tile.font),
    inkClass(tileValue(tile)),
    faceClass(tile),
    faceDown && 'facedown',
    disabled && 'locked',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={className}
      data-flip-id={tile.id}
      data-tile-id={tile.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={
        interactive
          ? faceDown
            ? t('boss.faceDownTile')
            : `${idLabel} tile, ${t('tile.chips', { n: tileValue(tile) })}`
          : undefined
      }
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
      {faceDown ? (
        <span className="tile-back" aria-hidden>?</span>
      ) : (
        <>
          {tileGlyph(tile)}
          <span className="val">{tileValue(tile)}</span>
        </>
      )}
      {!faceDown && tooltip && (
        <span className="tt-card tile-tt" role="tooltip">
          <span className="tt-title">{tooltip.title}</span>
          <span className="tt-desc">
            <span className="tt-body">{richText(tooltip.body)}</span>
          </span>
        </span>
      )}
      <span className="tilt-sheen" aria-hidden />
    </div>
  );
}
