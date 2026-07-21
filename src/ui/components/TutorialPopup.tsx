import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { readTips } from '../settings';
import { richText } from '../richtext';
import { tutorialBus, hasSeen, markSeen, hasSeenIntro, ENCOUNTERS, type EncounterId } from '../tutorial';
import { SpotlightBubble } from './SpotlightBubble';
import { mascotSrc } from '../mascots';

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
      // Don't overlap encounter popups with the guided first-run lesson — YELLOW's Twin (LL)
      // would otherwise pop the Letter Hand card mid-lesson. Encounters begin once it's done.
      if (!hasSeenIntro()) return;
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

  const body = (
    <>
      <div className="tut-head">
        <span className="tut-icon">{enc?.icon}</span>
        <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
      </div>
      <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
      <button className="btn blue tut-ok" onClick={dismiss}>
        {t('tutorial.gotIt')}
      </button>
    </>
  );

  // Spotlight style when the encounter anchors to an element; else the centered card.
  if (enc?.target) {
    return (
      <SpotlightBubble target={enc.target} {...(mascot ? { mascot } : {})}>
        {body}
      </SpotlightBubble>
    );
  }

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div
        className={['tut-card', mascot ? 'has-mascot' : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
        {mascot && <img className="mascot-cat tut-mascot" src={mascotSrc(mascot)} alt="" />}
      </div>
    </div>
  );
}
