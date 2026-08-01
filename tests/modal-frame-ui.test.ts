import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('shared modal frame', () => {
  it('uses the Collection border treatment for every modal panel', () => {
    const screens = source('src/ui/styles/screens.css');
    const play = source('src/ui/styles/play.css');

    expect(screens).toMatch(
      /\.collection-modal,\s*\.overlay-card,\s*\.tut-card\s*\{[^}]*border:\s*3px solid var\(--panel-edge\)[^}]*border-radius:\s*18px[^}]*inset 0 0 0 3px var\(--inset-edge\)[^}]*7px 7px 0/s,
    );
    expect(play).toMatch(
      /\.overlay-card\.pause-modal:has\(\.collection\)\s*\{[^}]*background:\s*transparent[^}]*border:\s*0[^}]*box-shadow:\s*none/s,
    );
  });
});
