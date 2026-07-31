import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Tile } from '../../engine/types';
import {
  changedTileAxes,
  faceClass,
  fontClass,
  inkClass,
  materialClass,
  materialGlyph,
  tileGlyph,
  tileValue,
  type TileEnhancementAxis,
} from '../game';
import { useI18n } from '../i18n';
import { usePointerTilt } from '../hooks';
import { richText } from '../richtext';
import { useSettleView } from '../settle';
import { TooltipSupplement } from './Tooltip';

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
  /** The currently staged word will be debuffed to zero by the active boss. */
  invalid?: boolean;
  /** Disable local tilt when a parent surface owns the whole interaction layer. */
  tilt?: boolean;
  /** anchored hover tooltip for the tile (C-4): chip value, material, font */
  tooltip?: { title: string; body: string };
}

/** A ceramic letter tile (UI_DESIGN §3). Interactive unless `mini` or no handler.
 *  Memoized: tray tiles (stable props, no callbacks) skip the per-beat re-renders the
 *  settle drives, so an imperative trigger class (mat-flash / trig-bounce) on a PLAYED
 *  tile survives long enough to animate (feedback #3). */
function TileViewImpl({
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
  invalid = false,
  tilt = true,
  tooltip,
}: Props) {
  const { t } = useI18n();
  const settle = useSettleView();
  const interactive = !mini && !!onSelect && !disabled;
  const draggable = !mini && !!zone && !disabled;
  // Conditional-material corner glyph (B-1) — hidden face-down (identity hidden).
  const matGlyph = faceDown ? null : materialGlyph(tile);
  const rootRef = useRef<HTMLDivElement>(null);
  usePointerTilt(rootRef, tilt && !mini && !disabled);
  const previousAxes = useRef({
    id: tile.id,
    material: tile.material,
    font: tile.font,
    edition: tile.edition ?? 'base',
  });
  const [enhancementFx, setEnhancementFx] = useState<TileEnhancementAxis[]>([]);
  useEffect(() => {
    if (previousAxes.current.id !== tile.id) {
      previousAxes.current = {
        id: tile.id,
        material: tile.material,
        font: tile.font,
        edition: tile.edition ?? 'base',
      };
      setEnhancementFx([]);
      return;
    }
    const changed = changedTileAxes(previousAxes.current, tile);
    previousAxes.current = {
      id: tile.id,
      material: tile.material,
      font: tile.font,
      edition: tile.edition ?? 'base',
    };
    if (changed.length === 0) return;
    setEnhancementFx(changed);
    const timer = window.setTimeout(() => setEnhancementFx([]), 1100);
    return () => window.clearTimeout(timer);
  }, [tile.id, tile.material, tile.font, tile.edition]);
  // feedback #1: the tooltip must never warp. Rendered in a body PORTAL positioned at
  // the tile's rect, so it escapes the tile's tilt/drag 3D transform (a descendant
  // would inherit it and skew). Shown on hover; hidden the moment a drag press starts.
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const showTip = () => {
    if (faceDown || !tooltip) return;
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setTipPos({ x: r.left + r.width / 2, y: r.top - 8 });
  };
  const hideTip = () => setTipPos(null);
  useEffect(() => hideTip, []); // clear if the tile unmounts while hovered
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
    settle.active && settle.activeTileId === tile.id && 'score-current',
    materialClass(tile.material),
    fontClass(tile.font),
    inkClass(tileValue(tile)),
    faceClass(tile),
    `edition-${tile.edition ?? 'base'}`,
    faceDown && 'facedown',
    disabled && 'locked',
    invalid && 'boss-invalid',
  ]
    .filter(Boolean)
    .join(' ');
  const effectPop =
    settle.active && settle.tileEffectPop?.tileId === tile.id
      ? settle.tileEffectPop
      : null;

  return (
    <div
      ref={rootRef}
      className={className}
      data-flip-id={tile.id}
      data-tile-id={tile.id}
      data-material={tile.material}
      // feature-04 D: the spring-drag controller (useStageDrag) owns dragging via
      // pointer events; the home zone is read from here. Native HTML5 drag is off —
      // it can't spring-follow or rotate (the browser owns its drag image).
      data-zone={zone}
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
      draggable={false}
      onPointerEnter={showTip}
      onPointerLeave={hideTip}
      onPointerDown={hideTip}
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
          <span className="tile-material-texture" aria-hidden />
          {(tile.edition ?? 'base') !== 'base' && (
            <span className={`tile-edition-surface tile-edition-${tile.edition}`} aria-hidden />
          )}
          <span className="tile-letter">{tileGlyph(tile)}</span>
          <span className="val">{tileValue(tile)}</span>
          {matGlyph && (
            <span
              className={`mat-glyph${tile.material === 'wood' ? ' mat-glyph-wood' : ''}`}
              aria-hidden
            >
              {matGlyph}
            </span>
          )}
          {invalid && <span className="boss-invalid-tag">{t('boss.notAllowed')}</span>}
          {enhancementFx.map((axis) => (
            <span
              key={axis}
              className={`tile-enhance-fx tile-enhance-${axis}`}
              data-letter={tileGlyph(tile)}
              aria-hidden
            />
          ))}
        </>
      )}
      {!faceDown && tooltip && tipPos &&
        createPortal(
          <span
            className="tt-card tile-tt-portal"
            role="tooltip"
            style={{ left: `${tipPos.x}px`, top: `${tipPos.y}px` } as CSSProperties}
          >
            <span className="tt-title">{tooltip.title}</span>
            <span className="tt-desc">
              <span className="tt-body">{richText(tooltip.body)}</span>
            </span>
            <TooltipSupplement body={tooltip.body} />
          </span>,
          document.body,
        )}
      <span className="tilt-sheen" aria-hidden />
      {effectPop && (
        <span key={effectPop.id} className="tile-effect-pop" aria-hidden>
          {effectPop.chips !== 0 && <span className="chip">+{Math.round(effectPop.chips)}</span>}
          {effectPop.multFactor !== undefined ? (
            <span className="mult">×{effectPop.multFactor}</span>
          ) : effectPop.mult !== 0 ? (
            <span className="mult">+{Number.isInteger(effectPop.mult) ? effectPop.mult : effectPop.mult.toFixed(2)}</span>
          ) : null}
          {effectPop.gold !== 0 && <span className="gold">+${effectPop.gold}</span>}
          {effectPop.retrigger && <span className="retrigger">↻</span>}
        </span>
      )}
    </div>
  );
}

export const TileView = memo(TileViewImpl);
