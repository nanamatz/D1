/**
 * User settings (spec §2.11). A machine-local preference, so it stays in
 * localStorage on every platform — it is NOT a save key and never reaches the
 * desktop save files (resolution and volume following a player to another PC is
 * an annoyance, not a feature). A few are wired to real effects (UI scale → root
 * font-size, reduced-motion override → a body class, color-blind hint palette →
 * a body class); the rest are stored now and consumed as their systems land
 * (game speed by the settle timing, audio by a future mixer). Kept out of the
 * engine — pure presentation.
 */
import { useEffect, useMemo } from 'react';
import { usePersistedState } from './hooks';
import { audio } from './audio';
import { applyPresentation } from './unlocks';
import { readValue } from './storage';
import { isWooDakSkin, type WooDakSkin } from './mascotIds';

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
  /** Chosen in Collection → Mascots; persisted here with other profile presentation. */
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
  mascot: 'woodak',
};

/** Exported so `mascots.ts` can read the live selection from the same store. */
export const SETTINGS_KEY = 'wj.settings';

/**
 * Read the CURRENT tips setting straight from storage rather than from a React
 * `useSettings()` copy: the TutorialHost mounts once and must see a live toggle
 * from Options even mid-run, without being re-rendered for it.
 */
export function readTips(): boolean {
  return normalizeSettings(readValue<unknown>(SETTINGS_KEY)).tips;
}

const SPEEDS: readonly Settings['gameSpeed'][] = [1, 2, 4];

/**
 * Merge a stored value onto the defaults and range-check every field.
 *
 * A save written by an older build holds only the keys that existed then, and
 * `usePersistedState` hands back whatever it read. A missing `uiScale` became
 * `String(undefined / 100)` → `--ui-scale: NaN`, and a missing volume reached
 * `audio.setVolumes` where `clamp(undefined, 0, 100)` is `NaN` — silent audio and
 * a collapsed layout from a save that merely predates a field. Normalizing on
 * read means adding a setting can never do that again.
 */
export function normalizeSettings(stored: unknown): Settings {
  const parsed = stored && typeof stored === 'object'
    ? stored as Partial<Settings>
    : {};
  const merged = { ...DEFAULT_SETTINGS, ...parsed };
  const num = (value: unknown, fallback: number, lo: number, hi: number): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(hi, Math.max(lo, value))
      : fallback;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;
  return {
    ...merged,
    gameSpeed: SPEEDS.includes(merged.gameSpeed) ? merged.gameSpeed : DEFAULT_SETTINGS.gameSpeed,
    screenshake: num(merged.screenshake, DEFAULT_SETTINGS.screenshake, 0, 100),
    uiScale: num(merged.uiScale, DEFAULT_SETTINGS.uiScale, 80, 120),
    master: num(merged.master, DEFAULT_SETTINGS.master, 0, 100),
    music: num(merged.music, DEFAULT_SETTINGS.music, 0, 100),
    sfx: num(merged.sfx, DEFAULT_SETTINGS.sfx, 0, 100),
    reducedMotion: bool(merged.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    colorBlind: bool(merged.colorBlind, DEFAULT_SETTINGS.colorBlind),
    tips: bool(merged.tips, DEFAULT_SETTINGS.tips),
    fullscreen: bool(merged.fullscreen, DEFAULT_SETTINGS.fullscreen),
    mascot: isWooDakSkin(merged.mascot) ? merged.mascot : DEFAULT_SETTINGS.mascot,
  };
}

export function useSettings() {
  const [stored, setSettings] = usePersistedState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  // Normalized on every read, so a legacy partial object can never reach the DOM
  // or the audio mixer. `usePersistedState` is now shared across instances, so
  // this is the same object for App, Options, RunView and Collection.
  const settings = useMemo(() => normalizeSettings(stored), [stored]);

  // Fullscreen can also end outside our toggle (most notably via Escape). Treat
  // the browser event as authoritative so the persisted toggle returns to OFF.
  useEffect(() => {
    const syncFullscreen = () => {
      const fullscreen = document.fullscreenElement !== null;
      // Normalize inside the updater, never from a captured `settings`: this
      // listener outlives many renders, and writing a stale snapshot back is
      // exactly how Options' volume change used to get reverted.
      setSettings((current) => {
        const normalized = normalizeSettings(current);
        return normalized.fullscreen === fullscreen
          ? current
          : { ...normalized, fullscreen };
      });
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, [setSettings]);

  // Apply the presentation-affecting settings to the document.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
    root.style.setProperty('--screen-shake', String(settings.screenshake / 100));
    document.body.classList.toggle('force-reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('cb-safe', settings.colorBlind);
    // Mixer: push the persisted slider values into the audio facade (work order B).
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
    // Chromatic unlocks are profile progress; never read a device-wide override.
    applyPresentation();
  }, [
    settings.uiScale, settings.screenshake, settings.reducedMotion, settings.colorBlind,
    settings.master, settings.music, settings.sfx,
  ]);

  // Built from the NORMALIZED value, so writing one field also repairs a legacy
  // partial object instead of persisting the hole again.
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => normalizeSettings({ ...current, [key]: value }));

  return { settings, set };
}
