import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { I18nProvider } from './ui/i18n';
// Self-hosted so the desktop build works offline (it has no network and loads
// over file://). Weights mirror what the old Google Fonts <link> requested.
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/jersey-10/400.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/300-italic.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/700.css';
import '@fontsource/jost/900.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './ui/styles/tokens.css';
import './ui/styles/play.css';
import './ui/styles/screens.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
