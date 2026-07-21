/**
 * User settings (spec §2.11). Persisted to localStorage. A few are wired to real
 * effects (UI scale → root font-size, reduced-motion override → a body class,
 * color-blind hint palette → a body class); the rest are stored now and consumed
 * as their systems land (game speed by the settle timing, audio by a future
 * mixer). Kept out of the engine — pure presentation.
 */
import { useEffect } from 'react';
import { usePersistedState } from './hooks';
import { audio } from './audio';
import { applyPresentation } from './unlocks';
import type { WooDakSkin } from './mascots';

export interface Settings {
  gameSpeed: 1 | 2 | 4;
  screenshake: number; // 0..100
  reducedMotion: boolean;
  colorBlind: boolean;
  tips: boolean;
  fullscreen: boolean;
  uiScale: number; // 80..120 (%)
  master: number; // 0..100
  music: number;
  sfx: number;
  /** feature-02 C-4: presentation-unlock override (unlock all colors/audio now) */
  unlockAll: boolean;
  /** 2026-07-21: chosen WooDak ally skin (default 'woodak'; unlocked skins only). */
  mascot: WooDakSkin;
}

export const DEFAULT_SETTINGS: Settings = {
  gameSpeed: 1,
  screenshake: 50,
  reducedMotion: false,
  colorBlind: false,
  tips: true,
  fullscreen: false,
  uiScale: 100,
  master: 80,
  music: 70,
  sfx: 80,
  unlockAll: false,
  mascot: 'woodak',
};

/** Exported so `mascots.ts` can read the live selection from the same store. */
export const SETTINGS_KEY = 'wj.settings';

/**
 * Read the CURRENT tips setting straight from localStorage — not from a React
 * `useSettings()` copy. `usePersistedState` is a per-instance `useState` with no
 * cross-instance sync, so a component mounted once (the TutorialHost) would freeze
 * its `settings.tips` at mount and never see a live toggle from Options. This
 * always reflects the latest persisted value (settings write through on change).
 */
export function readTips(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS.tips;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return parsed.tips ?? DEFAULT_SETTINGS.tips;
  } catch {
    return DEFAULT_SETTINGS.tips;
  }
}

export function useSettings() {
  const [settings, setSettings] = usePersistedState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);

  // Apply the presentation-affecting settings to the document.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
    document.body.classList.toggle('force-reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('cb-safe', settings.colorBlind);
    // Mixer: push the persisted slider values into the audio facade (work order B).
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
    // Chromatic unlocks (C): apply the played set + override to DOM/audio buses.
    applyPresentation(settings.unlockAll);
  }, [
    settings.uiScale, settings.reducedMotion, settings.colorBlind,
    settings.master, settings.music, settings.sfx, settings.unlockAll,
  ]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return { settings, set };
}
