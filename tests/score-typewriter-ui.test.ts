import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { SCORE_TYPEWRITER_KEYCAPS } from '../src/ui/scoreTypewriter';

const { PNG } = createRequire(import.meta.url)('pngjs') as {
  PNG: { sync: { read: (input: Buffer) => { width: number; height: number; data: Buffer } } };
};

const component = readFileSync('src/ui/components/ScoreTypewriter.tsx', 'utf8');
const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
const runView = readFileSync('src/ui/components/RunView.tsx', 'utf8');
const settle = readFileSync('src/ui/settle.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');
const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
const helper = readFileSync('src/ui/scoreTypewriter.ts', 'utf8');
const audio = readFileSync('src/ui/audio.ts', 'utf8');
const balance = readFileSync('src/engine/balance.ts', 'utf8');
const art = readFileSync('src/ui/assets/score-typewriter-chassis.png');

const runLayout = (viewportWidth: number, viewportHeight: number) => {
  const lane = Math.max(96, Math.min(viewportWidth / 12, 160));
  const fit = Math.min(
    1,
    (viewportWidth - lane * 2) / 1440,
    (viewportHeight - 4) / 988,
  );
  const boardWidth = 1440 * fit;
  const gutter = (viewportWidth - boardWidth) / 2;
  const typewriterWidth = Math.min(
    230,
    viewportWidth * 0.13,
    Math.max(0, gutter - 16),
    (viewportHeight - 32) / 2,
  );
  const typewriterHeight = typewriterWidth * 2;
  const typewriterTop = (viewportHeight - typewriterHeight) / 2;
  const typewriterLeft = Math.max(8, gutter - typewriterWidth - 8);
  const ordinaryDesk = Math.min(
    Math.max(44, gutter - 28),
    Math.max(112, Math.min(viewportWidth * 0.11, 168)),
  );
  const chequeDesk = Math.min(
    Math.max(44, gutter - 28),
    Math.max(144, Math.min(viewportWidth * 0.17, viewportHeight * 0.22, 260)),
  );
  return {
    boardWidth,
    gutter,
    typewriterWidth,
    typewriterHeight,
    typewriterTop,
    typewriterLeft,
    ordinaryDesk,
    chequeDesk,
  };
};

