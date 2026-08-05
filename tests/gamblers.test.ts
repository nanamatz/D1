/**
 * Gambler cards (GDD §10.3) + the Ink Pack (§9.3) — all fourteen effects,
 * their acquisition routes, and the cross-family rolls.
 */
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import {
  GAMBLER_IDS,
  canUseGambler,
  canUseUnheldGambler,
  gamblerTargetsTiles,
  isGamblerId,
  useGambler,
} from '../src/engine/gamblers';
import { LEGENDARY_JOKERS, RARE_JOKERS } from '../src/engine/jokers';
import { startBlind } from '../src/engine/loop';
import { rollPack } from '../src/engine/packs';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { buyItem } from '../src/engine/shop';
import type {
  BlindState,
  ConsumableId,
  PackSlot,
  PatternId,
  RunState,
  ShopState,
  Tile,
} from '../src/engine/types';

const held = (run: RunState, id: ConsumableId): RunState => ({
  ...run,
  consumables: [...run.consumables, id],
});

const setup = (id: ConsumableId, over: Partial<RunState> = {}) => {
  const base = { ...newRun('gambler'), ...over };
  const run = held(base, id);
  const blind: BlindState = startBlind(run, makeRng('gambler-blind'));
  return { run, blind };
};

const rng = (seed = 'g') => makeRng(seed);

/** Deterministic stub: `int` always returns 0 and `shuffle` keeps input order. */
const firstRng: Rng = {
  next: () => 0,
  int: () => 0,
  shuffle: <T,>(items: readonly T[]) => [...items],
};

describe('registry — GDD §10.3', () => {
  it('ships all fourteen supplied cards', () => {
    expect(GAMBLER_IDS).toHaveLength(14);
    expect(isGamblerId('rainman')).toBe(true);
    expect(isGamblerId('sakeCup')).toBe(true);
  });

  it('names and describes every card in both locales', () => {
    const enKeys: Record<string, string> = en;
    const koKeys: Record<string, string> = ko;
    for (const id of GAMBLER_IDS) {
      expect(enKeys[`consumable.${id}`], id).toBeTruthy();
      expect(koKeys[`consumable.${id}`], id).toBeTruthy();
      expect(enKeys[`consumabledesc.${id}`], id).toBeTruthy();
      expect(koKeys[`consumabledesc.${id}`], id).toBeTruthy();
    }
    expect(koKeys['consumabledesc.rainman']).toBe(
      '[w:화이트]가 아닌 무작위 이모지 타일 하나를 [w:화이트]로 바꿉니다\n[n:-1 핸드 크기]',
    );
    expect(koKeys['consumabledesc.sakeCup']).toBe(
      '[r:레인보우]가 아닌 무작위 이모지 타일 하나를 [r:레인보우]로 바꾸고 다른 모든 이모지 타일을 파괴합니다',
    );
    expect(koKeys['consumabledesc.rainman']).not.toContain('.');
    expect(koKeys['consumabledesc.sakeCup']).not.toContain('.');
  });

  it('asks for a target only on the font cards and Curtain', () => {
    const targeting = GAMBLER_IDS.filter(gamblerTargetsTiles);
    expect([...targeting].sort()).toEqual(
      ['barnSwallow', 'bushWarbler', 'cuckoo', 'curtain', 'geese'],
    );
  });

  it('allows only field-free, currently valid Gambler cards to resolve in the shop', () => {
    const run: RunState = {
      ...newRun('gambler-shop'),
      jokers: [{ defId: 'stargazer', edition: 'base', state: {} }],
    };
    expect(GAMBLER_IDS.filter((id) => canUseUnheldGambler(id, run, [], []))).toEqual([
      'boar', 'craneAndSun', 'deer', 'phoenix', 'rainman', 'sakeCup',
    ]);
  });
});

describe('font cards — #1 / #4 / #7 / #11', () => {
  it('moves only the font axis and consumes the card', () => {
    const { run, blind } = setup('barnSwallow');
    const target: Tile = { ...blind.hand[0]!, material: 'glass', edition: 'gray' };
    const field = [target];
    const seeded = {
      ...run,
      bag: run.bag.map((tile) => (tile.id === target.id ? target : tile)),
    };
    const result = useGambler('barnSwallow', seeded, blind, field, [target.id], rng());
    expect(result.ok).toBe(true);
    const after = result.run.bag.find((tile) => tile.id === target.id)!;
    expect(after.font).toBe('black');
    expect(after.material).toBe('glass');
    expect(after.edition).toBe('gray');
    expect(after.letter).toBe(target.letter);
    expect(result.run.consumables).not.toContain('barnSwallow');
  });

  it('is unusable on a tile that already carries the font', () => {
    const { run, blind } = setup('geese');
    const target: Tile = { ...blind.hand[0]!, font: 'bold' };
    expect(canUseGambler('geese', run, [target], [target.id])).toBe(false);
  });

  it('cannot apply a font to Stone', () => {
    const { run, blind } = setup('geese');
    const target: Tile = {
      ...blind.hand[0]!, material: 'stone', letter: null, letterBeforeStone: 'A', font: 'medium',
    };
    expect(canUseGambler('geese', run, [target], [target.id])).toBe(false);
  });
});

