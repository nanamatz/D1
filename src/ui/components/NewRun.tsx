import { useMemo, useState, type ReactNode } from 'react';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import { RECORD_IDS, isRecordUnlocked } from '../../engine/records';
import {
  CHALLENGE_DEFS,
  challengeDef,
  isChallengeUnlocked,
} from '../../engine/challenges';
import type { BlindKind, ChallengeId, PouchId, RecordId } from '../../engine/types';
import { useI18n } from '../i18n';
import { loadChallengeProgress, loadLifetime, recordWinsForPouch } from '../lifetime';
import { pouchUnlockWordCount } from '../profile';
import { pouchArt } from '../pouchArt';
import { recordArt } from '../recordArt';
import { richText } from '../richtext';
import { Tooltip } from './Tooltip';
import { UiIcon } from './UiIcon';
import { formatScore } from '../formatScore';

/** Summary of the persisted run behind the Continue tab. */
export interface ContinueInfo {
  ante: number;
  blindKind: BlindKind;
  gold: number;
  seed: string;
  challengeId?: ChallengeId | null;
}

export interface StartRunConfig {
  seed?: string;
  pouchId: PouchId;
  recordId: RecordId;
  customSeed: boolean;
  challengeId?: ChallengeId | null;
}

interface Props {
  initialPouchId?: PouchId;
  initialRecordId?: RecordId;
  onStart: (config: StartRunConfig) => void;
  onBack: () => void;
  continueInfo?: ContinueInfo | undefined;
  onContinue?: (() => void) | undefined;
}

interface CarouselProps<T extends string> {
  label: string;
  kind: 'pouch' | 'record';
  ids: readonly T[];
  selected: T;
  onSelect: (id: T) => void;
  name: (id: T) => string;
  disabled?: boolean;
  children: ReactNode;
}

