import { useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { MoneyLedger } from './MoneyValue';

const LAB_MONEY_DELTAS = [-3, 7] as const;

export function DeskEncounterLab({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [sequence, setSequence] = useState(0);

  return (
    <div className="screen desk-lab">
      <header className="desk-lab-head">
        <h1>{t('desk.lab.title')}</h1>
        <p>{t('desk.lab.subtitle')}</p>
      </header>
      <main className="desk-lab-panel" aria-labelledby="desk-lab-money-title">
        <h2 id="desk-lab-money-title">{t('shop.instantUse')}</h2>
        <div className="desk-lab-grid">
          <article className="desk-lab-card desk-lab-money-card">
            <h3>{t('consumable.fable9')}</h3>
            <p>{richText(t('consumabledesc.fable9'))}</p>
            <div className="desk-lab-money-stage" aria-label="$10, -$3, +$7, $14">
              <span className="desk-lab-money-total">$10</span>
              <MoneyLedger key={sequence} deltas={LAB_MONEY_DELTAS} sequence={sequence} />
              <span className="desk-lab-money-total">$14</span>
            </div>
            <button className="btn desk-lab-replay" onClick={() => setSequence((n) => n + 1)}>
              {t('settle.retrigger')}
            </button>
          </article>
        </div>
      </main>
      <button className="btn desk-lab-back" onClick={onBack}>{t('common.back')}</button>
    </div>
  );
}
