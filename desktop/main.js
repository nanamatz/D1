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
import { app, BrowserWindow, Menu, globalShortcut, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** localStorage lives in %APPDATA%/<appName>/. Renaming this orphans every save. */
app.setName('Play the World');

/** Design board is 1440x912; at this size --fit-scale reads exactly 1 (it is min(1, ...)). */
const DEFAULT_SIZE = { width: 1600, height: 1000 };
/** Below this --fit-scale bottoms out near 0.66 and the pixel font stops being legible. */
const MIN_SIZE = { width: 960, height: 600 };

/** Matches the game's dark background so no white flash shows before first paint. */
const BACKGROUND = '#141018';

function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    width: Math.min(DEFAULT_SIZE.width, workAreaSize.width),
    height: Math.min(DEFAULT_SIZE.height, workAreaSize.height),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Without this a File/Edit/View menu appears and hands players Ctrl+R and DevTools.
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(DIR, '..', 'dist', 'index.html'));

  return win;
}

app.whenReady().then(() => {
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
