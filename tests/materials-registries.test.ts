import { describe, it, expect } from 'vitest';
import { MATERIAL_REGISTRY } from '../src/engine/materials';
import { MATERIALS as COLLECTION_MATERIALS } from '../src/ui/components/Collection';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import type { TileMaterial } from '../src/engine/types';

// MATERIAL_REGISTRY is the engine's own authoritative list of every non-base
// material (I-1 root cause: nine tasks each registered a material here, but
// nobody kept the presentation-layer lists — i18n, Collection.tsx, CSS — in
// sync). 'ceramic' is the base and is never registered, so it's added back
// in by hand to reconstruct the full TileMaterial union at runtime.
const ALL_MATERIALS: TileMaterial[] = ['ceramic', ...MATERIAL_REGISTRY.keys()];

describe('material registries stay in sync with the engine (I-1 regression guard)', () => {
  it('every material has an i18n key in en.json', () => {
    for (const m of ALL_MATERIALS) {
      expect(en as Record<string, string>).toHaveProperty(`material.${m}`);
    }
  });

  it('every material has an i18n key in ko.json', () => {
    for (const m of ALL_MATERIALS) {
      expect(ko as Record<string, string>).toHaveProperty(`material.${m}`);
    }
  });

  it("Collection.tsx's MATERIALS list covers the full TileMaterial union", () => {
    expect([...COLLECTION_MATERIALS].sort()).toEqual([...ALL_MATERIALS].sort());
  });
});
