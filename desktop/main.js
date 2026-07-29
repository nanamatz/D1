/**
 * Electron main process.
 *
 * Opens one window and loads the built web app over file://. Imports NO game
 * code — the dependency direction is one-way (desktop/ -> dist/). Game rules
 * and UI policy do not belong here.
 *
 * The board scales itself: src/ui/styles/tokens.css computes --fit-scale from
 * the viewport against a 1440x912 design board, capped at 1. So this file only
 * chooses window sizes; it never touches layout.
 */
import { app, BrowserWindow, Menu, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSaveStore } from './save-store.js';
import { MIN_SIZE, loadState, restoreBounds, saveState } from './window-state.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** localStorage lives in %APPDATA%/<appName>/. Renaming this orphans every save. */
app.setName('Play the World');

/** Matches the game's dark background so no white flash shows before first paint. */
const BACKGROUND = '#141018';

function createWindow() {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const saved = loadState(stateFile);
  const bounds = restoreBounds(saved, screen.getAllDisplays(), screen.getPrimaryDisplay().workArea);

  const win = new BrowserWindow({
    ...bounds,
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

  if (saved?.maximized) win.maximize();
  if (saved?.fullScreen) win.setFullScreen(true);

  // Persist on close rather than on every resize: getNormalBounds() returns the
  // restored (un-maximized) bounds, so a maximized window still remembers its
  // real size for when it is restored.
  win.on('close', () => {
    saveState(stateFile, {
      ...win.getNormalBounds(),
      maximized: win.isMaximized(),
      fullScreen: win.isFullScreen(),
    });
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(DIR, '..', 'dist', 'index.html'));

  return win;
}

app.whenReady().then(() => {
  // Player progress lives in <userData>/saves/, NOT the userData root, which is
  // full of Chromium's own Cache/Local Storage/GPUCache directories. This folder
  // is what Steam Cloud will point at.
  const saves = createSaveStore(path.join(app.getPath('userData'), 'saves'));

  // Registered before createWindow: the preload calls wj:load synchronously.
  ipcMain.on('wj:load', (event) => {
    event.returnValue = { snapshot: saves.snapshot(), fresh: saves.fresh };
  });
  ipcMain.on('wj:write', (_event, key, json) => saves.set(key, json));
  ipcMain.on('wj:remove', (_event, key) => saves.remove(key));

  // Writes are debounced; make sure the last action reaches disk.
  app.on('before-quit', () => saves.flush());

  const win = createWindow();

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
