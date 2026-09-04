import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  canShowPaletteGuide,
  nextPaletteGuide,
  paletteGuideSessionFor,
  paletteGuideSettleDecision,
  syncPaletteGuideVisit,
  type PaletteGuideSessionState,
} from '../src/ui/components/PaletteGuide';

describe('Palette guide', () => {
  it('cycles locked essentials in registry order before repeating', () => {
    const seen = new Set<string>();
    const active = new Set(['YELLOW', 'MUSIC']);
    expect([0, 1, 2, 3, 4].map(() => nextPaletteGuide(active, seen)?.id)).toEqual([
      'RED', 'GREEN', 'BLUE', 'SOUND', 'RED',
    ]);
    expect(nextPaletteGuide(new Set(['RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND']), seen))
      .toBeNull();
  });

  it('queues only the first non-ending settle that did not unlock an essential', () => {
    expect(paletteGuideSettleDecision({
      alreadyHandled: false, phase: 'playing', pendingEnd: false, unlockedRequired: false,
    })).toBe('queue');
    expect(paletteGuideSettleDecision({
      alreadyHandled: true, phase: 'playing', pendingEnd: false, unlockedRequired: false,
    })).toBe('ignore');
    expect(paletteGuideSettleDecision({
      alreadyHandled: false, phase: 'playing', pendingEnd: true, unlockedRequired: false,
    })).toBe('skip');
    expect(paletteGuideSettleDecision({
      alreadyHandled: false, phase: 'playing', pendingEnd: false, unlockedRequired: true,
    })).toBe('skip');
  });

  it('treats a rolled-back Chapter number and its later return as new visits', () => {
    const session: PaletteGuideSessionState = {
      observationId: 'run-a',
      ante: 5,
      visit: 0,
      handledVisits: new Set([0]),
    };
    expect(syncPaletteGuideVisit(session, 5)).toBe(0);
    expect(syncPaletteGuideVisit(session, 5)).toBe(0);
    expect(syncPaletteGuideVisit(session, 4)).toBe(1);
    expect(session.handledVisits.has(1)).toBe(false);
    session.handledVisits.add(1);
    expect(syncPaletteGuideVisit(session, 5)).toBe(2);
    expect(session.handledVisits.has(2)).toBe(false);
  });

  it('rotates hints across runs while replacing the previous run visit tracker', () => {
    const seen = new Set<string>();
    let current = paletteGuideSessionFor(null, 'run-a', 1);
    current.handledVisits.add(0);
    expect(nextPaletteGuide(new Set(), seen)?.id).toBe('RED');

    const sameRun = paletteGuideSessionFor(current, 'run-a', 1);
    expect(sameRun).toBe(current);
    const nextRun = paletteGuideSessionFor(current, 'run-b', 1);
    expect(nextRun).not.toBe(current);
    expect(nextRun.handledVisits.size).toBe(0);
    expect(nextPaletteGuide(new Set(), seen)?.id).toBe('YELLOW');

    const source = readFileSync('src/ui/components/PaletteGuide.tsx', 'utf8');
    expect(source).toContain('const paletteGuideSeen = new Set<string>();');
    expect(source).toContain('let currentPaletteGuideSession: PaletteGuideSessionState | null = null;');
    expect(source).not.toContain('new Map<string, PaletteGuideSessionState>');
  });

  it('requires tips, completed intro, playing settle-complete state, and no blockers', () => {
    const ready = {
      sameVisit: true,
      tips: true,
      introSeen: true,
      phase: 'playing',
      settleComplete: true,
      pendingEnd: false,
      blindEntryEffects: false,
      blocked: false,
    };
    expect(canShowPaletteGuide(ready)).toBe(true);
    for (const patch of [
      { tips: false }, { introSeen: false }, { phase: 'shop' }, { settleComplete: false },
      { pendingEnd: true }, { blindEntryEffects: true }, { blocked: true }, { sameVisit: false },
    ]) expect(canShowPaletteGuide({ ...ready, ...patch })).toBe(false);
  });

  it('uses a viewport portal, button dismissal, polite status, paused hold, and motion-free mode', () => {
    const source = readFileSync('src/ui/components/PaletteGuide.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(source).toContain('createPortal(');
    expect(source).toContain('document.body');
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('<button');
    expect(source).toContain('onMouseEnter');
    expect(source).toContain('onMouseLeave');
    expect(source).toContain('onFocus');
    expect(source).toContain('onBlur');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('const HOLD_MS = 6000');
    expect(source).toContain('const ENTER_MS = 240');
    expect(source).toContain('const EXIT_MS = 180');
    expect(source).toContain('aria-label={`${t(`paletteGuide.${notice.id}`)}');
    expect(source).toContain("const MODAL_SELECTOR = '.overlay, [role=\"dialog\"], .boss-intro'");
    expect(css).toMatch(/\.palette-guide-live\s*\{[^}]*position:\s*fixed;[^}]*top:\s*24px;[^}]*right:\s*24px;/s);
    expect(css).toMatch(/\.palette-guide-live\s*\{[^}]*z-index:\s*calc\(var\(--z-tooltip\) - 1\);/s);
    expect(css).toContain('.palette-guide.is-reduced');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.force-reduced-motion .palette-guide');
  });

  it('cleans timers and subscriptions without RNG or observing its own insertion', () => {
    const source = readFileSync('src/ui/components/PaletteGuide.tsx', 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).toContain('clearAutoTimer();');
    expect(source).toContain('clearExitTimer();');
    expect(source).toContain("window.removeEventListener(PRESENTATION_CHANGED_EVENT, refresh)");
    expect(source).toContain('return () => observer?.disconnect();');
    expect(source.indexOf('observer?.disconnect();')).toBeLessThan(source.indexOf('setNotice(next);'));
  });

  it('keeps Settings confirmation and unlocked-intro copy explicit in both locales', () => {
    const options = readFileSync('src/ui/components/Options.tsx', 'utf8');
    const intro = readFileSync('src/ui/components/GuidedIntro.tsx', 'utf8');
    const en = JSON.parse(readFileSync('locales/en.json', 'utf8')) as Record<string, string>;
    const ko = JSON.parse(readFileSync('locales/ko.json', 'utf8')) as Record<string, string>;
    expect(options).toContain('if (!paletteArmed)');
    expect(options).toContain('role="alert"');
    expect(options).toContain('grantRequiredPaletteUnlocks()');
    const grantAt = options.indexOf('grantRequiredPaletteUnlocks()');
    const baselineAt = options.indexOf('onPaletteUnlock?.(added)');
    const revealAt = options.indexOf('unlockBus.emit({');
    expect(grantAt).toBeLessThan(baselineAt);
    expect(baselineAt).toBeLessThan(revealAt);
    expect(options).toContain('const addedSet = new Set(added)');
    expect(options).toContain('REQUIRED_PALETTE_UNLOCKS.filter((def) => addedSet.has(def.id))');
    expect(options).not.toContain('applyPresentation()');
    expect(intro).toContain("isPlayed('YELLOW')");
    expect(en['intro.step.submit.bodyUnlocked']).not.toContain('writes yellow back');
    expect(ko['intro.step.submit.bodyUnlocked']).not.toContain('노란색이 돌아');
    expect(ko['settings.paletteUnlock.confirmNotice']).toBe(
      '현재 프로필의 색상 4종과 음악·효과음을 즉시 해금합니다. 마스코트와 다른 진행 요소는 해금되지 않으며 되돌릴 수 없습니다. 같은 버튼을 다시 눌러 확인하세요.',
    );
    expect(en['settings.paletteUnlock.label']).toBe('Palette Convenience');
    expect(ko['settings.paletteUnlock.label']).toBe('팔레트 편의성');
    expect(en['settings.paletteUnlock.action']).not.toMatch(/essential/i);
    expect(en['settings.paletteUnlock.complete']).not.toMatch(/essential/i);
    expect(ko['settings.paletteUnlock.action']).not.toContain('필수 팔레트');
    expect(ko['settings.paletteUnlock.complete']).not.toContain('필수 팔레트');
    expect(en['unlock.requiredPalette']).toBe('The world has been restored');
    expect(ko['unlock.requiredPalette']).toBe('세상을 되찾았습니다');
  });
});