describe('Score Keyboard presentation contract', () => {
  it('is a persistent body portal driven by settle-local peak strength', () => {
    expect(component).toContain('createPortal(');
    expect(component).toContain('document.body');
    expect(sidebar).toContain('settle.typewriterBeat?.tier');
    expect(settle).toContain('scoreTypewriterEventDelta(');
    expect(settle).toContain('flatScore += scoreEventFlatDelta(e)');
    expect(css).toContain('--typewriter-run-scale: min(var(--ui-scale, 1), var(--run-fit-scale, 1))');
    expect(css).toContain('calc(var(--typewriter-gutter) - 16px)');
    expect(component).not.toContain('SCORE REPORT');
  });

  it('uses an opaque 2:1 old-keyboard body with transparent surroundings and 101 native DOM keycaps', () => {
    expect(art.subarray(1, 4).toString()).toBe('PNG');
    const width = art.readUInt32BE(16);
    const height = art.readUInt32BE(20);
    const colorType = art.readUInt8(25);
    expect([width, height, colorType]).toEqual([1774, 887, 6]);
    expect(width / height).toBe(2);
    const decoded = PNG.sync.read(art);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let transparentPixels = 0;
    let opaquePixels = 0;
    let partialAlphaPixels = 0;
    for (let y = 0; y < decoded.height; y += 1) {
      for (let x = 0; x < decoded.width; x += 1) {
        const index = (y * decoded.width + x) * 4;
        const alpha = decoded.data[index + 3]!;
        if (alpha === 0) {
          transparentPixels += 1;
          continue;
        }
        if (alpha === 255) opaquePixels += 1;
        else partialAlphaPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    expect(minX).toBeGreaterThan(0);
    expect(minX).toBeLessThanOrEqual(width * 0.02);
    expect(minY).toBeGreaterThan(0);
    expect(minY).toBeLessThanOrEqual(height * 0.12);
    expect(maxX).toBeGreaterThanOrEqual(width * 0.98);
    expect(maxX).toBeLessThan(width);
    expect(maxY).toBeGreaterThanOrEqual(height * 0.88);
    expect(maxY).toBeLessThan(height);
    expect(transparentPixels).toBeGreaterThan(0);
    expect(opaquePixels).toBeGreaterThan(0);
    expect(partialAlphaPixels).toBe(0);
    expect(opaquePixels / (width * height)).toBeGreaterThan(0.74);
    expect(opaquePixels / (width * height)).toBeLessThan(0.76);
    expect(decoded.data[3]).toBe(0);
    expect(decoded.data[((Math.floor(height / 2) * width + Math.floor(width / 2)) * 4) + 3]).toBe(255);
    expect(component).toContain("import scoreTypewriterArt from '../assets/score-typewriter-chassis.png'");
    expect(component).toContain('<img className="typewriter-art" src={scoreTypewriterArt} alt="" />');
    expect(component).not.toContain('typewriter-carriage');
    expect(component).toContain('className="typewriter-keys"');
    expect(component).toContain('SCORE_TYPEWRITER_KEYCAPS.map');
    expect(component).toContain('type="button"');
    expect(component).toContain('disabled');
    expect(component).toContain('tabIndex={-1}');
    expect(component).toContain('aria-hidden="true"');
    expect(component).not.toContain('onClick=');
    expect(component.match(/<button/g)).toHaveLength(1);
    expect(component).toMatch(/<button[\s\S]*?style=\{\{[\s\S]*?\}\s+as CSSProperties\}\s*>/);
    expect(component).toContain("'--key-x': `${keycap.x}%`");
    expect(component).toContain("'--key-y': `${keycap.y}%`");
    expect(component).toContain("'--key-w': `${keycap.w}%`");
    expect(component).toContain("'--key-h': `${keycap.h}%`");
    expect(component).toContain('data-key-id={keycap.id}');
    expect(component).toContain('{keycap.label}');
    expect(component).not.toContain('SCORE_TYPEWRITER_KEY_ROWS');
    expect(component).not.toContain('typewriter-key-row');
    expect(component).not.toContain('typewriter-space');
    expect(component).not.toContain('>{keycap.id}<');
    expect(helper).toContain('QWERTYUIOP');
    expect(helper).toContain("id: 'Space'");
    expect(component).not.toContain('score-typewriter-panel.png');
    expect(component).not.toContain('typewriter-paper');
    expect(css).not.toContain('.typewriter-paper');
    expect(css).not.toContain('typewriter-paper-feed');
    expect(css).not.toContain('typewriter-line');
    expect(helper).not.toContain('scoreTypewriterLineTiming');
    expect(balance).not.toContain('lineCounts');
    expect(balance).not.toContain('lineDelayRatio');
    expect(component).not.toContain('typewriter-roller');
    expect(component).not.toContain('typewriter-body');
    expect(component).not.toContain('typewriter-lever');
    expect(css).toContain('calc((100vh - 32px) / 2)');
    expect(css).toContain('height: calc(var(--typewriter-width) * 2)');
    expect(css).toContain('transform: translate(-50%, -50%) rotate(-90deg)');
    expect(css).toContain('width: 200%');
    expect(css).toContain('height: 50%');
    expect(css).toContain('object-fit: contain');
    const artRule = css.slice(css.indexOf('.typewriter-art {'), css.indexOf('.typewriter-keys {'));
    expect(artRule).toContain('opacity: 1');
    expect(artRule).not.toContain('object-fit: fill');
    expect(artRule).not.toContain('filter:');
    expect(css).not.toContain('.score-typewriter-dock.is-active .typewriter-art');
    expect(css).not.toContain('@keyframes typewriter-carriage');
    expect(css).toContain('z-index: 45');
    expect(css).toContain(':root:has(.screen-stack.transitioning) .score-typewriter-dock { visibility: hidden; }');
    expect(css).toContain('top: 50%');
    expect(css).toContain('translate: 0 -50%');
    expect(css).toContain(':root.world-mono .score-typewriter-dock { filter: grayscale(1); }');
    expect(css).not.toContain('.typewriter-body {');
    expect(css).not.toContain('.typewriter-roller {');
  });

  it('reserves symmetric run lanes before fitting width-bound boards', () => {
    expect(tokens).not.toContain(':root:has(.persistent-run)');
    expect(tokens).toContain('--run-side-lane: clamp(96px, 8.333333vw, 160px)');
    expect(tokens).toContain('--run-fit-scale: min(');
    const cases = [
      [960, 600, 768, 96, 80, 160, 68, 68],
      [1440, 1000, 1200, 120, 104, 208, 92, 92],
      [1600, 1000, 1333.333, 133.333, 117.333, 234.666, 105.333, 105.333],
      [1920, 1080, 1440, 240, 224, 448, 168, 212],
      [1920, 600, 868.664, 525.668, 230, 460, 168, 144],
    ] as const;
    for (const [width, height, board, gutter, typewriter, typewriterHeight, ordinaryDesk, chequeDesk] of cases) {
      const layout = runLayout(width, height);
      expect(layout.boardWidth).toBeCloseTo(board, 2);
      expect(layout.gutter).toBeCloseTo(gutter, 2);
      expect(layout.typewriterWidth).toBeCloseTo(typewriter, 2);
      expect(layout.typewriterHeight).toBeCloseTo(typewriterHeight, 2);
      expect(layout.typewriterHeight / layout.typewriterWidth).toBeCloseTo(2, 4);
      expect(layout.typewriterLeft + layout.typewriterWidth).toBeLessThanOrEqual(layout.gutter + 0.01);
      expect(layout.typewriterTop).toBeCloseTo((height - typewriterHeight) / 2, 2);
      expect(layout.typewriterTop + layout.typewriterHeight).toBeLessThanOrEqual(height + 0.01);
      expect(layout.ordinaryDesk).toBeCloseTo(ordinaryDesk, 2);
      expect(layout.chequeDesk).toBeCloseTo(chequeDesk, 2);
      expect(layout.boardWidth).toBeGreaterThanOrEqual(
        Math.min(width * 0.75, 1440 * (height - 4) / 988) - 0.01,
      );
      expect(layout.typewriterWidth).toBeGreaterThanOrEqual(80);
      expect(layout.ordinaryDesk + 28).toBeLessThanOrEqual(layout.gutter + 0.01);
      expect(layout.chequeDesk + 28).toBeLessThanOrEqual(layout.gutter + 0.01);
    }
    expect(SCORE_TYPEWRITER_KEYCAPS).toHaveLength(101);
    expect(SCORE_TYPEWRITER_KEYCAPS.every(({ x, y, w, h }) =>
      x >= 0 && y >= 0 && x + w <= 100 && y + h <= 100,
    )).toBe(true);
    expect(css).toContain('--desk-right-footprint: max(44px, calc(var(--desk-right-gutter) - 28px))');
    expect(css).toContain(':root:has(.persistent-run) .desk-right.desk-check');
  });

  it('aligns the main, navigation, and numpad registries to the three raster wells', () => {
    const range = (role: string) => SCORE_TYPEWRITER_KEYCAPS.filter((key) => key.role === role);
    expect(Math.min(...range('main').map(({ x }) => x))).toBeGreaterThanOrEqual(94 / 1774 * 100);
    expect(Math.max(...range('main').map(({ x, w }) => x + w))).toBeLessThanOrEqual(1138 / 1774 * 100 + 0.01);
    expect(Math.min(...range('nav').map(({ x }) => x))).toBeGreaterThanOrEqual(1177 / 1774 * 100);
    expect(Math.max(...range('nav').map(({ x, w }) => x + w))).toBeLessThanOrEqual(1369 / 1774 * 100 + 0.01);
    expect(Math.min(...range('numpad').map(({ x }) => x))).toBeGreaterThanOrEqual(1404 / 1774 * 100);
    expect(Math.max(...range('numpad').map(({ x, w }) => x + w))).toBeLessThanOrEqual(1662 / 1774 * 100 + 0.01);
  });

  it('turns target crossing into one forced Enter strike and no DING label', () => {
    expect(component).toContain('crossedScoreTarget(');
    expect(component).toContain("audio.play('deskEnter')");
    expect(component).not.toContain("audio.play('deskBell')");
    expect(component).toContain('durationMs: BALANCE.scoreTypewriter.targetCueMs / beatSpeed');
    expect(component).not.toContain('DING!');
    expect(component).not.toContain('typewriter-ding');
    expect(css).not.toContain('.typewriter-ding');
    expect(css).not.toContain('typewriter-target-punch');
    expect(css).toContain('.typewriter-key[data-key-id="Enter"]');
    expect(css).toContain('.score-typewriter-dock.is-reduced.target-punched .typewriter-key[data-key-id="Enter"]');
    expect(css).toContain('.force-reduced-motion .score-typewriter-dock.target-punched .typewriter-key[data-key-id="Enter"]');
    expect(audio).toMatch(/deskEnter:\s*\{[\s\S]*?textured:\s*true/);
  });

  it('reuses speed, shake, reduced motion, and SFX without extending settle timing', () => {
    expect(component).toContain("audio.play('deskKeycap'");
    expect(component).toContain("'--typewriter-shake'");
    expect(component).toContain('scoreTypewriterShake(screenshake, displayTier)');
    expect(component).toContain('presentationBeatId,');
    expect(component).toContain('presentationPrimaryKeyId,');
    expect(component).toContain('const machine = useMemo(() => {');
    const memoizedMachine = component.slice(
      component.indexOf('const machine = useMemo(() => {'),
      component.indexOf("if (typeof document === 'undefined') return null;"),
    );
    expect(memoizedMachine).toContain('SCORE_TYPEWRITER_KEYCAPS.map');
    expect(memoizedMachine).not.toContain('liveTotal');
    expect(component).toContain('BALANCE.scoreTypewriter.visualKeyCounts[presentationTier]');
    expect(component).toContain('BALANCE.scoreTypewriter.audibleKeyCounts[presentationTier]');
    expect(component).toContain("'--key-duration': `${timing.durationMs}ms`");
    expect(css).toContain('.score-typewriter-dock.is-reduced');
    expect(css).toContain('.force-reduced-motion .score-typewriter-dock');
    expect(css).toContain('.score-typewriter-dock.is-active .typewriter-key.is-pressed');
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-key.is-pressed');
    const keyWellRule = css.slice(css.indexOf('.typewriter-keys {'), css.indexOf('.typewriter-key {'));
    expect(keyWellRule).not.toContain('display: grid');
    expect(keyWellRule).not.toContain('background:');
    expect(keyWellRule).not.toContain('border:');
    expect(css).not.toContain('.typewriter-key-row');
    expect(css).not.toContain('.typewriter-space');
    expect(css).not.toContain('outline: max(1px, .12vw) solid var(--gold)');
    const idleKeyRule = css.slice(css.indexOf('.typewriter-key {'), css.indexOf('.typewriter-key:disabled'));
    expect(idleKeyRule).not.toContain('var(--gold)');
    expect(idleKeyRule).toContain('background: #141819');
    expect(idleKeyRule).toContain('opacity: 1');
    expect(idleKeyRule).not.toContain('filter:');
    const pressFrames = css.slice(css.indexOf('@keyframes typewriter-key {'), css.indexOf('@keyframes typewriter-enter-strike'));
    expect(pressFrames).toContain('translate: 0 2px');
    expect(pressFrames).toContain('scale: .94');
    expect(pressFrames).not.toContain('opacity:');
    expect(pressFrames).not.toContain('filter:');
    expect(pressFrames).toContain('box-shadow: inset 1px 1px 0 rgba(190, 178, 137, .16), 0 0 0 #050708');
    expect(pressFrames).not.toContain('var(--gold)');
    expect(helper).toContain('Math.imul');
    expect(helper).not.toContain('Math.random');
    expect(helper).not.toContain("from '../engine/rng'");
    expect(helper).not.toContain('RunState');
    expect(component).toContain('const beatSnapshot = useRef({ beatId, speed: gameSpeed, reduce: requestedReduce })');
    expect(component).toContain('Reduced Motion ON cancels this beat immediately; OFF waits for the next id.');
    expect(component).not.toContain('[active, beatId, gameSpeed, reduce, tier]');
    expect(component).not.toContain('settleDurationMs');
    expect(component).not.toContain('activeKeyClusters');
  });

  it('holds live target progress at committedBefore until the settle is active', () => {
    expect(sidebar).toContain('scoreTypewriterLiveTotal(');
    expect(sidebar.indexOf('bonusActive\n    ? round')).toBeGreaterThan(-1);
  });

  it('raises one settle-local peak and repeats full beats only during clear resolution', () => {
    expect(settle).toContain('settleSpeed: number');
    expect(settle).toContain('settleReduced: boolean');
    expect(settle).toContain('let typewriterTierPeak: ScoreTypewriterTier = 0');
    expect(settle).toContain('scoreTypewriterPeakTier(');
    expect(settle).toContain('typewriterDelta > 0 ? typewriterTierPeak : 0');
    expect(settle).not.toContain('submission.settledScore');
    expect(settle).not.toContain('submissionTier');
    expect(settle).toContain('primaryKeyId: scoreTypewriterPrimaryKey(e, typewriterTiles)');
    expect(settle).toContain("tiles: [...(submission?.tiles ?? []), ...heldTiles]");
    expect(sidebar).toContain("primaryKeyId={settle.typewriterBeat?.primaryKeyId ?? 'Enter'}");
    expect(sidebar).toContain('gameSpeed={settle.typewriterBeat?.speed ?? settle.settleSpeed}');
    expect(sidebar).toContain('reducedMotion={reducedMotion || settle.settleReduced}');
    expect(runView).toContain('target={blind.target}');
    expect(runView).toContain('heldTiles={blind.hand}');
    expect(runView).toContain(
      "resolutionActive={phase === 'playing' && g.state.pendingEnd && blind.projectedScore >= blind.target}",
    );
    expect(sidebar).toContain('holdActive={resolutionActive && settleComplete}');
    expect(sidebar).toContain('settleId={settleId}');
    expect(runView).toContain('settleId={g.state.settleId}');
    expect(component).toContain('scoreTypewriterClearPeak(');
    expect(component).toContain('resolutionActive && holdActive && !active ? clearPeak : 0');
    expect(component).toContain("heldPeak > 0 && 'is-clear-held'");
    expect(component).toContain('scheduleScoreTypewriterClearRepeats(');
    expect(component).toContain('useLayoutEffect(() => {');
    expect(component).toContain('scoreTypewriterClearRepeatMs(heldPeak, beatSpeed)');
    expect(component).toContain('`clear:${blindKey}:${settleId}:${clearCycle}`');
    expect(component).toContain("const presentationPrimaryKeyId = clearRepeating ? 'Enter' : primaryKeyId");
    expect(component).toContain("clearRepeating && 'is-clear-cycle'");
    expect(component).toContain("if (clearRepeating && index === 0) {");
    expect(component).toContain('const displayTier = active ? tier : heldPeak');
    expect(css).toContain('animation: typewriter-ambient-hold var(--typewriter-ambient-speed) steps(2, end) infinite');
    expect(css).not.toContain('typewriter-smoke-hold');
    expect(css).not.toContain('typewriter-flame-hold');
    expect(css).toContain('.score-typewriter-dock.is-clear-cycle .typewriter-key[data-key-id="Enter"]');
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-machine::after');
    expect(css).toContain('.score-typewriter-dock.is-reduced.is-clear-held .typewriter-key[data-key-id="Enter"]');
    expect(component).not.toContain('triggerScreenShake');
    expect(sidebar).not.toContain('sentenceTier');
    expect(sidebar).not.toContain('scoreTypewriterTier(');
    expect(settle).not.toContain('typewriterExpectedBase');
    expect(sidebar).not.toContain('settle.typewriterBeat?.speed ?? gameSpeed');
  });

  it('latches Reduced Motion during an idle sentence BUILD without replaying the settle', () => {
    expect(settle).toContain('const turnedOn = previous.settleId === settleId && !previous.reduce && reduce;');
    expect(settle).toContain(': { ...current, settleReduced: true });');
    expect(settle).toMatch(
      /setView\(\(current\)[\s\S]*settleReduced: true[\s\S]*if \(activeSettleIdRef\.current === settleId\) \{\s*setReducedRestart/,
    );
  });

  it('adds smoke at Tier 4 and keeps flame and POP local to Tier 5', () => {
    expect(sidebar).not.toContain('burning');
    expect(css).not.toContain('.scorebox.burning');
    expect(css).not.toContain('--flame');
    expect(css).toContain('.typewriter-tier-4.is-active .typewriter-smoke');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-flame');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-pop');
    for (const tier of [0, 1, 2, 3, 4]) {
      expect(css).not.toContain(`.typewriter-tier-${tier}.is-active .typewriter-flame`);
    }
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-flame,');
    expect(css).toContain('.force-reduced-motion .score-typewriter-dock .typewriter-flame,');
    const reducedMedia = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMedia).toContain('.score-typewriter-dock .typewriter-flame,');
    expect(component).toContain('viewBox="0 0 16 20"');
    expect(component).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(component).toContain('shapeRendering="crispEdges"');
    expect(component).not.toContain('<path');
    expect(component).not.toContain('fillRule=');
    expect(component).toContain('className="typewriter-flame-outer" x="6" y="0" width="4" height="2"');
    expect(component).toContain('className="typewriter-flame-outer" x="4" y="2" width="8" height="2"');
    expect(component).toContain('className="typewriter-flame-outer" x="2" y="4" width="12" height="4"');
    expect(component).toContain('className="typewriter-flame-outer" x="0" y="8" width="4" height="8"');
    expect(component).toContain('className="typewriter-flame-outer" x="8" y="8" width="8" height="8"');
    expect(component).toContain('className="typewriter-flame-outer" x="0" y="16" width="16" height="4"');
    expect(component.match(/className="typewriter-flame-outer"/g)).toHaveLength(6);
    expect(component).toContain('className="typewriter-flame-core" x="8" y="6" width="4" height="8"');
    const outerRects = [...component.matchAll(
      /<rect className="typewriter-flame-outer" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" \/>/g,
    )].map((match): [number, number, number, number] => [
      Number(match[1]!), Number(match[2]!), Number(match[3]!), Number(match[4]!),
    ]);
    const outerGrid = Array.from({ length: 10 }, () => Array(8).fill(0) as number[]);
    for (const [x, y, width, height] of outerRects) {
      expect([x, y, width, height].every((value) => value % 2 === 0)).toBe(true);
      for (let row = y! / 2; row < (y! + height!) / 2; row += 1) {
        for (let column = x! / 2; column < (x! + width!) / 2; column += 1) {
          outerGrid[row]![column] = outerGrid[row]![column]! + 1;
        }
      }
    }
    expect(outerGrid.flat().every((coverage) => coverage <= 1)).toBe(true);
    expect(outerGrid.map((row) => row.map((coverage) => coverage ? '#' : '.').join(''))).toEqual([
      '...##...',
      '..####..',
      '.######.',
      '.######.',
      '##..####',
      '##..####',
      '##..####',
      '##..####',
      '########',
      '########',
    ]);
    expect(css).toContain('.typewriter-flame-outer { fill: var(--score-flame-outer); stroke: none; }');
    expect(css).toContain('.typewriter-flame-core { fill: var(--score-flame-core); stroke: none; }');
    expect(tokens).toContain('--score-flame-outer: #a9a9a9; /* YELLOW; unlock-yellow → #FF9F0E */');
    expect(tokens).toContain('--score-flame-core: #c3c3c3; /* YELLOW; unlock-yellow → #FFC222 */');
    const redPalette = tokens.slice(tokens.indexOf(':root.unlock-red {'), tokens.indexOf(':root.unlock-yellow {'));
    const yellowPalette = tokens.slice(tokens.indexOf(':root.unlock-yellow {'), tokens.indexOf(':root.unlock-green {'));
    const greenPalette = tokens.slice(tokens.indexOf(':root.unlock-green {'), tokens.indexOf(':root.unlock-blue {'));
    const bluePalette = tokens.slice(tokens.indexOf(':root.unlock-blue {'), tokens.indexOf('/* "Truly monochrome" guard'));
    expect(yellowPalette).toContain('--score-flame-outer: #FF9F0E;');
    expect(yellowPalette).toContain('--score-flame-core: #FFC222;');
    for (const otherPalette of [redPalette, greenPalette, bluePalette]) {
      expect(otherPalette).not.toContain('--score-flame-');
    }
    const basePalette = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('\n}'));
    const flameToken = (block: string, name: string): string | undefined =>
      new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1]?.toUpperCase();
    const paletteBlocks = [redPalette, yellowPalette, greenPalette, bluePalette];
    for (let mask = 0; mask < 16; mask += 1) {
      let outer = flameToken(basePalette, '--score-flame-outer');
      let core = flameToken(basePalette, '--score-flame-core');
      for (let group = 0; group < paletteBlocks.length; group += 1) {
        if ((mask & (1 << group)) === 0) continue;
        outer = flameToken(paletteBlocks[group]!, '--score-flame-outer') ?? outer;
        core = flameToken(paletteBlocks[group]!, '--score-flame-core') ?? core;
      }
      expect(outer, `palette mask ${mask} outer`).toBe((mask & 2) !== 0 ? '#FF9F0E' : '#A9A9A9');
      expect(core, `palette mask ${mask} core`).toBe((mask & 2) !== 0 ? '#FFC222' : '#C3C3C3');
      expect(outer, `palette mask ${mask} tones`).not.toBe(core);
    }
    expect(css).not.toContain('.typewriter-flame i');
    expect(css).not.toContain('clip-path: polygon(50% 0, 100% 65%');
    expect(component).not.toContain('<linearGradient');
    const flameRule = css.slice(css.indexOf('.typewriter-flame {'), css.indexOf('.typewriter-flame svg'));
    expect(flameRule).not.toContain('background:');
    expect(flameRule).not.toContain('box-shadow:');
    expect(flameRule).not.toContain('filter:');
    expect(flameRule).not.toContain('transform:');
    expect(flameRule).not.toContain('transform-origin:');
    const flameGate = css.slice(
      css.indexOf('.typewriter-tier-5.is-active .typewriter-flame'),
      css.indexOf('.score-typewriter-dock.is-clear-held'),
    );
    expect(flameGate).toContain('animation: typewriter-meltdown var(--typewriter-beat) steps(3, end) both');
    const flameFrames = css.slice(
      css.indexOf('@keyframes typewriter-meltdown'),
      css.indexOf('@keyframes typewriter-label-hit'),
    );
    expect(flameFrames).toContain('0%, 35% { scale: .65; }');
    expect(flameFrames).toMatch(/100%\s*\{[^}]*opacity:\s*0/);
  });
});
