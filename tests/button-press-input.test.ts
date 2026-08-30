import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/App.tsx', 'utf8');

describe('delegated button-press input', () => {
  it('fires once at primary pointerdown and never from the following click', () => {
    expect(source).toContain("document.addEventListener('pointerdown', pointer, true)");
    expect(source).toContain('event.isPrimary && event.button === 0');
    expect(source).not.toContain("document.addEventListener('click', click, true)");
    expect(source).toContain('audio.isUnlocked()');
    expect(source).toContain("audio.unlock().then(() => audio.play('buttonPress'))");
  });

  it('handles one Enter/Space keydown and excludes silent controls', () => {
    expect(source).toContain('!event.repeat');
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
    expect(source).toContain("control.matches(':disabled, [aria-disabled=\"true\"]')");
    expect(source).toContain("control.closest('.desk-object')");
    expect(source).toContain("control.closest('.developer-splash')");
  });
});
