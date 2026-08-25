import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../i18n';
import {
  decideSteamClaim,
  steamOwnershipSnapshot,
  subscribeSteamOwnership,
} from '../storage';

export function SteamOwnershipNotice() {
  const status = useSyncExternalStore(
    subscribeSteamOwnership,
    steamOwnershipSnapshot,
    steamOwnershipSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  useEffect(() => setDismissed(false), [status]);
  useEffect(() => {
    const card = cardRef.current;
    if (!card || dismissed || !['claim-required', 'mismatch', 'invalid'].includes(status)) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = [...card.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    buttons[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab' || buttons.length === 0) return;
      const first = buttons[0]!;
      const last = buttons[buttons.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      previous?.focus();
    };
  }, [dismissed, status]);
  if (dismissed || !['claim-required', 'mismatch', 'invalid'].includes(status)) return null;
  const claim = status === 'claim-required';

  return (
    <div className="overlay steam-owner-overlay">
      <div
        ref={cardRef}
        className="overlay-card steam-owner-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="steam-owner-title"
      >
        <h3 id="steam-owner-title">{t(`steam.owner.${status}.title`)}</h3>
        <p>{t(`steam.owner.${status}.body`)}</p>
        <div className="steam-owner-actions">
          {claim ? (
            <>
              <button className="btn play" autoFocus onClick={() => decideSteamClaim('accept')}>
                {t('steam.owner.accept')}
              </button>
              <button className="btn exchange" onClick={() => decideSteamClaim('decline')}>
                {t('steam.owner.decline')}
              </button>
            </>
          ) : (
            <button className="btn exchange" autoFocus onClick={() => setDismissed(true)}>
              {t('steam.owner.ok')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
