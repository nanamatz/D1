import { useState } from 'react';
import { useI18n } from '../i18n';
import { DESK_KINDS, DeskObjects, type DeskKind } from './DeskObjects';

function EncounterSample({ kind }: { kind: DeskKind }) {
  const { t } = useI18n();
  const [resetToken, setResetToken] = useState(0);

  return (
    <article className="desk-lab-card">
      <div className="desk-lab-copy">
        <strong>{t(`desk.encounter.${kind}.name`)}</strong>
        <span>{t(`desk.encounter.${kind}.desc`)}</span>
      </div>
      <div className="desk-lab-stage">
        <DeskObjects active sampleKind={kind} resetToken={resetToken} />
      </div>
      <button className="btn desk-lab-replay" onClick={() => setResetToken((value) => value + 1)}>
        {t('desk.lab.replay')}
      </button>
    </article>
  );
}

export function DeskEncounterLab({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();

  return (
    <div className="screen desk-lab">
      <header className="desk-lab-head">
        <h1>{t('desk.lab.title')}</h1>
        <p>{t('desk.lab.subtitle')}</p>
      </header>
      <div className="desk-lab-grid">
        {DESK_KINDS.map((kind) => <EncounterSample key={kind} kind={kind} />)}
      </div>
      <button className="btn desk-lab-back" onClick={onBack}>{t('common.back')}</button>
    </div>
  );
}