describe('#2 Boar — the unique-ownership exception', () => {
  it('keeps one Emoji Tile plus a copy and destroys the rest', () => {
    const { run, blind } = setup('boar', {
      jokers: [
        { defId: 'stargazer', edition: 'white', state: { factor: 1.3 } },
        { defId: 'hypocrite', edition: 'base', state: {} },
        { defId: 'dadaist', edition: 'base', state: {} },
      ],
    });
    const result = useGambler('boar', run, blind, [], [], firstRng);
    expect(result.run.jokers).toHaveLength(2);
    expect(result.run.jokers.every((joker) => joker.defId === 'stargazer')).toBe(true);
    expect(result.run.jokers[0]?.edition).toBe('white');
    // A White original yields a Base copy; the grown state copies across.
    expect(result.run.jokers[1]?.edition).toBe('base');
    expect(result.run.jokers[1]?.state.factor).toBe(1.3);
  });
});

describe('#3 Bridge — one letter, one less hand', () => {
  it('unifies the field and permanently shrinks the hand', () => {
    const { run, blind } = setup('bridge');
    const field = blind.hand.slice(0, 3);
    const result = useGambler('bridge', run, blind, field, [], rng('bridge'));
    const letters = new Set(
      result.run.bag
        .filter((tile) => field.some((f) => f.id === tile.id))
        .map((tile) => tile.letter),
    );
    expect(letters.size).toBe(1);
    expect(result.run.handSize).toBe(run.handSize - 1);
  });

  it('is unusable once the hand reaches its floor', () => {
    const { run, blind } = setup('bridge', { handSize: BALANCE.gambler.bridgeHandSizeFloor });
    expect(canUseGambler('bridge', run, blind.hand, [])).toBe(false);
  });
});

describe('#5 Butterflies / #10 Full Moon — destruction', () => {
  it('Butterflies destroys 5 field tiles for $20 and needs 5 candidates', () => {
    const { run, blind } = setup('butterflies');
    const field = blind.hand.slice(0, 5);
    const result = useGambler('butterflies', run, blind, field, [], firstRng);
    expect(result.run.bag).toHaveLength(run.bag.length - 5);
    expect(result.run.gold).toBe(run.gold + BALANCE.gambler.butterfliesGold);
    expect(canUseGambler('butterflies', run, blind.hand.slice(0, 4), [])).toBe(false);
  });

  it('Butterflies feeds Type Foundry through the shared destruction event', () => {
    const { run, blind } = setup('butterflies', {
      jokers: [{ defId: 'typeFoundry', edition: 'base', state: {} }],
    });
    const result = useGambler('butterflies', run, blind, blind.hand.slice(0, 5), [], firstRng);
    expect(result.run.jokers[0]?.state.factor).toBeCloseTo(
      Math.pow(BALANCE.jokers.typeFoundry.factorPerTile, 5),
    );
  });

  it('Full Moon trades one tile for three vowels enhanced on any one tile axis', () => {
    const { run, blind } = setup('fullMoon');
    const result = useGambler('fullMoon', run, blind, blind.hand.slice(0, 1), [], rng('moon'));
    expect(result.run.bag).toHaveLength(run.bag.length - 1 + 3);
    const born = result.run.bag.filter((tile) => tile.id.startsWith('gb'));
    expect(born).toHaveLength(3);
    for (const tile of born) {
      expect(['A', 'E', 'I', 'O', 'U']).toContain(tile.letter);
      expect(tile.material).not.toBe('stone');
      expect([
        tile.material !== 'ceramic',
        tile.font !== 'medium',
        (tile.edition ?? 'base') !== 'base',
      ].filter(Boolean)).toHaveLength(1);
    }
  });

  it('Full Moon can roll material, font, and edition enhancements', () => {
    const axes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { run, blind } = setup('fullMoon');
      const result = useGambler(
        'fullMoon', run, blind, blind.hand.slice(0, 1), [], rng(`moon-axis-${i}`),
      );
      for (const tile of result.run.bag.filter((candidate) => candidate.id.startsWith('gb'))) {
        if (tile.material !== 'ceramic') axes.add('material');
        if (tile.font !== 'medium') axes.add('font');
        if ((tile.edition ?? 'base') !== 'base') axes.add('edition');
      }
    }
    expect(axes).toEqual(new Set(['material', 'font', 'edition']));
  });
});

