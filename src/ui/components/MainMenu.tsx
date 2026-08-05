import { useState } from 'react';
import { unseenCount } from '../collection';
import { useI18n } from '../i18n';
import { loadLifetime } from '../lifetime';
import { activeProfile } from '../storage';

interface Props {
  onPlay: () => void;
  onCollection: () => void;
  onOptions: () => void;
  onProfile: () => void;
  onDeskLab: () => void;
}

/** Main Menu (spec §2.1). Our own logotype. */
export function MainMenu({ onPlay, onCollection, onOptions, onProfile, onDeskLab }: Props) {
  const { t, lang, setLang } = useI18n();
  const unseen = unseenCount();
  const slot = activeProfile();
  const profileName = loadLifetime(slot).profileName || `P${slot}`;
  const [quit, setQuit] = useState(false);

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
          {unseen > 0 && <span className="badge" aria-label={t('menu.newBadge')}>!</span>}
        </button>
        <button className="btn menu-desk-lab" onClick={onDeskLab}>
          {t('menu.deskLab')}
        </button>
        <button className="btn menu-quit" onClick={onQuit}>
          {t('menu.quit')}
        </button>
      </div>

      <div className="menu-foot">
        <div className="menu-mini-card profile">
          <span className="menu-mini-label">{t('menu.profile')}</span>
          <button
            className="btn menu-mini-button"
            title={`${t('menu.profileHint')}: ${profileName}`}
            onClick={onProfile}
          >
            {profileName}
          </button>
        </div>
        <div className="menu-mini-card language">
          <button
            className="btn menu-mini-button"
            onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
          >
            <span>{lang === 'ko' ? '한국어' : 'English'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
