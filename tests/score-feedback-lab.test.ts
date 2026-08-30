import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('score feedback laboratory', () => {
  it('drives the real portalled typewriter through every local preview control', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    expect(lab).toContain("import { ScoreTypewriter } from './ScoreTypewriter'");
    expect(lab).toContain('const PREVIEW_TIERS: readonly PreviewTier[] = [1, 2, 3, 4, 5]');
    expect(lab).toContain('const PREVIEW_SPEEDS: readonly PreviewSpeed[] = [1, 2]');
    expect(lab).toContain('<ScoreTypewriter');
    expect(lab).toContain('tier={activeTier}');
    expect(lab).toContain('gameSpeed={speed}');
    expect(lab).toContain('screenshake={screenshake}');
    expect(lab).toContain('reducedMotion={reducedMotion}');
    expect(lab).toContain('BALANCE.scoreTypewriter.beatMs / speed');
    expect(lab).toContain('setBeatId((value) => value + 1)');
    expect(lab).toContain('aria-pressed={selectedTier === tier}');
    expect(lab).toContain('<button className="btn" onClick={idle}>');
    expect(lab).not.toContain('aria-pressed={activeTier === 0}');
  });

  it('re-arms target crossing below the threshold before raising it next frame', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    const targetReplay = lab.slice(
      lab.indexOf('const replayTarget = () => {'),
      lab.indexOf('useEffect(() => {', lab.indexOf('const replayTarget = () => {')),
    );
    expect(targetReplay).toContain('idle();');
    expect(targetReplay).toContain('setBeatId((value) => value + 1)');
    expect(lab).toContain('setLiveTotal(TARGET_CUE_TARGET - 1)');
    expect(lab).toContain('setTargetReplay((value) => value + 1)');
    expect(lab).toContain('targetFrame.current = window.requestAnimationFrame');
    expect(lab).toContain('setLiveTotal(TARGET_CUE_TARGET)');
    expect(lab).toContain('beatId={`lab-beat-${beatId}`}');
    expect(lab).toContain('blindKey={`lab-target-${targetReplay}`}');
    expect(lab).toContain('window.cancelAnimationFrame(targetFrame.current)');
  });

  it('cleans timers and keeps preview controls out of settings, storage, and RNG', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    expect(lab).toContain('window.clearTimeout(idleTimer.current)');
    expect(lab).toContain("selectTab('encounters')");
    expect(lab).not.toContain('useSettings');
    expect(lab).not.toContain('storage');
    expect(lab).not.toContain('rng');
  });
});
