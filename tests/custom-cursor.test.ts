import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  applyMascotCursor,
  mascotCursorSet,
  WOODAK_SKINS,
  type WooDakSkin,
} from '../src/ui/mascots';

type DecodedPng = { width: number; height: number; data: Uint8Array };

const { PNG } = createRequire(import.meta.url)('pngjs') as {
  PNG: { sync: { read(input: Uint8Array): DecodedPng } };
};

const cursorDir = 'src/ui/assets/cursors';
const skins = ['woodak', 'dog', 'ghost', 'alien', 'turtle'] as const;
const states = ['normal', 'hover', 'active'] as const;
const tones = ['mono', 'color'] as const;
const cursorFiles = skins.flatMap((skin) =>
  states.flatMap((state) => tones.map((tone) => `${skin}-hand-${state}-${tone}.png`)),
).sort();

function decode(name: string): DecodedPng {
  return PNG.sync.read(readFileSync(`${cursorDir}/${name}`));
}

function alphaMask(png: DecodedPng): number[] {
  return Array.from({ length: png.width * png.height }, (_, index) =>
    png.data[index * 4 + 3] ?? -1,
  );
}

function block(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  const start = source.indexOf('{', markerIndex);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  expect(start).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  throw new Error(`Unclosed CSS block: ${marker}`);
}

