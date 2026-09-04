import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  UNLOCKS,
  loadPlayed,
  isPlayed,
  markPlayed,
  playedCount,
  resetUnlocks,
  activeUnlocks,
  checkWordPlayed,
  chromaMatrix,
  applyPresentation,
  grantRequiredPaletteUnlocks,
  REQUIRED_PALETTE_UNLOCKS,
  unlockBus,
  type UnlockRevealEvent,
} from '../src/ui/unlocks';
import { FamilyCardArt } from '../src/ui/components/FamilyCardArt';
import { audio } from '../src/ui/audio';
import { readProfileValue, writeProfileValue } from '../src/ui/storage';

// jsdom is not configured project-wide; provide a minimal localStorage shim
// (matching tutorial-store.test.ts) so the played-set persistence round-trips.
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetUnlocks();
});

describe('chromatic unlocks — registry (feature-02 C)', () => {
  it('carries the initial table incl. the 4 color words + audio + mascots', () => {
    const ids = new Set(UNLOCKS.map((u) => u.id));
    for (const w of ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND', 'ALIEN', 'GHOST', 'DOG', 'TURTLE']) {
      expect(ids.has(w)).toBe(true);
    }
    expect(UNLOCKS.length).toBe(10);
  });

  it('does not gate the language — Korean is not a palette unlock (2026-07-30)', () => {
    expect(UNLOCKS.some((u) => u.id === 'KOREAN')).toBe(false);
    expect(UNLOCKS.some((u) => u.effect.kind === ('locale' as never))).toBe(false);
  });

  it('every unlock word is uppercase and equals its id (data-driven, no hard-coded checks)', () => {
    for (const u of UNLOCKS) {
      expect(u.word).toBe(u.word.toUpperCase());
      expect(u.id).toBe(u.word);
    }
  });
});

describe('chromatic unlocks — played persistence', () => {
  it('isPlayed is false until markPlayed, true after (persisted)', () => {
    expect(isPlayed('RED')).toBe(false);
    markPlayed('RED');
    expect(isPlayed('RED')).toBe(true);
    expect(loadPlayed().has('RED')).toBe(true);
  });

  it('markPlayed is idempotent', () => {
    markPlayed('BLUE');
    markPlayed('BLUE');
    expect(playedCount()).toBe(1);
  });

  it('grants exactly the six color/audio essentials, idempotently and per profile', () => {
    writeProfileValue('wj.unlocks', 1, ['DOG', 'UNKNOWN']);
    writeProfileValue('wj.unlocks', 2, ['ALIEN']);
    let reveals = 0;
    const unsubscribe = unlockBus.subscribe(() => { reveals += 1; });

    expect(REQUIRED_PALETTE_UNLOCKS.map((def) => def.id)).toEqual([
      'RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND',
    ]);
    expect(grantRequiredPaletteUnlocks(1)).toEqual([
      'RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND',
    ]);
    expect(grantRequiredPaletteUnlocks(1)).toEqual([]);
    expect(readProfileValue<string[]>('wj.unlocks', 1)).toEqual([
      'DOG', 'UNKNOWN', 'RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND',
    ]);
    expect(readProfileValue<string[]>('wj.unlocks', 2)).toEqual(['ALIEN']);
    expect(reveals).toBe(0);
    unsubscribe();
  });
});

describe('chromatic unlocks — checkWordPlayed', () => {
  it('returns the def on first play (case-insensitive), null after / for non-unlock words', () => {
    expect(checkWordPlayed('turtle')?.id).toBe('TURTLE');
    expect(checkWordPlayed('TURTLE')).toBeNull(); // already played
    expect(checkWordPlayed('banana')).toBeNull(); // not an unlock word
  });
});

