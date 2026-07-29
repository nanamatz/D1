import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runView = readFileSync('src/ui/components/RunView.tsx', 'utf8');
const intro = readFileSync('src/ui/components/BossIntro.tsx', 'utf8');

describe('boss blind entry reveal', () => {
  it('mounts only after the boss blind enters playing', () => {
    expect(runView).toContain("phase === 'playing' && blind.kind === 'boss'");
  });

  it('holds for 1 second after entry and then completes its fade', () => {
    expect(intro).toContain('const BOSS_HOLD_MS = 1000');
    expect(intro).toContain('const exitAt = BOSS_ENTER_MS + BOSS_HOLD_MS');
    expect(intro).toContain("setState('exiting')");
    expect(intro).toContain("setState('done')");
    expect(intro).toContain('}, [boss, entering]);');
    expect(intro).not.toContain('[boss, entering, state]');
  });
});
