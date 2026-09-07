import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import frFR from '../locales/fr-FR.json';

describe('French localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(frFR).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(frFR[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(frFR[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise French UI style', () => {
    expect(frFR['chance.label.mult']).toBe('Mult.');
    expect(frFR['chance.label.gold']).toBe('Honoraires');
    expect(frFR['tutorial.firstGibberish.title']).toBe('Charabia');
    expect(frFR['tutorial.firstJoker.title']).toBe('Tuile emoji');
    expect(frFR['bagview.title']).toBe('Sacoche');
    expect(frFR['newrun.record']).toBe('Disque');
    expect(frFR['blind.boss']).toBe('Bouclage');
    expect(frFR['btn.play']).toBe('Jouer le mot');
    expect(frFR['settings.fullscreen']).toBe('Plein écran');
    expect(frFR['record.greenLp.desc']).toBe('Les objectifs augmentent davantage à chaque chapitre');
    expect(frFR['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(frFR['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(frFR).join('\n')).not.toMatch(/ZXQTAG|ZXQPH|QXZ|▁|<\s*x\d+\s*>/i);
    expect(Object.values(frFR).join('\n')).not.toMatch(
      /\b(default-font|sentence pattern|hand size|part-of-speech|in 1,000|twice|6th|Vowel Flush)\b/i,
    );
  });
});
