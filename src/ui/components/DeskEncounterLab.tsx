import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { formatScore } from '../formatScore';
import { useCountUp } from '../useAnim';
import { BONUS_LAND_MS } from '../useGame';
import { ScoreTransferReadout } from './Sidebar';

function ScoreTransferPreview() {
  const { t } = useI18n();
  const [target, setTarget] = useState(67);
  const round = useCountUp(target, BONUS_LAND_MS);
  useEffect(() => setTarget(82), []);

  return (
    <div className="desk-lab-score-demo">
      <div className="desk-lab-round">
        <span>{t('sidebar.round')}</span>
        <strong>{formatScore(round)}</strong>
      </div>
      <ScoreTransferReadout committedBefore={67} committedScore={82} round={round} />
    </div>
  );
}

export function DeskEncounterLab({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [replay, setReplay] = useState(0);

  return (
    <div className="screen desk-lab">
      <header className="desk-lab-head">
        <h1>{t('desk.lab.title')}</h1>
        <p>{t('desk.lab.subtitle')}</p>
      </header>
      <main className="desk-lab-panel" aria-labelledby="desk-lab-score-title">
        <h2 id="desk-lab-score-title">{t('desk.lab.scoreTransfer.title')}</h2>
        <div className="desk-lab-grid">
          <article className="desk-lab-card desk-lab-score-card">
            <p>{t('desk.lab.scoreTransfer.body')}</p>
            <div className="desk-lab-score-stage">
              <ScoreTransferPreview key={replay} />
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
