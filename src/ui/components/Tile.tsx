import { Fragment, memo, useEffect, useRef, useState } from 'react';
import type { Tile } from '../../engine/types';
import {
  changedTileAxes,
  faceClass,
  fontClass,
  inkClass,
  materialClass,
  materialGlyph,
  tileGlyph,
  tileTooltipChips,
  tileValue,
  type TileEnhancementAxis,
} from '../game';
import { useI18n } from '../i18n';
import { usePointerTilt } from '../hooks';
import { stripRichText } from '../richtext';
import { useSettleView } from '../settle';
import { Tooltip, type TooltipDetail, type TooltipTag } from './Tooltip';
import { ChanceBadges } from './ChanceBadges';

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
  /** Boss rule may forbid discarding without forbidding normal play. */
  markDisabled?: boolean;
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
  /** Nokdo Script: this tile must remain in the staged word. */
  forced?: boolean;
  /** This submitted Glass tile was permanently destroyed after scoring. */
  destroyed?: boolean;
  /** Disable local tilt when a parent surface owns the whole interaction layer. */
  tilt?: boolean;
  /** Focusable display object with no click action, used by inspection galleries. */
  inspectable?: boolean;
  /** Current guided-intro action; marks exactly one real DOM target. */
  tutorialClick?: 'left' | 'right' | undefined;
  /** Anchored hover tooltip with enhancement tags and left-side definitions. */
  tooltip?: {
    title: string;
    body: string;
    tags?: readonly TooltipTag[];
    sub?: readonly TooltipDetail[];
  };
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
  markDisabled = false,
  zone,
  dragging = false,
  dropTarget = false,
  faceDown = false,
  disabled = false,
  invalid = false,
  forced = false,
  destroyed = false,
  tilt = true,
  inspectable = false,
  tutorialClick,
  tooltip,
}: Props) {
  const { t } = useI18n();
  const settle = useSettleView();
  const interactive = !mini && !!onSelect && !disabled;
  const focusable = (interactive || inspectable) && !disabled;
  const draggable = !mini && !!zone && !disabled;
  // Wood live-growth value — hidden face-down with identity.
  const matGlyph = faceDown ? null : materialGlyph(tile);
  const rootRef = useRef<HTMLDivElement>(null);
  usePointerTilt(rootRef, tilt && (!mini || inspectable) && !disabled);
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
  // A letterless tile (Stone, GDD §2.2) has no glyph to identify it — fall back
  // to its material name so a screen reader announces the Stone identity and
  // its material-chip value instead of an identity-less zero-value tile (M-4).
  const idLabel =
    tileGlyph(tile) || (tile.material !== 'ceramic' ? t(`material.${tile.material}`) : '');
  const effectPop =
    settle.active && settle.tileEffectPop?.tileId === tile.id
      ? settle.tileEffectPop
      : null;
  const shattering = destroyed && !!effectPop?.chanceResults?.some(
    (result) => result.outcome === 'destroyed',
  );
  const className = [
    'tile',
    mini && 'mini',
    inspectable && 'inspectable',
    selected && 'sel',
    hinted && 'hint',
    marked && 'marked',
    draggable && 'draggable',
    dragging && 'dragging',
    dropTarget && 'drop-target',
    settle.active && settle.activeTileId === tile.id && 'score-current',
    !faceDown && materialClass(tile.material),
    !faceDown && fontClass(tile.font),
    !faceDown && inkClass(tileValue(tile)),
    !faceDown && faceClass(tile),
    !faceDown && `edition-${tile.edition ?? 'base'}`,
    faceDown && 'facedown',
    disabled && 'locked',
    invalid && 'boss-invalid',
    forced && 'boss-forced',
    markDisabled && 'discard-locked',
    destroyed && 'glass-destroyed',
    shattering && 'glass-shattering',
    tutorialClick && 'tutorial-action-target',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Fragment>
      <div
      ref={rootRef}
      className={className}
      data-flip-id={tile.id}
      data-tile-id={tile.id}
      data-material={faceDown ? undefined : tile.material}
      // feature-04 D: the spring-drag controller (useStageDrag) owns dragging via
      // pointer events; the home zone is read from here. Native HTML5 drag is off —
      // it can't spring-follow or rotate (the browser owns its drag image).
      data-zone={zone}
      data-tutorial-click-kind={tutorialClick}
      role={interactive ? 'button' : inspectable ? 'img' : undefined}
      tabIndex={focusable ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={
        focusable
          ? faceDown
            ? t('boss.faceDownTile')
            : `${idLabel} tile, ${stripRichText(t('tile.chips', { n: tileTooltipChips(tile) }))}${destroyed ? `, ${t('chance.outcome.destroyed')}` : ''}`
          : undefined
      }
      draggable={false}
      onClick={interactive ? () => onSelect!(tile.id) : undefined}
      onContextMenu={onMark ? (e) => {
        e.preventDefault();
        if (!markDisabled) onMark(tile.id);
      } : undefined}
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
          <span className="tile-letter" data-letter={tileGlyph(tile)}>{tileGlyph(tile)}</span>
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
          {forced && <span className="boss-forced-tag">{t('boss.forced')}</span>}
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
      <span className="tilt-sheen" aria-hidden />
      {destroyed && <span className="glass-shatter-fx" aria-hidden />}
      {effectPop && (
        <span key={effectPop.id} className="trigger-pop tile-effect-pop" aria-hidden>
          {(effectPop.chips !== 0 || effectPop.chipsFactor !== undefined) && (
            <span className="chip">
              <span className="chip-diamond" />
              {effectPop.chipsFactor !== undefined
                ? `×${effectPop.chipsFactor}`
                : `+${Math.round(effectPop.chips)}`}
            </span>
          )}
          {effectPop.multFactor !== undefined ? (
            <span className="mult">×{effectPop.multFactor}</span>
          ) : effectPop.mult !== 0 ? (
            <span className="mult">+{Number.isInteger(effectPop.mult) ? effectPop.mult : effectPop.mult.toFixed(2)}</span>
          ) : null}
          {effectPop.gold !== 0 && <span className="gold">+${effectPop.gold}</span>}
          {effectPop.retrigger && <span className="retrigger">{t('settle.retrigger')}</span>}
          {effectPop.chanceResults && <ChanceBadges results={effectPop.chanceResults} />}
        </span>
      )}
      </div>
      {!faceDown && tooltip && (
        <Tooltip
          anchorRef={rootRef}
          title={tooltip.title}
          body={tooltip.body}
          tags={tooltip.tags}
          sub={tooltip.sub}
          status={invalid ? 'debuffed' : disabled ? 'disabled' : undefined}
          compact
        />
      )}
    </Fragment>
  );
}

export const TileView = memo(TileViewImpl);
