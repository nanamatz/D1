import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = mkdtempSync(path.join(tmpdir(), 'wj-e2e-'));

app.setPath('userData', userData);
app.commandLine.appendSwitch('disable-gpu');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const win = new BrowserWindow({
    width: 1440,
    height: 965,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const page = win.webContents;

  const evaluate = (source) => page.executeJavaScript(source, true);

  async function waitFor(expression, label, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch {
        // Navigation briefly destroys the execution context.
      }
      await delay(100);
    }
    throw new Error(`Timed out: ${label}`);
  }

  async function click(selector) {
    const clicked = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!(element instanceof HTMLElement)) return false;
      element.click();
      return true;
    })()`);
    if (!clicked) throw new Error(`Missing clickable element: ${selector}`);
  }

  try {
    await win.loadFile(path.join(ROOT, 'dist', 'index.html'));
    await waitFor(`document.querySelector('.menu-play')`, 'main menu');
    await evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem('wj.lang', JSON.stringify('en'));
      localStorage.setItem('wj.tutorialIntro', JSON.stringify(1));
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
    })()`);
    await page.reload();
    await waitFor(`document.querySelector('.menu-play')`, 'configured main menu');

    // Menu -> Collection -> one real card gallery.
    await click('.menu-collection');
    await waitFor(`document.querySelector('.cat-fableCards')`, 'collection menu');
    await click('.cat-fableCards');
    await waitFor(
      `document.querySelectorAll('.fable-card-grid .fable-card').length === 10`,
      'Fable gallery',
    );
    const pngRuntime = await evaluate(
      `[...document.querySelectorAll('.fable-card-grid image')]
        .every((image) => image.getAttribute('href')?.includes('-preview-')
          && image.getAttribute('href')?.endsWith('.png'))`,
    );
    if (!pngRuntime) throw new Error('Collection did not use runtime PNG card art');
    await click('.collection-detail-modal .back-bar');
    await click('.collection-menu-modal .back-bar');
    await waitFor(`document.querySelector('.menu-play')`, 'menu after Collection');

    // New Run -> Blind Select -> one actual submission.
    await click('.menu-play');
    await waitFor(`document.querySelector('.newrun .play-run:not(:disabled)')`, 'New Run');
    await click('.newrun .play-run');
    await waitFor(`document.querySelector('.bs-select')`, 'Blind Select');
    await click('.bs-select');
    await waitFor(`document.querySelector('.hand [data-tile-id]')`, 'playing hand');
    const scoreBefore = await evaluate(`document.querySelector('.round-num')?.textContent`);
    await click('.hand [data-tile-id]');
    await waitFor(`document.querySelector('.play-btn:not(:disabled)')`, 'enabled Play');
    await click('.play-btn');
    await waitFor(
      `document.querySelector('.round-num')?.textContent !== ${JSON.stringify(scoreBefore)}`,
      'score settlement',
    );
    await waitFor(`localStorage.getItem('wj.run')?.includes('"runStarted":true')`, 'run save');

    // Reload -> Continue restores same run.
    await page.reload();
    await waitFor(`document.querySelector('.menu-play')`, 'menu after reload');
    await click('.menu-play');
    await waitFor(`document.querySelector('.continue-card')`, 'Continue card');
    await click('.newrun .play-run');
    await waitFor(`document.querySelector('.hand [data-tile-id]')`, 'restored run');

    // Promote saved resting state to a valid settlement fixture. This isolates UI
    // navigation from balance numbers while still exercising real persistence.
    await evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem('wj.run'));
      const state = envelope.state;
      state.phase = 'cashout';
      state.cashout = {
        reward: 3,
        phaseCount: 1,
        phases: 1,
        discardCount: 0,
        discards: 0,
        interest: 0,
        total: 4
      };
      state.pendingRun = { ...state.run, gold: 999 };
      state.shop = {
        items: [],
        voucher: null,
        packs: [{ type: 'consumable', size: 'normal', artVariant: 0 }],
        rerolls: 0
      };
      localStorage.setItem('wj.run', JSON.stringify(envelope));
    })()`);
    await page.reload();
    await waitFor(`document.querySelector('.menu-play')`, 'menu before settlement');
    await click('.menu-play');
    await waitFor(`document.querySelector('.continue-card')`, 'settlement Continue card');
    await click('.newrun .play-run');
    await waitFor(`document.querySelector('.cashout-overlay')`, 'Fee Settlement');
    await click('.cashout .btn.cash');
    await waitFor(`document.querySelector('.shop2')`, 'shop');

    // Shop -> buy/open one real pack.
    await evaluate(`document.querySelector('.shop2 .pack-img')
      ?.closest('.shop-offer')
      ?.querySelector('.shop-offer-select')
      ?.click()`);
    await waitFor(
      `document.querySelector('.shop2 .shop-offer.selected .shop-offer-action button:not(:disabled)')`,
      'pack Open action',
    );
    await click('.shop2 .shop-offer.selected .shop-offer-action button');
    await waitFor(`document.querySelector('.pack-phase-panel')`, 'opened pack');

    console.log('E2E smoke OK: Collection -> New Run -> Play -> reload -> Settlement -> Shop -> Pack');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode ?? 0);
  }
}

app.whenReady().then(run).catch((error) => {
  console.error(error);
  app.exit(1);
});
