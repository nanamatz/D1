import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ruRU from '../locales/ru-RU.json';

describe('Russian localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(ruRU).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(ruRU[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(ruRU[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise Russian UI style', () => {
    expect(ruRU['chance.label.mult']).toBe('Множ.');
    expect(ruRU['chance.label.gold']).toBe('Гонорар');
    expect(ruRU['tutorial.firstGibberish.title']).toBe('Белиберда');
    expect(ruRU['tutorial.firstJoker.title']).toBe('Эмодзи-плитка');
    expect(ruRU['bagview.title']).toBe('Мешок');
    expect(ruRU['newrun.record']).toBe('Пластинка');
    expect(ruRU['blind.boss']).toBe('Дедлайн');
    expect(ruRU['btn.play']).toBe('Сыграть слово');
    expect(ruRU['settings.fullscreen']).toBe('Полный экран');
    expect(ruRU['record.greenLp.desc']).toBe('Цели растут быстрее с каждой главой');
    expect(ruRU['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(ruRU['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(ruRU).join('\n')).not.toMatch(/ZXQTAG|ZXQPH|QXZ|▁|\?\?<\s*x\d+\s*>/i);
  });
});
