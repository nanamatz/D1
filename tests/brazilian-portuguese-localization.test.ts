import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ptBR from '../locales/pt-BR.json';

describe('Brazilian Portuguese localization', () => {
  it('matches every source key and preserves line and numeric contracts', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(ptBR[key].split('\n')).toHaveLength(en[key].split('\n').length);
      expect(ptBR[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? []).toEqual(
        en[key].match(/\d+(?:[.,]\d+)*/g)?.sort() ?? [],
      );
    }
  });

  it('uses the approved game glossary and Brazilian UI style', () => {
    expect(ptBR['chance.label.mult']).toBe('Mult.');
    expect(ptBR['chance.label.gold']).toBe('Cachê');
    expect(ptBR['tutorial.firstGibberish.title']).toBe('Sem sentido');
    expect(ptBR['tutorial.firstJoker.title']).toBe('Peça de Emoji');
    expect(ptBR['bagview.title']).toBe('Bolsa');
    expect(ptBR['newrun.record']).toBe('Disco');
    expect(ptBR['blind.boss']).toBe('Prazo Final');
    expect(ptBR['btn.play']).toBe('Jogar palavra');
    expect(ptBR['settings.fullscreen']).toBe('Tela cheia');
    expect(ptBR['intro.step.frame.bodyUnlocked']).toContain('YELLOW');
    expect(ptBR['jokerdesc.misbound']).toContain('[m:+0.5 Mult]');
    expect(Object.values(ptBR).join('\n')).not.toMatch(
      /ZXQPH|commitd|\b(?:ecrã|ficheiro|utilizador|telemóvel|colecção|objecto|adjectivo|interjecção|desactivar|seleccionado|bónus)\b/i,
    );
  });
});
