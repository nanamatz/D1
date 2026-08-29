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
  );
  const typewriterHeight = viewportHeight * 0.94;
  const typewriterTop = viewportHeight * 0.03;
  const typewriterLeft = Math.max(8, gutter - typewriterWidth - 8);
  const keyBankLeft = typewriterLeft + typewriterWidth * 0.54;
  const keyBankTop = typewriterTop + typewriterHeight * 0.06;
  const keyBankWidth = typewriterWidth * 0.44;
  const keyBankHeight = typewriterHeight * 0.88;
  const keycapWidth = Math.max(10, Math.min(viewportWidth * 0.009, 18));
  const keycapHeight = keycapWidth / 1.08;
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
    keyBankLeft,
    keyBankTop,
    keyBankWidth,
    keyBankHeight,
    keycapWidth,
    keycapHeight,
    ordinaryDesk,
    chequeDesk,
  };
};

describe('Score Typewriter presentation contract', () => {
  it('is a persistent body portal driven by local settle strength', () => {
    expect(component).toContain('createPortal(');
    expect(component).toContain('document.body');
    expect(sidebar).toContain('settle.typewriterBeat?.tier');
    expect(settle).toContain('scoreTypewriterEventDelta(');
    expect(settle).toContain('flatScore += scoreEventFlatDelta(e)');
    expect(css).toContain('--typewriter-run-scale: min(var(--ui-scale, 1), var(--run-fit-scale, 1))');
    expect(css).toContain('calc(var(--typewriter-gutter) - 16px)');
    expect(component).not.toContain('SCORE REPORT');
  });

  it('uses a quiet body-only chassis with 27 native DOM keycaps', () => {
    expect(art.subarray(1, 4).toString()).toBe('PNG');
    const width = art.readUInt32BE(16);
    const height = art.readUInt32BE(20);
    const colorType = art.readUInt8(25);
    expect([width, height, colorType]).toEqual([320, 1760, 6]);
    const decoded = PNG.sync.read(art);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;
    let maxChannel = 0;
    const opaqueColors = new Set<string>();
    for (let y = 0; y < decoded.height; y += 1) {
      for (let x = 0; x < decoded.width; x += 1) {
        const index = (y * decoded.width + x) * 4;
        const alpha = decoded.data[index + 3]!;
        if (alpha === 0) {
          hasTransparentPixel = true;
          continue;
        }
        hasOpaquePixel = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        const red = decoded.data[index]!;
        const green = decoded.data[index + 1]!;
        const blue = decoded.data[index + 2]!;
        maxChannel = Math.max(maxChannel, red, green, blue);
        opaqueColors.add(`${red},${green},${blue},${alpha}`);
      }
    }
    expect(hasTransparentPixel).toBe(true);
    expect(hasOpaquePixel).toBe(true);
    expect((maxX - minX + 1) / width).toBeGreaterThanOrEqual(0.88);
    expect((maxX - minX + 1) / width).toBeLessThanOrEqual(0.94);
    const opaqueHeightRatio = (maxY - minY + 1) / height;
    expect(opaqueHeightRatio).toBeGreaterThanOrEqual(0.95);
    expect(opaqueHeightRatio).toBeLessThanOrEqual(0.98);
    expect(opaqueHeightRatio * 0.94).toBeGreaterThanOrEqual(0.9);
    expect(opaqueColors.size).toBeLessThanOrEqual(16);
    expect(maxChannel).toBeLessThanOrEqual(180);
    expect(component).toContain("import scoreTypewriterArt from '../assets/score-typewriter-chassis.png'");
    expect(component).toContain('<img className="typewriter-art" src={scoreTypewriterArt} alt="" />');
    expect(component).toContain('className="typewriter-carriage"');
    expect(component).toContain('className="typewriter-keys"');
    expect(component).toContain('SCORE_TYPEWRITER_KEYCAPS.map');
    expect(component).toContain('type="button"');
    expect(component).toContain('disabled');
    expect(component).toContain('tabIndex={-1}');
    expect(component).toContain('aria-hidden="true"');
    expect(component).not.toContain('onClick=');
    expect(component.match(/<button/g)).toHaveLength(1);
    expect(component).toMatch(/<button[\s\S]*?style=\{\{[\s\S]*?\}\s+as CSSProperties\}\s*\/>/);
    expect(component).toContain("'--key-x': `${keycap.x}%`");
    expect(component).toContain("'--key-y': `${keycap.y}%`");
    expect(component).toContain("'--key-scale': keycap.scale");
    expect(component).toContain("'--key-tilt': `${keycap.tilt}deg`");
    expect(component).not.toContain('SCORE_TYPEWRITER_KEY_ROWS');
    expect(component).not.toContain('typewriter-key-row');
    expect(component).not.toContain('typewriter-space');
    expect(component).not.toContain('>{keycap.id}<');
    expect(component).not.toContain('SPACE');
    expect(helper).not.toContain('QWERTY');
    expect(helper).not.toContain("'Space'");
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
    expect(css).toContain('height: 94vh');
    expect(css).toContain('object-fit: fill');
    expect(css).toContain('opacity: .52');
    expect(css).toContain('filter: brightness(.72) saturate(.55) contrast(.9)');
    expect(css).toContain('.score-typewriter-dock.is-active .typewriter-art { opacity: .62; }');
    expect(css).toContain('z-index: 45');
    expect(css).toContain(':root:has(.screen-stack.transitioning) .score-typewriter-dock { visibility: hidden; }');
    expect(css).toContain('top: 3vh');
    expect(css).toContain('translate: none');
    expect(css).not.toContain('aspect-ratio: 320 / 1280');
    expect(css).not.toContain('.typewriter-body {');
    expect(css).not.toContain('.typewriter-roller {');
  });

  it('reserves symmetric run lanes before fitting width-bound boards', () => {
    expect(tokens).not.toContain(':root:has(.persistent-run)');
    expect(tokens).toContain('--run-side-lane: clamp(96px, 8.333333vw, 160px)');
    expect(tokens).toContain('--run-fit-scale: min(');
    const cases = [
      [960, 600, 768, 96, 80, 564, 68, 68],
      [1440, 1000, 1200, 120, 104, 940, 92, 92],
      [1600, 1000, 1333.333, 133.333, 117.333, 940, 105.333, 105.333],
      [1920, 1080, 1440, 240, 224, 1015.2, 168, 212],
    ] as const;
    for (const [width, height, board, gutter, typewriter, typewriterHeight, ordinaryDesk, chequeDesk] of cases) {
      const layout = runLayout(width, height);
      expect(layout.boardWidth).toBeCloseTo(board, 2);
      expect(layout.gutter).toBeCloseTo(gutter, 2);
      expect(layout.typewriterWidth).toBeCloseTo(typewriter, 2);
      expect(layout.typewriterHeight).toBeCloseTo(typewriterHeight, 2);
      expect(layout.typewriterHeight / height).toBeCloseTo(0.94, 4);
      expect(layout.typewriterLeft + layout.typewriterWidth).toBeLessThanOrEqual(layout.gutter + 0.01);
      expect(layout.typewriterTop).toBeCloseTo(height * 0.03, 4);
      expect(layout.typewriterTop + layout.typewriterHeight).toBeLessThanOrEqual(height + 0.01);
      for (const keycap of SCORE_TYPEWRITER_KEYCAPS) {
        const centerX = layout.keyBankLeft + layout.keyBankWidth * keycap.x / 100;
        const centerY = layout.keyBankTop + layout.keyBankHeight * keycap.y / 100;
        const halfWidth = layout.keycapWidth * keycap.scale / 2;
        const halfHeight = layout.keycapHeight * keycap.scale / 2;
        expect(centerX - halfWidth).toBeGreaterThanOrEqual(layout.keyBankLeft);
        expect(centerX + halfWidth).toBeLessThanOrEqual(layout.keyBankLeft + layout.keyBankWidth);
        expect(centerY - halfHeight).toBeGreaterThanOrEqual(layout.keyBankTop);
        expect(centerY + halfHeight).toBeLessThanOrEqual(layout.keyBankTop + layout.keyBankHeight);
        expect(centerX + halfWidth).toBeLessThanOrEqual(gutter);
      }
      expect(layout.ordinaryDesk).toBeCloseTo(ordinaryDesk, 2);
      expect(layout.chequeDesk).toBeCloseTo(chequeDesk, 2);
      expect(layout.boardWidth / width).toBeGreaterThanOrEqual(0.75);
      expect(layout.typewriterWidth).toBeGreaterThanOrEqual(80);
      expect(layout.ordinaryDesk + 28).toBeLessThanOrEqual(layout.gutter + 0.01);
      expect(layout.chequeDesk + 28).toBeLessThanOrEqual(layout.gutter + 0.01);
    }
    expect(css).toContain('--desk-right-footprint: max(44px, calc(var(--desk-right-gutter) - 28px))');
    expect(css).toContain(':root:has(.persistent-run) .desk-right.desk-check');
  });

  it('keeps target crossing a one-shot cue outside the remounted machine', () => {
    expect(component).toContain('crossedScoreTarget(');
    expect(component).toContain("audio.play('deskBell')");
    expect(component).toContain('durationMs: BALANCE.scoreTypewriter.targetCueMs / beatSpeed');
    expect(component.indexOf('</div>\n      {targetPunch')).toBeGreaterThan(-1);
  });

  it('reuses speed, shake, reduced motion, and SFX without extending settle timing', () => {
    expect(component).toContain("audio.play('deskKeycap'");
    expect(component).toContain("'--typewriter-shake'");
    expect(component).toContain('scoreTypewriterShake(screenshake, tier)');
    expect(component).toContain('scoreTypewriterKeyTiming(beatId, beatSpeed, tier, pressIndex, visualCount)');
    expect(component).toContain('BALANCE.scoreTypewriter.visualKeyCounts[tier]');
    expect(component).toContain('BALANCE.scoreTypewriter.audibleKeyCounts[tier]');
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
    expect(idleKeyRule).toContain('background: #0d151a');
    expect(idleKeyRule).toContain('opacity: .48');
    expect(idleKeyRule).toContain('filter: brightness(.72) saturate(.35) contrast(.9)');
    const pressFrames = css.slice(css.indexOf('@keyframes typewriter-key {'), css.indexOf('@keyframes typewriter-carriage'));
    expect(pressFrames).toContain('translate: -2px 2px');
    expect(pressFrames).toContain('scale: .94');
    expect(pressFrames).toContain('opacity: .76');
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

  it('retains the submission speed snapshot through sentence BUILD and LAND', () => {
    expect(settle).toContain('settleSpeed: number');
    expect(settle).toContain('settleReduced: boolean');
    expect(settle).toContain('typewriterExpectedBase: number');
    expect(settle.match(/setView\(\{ \.\.\.IDLE, settleSpeed, settleReduced, typewriterExpectedBase \}\)/g)).toHaveLength(2);
    expect(sidebar).toContain('gameSpeed={settle.typewriterBeat?.speed ?? settle.settleSpeed}');
    expect(sidebar).toContain('reducedMotion={reducedMotion || settle.settleReduced}');
    expect(sidebar).toContain('scoreTypewriterTier(sentenceDelta, settle.typewriterExpectedBase)');
    expect(settle).toContain('scoreTypewriterBaseSuitMult(beats, baseSuitMult)');
    expect(runView).toContain('lexicon.lookup(lastSubmission.text)?.suit');
    expect(runView).toContain('baseSuitMult={baseSuitMult}');
    expect(sidebar).not.toContain('settle.typewriterBeat?.speed ?? gameSpeed');
  });

  it('latches Reduced Motion during an idle sentence BUILD without replaying the settle', () => {
    expect(settle).toContain('const turnedOn = previous.settleId === settleId && !previous.reduce && reduce;');
    expect(settle).toContain(': { ...current, settleReduced: true });');
    expect(settle).toMatch(
      /setView\(\(current\)[\s\S]*settleReduced: true[\s\S]*if \(activeSettleIdRef\.current === settleId\) \{\s*setReducedRestart/,
    );
  });

  it('retires the sidebar flame while keeping Meltdown flame local to Tier 5', () => {
    expect(sidebar).not.toContain('burning');
    expect(css).not.toContain('.scorebox.burning');
    expect(css).not.toContain('--flame');
    expect(css).toContain('.typewriter-tier-5.is-active .typewriter-flame');
  });
});
