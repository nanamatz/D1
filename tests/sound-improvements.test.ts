import { describe, expect, it } from 'vitest';
import type { ScoreEvent } from '../src/engine/types';
import { SFX_NAMES, TEXTURED_SFX_NAMES } from '../src/ui/audio';
import { emojiTriggerSfx } from '../src/ui/settle';

type JokerEvent = Extract<ScoreEvent, { kind: 'joker' }>;
const jokerEvent = (over: Partial<JokerEvent> = {}): JokerEvent => ({
  kind: 'joker',
  jokerId: 'test',
  chipsDelta: 0,
  multDelta: 0,
  ...over,
});

describe('sound improvement manifest', () => {
  it('ships every requested semantic voice', () => {
    expect(SFX_NAMES).toEqual(expect.arrayContaining([
      'coinGain', 'coinLoss', 'packOpen', 'tagSpawn', 'gameOver', 'gameClear',
      'rainbowShimmer', 'jokerChips', 'jokerMult', 'jokerEffect',
    ]));
  });

  it('uses physical texture layers for every previewed sound except the preserved endings', () => {
    expect(TEXTURED_SFX_NAMES).toEqual(expect.arrayContaining([
      'purchase', 'sell', 'reroll', 'coinGain', 'coinLoss', 'packOpen', 'tagSpawn',
      'rainbowShimmer', 'jokerChips', 'jokerMult', 'jokerEffect',
      'matCeramic', 'matPorcelain', 'matChime', 'matGlass', 'matStone',
      'matGlassBreak', 'matThunk', 'matTock', 'matRing', 'matWood', 'matDiceRattle',
    ]));
    expect(TEXTURED_SFX_NAMES).not.toContain('gameOver');
    expect(TEXTURED_SFX_NAMES).not.toContain('gameClear');
  });

  it('routes Emoji Tile triggers by their actual operation', () => {
    expect(emojiTriggerSfx(jokerEvent({ chipsDelta: 20 }))).toBe('jokerChips');
    expect(emojiTriggerSfx(jokerEvent({ multDelta: 2 }))).toBe('jokerMult');
    expect(emojiTriggerSfx(jokerEvent({ goldDelta: 1 }))).toBe('jokerEffect');
  });
});
