import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Play screen (slice ⑥). Engine stays headless; the UI is the only browser layer.
export default defineConfig({
  // Relative asset paths so the build runs from any subpath AND from file://
  // (the desktop shell loads dist/index.html directly). Covers itch.io, which
  // serves HTML5 games from html.itch.zone/html/<id>/, and the gh-pages /D1/
  // subpath. Never make this absolute — it breaks the desktop build silently.
  base: './',
  plugins: [react()],
  test: {
    // Vitest 4 no longer excludes `dist` by default. `tsc -b` used to emit
    // compiled copies of every test into it (same `outDir` as the Vite bundle),
    // and the suite then ran each test TWICE — once from source, once from a
    // stale build — producing failures that vanished after `rm -rf dist`.
    // `npm run build` now typechecks with `--noEmit` so nothing lands there,
    // and this keeps a stray build from ever re-creating the phantom run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
});
