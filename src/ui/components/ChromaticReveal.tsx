import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { audio } from '../audio';
import { applyPresentation, unlockBus, type UnlockDef } from '../unlocks';
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
    case 'locale': return 'unlock.body.korean';
    // A mascot with art is a real, selectable ally; art-less variants stay "coming soon".
    case 'mascot': return mascotVariantArt(def.effect.variant) ? 'unlock.body.mascotReady' : 'unlock.body.mascot';
  }
}

/** The color group an unlock belongs to (for the wash tint), or null. */
function washGroup(def: UnlockDef): string | null {
  return def.effect.kind === 'color' ? def.effect.group : null;
}

/**
 * Chromatic-unlock celebration host (feature-02 C-1). Mounted once in App;
 * subscribes to the unlock bus and plays a one-shot reveal (color washes in /
 * audio fades up) the first time each unlock word is played. Applying the
 * presentation activates the new layer; the wash sells it.
 */
export function ChromaticReveal() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [queue, setQueue] = useState<UnlockDef[]>([]);

  useEffect(() => {
    return unlockBus.subscribe((def) => {
      // Activate the newly-played layer immediately (token swap / bus enable),
      // then reveal it. `applyPresentation` reads the freshly-persisted played set.
      applyPresentation(settings.unlockAll);
      // If this unlock turned on audio, a fanfare now "fades up" the new bus.
      if (def.effect.kind === 'audio' || audio.isBusEnabled('sfx')) audio.play('clearFanfare');
      setQueue((q) => [...q, def]);
    });
  }, [settings.unlockAll]);

  const active = queue[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 2600);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  const group = washGroup(active);
  const art = mascotArt(active);
  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <div
      className={['chroma-reveal', group ? `wash-${group}` : 'wash-audio'].join(' ')}
      role="dialog"
      aria-live="polite"
      onClick={dismiss}
    >
      <div className="chroma-card">
        {art && <img className="chroma-mascot" src={art} alt="" />}
        <div className="chroma-word">{active.word}</div>
        <div className="chroma-body">{t(bodyKey(active))}</div>
      </div>
    </div>
  );
}
