import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Play screen (slice ⑥). Engine stays headless; the UI is the only browser layer.
export default defineConfig({
  // Relative asset paths so the build runs from any subpath (itch.io serves
  // HTML5 games from html.itch.zone/html/<id>/, not the domain root).
  base: './',
  plugins: [react()],
});
