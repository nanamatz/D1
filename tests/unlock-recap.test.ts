import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { newRun } from '../src/engine/run';
import { UnlockRecap } from '../src/ui/components/UnlockRecap';
import { I18nProvider } from '../src/ui/i18n';
import { loadLifetime, writeLifetime } from '../src/ui/lifetime';
import { resetStorageCache } from '../src/ui/storage';
import type { UseGame } from '../src/ui/useGame';
import {
  acknowledgeUnlockLedger,
  createUnlockLedger,
  decodeUnlockNotice,
  finalizeUnlockLedger,
  normalizeUnlockLedger,
  pendingUnlocks,
  resetUnlockRecapTerminal,
  unlockRecapReady,
} from '../src/ui/unlockRecap';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => { mem.set(key, value); },
  removeItem: (key) => { mem.delete(key); },
  clear: () => { mem.clear(); },
  key: (index) => [...mem.keys()][index] ?? null,
  get length() { return mem.size; },
};

beforeEach(() => {
  mem.clear();
  resetStorageCache();
});

describe('integrated unlock recap ledger', () => {
  const recapGame = {
    state: {
      stats: {
        wordsPlayed: 0,
        tilesDiscarded: 0,
        itemsBought: 0,
        rerollsUsed: 0,
        bestWord: null,
        patternCounts: {},
        jokerBlindCounts: {},
        discoveries: 0,
      },
      gameover: null,
    },
    acknowledgeUnlocks: () => undefined,
  } as unknown as UseGame;

  it('diffs a baseline, dedupes, survives reload, and acknowledges exactly once', () => {
    const baseline = createUnlockLedger(['palette:RED', 'emoji:miser']);
    const snapshot = [
      'palette:RED', 'emoji:miser', 'voucher:novel', 'pouch:blue',
      'record:yellow:redLp', 'challenge:risingQuota', 'voucher:novel',
    ];
    const finalized = finalizeUnlockLedger(baseline, newRun('standard'), snapshot);
    expect(unlockRecapReady(finalized)).toBe(true);
    expect(pendingUnlocks(finalized).map((notice) => notice.category)).toEqual([
      'voucher', 'pouch', 'record', 'challenge',
    ]);
    expect(pendingUnlocks([...finalized])).toHaveLength(4);

    const acknowledged = acknowledgeUnlockLedger(finalized);
    expect(pendingUnlocks(acknowledged)).toEqual([]);
    expect(pendingUnlocks(finalizeUnlockLedger(acknowledged, newRun('standard'), snapshot)))
      .toEqual([]);
    expect(unlockRecapReady(resetUnlockRecapTerminal(acknowledged))).toBe(false);
  });

  it('preserves legacy Palette order while baselining unrelated historic content', () => {
    const migrated = normalizeUnlockLedger(
      ['MUSIC', 'RED', 'MUSIC'],
      ['palette:MUSIC', 'palette:RED', 'emoji:miser'],
    );
    const finalized = finalizeUnlockLedger(migrated, newRun('legacy'), [
      'palette:MUSIC', 'palette:RED', 'emoji:miser',
    ]);
    expect(pendingUnlocks(finalized).map((notice) => notice.id)).toEqual(['MUSIC', 'RED']);
  });

  it('applies custom-seed and Challenge category eligibility', () => {
    const ledger = ['baseline:palette:RED'];
    const snapshot = [
      'palette:YELLOW', 'emoji:miser', 'voucher:novel', 'pouch:blue',
      'record:yellow:redLp', 'challenge:risingQuota',
    ];
    expect(pendingUnlocks(finalizeUnlockLedger(
      ledger,
      newRun('custom', { customSeed: true }),
      snapshot,
    )).map((notice) => notice.category)).toEqual(['palette', 'pouch']);
    expect(pendingUnlocks(finalizeUnlockLedger(
      ledger,
      newRun('challenge', { challengeId: 'redPen' }),
      snapshot,
    )).map((notice) => notice.category)).toEqual([
      'palette', 'emoji', 'voucher', 'pouch', 'challenge',
    ]);
  });

  it('absorbs Reveal All bulk state and skips malformed notices', () => {
    writeLifetime({ ...loadLifetime(), unlockAllApplied: true });
    const finalized = finalizeUnlockLedger(
      ['baseline:palette:RED', 'pending:not-real:garbage'],
      newRun('revealed'),
      ['palette:RED', 'emoji:miser', 'voucher:novel'],
    );
    expect(pendingUnlocks(finalized)).toEqual([]);
    expect(decodeUnlockNotice('record:yellow:redLp')).toEqual({
      category: 'record', contextId: 'yellow', id: 'redLp',
    });
    expect(decodeUnlockNotice('garbage')).toBeNull();
    expect(decodeUnlockNotice('emoji:miser:extra')).toBeNull();
  });

  it('drops syntactically valid notices whose ids are not in the live registries', () => {
    expect(pendingUnlocks([
      'pending:emoji:not-real',
      'pending:record:not-a-pouch:redLp',
    ])).toEqual([]);
  });

  it('renders all six categories with bundled art, shared tooltip, and keyboard focus', () => {
    const source = readFileSync('src/ui/components/UnlockRecap.tsx', 'utf8');
    for (const category of ['palette', 'emoji', 'voucher', 'pouch', 'record', 'challenge']) {
      expect(source).toMatch(new RegExp(`notice\\.category [!=]== '${category}'`));
    }
    for (const resolver of ['jokerArt(', 'voucherArt(', 'pouchArt(', 'recordArt(', 'mascotVariantArt(']) {
      expect(source).toContain(resolver);
    }
    expect(source).toContain('<Tooltip');
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('aria-label={card.title}');
    expect(source).toContain('role="dialog" aria-modal aria-labelledby="unlock-recap-title"');
    expect(source).toContain("t(`mascot.${def.effect.variant}`)");
  });

  it('portals only the recap overlay to body, outside the monochrome run frame', () => {
    const recap = readFileSync('src/ui/components/UnlockRecap.tsx', 'utf8');
    const gameOver = readFileSync('src/ui/components/GameOver.tsx', 'utf8');
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');

    expect(recap).toContain("import { createPortal } from 'react-dom';");
    expect(recap).toContain('const overlay = (');
    expect(recap).toContain("typeof document === 'undefined' ? overlay : createPortal(overlay, document.body)");
    expect(tokens).toMatch(/:root\.world-mono \.frame,[\s\S]*filter:\s*grayscale\(1\)/);
    expect(gameOver).toContain('<div className="overlay gameover-overlay">');
    expect(gameOver).not.toContain('createPortal');
  });

  it('keeps the SSR fallback renderable with dialog, pager, cards, and confirmation', () => {
    expect(typeof document).toBe('undefined');
    const html = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(UnlockRecap, {
        g: recapGame,
        notices: [
          { category: 'palette', id: 'RED' },
          { category: 'palette', id: 'YELLOW' },
          { category: 'palette', id: 'GREEN' },
          { category: 'palette', id: 'BLUE' },
        ],
      }),
    ));

    expect(html).toContain('class="overlay gameover-overlay unlock-recap-overlay"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html.match(/class="unlock-recap-card"/g)).toHaveLength(3);
    expect(html).toContain('class="pager"');
    expect(html).toContain('autofocus=""');
  });

  it('returns null for notices that produce no cards without changing hook order', () => {
    const html = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(UnlockRecap, {
        g: recapGame,
        notices: [{ category: 'palette', id: 'NOT_REAL' }],
      }),
    ));
    expect(html).toBe('');
  });

  it('gates the first terminal frame until the post-record recap is ready', () => {
    const gameOver = readFileSync('src/ui/components/GameOver.tsx', 'utf8');
    const gate = gameOver.indexOf('if (!unlockRecapReady(g.state.runUnlocks)) return null');
    const summary = gameOver.indexOf('<div className="overlay gameover-overlay">');
    expect(gate).toBeGreaterThan(0);
    expect(summary).toBeGreaterThan(gate);

    const useGame = readFileSync('src/ui/useGame.ts', 'utf8');
    const record = useGame.indexOf('recordRunEnd({');
    const freeze = useGame.indexOf('const runUnlocks = finalizeUnlockLedger(', record);
    expect(record).toBeGreaterThan(0);
    expect(freeze).toBeGreaterThan(record);
  });

  it('treats the Chapter 38 endpoint as a win in the recap mascot copy', () => {
    const recap = readFileSync('src/ui/components/UnlockRecap.tsx', 'utf8');
    expect(recap).toContain(
      'won={g.state.gameover?.won === true || g.state.gameover?.endlessComplete === true}',
    );
  });

  it('keeps the integrated recap but removes the development-menu preview', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    const menu = readFileSync('src/ui/components/MainMenu.tsx', 'utf8');
    const gameOver = readFileSync('src/ui/components/GameOver.tsx', 'utf8');
    expect(app).not.toContain('UnlockRecapPreview');
    expect(app).not.toContain('UNLOCK_RECAP_PREVIEW');
    expect(app).not.toContain("| 'unlockRecap'");
    expect(menu).not.toContain('menu-unlock-recap');
    expect(menu).not.toContain('onUnlockRecap');
    expect(gameOver).toContain("import { UnlockRecap } from './UnlockRecap'");
    expect(gameOver).toContain('<UnlockRecap g={g} notices={unlocks} />');
  });

  it('uses the shared circular pager only when unlock cards overflow', () => {
    const recap = readFileSync('src/ui/components/UnlockRecap.tsx', 'utf8');
    expect(recap).toContain('const CARDS_PER_PAGE = 3;');
    expect(recap).toContain('visiblePage * CARDS_PER_PAGE');
    expect(recap).toContain('<Pager page={visiblePage} pages={pages} onPage={setPage} />');
  });

  it('keeps recap cards at one size on sparse and full pages', () => {
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(css).toMatch(/\.unlock-recap-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, 148px\);[^}]*grid-auto-rows:\s*214px;[^}]*height:\s*222px;/s);
    expect(css).toMatch(/\.unlock-recap-pager-slot\s*\{[^}]*height:\s*42px;/s);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*?\.unlock-recap-grid\s*\{[^}]*repeat\(2, minmax\(0, 132px\)\);[^}]*grid-auto-rows:\s*178px;[^}]*height:\s*374px;/s);
  });

  it('uses larger readable recap copy and speech bubble', () => {
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(css).toMatch(/\.unlock-recap > p\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.unlock-recap-card strong\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.unlock-recap-overlay \.go-mascot \.mascot-bubble\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*260px;[^}]*font-size:\s*var\(--fs-2xl\)/s);
  });
});
