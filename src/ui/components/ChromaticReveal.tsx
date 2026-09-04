import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import {
  applyPresentation,
  unlockBus,
  type RequiredPaletteReveal,
  type UnlockDef,
  type UnlockRevealEvent,
} from '../unlocks';
import { mascotVariantArt } from '../mascots';

/** The mascot portrait for a mascot unlock that has art (else null). */
function mascotArt(def: UnlockDef): string | null {
  return def.effect.kind === 'mascot' ? mascotVariantArt(def.effect.variant) : null;
}

/** i18n subtitle key for an unlock's celebration line. */
function bodyKey(def: UnlockDef): string {
  switch (def.effect.kind) {
    case 'color': return `unlock.body.${def.effect.group}`;
    case 'audio': return def.effect.bus === 'music' ? 'unlock.body.music' : 'unlock.body.sound';
    // A mascot with art is a real, selectable ally; art-less variants stay "coming soon".
    case 'mascot': return mascotVariantArt(def.effect.variant) ? 'unlock.body.mascotReady' : 'unlock.body.mascot';
  }
}

/** The color group an unlock belongs to (for the wash tint), or null. */
function washGroup(def: UnlockDef): string | null {
  return def.effect.kind === 'color' ? def.effect.group : null;
}

function isRequiredPaletteReveal(event: UnlockRevealEvent): event is RequiredPaletteReveal {
  return 'type' in event && event.type === 'requiredPalette';
}

/**
 * Chromatic-unlock celebration host (feature-02 C-1). Mounted once in App;
 * subscribes to the unlock bus and plays a one-shot reveal (color washes in /
 * audio fades up) for natural word unlocks or one atomic Settings aggregate.
 * Applying the presentation activates the new layer; the wash sells it.
 */
export function ChromaticReveal() {
  const { t } = useI18n();
  const [queue, setQueue] = useState<UnlockRevealEvent[]>([]);

  useEffect(() => {
    return unlockBus.subscribe((event) => {
      // Activate the persisted layers immediately, then reveal the one event.
      applyPresentation();
      const defs = isRequiredPaletteReveal(event) ? event.defs : [event];
      if (defs.some((def) => def.effect.kind === 'audio') || audio.isBusEnabled('sfx')) {
        audio.play('clearFanfare');
      }
      setQueue((q) => [...q, event]);
    });
  }, []);

  const active = queue[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 2600);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || typeof document === 'undefined') return null;
  const aggregate = isRequiredPaletteReveal(active);
  const group = aggregate ? null : washGroup(active);
  const art = aggregate ? null : mascotArt(active);
  const dismiss = () => setQueue((q) => q.slice(1));

  return createPortal(
    <div
      className={['chroma-reveal', group ? `wash-${group}` : 'wash-audio'].join(' ')}
      role="dialog"
      aria-live="polite"
      onClick={dismiss}
    >
      <div className="chroma-card">
        {aggregate ? (
          <div className="chroma-word">{t('unlock.requiredPalette')}</div>
        ) : (
          <>
            {art && <img className="chroma-mascot" src={art} alt="" />}
            <div className="chroma-word">{active.word}</div>
            <div className="chroma-body">{t(bodyKey(active))}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
