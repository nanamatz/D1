import { useEffect, useState } from 'react';
import { activeUnlocks } from '../unlocks';
import { mascotSrc } from '../mascots';

/**
 * D-4 · loading screen (screens-spec §2.0). Shown once on app start, before the Main
 * Menu, while the real assets (pixel art, pack illustrations, mascot sprites) preload.
 * Reports REAL progress (loaded / total), never a fake timer, and falls through the
 * instant everything is already cached — no artificial delay. Greyscale on a fresh
 * profile so the world's first colour is still earned, not leaked (§13). Silent:
 * audio can't play before the first gesture (feature-01 B-3), so nothing sounds here.
 */

// Every bundled image asset — enumerated at build time so new art is covered with no
// list to maintain. `?url` yields the hashed URL; preloading warms the browser cache.
const ASSET_URLS: string[] = Object.values(
  import.meta.glob('../assets/**/*.{png,svg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
);

const COLOR_UNLOCKS = ['RED', 'YELLOW', 'GREEN', 'BLUE'];

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // a missing asset must not wedge the loader
    img.src = url;
  });
}

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  // Fresh profile (no colour word played) → greyscale, matching the monochrome start.
  const mono = ![...activeUnlocks(false)].some((id) => COLOR_UNLOCKS.includes(id));

  useEffect(() => {
    let live = true;
    // total = images + one unit for font readiness.
    const total = ASSET_URLS.length + 1;
    let done = 0;
    const tick = () => {
      done += 1;
      if (live) setPct(Math.round((done / total) * 100));
    };
    const tasks: Promise<void>[] = ASSET_URLS.map((u) => preloadImage(u).then(tick));
    const fonts =
      typeof document !== 'undefined' && document.fonts
        ? document.fonts.ready.then(() => undefined)
        : Promise.resolve();
    tasks.push(fonts.then(tick));

    Promise.all(tasks).then(() => {
      if (!live) return;
      setPct(100);
      // One frame so the full bar paints before we hand off (still no artificial wait).
      requestAnimationFrame(() => live && onDone());
    });
    return () => {
      live = false;
    };
  }, [onDone]);

  return (
    <div className={['loading-screen', mono && 'loading-mono'].filter(Boolean).join(' ')}>
      <div className="loading-inner">
        <div className="logotype" aria-label="Play the Wor!d">
          <span className="lt-play">Play the</span>
          <span className="lt-title">
            Wor<span className="lt-bang">!</span>d
          </span>
        </div>
        <img className="loading-mascot" src={mascotSrc('woodak')} alt="" />
        <div className="loading-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="loading-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="loading-pct">{pct}%</div>
      </div>
    </div>
  );
}
