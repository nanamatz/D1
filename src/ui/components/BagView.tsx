import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../engine/balance';
import type { Letter, RunState, Tile } from '../../engine/types';
import { isVowel } from '../../engine/types';
import { useI18n } from '../i18n';
import { tileTooltip } from '../game';
import { tutorialBus } from '../tutorial';
import { pouchArt } from '../pouchArt';
import { richText } from '../richtext';
import { TileView } from './Tile';
import { Tooltip } from './Tooltip';

interface Counts {
  perLetter: Record<string, number>;
  vowels: number;
  consonants: number;
  materials: Record<string, number>;
  fonts: Record<string, number>;
  editions: Record<string, number>;
}

const LETTERS = Object.keys(BALANCE.bagComposition) as Letter[];
const POUCH_GRID_COLUMNS = 13;

function tally(tiles: readonly Tile[]): Counts {
  const c: Counts = {
    perLetter: {}, vowels: 0, consonants: 0, materials: {}, fonts: {}, editions: {},
  };
  for (const t of tiles) {
    if (t.letter !== null) {
      c.perLetter[t.letter] = (c.perLetter[t.letter] ?? 0) + 1;
      if (isVowel(t.letter)) c.vowels++;
      else c.consonants++;
    }
    if (t.material !== 'ceramic') c.materials[t.material] = (c.materials[t.material] ?? 0) + 1;
    if (t.font !== 'medium') c.fonts[t.font] = (c.fonts[t.font] ?? 0) + 1;
    if ((t.edition ?? 'base') !== 'base') {
      c.editions[t.edition!] = (c.editions[t.edition!] ?? 0) + 1;
    }
  }
  return c;
}

/** Order tiles for the pouch view: by letter A–Z, letterless (Stone) last. */
function sortForDisplay(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    if (a.letter === b.letter) return 0;
    if (a.letter === null) return 1;
    if (b.letter === null) return -1;
    return a.letter < b.letter ? -1 : 1;
  });
}

/** Full permanent pouch; tiles outside the undrawn pouch stay translucent. */
function PouchContents({
  run,
  tiles,
}: {
  run: RunState;
  tiles: readonly Tile[];
}) {
  const { t } = useI18n();
  const full = tally(run.bag);
  const remaining = tally(tiles);
  const remainingIds = new Set(tiles.map((tile) => tile.id));
  const columns = Math.min(POUCH_GRID_COLUMNS, Math.max(1, run.bag.length));

  return (
    <div className="pouch-body">
      <aside className="pouch-totals">
        <div className="pouch-selected-info">
          <strong>{t(`pouch.${run.pouchId}.name`)}</strong>
          <p>{richText(t(`pouch.${run.pouchId}.desc`))}</p>
        </div>
        <div className="bt-row">
          <span>{t('bagview.totalVowels')}</span>
          <b>{full.vowels}</b>
        </div>
        <div className="bt-row">
          <span>{t('bagview.totalConsonants')}</span>
          <b>{full.consonants}</b>
        </div>
        <div className="bt-row total">
          <span>{t('bagview.totalTiles')}</span>
          <b>{run.bag.length}</b>
        </div>
        <div className="pouch-modal-letter-grid" aria-label={t('bagview.remaining')}>
          {LETTERS.map((letter) => (
            <div className="pouch-modal-letter-count" key={letter}>
              <b>{letter}</b>
              <span>{remaining.perLetter[letter] ?? 0}</span>
            </div>
          ))}
        </div>
        {(Object.keys(full.materials).length > 0 ||
          Object.keys(full.fonts).length > 0 ||
          Object.keys(full.editions).length > 0) && (
          <>
            <div className="label" style={{ marginTop: 6 }}>
              {t('bagview.enhanced')}
            </div>
            {Object.entries(full.materials).map(([m, n]) => (
              <div key={m} className="bt-row">
                <span>{t(`material.${m}`)}</span>
                <b>{n}</b>
              </div>
            ))}
            {Object.entries(full.fonts).map(([f, n]) => (
              <div key={f} className="bt-row">
                <span>{t(`font.${f}`)}</span>
                <b>{n}</b>
              </div>
            ))}
            {Object.entries(full.editions).map(([edition, n]) => (
              <div key={edition} className="bt-row">
                <span>{t(`edition.${edition}`)}</span>
                <b>{n}</b>
              </div>
            ))}
          </>
        )}
      </aside>

      <div
        className="pouch-tiles"
        aria-label={t('bagview.full')}
        style={{ '--pouch-columns': columns } as CSSProperties}
      >
        {sortForDisplay(run.bag).map((tile) => (
          <div
            key={tile.id}
            className={[
              'pouch-tile-slot',
              remainingIds.has(tile.id) ? '' : 'missing',
            ].filter(Boolean).join(' ')}
          >
            <TileView tile={tile} inspectable tooltip={tileTooltip(tile, t)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Persistent pouch widget. Hover shows a compact A-Z remaining-count grid;
 * clicking toggles the full-pouch modal.
 */
export function BagWidget({
  run,
  tiles,
  onHoverChange,
}: {
  run: RunState;
  tiles: readonly Tile[];
  onHoverChange?: (hovered: boolean) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remaining = tiles.length;
  const total = run.bag.length;
  const counts = tally(tiles).perLetter;
  const workspace = hovered && typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('.phase-workspace')
    : null;

  useEffect(() => {
    onHoverChange?.(hovered && !open);
  }, [hovered, onHoverChange, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const showSummary = () => {
    setHovered(true);
    tutorialBus.fire('pouchHover');
  };

  return (
    <>
      {/* Hover shows counts; click toggles the full view. */}
      <div
        className={['pouch-dock', open ? 'open' : ''].filter(Boolean).join(' ')}
        onMouseEnter={showSummary}
        onMouseLeave={() => setHovered(false)}
      >
        <Tooltip
          title={t(`pouch.${run.pouchId}.name`)}
          body={t(`pouch.${run.pouchId}.desc`)}
          disabled={open || hovered}
        >
          <button
            type="button"
            className={['pouch-widget', open ? 'open' : ''].filter(Boolean).join(' ')}
            aria-label={t('bagview.title')}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="pouch-contents-dialog"
            onClick={() => setOpen((value) => !value)}
            onFocus={showSummary}
            onBlur={() => setHovered(false)}
          >
            <img className="pouch-art" src={pouchArt(run.pouchId)} alt="" aria-hidden />
          </button>
        </Tooltip>
        <span className="pouch-count">
          {remaining}/{total}
        </span>
      </div>

      {hovered && !open && workspace && createPortal(
        <div className="pouch-letter-summary" role="status" aria-label={t('bagview.remaining')}>
            {LETTERS.map((letter) => (
              <span className="pouch-letter-count" key={letter}>
                <b>{letter}</b>
                <span>{counts[letter] ?? 0}</span>
              </span>
            ))}
        </div>,
        workspace,
      )}

      {open && (
        <div className="overlay pouch-overlay" onClick={() => setOpen(false)}>
          <div
            id="pouch-contents-dialog"
            className="overlay-card pouch-modal"
            role="dialog"
            aria-modal
            aria-label={t('bagview.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <PouchContents run={run} tiles={tiles} />
            <button autoFocus className="btn cash pouch-close" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
