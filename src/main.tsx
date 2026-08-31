import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { I18nProvider } from './ui/i18n';
// Self-hosted so the desktop build works offline (it has no network and loads
// over file://). Weights mirror what the old Google Fonts <link> requested.
//
// SUBSET-SPECIFIC imports, not the bare `500.css` aggregates. The aggregates
// pull EVERY unicode subset @fontsource publishes — Devanagari and Vietnamese
// for Baloo, Cyrillic for Jost, Cyrillic/Vietnamese/latin-ext for Noto Sans KR —
// which is how the build ended up shipping 554 font files. The game renders
// English and Korean only, so it needs `latin` everywhere plus `korean` on Noto.
// Adding a language means adding its subset here, deliberately.
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/jersey-10/latin-400.css';
import '@fontsource/jost/latin-300.css';
import '@fontsource/jost/latin-300-italic.css';
import '@fontsource/jost/latin-500.css';
import '@fontsource/jost/latin-700.css';
import '@fontsource/jost/latin-900.css';
// Noto Sans KR is the Korean half of the `--ctl-font` stack; it also supplies
// the latin fallback when Baloo/Jost are still loading.
import '@fontsource/noto-sans-kr/korean-500.css';
import '@fontsource/noto-sans-kr/korean-700.css';
import '@fontsource/noto-sans-kr/latin-500.css';
import '@fontsource/noto-sans-kr/latin-700.css';
import './ui/styles/tokens.css';
import './ui/styles/play.css';
import './ui/styles/screens.css';
import './ui/styles/cursor.css';
import { initializeSteamAchievements } from './ui/lifetime';
import { shouldShowMobileGitHubPagesNotice } from './ui/mobileGate';
import woodak from './ui/assets/woodak.png';

function MobileGitHubPagesNotice() {
  return (
    <main className="mobile-gh-notice" aria-labelledby="mobile-gh-notice-title">
      <div className="mobile-gh-notice__content">
        <p className="mobile-gh-notice__edition">DESKTOP PLAY</p>
        <h1 id="mobile-gh-notice-title" className="mobile-gh-notice__title">
          <span>PLAY THE</span>
          <strong>WOR!D</strong>
        </h1>
        <img className="mobile-gh-notice__mascot" src={woodak} alt="" aria-hidden="true" />
        <p className="mobile-gh-notice__headline" lang="ko">
          데스크톱에서 플레이할 수 있어요
        </p>
        <p className="mobile-gh-notice__copy" lang="ko">
          데스크톱 브라우저에서 이 페이지를 다시 열어주세요.
        </p>
        <p className="mobile-gh-notice__copy mobile-gh-notice__copy--en" lang="en">
          Open this page on a desktop browser to play.
        </p>
      </div>
    </main>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
const showMobileNotice = shouldShowMobileGitHubPagesNotice(
  window.location.hostname,
  window.navigator.userAgent,
  window.navigator.maxTouchPoints,
);
rootEl.classList.toggle('mobile-gh-notice-root', showMobileNotice);
if (!showMobileNotice) initializeSteamAchievements();
createRoot(rootEl).render(
  <StrictMode>
    {showMobileNotice ? (
      <MobileGitHubPagesNotice />
    ) : (
      <I18nProvider>
        <App />
      </I18nProvider>
    )}
  </StrictMode>,
);
