import { useEffect, useMemo, useState } from 'react';
import type { Lexicon } from '../../engine/lexicon';
import type { Suit } from '../../engine/types';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import { RECORD_IDS } from '../../engine/records';
import { recordWinCount } from '../lifetime';
import { useI18n } from '../i18n';
import {
  PROFILE_NAME_MAX,
  REGISTER_TITLE_SUITS,
  createProfile,
  isProfileWorldComplete,
  loadProfileViewSnapshot,
  reconcileProfileTitleFromSnapshot,
  renameProfile,
  selectProfileTitleFromSnapshot,
  unlockedProfileTitle,
  unlockAllProfile,
} from '../profile';
import {
  GOD_TITLE_DEF,
  registerTitleDefs,
  type ProfileTitleId,
} from '../profileTitles';
import {
  PROFILE_SLOTS,
  activeProfile,
  resetProfile,
  selectProfile,
  type ProfileSlot,
} from '../storage';
import { UNLOCKS, applyPresentation, playedCount } from '../unlocks';
import { formatScore } from '../formatScore';

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
  const [revision, refresh] = useState(0);
  const snapshot = useMemo(
    () => loadProfileViewSnapshot(lexicon, selectedSlot),
    [lexicon, selectedSlot, revision],
  );
  const { lifetime, registerTitles } = snapshot;
  const [nameDraft, setNameDraft] = useState(lifetime.profileName);
  const [notice, setNotice] = useState<'unlock' | 'delete' | null>(null);
  const [openRegister, setOpenRegister] = useState<Suit | null>(null);
  const equippedTitle = registerTitles
    ? unlockedProfileTitle(lifetime.equippedRegisterTitle, registerTitles)
    : null;

  useEffect(() => {
    setNameDraft(lifetime.profileName);
    setNotice(null);
    setOpenRegister(null);
  }, [selectedSlot, lifetime.profileName]);

  useEffect(() => {
    if (lifetime.profileCreated && registerTitles && reconcileProfileTitleFromSnapshot(
      selectedSlot,
      snapshot.rawEquippedTitle,
      lifetime,
      registerTitles,
    )) {
      refresh((value) => value + 1);
    }
  }, [selectedSlot, snapshot, lifetime, registerTitles]);

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

  const chooseTitle = (id: ProfileTitleId | null) => {
    if (registerTitles && selectProfileTitleFromSnapshot(selectedSlot, id, lifetime, registerTitles)) {
      refresh((value) => value + 1);
    }
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

  const words = lifetime.unlockAllApplied ? lexicon.size : Object.keys(snapshot.collection).length;
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
  const worldComplete = isProfileWorldComplete(selectedSlot, lexicon, snapshot);
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

      <div className="profile-identity">
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
        <small className="profile-equipped-title">
          {equippedTitle
            ? t(equippedTitle.localeKey)
            : t('profile.title.none')}
        </small>
      </div>

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
          {registerTitles && (
            <div className="profile-register-titles">
              <div className="profile-register-title-head">
                <span>{t('profile.registerTitles')}</span>
                {registerTitles.god && (
                  <button
                    type="button"
                    className={equippedTitle?.id === GOD_TITLE_DEF.id ? 'selected' : ''}
                    aria-pressed={equippedTitle?.id === GOD_TITLE_DEF.id}
                    onClick={() => chooseTitle(GOD_TITLE_DEF.id)}
                  >
                    {t(GOD_TITLE_DEF.localeKey)}
                  </button>
                )}
              </div>
              {REGISTER_TITLE_SUITS.map((suit) => {
                const title = registerTitles.registers[suit];
                const progressText = title.complete
                  ? t('profile.registerTitle.complete')
                  : title.next === 'all'
                    ? t('profile.registerTitle.progressAll', { found: title.discovered })
                    : t('profile.registerTitle.progress', {
                        found: title.discovered,
                        next: title.next ?? 0,
                      });
                return (
                  <button
                    type="button"
                    className={[
                      'profile-register-title', suit,
                      equippedTitle?.suit === suit ? 'selected' : '',
                    ].filter(Boolean).join(' ')}
                    key={suit}
                    aria-expanded={openRegister === suit}
                    onClick={() => setOpenRegister(openRegister === suit ? null : suit)}
                  >
                    <span>{t(`suit.${suit}`)}</span>
                    <strong>{title.tier === null
                      ? t('profile.registerTitle.none')
                      : t(`profile.registerTitle.${suit}.${title.tier}`)}</strong>
                    <small>{progressText}</small>
                  </button>
                );
              })}
              {openRegister && (
                <fieldset
                  className="profile-title-drawer"
                  aria-label={t('profile.title.select')}
                >
                  <label>
                    <input
                      type="radio"
                      name={`profile-title-${selectedSlot}`}
                      value=""
                      checked={equippedTitle === null}
                      autoFocus={equippedTitle === null || equippedTitle.suit !== openRegister}
                      onChange={() => chooseTitle(null)}
                    />
                    <span>{t('profile.title.none')}</span>
                  </label>
                  {registerTitleDefs(openRegister)
                    .filter((definition) => (
                      registerTitles.registers[openRegister].tier !== null
                      && definition.tier <= registerTitles.registers[openRegister].tier!
                    ))
                    .map((definition) => (
                      <label key={definition.id}>
                        <input
                          type="radio"
                          name={`profile-title-${selectedSlot}`}
                          value={definition.id}
                          checked={equippedTitle?.id === definition.id}
                          autoFocus={equippedTitle?.id === definition.id}
                          onChange={() => chooseTitle(definition.id)}
                        />
                        <span>{t(definition.localeKey)}</span>
                      </label>
                    ))}
                </fieldset>
              )}
            </div>
          )}
        </div>

        <div className="profile-actions">
          <div className="profile-balance">
            <span>{t('profile.wins')}: <strong>{lifetime.wins}</strong></span>
            <span>{t('profile.bestRoundScore')}: <strong>{
              lifetime.bestRoundScore ? formatScore(lifetime.bestRoundScore) : '—'
            }</strong></span>
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
