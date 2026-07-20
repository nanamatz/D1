# Tutorial Foundation (A-2 popups + A-3 Help) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-encounter explainer popups (Layer 2) for game elements, plus a re-readable Options → Help glossary (Layer 3), sharing one i18n copy source, with a "don't show tips" kill switch.

**Architecture:** A headless `src/ui/tutorial.ts` owns the seen-flags localStorage store (mirroring `collection.ts`), the encounter registry (data table), and a tiny `tutorialBus` event singleton (mirroring the `audio` singleton). Trigger sites call `tutorialBus.fire(id)`; a single `<TutorialHost/>` mounted in `App.tsx` shows a popup once per id when the `tips` setting is on and the id is unseen. The Help screen renders the same registry + copy keys, greyed until seen. A-1 (guided intro) is a later slice.

**Tech Stack:** TypeScript strict, React, plain CSS (existing `.mascot-bubble` family), Vitest, i18n (`locales/en.json`/`ko.json`).

## Global Constraints

- Engine (`src/engine/`) is untouched — this is pure presentation (`src/ui/`).
- Copy authored ONCE in i18n under `tutorial.<id>.title` / `tutorial.<id>.body`; the popup AND the Help screen both read those keys (single source). Body copy may use richtext markup `[c:…]`/`[m:…]`/`[b:…]` (rendered via `src/ui/richtext.tsx`).
- Seen-flags in localStorage under `wj.tutorial`, alongside `wj.collection` (CLAUDE.md: "tutorial seen-flags live beside collection flags in localStorage").
- The "don't show tips" toggle (`settings.tips`, default `true`) suppresses ONLY the Layer-2 popups; the Help glossary stays available.
- This slice registers the **13 non-boss encounters** and wires only **4 low-risk triggers** (`firstGibberish`, `shopFirstVisit`, `firstPack`, `firstVoucher`); the rest are registry-only (Help lists them greyed), wired in a later slice.
- Reuse existing patterns: `collection.ts` for the store shape, the `audio` singleton for the bus shape, the materials/fonts registry-sync test for the copy-coverage guard, `Tooltip`/`richText` for card rendering idioms.
- TypeScript strict; `npx tsc --noEmit` clean. Full `npx vitest run` stays green.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `tutorial.ts` — seen-flags store, encounter registry, bus

**Files:**
- Create: `src/ui/tutorial.ts`
- Test: `tests/tutorial-store.test.ts`

**Interfaces:**
- Consumes: nothing (leaf; localStorage).
- Produces (later tasks rely on these EXACT names):
  - `export type EncounterId` — union of the 13 ids.
  - `export type EncounterGroup = 'tiles' | 'scoring' | 'economy' | 'run'`.
  - `export interface Encounter { id: EncounterId; group: EncounterGroup; icon: string }`
  - `export const ENCOUNTERS: readonly Encounter[]`
  - `hasSeen(id: EncounterId): boolean`, `markSeen(id: EncounterId): void`, `loadTutorial(): Record<string, number>`, `resetTutorial(): void`, `seenCount(): number`
  - `export const tutorialBus` with `fire(id: EncounterId): void` and `subscribe(fn: (id: EncounterId) => void): () => void` (returns an unsubscribe).

- [ ] **Step 1: Write the failing test** — `tests/tutorial-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeen, markSeen, resetTutorial, seenCount, ENCOUNTERS, tutorialBus, type EncounterId } from '../src/ui/tutorial';

// jsdom is not configured project-wide; provide a minimal localStorage shim for
// this file (the store only uses getItem/setItem/removeItem).
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetTutorial();
});

describe('tutorial seen-flags store', () => {
  it('hasSeen is false until markSeen, true after (persisted)', () => {
    expect(hasSeen('firstGibberish')).toBe(false);
    markSeen('firstGibberish');
    expect(hasSeen('firstGibberish')).toBe(true);
    expect(seenCount()).toBe(1);
  });

  it('markSeen is idempotent (no double count)', () => {
    markSeen('firstPack');
    markSeen('firstPack');
    expect(seenCount()).toBe(1);
  });

  it('resetTutorial clears all flags', () => {
    markSeen('firstVoucher');
    resetTutorial();
    expect(hasSeen('firstVoucher')).toBe(false);
    expect(seenCount()).toBe(0);
  });

  it('registry has all 13 encounters with unique ids and a group', () => {
    expect(ENCOUNTERS.length).toBe(13);
    const ids = new Set(ENCOUNTERS.map((e) => e.id));
    expect(ids.size).toBe(13);
    for (const e of ENCOUNTERS) expect(e.group).toBeTruthy();
  });
});

describe('tutorialBus', () => {
  it('fire notifies subscribers; unsubscribe stops them', () => {
    const seen: EncounterId[] = [];
    const off = tutorialBus.subscribe((id) => seen.push(id));
    tutorialBus.fire('firstGibberish');
    expect(seen).toEqual(['firstGibberish']);
    off();
    tutorialBus.fire('firstPack');
    expect(seen).toEqual(['firstGibberish']); // no longer receiving
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/tutorial-store.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/ui/tutorial.ts`**

