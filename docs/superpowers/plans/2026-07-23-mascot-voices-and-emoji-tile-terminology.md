# Mascot Voices & Emoji Tile Terminology Implementation Plan

> **Superseded note (2026-08-31):** this is the historical execution plan for
> the original 2026-07-23 delivery. Its former requirement that Egoji's Korean
> and English alien strings match exactly is retired. The live rule is the
> normative design spec linked below: one fixed alien lexicon, Romanized English,
> fixed Hangul Korean transliterations, and no subtitle. The Task 8 examples and
> tests below are annotated to reflect that newer decision.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each WooDak skin its own written voice, name the ghost/alien mascots 이고야/이고지, and switch the player-facing term "Joker" to "Emoji Tile".

**Architecture:** A new `voice.<skin>.<line>` locale namespace replaces the scattered `woodak.*` / `tutorial.*.body` / `mascot.welcome.*` keys. `t()` gains ordered-key-array lookup so a chain can be passed; `voicedKeys()` in `src/ui/mascots.ts` is the single place that knows which skin is speaking and builds that chain, always falling back to WooDak's line. Only three components read mascot copy, so the routing change is small and the rest of the work is content.

**Tech Stack:** TypeScript (strict), React 18, Vite 8, Vitest 4. Locale data is flat JSON key→string in `locales/en.json` and `locales/ko.json`.

**Spec:** `docs/superpowers/specs/2026-07-23-mascot-voices-and-emoji-tile-terminology-design.md`

## Global Constraints

- **Engine identifiers are never renamed.** `JokerDef`, `src/engine/jokers/`, `BALANCE.jokerSlots`, `RunState.jokers`, and the locale key *names* containing `joker` all stay. Only display strings change. (CLAUDE.md terminology rule.)
- **Canonical display term:** **이모지 타일 / Emoji Tile**; short form **이모지 / Emoji** where space is tight.
- **Mascot display names:** 우땅/WooDak, 삐약/Piyak, 누렁이/Nurungi, 이고야/**Egoya** (ghost), 이고지/**Egoji** (alien), 느무보/**Nemubo** (turtle). The turtle is 느무보, **not** 느무시.
- **Skin ids never change:** `woodak | dog | ghost | alien | turtle`. The Palette trigger words stay `GHOST` / `ALIEN`.
- **이고지 speaks untranslated alien only, with no subtitle,** built strictly from the approved lexicon. English uses Romanized tokens and Korean uses the fixed Hangul mapping in the normative spec (superseded 2026-08-31).
- **Richtext markup is preserved** in every rewritten encounter body: `[c:…]` chips, `[m:…]` mult, `[b:…]` blind. Ordinary Korean uses `[c:칩]`/`[m:배수]`/`[b:블라인드]`; ordinary English uses `[c:chips]`/`[m:mult]`/`[b:blind]`; Egoji uses `[c:chi]`/`[m:mul]`/`[b:blin]` in English and `[c:치]`/`[m:물]`/`[b:블린]` in Korean.
- **Locale JSON files are flat** — one `"key": "value"` per line, no nesting. Keep keys grouped with their neighbours and preserve the existing file ordering style.
- **Out of scope:** any engine rename, `intro.step.*` re-voicing, per-mascot audio or typography, and bundles B–E of the batch.
- Run tests with `npx vitest run <path>`. **Never** run a bare `npx vitest run` after a `tsc -b` without checking for a `dist/` directory — the build emits compiled copies of the tests there and Vitest globs them, producing phantom failures. If `dist/` exists, delete it first.

---

### Task 1: `t()` accepts an ordered key chain

Callers need to ask for "the dog's line, else WooDak's line". `t()` currently takes one key and falls back English → raw key. It gains array support while every existing single-key call keeps working.

**Files:**
- Modify: `src/ui/i18n.tsx:17-43`
- Test: `tests/mascot-voice.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `t: (key: string | string[], params?: TParams) => string`. Given an array, returns the string for the first key present in the active-language dict, then the first present in the English dict, then the last key verbatim. Given a string, behaviour is unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/mascot-voice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const EN = en as Record<string, string>;
const KO = ko as Record<string, string>;

/**
 * A faithful copy of i18n.tsx's resolver, so these tests exercise the real
 * lookup rules (chain order, English fallback, {param} interpolation) against
 * the real locale files without mounting React.
 */
