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

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
