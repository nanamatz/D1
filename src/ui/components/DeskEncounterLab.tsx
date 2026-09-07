import { useState } from 'react';
import { useI18n } from '../i18n';
import type { ScoreTypewriterTier } from '../scoreTypewriter';
import { ScoreTypewriter } from './ScoreTypewriter';

const TIERS = [1, 2, 3, 4, 5] as const satisfies readonly ScoreTypewriterTier[];

export function DeskEncounterLab({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [replay, setReplay] = useState(0);
  const [tier, setTier] = useState<ScoreTypewriterTier>(1);

  return (
    <div className="screen desk-lab">
      <header className="desk-lab-head">
        <h1>{t('desk.lab.title')}</h1>
        <p>{t('desk.lab.subtitle')}</p>
      </header>
      <main className="desk-lab-panel" aria-labelledby="desk-lab-score-title">
        <h2 id="desk-lab-score-title">{t('desk.lab.scoreFeedback.title')}</h2>
        <div className="desk-lab-grid">
          <article className="desk-lab-card desk-lab-score-card">
            <p>{t('desk.lab.scoreFeedback.body')}</p>
            <div className="desk-lab-score-stage">
              <ScoreTypewriter
                preview
                active
                tier={tier}
                beatId={`lab-${tier}-${replay}`}
                primaryKeyId="Enter"
                liveTotal={0}
                target={100}
                targetCueEnabled={false}
                blindKey="laboratory"
                screenshake={1}
                reducedMotion={false}
              />
            </div>
            <div className="desk-lab-score-controls">
              {TIERS.map((value) => (
                <button
                  key={value}
                  className="btn"
                  aria-pressed={tier === value}
                  onClick={() => setTier(value)}
                >
                  Tier {value}
                </button>
              ))}
            </div>
            <button className="btn desk-lab-replay" onClick={() => setReplay((value) => value + 1)}>
              {t('desk.lab.replay')}
            </button>
          </article>
        </div>
      </main>
      <button className="btn desk-lab-back" onClick={onBack}>{t('common.back')}</button>
    </div>
  );
}