function makeT(lang: 'en' | 'ko') {
  const dict = lang === 'ko' ? KO : EN;
  return (key: string | string[], params?: Record<string, string | number>): string => {
    const keys = Array.isArray(key) ? key : [key];
    let s =
      keys.map((k) => dict[k]).find((v) => v !== undefined) ??
      keys.map((k) => EN[k]).find((v) => v !== undefined) ??
      keys[keys.length - 1]!;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

describe('t() key chains', () => {
  it('returns the first present key in the chain', () => {
    const t = makeT('en');
    expect(t(['nope.absent.key', 'common.back'])).toBe(EN['common.back']);
  });

  it('falls through every absent key to the last key verbatim', () => {
    const t = makeT('en');
    expect(t(['nope.a', 'nope.b'])).toBe('nope.b');
  });

  it('still resolves a plain string key', () => {
    const t = makeT('ko');
    expect(t('common.back')).toBe(KO['common.back']);
  });

  it('interpolates params through a chain', () => {
    const t = makeT('en');
    expect(t(['nope.absent', 'collection.found'], { n: 7 })).toContain('7');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `Cannot find module '../locales/en.json'` is *not* expected (it exists); the real failure is on the assertions if `common.back` / `collection.found` are missing. If all four pass immediately, that is fine — this test pins the contract the real `t()` must match, and Step 3 makes the real `t()` match it.

- [ ] **Step 3: Implement the array-aware resolver**

In `src/ui/i18n.tsx`, change the `I18n` interface signature and the resolver:

```tsx
interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** A plain key, or an ordered chain: the first key present wins. Used by the
   *  mascot voice router (mascots.ts `voicedKeys`) to fall back to WooDak's line. */
  t: (key: string | string[], params?: TParams) => string;
}
```

```tsx
      t: (key, params) => {
        const keys = Array.isArray(key) ? key : [key];
        let s =
          keys.map((k) => DICTS[lang][k]).find((v) => v !== undefined) ??
          keys.map((k) => DICTS.en[k]).find((v) => v !== undefined) ??
          keys[keys.length - 1]!;
        if (params) {
          for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
        }
        return s;
      },
```

Note the fallback is resolved **chain-first, then language**: every key is tried in the active language before any key is tried in English. That keeps a skin's Korean line from being beaten by WooDak's English one.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, 4 tests.

Then confirm nothing else broke: `npx vitest run` → PASS (all existing suites).

- [ ] **Step 5: Commit**

```bash
git add src/ui/i18n.tsx tests/mascot-voice.test.ts
git commit -m "feat(i18n): t() accepts an ordered key chain

The mascot voice router needs to ask for a skin's line with a fallback to
WooDak's. Chain order is resolved within the active language first, then
within English, so a skin's Korean line is never beaten by a WooDak English one.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `voicedKeys()` — the single skin-aware router

**Files:**
- Modify: `src/ui/mascots.ts` (append after `mascotSrc`, around line 106)
- Test: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: `t: (key: string | string[], params?) => string` from Task 1; existing `WOODAK_SKINS`, `isUsable`, `activeUnlocks`, `readSelection` in `mascots.ts`.
- Produces:
  - `voiceChain(line: string, role: 'woodak' | 'piyak', skin: WooDakSkin, active: Set<string>): string[]` — pure, exported for tests.
  - `voicedKeys(line: string, role?: 'woodak' | 'piyak'): string[]` — reads the live selection from storage; `role` defaults to `'woodak'`.

- [ ] **Step 1: Write the failing test**

Append to `tests/mascot-voice.test.ts`:

```ts
import { voiceChain } from '../src/ui/mascots';

describe('voiceChain — skin-aware key routing', () => {
  const ALL = new Set(['DOG', 'GHOST', 'ALIEN', 'TURTLE']);

  it('routes a non-default skin to its own key, then WooDak', () => {
    expect(voiceChain('won', 'woodak', 'dog', ALL)).toEqual(['voice.dog.won', 'voice.woodak.won']);
  });

  it('routes the default skin to a single WooDak key', () => {
    expect(voiceChain('tip.3', 'woodak', 'woodak', ALL)).toEqual(['voice.woodak.tip.3']);
  });

  it('ignores the skin for Piyak, a fixed role', () => {
    expect(voiceChain('enc.shopFirstVisit', 'piyak', 'dog', ALL)).toEqual([
      'voice.piyak.enc.shopFirstVisit',
    ]);
  });

  it('falls back to WooDak when the selected skin is not unlocked', () => {
    expect(voiceChain('won', 'woodak', 'ghost', new Set())).toEqual(['voice.woodak.won']);
  });

  it('falls back to WooDak for an unknown skin id', () => {
    expect(voiceChain('won', 'woodak', 'nope' as never, ALL)).toEqual(['voice.woodak.won']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `"voiceChain" is not exported by "src/ui/mascots.ts"`.

- [ ] **Step 3: Implement the router**

Append to `src/ui/mascots.ts`:

```ts
/**
 * Fallback chain of locale keys for one mascot-voiced line.
 *
 * Piyak is a fixed role — she is never re-skinned, so her chain is a single key.
 * WooDak applies the player's selected skin and ALWAYS keeps `voice.woodak.<line>`
 * as the tail, so a skin that has not written a given line (or is no longer usable
 * — unlock reset, art removed, unknown id) degrades to WooDak's copy instead of
 * rendering a raw key. Pure so it can be tested without storage; `voicedKeys` is
 * the storage-reading wrapper callers use.
 */
export function voiceChain(
  line: string,
  role: 'woodak' | 'piyak',
  skin: WooDakSkin,
  active: Set<string>,
): string[] {
  if (role === 'piyak') return [`voice.piyak.${line}`];
  const def = WOODAK_SKINS.find((s) => s.id === skin);
  if (!def || def.id === 'woodak' || !isUsable(def, active)) return [`voice.woodak.${line}`];
  return [`voice.${def.id}.${line}`, `voice.woodak.${line}`];
}

/**
 * THE key resolver for every mascot render site — the only place that knows which
 * skin is speaking. Reads the live selection from storage (like `mascotSrc`), so
 * long-lived hosts such as TutorialHost never hold a stale copy. Pass the result
 * straight to `t()`, which resolves the chain (i18n.tsx).
 *
 * NEVER write a `voice.*` key literal at a call site — go through here.
 */
export function voicedKeys(line: string, role: 'woodak' | 'piyak' = 'woodak'): string[] {
  const { mascot, unlockAll } = readSelection();
  return voiceChain(line, role, mascot, activeUnlocks(unlockAll));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/mascots.ts tests/mascot-voice.test.ts
git commit -m "feat(mascots): voicedKeys() routes dialogue to the selected skin

voiceChain is pure (skin + unlock set in, key chain out) and voicedKeys is the
storage-reading wrapper, mirroring the existing woodakArt/mascotSrc split. The
WooDak key always tails the chain so an unwritten or unusable skin degrades to
WooDak's copy rather than a raw key.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Migrate existing copy into the `voice.*` namespace

Pure move + rewire. No new content, no wording changes — those come in Tasks 5–9. After this task the game must look and read exactly as before.

**Files:**
- Modify: `locales/en.json`, `locales/ko.json`
- Modify: `src/ui/components/WooDakMascot.tsx:6-26`
- Modify: `src/ui/components/TutorialPopup.tsx:49`
- Modify: `src/ui/components/ShopMascot.tsx:6-19`
- Modify: `CLAUDE.md` (mascot bullet)
- Test: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: `voicedKeys(line, role?)` from Task 2; array-aware `t()` from Task 1.
- Produces: the locale namespace later tasks fill in —
  - `voice.woodak.won`, `voice.woodak.discovery`
  - `voice.woodak.tip.reroll`, `.tip.discard`, `.tip.shop`, `.tip.0` … `.tip.4`
  - `voice.woodak.enc.<id>` for the 13 WooDak encounters
  - `voice.piyak.enc.shopFirstVisit`, `voice.piyak.welcome.0` … `.welcome.7`
- Produces: `pickLine(stats)` in `WooDakMascot.tsx` now returns a **bare line id** (`'won'`, `'tip.reroll'`, `'tip.3'`), not a full key.

- [ ] **Step 1: Write the failing test**

Append to `tests/mascot-voice.test.ts`:

Note the locale files are **flat** with dotted key names, so key presence is checked
with the bracket form (`dict['a.b']`). Do **not** use `toHaveProperty('a.b')` — Vitest
reads the dot as a path and would look for a nested object.

```ts
import { ENCOUNTERS } from '../src/ui/tutorial';

/** Every line id the code can ask a WooDak-role mascot for. */
const WOODAK_LINES: string[] = [
  'won',
  'discovery',
  'tip.reroll',
  'tip.discard',
  'tip.shop',
  'tip.0', 'tip.1', 'tip.2', 'tip.3', 'tip.4',
  ...ENCOUNTERS.filter((e) => e.mascot === 'woodak').map((e) => `enc.${e.id}`),
];

/** Every line id the code can ask Piyak for. */
const PIYAK_LINES: string[] = [
  'enc.shopFirstVisit',
  ...Array.from({ length: 8 }, (_, i) => `welcome.${i}`),
];

const RETIRED = [/^woodak\./, /^mascot\.welcome\./, /^tutorial\..*\.body$/];

describe('voice namespace migration', () => {
  it('covers 23 WooDak line ids', () => {
    expect(WOODAK_LINES).toHaveLength(23);
  });

  it('has every WooDak line in both locales', () => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.woodak.${line}`], `en voice.woodak.${line}`).toBeTypeOf('string');
      expect(KO[`voice.woodak.${line}`], `ko voice.woodak.${line}`).toBeTypeOf('string');
    }
  });

  it('has every Piyak line in both locales', () => {
    for (const line of PIYAK_LINES) {
      expect(EN[`voice.piyak.${line}`], `en voice.piyak.${line}`).toBeTypeOf('string');
      expect(KO[`voice.piyak.${line}`], `ko voice.piyak.${line}`).toBeTypeOf('string');
    }
  });

  it('leaves no retired keys behind', () => {
    for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
      const stale = Object.keys(dict).filter((k) => RETIRED.some((re) => re.test(k)));
      expect(stale, `${name} still has retired keys`).toEqual([]);
    }
  });

  it('has no orphan voice keys — every one is a line the code can request', () => {
    for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
      const orphans = Object.keys(dict)
        .filter((k) => k.startsWith('voice.'))
        .filter((k) => {
          const rest = k.slice('voice.'.length);
          const skin = rest.slice(0, rest.indexOf('.'));
          const line = rest.slice(rest.indexOf('.') + 1);
          return skin === 'piyak' ? !PIYAK_LINES.includes(line) : !WOODAK_LINES.includes(line);
        });
      expect(orphans, `${name} has orphan voice keys`).toEqual([]);
    }
  });

  it('keeps encounter titles out of the voice namespace', () => {
    for (const e of ENCOUNTERS) {
      expect(EN[`tutorial.${e.id}.title`], `en title ${e.id}`).toBeTypeOf('string');
      expect(KO[`tutorial.${e.id}.title`], `ko title ${e.id}`).toBeTypeOf('string');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `en voice.woodak.won: expected undefined to be type 'string'`.

- [ ] **Step 3: Rename the keys in both locale files**

This is a mechanical rename. In **both** `locales/en.json` and `locales/ko.json`, keeping each pre-existing string value unchanged:

| old key | new key |
|---|---|
| `woodak.won` | `voice.woodak.won` |
| `woodak.discovery` | `voice.woodak.discovery` |
| `woodak.tip.reroll` | `voice.woodak.tip.reroll` |
| `woodak.tip.discard` | `voice.woodak.tip.discard` |
| `woodak.tip.shop` | `voice.woodak.tip.shop` |
| `woodak.tip.0` … `woodak.tip.4` | `voice.woodak.tip.0` … `voice.woodak.tip.4` |
| `mascot.welcome.0` … `mascot.welcome.7` | `voice.piyak.welcome.0` … `voice.piyak.welcome.7` |
| `tutorial.shopFirstVisit.body` | `voice.piyak.enc.shopFirstVisit` |
| `tutorial.<id>.body` for the 13 WooDak ids below | `voice.woodak.enc.<id>` |

The 13 WooDak encounter ids: `firstGibberish`, `firstLetterHand`, `firstPattern`, `firstUnison`, `firstMaterial`, `firstFont`, `firstJoker`, `firstConsumable`, `firstVoucher`, `firstPack`, `magnifier`, `pouchHover`, `firstBoss`.

**Do not touch** `tutorial.<id>.title` (14 keys), `tutorial.gotIt`, or `intro.*`.

- [ ] **Step 4: Rewire `WooDakMascot.tsx`**

`pickLine` returns bare ids now, and `voicedKeys` builds the chains:

```tsx
import { useState } from 'react';
import { useI18n } from '../i18n';
import { mascotSrc, voicedKeys } from '../mascots';
import type { RunStats } from '../useGame';

/** Size of the tip.N generic pool in the locale files. */
const GENERIC_TIPS = 5;

/** Line priority (spec 2026-07-19): discoveries → stat-based tip → random tip.
 *  Returns a bare line id — `voicedKeys` turns it into a skin-aware key chain. */
function pickLine(stats: RunStats): { id: string; params?: Record<string, number> } {
  if (stats.discoveries > 0) return { id: 'discovery', params: { n: stats.discoveries } };
  if (stats.rerollsUsed === 0) return { id: 'tip.reroll' };
  if (stats.tilesDiscarded === 0) return { id: 'tip.discard' };
  if (stats.itemsBought === 0) return { id: 'tip.shop' };
  return { id: `tip.${Math.floor(Math.random() * GENERIC_TIPS)}` };
}
```

and in the component body replace the `text` line with:

```tsx
  const text =
    (won ? `${t(voicedKeys('won'))} ` : '') + t(voicedKeys(line.id), line.params);
```

- [ ] **Step 5: Rewire `TutorialPopup.tsx`**

Add `voicedKeys` to the existing `mascots` import:

```tsx
import { mascotSrc, voicedKeys } from '../mascots';
```

Default the role so an encounter without a mascot still resolves (the type allows it), and route only the **body** — the title is a term, not dialogue:

```tsx
  const mascot = enc?.mascot;
  const role = mascot ?? 'woodak';
```

```tsx
      <p className="tut-body">{richText(t(voicedKeys(`enc.${active}`, role)))}</p>
```

- [ ] **Step 6: Rewire `ShopMascot.tsx`**

```tsx
import { useI18n } from '../i18n';
import { voicedKeys } from '../mascots';
```

```tsx
/** Size of the voice.piyak.welcome.N pool in the locale files. */
const MASCOT_WELCOME_COUNT = 8;
```

```tsx
      <div className="mascot-bubble">{t(voicedKeys(`welcome.${line}`, 'piyak'))}</div>
```

Leave the `piyakUrl` / `cushionUrl` imports and the seat markup untouched.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, 15 tests.

Run: `npx vitest run` → PASS (all suites).
Run: `npx tsc --noEmit` → no errors. If this emits a `dist/` directory, delete it before running Vitest again.

- [ ] **Step 8: Add the CLAUDE.md guardrail**

In `CLAUDE.md`, in the "Key rules easy to get wrong" list, append to the bullet that begins **"Mascot art resolves through `mascotSrc(role)`"**:

```markdown
  **Mascot dialogue resolves through `voicedKeys(line, role)` (same file) — never write a
  `voice.*` locale key at a call site.** It returns an ordered key chain that `t()` (which
  now accepts `string | string[]`) resolves, with `voice.woodak.<line>` always tailing the
  chain so a skin that hasn't written a line degrades to WooDak's copy instead of a raw key.
  Adding a mascot voice = adding `voice.<skin>.*` rows, never a component change. Piyak is a
  fixed role (`voice.piyak.*`). Encounter **titles** stay `tutorial.<id>.title` — they are
  terms, not dialogue — and `intro.step.*` is always WooDak (the guided intro only runs on a
  profile with no unlocks, so no skin can ever speak it).
```

- [ ] **Step 9: Commit**

```bash
git add locales/en.json locales/ko.json src/ui/components/WooDakMascot.tsx \
        src/ui/components/TutorialPopup.tsx src/ui/components/ShopMascot.tsx \
        CLAUDE.md tests/mascot-voice.test.ts
git commit -m "refactor(i18n): move mascot copy into the voice.<skin>.<line> namespace

Pure migration — every string keeps its wording. woodak.*, mascot.welcome.*, and
tutorial.*.body collapse into voice.woodak.* / voice.piyak.*, and the three
components that read mascot copy now go through voicedKeys(). Encounter titles
stay put: they are terms, not dialogue.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Name the ghost, alien, and turtle

**Files:**
- Modify: `locales/en.json:345-347`, `locales/ko.json:345-347`
- Modify: `docs/GDD.md:733`
- Test: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks — display strings only. Skin ids (`ghost`, `alien`, `turtle`) and unlock words (`GHOST`, `ALIEN`, `TURTLE`) are unchanged.

- [ ] **Step 1: Write the failing test**

Append to `tests/mascot-voice.test.ts`:

```ts
import { WOODAK_SKINS } from '../src/ui/mascots';

describe('mascot display names', () => {
  const NAMES: Record<string, { en: string; ko: string }> = {
    'mascot.woodak': { en: 'WooDak', ko: '우땅' },
    'mascot.dog': { en: 'Nurungi', ko: '누렁이' },
    'mascot.ghost': { en: 'Egoya', ko: '이고야' },
    'mascot.alien': { en: 'Egoji', ko: '이고지' },
    'mascot.turtle': { en: 'Nemubo', ko: '느무보' },
  };

  it('names every skin in both locales', () => {
    for (const [key, want] of Object.entries(NAMES)) {
      expect(EN[key], `en ${key}`).toBe(want.en);
      expect(KO[key], `ko ${key}`).toBe(want.ko);
    }
  });

  it('has a name key for every registered skin', () => {
    for (const s of WOODAK_SKINS) {
      expect(Object.keys(NAMES), `skin ${s.id}`).toContain(s.nameKey);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `en mascot.ghost: expected 'Ghost' to be 'Egoya'`.

- [ ] **Step 3: Rename in both locales**

`locales/en.json`:
```json
  "mascot.ghost": "Egoya",
  "mascot.alien": "Egoji",
  "mascot.turtle": "Nemubo",
```

`locales/ko.json`:
```json
  "mascot.ghost": "이고야",
  "mascot.alien": "이고지",
  "mascot.turtle": "느무보",
```

`mascot.woodak` and `mascot.dog` are already correct — leave them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Update the GDD mascot row**

In `docs/GDD.md:733`, the `ALIEN / GHOST / DOG / TURTLE` row: after "**All four shipped**", add the display names so the doc and the game agree.

```markdown
Display names: DOG = 누렁이 / Nurungi, GHOST = 이고야 / Egoya, ALIEN = 이고지 / Egoji,
TURTLE = 느무보 / Nemubo. The unlock **words** stay GHOST / ALIEN / DOG / TURTLE — the
name is display copy (`mascot.<id>`), the word is the trigger.
```

- [ ] **Step 6: Commit**

```bash
git add locales/en.json locales/ko.json docs/GDD.md tests/mascot-voice.test.ts
git commit -m "feat(i18n): name the ghost and alien mascots Egoya and Egoji

Also aligns the turtle's English name to its Korean 느무보 (Nemubo) so all four
variants read as names rather than species. Skin ids and unlock trigger words
are unchanged; this is display copy only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Joker → Emoji Tile display term

**Files:**
- Modify: `locales/en.json`, `locales/ko.json` (5 display keys + 5 in-body mentions)
- Modify: `docs/GDD.md` (§11 and §11.8 headings and prose)
- Modify: `CLAUDE.md` (terminology bullet)
- Test: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: the `voice.*` namespace from Task 3 (three of the reworded strings live there).
- Produces: nothing consumed by later tasks. Tasks 6–9 must use "이모지 타일 / emoji tile" in their own copy wherever WooDak's line said "조커 / joker".

- [ ] **Step 1: Write the failing test**

Append to `tests/mascot-voice.test.ts`:

```ts
describe('Emoji Tile terminology', () => {
  /** Keys whose VALUE must no longer say joker/조커. Key NAMES keep the word —
   *  they are identifiers, not display text (CLAUDE.md terminology rule). */
  const DISPLAY_KEYS = [
    'collection.cat.jokers',
    'shop.yourJokers',
    'shop.noJokers',
    'pack.jokersFull',
    'tutorial.firstJoker.title',
    'voice.woodak.enc.firstJoker',
    'voice.woodak.enc.firstPack',
    'voice.woodak.tip.reroll',
    'voice.piyak.enc.shopFirstVisit',
    'voice.piyak.welcome.3',
  ];

  it('says emoji tile, never joker, in every rewritten string', () => {
    for (const key of DISPLAY_KEYS) {
      expect(EN[key], `en ${key} exists`).toBeTypeOf('string');
      expect(KO[key], `ko ${key} exists`).toBeTypeOf('string');
      expect(EN[key]!.toLowerCase(), `en ${key}`).not.toContain('joker');
      expect(KO[key], `ko ${key}`).not.toContain('조커');
    }
  });

  it('keeps the pack type name unchanged (it never showed "joker")', () => {
    expect(EN['pack.type.joker']).toBe('Charm Pack');
    expect(KO['pack.type.joker']).toBe('부적 팩');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `en collection.cat.jokers: expected 'jokers' not to contain 'joker'`.

- [ ] **Step 3: Rewrite the display strings**

`locales/en.json`:
```json
  "shop.yourJokers": "Your emoji tiles",
  "shop.noJokers": "No emoji tiles yet.",
  "pack.jokersFull": "Emoji tile slots full",
  "collection.cat.jokers": "Emoji Tiles",
  "tutorial.firstJoker.title": "Emoji Tile",
  "voice.woodak.enc.firstJoker": "Emoji tiles apply passive effects every time you score. They fire in order, left to right — arrange them well.",
  "voice.woodak.enc.firstPack": "Open a pack to draft from a few options — tiles, emoji, or consumables. Pick the best fit for your build.",
  "voice.woodak.tip.reroll": "You never rerolled. Good emoji tiles don't wait around.",
  "voice.piyak.enc.shopFirstVisit": "Spend your fee between blinds: buy emoji tiles and consumables, reroll the stock, grab a voucher or pack. Piyak the proprietor restocks each visit.",
  "voice.piyak.welcome.3": "That emoji tile? Came in fresh this morning, meow.",
```

`locales/ko.json`:
```json
  "shop.yourJokers": "보유 이모지 타일",
  "shop.noJokers": "아직 이모지 타일이 없습니다.",
  "pack.jokersFull": "이모지 타일 슬롯 가득 참",
  "collection.cat.jokers": "이모지 타일",
  "tutorial.firstJoker.title": "이모지 타일",
  "voice.woodak.enc.firstJoker": "이모지 타일은 득점할 때마다 발동하는 지속 효과입니다. 왼쪽에서 오른쪽 순서로 발동하니 배치를 잘 하세요.",
  "voice.woodak.enc.firstPack": "팩을 열어 몇 가지 선택지(타일·이모지·소모품) 중에서 골라 담습니다. 빌드에 맞는 것을 고르세요.",
  "voice.woodak.tip.reroll": "리롤을 한 번도 안 썼다우땅. 좋은 이모지는 기다려 주지 않는다우땅.",
  "voice.piyak.enc.shopFirstVisit": "블라인드 사이에 원고료를 쓰세요: 이모지 타일·소모품 구매, 상품 리롤, 바우처나 팩 구입. 주인장 삐약이가 방문할 때마다 물건을 채워둡니다.",
  "voice.piyak.welcome.3": "그 이모지 타일, 오늘 아침에 막 들어온 물건이라냥.",
```

Leave every **key name** alone (`shop.yourJokers` stays `shop.yourJokers`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, 19 tests.

Run: `npx vitest run` → PASS. If a suite asserts one of the old strings, update that assertion to the new wording in this same task.

- [ ] **Step 5: Update the GDD**

In `docs/GDD.md`:
- Line 574: `## 11. Jokers (Emoji Tiles)` → `## 11. Emoji Tiles`
- Line 670: `### 11.8 Joker Editions (planned — not yet in the engine)` → `### 11.8 Emoji Tile Editions (planned — not yet in the engine)`
- In §11's opening paragraph, replace the display noun: "Jokers are represented as emoji tiles, acquired by…" → "**Emoji tiles** are acquired by shop purchase/draw (§9). Unlike Balatro's jokers, which mostly play in the single layer of "score calculation," emoji tiles play across **3 layers**…"
- In §11 prose (the shelf-order paragraph, §11.1 table intro, §11.7 notes, §11.8 body), replace the display noun "joker(s)" with "emoji tile(s)". **Keep** every reference to the engine types verbatim: `JokerDef`, `JokerEdition`, `OwnedJoker`, `RunState.jokerSlots`, `BALANCE.jokerSlots`, `src/engine/jokers/`, and the §11.8 "White … +1 owned-joker slot" wording where it names the field.
- Add one line under the §11 heading recording the decision:

```markdown
> **Terminology (2026-07-23).** The player-facing term is **Emoji Tile / 이모지 타일**.
> The engine identifier stays `joker` (`JokerDef`, `src/engine/jokers/`,
> `BALANCE.jokerSlots`) — display terms never rename engine identifiers.
```

- [ ] **Step 6: Update CLAUDE.md**

In the "Terminology is display-strings only" bullet, append:

```markdown
The display term for a joker is **Emoji Tile / 이모지 타일** (GDD §11, decided 2026-07-23);
the engine identifier stays `joker` (`JokerDef`, `src/engine/jokers/`, `BALANCE.jokerSlots`,
`RunState.jokers`), as do locale key *names* like `shop.yourJokers`.
```

- [ ] **Step 7: Commit**

```bash
git add locales/en.json locales/ko.json docs/GDD.md CLAUDE.md tests/mascot-voice.test.ts
git commit -m "feat(i18n): rename the display term Joker to Emoji Tile

Display strings and docs only — GDD 11 was already titled 'Jokers (Emoji Tiles)',
so this finishes the rename the design had already made. Engine identifiers and
locale key names keep 'joker' per the CLAUDE.md terminology rule; renaming
JokerDef would also collide 'emoji tile' with the emoji-glyph field.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 누렁이 (dog) voice

Loyal dog. Addresses the player as **주인님 / master**, short declaratives, unconditional encouragement even on a loss, tic `~다멍!` / "woof".

**Files:**
- Modify: `locales/en.json`, `locales/ko.json` (46 new keys)
- Test: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: `WOODAK_LINES` (the 23-id list) from Task 3's test.
- Produces: `VOICED_SKINS`, a growing array in the test file that Tasks 7–9 append to. Task 6 creates it as `['dog']`.

- [ ] **Step 1: Write the failing test**

Append to `tests/mascot-voice.test.ts`:

```ts
/** Skins whose full line set has been written. Each voice task appends its id. */
const VOICED_SKINS: string[] = ['dog'];

describe('skin voice completeness', () => {
  it.each(VOICED_SKINS)('%s has all 23 lines in both locales', (skin) => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.${skin}.${line}`], `en voice.${skin}.${line}`).toBeTypeOf('string');
      expect(KO[`voice.${skin}.${line}`], `ko voice.${skin}.${line}`).toBeTypeOf('string');
    }
  });

  it.each(VOICED_SKINS)('%s writes its own copy, never WooDak\'s verbatim', (skin) => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.${skin}.${line}`], `en ${skin} ${line}`).not.toBe(EN[`voice.woodak.${line}`]);
      expect(KO[`voice.${skin}.${line}`], `ko ${skin} ${line}`).not.toBe(KO[`voice.woodak.${line}`]);
    }
  });

  it.each(VOICED_SKINS)('%s keeps the richtext markers of the WooDak original', (skin) => {
    const markers = (s: string) => (s.match(/\[[a-z]:/g) ?? []).sort();
    for (const line of WOODAK_LINES) {
      for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
        if (skin === 'alien') continue; // alien relabels markers in its own tongue
        expect(markers(dict[`voice.${skin}.${line}`]!), `${name} ${skin} ${line}`).toEqual(
          markers(dict[`voice.woodak.${line}`]!),
        );
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `en voice.dog.won: expected undefined to be type 'string'`.

- [ ] **Step 3: Add the Korean lines**

Append to `locales/ko.json`:

```json
  "voice.dog.won": "해냈다멍! 주인님이 해낼 줄 알았다멍! 꼬리가 멈추질 않는다멍!",
  "voice.dog.discovery": "주인님이 이번 런에서 새 단어 {n}개를 도감에 물어 왔다멍! 자랑스럽다멍!",
  "voice.dog.tip.reroll": "주인님, 리롤을 한 번도 안 썼다멍. 마음에 안 들면 말만 하라멍, 다시 물어 오겠다멍!",
  "voice.dog.tip.discard": "버리기를 하나도 안 썼다멍. 손패가 굳으면 답답하다멍, 팍팍 버려도 된다멍!",
  "voice.dog.tip.shop": "문방구에서 아무것도 안 샀다멍. 주인님 지갑은 지켰지만 무기가 없다멍!",
  "voice.dog.tip.0": "문장 패턴을 완성하면 점수가 팍 뛴다멍! 봤다멍?",
  "voice.dog.tip.1": "패턴 배수는 후반 페이즈일수록 무섭게 커진다멍. 끝까지 물고 늘어지라멍!",
  "voice.dog.tip.2": "A, E, I, O, U를 다 넣으면 모음 플러시다멍! 횡설수설이어도 터진다멍!",
  "voice.dog.tip.3": "$5마다 $1이 붙는다멍! 주인님 지갑은 제가 지키겠다멍!",
  "voice.dog.tip.4": "관사랑 형용사는 패턴을 안 깬다멍. 보너스만 얹어 준다멍, 안심하라멍!",
  "voice.dog.enc.firstGibberish": "단어가 아니어도 낼 수 있다멍! 대신 글자 [c:칩]만 ×1로 세고 접미 보너스가 없다멍. 문장에 구멍이 나서 패턴도 날아간다멍, 조심하라멍!",
  "voice.dog.enc.firstLetterHand": "한 단어 안의 글자들이 핸드를 이루면 [c:칩]이랑 [m:배수]를 더 준다멍! 쌍둥이, 트리플렛, 모음 플러시… 제일 센 거 하나만 쳐준다멍.",
  "voice.dog.enc.firstPattern": "낸 단어들이 줄줄이 문장이 된다멍! 문법 패턴을 완성하면 [b:블라인드] 끝에 큰 보너스가 온다멍. 어려운 패턴일수록 많이 준다멍!",
  "voice.dog.enc.firstUnison": "문장의 단어가 전부 같은 색이고 2개 이상이면 유니즌이다멍! 한 색으로 맞춘 상으로 배수가 확 커진다멍!",
  "voice.dog.enc.firstMaterial": "타일마다 재질이 다르다멍 — 자기, 유리, 황동… 씹는 맛이 다 다르다멍! 효과는 도감에서 확인하라멍.",
  "voice.dog.enc.firstFont": "타일 폰트에 씰이 붙어 있다멍! 추가 [c:칩], 금화, 재발동, 버릴 때 소모품까지 나온다멍. 툴팁을 보라멍!",
  "voice.dog.enc.firstJoker": "이모지 타일은 득점할 때마다 발동한다멍! 왼쪽부터 오른쪽 순서로 터지니까 줄을 잘 세우라멍!",
  "voice.dog.enc.firstConsumable": "한 번 쓰면 사라지는 물건이다멍 — 문구류랑 문장부호! 슬롯에 물어 뒀다가 딱 좋은 순간에 쓰라멍.",
  "voice.dog.enc.firstVoucher": "런 내내 남는 영구 강화다멍! 챕터당 딱 한 번만 살 수 있고, 한 번 사면 안 없어진다멍.",
  "voice.dog.enc.firstPack": "팩을 열면 선택지가 쏟아진다멍 — 타일, 이모지, 소모품! 주인님 빌드에 맞는 걸로 고르라멍.",
  "voice.dog.enc.magnifier": "돋보기를 쓰면 지금 손패로 만들 수 있는 단어를 최대 3개까지 찾아 준다멍! 제가 냄새로 찾아 오는 거랑 똑같다멍.",
  "voice.dog.enc.pouchHover": "\"남음\"은 아직 안 뽑은 주머니 속 타일만 센다멍! 손패랑 낸 거랑 버린 건 이미 주머니를 떠났다멍.",
  "voice.dog.enc.firstBoss": "이번 라운드는 보스다멍! 규칙을 비트는 제약이 걸려 있다멍. 사이드바에서 효과를 확인하고 단어를 짜라멍 — 제가 옆에 있겠다멍!",
```

- [ ] **Step 4: Add the English lines**

Append to `locales/en.json`:

```json
  "voice.dog.won": "We did it, woof! I knew you'd pull it off, master! My tail won't stop!",
  "voice.dog.discovery": "You fetched {n} new words into the collection this run, master! So proud, woof!",
  "voice.dog.tip.reroll": "Master, you never rerolled once. Just say the word and I'll fetch you a fresh stock, woof!",
  "voice.dog.tip.discard": "You didn't discard a single tile. A stiff hand is no fun, woof — toss them, I'll bring more!",
  "voice.dog.tip.shop": "You bought nothing at the shop. Your purse is safe, master, but you've got no teeth, woof!",
  "voice.dog.tip.0": "Finish a sentence pattern and the score leaps, woof! Did you see that?",
  "voice.dog.tip.1": "Pattern mult grows scary in the late phases, woof. Hold on to the very end!",
  "voice.dog.tip.2": "Fit A, E, I, O and U in one word for a Vowel Flush, woof! It even fires on gibberish!",
  "voice.dog.tip.3": "Every $5 saved earns $1, woof! I'll guard your purse, master!",
  "voice.dog.tip.4": "Articles and adjectives never break a pattern, woof. They only add bonus — no worries!",
  "voice.dog.enc.firstGibberish": "You can play it even if it isn't a word, woof! But it only counts letter [c:chips] at ×1 with no suit bonus, and it punches a hole that voids the pattern. Careful, master!",
  "voice.dog.enc.firstLetterHand": "Letters inside one word can form a hand and add [c:chips] and [m:mult], woof! Twin, Triplet, Vowel Flush… only the biggest one counts.",
  "voice.dog.enc.firstPattern": "Your words line up into a sentence, woof! Complete a grammar pattern for a big [b:blind]-end bonus. Harder patterns pay more!",
  "voice.dog.enc.firstUnison": "If every word in the sentence shares one suit and there are 2 or more, that's Unison, woof! The mult jumps as a reward for keeping it one color!",
  "voice.dog.enc.firstMaterial": "Every tile has its own material, woof — Porcelain, Glass, Brass… they all chew differently! Check the collection for each effect.",
  "voice.dog.enc.firstFont": "A tile's font can carry a seal, woof! Extra [c:chips], gold, a retrigger, even a consumable when you discard it. Look at the tooltip!",
  "voice.dog.enc.firstJoker": "Emoji tiles fire every time you score, woof! They go off left to right, so line them up well!",
  "voice.dog.enc.firstConsumable": "One-shot items, woof — stationery and punctuation! Stash them in your slots and use them at just the right moment.",
  "voice.dog.enc.firstVoucher": "A permanent upgrade that lasts the whole run, woof! One per chapter, and once you buy it, it never leaves.",
  "voice.dog.enc.firstPack": "Open a pack and the options come pouring out, woof — tiles, emoji, consumables! Pick what fits your build, master.",
  "voice.dog.enc.magnifier": "The Magnifier sniffs out up to three words you can spell from your hand right now, woof! Just like me fetching by scent.",
  "voice.dog.enc.pouchHover": "\"Remaining\" counts only the undrawn tiles still in the pouch, woof! Ones in hand, played, or discarded already left it.",
  "voice.dog.enc.firstBoss": "This round is a boss, woof! It carries a rule-bending constraint. Check the effect in the sidebar and plan your words — I'm right beside you, master!",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, no failures. (Exact counts stop being useful here — the three
`it.each` blocks report one case per entry in `VOICED_SKINS`, so the total grows
by 3 with each voice task.)

If the richtext-marker test fails, the offending line dropped or added a `[c:` / `[m:` / `[b:` marker relative to WooDak's original — restore it rather than loosening the test.

- [ ] **Step 6: Commit**

```bash
git add locales/en.json locales/ko.json tests/mascot-voice.test.ts
git commit -m "feat(i18n): 누렁이 (Nurungi) voice — 23 lines, ko + en

Loyal-dog register: addresses the player as 주인님/master, short declaratives,
unconditional encouragement. The completeness test also pins that a skin never
ships WooDak's string verbatim and never drops a richtext marker.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 이고야 (ghost) voice

Tricky, mischievous ghost. Informal Korean (반말), teases and needles, trails off with `~`/`…`, tic `~지롱` / `~시지~`. Delivers the same information, wrapped in a jab.

**Files:**
- Modify: `locales/en.json`, `locales/ko.json` (46 new keys)
- Modify: `tests/mascot-voice.test.ts` (one array entry)

**Interfaces:**
- Consumes: `VOICED_SKINS` and the three `it.each` completeness tests from Task 6 — they run unchanged against the new skin.
- Produces: `VOICED_SKINS` becomes `['dog', 'ghost']`.

- [ ] **Step 1: Add the skin to the test list (this is the failing test)**

In `tests/mascot-voice.test.ts`:

```ts
const VOICED_SKINS: string[] = ['dog', 'ghost'];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `ghost has all 23 lines in both locales` → `en voice.ghost.won: expected undefined to be type 'string'`.

- [ ] **Step 3: Add the Korean lines**

Append to `locales/ko.json`:

```json
  "voice.ghost.won": "어라, 진짜 끝냈네? 시시하게시리~ …아니 뭐, 잘했어. 조금은.",
  "voice.ghost.discovery": "새 단어 {n}개나 주웠네? 도감이 두꺼워지는 소리가 들리는데~ 자랑하고 싶어 죽겠지?",
  "voice.ghost.tip.reroll": "리롤 한 번도 안 썼지롱~ 겁쟁이. 상점 물건이 그렇게 무섭던가?",
  "voice.ghost.tip.discard": "버리기를 하나도 안 썼네~ 아깝다고 꽉 쥐고 있으면 손이 굳는 거야. 놔줘, 놔줘~",
  "voice.ghost.tip.shop": "문방구에서 아무것도 안 샀지? 돈만 세다 끝났네~ 그거 무덤까지 가져갈 거야?",
  "voice.ghost.tip.0": "문장 패턴 완성하면 점수가 확 뛰는데… 알려줘도 안 할 거지?",
  "voice.ghost.tip.1": "패턴 배수는 후반일수록 무서워지거든. 겁나면 일찍 접든가~",
  "voice.ghost.tip.2": "A, E, I, O, U 다 넣으면 모음 플러시. 횡설수설이어도 터져~ 우연히라도 한 번 해 보시지~",
  "voice.ghost.tip.3": "$5마다 $1… 계산도 안 해봤지? 알려줘도 안 쓸 거면서~",
  "voice.ghost.tip.4": "관사랑 형용사는 패턴 안 깨. 무서워서 못 넣었지? 히히~",
  "voice.ghost.enc.firstGibberish": "단어 아니어도 낼 수 있어~ 대신 글자 [c:칩]만 ×1이고 접미 보너스는 없지. 문장엔 구멍이 뻥 뚫려서 패턴도 같이 사라져~ 알고나 내시지~",
  "voice.ghost.enc.firstLetterHand": "한 단어 안 글자들이 핸드가 되면 [c:칩]이랑 [m:배수]를 더 얹어 줘. 쌍둥이, 트리플렛, 모음 플러시… 제일 센 거 하나만. 욕심부려도 소용없지롱~",
  "voice.ghost.enc.firstPattern": "낸 단어들이 문장으로 이어지거든. 문법 패턴 완성하면 [b:블라인드] 끝에 크게 터져~ 어려운 패턴일수록 많이 주는데… 할 수 있겠어?",
  "voice.ghost.enc.firstUnison": "문장 단어가 전부 같은 색이고 2개 이상이면 유니즌. 배수가 쭉 올라가~ 색깔 맞추기, 그거 은근 어렵지롱~",
  "voice.ghost.enc.firstMaterial": "타일마다 재질이 달라. 자기, 유리, 황동… 뭐가 뭔지 모르겠지? 도감에 다 적혀 있는데 안 읽었을 거 같아서~",
  "voice.ghost.enc.firstFont": "폰트에 씰이 붙어 있어~ 추가 [c:칩], 금화, 재발동, 버릴 때 소모품까지. 툴팁 보면 나오는데… 귀찮아서 안 봤지?",
  "voice.ghost.enc.firstJoker": "이모지 타일은 득점할 때마다 발동해. 왼쪽부터 오른쪽 순서로. 순서 한 번도 안 바꾸고 쓰는 사람도 있더라~ 설마 너는 아니지?",
  "voice.ghost.enc.firstConsumable": "한 번 쓰면 없어지는 것들~ 문구류랑 문장부호. 아까워서 끝까지 안 쓰다가 런이 끝나는 거, 그거 진짜 많이 봤어.",
  "voice.ghost.enc.firstVoucher": "런 내내 남는 영구 강화야. 챕터당 딱 한 번. 놓치면 다음 챕터까지 기다려야 하는데~ 기다릴 수 있겠어?",
  "voice.ghost.enc.firstPack": "팩 열면 선택지가 나와~ 타일, 이모지, 소모품. 빌드에 맞는 거 고르랬더니 예쁜 거 고를 거지? 다 알아~",
  "voice.ghost.enc.magnifier": "돋보기 쓰면 지금 손패로 만들 수 있는 단어를 세 개까지 보여줘. 컨닝이지 뭐~ 안 쓸 거야? 착한 척은~",
  "voice.ghost.enc.pouchHover": "\"남음\"은 아직 안 뽑은 주머니 속 타일만 세는 거야~ 손패랑 낸 거랑 버린 건 벌써 떠났지. 다시 돌아올 거라고 믿었어? 히히~",
  "voice.ghost.enc.firstBoss": "어라, 보스네~ 규칙을 비트는 제약이 걸려 있어. 사이드바에 뭐라고 적혀 있는지 읽어 보시지~ 안 읽고 덤비는 것도 나름 재밌긴 한데~",
```

- [ ] **Step 4: Add the English lines**

Append to `locales/en.json`:

```json
  "voice.ghost.won": "Huh, you actually finished? How boring~ …Fine, fine. Well done. A little.",
  "voice.ghost.discovery": "Picked up {n} new words, did you? I can hear the collection getting fatter~ Dying to brag, aren't you?",
  "voice.ghost.tip.reroll": "Never rerolled once, did you~ Chicken. Was the shop stock that scary?",
  "voice.ghost.tip.discard": "Not a single discard~ Clutch them too tight and your hand goes stiff. Let go, let go~",
  "voice.ghost.tip.shop": "Bought nothing at the shop, hm? Just counted your coins all run~ Taking it to the grave?",
  "voice.ghost.tip.0": "Finish a sentence pattern and the score leaps… but you won't try it even now, will you?",
  "voice.ghost.tip.1": "Pattern mult gets nastier the later the phase. Scared? Cash out early then~",
  "voice.ghost.tip.2": "All of A, E, I, O, U in one word is a Vowel Flush. Fires on gibberish too~ Try it by accident at least once~",
  "voice.ghost.tip.3": "A dollar for every five saved… you never did the math, did you? Not that you'd use it~",
  "voice.ghost.tip.4": "Articles and adjectives never break a pattern. Too scared to slip one in? Hehe~",
  "voice.ghost.enc.firstGibberish": "You can play a non-word~ It just counts letter [c:chips] at ×1, no suit bonus. And it punches a hole in the sentence, so the pattern dies with it~ Maybe know that before playing it~",
  "voice.ghost.enc.firstLetterHand": "Letters in one word can form a hand and stack on [c:chips] and [m:mult]. Twin, Triplet, Vowel Flush… only the biggest one. Greed gets you nothing~",
  "voice.ghost.enc.firstPattern": "Your words chain into a sentence, see. Complete a grammar pattern and it pays big at [b:blind] end~ The harder the pattern, the more it gives… think you can manage?",
  "voice.ghost.enc.firstUnison": "All words one suit, two or more of them — that's Unison. The mult climbs nicely~ Matching colors is trickier than it looks, though~",
  "voice.ghost.enc.firstMaterial": "Every tile has a material. Porcelain, Glass, Brass… no idea which is which, right? It's all in the collection, but I figured you hadn't read it~",
  "voice.ghost.enc.firstFont": "Fonts carry seals~ Extra [c:chips], gold, a retrigger, even a consumable on discard. It's right there in the tooltip… too lazy to look, were you?",
  "voice.ghost.enc.firstJoker": "Emoji tiles fire every time you score, left to right. Some people never reorder them at all~ That's not you, surely?",
  "voice.ghost.enc.firstConsumable": "One-shot things~ stationery and punctuation. Hoarding them so preciously that the run ends with them unused — I've seen a lot of that.",
  "voice.ghost.enc.firstVoucher": "A permanent upgrade for the whole run. One per chapter, that's it. Miss it and you wait a whole chapter~ Got the patience?",
  "voice.ghost.enc.firstPack": "Open a pack and options spill out~ tiles, emoji, consumables. I said pick for your build, but you'll pick the pretty one, won't you? I know~",
  "voice.ghost.enc.magnifier": "The Magnifier shows up to three words you could spell right now. It's cheating, really~ Not using it? Such a good little saint~",
  "voice.ghost.enc.pouchHover": "\"Remaining\" counts only the undrawn tiles still in the pouch~ In hand, played, discarded — those are long gone. Did you think they'd come back? Hehe~",
  "voice.ghost.enc.firstBoss": "Oh my, a boss~ It bends the rules with a constraint. Go read what the sidebar says~ Though charging in blind is entertaining too~",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, no failures (each `it.each` block now reports 2 cases).

- [ ] **Step 6: Commit**

```bash
git add locales/en.json locales/ko.json tests/mascot-voice.test.ts
git commit -m "feat(i18n): 이고야 (Egoya) voice — 23 lines, ko + en

Tricky-ghost register: informal, needling, trailing off. Every line still
carries the same rule information as WooDak's original, wrapped in a jab.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 이고지 (alien) voice + lexicon enforcement

Alien speech only, no subtitle. **Superseded 2026-08-31:** `en` now uses the
Roman tokens and `ko` uses the normative one-to-one Hangul mapping. What makes
it read as a language rather than noise is that every token comes from one fixed
glossary and preserves marker/placeholder structure across locales.

**Files:**
- Modify: `locales/en.json`, `locales/ko.json` (23 keys each, locale-specific orthography)
- Modify: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: `VOICED_SKINS`, `WOODAK_LINES`.
- Produces: `VOICED_SKINS` becomes `['dog', 'ghost', 'alien']`. The richtext-marker test already skips `alien` (Task 6 wrote that `continue`), because alien relabels the markers in its own tongue.

- [ ] **Step 1: Write the failing tests**

In `tests/mascot-voice.test.ts` set:

```ts
const VOICED_SKINS: string[] = ['dog', 'ghost', 'alien'];
```

and append:

```ts
/**
 * 이고지's fixed vocabulary. Every token in every `voice.alien.*` string must appear
 * here — that constraint is what makes the speech read as a real language rather
 * than noise, and it is the reason a new line cannot be improvised. If a line needs
 * a concept with no token, prefer rephrasing with existing vocabulary; add a row
 * only for a genuinely new concept, and record it in the design spec too.
 */
const ALIEN_LEXICON: Record<string, string> = {
  "an'ka": 'new', ao: 'vowel', "ar'ti": 'article/adjective', blin: 'blind',
  "bou'nak": 'pouch', "chap'ta": 'chapter', chi: 'chips', "del'vo": 'discard',
  "do'gan": 'collection/book', "em'ji": 'emoji', "fa'zen": 'phase', "flu'sha": 'flush',
  "fon'ta": 'font', "glo'ba": 'gibberish', "gru'vak": 'big', "hol'na": 'hole',
  "il'ma": 'see/look', "ka'lith": 'hand', "ka'shen": 'same', "kel'dan": 'money',
  "kon'su": 'consumable', "kre'sha": 'grow', "ku'ren": 'fire/trigger', "lo'ren": 'late',
  "ma'gni": 'magnifier', "ma'run": 'material', "mi'ren": 'you', "mor'ka": 'shop',
  mul: 'multiplier', "nak'ta": 'draw', "ne'sha": 'rule', nu: 'not',
  "nu'kha": 'none/did not', "nu'ven": 'few/small', "ol'dan": 'order', ollu: 'all',
  "pa'tarn": 'pattern', pak: 'pack', "pen'ta": 'five', "qa'shi": 'score',
  "re'rol": 'reroll', reth: 'remain/keep', "se'la": 'seal', "sen'tal": 'sentence',
  shen: 'suit/color', "shi'mela": 'good', "ta'wen": 'two', thal: 'end',
  tolun: 'word', "tor'un": 'tile', "tri'un": 'three', "u'nizn": 'unison',
  unn: 'one', vai: 'void', "vau'cha": 'voucher', vell: 'when/if',
  "vok'tu": 'change', vor: 'and/then', "vor'nak": 'achieved', "zar'ka": 'boss',
  "zin'ka": 'twin', "zk'tha": 'joy', "zor'ga": 'hard/stiff',
};

/** Strip richtext markup, params and punctuation; return lowercase word tokens.
 *  Order matters: `{n}` and `[c:` must go before the generic punctuation strip, and
 *  the apostrophe is deliberately NOT stripped — it is part of every alien token. */
function alienTokens(s: string): string[] {
  return s
    .replace(/\{n\}/g, ' ')
    .replace(/\[[a-z]:/g, ' ')
    .replace(/[.,!?:;=\]—…"×$0-9]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

describe('이고지 (alien) speech', () => {
  it('uses the approved locale-specific orthography', () => {
    for (const line of WOODAK_LINES) {
      expect(KO[`voice.alien.${line}`], `alien ${line}`).not.toBe(EN[`voice.alien.${line}`]);
    }
  });

  it('uses only approved lexicon tokens', () => {
    const unknown = new Set<string>();
    for (const line of WOODAK_LINES) {
      for (const tok of alienTokens(EN[`voice.alien.${line}`]!)) {
        if (!(tok in ALIEN_LEXICON)) unknown.add(`${tok} (in ${line})`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('exercises most of the lexicon — an unused token is dead vocabulary', () => {
    const used = new Set(WOODAK_LINES.flatMap((l) => alienTokens(EN[`voice.alien.${l}`]!)));
    const unused = Object.keys(ALIEN_LEXICON).filter((k) => !used.has(k));
    expect(unused, `unused lexicon entries: ${unused.join(', ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `alien has all 23 lines in both locales` → `en voice.alien.won: expected undefined to be type 'string'`.

- [ ] **Step 3: Add the alien lines using the approved locale orthographies**

Historical note: the block below is the old plan-time Romanized snapshot, not
the current 23-line inventory. Do not copy it into either locale. The canonical
keys and strings are the current `locales/*.json` rows, guarded by
`tests/mascot-voice.test.ts`; Korean uses the exact token mapping in the normative
design spec.

```json
  "voice.alien.won": "Vor'nak! Tolun mi'ren — do'gan thal. Zk'tha, zk'tha!",
  "voice.alien.discovery": "An'ka tolun {n} — do'gan kre'sha. Zk'tha, mi'ren!",
  "voice.alien.tip.reroll": "Mi'ren re'rol nu'kha. Mor'ka tolun vok'tu — shi'mela.",
  "voice.alien.tip.discard": "Mi'ren del'vo nu'kha. Ka'lith zor'ga. Del'vo, del'vo — shi'mela.",
  "voice.alien.tip.shop": "Mor'ka: mi'ren nu'kha. Kel'dan reth, vor tor'un nu'ven. Nu shi'mela.",
  "voice.alien.tip.0": "Sen'tal pa'tarn vor'nak — qa'shi gru'vak. Zk'tha!",
  "voice.alien.tip.1": "Pa'tarn mul kre'sha vell fa'zen lo'ren. Reth, reth.",
  "voice.alien.tip.2": "Ao ollu unn tolun — flu'sha! Glo'ba vell, ku'ren shi'mela.",
  "voice.alien.tip.3": "Kel'dan pen'ta — kel'dan unn. Vor'nak shi'mela.",
  "voice.alien.tip.4": "Ar'ti pa'tarn nu vai. Qa'shi gru'vak unn. Nu zor'ga.",
  "voice.alien.enc.firstGibberish": "Glo'ba tolun — mi'ren ku'ren shi'mela. [c:chi] unn, shen nu'kha. Vor sen'tal hol'na — pa'tarn vai. Il'ma!",
  "voice.alien.enc.firstLetterHand": "Tor'un unn tolun — ka'lith an'ka. Zin'ka, tri'un, ao flu'sha… [c:chi] vor [m:mul] gru'vak. Unn ka'lith, gru'vak unn.",
  "voice.alien.enc.firstPattern": "Tolun ollu — sen'tal. Pa'tarn vor'nak vell [b:blin] thal: qa'shi gru'vak. Pa'tarn zor'ga, qa'shi gru'vak.",
  "voice.alien.enc.firstUnison": "Sen'tal tolun ollu ka'shen shen, tolun ta'wen — u'nizn! Mul kre'sha. Shi'mela.",
  "voice.alien.enc.firstMaterial": "Tor'un ma'run: ka'shen nu'kha. Qa'shi vok'tu. Do'gan il'ma — ma'run ollu.",
  "voice.alien.enc.firstFont": "Tor'un fon'ta se'la: [c:chi] an'ka, kel'dan, ku'ren an'ka, vor del'vo kon'su. Il'ma se'la.",
  "voice.alien.enc.firstJoker": "Em'ji tor'un ku'ren vell qa'shi. Ol'dan: unn, ta'wen, tri'un… Ol'dan vok'tu — shi'mela.",
  "voice.alien.enc.firstConsumable": "Kon'su: ku'ren unn, vor nu'kha. Ka'lith reth, vor ku'ren vell shi'mela.",
  "voice.alien.enc.firstVoucher": "Vau'cha: ne'sha an'ka, thal nu'kha. Chap'ta unn — kel'dan unn. Vor'nak, reth ollu.",
  "voice.alien.enc.firstPack": "Pak thal — tor'un, em'ji, kon'su. Mi'ren unn il'ma, vor unn nak'ta. Shi'mela.",
  "voice.alien.enc.magnifier": "Ma'gni: ka'lith il'ma, tolun tri'un. Mi'ren nu'kha il'ma — ma'gni il'ma.",
  "voice.alien.enc.pouchHover": "Bou'nak reth = tor'un nak'ta nu'kha. Ka'lith, qa'shi, del'vo — bou'nak thal ollu.",
  "voice.alien.enc.firstBoss": "Zar'ka! Ne'sha vok'tu. Il'ma ne'sha, vor sen'tal vor'nak. Zk'tha, mi'ren.",
```

Note `voice.alien.enc.pouchHover` contains no `"` characters, so it needs no escaping unlike the other skins' version of that line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, no failures.

If "uses only approved lexicon tokens" fails, the message names each offending token and its line. **Fix the line to use existing vocabulary** rather than adding a glossary row, unless the concept genuinely has no token. If "exercises most of the lexicon" fails, delete the unused glossary rows it names — dead vocabulary is not vocabulary.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/ko.json tests/mascot-voice.test.ts
git commit -m "feat(i18n): 이고지 (Egoji) voice — 23 localized alien lines

Untranslated alien with no subtitle, per the design decision. English and Korean
use the approved Roman/Hangul token pairings, and lexicon tests assert every token
comes from one fixed glossary (and that no glossary entry goes unused) — that
constraint is what makes the speech read as a language instead of noise.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: 느무보 (turtle) voice + full-coverage guard

Crisp scholar. Formal Korean 격식체, exact figures, no filler.

**Files:**
- Modify: `locales/en.json`, `locales/ko.json` (46 new keys)
- Modify: `tests/mascot-voice.test.ts`

**Interfaces:**
- Consumes: `VOICED_SKINS`, `WOODAK_LINES`, `WOODAK_SKINS` (imported in Task 4).
- Produces: `VOICED_SKINS` becomes `['dog', 'ghost', 'alien', 'turtle']` plus a guard test asserting it covers every non-default registered skin — so a future skin added to `WOODAK_SKINS` without lines fails CI.

- [ ] **Step 1: Write the failing tests**

In `tests/mascot-voice.test.ts` set:

```ts
const VOICED_SKINS: string[] = ['dog', 'ghost', 'alien', 'turtle'];
```

and append:

```ts
describe('voice coverage guard', () => {
  it('every registered non-default skin has a written voice', () => {
    const need = WOODAK_SKINS.filter((s) => s.id !== 'woodak').map((s) => s.id);
    expect([...need].sort()).toEqual([...VOICED_SKINS].sort());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: FAIL — `turtle has all 23 lines in both locales` → `en voice.turtle.won: expected undefined to be type 'string'`.

- [ ] **Step 3: Add the Korean lines**

Append to `locales/ko.json`:

```json
  "voice.turtle.won": "완료되었습니다. 원고가 서적의 형태를 갖추었군요. 통계적으로 드문 결과입니다.",
  "voice.turtle.discovery": "이번 런에서 신규 어휘 {n}건이 도감에 등재되었습니다. 표본이 늘수록 판단은 정확해집니다.",
  "voice.turtle.tip.reroll": "리롤 사용 0회로 기록되었습니다. 상점 재고는 확률 분포이지 운명이 아닙니다.",
  "voice.turtle.tip.discard": "버리기 사용 0회입니다. 버리기는 손실이 아니라 표본 재추출입니다. 예산을 남길 이유가 없습니다.",
  "voice.turtle.tip.shop": "문방구 구매 내역이 없습니다. 투자하지 않은 자금의 기대 수익률은 정확히 0입니다.",
  "voice.turtle.tip.0": "문장 패턴을 완성하면 점수가 계단식으로 상승합니다. 개별 단어 최적화보다 우선순위가 높습니다.",
  "voice.turtle.tip.1": "패턴 배수는 후반 페이즈일수록 기여도가 커집니다. 곱셈은 마지막에 걸릴수록 유리합니다.",
  "voice.turtle.tip.2": "A, E, I, O, U를 한 단어에 모두 포함하면 모음 플러시입니다. 이 핸드는 횡설수설에서도 성립합니다.",
  "voice.turtle.tip.3": "이자는 보유금 $5당 $1입니다. 복리는 아니며, 블라인드 종료 시마다 정산됩니다.",
  "voice.turtle.tip.4": "관사와 형용사는 패턴 골격을 훼손하지 않습니다. 수식어로 흡수되어 보너스만 가산됩니다.",
  "voice.turtle.enc.firstGibberish": "사전에 없는 배열도 제출 가능합니다. 다만 글자 [c:칩]에 ×1만 적용되고 접미 배수는 없으며, 문장에 공백을 남겨 패턴 판정을 무효화합니다.",
  "voice.turtle.enc.firstLetterHand": "한 단어 내부의 글자 구성이 보너스 핸드를 이룹니다 — 쌍둥이, 트리플렛, 모음 플러시 등. 접미 정산 이전에 [c:칩]과 [m:배수]가 가산되며, 최고 등급 하나만 적용됩니다.",
  "voice.turtle.enc.firstPattern": "제출한 단어들은 하나의 문장으로 누적됩니다. 문법 패턴이 성립하면 [b:블라인드] 종료 시 보너스가 지급되며, 패턴 복잡도에 비례해 증가합니다.",
  "voice.turtle.enc.firstUnison": "문장의 모든 단어가 동일 슈트이고 단어 수가 2 이상이면 유니즌이 성립합니다. 단일 색 유지에 대한 보상으로 배수가 가산됩니다.",
  "voice.turtle.enc.firstMaterial": "타일에는 재질 속성이 부여될 수 있습니다 — 자기, 유리, 황동 등 8종. 각 재질의 정확한 계수는 도감에 정리되어 있습니다.",
  "voice.turtle.enc.firstFont": "타일 폰트는 씰 효과를 보유할 수 있습니다: 추가 [c:칩], 금화, 재발동, 또는 버리기 시 소모품 획득. 개별 효과는 툴팁을 참조하십시오.",
  "voice.turtle.enc.firstJoker": "이모지 타일은 득점 시점마다 발동하는 지속 효과입니다. 발동 순서는 좌에서 우이며, 가산 효과를 곱셈 효과보다 앞에 두는 편이 유리합니다.",
  "voice.turtle.enc.firstConsumable": "일회성 아이템입니다 — 문구류 및 문장부호. 슬롯 수가 제한되므로 보유보다 사용 시점의 판단이 중요합니다.",
  "voice.turtle.enc.firstVoucher": "런 전체에 적용되는 영구 강화입니다. 챕터당 1회 구매로 제한되며, 구매한 항목은 재출현하지 않습니다.",
  "voice.turtle.enc.firstPack": "팩은 제시된 선택지 중 일부를 선택해 획득하는 구조입니다 — 타일, 이모지, 소모품. 팩 크기에 따라 제시 수와 선택 수가 달라집니다.",
  "voice.turtle.enc.magnifier": "돋보기는 현재 손패로 구성 가능한 단어를 최대 3건까지 제시합니다. 탐색 비용을 줄이는 도구입니다.",
  "voice.turtle.enc.pouchHover": "\"남음\"은 미추첨 주머니 잔여분만을 계수합니다. 손패, 제출분, 폐기분은 이미 모집단에서 제외된 상태입니다.",
  "voice.turtle.enc.firstBoss": "본 라운드는 보스 블라인드입니다. 규칙 변경 제약이 적용되므로, 사이드바의 효과 명세를 먼저 확인한 뒤 단어를 설계하십시오.",
```

- [ ] **Step 4: Add the English lines**

Append to `locales/en.json`:

```json
  "voice.turtle.won": "Complete. The manuscript has taken the form of a book. Statistically, an uncommon result.",
  "voice.turtle.discovery": "{n} new entries were logged to the collection this run. A larger sample makes for sounder judgment.",
  "voice.turtle.tip.reroll": "Rerolls used: zero. Shop stock is a probability distribution, not a destiny.",
  "voice.turtle.tip.discard": "Discards used: zero. A discard is not a loss but a resample. There is no reason to underspend it.",
  "voice.turtle.tip.shop": "No purchases recorded at the shop. Uninvested capital returns exactly zero.",
  "voice.turtle.tip.0": "Completing a sentence pattern raises the score in steps. It outranks optimizing any single word.",
  "voice.turtle.tip.1": "Pattern mult contributes more the later the phase. Multiplication is best applied last.",
  "voice.turtle.tip.2": "All of A, E, I, O and U within one word constitutes a Vowel Flush. This hand also holds on gibberish.",
  "voice.turtle.tip.3": "Interest is $1 per $5 held. It does not compound, and settles at the end of each blind.",
  "voice.turtle.tip.4": "Articles and adjectives do not damage the pattern skeleton. They are absorbed as modifiers and add bonus only.",
  "voice.turtle.enc.firstGibberish": "Arrangements absent from the dictionary remain submittable. However, letter [c:chips] apply at ×1 with no suit multiplier, and the gap left in the sentence voids pattern evaluation.",
  "voice.turtle.enc.firstLetterHand": "The letter composition within a single word can form a bonus hand — Twin, Triplet, Vowel Flush, and others. Bonus [c:chips] and [m:mult] are added before the suit settles, and only the highest single hand applies.",
  "voice.turtle.enc.firstPattern": "Submitted words accumulate into one sentence. When a grammatical pattern holds, a bonus is paid at [b:blind] end, scaling with the pattern's complexity.",
  "voice.turtle.enc.firstUnison": "If every word in the sentence shares one suit and the count is 2 or more, Unison holds. The multiplier is raised as compensation for maintaining a single color.",
  "voice.turtle.enc.firstMaterial": "Tiles may carry a material property — Porcelain, Glass, Brass, and five others. The exact coefficients are tabulated in the collection.",
  "voice.turtle.enc.firstFont": "A tile's font may hold a seal effect: extra [c:chips], gold, a retrigger, or a consumable on discard. Consult the tooltip for the individual effect.",
  "voice.turtle.enc.firstJoker": "Emoji tiles are persistent effects that fire at each scoring event. Firing order runs left to right; placing additive effects ahead of multiplicative ones is generally favorable.",
  "voice.turtle.enc.firstConsumable": "One-shot items — stationery and punctuation. Slot count is limited, so the timing of use matters more than holding.",
  "voice.turtle.enc.firstVoucher": "A permanent upgrade applied to the whole run. Purchase is limited to one per chapter, and a purchased entry never reappears.",
  "voice.turtle.enc.firstPack": "A pack presents a set of options from which a subset is drafted — tiles, emoji, consumables. Pack size determines how many are shown and how many may be taken.",
  "voice.turtle.enc.magnifier": "The Magnifier presents up to three words constructible from the current hand. It is a tool for reducing search cost.",
  "voice.turtle.enc.pouchHover": "\"Remaining\" counts only the undrawn residue of the pouch. Tiles in hand, submitted, or discarded are already excluded from the population.",
  "voice.turtle.enc.firstBoss": "This round is a boss blind. A rule-altering constraint applies, so review the effect specification in the sidebar before designing your words.",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/mascot-voice.test.ts`
Expected: PASS, no failures.

Run the whole suite and the type check:
```
npx vitest run
npx tsc --noEmit
```
Expected: PASS / no errors. Delete `dist/` if `tsc` created it before re-running Vitest.

- [ ] **Step 6: Commit**

```bash
git add locales/en.json locales/ko.json tests/mascot-voice.test.ts
git commit -m "feat(i18n): 느무보 (Nemubo) voice — 23 lines, ko + en

Scholar register: formal, exact figures, no filler. Adds a coverage guard so a
future skin registered in WOODAK_SKINS without a written voice fails the suite.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Verify in the running game

Automated tests cover the data; this task confirms the copy actually renders through the skin picker.

**Files:** none modified unless a defect is found.

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces: nothing.

- [ ] **Step 1: Read the project's verification recipe**

Invoke the `verify` skill (`Skill` tool, `skill: "verify"`) and follow its build/launch steps. Two constraints it records that matter here: set `wj.tutorialIntro` in localStorage before interacting, or the guided intro hard-locks every tile; and unlocks live in `wj.unlocks`.

- [ ] **Step 2: Unlock every skin and open the picker**

In the running app's console:

```js
localStorage.setItem('wj.tutorialIntro', '1');
localStorage.setItem('wj.unlocks', JSON.stringify(['DOG','GHOST','ALIEN','TURTLE','RED','YELLOW','GREEN','BLUE','MUSIC','SOUND']));
location.reload();
```

Open Collection → Mascots. Confirm the picker lists **우땅 / 누렁이 / 이고야 / 이고지 / 느무보** (Korean) and **WooDak / Nurungi / Egoya / Egoji / Nemubo** (English), matching Task 4.

- [ ] **Step 3: Check a run-end line per skin**

For each of 누렁이 / 이고야 / 이고지 / 느무보: select the skin, then trigger the Game Over screen (start a run and fail a blind, or use whatever shortcut the `verify` skill documents). Confirm the bubble shows that skin's voice, not WooDak's, and that the portrait matches the name.

Confirm 이고지's line stays alien in **both** languages but switches script:
Romanized in English and the fixed Hangul orthography in Korean.

- [ ] **Step 4: Check an encounter coach-mark**

With a non-default skin selected, clear `wj.tutorial` (`localStorage.removeItem('wj.tutorial'); location.reload();`) and play until an encounter fires (`firstGibberish` is the fastest — submit a non-word). Confirm the spotlight bubble shows the selected skin's body copy while the **title** stays the plain term, and that `[c:…]` markup still renders as styled chips text rather than literal brackets.

- [ ] **Step 5: Check the terminology**

Open the Collection: the category reads **이모지 타일 / Emoji Tiles**. Open the shop: the owned shelf label reads **보유 이모지 타일 / Your emoji tiles**. Confirm no screen still says 조커 / Joker.

- [ ] **Step 6: Commit any fixes**

If Steps 2–5 surface a defect, fix it, re-run `npx vitest run`, and commit with a `fix(i18n):` message describing what rendered wrong. If everything checks out, there is nothing to commit.

---

## Done criteria

- `npx vitest run` passes, `tests/mascot-voice.test.ts` included, with no failures.
- `npx tsc --noEmit` reports no errors.
- No `woodak.*`, `mascot.welcome.*`, or `tutorial.*.body` key remains in either locale file.
- Every registered non-default skin has 23 lines in both locales; the coverage guard enforces it for future skins.
- `docs/GDD.md` §11/§11.8 and §13's mascot row, and `CLAUDE.md`'s terminology and mascot bullets, describe what the code now does.
