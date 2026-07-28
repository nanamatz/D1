import { useState } from 'react';
import type { UseGame } from '../useGame';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { tileTooltip } from '../game';
import { TileView } from './Tile';

/**
 * feedback #4/#7: pouch-tile picker. When a tile-targeting consumable is used outside a
 * blind (the shop), up to 10 random pouch tiles are drawn; the player selects the tiles
 * to apply the effect to (min..max) and confirms. A full-screen take-over (not a cramped
 * modal), with a clear selection lift and an apply flourish before it closes.
 */
export function PouchSelectModal({ g }: { g: UseGame }) {
  const { t } = useI18n();
  const sel = g.state.pouchSelect;
  const [picked, setPicked] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  if (!sel) return null;

  const toggle = (id: string) => {
    if (applying) return;
    audio.play('tileSelect');
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= sel.max ? p : [...p, id],
    );
  };
  const ready = picked.length >= sel.min && picked.length <= sel.max;
  const prompt =
    sel.min === sel.max
      ? t('pouch.selectPrompt', { n: sel.min })
      : t('pouch.selectRange', { min: sel.min, max: sel.max });

  const apply = () => {
    if (!ready || applying) return;
    setApplying(true);
    // feedback #7: SHOW the effect landing — flash the chosen tiles, then hand off.
    audio.play('consumableUse');
    for (const id of picked) {
      const el = document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`);
      el?.classList.add('mat-flash');
    }
    window.setTimeout(() => g.confirmPouchSelect(picked), 520);
  };

  return (
    <div className={['pouch-screen', applying ? 'applying' : ''].filter(Boolean).join(' ')}>
      <div className="pouch-head">
        <h2 className="pouch-title">{t('pouch.selectTitle')}</h2>
        <div className="pouch-prompt">{prompt}</div>
        <button className="btn red" onClick={g.cancelPouchSelect} disabled={applying}>
          {t('pack.skip')}
        </button>
      </div>
      <div className="pouch-fan">
        {sel.tiles.map((tile) => (
          <div
            key={tile.id}
            className={['pouch-slot', picked.includes(tile.id) ? 'picked' : ''].filter(Boolean).join(' ')}
          >
            <TileView
              tile={tile}
              selected={picked.includes(tile.id)}
              onSelect={toggle}
              tooltip={tileTooltip(tile, t)}
            />
          </div>
        ))}
      </div>
      <div className="pouch-actions">
        <button className="btn cash" disabled={!ready || applying} onClick={apply}>
          {t('pouch.apply')} ({picked.length}/{sel.max})
        </button>
      </div>
    </div>
  );
}
