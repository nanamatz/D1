import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/components/PackOpening.tsx', 'utf8');
const runView = readFileSync('src/ui/components/RunView.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');

describe('pack-opening transition choreography', () => {
  it('does not attach the opening-end timer to the started-state effect', () => {
    expect(source).toContain('setOpening(true);\n  }, [entering, started]);');
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*if \(!opening\) return;\s*const id = setTimeout\(\(\) => setOpening\(false\), PACK_READY_MS\);[\s\S]*?\}, \[opening\]\);/,
    );
  });

  it('tears off the pack top and pours pixel cards into the revealed fan', () => {
    expect(source).toContain('className="pack-open-piece pack-open-body"');
    expect(source).toContain('className="pack-open-piece pack-open-top"');
    expect(source).not.toContain('pack-open-tear-line');
    expect(source).toContain('className="pack-open-spill-card"');
    expect(source).toContain('Array.from({ length: pack.offer.options.length })');
    expect(css).toContain('@keyframes packTopTear');
    expect(css).toContain('@keyframes packCardSpill');
    expect(css).toContain('@keyframes packChoiceSettle');
    expect(css).not.toContain('@keyframes packShakeBurst');
    expect(css).toMatch(/\.pack-open-stage\s*\{[^}]*animation:\s*packTearRattle \.42s/s);
    expect(css).toMatch(/@keyframes packTearRattle\s*\{[\s\S]*?72%\s*\{[^}]*scale\(1\.12, \.74\)/);
    expect(css).toMatch(/@keyframes packTearRattle\s*\{[\s\S]*?88%\s*\{[^}]*scale\(\.94, 1\.08\)/);
    expect(css).toMatch(/\.pack-open-body\s*\{[^}]*animation:\s*packBodyEmpty \.82s \.28s/s);
    expect(css).toMatch(/\.pack-open-top\s*\{[^}]*animation:\s*packTopTear \.82s \.28s/s);
    expect(css).not.toContain('packTearLine');
    expect(css).toMatch(/\.pack-open-tear-flash\s*\{[^}]*animation:\s*packTearFlash \.56s \.28s/s);
    expect(css).toMatch(/\.pack-open-ink-burst\s*\{[^}]*animation:\s*packInkBurst \.68s \.32s/s);
  });

  it('lands the real choices inside the restored 2265ms locked gate', () => {
    expect(source).toContain('const PACK_READY_MS = 2265');
    expect(source).toContain('const interactionLocked = !pack || entering || !started || opening || closing || !!picking');
    expect(source).toContain("interactionLocked ? { inert: '' }");
    expect(css).toMatch(/packChoiceSettle \.48s[^;]*;\s*animation-delay: 1\.1s/s);
    expect(css).toContain('animation-delay: 1.34s;');
    expect(css).not.toContain('.pack-opening.opening > .panel { visibility: hidden; }');
    expect(source).not.toContain('gameSpeed');
    expect(source).toMatch(/if \(motionOff\(\)\) return;\s*setOpening\(true\)/);
  });

  it('locks sibling held-pack actions until the pack is ready', () => {
    expect(runView).toContain('const [packInteractionLocked, setPackInteractionLocked] = useState(true)');
    expect(runView).toContain('const heldPackUseLocked = candidatePackOpen && packInteractionLocked');
    expect(runView).toContain('onInteractionLockChange={setPackInteractionLocked}');
    expect(runView).toMatch(/onUseConsumable=\{\(id\) => \{\s*if \(heldPackUseLocked/s);
    expect(runView).toMatch(/canUseConsumable=\{\(id\) => \{\s*if \(heldPackUseLocked/s);
    expect(source).toContain('onInteractionLockChange(interactionLocked)');
    expect(source).toContain('onInteractionLockChange(true)');
  });

  it('derives the exact fake-back, real-shell, candidate, and ready endpoints', () => {
    const stagger = css.match(/animation-delay: calc\(1\.5s \+ var\(--candidate-i\) \* (\d+)ms\)/);
    expect(stagger).not.toBeNull();
    expect(css).toMatch(/\.pack-open-spill-card\s*\{[\s\S]*?animation: packCardSpill \.7s/s);
    expect(css).toContain('animation-delay: .66s;');
    expect(420 + 4 * 60 + 700).toBe(1360);
    const twoChoiceLastFake = 420 + 60 + 700;
    expect(twoChoiceLastFake).toBe(1180);
    expect(1100).toBeLessThan(twoChoiceLastFake); // first real shell overlaps the shortest spill
    expect(1100 + 4 * 60 + 480).toBe(1820);
    expect(1500 + 9 * Number(stagger![1]) + 360).toBe(2265);
    expect(css).toMatch(/\.pack-particle\s*\{[\s\S]*?animation: packPixelShard \.72s \.4s/s);
  });

  it('uses a widened image-first footprint for every pack choice', () => {
    expect(source).toContain("'pack-option-card'");
    expect(source).toContain('className="pack-option-visual"');
    expect(source).not.toContain('<span className="n">{name}</span>');
    expect(css).toMatch(/\.pack-fan\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--pack-count,\s*5\),\s*minmax\(0,\s*168px\)\)/s);
    expect(css).toMatch(/\.pack-option-card\s*\{[^}]*aspect-ratio:\s*5\s*\/\s*7/s);
  });
});
