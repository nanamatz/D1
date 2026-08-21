import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('feedback 2 UI regressions', () => {
  it('keeps the mascot picker in one horizontal row', () => {
    const css = source('src/ui/styles/screens.css');
    expect(source('src/ui/components/Collection.tsx')).toContain('card-grid mascot-card-row');
    expect(css).toMatch(
      /\.mascot-collection \.mascot-card-row\s*\{[^}]*flex-flow:\s*row nowrap/s,
    );
    expect(css).toMatch(
      /\.mascot-card-row > \.tt-anchor,\s*\.mascot-card-row > \.mascot-card\s*\{[^}]*flex:\s*1 1 150px;[^}]*width:\s*150px;/s,
    );
  });

  it('shows Tile/Charm pack actions on hover without transforming the button', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const css = source('src/ui/styles/play.css');
    expect(pack).toContain("hoverOnlyAction={o.kind === 'tile' || o.kind === 'joker'}");
    expect(pack.indexOf('</TiltCard>')).toBeLessThan(pack.indexOf('pack-option-action'));
    expect(css).toContain('.pack-option-shell.hover-action:hover > .pack-option-action');
    expect(css).toMatch(
      /\.btn\.pack-option-action:disabled\s*\{[^}]*transform:\s*translateX\(-50%\)/s,
    );
  });

  it('supports held target Fables against both Fable- and Ink-pack candidates', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const run = source('src/ui/components/RunView.tsx');
    const game = source('src/ui/useGame.ts');
    expect(pack).toContain("const candidatesActive = pack.offer.type === 'consumable'");
    expect(pack).toContain('packFableFxBus.on');
    expect(run).toContain("g.state.pack?.offer.type === 'ink'");
    expect(run).toContain('g.useHeldPackFable(id, packCandidateIds)');
    expect(game).toContain("current.pack?.offer.type !== 'ink'");
    expect(game).toContain("prev.pack?.offer.type !== 'ink'");
  });

  it('routes every held Gambler through the live Fable/Ink candidate field', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const run = source('src/ui/components/RunView.tsx');
    const shelf = source('src/ui/components/JokerShelf.tsx');
    const game = source('src/ui/useGame.ts');
    expect(pack).toContain("pack.offer.type !== 'consumable' && pack.offer.type !== 'ink'");
    expect(pack).toContain("effectKind === 'font' ? 'font'");
    expect(pack).toContain('previewGamblerTile(event.id, tile)');
    expect(run).toContain('g.useHeldPackGambler(id, packCandidateIds)');
    expect(run).toContain('gamblerTargetsTiles(id) ? packCandidateIds : []');
    expect(shelf).toContain('(isFableId(c) && fableTargetsTiles(c)) || isGamblerId(c)');
    const heldRoute = game.slice(
      game.indexOf('const useHeldPackGambler = useCallback'),
      game.indexOf('const closePack = useCallback'),
    );
    expect(heldRoute.match(/canUseGambler\(/g)).toHaveLength(2);
    expect(heldRoute).toContain('const activeField = prev.pack.candidateTiles ?? []');
    expect(heldRoute).toContain('const activeTargets = gamblerTargetsTiles(id) ? tileIds : []');
    expect(heldRoute).toContain('candidateTiles = syncCandidates(activeField, result.run)');
    expect(heldRoute).toContain("recordVoucherProgress({ kind: 'consumableUsed', family: 'gambler' })");
    expect(heldRoute).toContain('recordPouchUnlockChanges(prev.run, result.run)');
    expect(heldRoute).toContain("recordEmojiUnlockEvent({ kind: 'consumableUsed'");
    expect(heldRoute).toContain("audio.play('consumableUse')");
    expect(heldRoute).toContain('pack: { ...prev.pack, candidateTiles }');
    expect(heldRoute).toContain('rngCounter: prev.rngCounter + 1');
    expect(heldRoute).not.toContain('consumePackOption');
    expect(heldRoute).not.toContain('picksLeft');
  });

  it('shares one reserved RNG key across held-pack preview and commit', () => {
    const bus = source('src/ui/packFableFx.ts');
    const pack = source('src/ui/components/PackOpening.tsx');
    const game = source('src/ui/useGame.ts');
    const listener = pack.slice(
      pack.indexOf('const off = packFableFxBus.on'),
      pack.indexOf('if (!pack) return null'),
    );
    const heldRoutes = game.slice(
      game.indexOf('const useHeldPackFable = useCallback'),
      game.indexOf('const closePack = useCallback'),
    );

    expect(bus).toContain('rngKey: string');
    expect(bus).toContain('cancel: () => void');
    expect(listener).toContain('makeRng(event.rngKey)');
    expect(listener).not.toContain('g.state.rngCounter');
    expect(listener).toContain('activeEvent?.cancel()');
    expect(listener).toContain('activeEvent = null');
    expect(listener).toContain('onSelectedCandidatesChange([])');
    expect(listener).toContain('const effectMs = motionOff() ? 120 : 900');
    expect(heldRoutes.match(/makeRng\(rngKey\)/g)).toHaveLength(2);
    expect(heldRoutes.match(/prev\.seed !== actionSeed/g)).toHaveLength(2);
    expect(heldRoutes.match(/prev\.rngCounter !== actionCounter/g)).toHaveLength(2);
    expect(heldRoutes.match(/if \(!accepted\) cancel\(\)/g)).toHaveLength(2);
    expect(heldRoutes.match(/rngCounter: prev\.rngCounter \+ 1/g)).toHaveLength(2);

    for (const action of ['sell', 'reorderJokers', 'useConsumable', 'sellConsumable']) {
      const start = game.indexOf(`const ${action} = useCallback`);
      expect(game.slice(start, start + 220), action)
        .toContain('if (heldPackConsumablePending.current) return;');
    }
  });

  it('cancels a pending held action and always commits a requested pack close', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const game = source('src/ui/useGame.ts');
    const heldRoutes = game.slice(
      game.indexOf('const useHeldPackFable = useCallback'),
      game.indexOf('const closePack = useCallback'),
    );
    const closeRoute = game.slice(
      game.indexOf('const closePack = useCallback'),
      game.indexOf('const toggleTile = useCallback'),
    );

    expect(heldRoutes.match(/heldPackConsumableCancel\.current = cancel/g)).toHaveLength(2);
    expect(heldRoutes.match(/heldPackConsumableCancel\.current === cancel/g)).toHaveLength(4);
    expect(closeRoute.indexOf('heldPackConsumableCancel.current?.()'))
      .toBeLessThan(closeRoute.indexOf('setState('));
    expect(closeRoute).toContain('heldPackCloseTransaction.current = transaction');
    expect(closeRoute).toContain('heldPackCloseTransaction.current !== transaction');
    expect(closeRoute).toContain('transaction.timer = setTimeout(commit, delayMs)');
    expect(closeRoute).toContain('heldPackCloseTransaction.current = null');
    expect(closeRoute).toContain('completePendingPackTransition({ ...prev, pack: null })');
    expect(pack).toContain('g.closePack(360)');
    expect(pack).toContain('activeEvent?.cancel()');
    expect(heldRoutes.match(/heldPackCloseTransaction\.current !== null/g)).toHaveLength(2);
  });

  it('cancels close timers before run replacement and on hook unmount', () => {
    const game = source('src/ui/useGame.ts');
    const cancelClose = game.slice(
      game.indexOf('const cancelHeldPackClose = useCallback'),
      game.indexOf('const cancelPackTransactions = useCallback'),
    );
    expect(cancelClose).toContain('heldPackCloseTransaction.current !== transaction');
    expect(cancelClose).toContain('clearTimeout(transaction.timer)');
    expect(cancelClose).toContain('transaction.timer = null');
    expect(game).toContain('useEffect(() => () => cancelPackTransactions()');

    for (const action of ['endRun', 'newGame', 'startRun']) {
      const start = game.indexOf(`const ${action} = useCallback`);
      const body = game.slice(start, start + 500);
      expect(body.indexOf('cancelPackTransactions()'), action).toBeGreaterThan(0);
      const replacement = action === 'endRun' ? body.indexOf('clearRun()') : body.indexOf('setState(next)');
      expect(body.indexOf('cancelPackTransactions()'), action).toBeLessThan(replacement);
    }
  });

  it('previews target-axis changes and keeps tile score feedback at the source', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const tile = source('src/ui/components/Tile.tsx');
    const settle = source('src/ui/settle.tsx');
    expect(pack).toContain('previewFableTile');
    expect(pack).toContain('fable-axis-change');
    expect(tile).toContain("'score-current'");
    expect(tile).toContain('tile-effect-pop');
    expect(settle).toContain('const BASE_STEP = 600');
    expect(settle).toContain('if (e.tileId) triggerTile(e.tileId)');
  });

  it('keeps enhanced tags visible and stabilizes tile-edge tilt', () => {
    const css = source('src/ui/styles/play.css');
    const hooks = source('src/ui/hooks.ts');
    expect(css).toMatch(/\.tile\.polished\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.tile:hover\s*\{[^}]*filter:\s*brightness/s);
    expect(hooks).toContain('let stableRect: DOMRect | null = null');
    expect(hooks).toContain('const r = stableRect ?? el.getBoundingClientRect()');
  });
});
