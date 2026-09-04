import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  SCORE_TYPEWRITER_KEYCAPS,
  SCORE_TYPEWRITER_LED_COLORS,
  SCORE_TYPEWRITER_PANEL_LED_PHASES_MS,
  SCORE_TYPEWRITER_SIZE_VARIATION,
  SCORE_TYPEWRITER_SAMPLE_COUNT,
  scoreTypewriterLedSlot,
  scoreTypewriterKeySizeVariation,
  scoreTypewriterPanelLedOrder,
  scoreTypewriterSampleIndex,
} from '../src/ui/scoreTypewriter';
import { SCORE_TYPEWRITER_SAMPLES } from '../src/ui/audio';

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
const deskObjects = readFileSync('src/ui/components/DeskObjects.tsx', 'utf8');
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
    expect(css).toContain(':root.world-mono .score-typewriter-dock :is(.typewriter-art, .typewriter-pop) { filter: grayscale(1); }');
    expect(css).not.toContain(':root.world-mono .score-typewriter-dock { filter: grayscale(1); }');
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
    expect(component).toContain("audio.scoreTypewriterKey('Enter', true)");
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
    expect(component).toContain('audio.scoreTypewriterKey(keyId)');
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
    expect(pressFrames).toContain('border-color: var(--key-led)');
    expect(pressFrames).toContain('-2px 0 0 var(--key-led)');
    expect(pressFrames).toContain('2px 0 0 var(--key-led)');
    expect(pressFrames).toContain('0 -2px 0 var(--key-led)');
    expect(pressFrames).toContain('0 2px 0 var(--key-led)');
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

  it('maps all 101 keys across the exact 32 bundled recordings with unknown ids using Enter', () => {
    expect(SCORE_TYPEWRITER_SAMPLE_COUNT).toBe(32);
    expect(SCORE_TYPEWRITER_SAMPLES).toHaveLength(32);
    expect(new Set(SCORE_TYPEWRITER_SAMPLES)).toHaveLength(32);
    expect(SCORE_TYPEWRITER_KEYCAPS).toHaveLength(101);
    expect(SCORE_TYPEWRITER_KEYCAPS.map(({ id }, index) => scoreTypewriterSampleIndex(id)))
      .toEqual(SCORE_TYPEWRITER_KEYCAPS.map((_, index) => index % 32));
    expect(new Set(SCORE_TYPEWRITER_KEYCAPS.map(({ id }) => scoreTypewriterSampleIndex(id))))
      .toEqual(new Set(Array.from({ length: 32 }, (_, index) => index)));
    expect(scoreTypewriterSampleIndex('unknown-key')).toBe(scoreTypewriterSampleIndex('Enter'));
  });

  it('routes only Score Keyboard presses through samples and preserves synthesized ambient keys', () => {
    expect(component).toContain('const keyId = SCORE_TYPEWRITER_KEYCAPS[keySequence[pressIndex] ?? -1]?.id ?? \'Enter\'');
    expect(component).toContain('audio.scoreTypewriterKey(keyId)');
    expect(component).not.toContain("audio.play('deskKeycap'");
    expect(deskObjects).toContain("audio.play('deskKeycap')");
    expect(audio).toMatch(/scoreTypewriterKey\(keyId: string, accent = false\)[\s\S]*?accent \? 'deskEnter' : 'deskKeycap'/);
    expect(audio).toContain('() => this.playRecipe(fallback)');
    expect(audio).toMatch(/deskKeycap:\s*\{[\s\S]*?textured:\s*true/);
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
    expect(runView).toContain('sentenceAssist={blind.previewHidden');
    expect(runView).toContain('Math.max(0, blind.projectedScore - blind.committedScore)');
    expect(runView).toContain('heldTiles={blind.hand}');
    expect(settle).toContain('const sentenceAssistSnapshotRef = useRef({ settleId, value: sentenceAssist })');
    expect(settle).toContain('typewriterSentenceAssist');
    expect(runView).toContain(
      "resolutionActive={((phase === 'playing' && g.state.pendingEnd) || phase === 'cashout') && blind.projectedScore >= blind.target}",
    );
    const resolutionAt = runView.indexOf('resolutionActive={');
    const resolutionGate = runView.slice(resolutionAt, runView.indexOf('}', resolutionAt) + 1);
    expect(resolutionGate).toContain("phase === 'cashout'");
    expect(resolutionGate).not.toContain("phase === 'shop'");
    expect(resolutionGate).not.toContain("phase === 'gameover'");
    expect(sidebar).toContain('holdActive={resolutionActive && settleComplete}');
    expect(sidebar).toContain('settleId={settleId}');
    expect(runView).toContain('settleId={g.state.settleId}');
    expect(component).toContain('scoreTypewriterClearPeak(');
    expect(component).toContain('resolutionActive && holdActive && !active ? clearPeak : 0');
    expect(component).toContain("heldPeak > 0 && 'is-clear-held'");
    expect(component).toContain('scheduleScoreTypewriterClearRepeats(');
    expect(component).toContain('useLayoutEffect(() => {');
    expect(component).toContain('if (heldPeak === 0 || reduce)');
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

  it('uses always-colour key LEDs, per-key Tier 5–6 flames, and no central flame', () => {
    expect(sidebar).not.toContain('burning');
    expect(css).not.toContain('.scorebox.burning');
    expect(css).not.toContain('--flame');
    expect(SCORE_TYPEWRITER_LED_COLORS).toEqual([
      '#ff365c', '#ff8a2b', '#ffe04b', '#45e06f', '#38bdf8', '#b86cff',
    ]);
    expect(new Set(SCORE_TYPEWRITER_LED_COLORS)).toHaveLength(6);
    expect(component).toContain('const ledSlot = scoreTypewriterLedSlot(keyIndex)');
    expect(component).toContain('data-led-slot={ledSlot}');
    expect(component).toContain("'--key-led': SCORE_TYPEWRITER_LED_COLORS[ledSlot]");
    expect(component).toContain('className="typewriter-panel-leds"');
    expect(component).toContain("['red', 'yellow', 'green'].map");
    expect(component).toContain('scoreTypewriterPanelLedOrder(presentationBeatId)');
    expect(component).toContain('SCORE_TYPEWRITER_PANEL_LED_PHASES_MS[panelLedOrder[index] ?? index]');
    expect(SCORE_TYPEWRITER_PANEL_LED_PHASES_MS).toEqual([-120, -280, -440]);
    expect(SCORE_TYPEWRITER_SIZE_VARIATION).toBe(0.05);
    expect(scoreTypewriterKeySizeVariation('beat-a', 0)).toBeGreaterThanOrEqual(0.95);
    expect(scoreTypewriterKeySizeVariation('beat-a', 0)).toBeLessThanOrEqual(1.05);
    expect(component).toContain('const keySizeVariation = scoreTypewriterKeySizeVariation(presentationBeatId, keyIndex)');
    expect(component).toContain("'--key-smoke-scale': String(keySizeVariation * (presentationTier === 6 ? 1.35 : 1))");
    expect(component).toContain("'--key-flame-scale': String(keySizeVariation * (presentationTier === 6 ? 1.25 : 1))");
    expect(component).not.toContain('className="typewriter-smoke"');
    expect(component).toContain('className="typewriter-chassis-smoke"');
    expect(component).toContain('TYPEWRITER_CHASSIS_SMOKE_POINTS.map');
    expect(component).toContain("'--chassis-smoke-scale': String(");
    const chassisSmokePoints = component.slice(
      component.indexOf('const TYPEWRITER_CHASSIS_SMOKE_POINTS'),
      component.indexOf('] as const;'),
    );
    expect(chassisSmokePoints.match(/\[\d+, \d+, -\d+\]/g)).toHaveLength(12);
    const ledOrders = ['beat-a', 'beat-b', 'clear:blind:1:0'].map(scoreTypewriterPanelLedOrder);
    for (const order of ledOrders) expect([...order].sort()).toEqual([0, 1, 2]);
    expect(new Set(ledOrders.map((order) => order.join(','))).size).toBeGreaterThan(1);
    expect(component).not.toContain('typewriter-rainbow-ring');
    expect(component).not.toContain('typewriter-jackpot-sparks');
    expect(SCORE_TYPEWRITER_KEYCAPS.every((_, index) => scoreTypewriterLedSlot(index) === index % 6)).toBe(true);
    expect(css).toContain('.typewriter-key::before');
    expect(css).toContain('@keyframes typewriter-key-smoke');
    expect(css).not.toContain('.typewriter-smoke');
    expect(css).not.toContain('@keyframes typewriter-smoke');
    expect(css).toContain('.typewriter-tier-4.is-active .typewriter-key.is-pressed::before');
    expect(css).toContain('.typewriter-key::after');
    expect(css).toContain('width: clamp(7px, .7vw, 14px)');
    expect(css).toContain('height: clamp(10px, 1.1vw, 22px)');
    expect(css).toContain('box-shadow: -4px 4px 0 var(--key-led), 4px 4px 0 var(--key-led), 0 8px 0 var(--key-led)');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-key.is-pressed::after');
    expect(css).toContain('.typewriter-tier-6.is-active .typewriter-key.is-pressed::after');
    expect(css).toContain('animation: typewriter-key-flame var(--key-duration) steps(3, end) both');
    expect(css).toContain('animation-delay: var(--key-delay)');
    expect(css).not.toContain('.typewriter-tier-6 .typewriter-key { --key-flame-scale: 1.25; }');
    expect(css).toContain('8px -4px 0 -1px var(--key-led)');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-pop');
    expect(css).toContain('.typewriter-tier-6.is-active .typewriter-pop');
    expect(css).not.toContain('typewriter-rainbow-ring');
    expect(css).not.toContain('typewriter-jackpot-sparks');
    expect(css).not.toContain('typewriter-jackpot-spark');
    expect(css).toContain('.typewriter-panel-led {');
    expect(css).toContain('.typewriter-panel-led-red { --panel-led-x: 83.1%; --panel-led-color: #ff365c; }');
    expect(css).toContain('.typewriter-panel-led-yellow { --panel-led-x: 85.9%; --panel-led-color: #ffe04b; }');
    expect(css).toContain('.typewriter-panel-led-green { --panel-led-x: 88.6%; --panel-led-color: #45e06f; }');
    expect(css).toContain('--panel-led-side-left: -5px; --panel-led-side-right: 5px;');
    expect(css).toContain('--panel-led-side-left: -7px; --panel-led-side-right: 7px;');
    expect(css).toContain('var(--panel-led-side-left) 0 var(--panel-led-glow) var(--panel-led-color)');
    expect(css).toContain('var(--panel-led-side-right) 0 var(--panel-led-glow) var(--panel-led-color)');
    expect(css).not.toContain('0 0 0 1px #17120f');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-panel-led');
    expect(css).toContain('.typewriter-tier-6.is-active .typewriter-panel-led');
    expect(css).toContain('.typewriter-tier-5.is-clear-held .typewriter-panel-led');
    expect(css).toContain('.typewriter-tier-6.is-clear-held .typewriter-panel-led');
    expect(css).toContain('animation: typewriter-panel-led-jackpot var(--typewriter-beat) steps(1, end) infinite');
    expect(css).toContain('animation: typewriter-panel-led-jackpot var(--typewriter-ambient-speed) steps(1, end) infinite');
    expect(css).toContain('@keyframes typewriter-panel-led-jackpot');
    expect(css).not.toContain('@keyframes typewriter-panel-led-blink');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-chassis-smoke i:nth-child(-n+7)');
    expect(css).toContain('.typewriter-tier-6.is-active .typewriter-chassis-smoke i');
    expect(css).toContain('.typewriter-tier-5.is-clear-held .typewriter-chassis-smoke i:nth-child(-n+7)');
    expect(css).toContain('.typewriter-tier-6.is-clear-held .typewriter-chassis-smoke i');
    expect(css).toContain('background: #3d454a');
    expect(css).toContain('width: clamp(9px, .75vw, 15px)');
    for (const tier of [0, 1, 2, 3, 4]) {
      expect(css).not.toContain(`.typewriter-tier-${tier}.is-active .typewriter-key.is-pressed::after`);
      expect(css).not.toContain(`.typewriter-tier-${tier}.is-active .typewriter-panel-led`);
    }
    expect(component).not.toContain('className="typewriter-flame"');
    expect(css).not.toContain('.typewriter-flame');
    expect(css).not.toContain('typewriter-meltdown');
    expect(tokens).not.toContain('--score-flame-');
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-key::after,');
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-key::before,');
    expect(css).toContain('.score-typewriter-dock.is-reduced .typewriter-chassis-smoke,');
    expect(css).not.toContain('.score-typewriter-dock.is-reduced .typewriter-panel-led');
    expect(css).toMatch(/\.score-typewriter-dock\.is-reduced\.typewriter-tier-5 \.typewriter-panel-led/);
    expect(css).toMatch(/\.score-typewriter-dock\.is-reduced\.typewriter-tier-6 \.typewriter-panel-led/);
    expect(css).toMatch(/\.force-reduced-motion \.score-typewriter-dock\.typewriter-tier-5 \.typewriter-panel-led/);
    expect(css).toMatch(/\.force-reduced-motion \.score-typewriter-dock\.typewriter-tier-6 \.typewriter-panel-led/);
    for (const tier of [0, 1, 2, 3, 4]) {
      expect(css).not.toContain(`.score-typewriter-dock.is-reduced.typewriter-tier-${tier} .typewriter-panel-led`);
      expect(css).not.toContain(`.force-reduced-motion .score-typewriter-dock.typewriter-tier-${tier} .typewriter-panel-led`);
    }
    const reducedMedia = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMedia).toContain('.score-typewriter-dock .typewriter-key::before { display: none; }');
    expect(reducedMedia).toContain('.score-typewriter-dock .typewriter-key::after { display: none; }');
    expect(reducedMedia).toContain('.score-typewriter-dock .typewriter-chassis-smoke { display: none; }');
    expect(reducedMedia).toContain('.score-typewriter-dock.typewriter-tier-5 .typewriter-panel-led');
    expect(reducedMedia).toContain('.score-typewriter-dock.typewriter-tier-6 .typewriter-panel-led');
    for (const tier of [0, 1, 2, 3, 4]) {
      expect(reducedMedia).not.toContain(`.score-typewriter-dock.typewriter-tier-${tier} .typewriter-panel-led`);
    }
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('--key-led: transparent !important');
    expect(css).toContain('.score-typewriter-dock .typewriter-key::before,');
    expect(css).toContain('.score-typewriter-dock .typewriter-chassis-smoke,');
    expect(css).toContain('.score-typewriter-dock .typewriter-panel-led { display: none; }');
    const worldMonoRule = ':root.world-mono .score-typewriter-dock :is(.typewriter-art, .typewriter-pop) { filter: grayscale(1); }';
    expect(css).toContain(worldMonoRule);
    expect(worldMonoRule).not.toContain('.typewriter-key');
    expect(css).toMatch(/\.typewriter-tier-6\.is-clear-held\s*\{[\s\S]*?--typewriter-ambient-low:\s*\.72;[\s\S]*?--typewriter-ambient-high:\s*\.92;[\s\S]*?--typewriter-ambient-glow:\s*18px;[\s\S]*?--typewriter-ambient-speed:\s*400ms;/);
  });
});
