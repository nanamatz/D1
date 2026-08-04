/**
 * Capture deterministic Korean screenshots for the submission PDFs.
 *
 * Usage: electron scripts/capture-submission-screenshots.mjs
 * Requires a current dist/ build. The isolated Electron profile is disposable.
 */
import { app, BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'submission', 'assets');
const PROFILE = path.join(ROOT, 'tmp', 'submission-capture-profile');

mkdirSync(OUT, { recursive: true });
app.setPath('userData', PROFILE);
app.commandLine.appendSwitch('disable-gpu');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(page, expression, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await page.executeJavaScript(`Boolean(${expression})`, true)) return;
    } catch {
      // A reload briefly destroys the execution context.
    }
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}

async function click(page, selector) {
  const ok = await page.executeJavaScript(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!(el instanceof HTMLElement)) return false;
    el.click();
    return true;
  })()`, true);
  if (!ok) throw new Error(`Missing clickable element: ${selector}`);
}

async function colorize(page) {
  await page.executeJavaScript(`(() => {
    const root = document.documentElement;
    root.classList.remove('world-mono');
    root.classList.add('unlock-red', 'unlock-yellow', 'unlock-green', 'unlock-blue');
  })()`, true);
  await delay(350);
}

async function capture(page, name) {
  await colorize(page);
  const image = await page.capturePage();
  writeFileSync(path.join(OUT, name), image.toPNG());
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 966,
    show: false,
    backgroundColor: '#141018',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const page = win.webContents;

  await win.loadFile(path.join(ROOT, 'dist', 'index.html'));
  await waitFor(page, `document.querySelector('.menu-play')`, 'main menu');
  await page.executeJavaScript(`(() => {
    localStorage.clear();
    localStorage.setItem('wj.lang', JSON.stringify('ko'));
    localStorage.setItem('wj.tutorialIntro', JSON.stringify(1));
    localStorage.setItem('wj.tutorial', JSON.stringify({}));
    localStorage.setItem('wj.settings', JSON.stringify({
      gameSpeed: 4,
      screenshake: 0,
      reducedMotion: true,
      colorBlind: false,
      tips: false,
      fullscreen: false,
      uiScale: 100,
      master: 0,
      music: 0,
      sfx: 0,
      mascot: 'woodak'
    }));
  })()`, true);
  await page.reload();
  await waitFor(page, `document.querySelector('.menu-play')`, 'configured main menu');
  await capture(page, '01-main-menu.png');

  await click(page, '.menu-play');
  await waitFor(page, `document.querySelector('.newrun .play-run:not(:disabled)')`, 'new run');
  await capture(page, '02-new-run.png');

  await click(page, '.newrun .play-run');
  await waitFor(page, `document.querySelector('.bs-select')`, 'blind select');
  await capture(page, '03-blind-select.png');

  await click(page, '.bs-select');
  await waitFor(page, `document.querySelector('.hand [data-tile-id]')`, 'play board');
  await delay(900);
  await capture(page, '04-play-board.png');

  console.log(`wrote screenshots to ${OUT}`);
  app.quit();
}).catch((error) => {
  console.error('submission screenshot capture failed:', error);
  app.exit(1);
});