describe('chromatic unlocks — reveal events', () => {
  it('keeps natural reveals singular and accepts one atomic required-Palette reveal', () => {
    const events: UnlockRevealEvent[] = [];
    const unsubscribe = unlockBus.subscribe((event) => events.push(event));
    const natural = UNLOCKS.find((def) => def.id === 'RED')!;
    writeProfileValue('wj.unlocks', 1, ['RED']);
    const added = new Set(grantRequiredPaletteUnlocks(1));
    const aggregate = {
      type: 'requiredPalette' as const,
      defs: REQUIRED_PALETTE_UNLOCKS.filter((def) => added.has(def.id)),
    };

    unlockBus.emit(natural);
    unlockBus.emit(aggregate);

    expect(events).toEqual([natural, aggregate]);
    expect(events).toHaveLength(2);
    expect(aggregate.defs.map((def) => def.id)).toEqual([
      'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND',
    ]);
    unsubscribe();
  });

  it('queues an aggregate as one 2.6-second reveal and applies presentation before one fanfare', () => {
    const source = readFileSync('src/ui/components/ChromaticReveal.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    const playCss = readFileSync('src/ui/styles/play.css', 'utf8');
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
    const applyAt = source.indexOf('applyPresentation();');
    const fanfareAt = source.indexOf("audio.play('clearFanfare')");
    const queueAt = source.indexOf('setQueue((q) => [...q, event]);');
    const aggregateAt = source.indexOf('{aggregate ? (');
    const naturalAt = source.indexOf(') : (', aggregateAt);
    const aggregateMarkup = source.slice(aggregateAt, naturalAt);
    expect(source).toContain('useState<UnlockRevealEvent[]>([])');
    expect(source).toContain('createPortal(');
    expect(source).toContain('document.body');
    expect(source).toContain('defs.some((def) => def.effect.kind === \'audio\')');
    expect(aggregateMarkup).toContain("t('unlock.requiredPalette')");
    expect(aggregateMarkup).not.toContain('chroma-body');
    expect(aggregateMarkup).not.toContain('active.word');
    expect(source.match(/audio\.play\('clearFanfare'\)/g)).toHaveLength(1);
    expect(source).toContain('setTimeout(() => setQueue((q) => q.slice(1)), 2600)');
    expect(applyAt).toBeLessThan(fanfareAt);
    expect(fanfareAt).toBeLessThan(queueAt);
    const revealZ = Number(css.match(/\.chroma-reveal\s*\{[^}]*z-index:\s*(\d+);/s)?.[1]);
    const pauseZ = Number(playCss.match(/\.pause-overlay\s*\{[^}]*z-index:\s*(\d+);/s)?.[1]);
    const tooltipZ = Number(tokens.match(/--z-tooltip:\s*(\d+);/)?.[1]);
    expect(revealZ).toBeGreaterThan(pauseZ);
    expect(revealZ).toBeLessThan(tooltipZ);
  });
});

describe('chromatic unlocks — activeUnlocks', () => {
  it('uses only the active profile played set', () => {
    markPlayed('GREEN');
    expect(activeUnlocks()).toEqual(new Set(['GREEN']));
  });
});

describe('chromaMatrix — shared raster-art chroma gate', () => {
  it('gates the gameplay audio buses independently through Palette progress', () => {
    applyPresentation();
    expect(audio.isBusEnabled('sfx')).toBe(false);
    expect(audio.isBusEnabled('music')).toBe(false);

    markPlayed('SOUND');
    applyPresentation();
    expect(audio.isBusEnabled('sfx')).toBe(true);
    expect(audio.isBusEnabled('music')).toBe(false);

    markPlayed('MUSIC');
    applyPresentation();
    expect(audio.isBusEnabled('sfx')).toBe(true);
    expect(audio.isBusEnabled('music')).toBe(true);
  });

  const LUM = '0.2126 0.7152 0.0722';

  it('no colour unlocked → exactly grayscale(1)', () => {
    expect(chromaMatrix(new Set())).toBe(
      `${LUM} 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('all four colours → the identity matrix (no filtering)', () => {
    expect(chromaMatrix(new Set(['RED', 'YELLOW', 'GREEN', 'BLUE']))).toBe(
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0',
    );
  });

  it('RED opens the red channel only; green and blue stay on luminance', () => {
    expect(chromaMatrix(new Set(['RED']))).toBe(
      `1 0 0 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('YELLOW opens red AND green — the union of its channels', () => {
    expect(chromaMatrix(new Set(['YELLOW']))).toBe(
      `1 0 0 0 0 0 1 0 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it.each([
    [
      'GREEN',
      ['GREEN'],
      `${LUM} 0 0 0 1 0 0 0 ${LUM} 0 0 0 0 0 1 0`,
    ],
    [
      'BLUE',
      ['BLUE'],
      `${LUM} 0 0 ${LUM} 0 0 0 0 1 0 0 0 0 0 1 0`,
    ],
    [
      'RED + BLUE',
      ['RED', 'BLUE'],
      `1 0 0 0 0 ${LUM} 0 0 0 0 1 0 0 0 0 0 1 0`,
    ],
    [
      'GREEN + BLUE',
      ['GREEN', 'BLUE'],
      `${LUM} 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0`,
    ],
    [
      'YELLOW + BLUE',
      ['YELLOW', 'BLUE'],
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0',
    ],
  ])('%s restores exactly the union of its RGB channels', (_name, ids, expected) => {
    expect(chromaMatrix(new Set(ids))).toBe(expected);
  });

  it('ignores non-colour unlocks', () => {
    expect(chromaMatrix(new Set(['MUSIC', 'SOUND', 'DOG']))).toBe(chromaMatrix(new Set()));
  });
});

describe('unlock-chroma filter — approved raster-art surfaces and state overrides', () => {
  const play = readFileSync(
    fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
    'utf8',
  );
  const screens = readFileSync(
    fileURLToPath(new URL('../src/ui/styles/screens.css', import.meta.url)),
    'utf8',
  );

  /** The declaration block for the rule whose selector list contains `selector`. */
  const ruleFor = (css: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|\\n)${escaped}(?:,|\\s*\\{)`).exec(css);
    const start = match?.index ?? -1;
    expect(start, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(open, close);
  };

  it.each([
    ['.joker-art', () => play],
    ['.shop-joker-art', () => play],
    ['.pack-joker-art', () => play],
    ['.cc-joker-art', () => screens],
  ])('%s carries the chroma-gate filter', (selector, css) => {
    expect(ruleFor(css(), selector)).toContain('filter: url(#unlock-chroma);');
  });

  it.each([
    ['.shopitem .pack-img', () => play],
    ['.pack-open-art', () => play],
    ['.pack-open-piece:not(.generic)', () => play],
    ['.boss-intro-art', () => play],
    ['.bb-art', () => play],
    ['.target-record', () => play],
    ['.bs-boss-art', () => screens],
    ['.bs-kind-art', () => screens],
    ['.bs-tag-icon img', () => screens],
    ['.skip-tag-auto-redeem img', () => screens],
    ['.go-boss-art', () => screens],
    ['.run-choice-art img', () => screens],
    ['.joker-record-sticker', () => screens],
    ['.boss-card-art', () => screens],
    ['.voucher-card', () => screens],
    ['.pack-gallery-art', () => screens],
    ['.tag-collection-icon img', () => screens],
    ['.blind-emblem-art', () => screens],
    ['.pouch-art', () => screens],
  ])('%s gates an approved ordinary raster-art surface', (selector, css) => {
    expect(ruleFor(css(), selector)).toContain('url(#unlock-chroma)');
  });

  it.each([
    ['.boss-intro-art', () => play],
    ['.bb-art', () => play],
    ['.bs-boss-art', () => screens],
    ['.joker-record-sticker', () => screens],
    ['.boss-card-art', () => screens],
    ['.voucher-card', () => screens],
    ['.tag-collection-icon img', () => screens],
    ['.blind-emblem-art', () => screens],
  ])('%s composes the chroma gate with its drop shadow', (selector, css) => {
    const rule = ruleFor(css(), selector);
    expect(rule).toContain('url(#unlock-chroma)');
    expect(rule).toContain('drop-shadow(');
  });

  it('keeps locked, muted, skipped, generic-fallback, and recap states authoritative', () => {
    expect(ruleFor(screens, '.select-preview.locked .run-choice-art img'))
      .toContain('filter: grayscale(1) brightness(0.55);');
    expect(ruleFor(screens, '.voucher-card.muted'))
      .toContain('filter: grayscale(1) brightness(0.62) drop-shadow(');
    expect(ruleFor(screens, '.bs-card.skipped .bs-tag-icon'))
      .toContain('filter: grayscale(1) brightness(.62);');
    expect(ruleFor(play, '.pack-open-piece.generic')).not.toContain('url(#unlock-chroma)');
    expect(ruleFor(screens, '.unlock-recap .voucher-card'))
      .toContain('filter: drop-shadow(');
    expect(ruleFor(screens, '.unlock-recap .voucher-card')).not.toContain('url(#unlock-chroma)');
    expect(ruleFor(screens, '.unlock-recap-object')).not.toContain('url(#unlock-chroma)');
    expect(ruleFor(screens, '.unlock-recap-pair img')).not.toContain('url(#unlock-chroma)');
  });

  it('filters FamilyCardArt inside the SVG so root motion filters stay independent', () => {
    const markup = renderToStaticMarkup(createElement(FamilyCardArt, {
      src: '/family.png',
      title: 'Family card',
    }));
    const root = markup.slice(0, markup.indexOf('>') + 1);
    expect(root).not.toContain('filter=');
    expect(markup).toContain('<g filter="url(#unlock-chroma)">');
  });
});
