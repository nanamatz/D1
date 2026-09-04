import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScoreTransferReadout } from '../src/ui/components/Sidebar';

const render = (committedBefore: number, committedScore: number, round: number): string =>
  renderToStaticMarkup(createElement(ScoreTransferReadout, { committedBefore, committedScore, round }));

describe('ordinary word score transfer', () => {
  it('shows only the authoritative committed delta remaining', () => {
    expect(render(67, 82, 67)).toContain('>15</div>');
    expect(render(67, 82, 73)).toContain('>9</div>');
    expect(render(67, 82, 82)).not.toMatch(/>0</);
    expect(render(82, 67, 82)).not.toMatch(/>-|>0</);
    expect(render(67, Number.POSITIVE_INFINITY, 67)).not.toContain('—');
  });

  it('uses the existing round tween and settle gates', () => {
    const source = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    expect(source).toContain('useCountUp(roundTarget, BONUS_LAND_MS');
    expect(source).toContain("finalScore === null || finalScore === blind.committedScore");
    expect(source).toContain('settleReduced && !settleComplete');
    expect(source).toContain('!settleReduced && settleComplete && round < blind.committedScore');
    expect(source).toContain('displayedRound = settleReduced ? roundTarget : round');
  });

  it('reserves the full readout slot, including the blank BUILD state', () => {
    const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(sidebar).toContain("preview={mode === 'blind' && !bonusActive ? preview : null}");
    expect(css).toMatch(/\.sb-status\s*\{[^}]*height:\s*52px[^}]*min-height:\s*52px[^}]*flex:\s*0 0 52px[^}]*line-height:\s*1/s);
    expect(css).toMatch(/\.sb-status\.score-transfer\s*\{[^}]*font-size:\s*var\(--readout-size\)/s);
  });
});
