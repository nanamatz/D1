import { useRef, useState, type DragEvent } from 'react';
import type { Tile } from '../../engine/types';
import type { SortMode, StagePreview } from '../game';
import { SORT_MODES, sortHand, tileGlyph, tilesByIds, tileValue } from '../game';
import { usePersistedState, useFlip } from '../hooks';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';

interface Drag {
  zone: 'hand' | 'staged';
  id: string;
}

/** Staged word, hand, and the action cluster (UI_DESIGN §2). The selected-word
 *  status now lives in the sidebar (playtest-03 E-9); this area is board, not panel (E-5). */
export function StagePanel({ g, preview }: { g: UseGame; preview: StagePreview | null }) {
  const { t } = useI18n();
  const { blind, selected, message } = g.state;
  const [sortMode, setSortMode] = usePersistedState<SortMode>('wj.sortMode', 'vowel');
  // C-3: discard marks are a separate selection from staging (hand tiles only).
  const [discardMarks, setDiscardMarks] = useState<string[]>([]);
  const staged = tilesByIds(blind.hand, selected);
  const selectedSet = new Set(selected);
  const hand = sortHand(
    blind.hand.filter((tl) => !selectedSet.has(tl.id)),
    sortMode,
  );
  const hintIds = new Set(g.state.hint?.flatMap((w) => w.tileIds) ?? []);
  const handRef = useRef<HTMLDivElement>(null);
  const stagedRef = useRef<HTMLDivElement>(null);
  useFlip(handRef, `${sortMode}|${hand.map((tl) => tl.id).join(',')}`);
  useFlip(stagedRef, staged.map((tl) => tl.id).join(','));

  const handIds = new Set(hand.map((tl) => tl.id));
  const validMarks = discardMarks.filter((id) => handIds.has(id));
  const toggleMark = (id: string) =>
    setDiscardMarks((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const tileTip = (tile: Tile) => ({
    title: tileGlyph(tile),
    body: [
      t('tile.chips', { n: tileValue(tile) }),
      tile.material !== 'ceramic' ? t(`material.${tile.material}`) : '',
      tile.font !== 'medium' ? t(`font.${tile.font}`) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  });

  // ----- drag & drop (C-2): pointer-position insertion, hand ↔ zone both ways -----
  const parseDrag = (e: DragEvent): Drag | null => {
    const [zone, id] = (e.dataTransfer.getData('text/plain') || '').split(':');
    return (zone === 'hand' || zone === 'staged') && id ? { zone, id } : null;
  };
  const targetAt = (container: HTMLElement | null, clientX: number): string | null => {
    if (!container) return null;
    for (const el of Array.from(container.querySelectorAll<HTMLElement>('[data-tile-id]'))) {
      const r = el.getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return el.dataset.tileId ?? null;
    }
    return null; // past the last tile → append
  };
  const allowDrop = (e: DragEvent) => e.preventDefault();
  // item 9: the WHOLE stage area is a drop target. The zone is chosen by pointer
  // Y (generously: anything at/above the staged row counts as the tray), so drops
  // no longer need to land precisely inside a small box.
  const dropZoneAt = (clientY: number): 'staged' | 'hand' => {
    const r = stagedRef.current?.getBoundingClientRect();
    return r && clientY <= r.bottom + 28 ? 'staged' : 'hand';
  };
  const onStageDrop = (e: DragEvent) => {
    e.preventDefault();
    const d = parseDrag(e);
    if (!d) return;
    if (dropZoneAt(e.clientY) === 'staged') {
      if (d.zone === 'hand') {
        g.toggleTile(d.id); // stage
        return;
      }
      const to = targetAt(stagedRef.current, e.clientX) ?? staged[staged.length - 1]?.id;
      if (to && to !== d.id) g.reorderStaged(d.id, to);
    } else {
      if (d.zone === 'staged') {
        g.toggleTile(d.id); // unstage → back to hand
        return;
      }
      const to = targetAt(handRef.current, e.clientX) ?? hand[hand.length - 1]?.id;
      if (to && to !== d.id) {
        setSortMode('manual'); // manual drag order overrides the active sort
        g.reorderHand(d.id, to);
      }
    }
  };

  const doDiscard = () => {
    g.discard(validMarks);
    setDiscardMarks([]);
  };
  const canDiscard = g.canDiscard && validMarks.length > 0; // no per-use tile cap (D-4)

  return (
    <div className="stage" onDragOver={allowDrop} onDrop={onStageDrop}>
      {message && <div className="toast warn-toast">{t(message.key, message.params)}</div>}

      <div className="staged" ref={stagedRef}>
        {staged.length === 0 && <span className="zone-hint">{t('stage.zoneEmpty')}</span>}
        {staged.map((tile) => (
          <TileView key={tile.id} tile={tile} zone="staged" onSelect={g.toggleTile} tooltip={tileTip(tile)} />
        ))}
      </div>

      {/* item 6: preview the staged word BEFORE submitting — its part of speech and
          the sentence bonus this play would project (pattern + unison). */}
      {preview && !preview.isGibberish && (preview.pos || preview.sentenceBonus > 0) && (
        <div className="stage-preview">
          {preview.pos && <span className="sp-pos">{preview.pos}</span>}
          {preview.sentenceBonus > 0 && (
            <span className="sp-forecast">
              {preview.completes ? t(`pattern.${preview.completes.pattern}`) : t('stage.bonus')}
              <span className="sp-bonus">+{Math.round(preview.sentenceBonus)}</span>
            </span>
          )}
        </div>
      )}

      {g.state.hint && (
        <div className="hintbar">
          🔍{' '}
          {g.state.hint.length > 0
            ? g.state.hint.map((w) => w.word.toUpperCase()).join('  ·  ')
            : t('hint.none')}
        </div>
      )}

      <div className="hand" ref={handRef}>
        {hand.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            zone="hand"
            hinted={hintIds.has(tile.id)}
            marked={validMarks.includes(tile.id)}
            onSelect={g.toggleTile}
            onMark={toggleMark}
            tooltip={tileTip(tile)}
          />
        ))}
      </div>

      <div className="discard-hint">{t('stage.discardHint')}</div>

      {/* item 4: Balatro layout — Play (left) · Sort panel (center) · Discard (right) */}
      <div className="actions">
        <button className="btn blue play-btn" onClick={g.playWord} disabled={!g.canPlay || !!preview?.blocked}>
          {preview?.isGibberish ? t('btn.gibberish') : t('btn.play')}
        </button>
        <div className="sort-panel">
          <div className="sort-title">{t('stage.sort')}</div>
          <div className="sort-btns">
            {SORT_MODES.map((m) => (
              <button
                key={m}
                className={['sortbtn', m === sortMode ? 'on' : ''].filter(Boolean).join(' ')}
                onClick={() => setSortMode(m)}
                aria-pressed={m === sortMode}
              >
                {t(`sort.${m}`)}
              </button>
            ))}
          </div>
        </div>
        <button className="btn red discard-btn" onClick={doDiscard} disabled={!canDiscard}>
          {t('btn.discard')}
          {validMarks.length > 0 ? ` (${validMarks.length})` : ''}
        </button>
      </div>
    </div>
  );
}
