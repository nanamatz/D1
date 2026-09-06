import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';

describe('Simplified Chinese localization style', () => {
  it('uses the approved game glossary and no translation placeholders', () => {
    expect(zhCN['chance.label.mult']).toBe('倍率');
    expect(zhCN['chance.label.gold']).toBe('稿费');
    expect(zhCN['tutorial.firstGibberish.title']).toBe('乱码');
    expect(zhCN['menu.collection']).toBe('收藏');
    expect(zhCN['jokerdesc.alphabeticalOrder']).toContain('[m:+15 倍率]');
    expect(zhCN['pouch.coinPurse.unlock']).toContain('唱片');
    expect(Object.values(zhCN).join('\n')).not.toMatch(
      /ZXQ|ZXENTRY|瓷砖|盲人|盲区|小袋|代金券|坚定的|圆形的|反式|胡言乱语/,
    );
  });

  it('keeps source sentence boundaries and high-risk rules intact', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(zhCN[key].split('\n')).toHaveLength(en[key].split('\n').length);
    }

    expect(zhCN['bossdesc.deadLetter']).toContain('禁用一个字母');
    expect(zhCN['consumabledesc.fable16']).toContain('[n:2]');
    expect(zhCN['consumabledesc.fable16']).toContain('[n:1]');
    expect(zhCN['pouch.purple.desc']).toContain('剩余一个阶段');
    expect(zhCN['pouch.purple.desc']).toContain('剩余一次弃牌');
    expect(zhCN['record.redLp.desc']).toBe('初稿不再奖励稿费');
    expect(zhCN['record.dvd.desc']).toBe('无利息');
  });

  it('uses concise game UI terms instead of literal machine translations', () => {
    expect(zhCN['sidebar.committed']).toBe('已结算');
    expect(zhCN['pos.article']).toBe('冠词');
    expect(zhCN['pos.verbTransitive']).toContain('及物');
    expect(zhCN['settings.resolution']).toBe('分辨率');
    expect(zhCN['menu.profile']).toBe('档案');
  });
});
