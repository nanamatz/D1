import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LANGUAGES, useI18n } from '../i18n';
import { activeProfile } from '../storage';
import type { Lexicon } from '../../engine/lexicon';
import { loadMainMenuProfileBase } from '../profile';

interface Props {
  lexicon: Lexicon | null;
  onPlay: () => void;
  onCollection: () => void;
  onOptions: () => void;
  onProfile: () => void;
  onDeskLab: () => void;
}

const languageLabel = (label: string) => label.replace(' (', '\n(');

/** Main Menu (spec §2.1). Our own logotype. */
export function MainMenu({
  onPlay, onCollection, onOptions, onProfile, onDeskLab,
}: Props) {
  const { t, lang, setLang } = useI18n();
  const slot = activeProfile();
  const profile = useMemo(() => loadMainMenuProfileBase(slot), [slot]);
  const [quit, setQuit] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (languageOpen && !languageDialog.current?.open) languageDialog.current?.showModal();
  }, [languageOpen]);

  // Quit: try to close the window (works in a script-opened window or a desktop
  // app shell); browsers block that for a normally-navigated tab, so we always
  // show a farewell screen too — the game ends cleanly either way.
  const onQuit = () => {
    setQuit(true);
    window.close();
  };

  if (quit) {
    return (
      <div className="screen menu quit-farewell">
        <div className="logotype" aria-label="Play the Wor!d">
          <span className="lt-play">Play the</span>
          <span className="lt-title">
            Wor<span className="lt-bang">!</span>d
          </span>
        </div>
        <p className="quit-title">{t('menu.quitTitle')}</p>
        <p className="quit-body">{t('menu.quitBody')}</p>
      </div>
    );
  }

  return (
    <div className="screen menu">
      <div className="logotype" aria-label="Play the Wor!d">
        <span className="lt-play">Play the</span>
        <span className="lt-title">
          Wor<span className="lt-bang">!</span>d
        </span>
      </div>

      <div className="menu-buttons">
        <button
          className="btn play big menu-play"
          onClick={onPlay}
          autoFocus
        >
          {t('menu.play')}
        </button>
        <button
          className="btn menu-options"
          onClick={onOptions}
        >
          {t('menu.options')}
        </button>
        <button
          className="btn menu-collection badge-host"
          onClick={onCollection}
        >
          {t('menu.collection')}
          {profile.unseen > 0 && <span className="badge" aria-label={t('menu.newBadge')}>!</span>}
        </button>
        {import.meta.env.DEV && (
          <button className="btn menu-desk-lab" onClick={onDeskLab}>
            {t('menu.deskLab')}
          </button>
        )}
        <button className="btn menu-quit" onClick={onQuit}>
          {t('menu.quit')}
        </button>
      </div>

      <div className="menu-foot">
        <div className="menu-mini-card profile">
          <span className="menu-mini-label">{t('menu.profile')}</span>
          <button
            className="btn menu-mini-button"
            title={`${t('menu.profileHint')}: ${profile.name}`}
            onClick={onProfile}
          >
            <span>{profile.name}</span>
          </button>
        </div>
        <div className="menu-mini-card language">
          <button
            className="btn menu-mini-button"
            onClick={() => setLanguageOpen(true)}
            aria-haspopup="dialog"
          >
            <span>{languageLabel(LANGUAGES.find(({ id }) => id === lang)!.label)}</span>
          </button>
        </div>
      </div>

      {languageOpen && createPortal(
        <dialog
          ref={languageDialog}
          className="language-modal"
          aria-labelledby="language-modal-title"
          onClose={() => setLanguageOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
        >
          <h2 id="language-modal-title">{t('settings.language')}</h2>
          <div className="language-grid">
            {LANGUAGES.map((choice) => (
              <button
                key={choice.id}
                className="btn language-choice"
                aria-pressed={lang === choice.id}
                autoFocus={lang === choice.id}
                onClick={() => {
                  if (choice.id === lang) return;
                  setLang(choice.id);
                  window.location.reload();
                }}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <button className="btn gold back-bar" onClick={() => languageDialog.current?.close()}>
            {t('common.back')}
          </button>
        </dialog>,
        document.body,
      )}
    </div>
  );
}