describe('#6 Crane and Sun / #12 Phoenix — Emoji Tile creation', () => {
  it('Crane and Sun creates an unowned Rare and zeroes gold', () => {
    const { run, blind } = setup('craneAndSun', { gold: 40 });
    const result = useGambler('craneAndSun', run, blind, [], [], rng('crane'));
    expect(result.run.jokers).toHaveLength(1);
    expect(RARE_JOKERS.some((def) => def.id === result.run.jokers[0]!.defId)).toBe(true);
    expect(result.run.gold).toBe(0);
  });

  it('Phoenix is the normal-play Legendary route and never duplicates one', () => {
    const { run, blind } = setup('phoenix');
    const result = useGambler('phoenix', run, blind, [], [], rng('phoenix'));
    expect(LEGENDARY_JOKERS.some((def) => def.id === result.run.jokers[0]!.defId)).toBe(true);

    const allOwned = held(
      {
        ...newRun('gambler'),
        jokerSlots: 20,
        jokers: LEGENDARY_JOKERS.map((def) => ({
          defId: def.id,
          edition: 'base' as const,
          state: {},
        })),
      },
      'phoenix',
    );
    expect(canUseGambler('phoenix', allOwned, [], [])).toBe(false);
  });
});

describe('#8 Curtain / #9 Deer', () => {
  it('Curtain adds two complete copies with fresh ids', () => {
    const { run, blind } = setup('curtain');
    const source: Tile = { ...blind.hand[0]!, material: 'wood', woodBonusChips: 45 };
    const result = useGambler('curtain', run, blind, [source], [source.id], rng('curtain'));
    const copies = result.run.bag.filter(
      (tile) => tile.id !== source.id && tile.material === 'wood' && tile.woodBonusChips === 45,
    );
    expect(copies).toHaveLength(BALANCE.gambler.curtainCopies);
    expect(new Set(copies.map((tile) => tile.id)).size).toBe(copies.length);
  });

  it('Deer raises all twelve pattern levels by one', () => {
    const { run, blind } = setup('deer');
    const result = useGambler('deer', run, blind, [], [], rng('deer'));
    const patterns = Object.keys(run.patternLevels) as PatternId[];
    expect(patterns).toHaveLength(12);
    for (const pattern of patterns) {
      expect(result.run.patternLevels[pattern]).toBe(run.patternLevels[pattern] + 1);
    }
  });
});

