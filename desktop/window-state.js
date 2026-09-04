/**
 * Window bounds policy and persistence.
 *
 * The exported geometry functions are pure so they can be tested without
 * Electron — restoring a window onto a monitor that has since been unplugged is
 * a bug manual testing rarely catches.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Design board is 1440x988; at this size --fit-scale reads exactly 1 (it is min(1, ...)). */
export const DEFAULT_SIZE = { width: 1600, height: 900 };
/** Below this --fit-scale bottoms out near 0.66 and the pixel font stops being legible. */
export const MIN_SIZE = { width: 960, height: 600 };

export const RESOLUTION_PRESETS = Object.freeze({
  '960x600': { width: 960, height: 600 },
  '1280x800': { width: 1280, height: 800 },
  '1600x900': { width: 1600, height: 900 },
  '1920x1080': { width: 1920, height: 1080 },
});

/** Reject arbitrary dimensions at the renderer/main trust boundary. */
export function resolutionPreset(id) {
  return typeof id === 'string' && Object.hasOwn(RESOLUTION_PRESETS, id)
    ? RESOLUTION_PRESETS[id]
    : null;
}

/** A content-size preset is available only when its decorated window fits. */
export function presetFitsWorkArea(content, workArea, frame) {
  return content.width + Math.max(0, frame.width) <= workArea.width
    && content.height + Math.max(0, frame.height) <= workArea.height;
}

/** Centre a known-fitting decorated window inside a display work area. */
export function centeredOuterBounds(content, workArea, frame) {
  const width = content.width + Math.max(0, frame.width);
  const height = content.height + Math.max(0, frame.height);
  return {
    x: workArea.x + Math.max(0, Math.round((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.round((workArea.height - height) / 2)),
    width,
    height,
  };
}

/** A window must show at least this much of itself on some display to count as visible. */
const MIN_VISIBLE = { width: 120, height: 60 };

/**
 * @param {{x:number,y:number,width:number,height:number}} workArea
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function defaultBounds(workArea) {
  const width = Math.max(MIN_SIZE.width, Math.min(DEFAULT_SIZE.width, workArea.width));
  const height = Math.max(MIN_SIZE.height, Math.min(DEFAULT_SIZE.height, workArea.height));
  return {
    x: workArea.x + Math.max(0, Math.round((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.round((workArea.height - height) / 2)),
    width,
    height,
  };
}

function overlap(a, b) {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/**
 * @param {{x:number,y:number,width:number,height:number}} bounds
 * @param {{workArea:{x:number,y:number,width:number,height:number}}[]} displays
 */
export function isVisibleOn(bounds, displays) {
  return displays.some((d) => {
    const o = overlap(bounds, d.workArea);
    return o.width >= MIN_VISIBLE.width && o.height >= MIN_VISIBLE.height;
  });
}

/**
 * @param {{x:number,y:number,width:number,height:number}|null} saved
 * @param {{workArea:{x:number,y:number,width:number,height:number}}[]} displays
 * @param {{x:number,y:number,width:number,height:number}} workArea primary work area
 */
export function restoreBounds(saved, displays, workArea) {
  if (!saved) return defaultBounds(workArea);

  const bounds = {
    x: saved.x,
    y: saved.y,
    width: Math.max(MIN_SIZE.width, saved.width),
    height: Math.max(MIN_SIZE.height, saved.height),
  };

  return isVisibleOn(bounds, displays) ? bounds : defaultBounds(workArea);
}

/** @returns {object|null} null when the file is missing or corrupt — never throws. */
export function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Best-effort; a failed write must never prevent the app from quitting. */
export function saveState(file, state) {
  try {
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch {
    /* ignore */
  }
}
