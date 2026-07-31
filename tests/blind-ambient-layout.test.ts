import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const play = readFileSync('src/ui/styles/play.css', 'utf8');
const screens = readFileSync('src/ui/styles/screens.css', 'utf8');
const hooks = readFileSync('src/ui/hooks.ts', 'utf8');
const stage = readFileSync('src/ui/components/StagePanel.tsx', 'utf8');

describe('blind ambient layout and tile entry', () => {
  it('gives the blind emblem a restrained idle with reduced-motion support', () => {
    expect(play).toContain('animation: blind-emblem-idle 3.2s');
    expect(play).toContain('translateY(-3px)');
    expect(play).toContain('.force-reduced-motion .bb-art');
  });

  it('keeps the persistent pouch visible at the right viewport edge', () => {
    expect(screens).toMatch(/\.pouch-dock\s*\{[^}]*right:\s*10px/s);
  });

  it('hands a fresh tile from its flight to idle without a second hop', () => {
    expect(hooks).toContain("k.classList.add('flip-entering')");
    expect(hooks).toContain("{ transform: 'rotate(-1.2deg)', opacity: 1 }");
    expect(hooks).toContain("k.classList.remove('flip-entering')");
    expect(play).toMatch(/\.hand \.tile\.flip-entering\s*\{[^}]*animation:\s*none/s);
    expect(play).not.toContain('@keyframes tile-draw-in');
  });

  it('keeps the opening deal inside the work panel without a second row animation', () => {
    expect(play).not.toContain('@keyframes handIntro');
    expect(stage).toContain('bounds.right - tile.offsetWidth');
    expect(stage).toContain('bounds.bottom - tile.offsetHeight');
  });
});
