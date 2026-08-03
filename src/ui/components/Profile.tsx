import { useEffect, useState } from 'react';
import type { Lexicon } from '../../engine/lexicon';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import { RECORD_IDS } from '../../engine/records';
import { loadLifetime, recordWinCount } from '../lifetime';
import { useI18n } from '../i18n';
import {
  PROFILE_NAME_MAX,
  createProfile,
  isProfileWorldComplete,
  profileCollectionSize,
  renameProfile,
  unlockAllProfile,
} from '../profile';
import {
  PROFILE_SLOTS,
  activeProfile,
  resetProfile,
  selectProfile,
  type ProfileSlot,
} from '../storage';
import { UNLOCKS, applyPresentation, playedCount } from '../unlocks';

interface Props {
  lexicon: Lexicon;
  onBack: () => void;
}

interface ProgressRow {
  key: string;
  have: number;
  total: number;
}

const percent = (have: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((have / total) * 100)) : 0;

/** Three isolated profile slots. P1 exists by default; P2/P3 must be created. */
export function Profile({ lexicon, onBack }: Props) {
  const { t } = useI18n();
  const currentSlot = activeProfile();
  const [selectedSlot, setSelectedSlot] = useState<ProfileSlot>(currentSlot);
  const [, refresh] = useState(0);
  const lifetime = loadLifetime(selectedSlot);
  const [nameDraft, setNameDraft] = useState(lifetime.profileName);
  const [notice, setNotice] = useState<'unlock' | 'delete' | null>(null);

  useEffect(() => {
    setNameDraft(lifetime.profileName);
    setNotice(null);
  }, [selectedSlot, lifetime.profileName]);

  const chooseSlot = (next: ProfileSlot) => setSelectedSlot(next);

  const create = () => {
    createProfile(selectedSlot, nameDraft);
    refresh((value) => value + 1);
  };

  const load = () => {
    selectProfile(selectedSlot);
    window.location.reload();
  };

  const commitName = () => {
    const profileName = renameProfile(selectedSlot, nameDraft);
    setNameDraft(profileName);
    refresh((value) => value + 1);
  };

  const revealAll = () => {
    const result = unlockAllProfile(selectedSlot, lexicon);
    if (result === 'warning') {
      setNotice('unlock');
      refresh((value) => value + 1);
      return;
    }
    if (result === 'unlocked') {
      setNotice(null);
      if (selectedSlot === currentSlot) applyPresentation();
      refresh((value) => value + 1);
    }
  };

  const deleteProfile = () => {
    if (selectedSlot === currentSlot) return;
    if (notice !== 'delete') {
      setNotice('delete');
      return;
    }
    resetProfile(selectedSlot);
    refresh((value) => value + 1);
  };

  const slotTabs = (
    <div className="profile-slots" aria-label={t('profile.slots')}>
      {PROFILE_SLOTS.map((candidate) => (
        <button
          key={candidate}
          className={['btn', 'red', 'profile-slot', candidate === selectedSlot ? 'on' : '']
            .filter(Boolean).join(' ')}
          aria-current={candidate === selectedSlot ? 'true' : undefined}
          onClick={() => chooseSlot(candidate)}
        >
          {candidate}
        </button>
      ))}
    </div>
  );

  if (!lifetime.profileCreated) {
    return (
      <div className="screen profile-screen">
        {slotTabs}
        <input
          className="profile-name profile-name-input"
          value={nameDraft}
          maxLength={PROFILE_NAME_MAX}
          placeholder={t('profile.namePlaceholder')}
          aria-label={t('profile.namePlaceholder')}
          onChange={(event) => setNameDraft(event.target.value)}
        />

        <section className="panel profile-dashboard">
          <div className="profile-empty-box">{t('profile.empty')}</div>
          <div className="profile-actions">
            <button className="btn exchange profile-primary" onClick={create}>
              {t('profile.create')}
            </button>
            <button className="btn red profile-delete" disabled>
              {t('profile.delete')}
            </button>
          </div>

          <button className="btn back-bar" onClick={onBack}>
            {t('common.back')}
          </button>
        </section>
      </div>
    );
  }

  const words = profileCollectionSize(lexicon.size, selectedSlot);
  const progress = {
    discoveredWords: words,
    pouchWins: new Set(lifetime.pouchWins),
    recordWins: new Set(lifetime.recordWins),
  };
  const rows: ProgressRow[] = [
    { key: 'collection', have: words, total: lexicon.size },
    { key: 'presentation', have: playedCount(selectedSlot), total: UNLOCKS.length },
    {
      key: 'pouches',
      have: POUCH_IDS.filter((id) => isPouchUnlocked(id, progress)).length,
      total: POUCH_IDS.length,
    },
    {
      key: 'recordWins',
      have: recordWinCount(lifetime),
      total: POUCH_IDS.length * RECORD_IDS.length,
    },
  ];
  const totalHave = rows.reduce((sum, row) => sum + row.have, 0);
  const totalItems = rows.reduce((sum, row) => sum + row.total, 0);
  const worldComplete = isProfileWorldComplete(selectedSlot, lexicon);
  const balanceWinRate =
    lifetime.balance.runs > 0
      ? Math.round((lifetime.balance.wins / lifetime.balance.runs) * 100)
      : 0;
  const commonLossChapter =
    Object.entries(lifetime.balance.lossesByChapter)
      .sort(([chapterA, countA], [chapterB, countB]) =>
        countB - countA || Number(chapterA) - Number(chapterB))
      .at(0)?.[0] ?? '—';

  return (
    <div className="screen profile-screen">
      {slotTabs}

      <input
        className="profile-name profile-name-input"
        value={nameDraft}
        maxLength={PROFILE_NAME_MAX}
        aria-label={t('profile.rename')}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />

      <section className="panel profile-dashboard">
        <div className="profile-progress">
          <div className="profile-progress-head">
            <span>{t('profile.progress')}</span>
            <strong>{percent(totalHave, totalItems)}%</strong>
          </div>
          <div className="profile-progress-list">
            {rows.map((row) => {
              const value = percent(row.have, row.total);
              return (
                <div className="profile-progress-row" key={row.key}>
                  <span className="profile-progress-label">{t(`profile.${row.key}`)}</span>
                  <span className="profile-progress-track">
                    <span className="profile-progress-fill" style={{ width: `${value}%` }} />
                    <strong>{value}% ({row.have}/{row.total})</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="profile-actions">
          <div className="profile-balance">
            <span>{t('profile.wins')}: <strong>{lifetime.wins}</strong></span>
            <span>{t('profile.balanceRuns')}: <strong>{lifetime.balance.runs}</strong></span>
            <span>{t('profile.balanceWinRate')}: <strong>{balanceWinRate}%</strong></span>
            <span>
              {t('profile.balanceCommonLoss')}: <strong>{commonLossChapter}</strong>
            </span>
          </div>
          {selectedSlot === currentSlot ? (
            <button className="btn exchange profile-primary" disabled>
              {t('profile.current')}
            </button>
          ) : (
            <button className="btn exchange profile-primary" onClick={load}>
              {t('profile.load')}
            </button>
          )}
          <button
            className="btn red profile-delete"
            disabled={selectedSlot === currentSlot}
            onClick={deleteProfile}
          >
            {t('profile.delete')}
          </button>
          {lifetime.unlockAllApplied ? (
            <p className="profile-completion">{t('profile.challengesDisabled')}</p>
          ) : worldComplete ? (
            <p className="profile-completion">{t('profile.worldComplete')}</p>
          ) : (
            <button className="btn profile-unlock" onClick={revealAll}>
              {t('profile.unlockAll')}
            </button>
          )}
        </div>

        {notice === 'unlock' && (
          <p className="profile-warning" role="alert">
            {t('profile.unlockWarning')}
          </p>
        )}
        {notice === 'delete' && (
          <p className="profile-warning" role="alert">
            {t('profile.deleteWarning', { profile: lifetime.profileName })}
          </p>
        )}

        <button className="btn back-bar" onClick={onBack}>
          {t('common.back')}
        </button>
      </section>
    </div>
  );
}
