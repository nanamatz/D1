import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import plPL from '../locales/pl-PL.json';

describe('Polish localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(plPL).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(plPL[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(plPL[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise Polish UI style', () => {
    expect(plPL['chance.label.mult']).toBe('Mnoż.');
    expect(plPL['chance.label.gold']).toBe('Honorarium');
    expect(plPL['tutorial.firstGibberish.title']).toBe('Bełkot');
    expect(plPL['tutorial.firstJoker.title']).toBe('Płytka emoji');
    expect(plPL['bagview.title']).toBe('Worek');
    expect(plPL['newrun.record']).toBe('Płyta');
    expect(plPL['blind.boss']).toBe('Termin');
    expect(plPL['btn.play']).toBe('Zagraj słowo');
    expect(plPL['settings.fullscreen']).toBe('Pełny ekran');
    expect(plPL['record.greenLp.desc']).toBe('Cele rosną szybciej z każdym rozdziałem');
    expect(plPL['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(plPL['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(plPL).join('\n')).not.toMatch(/ZXQTAG|ZXQPH|QXZ|▁|\?\?<\s*x\d+\s*>/i);
  });
});
