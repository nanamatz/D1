/**
 * Electron main process.
 *
 * Opens one window and loads the built web app over file://. Imports NO game
 * code — the dependency direction is one-way (desktop/ -> dist/). Game rules
 * and UI policy do not belong here.
 *
 * The board scales itself: src/ui/styles/tokens.css computes --fit-scale from
 * the viewport against a 1440x988 design board. So this file only
 * chooses window sizes; it never touches layout.
 */
import { app, BrowserWindow, Menu, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSaveStore } from './save-store.js';
import { initializeSteamSync, validateSteamPayload } from './steam-achievements.js';
import { createSteamOwnershipController } from './steam-ownership.js';
import {
  MIN_SIZE,
  RESOLUTION_PRESETS,
  centeredOuterBounds,
  loadState,
  presetFitsWorkArea,
  resolutionPreset,
  restoreBounds,
  saveState,
} from './window-state.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** Electron userData is keyed by appName. Renaming this orphans every save. */
app.setName('Play the World');

// The pre-game Sweet Turtles ident is the sole ungestured audio path. This
// must be registered before app readiness and BrowserWindow construction.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** Matches the game's dark background so no white flash shows before first paint. */
const BACKGROUND = '#141018';

function ownsMainFrame(event, win) {
  return event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
}

function installWindowVideoBridge(win) {
  const readContentSize = () => {
    const [width, height] = win.getContentSize();
    return { width, height };
  };
  const readFrameSize = () => {
    const [outerWidth, outerHeight] = win.getSize();
    const content = readContentSize();
    return {
      width: Math.max(0, outerWidth - content.width),
      height: Math.max(0, outerHeight - content.height),
    };
  };

  let windowedContentSize = readContentSize();
  let windowFrameSize = readFrameSize();
  const updateWindowedGeometry = () => {
    if (win.isMaximized() || win.isFullScreen()) return;
    windowedContentSize = readContentSize();
    windowFrameSize = readFrameSize();
  };
  const currentDisplay = () => screen.getDisplayMatching(win.getBounds());
  const state = () => {
    updateWindowedGeometry();
    const workArea = currentDisplay().workArea;
    return {
      width: windowedContentSize.width,
      height: windowedContentSize.height,
      fullscreen: win.isFullScreen(),
      maximized: win.isMaximized(),
      availablePresetIds: Object.entries(RESOLUTION_PRESETS)
        .filter(([, size]) => presetFitsWorkArea(size, workArea, windowFrameSize))
        .map(([id]) => id),
    };
  };

  const initialWorkArea = currentDisplay().workArea;
  const fittedContent = {
    width: Math.max(MIN_SIZE.width, Math.min(
      windowedContentSize.width,
      initialWorkArea.width - windowFrameSize.width,
    )),
    height: Math.max(MIN_SIZE.height, Math.min(
      windowedContentSize.height,
      initialWorkArea.height - windowFrameSize.height,
    )),
  };
  if (fittedContent.width !== windowedContentSize.width
    || fittedContent.height !== windowedContentSize.height) {
    win.setContentSize(fittedContent.width, fittedContent.height, false);
    updateWindowedGeometry();
    const centered = centeredOuterBounds(windowedContentSize, initialWorkArea, windowFrameSize);
    win.setPosition(centered.x, centered.y, false);
  }

  let notificationPending = false;
  const notify = () => {
    if (notificationPending) return;
    notificationPending = true;
    setImmediate(() => {
      notificationPending = false;
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send('wj:window-video-state', state());
      }
    });
  };

  ipcMain.handle('wj:window-video:get', (event) => (
    ownsMainFrame(event, win) ? state() : null
  ));
  ipcMain.handle('wj:window-video:set-resolution', (event, id) => {
    if (!ownsMainFrame(event, win) || win.isFullScreen()) return false;
    const preset = resolutionPreset(id);
    if (!preset) return false;

    const workArea = currentDisplay().workArea;
    if (!presetFitsWorkArea(preset, workArea, windowFrameSize)) return false;
    if (win.isMaximized()) win.unmaximize();
    win.setContentSize(preset.width, preset.height, false);
    updateWindowedGeometry();
    const centered = centeredOuterBounds(preset, workArea, windowFrameSize);
    win.setPosition(centered.x, centered.y, false);
    updateWindowedGeometry();
    notify();
    return true;
  });
  ipcMain.handle('wj:window-video:set-fullscreen', (event, enabled) => {
    if (!ownsMainFrame(event, win) || typeof enabled !== 'boolean') return false;
    if (win.isFullScreen() !== enabled) win.setFullScreen(enabled);
    notify();
    return true;
  });

  const windowEvent = () => {
    updateWindowedGeometry();
    notify();
  };
  for (const eventName of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    win.on(eventName, windowEvent);
  }
  screen.on('display-added', notify);
  screen.on('display-removed', notify);
  screen.on('display-metrics-changed', notify);

  win.once('closed', () => {
    screen.off('display-added', notify);
    screen.off('display-removed', notify);
    screen.off('display-metrics-changed', notify);
    ipcMain.removeHandler('wj:window-video:get');
    ipcMain.removeHandler('wj:window-video:set-resolution');
    ipcMain.removeHandler('wj:window-video:set-fullscreen');
  });

  return { windowedContentSize: () => windowedContentSize };
}

