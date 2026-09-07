import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import trTR from '../locales/tr-TR.json';

describe('Turkish localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(trTR).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(trTR[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(trTR[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise Turkish UI style', () => {
    expect(trTR['chance.label.mult']).toBe('Çarpan');
    expect(trTR['chance.label.gold']).toBe('Ücret');
    expect(trTR['tutorial.firstGibberish.title']).toBe('Saçmalık');
    expect(trTR['tutorial.firstJoker.title']).toBe('Emoji Taşı');
    expect(trTR['bagview.title']).toBe('Kese');
    expect(trTR['newrun.record']).toBe('Plak');
    expect(trTR['blind.boss']).toBe('Son Teslim');
    expect(trTR['btn.play']).toBe('Kelimeyi oyna');
    expect(trTR['settings.fullscreen']).toBe('Tam ekran');
    expect(trTR['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(trTR['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(trTR).join('\n')).not.toMatch(/ZXQTAG|ZXQPH|QXZ|<\s*x\d+\s*>/i);
  });

  it('keeps corrected Turkish labels free of duplicated machine translation', () => {
    expect(trTR['material.polished']).toBe('Cilalı');
    expect(trTR['consumabledesc.fable6']).toContain('Cilalı');
    expect(trTR['profile.empty']).toBe('Boş');
    expect(trTR['record.yellowLp.name']).toBe('Sarı LP');
    expect(trTR['collection.mascot.selected']).toBe('Seçili');
    expect(trTR['consumabledesc.fable15']).not.toContain('A A A');
  });
});
