import type { StagePreview } from '../game';
import { tilesByIds } from '../game';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function PreviewLine({ preview }: { preview: StagePreview | null }) {
  if (!preview) return <span className="muted">Select tiles to stage a word.</span>;
  // Gibberish escape valve made explicit (playtest-01 P0-3, GDD §6.4).
  if (preview.isGibberish) {
    return (
      <>
        <span>
          <b>{preview.text}</b>
        </span>
        <span className="warn">Not a word — submit as gibberish</span>
        <span className="chip-c">+{preview.chips} chips</span>
        <span className="muted">breaks the sentence (leaves a hole)</span>
      </>
    );
  }
  return (
    <>
      <span>
        <b>{preview.text}</b>
      </span>
      <span>{`${cap(preview.suit ?? 'standard')} ×${preview.suitMult}`}</span>
      <span className="chip-c">+{preview.chips} chips</span>
      {preview.completes && (
        <span className="muted">
          completes <b>{preview.completes.label}</b>
        </span>
      )}
    </>
  );
}

/** Staged word preview, hand, and the action buttons (UI_DESIGN §2). */
export function StagePanel({ g, preview }: { g: UseGame; preview: StagePreview | null }) {
  const { blind, selected, phase, message } = g.state;
  const staged = tilesByIds(blind.hand, selected);
  const selectedSet = new Set(selected);
  const hand = blind.hand.filter((t) => !selectedSet.has(t.id));

  return (
    <div className="panel stage">
      {message && <div className={['toast', phase === 'gameover' ? 'lose' : 'win'].join(' ')}>{message}</div>}

      <div className="preview">
        <PreviewLine preview={preview} />
      </div>

      <div className="staged">
        {staged.map((t) => (
          <TileView key={t.id} tile={t} onSelect={g.toggleTile} />
        ))}
      </div>

      <div className="hand">
        {hand.map((t) => (
          <TileView key={t.id} tile={t} onSelect={g.toggleTile} />
        ))}
      </div>

      <div className="actions">
        {phase === 'gameover' ? (
          <button className="btn play" onClick={g.newGame}>
            New game
          </button>
        ) : (
          <>
            <button className="btn play" onClick={g.playWord} disabled={!g.canPlay}>
              {preview?.isGibberish ? 'Submit gibberish' : 'Play word'}
            </button>
            <button className="btn exchange" onClick={g.exchange} disabled={!g.canExchange}>
              Exchange
            </button>
            <button className="btn cash" onClick={g.cashOut} disabled={!g.canCash}>
              Cash out&nbsp;·&nbsp;+1 phase = $1
            </button>
          </>
        )}
      </div>
    </div>
  );
}
