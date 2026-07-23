import { useState } from 'react';
import { useI18n } from '../i18n';
import { mascotSrc, voicedKeys } from '../mascots';
import type { RunStats } from '../useGame';

/** Size of the tip.N generic pool in the locale files. */
const GENERIC_TIPS = 5;

/** Line priority (spec 2026-07-19): discoveries → stat-based tip → random tip.
 *  Returns a bare line id — `voicedKeys` turns it into a skin-aware key chain. */
function pickLine(stats: RunStats): { id: string; params?: Record<string, number> } {
  if (stats.discoveries > 0) return { id: 'discovery', params: { n: stats.discoveries } };
  if (stats.rerollsUsed === 0) return { id: 'tip.reroll' };
  if (stats.tilesDiscarded === 0) return { id: 'tip.discard' };
  if (stats.itemsBought === 0) return { id: 'tip.shop' };
  return { id: `tip.${Math.floor(Math.random() * GENERIC_TIPS)}` };
}

/**
 * 우땅 (WooDak), the orangutan editor-mentor (spec 2026-07-19): run-end
 * companion with one contextual tip or discovery mention; a congratulation
 * leads on a win. UI-only cosmetic — Math.random is fine outside the engine.
 */
export function WooDakMascot({ stats, won }: { stats: RunStats; won: boolean }) {
  const { t } = useI18n();
  const [line] = useState(() => pickLine(stats));
  const text =
    (won ? `${t(voicedKeys('won'))} ` : '') + t(voicedKeys(line.id), line.params);
  return (
    <div className="mascot go-mascot">
      <div className="mascot-bubble">{text}</div>
      <div className="mascot-sway">
        <img className="mascot-cat woodak-img" src={mascotSrc('woodak')} alt="" />
      </div>
    </div>
  );
}
