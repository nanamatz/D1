import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import en from '../locales/en.json';
import ja from '../locales/ja.json';
import { ALL_JOKERS } from '../src/engine/jokers';
import { ALL_VOUCHER_IDS } from '../src/engine/vouchers';
import { ALL_BOSS_IDS } from '../src/engine/bosses';
import { GAMBLER_CARDS } from '../src/ui/gamblerArt';
import { objectName } from '../src/ui/i18n';

describe('Japanese localization style', () => {
  it('uses the approved in-game glossary without known machine-translation errors', () => {
    expect(ja['chance.label.mult']).toBe('倍率');
    expect(ja['chance.label.gold']).toBe('資金');
    expect(ja['rarity.uncommon']).toBe('アンコモン');
    expect(ja['tutorial.firstGibberish.title']).toBe('デタラメ');
    expect(ja['runinfo.title']).toBe('ラン情報');
    expect(ja['gameover.bestWord']).toBe('最高のワード');
    expect(ja['gameover.wordsPlayed']).toBe('プレイしたワード');
    expect(ja['gameover.unlocked']).toBe('このランで解放');
    expect(ja['collection.joker.recordStickerDesc']).toContain('チャプター8');
    expect(ja['pouch.coinPurse.desc']).toContain('各文字タイルの枚数');
    expect(ja['settings.tooltip.uiScale']).toContain('画面内に収まるよう調整');
    expect(ja['settings.tooltip.fullscreen']).not.toContain('全画面表示または全画面表示');
    expect(ja['settings.tooltip.crtEnabled']).not.toContain('CRT パス');
    for (const id of ['lucky', 'fiveColor', 'golden', 'leather'] as const) {
      expect(ja[`pouch.${id}.unlock`]).toContain('ポーチで勝利');
    }
    expect(Object.values(ja).join('\n')).not.toMatch(
      /癌|性病|マルチ(?:ルト)?|チップス|手数料|盲目|上司|音域|パウチ|リセマラ|再ロール|\[n:(?:あ|○)\]|\[a:(?:あ|私)\]| with /u,
    );
  });

  it('keeps character voices distinct and the alien lexicon unchanged', () => {
    expect(ja['voice.dog.won']).toContain('ワン');
    expect(ja['voice.ghost.won']).toContain('〜');
    expect(ja['voice.turtle.won']).toContain('統計');
    for (const key of Object.keys(en).filter((key) => key.startsWith('voice.alien.'))) {
      expect(ja[key as keyof typeof ja]).toBe(en[key as keyof typeof en]);
    }
  });

  it('localizes every rendered object-name family through the shared resolver', () => {
    const dictionary = ja as Record<string, string>;
    const t = (key: string) => dictionary[key] ?? key;
    const families = [
      ['joker', ALL_JOKERS.map(({ id }) => id)],
      ['voucher', ALL_VOUCHER_IDS],
      ['boss', ALL_BOSS_IDS],
      ['gambler', GAMBLER_CARDS.map(({ id }) => id)],
    ] as const;

    for (const [kind, ids] of families) {
      for (const id of ids) {
        expect(objectName(t, kind, id), `${kind}.${id}`).not.toBe(`object.${kind}.${id}`);
      }
    }
    expect(objectName(t, 'joker', 'ceramicArtisan')).toBe('陶芸職人');
    expect(objectName(t, 'voucher', 'storyBook')).toBe('物語の本');
    expect(objectName(t, 'boss', 'letter')).toBe('未開封の手紙');
    expect(objectName(t, 'gambler', 'rainman')).toBe('柳に小野道風');
  });

  it('keeps translated copy inside Blind Select and shared tooltips', () => {
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
    const screens = readFileSync('src/ui/styles/screens.css', 'utf8');
    const tooltip = readFileSync('src/ui/components/Tooltip.tsx', 'utf8');

    expect(tokens).toMatch(/body\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(screens).toMatch(/\.tt-body\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(screens).toMatch(/\.bs-card\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s);
    expect(screens).toContain('.tt-card.tt-portal.sub-stacked .tt-sub-stack');
    expect(tooltip).toContain('viewportContain = true');
    expect(tooltip).toContain("card.classList.toggle('sub-stacked', placement === 'stack')");
  });
});
