import { useState } from 'react';
import type { Letter, Tile } from '../../engine/types';
import { FABLE_REGISTRY } from '../../engine/fables';
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
type FableEffect = NonNullable<ReturnType<typeof FABLE_REGISTRY.get>>['effect'];

/** The tile as it will look AFTER the fable applies — so the picker can SHOW the change
 *  landing (material swaps in, rank-up bumps the letter). Destroy is shown as a fade. */
function previewTile(tile: Tile, effect: FableEffect | undefined): Tile {
  if (effect?.kind === 'material') {
    if (effect.material === 'stone') return { ...tile, material: 'stone', letter: null };
    const letter = tile.material === 'stone' ? (tile.letterBeforeStone ?? tile.letter) : tile.letter;
    return { ...tile, material: effect.material, letter };
  }
  if (effect?.kind === 'rankUp' && tile.letter) {
    const next = String.fromCharCode(tile.letter === 'Z' ? 65 : tile.letter.charCodeAt(0) + 1) as Letter;
    return { ...tile, letter: next };
  }
  return tile;
}

export function PouchSelectModal({ g }: { g: UseGame }) {
  const { t } = useI18n();
  const sel = g.state.pouchSelect;
  const [picked, setPicked] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  if (!sel) return null;

  const effect = FABLE_REGISTRY.get(sel.fableId)?.effect;
  const isDestroy = effect?.kind === 'destroy';

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
    // feedback #4/#5: SHOW the effect landing on the chosen tiles (material pops in /
    // rank-up bumps / destroy fades), hold ONE SECOND after the flourish, then commit
    // and close. The chosen tiles re-render (below) with their post-effect look; the pop
    // rides the WRAPPER (`.pouch-slot.applied/.destroying`), which React never resets.
    setApplying(true);
    audio.play('consumableUse');
    window.setTimeout(() => g.confirmPouchSelect(picked), 1000 + 450);
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
        {sel.tiles.map((tile) => {
          const isPicked = picked.includes(tile.id);
          // While applying, the chosen tiles show their POST-effect appearance.
          const shown = applying && isPicked && !isDestroy ? previewTile(tile, effect) : tile;
          const applyClass = applying && isPicked ? (isDestroy ? 'destroying' : 'applied') : '';
          return (
            <div
              key={tile.id}
              className={['pouch-slot', isPicked ? 'picked' : '', applyClass].filter(Boolean).join(' ')}
            >
              <TileView
                tile={shown}
                selected={isPicked}
                onSelect={toggle}
                tooltip={tileTooltip(tile, t)}
              />
            </div>
          );
        })}
      </div>
      <div className="pouch-actions">
        <button className="btn cash" disabled={!ready || applying} onClick={apply}>
          {t('pouch.apply')} ({picked.length}/{sel.max})
        </button>
      </div>
    </div>
  );
}
