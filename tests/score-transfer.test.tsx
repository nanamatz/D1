import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
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
    expect(render(-Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE)).not.toContain('—');
  });

  it('holds after settle completion, then uses the existing round tween', () => {
    const source = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    const game = readFileSync('src/ui/useGame.ts', 'utf8');
    const build = game.slice(game.indexOf('// BUILD —'), game.indexOf('// LAND —'));
    const land = game.slice(game.indexOf('// LAND —'), game.indexOf('// RESOLVE —'));
    expect(BALANCE.scoreTransfer.holdMs).toBe(500);
    expect(source).toContain("useCountUp(roundTarget, BONUS_LAND_MS, mode !== 'blind' || !settleComplete)");
    expect(source).toContain("finalScore === null || finalScore === blind.committedScore");
    expect(source).toContain("mode === 'blind' && settleComplete && sentenceBonus === null && hasWordTransfer");
    expect(source).toContain('Number.isFinite(wordGain) && wordGain > 0');
    expect(source).toContain('setTimeout(() => setReleasedTransferId(settleId), BALANCE.scoreTransfer.holdMs)');
    expect(source).toContain("if (mode !== 'blind' || !settleComplete)");
    expect(source).toContain('setReleasedTransferId(-1)');
    expect(source).toContain('settleComplete && !transferHold ? blind.committedScore : committedBefore');
    expect(source).toContain("mode !== 'blind' || !settleComplete");
    expect(source).not.toContain('settleReduced && !settleComplete');
    expect(source).toContain('displayedRound = settleReduced ? roundTarget : round');
    expect(source).toContain('settleReduced && transferHold ? committedBefore : round');
    expect(source).toContain("bonusActive ? 0 : settle.active ? settle.chips : preview?.letterHand?.chips ?? 0");
    expect(source).toContain("bonusActive ? 0 : settle.active ? settle.mult : preview?.letterHand?.mult ?? 0");
    expect(source).not.toContain('blind.committedScore + sentenceBonus!.chips');
    expect(source).toContain('return () => clearTimeout(id)');
    expect(game).toContain('const holdId = setTimeout(afterHold, BALANCE.scoreTransfer.holdMs)');
    expect(game).toContain('transferId = setTimeout(() => publish(false), BONUS_LAND_MS)');
    expect(game).toContain('if (transferId !== undefined) clearTimeout(transferId)');
    expect(game).toContain('if (!Number.isFinite(wordGain) || wordGain <= 0)');
    expect(game).toContain('prev.settleId !== settleId');
    expect(build.indexOf('const end = endBlind')).toBeLessThan(build.indexOf('const holdId = setTimeout'));
    expect(build).not.toMatch(/\}, \[[^\]]*(?:state\.blind|state\.run|getLexicon)[^\]]*\]\);/);
    expect(build).toContain('const reduceAtSettle = prefersReduce()');
    expect(build).toContain('const reduce = reduceAtSettle || prefersReduce()');
    expect(build).toContain('if (!reduce && hasBonus)');
    expect(build.indexOf('sentenceFinalScoreRef.current')).toBeGreaterThan(build.indexOf('const publish'));
    expect(build).toContain('sentenceFinalScoreRef.current = sentenceBonus && finalScore === null');
    expect(land).not.toContain('endBlind(');
    expect(land).toContain('snapshot.sentenceBonus !== state.sentenceBonus');
    expect(land).toContain('prev.sentenceBonus === snapshot.sentenceBonus');
    expect(land).toContain('finalScore: snapshot.finalScore');
    expect(land).not.toMatch(/\}, \[[^\]]*(?:state\.blind|state\.run|getLexicon)[^\]]*\]\);/);
    expect(game).toMatch(/state\.sentenceBonus === null[\s\S]*?setTimeout\([\s\S]*?BONUS_LAND_MS/);
  });

  it('reserves the full readout slot, including the blank BUILD state', () => {
    const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(sidebar).toContain("preview={mode === 'blind' && !bonusActive ? preview : null}");
    expect(css).toMatch(/\.sb-status\s*\{[^}]*height:\s*52px[^}]*min-height:\s*52px[^}]*flex:\s*0 0 52px[^}]*line-height:\s*1\.2[^}]*align-items:\s*center[^}]*justify-content:\s*center/s);
    expect(css).toMatch(/\.round-score-value\s*\{[^}]*font-weight:\s*400/s);
    expect(css).toMatch(/\.sb-status\.score-transfer\s*\{[^}]*font-size:\s*var\(--readout-size\)[^}]*font-weight:\s*400[^}]*color:\s*var\(--ink\)[^}]*animation:\s*score-transfer-in 260ms/s);
    expect(css).toMatch(/@keyframes score-transfer-in\s*\{[^}]*scale\(\.55\)[\s\S]*?scale\(1\.12\)[\s\S]*?scale\(1\)/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sb-status\.score-transfer,[\s\S]*?animation:\s*none/s);
    expect(sidebar).toContain('<span className={`sb-status-tag loud ${suit}`}>');
    expect(sidebar).toContain('<span className="sb-status-label">{label}</span>');
    expect(css).toMatch(/\.sb-status-label\s*\{[^}]*display:\s*block[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*line-height:\s*1\.2[^}]*white-space:\s*nowrap[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
    expect(css).toMatch(/\.sb-status-tag\.loud\s*\{[^}]*max-width:\s*100%[^}]*min-height:\s*44px[^}]*max-height:\s*52px[^}]*padding:\s*0 20px[^}]*display:\s*inline-flex[^}]*line-height:\s*1\.2[^}]*font-size:\s*calc\(var\(--fs-lg\) \* 1\.4\)/s);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*?\.sb-status-tag\.loud\s*\{[^}]*color:\s*ButtonText[^}]*background:\s*ButtonFace[^}]*border:\s*1px solid ButtonText/s);
    expect(css).not.toContain('.sb-status.loud {');
  });
});