function createWindow() {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const saved = loadState(stateFile);
  const bounds = restoreBounds(saved, screen.getAllDisplays(), screen.getPrimaryDisplay().workArea);

  const win = new BrowserWindow({
    ...bounds,
    // Packaged builds take the icon from the exe (electron-builder win.icon);
    // this is what gives `npm run desktop:run` the same one instead of Electron's.
    ...(process.platform === 'win32' ? { icon: path.join(DIR, 'icon.ico') } : {}),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(DIR, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Without this a File/Edit/View menu appears and hands players Ctrl+R and DevTools.
  Menu.setApplicationMenu(null);

  const windowVideo = installWindowVideoBridge(win);

  if (saved?.maximized) win.maximize();
  if (saved?.fullScreen) win.setFullScreen(true);

  // Persist on close rather than on every resize: getNormalBounds() returns the
  // restored (un-maximized) bounds, so a maximized window still remembers its
  // real size for when it is restored.
  win.on('close', () => {
    const normal = win.getNormalBounds();
    const content = windowVideo.windowedContentSize();
    saveState(stateFile, {
      x: normal.x,
      y: normal.y,
      width: content.width,
      height: content.height,
      maximized: win.isMaximized(),
      fullScreen: win.isFullScreen(),
    });
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(DIR, '..', 'dist', 'index.html'));

  return win;
}

app.whenReady().then(async () => {
  // Player progress lives in <userData>/saves/, NOT the userData root, which is
  // full of Chromium's own Cache/Local Storage/GPUCache directories. This folder
  // is what Steam Cloud will point at.
  let win;
  const saves = createSaveStore(
    path.join(app.getPath('userData'), 'saves'),
    (ok) => win?.webContents.send('wj:save-status', ok),
  );
  const steamSession = await initializeSteamSync({
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
  });
  const steamOwnership = createSteamOwnershipController({
    session: steamSession,
    store: saves,
    onState: (state) => win?.webContents.send('wj:steam-status', state),
  });

  // Registered before createWindow: the preload calls wj:load synchronously.
  ipcMain.on('wj:load', (event) => {
    event.returnValue = {
      snapshot: saves.snapshot(),
      fresh: saves.fresh,
      steamStatus: steamOwnership.state(),
      languageHint: steamSession?.languageHint,
    };
  });
  ipcMain.on('wj:write', (_event, key, json) => saves.set(key, json));
  ipcMain.on('wj:remove', (_event, key) => saves.remove(key));

  ipcMain.on('wj:steam-sync', (event, payload) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return;
    if (!validateSteamPayload(payload)) return;
    steamOwnership.submit(payload);
  });
  ipcMain.on('wj:steam-claim', (event, decision) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return;
    if (decision === 'accept') steamOwnership.accept();
    else if (decision === 'decline') steamOwnership.decline();
  });

  // Writes are debounced; make sure the last action reaches disk.
  app.on('before-quit', () => {
    saves.flush();
    void steamOwnership.flush();
  });

  win = createWindow();

  globalShortcut.register('F11', () => {
    win.setFullScreen(!win.isFullScreen());
  });

  if (!app.isPackaged) {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      win.webContents.toggleDevTools();
    });
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