/** Wrapping selector for all pouch and cumulative difficulty entries. */
function Carousel<T extends string>({
  label,
  kind,
  ids,
  selected,
  onSelect,
  name,
  disabled = false,
  children,
}: CarouselProps<T>) {
  const index = Math.max(0, ids.indexOf(selected));
  const move = (delta: number) => {
    if (disabled) return;
    onSelect(ids[(index + delta + ids.length) % ids.length]!);
  };
  return (
    <section
      className={[
        'run-choice',
        `run-choice-${kind}`,
        disabled && 'choice-disabled',
      ].filter(Boolean).join(' ')}
      aria-label={`${label}: ${name(selected)}, ${index + 1}/${ids.length}`}
      aria-disabled={disabled || undefined}
    >
      <button
        type="button"
        className="car-arrow"
        disabled={disabled}
        onClick={() => move(-1)}
        aria-label={`${label}: previous`}
      >
        ‹
      </button>
      <div className="run-choice-stage">
        <span className="run-choice-label">{label}</span>
        {children}
        <div className="carousel-dots" aria-hidden="true">
          {ids.map((id, dot) => (
            <span
              key={id}
              className={[
                'carousel-dot',
                dot === index && 'current',
                dot < index && 'past',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="car-arrow"
        disabled={disabled}
        onClick={() => move(1)}
        aria-label={`${label}: next`}
      >
        ›
      </button>
    </section>
  );
}

/**
 * New Run. Starting Pouch and cumulative Record difficulty are profile-gated.
 * Profile reads stay in UI; engine helpers only evaluate supplied progress.
 */
export function NewRun({
  initialPouchId = 'yellow',
  initialRecordId = 'whiteLp',
  onStart,
  onBack,
  continueInfo,
  onContinue,
}: Props) {
  const { t } = useI18n();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');
  const canContinue = !!continueInfo && !!onContinue;
  const [tab, setTab] = useState<'new' | 'continue' | 'challenges'>(
    canContinue ? 'continue' : 'new',
  );
  const active = tab === 'continue' && !canContinue ? 'new' : tab;
  const tabs = [
    { id: 'new' as const, disabled: false },
    { id: 'continue' as const, disabled: !canContinue },
    { id: 'challenges' as const, disabled: false },
  ];

  return (
    <div className="screen newrun">
      <div className="tabs" role="tablist" aria-label={t('newrun.tabs')}>
        {tabs.map(({ id, disabled }) => (
          <button
            key={id}
            id={`newrun-tab-${id}`}
            role="tab"
            aria-selected={active === id}
            aria-controls={`newrun-panel-${id}`}
            className={['tab', active === id ? 'on' : ''].filter(Boolean).join(' ')}
            disabled={disabled}
            onClick={() => setTab(id)}
          >
            {t(`newrun.tab.${id}`)}
          </button>
        ))}
      </div>

      {active === 'continue' && continueInfo ? (
        <div id="newrun-panel-continue" role="tabpanel" aria-labelledby="newrun-tab-continue">
          <div className="panel newrun-body">
            <div className="continue-card">
              <div className="continue-art"><UiIcon name="manuscript" /></div>
              <h3 className="continue-title">{t('newrun.continueTitle')}</h3>
              <p className="select-desc">{t('newrun.continueHint')}</p>
              <div className="continue-stats">
                <span className="cs-chapter">
                  {t('newrun.continueChapter', {
                    n: continueInfo.ante,
                    blind: t(`blind.${continueInfo.blindKind}`),
                  })}
                </span>
                <span className="cs-gold">{t('newrun.continueGold', {
                  n: formatScore(continueInfo.gold),
                })}</span>
                <span className="cs-seed">
                  {t('gameover.seed')}: {continueInfo.seed}
                </span>
                {continueInfo.challengeId && (
                  <span className="cs-challenge">
                    {t('challenge.current', {
                      name: t(`challenge.${continueInfo.challengeId}.name`),
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="btn exchange big play-run" onClick={onContinue}>
            {t('newrun.continueBtn')}
          </button>
          <button className="btn back-bar" onClick={onBack}>
            {t('common.back')}
          </button>
        </div>
      ) : active === 'challenges' ? (
        <div id="newrun-panel-challenges" role="tabpanel" aria-labelledby="newrun-tab-challenges">
          <ChallengeBody onStart={onStart} onBack={onBack} />
        </div>
      ) : (
        <div id="newrun-panel-new" role="tabpanel" aria-labelledby="newrun-tab-new">
          <NewRunBody
            initialPouchId={initialPouchId}
            initialRecordId={initialRecordId}
            seeded={seeded}
            setSeeded={setSeeded}
            seed={seed}
            setSeed={setSeed}
            onStart={onStart}
            onBack={onBack}
          />
        </div>
      )}
    </div>
  );
}

function ChallengeBody({
  onStart,
  onBack,
}: Pick<Props, 'onStart' | 'onBack'>) {
  const { t } = useI18n();
  const [lifetime] = useState(() => loadChallengeProgress());
  const [challengeId, setChallengeId] = useState<ChallengeId>('redPen');
  const completed = useMemo(
    () => new Set(lifetime.completedChallenges),
    [lifetime.completedChallenges],
  );
  const challenge = challengeDef(challengeId);
  const mastered = completed.size === CHALLENGE_DEFS.length;

  const loadout = (kind: 'pouch' | 'record', id: PouchId | RecordId, src: string) => {
    const name = t(`${kind}.${id}.name`);
    const cumulative = kind === 'record' && id !== 'whiteLp' ? t('newrun.cumulative') : '';
    return (
      <Tooltip
        title={name}
        body={[t(`${kind}.${id}.desc`), cumulative].filter(Boolean).join('\n')}
        down
      >
        <div
          className={['run-choice-art', `run-choice-art-${kind}`].join(' ')}
          role="img"
          tabIndex={0}
          aria-label={name}
        >
          <img src={src} alt="" />
        </div>
      </Tooltip>
    );
  };

  return (
    <>
      <div className="panel newrun-body challenge-body">
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
          <div className="challenge-copy">
            <h2>{t(`challenge.${challenge.id}.name`)}</h2>
            <p>{t(`challenge.${challenge.id}.desc`)}</p>
          </div>
          <div className="challenge-loadout">
            {loadout('pouch', challenge.pouchId, pouchArt(challenge.pouchId))}
            <span aria-hidden>+</span>
            {loadout('record', challenge.recordId, recordArt(challenge.recordId))}
          </div>
          <div className="challenge-effects">
            <p><b>{t(`pouch.${challenge.pouchId}.name`)}</b> — {richText(t(`pouch.${challenge.pouchId}.desc`))}</p>
            <p><b>{t(`record.${challenge.recordId}.name`)}</b> — {richText(t(`record.${challenge.recordId}.desc`))}</p>
            <p className="cumulative-note">{t('newrun.cumulative')}</p>
          </div>
        </div>
      </div>
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
      {lifetime.challengesDisabled && (
        <p className="seed-unlock-note challenge-disabled-note">{t('challenge.disabledReason')}</p>
      )}
      <button className="btn back-bar" onClick={onBack}>{t('common.back')}</button>
    </>
  );
}

function NewRunBody({
  initialPouchId,
  initialRecordId,
  seeded,
  setSeeded,
  seed,
  setSeed,
  onStart,
  onBack,
}: {
  initialPouchId: PouchId;
  initialRecordId: RecordId;
  seeded: boolean;
  setSeeded: (value: boolean) => void;
  seed: string;
  setSeed: (value: string) => void;
  onStart: (config: StartRunConfig) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [pouchId, setPouchId] = useState<PouchId>(initialPouchId);
  const [recordId, setRecordId] = useState<RecordId>(initialRecordId);
  const progress = useMemo(() => {
    const lifetime = loadLifetime();
    return {
      discoveredWords: pouchUnlockWordCount(),
      pouchWins: new Set(lifetime.pouchWins),
      recordWins: new Set(lifetime.recordWins),
      recordWinsByPouch: lifetime.recordWinsByPouch,
    };
  }, []);
  const pouchUnlocked = isPouchUnlocked(pouchId, progress);
  const recordUnlocked = isRecordUnlocked(recordId, recordWinsForPouch(progress, pouchId));
  const canStart = pouchUnlocked && recordUnlocked && (!seeded || seed.trim().length > 0);

  const choice = (
    kind: 'pouch' | 'record',
    id: PouchId | RecordId,
    unlocked: boolean,
    src: string,
  ) => {
    const name = t(`${kind}.${id}.name`);
    const body = t(`${kind}.${id}.desc`);
    const lockedPouch = kind === 'pouch' && !unlocked;
    const unlock = lockedPouch
      ? t('newrun.unlock', { requirement: t(`pouch.${id}.unlock`) })
      : '';
    const title = lockedPouch ? t('newrun.locked') : name;
    const detail = lockedPouch ? unlock : body;
    const cumulative = kind === 'record' && id !== 'whiteLp'
      ? t('newrun.cumulative')
      : '';
    return (
      <div className={['select-preview', !unlocked && 'locked'].filter(Boolean).join(' ')}>
        <Tooltip
          title={name}
          body={[body, unlock, cumulative].filter(Boolean).join('\n')}
          down
        >
          <div
            className={['run-choice-art', `run-choice-art-${kind}`].join(' ')}
            role="img"
            tabIndex={0}
            aria-label={title}
          >
            <img src={src} alt="" />
            {!unlocked && <span className="run-choice-lock" aria-hidden />}
          </div>
        </Tooltip>
        <div className="run-choice-copy">
          <h2 className="run-choice-title" aria-live="polite">{title}</h2>
          <div className="run-choice-effect">
            <p className="select-desc">{richText(detail)}</p>
            {cumulative && <p className="cumulative-note">{cumulative}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="panel newrun-body">
        <Carousel
          label={t('newrun.bag')}
          kind="pouch"
          ids={POUCH_IDS}
          selected={pouchId}
          onSelect={setPouchId}
          name={(id) => t(`pouch.${id}.name`)}
        >
          {choice('pouch', pouchId, pouchUnlocked, pouchArt(pouchId))}
        </Carousel>

        <Carousel
          label={t('newrun.record')}
          kind="record"
          ids={RECORD_IDS}
          selected={recordId}
          onSelect={setRecordId}
          name={(id) => t(`record.${id}.name`)}
          disabled={!pouchUnlocked}
        >
          {choice('record', recordId, recordUnlocked, recordArt(recordId))}
        </Carousel>

      </div>

      <div className="run-start-row">
        <div className="seed-controls">
          <label className="seed-toggle">
            <input type="checkbox" checked={seeded} onChange={(event) => setSeeded(event.target.checked)} />
            <span>{t('newrun.seeded')}</span>
          </label>
          {seeded && (
            <>
              <input
                className="seed-input"
                type="text"
                value={seed}
                placeholder={t('newrun.seedPlaceholder')}
                onChange={(event) => setSeed(event.target.value)}
                spellCheck={false}
              />
              <p className="seed-unlock-note">{t('newrun.seedNoUnlocks')}</p>
            </>
          )}
        </div>

        <button
          className="btn exchange big play-run"
          disabled={!canStart}
          onClick={() => onStart({
            ...(seeded ? { seed: seed.trim() } : {}),
            pouchId,
            recordId,
            customSeed: seeded,
          })}
        >
          {t('newrun.play')}
        </button>
      </div>

      <button className="btn back-bar" onClick={onBack}>
        {t('common.back')}
      </button>
    </>
  );
}
