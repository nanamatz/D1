/**
 * Storage bridge. The ONLY thing the renderer gets beyond the DOM.
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
  write: (key, json) => ipcRenderer.send('wj:write', key, json),
  remove: (key) => ipcRenderer.send('wj:remove', key),
});