describe('#13 Rainman / #14 Sake Cup — Emoji Tile editions', () => {
  const jokers: RunState['jokers'] = [
    { defId: 'stargazer', edition: 'base', state: { factor: 1.3 } },
    { defId: 'hypocrite', edition: 'violet', state: {} },
    { defId: 'dadaist', edition: 'white', state: {} },
  ];

  it('Rainman adds White to one random Emoji Tile and permanently loses one hand size', () => {
    const mixed = [
      { defId: 'stargazer', edition: 'white' as const, state: { factor: 1.3 } },
      { defId: 'hypocrite', edition: 'base' as const, state: {} },
    ];
    const { run, blind } = setup('rainman', { jokers: mixed });
    const result = useGambler('rainman', run, blind, [], [], firstRng);
    expect(result.ok).toBe(true);
    expect(result.run.jokers).toHaveLength(2);
    expect(result.run.jokers.every((joker) => joker.edition === 'white')).toBe(true);
    expect(result.run.handSize).toBe(run.handSize - BALANCE.gambler.rainmanHandSizeLoss);
    expect(result.run.consumables).not.toContain('rainman');
  });

  it('a shop-bought Rainman resolves later through the held-consumable path', () => {
    const base: RunState = {
      ...newRun('rainman-shop'),
      gold: 10,
      jokers: [
        { defId: 'stargazer', edition: 'white', state: {} },
        { defId: 'hypocrite', edition: 'base', state: {} },
      ],
    };
    const shop: ShopState = {
      items: [{ kind: 'consumable', id: 'rainman', price: BALANCE.gamblerPrice }],
      voucher: null,
      bonusVoucher: null,
      packs: [],
      rerolls: 0,
    };
    const bought = buyItem(base, shop, 0);
    expect(bought.ok).toBe(true);
    expect(bought.run.consumables).toContain('rainman');

    const blind = startBlind(bought.run, makeRng('rainman-shop-blind'));
    const used = useGambler('rainman', bought.run, blind, [], [], firstRng);
    expect(used.ok).toBe(true);
    expect(used.run.consumables).not.toContain('rainman');
    expect(used.run.jokers.every((joker) => joker.edition === 'white')).toBe(true);
  });

  it('requires a non-White Emoji Tile and will not reduce hand size below one', () => {
    const empty = setup('rainman', { jokers: [] });
    expect(canUseGambler('rainman', empty.run, empty.blind.hand, [])).toBe(false);
    const allWhite = setup('rainman', {
      jokers: [{ defId: 'stargazer', edition: 'white', state: {} }],
    });
    const failed = useGambler('rainman', allWhite.run, allWhite.blind, [], [], firstRng);
    expect(failed.ok).toBe(false);
    expect(failed.run.consumables).toContain('rainman');
    expect(failed.run.handSize).toBe(allWhite.run.handSize);
    const floor = setup('rainman', { jokers, handSize: 1 });
    expect(canUseGambler('rainman', floor.run, floor.blind.hand, [])).toBe(false);
  });

  it('Sake Cup adds Rainbow to one random Emoji Tile and destroys every other one', () => {
    const { run, blind } = setup('sakeCup', { jokers });
    const result = useGambler('sakeCup', run, blind, [], [], firstRng);
    expect(result.ok).toBe(true);
    expect(result.run.jokers).toEqual([
      { defId: 'stargazer', edition: 'rainbow', state: { factor: 1.3 } },
    ]);
    expect(result.run.consumables).not.toContain('sakeCup');
  });

  it('Sake Cup cannot consume itself when every Emoji Tile is already Rainbow', () => {
    const allRainbow: RunState['jokers'] = [
      { defId: 'stargazer', edition: 'rainbow', state: {} },
      { defId: 'hypocrite', edition: 'rainbow', state: {} },
    ];
    const { run, blind } = setup('sakeCup', { jokers: allRainbow });
    expect(canUseGambler('sakeCup', run, [], [])).toBe(false);
    const result = useGambler('sakeCup', run, blind, [], [], firstRng);
    expect(result.ok).toBe(false);
    expect(result.run.jokers).toEqual(allRainbow);
    expect(result.run.consumables).toContain('sakeCup');
  });
});

describe('acquisition — GDD §9.3', () => {
  const slot = (type: PackSlot['type']): PackSlot => ({ type, size: 'jumbo', artVariant: 0 });

  it('an Ink Pack deals only Gambler cards', () => {
    const offer = rollPack(slot('ink'), newRun('ink'), makeRng('ink-pack'));
    expect(offer.options.length).toBeGreaterThan(0);
    for (const option of offer.options) {
      expect(option.kind).toBe('consumable');
      expect(isGamblerId((option as { id: ConsumableId }).id)).toBe(true);
    }
  });

  it('a Fable Pack can only roll the Phoenix jackpot without Comic Book', () => {
    const run = newRun('fable-pack');
    for (let i = 0; i < 40; i++) {
      const offer = rollPack(slot('consumable'), run, makeRng(`fable-${i}`));
      for (const option of offer.options) {
        const id = (option as { id: ConsumableId }).id;
        expect(!isGamblerId(id) || id === 'phoenix').toBe(true);
      }
    }
  });

  it('Comic Book lets at most one non-jackpot Fable choice become a Gambler card', () => {
    const run: RunState = { ...newRun('comic'), vouchers: ['comicBook'] };
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const offer = rollPack(slot('consumable'), run, makeRng(`comic-${i}`));
      const gamblers = offer.options.filter((option) => {
        const id = (option as { id: ConsumableId }).id;
        return isGamblerId(id) && id !== 'phoenix';
      });
      expect(gamblers.length).toBeLessThanOrEqual(1);
      seen += gamblers.length;
    }
    expect(seen).toBeGreaterThan(0); // ~5% per choice over 200 packs
  });

  it('Deer rolls independently for each Constellation choice', () => {
    const run = newRun('deer-pack');
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const offer = rollPack(slot('pattern'), run, makeRng(`deer-${i}`));
      const deer = offer.options.filter(
        (option) => (option as { id: ConsumableId }).id === 'deer',
      );
      seen += deer.length;
    }
    expect(seen).toBeGreaterThan(0); // 0.3% per choice over 400 packs
  });
});
