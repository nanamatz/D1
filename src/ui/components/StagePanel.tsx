import { useEffect, useRef, useState, type DragEvent } from 'react';
import { isVowel, type Tile } from '../../engine/types';
import type { SortMode, StagePreview } from '../game';
import { SORT_MODES, sortHand, tilesByIds, tileTooltip, nextLockLetter } from '../game';
import { usePersistedState, useFlip } from '../hooks';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { audio } from '../audio';
import { TileView } from './Tile';
import { useEntering } from './ScreenTransition';
import { useStageDrag, type StageDragCallbacks, type StageDragState } from '../drag';

/** Staged word, hand, and the action cluster (UI_DESIGN §2). The selected-word
 *  status now lives in the sidebar (playtest-03 E-9); this area is board, not panel (E-5). */
export function StagePanel({
  g,
  preview,
  lockWord,
}: {
  g: UseGame;
  preview: StagePreview | null;
  /** First-run lesson: hard-lock the board to spelling this word (YELLOW). Only the next
   *  needed letter is clickable; sort/discard/drag are disabled; Play lights only when the
   *  staged word matches. Undefined = normal free play. */
  lockWord?: string;
}) {
  const { t } = useI18n();
  const { blind, selected, message } = g.state;
  const [sortMode, setSortMode] = usePersistedState<SortMode>('wj.sortMode', 'vowel');
  // C-3: discard marks are a separate selection from staging (hand tiles only).
  const [discardMarks, setDiscardMarks] = useState<string[]>([]);
  // item 4 (discard half): short-lived fly-out ghosts for discarded tiles, captured
  // relative to `.stage` so they land correctly regardless of board scale/zoom.
  const [flying, setFlying] = useState<{ tile: Tile; x: number; y: number; w: number; h: number }[]>([]);
  const [bossFlying, setBossFlying] = useState<
    { tile: Tile; x: number; y: number; w: number; h: number }[]
  >([]);
  const bossOrigins = useRef(
    new Map<string, { x: number; y: number; w: number; h: number }>(),
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const staged = tilesByIds(blind.hand, selected);
  // First-run lesson hard-lock: only the next YELLOW letter is clickable, and Play lights
  // only when the staged word matches. Order is enforced, so `staged` is always a prefix.
  const lock = !!lockWord;
  const nextLetter = lockWord ? nextLockLetter(staged.map((tl) => tl.letter), lockWord) : null;
  const lockComplete = lock && nextLetter === null;
  const selectedSet = new Set(selected);
  const hand = sortHand(
    blind.hand.filter((tl) => !selectedSet.has(tl.id)),
    sortMode,
  );
  const hintIds = new Set(g.state.hint?.flatMap((w) => w.tileIds) ?? []);
  const handRef = useRef<HTMLDivElement>(null);
  const stagedRef = useRef<HTMLDivElement>(null);
  // feature-04 E: hold the hand deal until the blind's slide-in completes, so the
  // board arrives empty and THEN draws — the entrance chains off the transition
  // signal instead of running concurrently. `shownHand` is empty while sliding, so
  // useFlip captures the empty→full change and flies the tiles in from the pouch.
  const entering = useEntering();
  const shownHand = entering ? [] : hand;
  // A4/A5: freshly drawn tiles fly in from the pouch dock, staggered, each with a
  // per-tile draw sound on the same 60ms cadence. The staged row keeps plain FLIP.
  const pouchOrigin = () => {
    if (typeof document === 'undefined') return null;
    const dock = document.querySelector('.pouch-dock');
    if (!dock) return null;
    const r = dock.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  useFlip(handRef, `${sortMode}|${entering ? 'entering' : ''}|${shownHand.map((tl) => tl.id).join(',')}`, {
    enterOrigin: pouchOrigin,
    onEnter: (i) => { window.setTimeout(() => audio.play('tileDeal'), i * 60); },
  });
  useFlip(stagedRef, staged.map((tl) => tl.id).join(','));

  const captureBossDiscardOrigins = () => {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    const origins = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const row of [handRef.current, stagedRef.current]) {
      row?.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((el) => {
        const id = el.dataset.tileId;
        if (!id) return;
        const r = el.getBoundingClientRect();
        origins.set(id, {
          x: r.left - stageRect.left,
          y: r.top - stageRect.top,
          w: r.width,
          h: r.height,
        });
      });
    }
    bossOrigins.current = origins;
  };

  // Unopened Letter: the engine reports the exact seeded-random tiles it removed.
  // Recreate them as presentation ghosts so the post-play hand can settle immediately
  // while the discarded tiles are visibly pulled out and thrown away.
  useEffect(() => {
    const discard = g.state.bossDiscard;
    if (!discard?.tiles.length) return;
    const stageRect = stageRef.current?.getBoundingClientRect();
    const handRect = handRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    const fallbackW = handRef.current?.querySelector<HTMLElement>('[data-tile-id]')
      ?.getBoundingClientRect().width ?? 68;
    const fallbackY = handRect ? handRect.top - stageRect.top : stageRect.height * 0.6;
    const ghosts = discard.tiles.slice(0, 4).map((tile, index, all) => {
      const captured = bossOrigins.current.get(tile.id);
      if (captured) return { tile, ...captured };
      return {
        tile,
        x: stageRect.width / 2 + (index - (all.length - 1) / 2) * (fallbackW * 0.72) - fallbackW / 2,
        y: fallbackY,
        w: fallbackW,
        h: fallbackW,
      };
    });
    setBossFlying(ghosts);
    audio.play('discardSwoosh');
    const timer = window.setTimeout(() => setBossFlying([]), 920);
    return () => window.clearTimeout(timer);
  }, [g.state.bossDiscard?.id]);

  const handIds = new Set(hand.map((tl) => tl.id));
  const validMarks = discardMarks.filter((id) => handIds.has(id));
  const toggleMark = (id: string) => {
    if (lock) return; // discard is disabled during the lesson lock
    setDiscardMarks((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };
  const selectTile = (id: string) => {
    // A-2: an enhanced tile speaks in its own material voice on selection; a plain
    // tile keeps the default select click. Wood's knock climbs with its growth.
    const tile = blind.hand.find((tl) => tl.id === id);
    if (tile && tile.material !== 'ceramic') {
      const step = tile.material === 'wood'
        ? Math.max(0, Math.round(((tile.woodBonusChips ?? 15) - 15) / 10))
        : undefined;
      audio.material(tile.material, step !== undefined ? { step } : undefined);
    } else {
      audio.play('tileSelect');
    }
    g.toggleTile(id);
  };
  // Ancient Paper (고대 문서): vowel tiles stay face-down (identity hidden) until
  // played — in both the hand and the staged word, so staging can't scout them.
  const faceDown = (tile: Tile) => !!blind.vowelsHidden && isVowel(tile.letter);

  const tileTip = (tile: Tile) => tileTooltip(tile, t);

  // ----- drag & drop (feature-04 D): spring-physics pointer drag, hand ↔ tray both
  //       ways, replacing native HTML5 DnD (which can't spring-follow or rotate). The
  //       controller owns pointer motion via a rAF loop + GPU transforms; React state
  //       changes only on drop. `stateRef` carries the live ids for future use. -----
  const stateRef = useRef<StageDragState>({ handIds: [], stagedIds: [] });
  stateRef.current = { handIds: hand.map((tl) => tl.id), stagedIds: staged.map((tl) => tl.id) };
  const dragCb: StageDragCallbacks = {
    stage: (id) => { audio.play('tilePlace'); g.toggleTile(id); },
    unstage: (id) => { audio.play('tilePick'); g.toggleTile(id); },
    reorderHand: (fromId, toId) => {
      const to = toId ?? hand[hand.length - 1]?.id ?? null;
      if (to && to !== fromId) g.reorderHand(fromId, to);
    },
    reorderStaged: (fromId, toId) => {
      const to = toId ?? staged[staged.length - 1]?.id ?? null;
      if (to && to !== fromId) g.reorderStaged(fromId, to);
    },
    onManualReorder: () => setSortMode('manual'),
    playGrab: () => audio.play('tilePick'),
    playDrop: () => audio.play('dragSnap'),
  };
  useStageDrag(stageRef, handRef, stagedRef, !lock, stateRef, dragCb);

  const doDiscard = () => {
    audio.play('discardSwoosh');
    const reduce =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('force-reduced-motion'));
    if (!reduce) {
      const stageRect = handRef.current?.closest('.stage')?.getBoundingClientRect();
      const ghosts = validMarks
        .map((id) => {
          const el = handRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
          const tile = blind.hand.find((tl) => tl.id === id);
          if (!el || !tile || !stageRect) return null;
          const r = el.getBoundingClientRect();
          return { tile, x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height };
        })
        .filter(Boolean) as { tile: Tile; x: number; y: number; w: number; h: number }[];
      setFlying(ghosts);
      setTimeout(() => setFlying([]), 340);
    }
    g.discard(validMarks);
    setDiscardMarks([]);
  };
  const canDiscard = g.canDiscard && validMarks.length > 0 && !lock; // no per-use tile cap (D-4)

  return (
    <div className="stage" ref={stageRef}>
      {message && message.key !== 'boss.notAllowed' && (
        <div className="toast warn-toast">{t(message.key, message.params)}</div>
      )}

      <div className="staged" ref={stagedRef}>
        {staged.length === 0 && <span className="zone-hint">{t('stage.zoneEmpty')}</span>}
        {staged.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            zone="staged"
            faceDown={faceDown(tile)}
            invalid={!!preview?.debuffed}
            onSelect={selectTile}
            tooltip={tileTip(tile)}
          />
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
        {shownHand.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            zone="hand"
            hinted={hintIds.has(tile.id)}
            marked={validMarks.includes(tile.id)}
            faceDown={faceDown(tile)}
            disabled={lock && tile.letter !== nextLetter}
            onSelect={selectTile}
            onMark={toggleMark}
            tooltip={tileTip(tile)}
          />
        ))}
      </div>

      <div className="discard-hint">{t('stage.discardHint')}</div>

      {/* item 4: Balatro layout — Play (left) · Sort panel (center) · Discard (right) */}
      <div className="actions">
        <button
          className="btn blue play-btn"
          onClick={() => {
            captureBossDiscardOrigins();
            audio.play('submitThock');
            g.playWord();
          }}
          disabled={!g.canPlay || !!preview?.blocked || (lock && !lockComplete)}
        >
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
                disabled={lock}
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

      {/* item 4 (discard half): flying ghosts of the discarded tiles, fading out while
          the real hand FLIPs closed and replacements slide in (item 4, draw half). */}
      {flying.length > 0 && (
        <div className="discard-ghosts" aria-hidden>
          {flying.map((f, i) => (
            <span
              key={`${f.tile.id}-${i}`}
              className="discard-ghost"
              style={{ left: f.x, top: f.y, width: f.w, height: f.h }}
            >
              <TileView tile={f.tile} />
            </span>
          ))}
        </div>
      )}
      {bossFlying.length > 0 && (
        <div className="boss-discard-ghosts" aria-hidden>
          {bossFlying.map((f, i) => (
            <span
              key={`${f.tile.id}-${i}`}
              className="boss-discard-ghost"
              style={{
                left: f.x,
                top: f.y,
                width: f.w,
                height: f.h,
                ['--boss-discard-i' as string]: i,
              }}
            >
              <TileView tile={f.tile} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
