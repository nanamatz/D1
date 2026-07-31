import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('latest feedback UI regressions', () => {
  const collection = source('src/ui/components/Collection.tsx');
  const play = source('src/ui/styles/play.css');
  const screens = source('src/ui/styles/screens.css');

  it('adds shared cursor motion to collection bosses and unlocked mascots', () => {
    expect(collection).toContain('<TiltCard idle className="coll-card boss-card">');
    expect(collection).toContain("body={t('collection.mascot.tooltip')}");
    expect(collection).toContain("'mascot-card'");
  });

  it('moves mascot equipping from Settings to Collection', () => {
    const options = source('src/ui/components/Options.tsx');
    expect(options).not.toContain('mascot-picker');
    expect(options).not.toContain("set('mascot'");
    expect(collection).toContain("set('mascot', r.id)");
    expect(collection).toContain("selected ? 'collection.mascot.selected' : 'collection.mascot.select'");
    expect(collection).toContain("activeUnlocks()");
    expect(screens).toContain('.coll-card.mascot-card.selected');
  });

  it('keeps Help compact, restores voiced glossary copy, and omits tutorial replay', () => {
    const options = source('src/ui/components/Options.tsx');
    expect(options).toContain("voicedKeys(`enc.${e.id}`, e.mascot ?? 'woodak')");
    expect(options).not.toContain('tutorial.${e.id}.body');
    expect(options).not.toContain('hasSeen(e.id)');
    expect(options).not.toContain("t('help.undiscovered')");
    expect(options).not.toContain('help.replayIntro');
    expect(options).not.toContain('resetIntro');
    expect(screens).toMatch(
      /\.help-groups\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,/s,
    );
  });

  it('makes the boss entry card 50 percent taller', () => {
    expect(play).toMatch(/\.boss-intro-card\s*\{[^}]*min-height:\s*264px/s);
  });

  it('renders boss-description highlight markup on every plain-text surface', () => {
    for (const component of ['BlindSelect', 'BossIntro', 'RunInfo', 'Sidebar']) {
      const content = source(`src/ui/components/${component}.tsx`);
      expect(content, component).toMatch(/richText\(t\((?:bossDescKey|`bossdesc\.)/);
    }
  });

  it('runs the ordered Constellation score and dissolve sequence', () => {
    const component = source('src/ui/components/PatternLevelUp.tsx');
    expect(component).toContain('patternChipsMult(evt.pattern, evt.from)');
    expect(component).toContain('after.mult - before.mult');
    expect(component).toContain('after.chips - before.chips');
    expect(component).toContain("<CardArt family=\"constellation\"");
    expect(screens).toContain('@keyframes plu-shake');
    expect(screens).toContain('@keyframes plu-card-vanish');
  });

  it('separates material and font names into enhancement tags and left definitions', () => {
    const game = source('src/ui/game.ts');
    expect(game).toContain("tags.push({ label: title, tone: 'material' })");
    expect(game).toContain("tags.push({ label: title, tone: 'font' })");
    expect(game).toContain('sub.push({ title, body:');
    expect(screens).toContain('.tt-enhancement-tag');
    expect(screens).toContain('right: calc(100% + 4px)');
  });

  it('opens revealed pack-card tooltips above the card', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const optionTooltip = pack.slice(pack.indexOf('return tip ? ('), pack.indexOf(') : (', pack.indexOf('return tip ? (')));
    expect(optionTooltip).not.toContain('down');
  });

  it('removes sold placeholders and recentres every live shop row', () => {
    const shop = source('src/ui/components/Shop.tsx');
    expect(shop).not.toContain('className="shop-offer empty"');
    expect(shop.match(/entry\.(item|p) !== null/g)).toHaveLength(2);
    expect(play).toMatch(/\.shop-row\s*\{[^}]*justify-content:\s*center/s);
  });

  it('marks boss-debuffed staged tiles and submitted words without blocking Play', () => {
    const stage = source('src/ui/components/StagePanel.tsx');
    const tray = source('src/ui/components/SentenceTray.tsx');
    expect(stage).toContain('invalid={!!preview?.debuffed}');
    expect(stage).not.toContain('disabled={!g.canPlay || !!preview?.blocked || !!preview?.debuffed');
    expect(tray).toContain("'boss-debuffed'");
    expect(play).toContain('.boss-invalid-tag');
    expect(play).toContain('.word.boss-debuffed');
  });

  it('shows Not Allowed as a transient text-only workspace notice', () => {
    const runView = source('src/ui/components/RunView.tsx');
    const stage = source('src/ui/components/StagePanel.tsx');
    expect(runView).toContain('const NOT_ALLOWED_NOTICE_MS = 1700');
    expect(runView).toContain('className="workspace-not-allowed"');
    expect(runView).toContain('setNotAllowedNotice(null)');
    expect(stage).toContain("message.key !== 'boss.notAllowed'");
    expect(play).toMatch(
      /\.workspace-not-allowed\s*\{[^}]*top:\s*18px[^}]*color:\s*#fff[^}]*font-family:\s*'Jersey 10'[^}]*font-size:\s*clamp\(44px,\s*5vw,\s*76px\)/s,
    );
    expect(play).toContain('@keyframes workspace-not-allowed');
  });

  it('keeps instant use right of its card and reserves boss-reroll space', () => {
    expect(play).toContain('left: calc(100% + 12px)');
    expect(play).not.toContain('left: calc(50% + 38px)');
    expect(screens).toMatch(/\.blindselect \.bs-card\.current\.boss\s*\{[^}]*height:\s*450px/s);
  });

  it('keeps non-target Fables off candidate tiles and shows live pack tooltip values', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    expect(pack).toContain('const targetIds = fableTargetsTiles(fableId) ? tileIds : [];');
    expect(pack).toContain('consumableTooltipExtra(o.id, g.state.run, t)');
    expect(pack).toContain('tip.extra ? { extra: tip.extra }');
  });
});
