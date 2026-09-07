import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zhTW from '../locales/zh-TW.json';

describe('Traditional Chinese localization', () => {
  it('matches every source key and preserves line boundaries', () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(zhTW[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(zhTW[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved glossary and Taiwan UI terms', () => {
    expect(zhTW['chance.label.mult']).toBe('倍率');
    expect(zhTW['chance.label.gold']).toBe('稿費');
    expect(zhTW['tutorial.firstGibberish.title']).toBe('亂碼');
    expect(zhTW['jokerdesc.alphabeticalOrder']).toContain('[m:+15 倍率]');
    expect(zhTW['pouch.coinPurse.unlock']).toContain('唱片');
    expect(zhTW['settings.resolution']).toBe('解析度');
    expect(zhTW['profile.load']).toBe('載入個人檔案');
    expect(zhTW['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(zhTW['voice.dog.tip.reroll']).toContain('重抽');
    expect(zhTW['blind.boss']).toBe('截稿日');
    expect(zhTW['suittag.standard']).toBe('STD');
    expect(zhTW['patternLevel.chips']).toBe('籌碼');
    expect(zhTW['patternLevel.mult']).toBe('倍率');
    expect(zhTW['consumable.cancer']).toBe('巨蟹座');
    expect(zhTW['consumable.fable20']).toContain('驢子');
    expect(zhTW['jokerdesc.echoChamber']).toMatch(/^複製右側/);
    expect(zhTW['stats.plays']).toBe('打出次數');
    expect(Object.values(zhTW).join('\n')).not.toMatch(
      /筹码|稿费|语域|乱码|单击|销毁|單詞|槽位|插槽|高亮|選項卡|顯示屏|配置檔案|自定義|全屏|禁用|暫存器|音域|重生過|單字手|負載曲線|創紀錄的勝利|模式級別|丟棄物|合集|材料|晶片|薯片|乘數|截止日期|最後期限|許可權|個人資料|罕見|內嵌|輕斜體|鉛版|布什鶯|狼來了的男孩|癌症|屁股|郵票|性病|金融風險管理師|化合物|至關重要的|消極的/,
    );
  });
});