```ts
/**
 * Tutorial Layer 2/3 foundation (work order A). Seen-flags live in localStorage
 * beside the word collection (wj.collection → wj.tutorial), the encounter
 * registry is a data table, and a tiny event bus lets any trigger site announce
 * an encounter without threading a callback through props — the same singleton
 * shape as src/ui/audio.ts.
 *
 * Copy is NOT here: each encounter's title/body are i18n keys
 * `tutorial.<id>.title` / `.body`, shared verbatim by the popup and the Help
 * glossary (single source).
 */

const KEY = 'wj.tutorial';

/** The 13 non-boss encounters (A-2). Per-boss encounters are a later slice. */
export type EncounterId =
  | 'firstJoker' | 'firstMaterial' | 'firstFont' | 'firstLetterHand'
  | 'firstPattern' | 'firstUnison' | 'firstGibberish' | 'shopFirstVisit'
  | 'firstConsumable' | 'firstVoucher' | 'firstPack' | 'pouchHover' | 'magnifier';

export type EncounterGroup = 'tiles' | 'scoring' | 'economy' | 'run';

export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: string;
}

export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'firstGibberish', group: 'scoring', icon: '🗯️' },
  { id: 'firstLetterHand', group: 'scoring', icon: '🃏' },
  { id: 'firstPattern', group: 'scoring', icon: '📝' },
  { id: 'firstUnison', group: 'scoring', icon: '🎵' },
  { id: 'firstMaterial', group: 'tiles', icon: '🧱' },
  { id: 'firstFont', group: 'tiles', icon: '🅰️' },
  { id: 'firstJoker', group: 'run', icon: '🤡' },
  { id: 'firstConsumable', group: 'economy', icon: '✏️' },
  { id: 'firstVoucher', group: 'economy', icon: '🎫' },
  { id: 'firstPack', group: 'economy', icon: '📦' },
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪' },
  { id: 'magnifier', group: 'economy', icon: '🔍' },
  { id: 'pouchHover', group: 'run', icon: '👝' },
];

type Flags = Record<string, number>;

export function loadTutorial(): Flags {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Flags) : {};
  } catch {
    return {};
  }
}

export function hasSeen(id: EncounterId): boolean {
  return loadTutorial()[id] !== undefined;
}

export function markSeen(id: EncounterId, now: number = Date.now()): void {
  const flags = loadTutorial();
  if (flags[id] !== undefined) return;
  flags[id] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function seenCount(): number {
  return Object.keys(loadTutorial()).length;
}

export function resetTutorial(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Event bus — decouples trigger sites from the popup host (audio-singleton shape). */
class TutorialBus {
  private subs = new Set<(id: EncounterId) => void>();
  fire(id: EncounterId): void {
    for (const fn of this.subs) fn(id);
  }
  subscribe(fn: (id: EncounterId) => void): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }
}

export const tutorialBus = new TutorialBus();
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/tutorial-store.test.ts` → PASS; `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tutorial.ts tests/tutorial-store.test.ts
git commit -m "feat : tutorial foundation — seen-flags store, encounter registry, event bus"
```

---

### Task 2: i18n copy for all 13 encounters (+ a coverage guard)

**Files:**
- Modify: `locales/en.json`, `locales/ko.json`
- Test: extend `tests/tutorial-store.test.ts` (add a locale-coverage describe block)

