import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import de from '../locales/de.json';

describe('German localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(de[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(de[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise German UI style', () => {
    expect(de['chance.label.mult']).toBe('Mult.');
    expect(de['chance.label.gold']).toBe('Honorar');
    expect(de['tutorial.firstGibberish.title']).toBe('Kauderwelsch');
    expect(de['tutorial.firstJoker.title']).toBe('Emoji-Kachel');
    expect(de['bagview.title']).toBe('Beutel');
    expect(de['newrun.record']).toBe('Schallplatte');
    expect(de['blind.boss']).toBe('Abgabefrist');
    expect(de['btn.play']).toBe('Wort spielen');
    expect(de['settings.fullscreen']).toBe('Vollbild');
    expect(de['record.greenLp.desc']).toBe('Kapitelziele steigen schneller');
    expect(de['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(de['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(de).join('\n')).not.toMatch(/ZXQPH|QXZ|<\s*x\d+\s*>/i);
  });
});
