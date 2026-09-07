import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import esES from '../locales/es-ES.json';

describe('Spanish (Spain) localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(esES).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(esES[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(esES[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and concise Spain Spanish UI style', () => {
    expect(esES['chance.label.mult']).toBe('Mult.');
    expect(esES['chance.label.gold']).toBe('Honorarios');
    expect(esES['tutorial.firstGibberish.title']).toBe('Galimatías');
    expect(esES['tutorial.firstJoker.title']).toBe('Ficha emoji');
    expect(esES['bagview.title']).toBe('Bolsa');
    expect(esES['newrun.record']).toBe('Disco');
    expect(esES['blind.boss']).toBe('Fecha límite');
    expect(esES['btn.play']).toBe('Jugar palabra');
    expect(esES['settings.fullscreen']).toBe('Pantalla completa');
    expect(esES['record.greenLp.desc']).toBe('Los objetivos suben más por capítulo');
    expect(esES['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(esES['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(esES).join('\n')).not.toMatch(/ZXQTAG|ZXQPH|QXZ|<\s*x\d+\s*>/i);
    expect(Object.values(esES).join('\n')).not.toMatch(/\b(computadora|celular|ustedes)\b/i);
  });
});
