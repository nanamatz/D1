import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const component = readFileSync('src/ui/components/DeskObjects.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');
const audio = readFileSync('src/ui/audio.ts', 'utf8');

describe('ambient coffee cup interaction', () => {
  it('uses the pixel-art asset and a separately animated liquid layer', () => {
    expect(component).toContain("import coffeeCup from '../assets/desk-coffee-cup.png'");
    expect(component).toContain('className="desk-coffee-liquid"');
    expect(component).toContain("obj.kind === 'cup'");
    expect(css).toContain('@keyframes coffee-drain');
    expect(css).toContain('.desk-cup.desk-drinking .desk-coffee-liquid');
  });

  it('sets the cup down from above and makes it larger than the old glyph', () => {
    expect(css).toContain('@keyframes desk-cup-down');
    expect(css).toContain('translateY(calc(-100vh - 110%))');
    expect(css).toContain('width: clamp(112px, 11vw, 168px)');
  });

  it('finishes the slurp before removing the cup', () => {
    expect(component).toContain('setDrinking(true)');
    expect(component).toContain('setTimeout(() => setLeaving(true), 900)');
    expect(audio).toMatch(/deskCup:\s+\{[^}]*dur:\s*0\.68/s);
  });
});