**Interfaces:**
- Consumes: `ENCOUNTERS` (Task 1).
- Produces: `tutorial.<id>.title` + `tutorial.<id>.body` for all 13 ids, both locales.

- [ ] **Step 1: Write the failing test** — append to `tests/tutorial-store.test.ts`:

```ts
import en from '../locales/en.json';
import ko from '../locales/ko.json';

describe('tutorial copy stays in sync with the registry', () => {
  it('every encounter has title+body in both locales', () => {
    for (const e of ENCOUNTERS) {
      for (const loc of [en, ko] as Record<string, string>[]) {
        expect(loc).toHaveProperty(`tutorial.${e.id}.title`);
        expect(loc).toHaveProperty(`tutorial.${e.id}.body`);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/tutorial-store.test.ts` → FAIL (keys missing).

- [ ] **Step 3: Add copy** — in `locales/en.json` (place as a contiguous block; keys are flat dotted strings, matching the file's existing style):

```json
  "tutorial.firstGibberish.title": "Gibberish",
  "tutorial.firstGibberish.body": "Not a real word? Play it anyway — gibberish scores its letter [c:chips] at ×1 with no suit bonus, and leaves a hole that voids the sentence pattern.",
  "tutorial.firstLetterHand.title": "Letter Hand",
  "tutorial.firstLetterHand.body": "The letters in one word can form a bonus hand (Twin, Triplet, Vowel Flush…), adding [c:chips]/[m:mult] before the suit settles. Highest single hand only.",
  "tutorial.firstPattern.title": "Sentence Pattern",
  "tutorial.firstPattern.body": "Words you play line up into a sentence. Complete a grammatical pattern for a big [b:blind]-end bonus — the more complex the pattern, the bigger it pays.",
  "tutorial.firstUnison.title": "Unison",
  "tutorial.firstUnison.body": "When 2+ words in the sentence share one suit, Unison adds a bonus — our take on a flush.",
  "tutorial.firstMaterial.title": "Tile Material",
  "tutorial.firstMaterial.body": "Some tiles carry a material (Porcelain, Glass, Brass…) that changes how they score. Check the collection for each material's effect.",
  "tutorial.firstFont.title": "Font Seal",
  "tutorial.firstFont.body": "A tile's font can carry a seal effect — extra [c:chips], gold, a retrigger, or a consumable on discard. See its tooltip for the effect.",
  "tutorial.firstJoker.title": "Joker",
  "tutorial.firstJoker.body": "Jokers apply passive effects every time you score. They fire in order, left to right — arrange them well.",
  "tutorial.firstConsumable.title": "Consumable",
  "tutorial.firstConsumable.body": "One-shot items (stationery, punctuation, forbidden books). Hold them in your consumable slots and use them when the moment fits.",
  "tutorial.firstVoucher.title": "Voucher",
  "tutorial.firstVoucher.body": "A permanent run upgrade. One purchase per chapter, and it never leaves once bought.",
  "tutorial.firstPack.title": "Pack",
  "tutorial.firstPack.body": "Open a pack to draft from a few options — tiles, jokers, or consumables. Pick the best fit for your build.",
  "tutorial.shopFirstVisit.title": "The Stationery Shop",
  "tutorial.shopFirstVisit.body": "Spend your fee between blinds: buy jokers and consumables, reroll the stock, grab a voucher or pack. Piyak the proprietor restocks each visit.",
  "tutorial.magnifier.title": "Magnifier",
  "tutorial.magnifier.body": "Use the Magnifier to reveal up to three words you can spell from your current hand.",
  "tutorial.pouchHover.title": "The Pouch",
  "tutorial.pouchHover.body": "\"Remaining\" counts only the undrawn tiles still in the pouch — tiles in hand, played, or discarded have already left it.",
```

In `locales/ko.json` (same keys, Korean copy; use the glossary terms Draft/Revision/Deadline→초고/퇴고/마감, Fee→원고료, Pouch→보따리, Shop→문방구, Piyak the cat is the shop proprietor):

```json
  "tutorial.firstGibberish.title": "횡설수설",
  "tutorial.firstGibberish.body": "단어가 아니어도 제출할 수 있습니다 — 횡설수설은 글자 [c:칩]을 ×1로만 계산하고 접미 보너스가 없으며, 문장에 구멍을 내 패턴을 무효화합니다.",
  "tutorial.firstLetterHand.title": "레터 핸드",
  "tutorial.firstLetterHand.body": "한 단어의 글자들이 보너스 핸드(쌍둥이·트리플렛·모음 플러시…)를 이루면 접미 정산 전에 [c:칩]/[m:배수]를 더합니다. 가장 높은 핸드 하나만 적용됩니다.",
  "tutorial.firstPattern.title": "문장 패턴",
  "tutorial.firstPattern.body": "낸 단어들이 문장으로 이어집니다. 문법 패턴을 완성하면 [b:블라인드] 종료 시 큰 보너스가 붙습니다 — 복잡한 패턴일수록 더 크게 지급됩니다.",
  "tutorial.firstUnison.title": "유니즌",
  "tutorial.firstUnison.body": "문장 속 2개 이상의 단어가 같은 접미를 공유하면 유니즌 보너스가 붙습니다 — 플러시에 해당하는 규칙입니다.",
  "tutorial.firstMaterial.title": "타일 재질",
  "tutorial.firstMaterial.body": "일부 타일은 재질(자기·유리·황동…)을 지녀 득점 방식이 달라집니다. 각 재질의 효과는 도감에서 확인하세요.",
  "tutorial.firstFont.title": "폰트 씰",
  "tutorial.firstFont.body": "타일의 폰트는 씰 효과를 지닐 수 있습니다 — 추가 [c:칩], 골드, 재발동, 또는 버릴 때 소모품. 효과는 툴팁에서 확인하세요.",
  "tutorial.firstJoker.title": "조커",
  "tutorial.firstJoker.body": "조커는 득점할 때마다 발동하는 지속 효과입니다. 왼쪽에서 오른쪽 순서로 발동하니 배치를 잘 하세요.",
  "tutorial.firstConsumable.title": "소모품",
  "tutorial.firstConsumable.body": "일회성 아이템(문구류·문장부호·금서). 소모품 슬롯에 두었다가 적절한 순간에 사용하세요.",
  "tutorial.firstVoucher.title": "바우처",
  "tutorial.firstVoucher.body": "런 전체에 적용되는 영구 업그레이드. 챕터당 한 번만 구매할 수 있고, 한 번 사면 사라지지 않습니다.",
  "tutorial.firstPack.title": "팩",
  "tutorial.firstPack.body": "팩을 열어 몇 가지 선택지(타일·조커·소모품) 중에서 골라 담습니다. 빌드에 맞는 것을 고르세요.",
  "tutorial.shopFirstVisit.title": "문방구",
  "tutorial.shopFirstVisit.body": "블라인드 사이에 원고료를 쓰세요: 조커·소모품 구매, 상품 리롤, 바우처나 팩 구입. 주인장 피약이 방문할 때마다 물건을 채워둡니다.",
  "tutorial.magnifier.title": "돋보기",
  "tutorial.magnifier.body": "돋보기를 쓰면 지금 손패로 만들 수 있는 단어를 최대 3개까지 보여줍니다.",
  "tutorial.pouchHover.title": "보따리",
  "tutorial.pouchHover.body": "\"남음\"은 아직 뽑지 않은 보따리 속 타일만 셉니다 — 손패·낸 타일·버린 타일은 이미 보따리를 떠난 것입니다.",
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/tutorial-store.test.ts` → PASS; `npx tsc --noEmit` clean; also run the full `npx vitest run` (the new JSON must parse).

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/ko.json tests/tutorial-store.test.ts
git commit -m "feat : tutorial encounter copy (13 encounters, ko/en) + registry sync test"
```

---

### Task 3: `settings.tips` toggle + Settings Game tab + audio-note cleanup

**Files:**
- Modify: `src/ui/settings.ts` (add `tips` field + default)
- Modify: `src/ui/components/Options.tsx` (Game-tab Toggle; audio-tab note cleanup)
- Modify: `locales/en.json`, `locales/ko.json` (`settings.tips` label; overwrite `settings.audioStub`)

**Interfaces:**
- Consumes: existing `useSettings`.
- Produces: `settings.tips: boolean` (default `true`) — Task 4's host reads it.

- [ ] **Step 1: Implement** — `src/ui/settings.ts`: add to the `Settings` interface `tips: boolean;` and to `DEFAULT_SETTINGS` `tips: true,`. No effect wiring needed (it's read, not applied to the document).

`src/ui/components/Options.tsx` — in the Game `set-tabpanel`, after the `colorBlind` Toggle, add:

```tsx
            <Toggle
              label={t('settings.tips')}
              on={settings.tips}
              onChange={(v) => set('tips', v)}
            />
```

And replace the audio-tab stale note line `<p className="set-note">{t('settings.audioStub')}</p>` — keep the element but point it at fresh copy: `<p className="set-note">{t('settings.audioNote')}</p>`.

`locales/en.json`: add `"settings.tips": "Show tutorial tips",` and `"settings.audioNote": "Chiptune SFX. BGM coming later.",`. `locales/ko.json`: `"settings.tips": "튜토리얼 팁 표시",` and `"settings.audioNote": "칩튠 효과음. 배경음악은 추후 추가.",`. (Leave the old `settings.audioStub` key in place unused, or remove it — remove it from both locales since nothing references it after this change; grep `audioStub` to confirm no other reference.)

- [ ] **Step 2: Verify** — `grep -rn "audioStub" src` returns nothing; `npx tsc --noEmit` clean; `npx vitest run` green.

- [ ] **Step 3: Commit**

```bash
git add src/ui/settings.ts src/ui/components/Options.tsx locales/en.json locales/ko.json
git commit -m "feat : 'show tutorial tips' setting (default on) + refresh stale audio-tab note"
```

---

### Task 4: `TutorialPopup` + `TutorialHost`, mounted in App

**Files:**
- Create: `src/ui/components/TutorialPopup.tsx`
- Modify: `src/ui/App.tsx` (mount `<TutorialHost/>`)
- Modify: `src/ui/styles/screens.css` (popup card styles — reuse tokens; small block)

**Interfaces:**
- Consumes: `tutorialBus`, `hasSeen`, `markSeen`, `ENCOUNTERS` (Task 1); `useSettings().settings.tips` (Task 3); `useI18n`, `richText`.
- Produces: `export function TutorialHost(): JSX.Element` — mount once.

- [ ] **Step 1: Implement `src/ui/components/TutorialPopup.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { richText } from '../richtext';
import { tutorialBus, hasSeen, markSeen, ENCOUNTERS, type EncounterId } from '../tutorial';

/**
 * Layer-2 encounter popup host (work order A-2). Mounted once in App. Subscribes
 * to the tutorial bus; when an encounter fires for the first time AND the "show
 * tips" setting is on, it shows a one-time card and marks the id seen on dismiss.
 * Decoupled from trigger sites via the bus (no prop threading).
 */
export function TutorialHost() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [active, setActive] = useState<EncounterId | null>(null);

  useEffect(() => {
    return tutorialBus.subscribe((id) => {
      // Read the freshest tips setting at fire time via localStorage-backed hook:
      // if tips are off, or already seen, do nothing.
      if (!settings.tips) return;
      if (hasSeen(id)) return;
      setActive((cur) => cur ?? id); // don't clobber a popup already showing
    });
  }, [settings.tips]);

  if (!active) return <></>;
  const enc = ENCOUNTERS.find((e) => e.id === active);
  const dismiss = () => {
    markSeen(active);
    setActive(null);
  };

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div className="tut-card" onClick={(e) => e.stopPropagation()}>
        <div className="tut-head">
          <span className="tut-icon">{enc?.icon}</span>
          <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
        </div>
        <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
        <button className="btn blue tut-ok" onClick={dismiss}>
          {t('tutorial.gotIt')}
        </button>
      </div>
    </div>
  );
}
```

Add copy `"tutorial.gotIt": "Got it"` (en) / `"tutorial.gotIt": "확인"` (ko) to the locales in this task's commit.

`src/ui/App.tsx` — import and mount the host so it overlays every screen (it renders nothing until an encounter fires):

```tsx
import { TutorialHost } from './components/TutorialPopup';
```

Wrap the returned transition so the host is a sibling that is always mounted:

```tsx
  return (
    <>
      <ScreenTransition screenKey={screen}>{view()}</ScreenTransition>
      <TutorialHost />
    </>
  );
