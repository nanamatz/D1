import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('non-game Escape navigation', () => {
  const app = readFileSync('src/ui/App.tsx', 'utf8');

  it('captures Escape and activates the current screen or overlay Back button', () => {
    expect(app).toContain("event.key !== 'Escape'");
    expect(app).toContain('.screen-pane.screen-in .back-bar');
    expect(app).toContain('.collection-overlay .back-bar');
    expect(app).toContain('.pause-overlay .back-bar');
    expect(app).toContain("document.addEventListener('keydown', onKey, true)");
    expect(app).toContain('event.stopPropagation()');
    expect(app).toContain('back.click()');
  });
});
