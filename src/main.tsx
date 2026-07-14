import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { I18nProvider } from './ui/i18n';
import './ui/styles/tokens.css';
import './ui/styles/play.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