```

- [ ] **Step 2: Styles** — append to `src/ui/styles/screens.css` (reuse existing tokens; a centered dim overlay + card):

```css
/* ---------- tutorial encounter popup (work order A-2) ---------- */
.tut-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.tut-card {
  width: min(360px, 86vw);
  background: var(--panel, #1c2b26);
  border: 2px solid var(--edge, #0d1512);
  border-radius: 8px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.4);
  padding: 16px;
  color: #fff;
}
.tut-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.tut-icon { font-size: 22px; }
.tut-title { font-weight: 700; font-size: 16px; }
.tut-body { line-height: 1.5; font-size: 13px; margin-bottom: 14px; }
.tut-ok { width: 100%; }
```

(Confirm the token names `--panel`/`--edge` exist in `tokens.css`; if not, use the nearest existing panel background/border tokens the other cards use — grep `.coll-card`/`.tt-card` in screens.css for the established values.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green (no new unit test — behavior covered by Task 7 in-app smoke). Commit copy + component + App + CSS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/TutorialPopup.tsx src/ui/App.tsx src/ui/styles/screens.css locales/en.json locales/ko.json
git commit -m "feat : tutorial popup host — one-time encounter cards, tips-toggle aware"
```

---

### Task 5: Wire the 4 low-risk triggers

**Files:**
- Modify: `src/ui/useGame.ts` (`playWord` gibberish, `buyPack`, `buyVoucherAction`)
- Modify: `src/ui/components/RunView.tsx` (shop-enter, alongside the catMeow effect)

**Interfaces:**
- Consumes: `tutorialBus.fire` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Implement useGame** — add `import { tutorialBus } from './tutorial';`.
  - In `playWord`, after the submission is computed and it's gibberish (the `lastPlayed`/`submission.isGibberish` is known in that callback), fire: `if (submission.isGibberish) tutorialBus.fire('firstGibberish');`. Place it next to where `submission` is available in the success path (after `submitWord` returns), a fire-and-forget line — the bus no-ops if seen/tips-off.
  - In `buyPack` success branch (right after `audio.play('packOpen')`): `tutorialBus.fire('firstPack');`.
  - In `buyVoucherAction` success branch (right after `audio.play('voucherRedeem')`): `tutorialBus.fire('firstVoucher');`.

- [ ] **Step 2: Implement RunView** — add `import { tutorialBus } from '../tutorial';` and in the existing phase effect (the one added for SFX, `if (phase === 'shop') …`), add `tutorialBus.fire('shopFirstVisit');` inside the `phase === 'shop'` branch (after the catMeow). Both are fire-and-forget.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green (fires are no-ops in Node — no test affected).

- [ ] **Step 4: Commit**

```bash
git add src/ui/useGame.ts src/ui/components/RunView.tsx
git commit -m "feat : wire 4 low-risk tutorial encounters (gibberish, shop, pack, voucher)"
```

---

### Task 6: Help glossary (Options → Help, A-3)

**Files:**
- Modify: `src/ui/components/Options.tsx` (add `'help'` View + root button + `HelpView`)
- Modify: `locales/en.json`, `locales/ko.json` (`options.help`, `help.title`, `help.group.*`, `help.undiscovered`)
- Modify: `src/ui/styles/screens.css` (help list styles — small block, may reuse existing)

**Interfaces:**
- Consumes: `ENCOUNTERS`, `hasSeen`, `EncounterGroup` (Task 1); copy keys (Task 2).
- Produces: nothing.

- [ ] **Step 1: Implement** — in `Options.tsx`:
  - Extend `type View` with `'help'`.
  - Add a root button after Statistics (screens-spec §2.10 order: Settings · Statistics · Help · Credits): `<button className="btn exchange" onClick={() => setView('help')}>{t('options.help')}</button>`.
  - Render `{view === 'help' && <HelpView />}` alongside the others.
  - Add the component (imports `ENCOUNTERS`, `hasSeen`, `useI18n`, `richText`):

```tsx
function HelpView() {
  const { t } = useI18n();
  const groups: EncounterGroup[] = ['tiles', 'scoring', 'economy', 'run'];
  return (
    <>
      <h2 className="scr-title">{t('help.title')}</h2>
      <div className="help-groups">
        {groups.map((g) => {
          const items = ENCOUNTERS.filter((e) => e.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g} className="panel help-group">
              <div className="label">{t(`help.group.${g}`)}</div>
              {items.map((e) => {
                const seen = hasSeen(e.id);
                return (
                  <div key={e.id} className={['help-entry', seen ? '' : 'locked'].filter(Boolean).join(' ')}>
                    <div className="help-entry-head">
                      <span className="tut-icon">{e.icon}</span>
                      <span className="help-entry-title">
                        {seen ? t(`tutorial.${e.id}.title`) : t('help.undiscovered')}
                      </span>
                    </div>
                    {seen && <p className="help-entry-body">{richText(t(`tutorial.${e.id}.body`))}</p>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
```

Add `import { ENCOUNTERS, hasSeen, type EncounterGroup } from '../tutorial';` and `import { richText } from '../richtext';` to Options.tsx.

- [ ] **Step 2: Copy** — en: `"options.help": "Help"`, `"help.title": "Help & Glossary"`, `"help.group.tiles": "Tiles"`, `"help.group.scoring": "Scoring"`, `"help.group.economy": "Shop & Economy"`, `"help.group.run": "Run"`, `"help.undiscovered": "??? — not yet discovered"`. ko: `"options.help": "도움말"`, `"help.title": "도움말 & 용어집"`, `"help.group.tiles": "타일"`, `"help.group.scoring": "채점"`, `"help.group.economy": "상점 & 경제"`, `"help.group.run": "런"`, `"help.undiscovered": "??? — 아직 발견하지 않음"`.

- [ ] **Step 3: Styles** — append to `screens.css`:

```css
/* ---------- Help glossary (work order A-3) ---------- */
.help-groups { display: flex; flex-direction: column; gap: 12px; }
.help-group { text-align: left; }
.help-entry { padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.help-entry:first-of-type { border-top: 0; }
.help-entry.locked { opacity: 0.4; }
.help-entry-head { display: flex; align-items: center; gap: 8px; }
.help-entry-title { font-weight: 700; font-size: 14px; }
.help-entry-body { font-size: 12px; line-height: 1.45; margin-top: 4px; }
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Options.tsx locales/en.json locales/ko.json src/ui/styles/screens.css
git commit -m "feat : Options → Help glossary (grouped, greyed until encountered)"
```

---

### Task 7: End-to-end verification + docs

**Files:**
- Modify: `docs/screens-spec.md` if a §2.10/§2.11 note needs closing (grep first; the Help button + tips toggle are already specced — only update if a PLACEHOLDER remains).
- Verify: the running app.

- [ ] **Step 1: Full green** — `npx vitest run` (incl. `tests/tutorial-store.test.ts`) and `npx tsc --noEmit` clean.

- [ ] **Step 2: In-app smoke (Playwright)** — fresh profile (`localStorage.clear()`):
  - (a) Enter shop (play/clear a blind or resume a shop-phase save) → `.tut-overlay` appears with the `shopFirstVisit` card; dismiss; re-enter shop → NO overlay (seen).
  - (b) Options → Help: `.help-entry` list renders; the `shopFirstVisit` entry is NOT `.locked` (seen), an unencountered one IS `.locked` and shows `???`.
  - (c) Settings → toggle "Show tutorial tips" off; trigger a fresh encounter (e.g. new profile, buy a pack) → NO overlay. Toggle on → fires again for an unseen id.
  - Assert no console errors throughout. Document any trigger that's impractical to reach in the smoke and why.

- [ ] **Step 3: Docs** — `grep -rn "PLACEHOLDER" docs/screens-spec.md` around §2.10/§2.11; if the Help/tips lines still say PLACEHOLDER, update them to "shipped (feature-01 A-2/A-3 foundation slice)". Keep it to the lines that changed.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs : tutorial foundation (A-2/A-3) shipped — close Help/tips placeholders"
```
