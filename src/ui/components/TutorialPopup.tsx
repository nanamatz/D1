import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { richText } from '../richtext';
import { tutorialBus, hasSeen, markSeen, ENCOUNTERS, type EncounterId } from '../tutorial';

/**
 * Layer-2 encounter popup host (work order A-2). Mounted once in App. Subscribes
 * to the tutorial bus; when an encounter fires for the first time AND the "show
 * tips" setting is on, it shows a one-time card and marks the id seen on dismiss.
 * Decoupled from trigger sites via the bus (no prop threading).
 */
export function TutorialHost() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [active, setActive] = useState<EncounterId | null>(null);

  useEffect(() => {
    return tutorialBus.subscribe((id) => {
      // Read the freshest tips setting at fire time via localStorage-backed hook:
      // if tips are off, or already seen, do nothing.
      if (!settings.tips) return;
      if (hasSeen(id)) return;
      setActive((cur) => cur ?? id); // don't clobber a popup already showing
    });
  }, [settings.tips]);

  if (!active) return <></>;
  const enc = ENCOUNTERS.find((e) => e.id === active);
  const dismiss = () => {
    markSeen(active);
    setActive(null);
  };

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div className="tut-card" onClick={(e) => e.stopPropagation()}>
        <div className="tut-head">
          <span className="tut-icon">{enc?.icon}</span>
          <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
        </div>
        <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
        <button className="btn blue tut-ok" onClick={dismiss}>
          {t('tutorial.gotIt')}
        </button>
      </div>
    </div>
  );
}
