import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { readTips } from '../settings';
import { richText } from '../richtext';
import { tutorialBus, hasSeen, markSeen, ENCOUNTERS, type EncounterId } from '../tutorial';
import piyakUrl from '../assets/piyak.png';
import woodakUrl from '../assets/woodak.png';

const MASCOT_SRC: Record<'piyak' | 'woodak', string> = { piyak: piyakUrl, woodak: woodakUrl };

/**
 * Layer-2 encounter popup host (work order A-2). Mounted once in App. Subscribes
 * to the tutorial bus and shows a one-time card per encounter, gated on the live
 * "show tips" setting and the seen-flag. Co-firing encounters QUEUE and show one
 * after another. An encounter may carry a mascot portrait (Piyak / WooDak).
 */
export function TutorialHost() {
  const { t } = useI18n();
  const [queue, setQueue] = useState<EncounterId[]>([]);

  useEffect(() => {
    return tutorialBus.subscribe((id) => {
      if (!readTips()) return;
      if (hasSeen(id)) return;
      // Defer past the firing component's render (fires happen inside setState
      // updaters / effects). Dedup against what's already queued.
      queueMicrotask(() =>
        setQueue((q) => (q.includes(id) ? q : [...q, id])),
      );
    });
  }, []);

  const active = queue[0] ?? null;
  if (!active) return <></>;
  const enc = ENCOUNTERS.find((e) => e.id === active);
  const dismiss = () => {
    markSeen(active);
    setQueue((q) => q.slice(1)); // advance to the next queued encounter
  };
  const mascot = enc?.mascot;

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div
        className={['tut-card', mascot ? 'has-mascot' : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tut-head">
          <span className="tut-icon">{enc?.icon}</span>
          <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
        </div>
        <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
        <button className="btn blue tut-ok" onClick={dismiss}>
          {t('tutorial.gotIt')}
        </button>
        {mascot && (
          <img className="mascot-cat tut-mascot" src={MASCOT_SRC[mascot]} alt="" />
        )}
      </div>
    </div>
  );
}