describe('WooDak-skin hand cursors', () => {
  it('ships exactly 5 skins × 3 states × 2 tones as distinct 32px RGBA sprites', () => {
    expect(readdirSync(cursorDir).filter((name) => name.endsWith('.png')).sort()).toEqual(cursorFiles);

    const hashes = new Set<string>();
    for (const name of cursorFiles) {
      const bytes = readFileSync(`${cursorDir}/${name}`);
      hashes.add(createHash('sha256').update(bytes).digest('hex'));
      expect(bytes[25]).toBe(6); // PNG colour type 6 = RGBA
      const png = PNG.sync.read(bytes);
      expect([png.width, png.height]).toEqual([32, 32]);
      const alpha = alphaMask(png);
      expect(new Set(alpha)).toEqual(new Set([0, 255]));
      expect(alpha[3 * png.width + 3]).toBe(255);

      if (name.endsWith('-mono.png')) {
        for (let index = 0; index < png.data.length; index += 4) {
          if (png.data[index + 3] === 0) continue;
          expect(png.data[index]).toBe(png.data[index + 1]);
          expect(png.data[index + 1]).toBe(png.data[index + 2]);
        }
      }
    }
    expect(hashes.size).toBe(cursorFiles.length);

    for (const skin of skins) {
      for (const state of states) {
        expect(alphaMask(decode(`${skin}-hand-${state}-mono.png`))).toEqual(
          alphaMask(decode(`${skin}-hand-${state}-color.png`)),
        );
      }
    }

    const normalSilhouettes = new Set(
      skins.map((skin) => createHash('sha256')
        .update(Uint8Array.from(alphaMask(decode(`${skin}-hand-normal-mono.png`))))
        .digest('hex')),
    );
    expect(normalSilhouettes.size).toBe(skins.length);
  });

  it('keeps cursor sets in the skin registry and reuses its unlock fallback', () => {
    expect(WOODAK_SKINS.map((skin) => skin.id)).toEqual(skins);
    for (const def of WOODAK_SKINS) {
      const active = new Set(def.unlockId ? [def.unlockId] : []);
      const cursors = mascotCursorSet(def.id, active);
      for (const state of states) {
        for (const tone of tones) {
          expect(cursors[state][tone]).toContain(`${def.id}-hand-${state}-${tone}.png`);
        }
      }
    }
    const woodak = mascotCursorSet('woodak', new Set());
    expect(mascotCursorSet('dog', new Set())).toEqual(woodak);
    expect(mascotCursorSet('nope' as WooDakSkin, new Set())).toEqual(woodak);
    expect(mascotCursorSet('dog', new Set(['DOG']))).toEqual(
      WOODAK_SKINS.find((skin) => skin.id === 'dog')!.cursors,
    );

    const values = new Map<string, string>();
    const root = {
      style: { setProperty: (name: string, value: string) => values.set(name, value) },
    } as unknown as HTMLElement;
    applyMascotCursor(root, 'woodak', new Set());
    expect(values.size).toBe(6);
    for (const state of states) {
      for (const tone of tones) {
        const value = values.get(`--mascot-cursor-${state}-${tone}`);
        expect(value).toContain(') 3 3, ');
        expect(value).toMatch(new RegExp(`, ${state === 'normal' ? 'default' : 'pointer'}$`));
      }
    }
  });

  it('updates from settings and presentation changes without a pointer follower', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    const unlocks = readFileSync('src/ui/unlocks.ts', 'utf8');
    const mascots = readFileSync('src/ui/mascots.ts', 'utf8');
    const profile = readFileSync('src/ui/components/Profile.tsx', 'utf8');

    expect(app).toContain('const { settings } = useSettings();');
    expect(app).toContain('mascotCursorUrls(settings.mascot, active).map(preloadImage)');
    expect(app).toContain('current === request');
    expect(app).toContain('applyMascotCursor(document.documentElement, settings.mascot, active)');
    expect(app).toContain('window.addEventListener(PRESENTATION_CHANGED_EVENT, syncMascotCursor)');
    expect(app).toMatch(/\}, \[settings\.mascot\]\);/);
    expect(unlocks).toContain('window.dispatchEvent(new Event(PRESENTATION_CHANGED_EVENT))');
    expect(profile).toMatch(/selectedSlot === currentSlot\) applyPresentation\(\)/);
    expect(mascots).not.toMatch(/piyak.*Cursor/i);
    expect(`${app}\n${mascots}`).not.toMatch(/pointermove|requestAnimationFrame/);
  });

  it('uses normal/hover/active poses while preserving native semantic cursors', () => {
    const css = readFileSync('src/ui/styles/cursor.css', 'utf8');
    const main = readFileSync('src/main.tsx', 'utf8');
    const fine = block(css, '@media (hover: hover) and (pointer: fine)');

    expect(main.indexOf("import './ui/styles/cursor.css';")).toBeGreaterThan(
      main.indexOf("import './ui/styles/screens.css';"),
    );
    expect(fine).toContain('--game-cursor-normal: var(--mascot-cursor-normal-mono, default);');
    expect(fine).toContain('--game-cursor-hover: var(--mascot-cursor-hover-mono, pointer);');
    expect(fine).toContain('--game-cursor-active: var(--mascot-cursor-active-mono, pointer);');
    expect(fine).toMatch(/\.loading-screen,[\s\S]*?cursor:\s*none !important;/);
    expect(fine).toMatch(/:root:not\(\.world-mono\)[\s\S]*--mascot-cursor-normal-color/);
    expect(fine).toMatch(/:where\([\s\S]*\):active\s*\{\s*cursor:\s*var\(--game-cursor-active\) !important/);
    expect(fine.indexOf('var(--game-cursor-active)')).toBeLessThan(fine.indexOf('cursor: text'));
    expect(fine).toMatch(/input\[type='range'\][\s\S]*cursor:\s*var\(--game-cursor-hover\)/);
    expect(fine).not.toMatch(/(?:^|\n)\s*input,\s*\n[\s\S]*?cursor:\s*text/);
    for (const semantic of ['text', 'help', 'crosshair', 'grabbing', 'not-allowed']) {
      expect(fine).toContain(`cursor: ${semantic} !important;`);
    }
    expect(fine).toMatch(/\.tile\.draggable\s*\{\s*cursor:\s*var\(--game-cursor-hover\) !important;/);
    expect(fine).toMatch(/\.tile\.draggable:active,\s*\.tile\.grabbed\s*\{\s*cursor:\s*var\(--game-cursor-active\) !important;/);
    expect(fine).not.toContain('cursor: grab !important;');
    expect(fine).toMatch(/\.joker-slot\.grabbed \*\s*\{\s*cursor:\s*grabbing !important;/);

    const forcedColors = block(css, '@media (forced-colors: active)');
    expect(forcedColors).toContain('--game-cursor-normal: default !important;');
    expect(forcedColors).toContain('--game-cursor-hover: pointer !important;');
    expect(forcedColors).toContain('--game-cursor-active: pointer !important;');
    expect(forcedColors).not.toContain('cursor: revert');
    const beforeFinePointer = css.slice(
      0,
      css.indexOf('@media (hover: hover) and (pointer: fine)'),
    );
    expect(beforeFinePointer).not.toContain('--game-cursor-');
    expect(css).not.toMatch(/url\(\s*['"]?https?:/i);
    expect(`${css}\n${readFileSync('src/ui/mascots.ts', 'utf8')}`).not.toContain('fetch(');
    expect(css).not.toContain('proof-pencil');
  });
});
