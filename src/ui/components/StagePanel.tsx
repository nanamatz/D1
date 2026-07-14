import { useRef } from 'react';
import type { SortMode, StagePreview } from '../game';
import { SORT_MODES, sortHand, tilesByIds } from '../game';
import { usePersistedState, useFlip } from '../hooks';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';

function PreviewLine({ preview }: { preview: StagePreview | null }) {
  const { t } = useI18n();
  if (!preview) return <span className="muted">{t('stage.selectPrompt')}</span>;
  if (preview.blocked) {
    return (
      <>
        <span>
          <b>{preview.text}</b>
        </span>
        <span className="warn">{t('boss.blockedWord')}</span>
      </>
    );
  }
  // Gibberish escape valve made explicit (playtest-01 P0-3, GDD §6.4).
  if (preview.isGibberish) {
    return (
      <>
        <span>
          <b>{preview.text}</b>
        </span>
        <span className="warn">{t('stage.notWord')}</span>
        <span className="chip-c">{t('stage.chips', { chips: preview.chips })}</span>
        <span className="muted">{t('stage.breaks')}</span>
      </>
    );
  }
  return (
    <>
      <span>
        <b>{preview.text}</b>
      </span>
      <span>{t('stage.suitMult', { suit: t(`suit.${preview.suit ?? 'standard'}`), mult: preview.suitMult })}</span>
      <span className="chip-c">{t('stage.chips', { chips: preview.chips })}</span>
      {preview.completes && (
        <span className="muted">
          {t('stage.completes', { name: t(`pattern.${preview.completes.pattern}`) })}
        </span>
      )}
    </>
  );
}

/** Staged word preview, hand, and the action buttons (UI_DESIGN §2). */
export function StagePanel({ g, preview }: { g: UseGame; preview: StagePreview | null }) {
  const { t } = useI18n();
  const { blind, selected, phase, message } = g.state;
  const [sortMode, setSortMode] = usePersistedState<SortMode>('wj.sortMode', 'vowel');
  const staged = tilesByIds(blind.hand, selected);
  const selectedSet = new Set(selected);
  const hand = sortHand(
    blind.hand.filter((t) => !selectedSet.has(t.id)),
    sortMode,
  );
  const hintIds = new Set(g.state.hint?.flatMap((w) => w.tileIds) ?? []);
  const handRef = useRef<HTMLDivElement>(null);
  const stagedRef = useRef<HTMLDivElement>(null);
  useFlip(handRef, `${sortMode}|${hand.map((t) => t.id).join(',')}`);
  useFlip(stagedRef, staged.map((t) => t.id).join(','));

  const dragHandTile = (fromId: string, toId: string) => {
    setSortMode('manual'); // manual drag order overrides the active sort
    g.reorderHand(fromId, toId);
  };

  return (
    <div className="panel stage">
      {message && (
        <div className={['toast', phase === 'gameover' ? 'lose' : 'win'].join(' ')}>
          {t(message.key, message.params)}
        </div>
      )}

      <div className="preview">
        <PreviewLine preview={preview} />
      </div>

      <div className="staged" ref={stagedRef}>
        {staged.map((t) => (
          <TileView key={t.id} tile={t} onSelect={g.toggleTile} onReorder={g.reorderStaged} />
        ))}
      </div>

      {g.state.hint && (
        <div className="hintbar">
          🔍{' '}
          {g.state.hint.length > 0
            ? g.state.hint.map((w) => w.word.toUpperCase()).join('  ·  ')
            : t('hint.none')}
        </div>
      )}

      <div className="sortbar">
        <span className="label">{t('stage.sort')}</span>
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

      <div className="hand" ref={handRef}>
        {hand.map((t) => (
          <TileView
            key={t.id}
            tile={t}
            hinted={hintIds.has(t.id)}
            onSelect={g.toggleTile}
            onReorder={dragHandTile}
          />
        ))}
      </div>

      <div className="actions">
        {phase === 'gameover' ? (
          <button className="btn play" onClick={g.newGame}>
            {t('btn.newGame')}
          </button>
        ) : (
          <>
            <button
              className="btn play"
              onClick={g.playWord}
              disabled={!g.canPlay || !!preview?.blocked}
            >
              {preview?.isGibberish ? t('btn.gibberish') : t('btn.play')}
            </button>
            <button className="btn exchange" onClick={g.exchange} disabled={!g.canExchange}>
              {t('btn.exchange')}
            </button>
            <button className="btn cash" onClick={g.cashOut} disabled={!g.canCash}>
              {t('btn.cash')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
