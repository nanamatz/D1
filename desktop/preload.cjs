/**
 * Storage and window bridge. The ONLY thing the renderer gets beyond the DOM.
 *
 * Must be .cjs: the repo is "type": "module", but a sandboxed preload has to be
 * CommonJS — Electron does not support an ESM preload when sandbox: true.
 *
 * The snapshot is fetched synchronously because reads in the UI are synchronous
 * (readTips, mascotSrc and loadCollection run during render). One blocking call
 * before page load is not perceptible; every write afterwards is fire-and-forget.
 */
const { contextBridge, ipcRenderer } = require('electron');

const loaded = ipcRenderer.sendSync('wj:load');

contextBridge.exposeInMainWorld('wj', {
  snapshot: loaded.snapshot,
  fresh: loaded.fresh,
  steamStatus: loaded.steamStatus,
  languageHint: loaded.languageHint,
  write: (key, json) => ipcRenderer.send('wj:write', key, json),
  remove: (key) => ipcRenderer.send('wj:remove', key),
  syncSteam: (payload) => ipcRenderer.send('wj:steam-sync', payload),
  decideSteamClaim: (decision) => ipcRenderer.send('wj:steam-claim', decision),
  onSteamStatus: (listener) => {
    ipcRenderer.on('wj:steam-status', (_event, status) => listener(status));
  },
  onSaveStatus: (listener) => {
    ipcRenderer.on('wj:save-status', (_event, ok) => listener(ok));
  },
  getWindowVideoState: () => ipcRenderer.invoke('wj:window-video:get'),
  setWindowResolution: (id) => ipcRenderer.invoke('wj:window-video:set-resolution', id),
  setWindowFullscreen: (enabled) => ipcRenderer.invoke('wj:window-video:set-fullscreen', enabled),
  onWindowVideoState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('wj:window-video-state', handler);
    return () => ipcRenderer.removeListener('wj:window-video-state', handler);
  },
});
