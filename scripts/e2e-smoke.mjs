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
    height: 966,
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

  async function assertNoDocumentScroll(label) {
    const dimensions = await evaluate(`({
      viewport: document.documentElement.clientHeight,
      content: document.documentElement.scrollHeight,
    })`);
    if (dimensions.content > dimensions.viewport) {
      throw new Error(`${label} scrolled: ${dimensions.content}px > ${dimensions.viewport}px`);
    }
  }

  async function assertContained(selector, containerSelector, label) {
    const bounds = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const container = document.querySelector(${JSON.stringify(containerSelector)});
      if (!(element instanceof HTMLElement) || !(container instanceof HTMLElement)) return null;
      const inner = element.getBoundingClientRect();
      const outer = container.getBoundingClientRect();
      return { inner: { left: inner.left, right: inner.right }, outer: { left: outer.left, right: outer.right } };
    })()`);
    if (!bounds) throw new Error(`${label}: missing layout element`);
    if (bounds.inner.left < bounds.outer.left - 1 || bounds.inner.right > bounds.outer.right + 1) {
      throw new Error(`${label}: ${JSON.stringify(bounds)}`);
    }
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
    win.setContentSize(1366, 768);
    await delay(200);
    await assertNoDocumentScroll('Playing board at 100% UI scale');
    await evaluate(`document.documentElement.style.setProperty('--ui-scale', '1.2')`);
    await assertNoDocumentScroll('Playing board at 120% UI scale');
    await evaluate(`document.documentElement.style.setProperty('--ui-scale', '1')`);

    // Force a reproducible two-word Simple pattern. The live pattern line appears
    // only after RUN and must not make the fixed board taller or add a scrollbar.
    await evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem('wj.run'));
      const letters = ['I', 'R', 'U', 'N'];
      envelope.state.blind.hand = envelope.state.blind.hand.map((tile, index) => {
        if (index >= letters.length) return tile;
        const next = {
          ...tile,
          id: 'smoke-' + letters[index].toLowerCase(),
          letter: letters[index],
          material: 'ceramic',
          font: 'medium',
          edition: 'base'
        };
        delete next.storedLetter;
        return next;
      });
      localStorage.setItem('wj.run', JSON.stringify(envelope));
    })()`);
    await page.reload();
    await waitFor(`document.querySelector('.menu-play')`, 'menu after pattern fixture');
    await click('.menu-play');
    await waitFor(`document.querySelector('.continue-card')`, 'pattern fixture Continue card');
    await click('.newrun .play-run');
    await waitFor(`document.querySelector('[data-tile-id="smoke-i"]')`, 'pattern fixture hand');

    const scoreBefore = await evaluate(`document.querySelector('.round-num')?.textContent`);
    await click('[data-tile-id="smoke-i"]');
    await waitFor(`document.querySelector('.play-btn:not(:disabled)')`, 'enabled Play');
    await click('.play-btn');
    await waitFor(
      `document.querySelector('.round-num')?.textContent !== ${JSON.stringify(scoreBefore)}`,
      'score settlement',
    );
    await waitFor(`document.querySelector('.scorebox:not(.settling)')`, 'first settlement complete');

    await click('[data-tile-id="smoke-r"]');
    await click('[data-tile-id="smoke-u"]');
    await click('[data-tile-id="smoke-n"]');
    await waitFor(`document.querySelector('.play-btn:not(:disabled)')`, 'enabled second Play');
    await click('.play-btn');
    await waitFor(`document.querySelector('.round-pattern')`, 'live Simple pattern');
    await assertNoDocumentScroll('Playing board after second word forms a pattern');
    await waitFor(`localStorage.getItem('wj.run')?.includes('"runStarted":true')`, 'run save');
    await evaluate(`(() => {
      const envelope = JSON.parse(localStorage.getItem('wj.run'));
      const ids = ['alphabetSoup', 'acrosticPoet', 'alliterationSticker', 'alphabetPress',
        'alphabeticalOrder', 'anonymous', 'assonance', 'badReview'];
      const editions = ['base', 'gray', 'violet', 'rainbow', 'white'];
      envelope.state.run.jokers = ids.map((defId, index) => ({
        defId,
        edition: editions[index % editions.length],
        state: {}
      }));
      envelope.state.run.jokerSlots = ids.length;
      envelope.state.blind.jokersFaceDown = true;
      localStorage.setItem('wj.run', JSON.stringify(envelope));
    })()`);

    // Reload -> Continue restores an over-five shelf without widening the board.
    await page.reload();
    await waitFor(`document.querySelector('.menu-play')`, 'menu after reload');
    await click('.menu-play');
    await waitFor(`document.querySelector('.continue-card')`, 'Continue card');
    await click('.newrun .play-run');
    await waitFor(`document.querySelector('.hand [data-tile-id]')`, 'restored run');
    await waitFor(`document.querySelectorAll('.joker.face-down').length === 8`, 'eight face-down Emoji Tiles');
    await waitFor(`document.querySelector('.jokers.jokers-overlap')`, 'overlapping Emoji Tile shelf');
    const uniformCardBacks = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.joker.face-down')];
      return cards.length === 8
        && cards.every((card) => ![...card.classList].some((name) => name.startsWith('edition-')))
        && new Set(cards.map((card) => card.querySelector('.joker-back-mascot')?.getAttribute('src'))).size === 1;
    })()`);
    if (!uniformCardBacks) throw new Error('Face-down Emoji Tiles retained edition-specific presentation');
    const overlapLayout = await evaluate(`(() => {
      const shelf = document.querySelector('.jokers.jokers-overlap');
      const cards = [...document.querySelectorAll('.jokers.jokers-overlap .joker')];
      if (!(shelf instanceof HTMLElement) || cards.length !== 8) return null;
      const outer = shelf.getBoundingClientRect();
      const rects = cards.map((card) => card.getBoundingClientRect());
      const steps = rects.slice(1).map((rect, index) => rect.left - rects[index].left);
      return {
        contained: rects[0].left >= outer.left - 1 && rects.at(-1).right <= outer.right + 1,
        fixedWidth: Math.max(...rects.map((rect) => rect.width)) - Math.min(...rects.map((rect) => rect.width)) < 1,
        overlapping: steps.every((step) => step > 0 && step < rects[0].width),
        even: Math.max(...steps) - Math.min(...steps) < 1
      };
    })()`);
    if (!overlapLayout || Object.values(overlapLayout).some((value) => !value)) {
      throw new Error(`Emoji Tile overlap layout failed: ${JSON.stringify(overlapLayout)}`);
    }
    await assertContained('.main', '.frame', 'Eight-card main column');
    await assertContained('.consumables-col', '.frame', 'Eight-card consumable shelf');

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
    await assertContained('.shop2', '.frame', 'Eight-card shop panel');

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

    console.log('E2E smoke OK: Collection -> New Run -> I/RUN pattern -> reload -> Settlement -> Shop -> Pack');
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
