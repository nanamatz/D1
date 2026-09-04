import { useEffect, useState } from 'react';

export const WINDOW_RESOLUTION_PRESETS = [
  { id: '960x600', width: 960, height: 600 },
  { id: '1280x800', width: 1280, height: 800 },
  { id: '1600x900', width: 1600, height: 900 },
  { id: '1920x1080', width: 1920, height: 1080 },
] as const;

export type WindowResolutionPresetId = (typeof WINDOW_RESOLUTION_PRESETS)[number]['id'];

export interface WindowVideoState {
  width: number;
  height: number;
  fullscreen: boolean;
  maximized: boolean;
  availablePresetIds: readonly WindowResolutionPresetId[];
}

interface WindowVideoBridge {
  getWindowVideoState(): Promise<unknown>;
  setWindowResolution(id: WindowResolutionPresetId): Promise<boolean>;
  setWindowFullscreen(enabled: boolean): Promise<boolean>;
  onWindowVideoState(listener: (state: unknown) => void): () => void;
}

const PRESET_IDS = new Set<string>(WINDOW_RESOLUTION_PRESETS.map(({ id }) => id));

function bridge(): WindowVideoBridge | null {
  const candidate = (globalThis as { wj?: Partial<WindowVideoBridge> }).wj;
  return candidate
    && typeof candidate.getWindowVideoState === 'function'
    && typeof candidate.setWindowResolution === 'function'
    && typeof candidate.setWindowFullscreen === 'function'
    && typeof candidate.onWindowVideoState === 'function'
    ? candidate as WindowVideoBridge
    : null;
}

function normalizeState(value: unknown): WindowVideoState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<WindowVideoState>;
  if (!Number.isInteger(state.width) || !Number.isInteger(state.height)
    || typeof state.fullscreen !== 'boolean' || typeof state.maximized !== 'boolean'
    || !Array.isArray(state.availablePresetIds)) return null;
  return {
    width: state.width!,
    height: state.height!,
    fullscreen: state.fullscreen,
    maximized: state.maximized,
    availablePresetIds: state.availablePresetIds.filter(
      (id): id is WindowResolutionPresetId => typeof id === 'string' && PRESET_IDS.has(id),
    ),
  };
}

export function selectedWindowResolution(state: WindowVideoState): WindowResolutionPresetId | null {
  return WINDOW_RESOLUTION_PRESETS.find(
    ({ width, height }) => width === state.width && height === state.height,
  )?.id ?? null;
}

export function useWindowVideo() {
  const desktopBridge = bridge();
  const [state, setState] = useState<WindowVideoState | null>(null);

  useEffect(() => {
    if (!desktopBridge) return;
    let active = true;
    const update = (value: unknown) => {
      const normalized = normalizeState(value);
      if (active && normalized) setState(normalized);
    };
    const unsubscribe = desktopBridge.onWindowVideoState(update);
    void desktopBridge.getWindowVideoState().then(update).catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktopBridge]);

  return {
    desktop: desktopBridge !== null,
    state,
    setResolution: (id: WindowResolutionPresetId) => {
      void desktopBridge?.setWindowResolution(id).catch(() => {});
    },
    setFullscreen: (enabled: boolean) => {
      void desktopBridge?.setWindowFullscreen(enabled).catch(() => {});
    },
  };
}
