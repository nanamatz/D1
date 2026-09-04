import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  WINDOW_RESOLUTION_PRESETS,
  selectedWindowResolution,
  type WindowVideoState,
} from '../src/ui/windowVideo';

const state = (width: number, height: number): WindowVideoState => ({
  width,
  height,
  fullscreen: false,
  maximized: false,
  availablePresetIds: WINDOW_RESOLUTION_PRESETS.map(({ id }) => id),
});

describe('window video bridge', () => {
  it('keeps the renderer choices aligned with the main-process whitelist', () => {
    expect(WINDOW_RESOLUTION_PRESETS.map(({ id, width, height }) => [id, width, height])).toEqual([
      ['960x600', 960, 600],
      ['1280x800', 1280, 800],
      ['1600x900', 1600, 900],
      ['1920x1080', 1920, 1080],
    ]);
  });

  it('classifies exact presets and manual window sizes', () => {
    expect(selectedWindowResolution(state(1600, 900))).toBe('1600x900');
    expect(selectedWindowResolution(state(1437, 887))).toBeNull();
  });

  it('validates main-frame IPC and never resizes a browser window', () => {
    const main = readFileSync('desktop/main.js', 'utf8');
    const preload = readFileSync('desktop/preload.cjs', 'utf8');
    const ui = readFileSync('src/ui/windowVideo.ts', 'utf8');
    const options = readFileSync('src/ui/components/Options.tsx', 'utf8');
    const settings = readFileSync('src/ui/settings.ts', 'utf8');

    expect(main).toContain('event.sender === win.webContents');
    expect(main).toContain('event.senderFrame === win.webContents.mainFrame');
    expect(main).toContain('resolutionPreset(id)');
    expect(main).toContain('win.setContentSize(preset.width, preset.height, false)');
    expect(main).toContain('if (win.isMaximized()) win.unmaximize()');
    expect(main).toContain('win.setPosition(centered.x, centered.y, false)');
    expect(preload).toContain("ipcRenderer.invoke('wj:window-video:set-resolution', id)");
    expect(preload).toContain("ipcRenderer.removeListener('wj:window-video-state', handler)");
    expect(options).toContain('settings.resolutionAutomatic');
    expect(options).toContain('settings.resolutionCustom');
    expect(options).toContain('disabled={!windowVideo.desktop || !windowVideo.state || windowVideo.state.fullscreen}');
    expect(settings).not.toMatch(/^\s*resolution:/m);
    expect(`${ui}\n${options}`).not.toContain('resizeTo');
    expect(`${ui}\n${options}`).not.toMatch(/Recommended|권장/);
  });
});
