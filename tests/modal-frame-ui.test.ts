import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('shared modal frame', () => {
  it('uses the Collection border treatment for every modal panel', () => {
    const screens = source('src/ui/styles/screens.css');
    const options = source('src/ui/components/Options.tsx');

    expect(screens).toMatch(
      /\.collection-modal,\s*\.overlay-card,\s*\.tut-card\s*\{[^}]*border:\s*3px solid var\(--panel-edge\)[^}]*border-radius:\s*18px[^}]*inset 0 0 0 3px var\(--inset-edge\)[^}]*7px 7px 0/s,
    );
    expect(options).toContain('createPortal(<div className="overlay collection-overlay">');
  });
});
