import { useEffect, useRef, useState } from 'react';
import type { BlindState, Letter, RunState, Tile } from '../../engine/types';
import { isVowel } from '../../engine/types';
import { useI18n } from '../i18n';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

interface Counts {
  perLetter: Record<string, number>;
  vowels: number;
  consonants: number;
  materials: Record<string, number>;
  fonts: Record<string, number>;
}

function tally(tiles: readonly Tile[]): Counts {
  const c: Counts = { perLetter: {}, vowels: 0, consonants: 0, materials: {}, fonts: {} };
  for (const t of tiles) {
    if (t.letter !== null) {
      c.perLetter[t.letter] = (c.perLetter[t.letter] ?? 0) + 1;
      if (isVowel(t.letter)) c.vowels++;
      else c.consonants++;
    }
    if (t.material !== 'ceramic') c.materials[t.material] = (c.materials[t.material] ?? 0) + 1;
    if (t.font !== 'medium') c.fonts[t.font] = (c.fonts[t.font] ?? 0) + 1;
  }
  return c;
}

/**
 * Remaining = the pouch (undrawn bag) contents ONLY (playtest-03 D-1): tiles in
 * hand, played, or discarded are excluded — they've left the pouch.
 */
const pouchRemaining = (blind: BlindState): Tile[] => blind.bag;

/** The wide A–Z table + totals — remaining tiles only (playtest-04 item 1, no toggle). */
function PouchContents({ blind }: { blind: BlindState }) {
  const { t } = useI18n();
  const active = tally(pouchRemaining(blind));

  return (
    <div className="pouch-body">
      <aside className="pouch-totals">
        <div className="bt-row">
          <span>{t('bagview.vowels')}</span>
          <b>{active.vowels}</b>
        </div>
        <div className="bt-row">
          <span>{t('bagview.consonants')}</span>
          <b>{active.consonants}</b>
        </div>
        <div className="bt-row total">
          <span>{t('bagview.tiles')}</span>
          <b>{active.vowels + active.consonants}</b>
        </div>
        {(Object.keys(active.materials).length > 0 || Object.keys(active.fonts).length > 0) && (
          <>
            <div className="label" style={{ marginTop: 6 }}>
              {t('bagview.enhanced')}
            </div>
            {Object.entries(active.materials).map(([m, n]) => (
              <div key={m} className="bt-row">
                <span>{t(`material.${m}`)}</span>
                <b>{n}</b>
              </div>
            ))}
            {Object.entries(active.fonts).map(([f, n]) => (
              <div key={f} className="bt-row">
                <span>{t(`font.${f}`)}</span>
                <b>{n}</b>
              </div>
            ))}
          </>
        )}
      </aside>

      <div className="pouch-grid">
        {ALPHABET.map((l) => {
          const now = active.perLetter[l] ?? 0;
          return (
            <div key={l} className={['bag-col', now === 0 ? 'empty' : ''].filter(Boolean).join(' ')}>
              <span className="bg-letter">{l}</span>
              <span className="bg-count">{now}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Persistent pouch widget (E-1) + CENTERED modal (playtest-04 D-3). Opens ONLY
 * while the mouse is over the widget or the modal (a grace timer bridges the gap
 * so it never flickers). `onOpenChange` lets the board slide the hand/buttons
 * down to make room while it's open.
 */
export function BagWidget({
  run,
  blind,
  onOpenChange,
}: {
  run: RunState;
  blind: BlindState;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = pouchRemaining(blind).length;
  const total = run.bag.length;

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  // Generous grace so the cursor can travel from the corner widget to the
  // centered modal without the modal closing (D-3).
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 260);
  };

  return (
    <>
      {/* The count sits below the widget box rather than inside it — the same
          shape as the shelves (box + N/max beneath), playtest-06. Hovering
          either opens the modal, so the handlers live on the dock. */}
      <div className="pouch-dock" onMouseEnter={enter} onMouseLeave={leave}>
        <div
          className={['pouch-widget', open ? 'open' : ''].filter(Boolean).join(' ')}
          aria-label={t('bagview.title')}
          aria-expanded={open}
        >
          <span className="pouch-art" aria-hidden>
            👝
          </span>
        </div>
        <span className="pouch-count">
          {remaining}/{total}
        </span>
      </div>

      {open && (
        <div className="overlay pouch-overlay">
          <div
            className="overlay-card pouch-modal"
            role="dialog"
            aria-modal
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            <div className="pouch-drawer-head">
              <h3>{t('bagview.title')}</h3>
              <span className="pouch-remaining-label">
                {t('bagview.remaining')}: {remaining}/{total}
              </span>
            </div>
            <PouchContents blind={blind} />
          </div>
        </div>
      )}
    </>
  );
}
