import { unseenCount } from '../collection';
import { audio } from '../audio';
import { useI18n } from '../i18n';

interface Props {
  onPlay: () => void;
  onCollection: () => void;
  onOptions: () => void;
}

/** Main Menu (spec §2.1). Our own logotype; Quit is hidden on web. */
export function MainMenu({ onPlay, onCollection, onOptions }: Props) {
  const { t, lang, setLang } = useI18n();
  const unseen = unseenCount();

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
          className="btn play big"
          onClick={() => { audio.play('buttonPress'); onPlay(); }}
          autoFocus
        >
          {t('menu.play')}
        </button>
        <button
          className="btn exchange"
          onClick={() => { audio.play('buttonPress'); onOptions(); }}
        >
          {t('menu.options')}
        </button>
        <button
          className="btn exchange badge-host"
          onClick={() => { audio.play('buttonPress'); onCollection(); }}
        >
          {t('menu.collection')}
          {unseen > 0 && <span className="badge" aria-label={t('menu.newBadge')}>!</span>}
        </button>
      </div>

      <div className="menu-foot">
        <span className="profile-chip" title={t('menu.profileHint')}>
          👤 P1
        </span>
        <button className="langbtn" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
          {t('lang.toggle')}
        </button>
      </div>
    </div>
  );
}
