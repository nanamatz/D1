import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Drop the legacy `.woff` fallback from every @font-face `src:`.
 *
 * @fontsource ships each face as `url(x.woff2) format('woff2'), url(x.woff)
 * format('woff')`. A browser only ever fetches the first format it supports, so
 * the `.woff` copies are never requested at runtime — but Vite still resolves
 * the url and emits them, which put 277 unused files and 5.2 MB into `dist` and
 * into the packaged desktop app. WOFF2 has been supported everywhere we ship
 * (and by the Electron shell's Chromium) for years.
 *
 * Applied at `pre` so it runs before Vite's CSS asset resolution sees the urls.
 */
const woff2Only = (): Plugin => ({
  name: 'woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('.css') || !code.includes(".woff)")) return null;
    return { code: code.replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, ''), map: null };
  },
});

// Play screen (slice ⑥). Engine stays headless; the UI is the only browser layer.
export default defineConfig({
  // Relative asset paths so the build runs from any subpath AND from file://
  // (the desktop shell loads dist/index.html directly). Covers itch.io, which
  // serves HTML5 games from html.itch.zone/html/<id>/, and the gh-pages /D1/
  // subpath. Never make this absolute — it breaks the desktop build silently.
  base: './',
  plugins: [woff2Only(), react()],
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
