import { useMemo, useState } from 'react';
import {
  CHALLENGE_DEFS,
  challengeDef,
  isChallengeUnlocked,
} from '../../engine/challenges';
import type { ChallengeId, PouchId, RecordId } from '../../engine/types';
import { useI18n } from '../i18n';
import { loadChallengeProgress } from '../lifetime';
import { richText } from '../richtext';
import type { StartRunConfig } from './NewRun';
import { PouchCard, RecordCard } from './ObjectCards';
import { Tooltip } from './Tooltip';

export function NewRunChallenges({ onStart }: { onStart: (config: StartRunConfig) => void }) {
  const { t } = useI18n();
  const [lifetime] = useState(() => loadChallengeProgress());
  const [challengeId, setChallengeId] = useState<ChallengeId>('redPen');
  const completed = useMemo(
    () => new Set(lifetime.completedChallenges),
    [lifetime.completedChallenges],
  );
  const challenge = challengeDef(challengeId);
  const mastered = completed.size === CHALLENGE_DEFS.length;

  const loadout = (kind: 'pouch' | 'record', id: PouchId | RecordId) => {
    const name = t(`${kind}.${id}.name`);
    const cumulative = kind === 'record' && id !== 'whiteLp' ? t('newrun.cumulative') : '';
    const props = {
      className: ['run-choice-art', `run-choice-art-${kind}`].join(' '),
      role: 'img',
      tabIndex: 0,
      'aria-label': name,
    } as const;
    return (
      <Tooltip
        title={name}
        body={[t(`${kind}.${id}.desc`), cumulative].filter(Boolean).join('\n')}
        down
      >
        {kind === 'pouch'
          ? <PouchCard id={id as PouchId} {...props} />
          : <RecordCard id={id as RecordId} {...props} />}
      </Tooltip>
    );
  };

  return (
    <>
      <div className="newrun-content challenge-body">
        <div className="challenge-progress">
          {lifetime.challengesDisabled
            ? t('challenge.disabled')
            : mastered
              ? t('challenge.mastered')
              : t('challenge.progress', { n: completed.size, total: CHALLENGE_DEFS.length })}
        </div>
        <div className="challenge-list">
          {CHALLENGE_DEFS.map((def, index) => {
            const done = completed.has(def.id);
            const unlocked = isChallengeUnlocked(def.id, completed);
            return (
              <button
                key={def.id}
                type="button"
                className={['challenge-row', challengeId === def.id && 'selected', done && 'complete']
                  .filter(Boolean).join(' ')}
                disabled={!unlocked}
                aria-pressed={challengeId === def.id}
                onClick={() => setChallengeId(def.id)}
              >
                <span>{index + 1}. {t(`challenge.${def.id}.name`)}</span>
                <span className="challenge-status">
                  {done ? t('challenge.complete') : unlocked ? t('challenge.available') : t('challenge.locked')}
                </span>
              </button>
            );
          })}
        </div>
        <div className="challenge-detail">
          <div className="challenge-loadout">
            {loadout('pouch', challenge.pouchId)}
            <span aria-hidden>+</span>
            {loadout('record', challenge.recordId)}
          </div>
          <div className="challenge-effects">
            <p><b>{t(`pouch.${challenge.pouchId}.name`)}</b> — {richText(t(`pouch.${challenge.pouchId}.desc`))}</p>
            <p><b>{t(`record.${challenge.recordId}.name`)}</b> — {richText(t(`record.${challenge.recordId}.desc`))}</p>
            <p className="cumulative-note">{t('newrun.cumulative')}</p>
          </div>
        </div>
      </div>
      <div className="newrun-action-row">
        <button
          className="btn exchange big play-run"
          disabled={lifetime.challengesDisabled}
          onClick={() => onStart({
            pouchId: challenge.pouchId,
            recordId: challenge.recordId,
            customSeed: false,
            challengeId: challenge.id,
          })}
        >
          {t('challenge.start')}
        </button>
      </div>
      <div className="newrun-note-row" aria-live="polite">
        {lifetime.challengesDisabled && t('challenge.disabledReason')}
      </div>
    </>
  );
}
