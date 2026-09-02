import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { resolve } from '../src/ui/i18n';

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

  // The Help glossary screen was removed 2026-08-01 (screens-spec §2.10); the
  // encounter popups and tooltips are the only explainer surfaces now.
  it('has no Help screen left in Options or its styles', () => {
    const options = source('src/ui/components/Options.tsx');
    expect(options).not.toContain('help');
    expect(options).not.toContain('HelpView');
    expect(screens).not.toContain('.help-groups');
  });

  it('makes the boss entry card 50 percent taller', () => {
    expect(play).toMatch(/\.boss-intro-card\s*\{[^}]*min-height:\s*264px/s);
  });

  it('renders boss-description highlight markup on every plain-text surface', () => {
    for (const component of ['BlindSelect', 'BossIntro', 'RunInfo']) {
      const content = source(`src/ui/components/${component}.tsx`);
      expect(content, component).toMatch(/richText\(bossDescription\(/);
    }
    const sidebar = source('src/ui/components/Sidebar.tsx');
    expect(sidebar).toContain('richText(bossEffect)');
  });

  it('anchors the current Deadline boss description tooltip to a focusable emblem', () => {
    const sidebar = source('src/ui/components/Sidebar.tsx');
    expect(sidebar).toContain('const bossEmblemRef = useRef<HTMLDivElement>(null)');
    expect(sidebar).toContain('body={bossEffect}');
    expect(sidebar).toContain('anchorRef={bossEmblemRef}');
    expect(sidebar).toContain("tabIndex={boss ? 0 : undefined}");
    expect(sidebar).toContain("blind.deadLetter ?? '—'");
    expect(sidebar).toContain('aria-label={boss ? bossName : undefined}');
    expect(sidebar).not.toContain('stripRichText');
  });

  it('interpolates the current Dead Letter in both localized boss tooltips', () => {
    const dicts = { en, ko };
    for (const lang of ['en', 'ko'] as const) {
      const description = resolve(dicts, lang, 'bossdesc.deadLetter', { letter: 'Q' });
      expect(description).toContain('Q');
      expect(description).not.toContain('{letter}');
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
    expect(screens).toContain('--tt-sub-gap: 10px');
    expect(screens).toContain('right: calc(100% + var(--tt-sub-gap))');
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
    const useGame = source('src/ui/useGame.ts');
    expect(stage).toContain('invalid={!!preview?.debuffed}');
    expect(stage).not.toContain('disabled={!g.canPlay || !!preview?.blocked || !!preview?.debuffed');
    expect(tray).toContain("'boss-debuffed'");
    expect(tray).toContain('!sub.debuffed && (');
    expect(tray).toContain('<PosTags candidates={posCandidates(sub, lexicon)} active={activePos} />');
    expect(source('src/ui/game.ts')).toContain('hypothetical.isGibberish || debuffed ? null');
    expect(source('src/ui/game.ts')).toContain('const letterHand = debuffed');
    expect(useGame).toContain('if (!submission.debuffed) {\n        recordEmojiUnlockEvent({');
    expect(useGame).toContain('!submission.isGibberish && !submission.debuffed && (!best || wordScore > best.score)');
    expect(useGame).toMatch(
      /lastPlayed:\s*\{\s*text:\s*submission\.text,\s*isGibberish:\s*submission\.isGibberish,\s*score:\s*wordScore,/s,
    );
    expect(useGame).toContain('if (lp && !lp.isGibberish && recordWord(lp.text))');
    expect(play).toContain('.boss-invalid-tag');
    expect(play).toContain('.word.boss-debuffed');
  });

  it('renders separate, color-coded rectangular POS chips and maps winning parses to raw history', () => {
    const tags = source('src/ui/components/PosTags.tsx');
    const tray = source('src/ui/components/SentenceTray.tsx');
    const stage = source('src/ui/components/StagePanel.tsx');
    expect(tags).not.toContain('pos-marker');
    expect(tags).toContain('role="listitem"');
    expect(tray).toContain('sentenceSequenceForBlind(blind)');
    expect(tray).toContain('judgment.compatiblePos?.[eligible.indexOf(sub)]');
    expect(stage).toContain('<PosTags candidates={preview.pos} className="sp-pos" />');
    expect(play).toMatch(/\.pos-tags\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(play).toMatch(/\.pos-tags\s*\{[^}]*max-width:/s);
    expect(play).toContain('.pos-tag.alternative');
    expect(play).not.toMatch(/\.pos-tag\.alternative\s*\{[^}]*opacity:/s);
  });

  it('shows Not Allowed as a transient text-only workspace notice', () => {
    const runView = source('src/ui/components/RunView.tsx');
    const stage = source('src/ui/components/StagePanel.tsx');
    expect(runView).toContain('const NOT_ALLOWED_NOTICE_MS = 1700');
    expect(runView).toContain('className="workspace-final-notice workspace-not-allowed"');
    expect(runView).toContain('setNotAllowedNotice(null)');
    expect(stage).toContain("message.key !== 'boss.notAllowed'");
    expect(play).toMatch(
      /\.workspace-final-notice\s*\{[^}]*top:\s*18px[^}]*color:\s*#fff[^}]*font-family:\s*'Jersey 10'[^}]*font-size:\s*clamp\(44px,\s*5vw,\s*76px\)/s,
    );
    expect(play).toContain('@keyframes workspace-not-allowed');
  });

  it('announces only the finalized BUILD pattern in the central workspace', () => {
    const runView = source('src/ui/components/RunView.tsx');
    const notice = source('src/ui/useFinalPatternNotice.ts');
    expect(runView).toContain('useFinalPatternNotice(');
    expect(runView).toContain('g.state.sentenceBonus');
    expect(notice).toContain("if (phase !== 'playing') return;");
    expect(notice).toContain('if (!source?.pattern)');
    expect(runView).toContain('className="workspace-final-notice workspace-pattern-notice"');
    expect(runView).toContain("t('sidebar.patternLevel', { n: patternNotice.level })");
    expect(runView).toContain('<PatternIcon pattern={patternNotice.pattern} />');
    expect(runView).not.toContain('blind.projectedScore - blind.committedScore}</div>');
    expect(play).toMatch(/\.workspace-pattern-notice\s*\{[^}]*top:\s*50%[^}]*transform:\s*translate\(-50%,\s*-50%\)[^}]*animation:\s*workspace-pattern-notice 1\.7s/s);
    expect(play).toContain('@keyframes workspace-pattern-notice');
    expect(play).toMatch(/@keyframes workspace-pattern-notice\s*\{[\s\S]*translate\(-50%,\s*-50%\) scale\(1\)/s);
    expect(play).toContain('@keyframes workspace-pattern-notice-reduced');
    expect(play).toMatch(/@keyframes workspace-pattern-notice-reduced\s*\{[\s\S]*opacity:\s*1;\s*transform:\s*translate\(-50%,\s*-50%\)/s);
    expect(play).toMatch(/\.force-reduced-motion \.workspace-final-notice\s*\{[^}]*workspace-final-notice-reduced[^}]*linear/s);
    expect(play).toMatch(/\.force-reduced-motion \.workspace-pattern-notice\s*\{[^}]*workspace-pattern-notice-reduced[^}]*linear/s);
    expect(play).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.workspace-pattern-notice\s*\{[^}]*workspace-pattern-notice-reduced/s);
  });

  it('keeps instant use right of its card and reserves boss-reroll space', () => {
    expect(play).toContain('left: calc(100% + 12px)');
    expect(play).not.toContain('left: calc(50% + 38px)');
    expect(screens).toMatch(/\.blindselect \.bs-card\.current\.boss\s*\{[^}]*min-height:\s*450px/s);
  });

  it('keeps non-target Fables off candidate tiles and shows live pack tooltip values', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    expect(pack).toContain('const targetIds = fableTargetsTiles(fableId) ? tileIds : [];');
    expect(pack).toContain('consumableTooltipExtra(o.id, g.state.run, t)');
    expect(pack).toContain('tip.extra ? { extra: tip.extra }');
  });

  it('keeps canonical English gameplay terms consistent', () => {
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const currencyNameExceptions = new Set(['pouch.coinPurse.name', 'unlock.body.yellow']);

    expect(
      Object.entries(en).filter(
        ([key, value]) =>
          !currencyNameExceptions.has(key) && /\b(gold|money|coins?)\b/i.test(value.replace(/\{gold\}/gi, '')),
      ),
    ).toEqual([]);
    expect(
      Object.entries(en).filter(([, value]) => /\bshops?\b/i.test(value.replace(/Stationery Shops?/gi, ''))),
    ).toEqual([]);
    expect(
      Object.entries(en).filter(([, value]) => /\bemoji tiles?\b/i.test(value.replace(/Emoji Tiles?/g, ''))),
    ).toEqual([]);

    expect(en['skipReward.jugglerTag.desc']).toContain('next blind');
    expect(en['voucherdesc.oldBook']).toContain('per blind');
    expect(en['voice.piyak.enc.shopFirstVisit']).not.toContain('aynthing');

    const voucherProgress = source('src/ui/voucherProgress.ts').replace(/Stationery Shops?/g, '');
    expect(voucherProgress).not.toMatch(/conditionEn: '[^']*\bshops?\b/i);
    expect(voucherProgress).not.toMatch(/conditionEn: '[^']*\bCharm cards?\b/i);
  });
});
