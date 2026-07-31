# Refactoring backlog

> **Status: Tier 1, Tier 2, and Tier 4 are DONE (2026-07-30).** R-01…R-08, R-10,
> R-12, R-13a and R-15 shipped; each entry below carries a **✅ Done** note with
> what actually changed (several turned out bigger than the audit predicted).
> **Still open: R-09, R-11, R-13b, R-14** — see `## Remaining` at the bottom.

> Audit date: **2026-07-30** · scope: whole tree (`src/`, `tests/`, `locales/`, `desktop/`, `scripts/`)
> Baseline: 17,467 lines of TS/TSX in `src/`, 6,958 in `tests/`, 8,022 of CSS, 679 tests green.
>
> Every item is written to be picked up cold: what to cut, what replaces it, the
> files, the risk, and the command that proves it still works. Items are ranked
> **biggest cut first** within each tier. Nothing here is applied.
>
> **Out of scope by design:** correctness bugs, security, and performance. This
> pass hunts duplication, dead code, and unearned abstraction only. Two items
> (R-04, R-12) mention a complexity class in passing; treat the perf angle as a
> side benefit, not the reason to do them.

## How to use this list

1. Pick an item. Each has a **Verify** line — run it before and after.
2. `npx tsc --noEmit && npx vitest run` is the floor for every item.
3. Items marked **⚠ save-affecting** touch data that `src/ui/storage.ts` persists.
   Read `CLAUDE.md`'s file-based-saves rule before starting one.
4. Tick the box when done. Leave the entry; the note is the history.

---

## Tier 1 — dead weight (delete, no design decision needed)

### R-01 `delete:` the retired punctuation consumable ids ⚠ save-affecting
The eight ids `ellipsis · exclamation · doubleExclamation · period · colon ·
semicolon · dash · comma` exist only in the `ConsumableId` union and in 32
locale rows. Zero engine code, zero UI code, zero tests reference them; they were
kept "for compatibility with old serialized/dev data" when Constellation cards
replaced them.

- **Cut:** 8 union members + 16 `consumable.*` + 16 `consumabledesc.*` locale rows.
- **Files:** [types.ts:335-337](src/engine/types.ts#L335-L337), `locales/en.json`, `locales/ko.json`
- **Risk:** a resting `wj.run` save from before the Constellation swap could still
  hold one in `run.consumables`. Decide: drop the ids and let `persist.ts`'s
  existing `VERSION` mismatch discard such a run, or add a one-line filter that
  strips unknown consumable ids on load. Prefer the filter — it is 1 line and
  covers every future id retirement too.
- **Saves:** ~10 lines of TS, 32 locale rows
- **Verify:** `npx vitest run && node -e "const a=require('./locales/en.json'),b=require('./locales/ko.json');console.log(Object.keys(a).length===Object.keys(b).length)"`

**✅ Done.** Bigger than audited: the eight *stationery* ids (`kiln fountainPen shift eraser correctionTape carvingKnife photocopier piggyBank`) were dead too — only `magnifier` survives. 16 ids and 32 locale rows cut. New `src/engine/consumables.ts` owns `ALL_CONSUMABLE_IDS` / `isKnownConsumableId`, and `persist.ts` now filters unknown consumables on load the way it already filtered unknown jokers — so retiring a card is a data change, not a save-version bump. `PUNCTUATION_EMOJI` in `PackOpening.tsx` went with them.

### R-02 `delete:` the same-axis overwrite confirmation modal remnants
GDD §2.4 removed the warn-before-overwrite prompt on 2026-07-28 ("players learn
the rule by doing"). The component is gone; its copy and styles are not.

- **Cut:** 5 locale keys × 2 languages (`overwrite.title/body/bodyGeneric/confirm/cancel`)
  and the `.overlay-card.overwrite-modal` / `.overwrite-title` / `.overwrite-msg`
  / `.overwrite-actions` block.
- **Files:** `locales/{en,ko}.json:486-490`, [play.css:4109-4130](src/ui/styles/play.css#L4109-L4130)
- **Risk:** none. Nothing renders these.
- **Saves:** ~10 locale rows, ~22 CSS lines
- **Verify:** `grep -rn "overwrite" src locales` returns only the unrelated prose in `balance.ts` / `loop.ts` / `settle.tsx` comments.

**✅ Done.** 10 locale rows and a 21-line CSS block removed.

### R-03 `delete:` six exports with no consumer
Each is exported and referenced nowhere outside its own declaration.

| Symbol | File |
|---|---|
| `Balance` (the `typeof BALANCE` alias) | [balance.ts](src/engine/balance.ts) |
| `ConsumableFamily` | [types.ts](src/engine/types.ts) |
| `PatternDef` | [types.ts](src/engine/types.ts) |
| `UPGRADED_VOUCHER_IDS` | [vouchers.ts](src/engine/vouchers.ts) |
| `SORT_LABEL` | [game.ts](src/ui/game.ts) |
| `SUIT_TAG` | [game.ts](src/ui/game.ts) |

- **Note:** `SORT_LABEL` and `SUIT_TAG` are worse than dead — they hold hard-coded
  **English** display strings (`'Vowel/Cons'`, `'FRM'`) that duplicate the
  `sort.*` and `suittag.*` locale rows. The UI already resolves those through
  `t()`, so these are a second, untranslated source of truth for the same text.
  Delete them; do not wire them up.
- **Risk:** none.
- **Saves:** ~25 lines
- **Verify:** `npx tsc --noEmit`

**✅ Done.** All six deleted.

### R-04 `delete:` three now-pointless pack-art indirections
Every `PackType` gained art when the Ink Pack shipped (2026-07-30), so the
"some types have no art" branch is dead.

- **Cut:** `PACK_ART`'s `Partial<>` wrapper, `hasPackArt()` (always `true` now),
  and `export type PackTooltipType = PackType` (an alias for itself).
- **Files:** [packArt.ts:45](src/ui/packArt.ts#L45), [packArt.ts:77](src/ui/packArt.ts#L77), [packTooltip.ts:27](src/ui/packTooltip.ts#L27)
- **Then:** drop the `!` non-null assertions in `packGalleryPages()` that only
  existed because of `Partial`.
- **Risk:** none. `tests/pack-art.test.ts` and `tests/pack-tooltip.test.ts` import
  both — update them in the same commit.
- **Saves:** ~15 lines and 5 non-null assertions
- **Verify:** `npx vitest run tests/pack-art.test.ts tests/pack-tooltip.test.ts`

**✅ Done.** `PACK_ART` is a total `Record`, `hasPackArt` and `PackTooltipType` are gone, five `!` assertions dropped. `tests/pack-art.test.ts` now asserts every family has art per size instead of calling the removed predicate.

### R-05 `delete:` `gamblerResolvesInstantly`
Written for Deer's "resolves immediately without occupying a held slot" rule,
then never called — every Gambler resolves inside its pack, so the predicate has
no branch to guard. `useGame.ts` imports it and does nothing with it.

- **Files:** [gamblers.ts:117](src/engine/gamblers.ts#L117), [useGame.ts:62](src/ui/useGame.ts#L62)
- **Risk:** none. If a future card *does* need a held-slot path, re-add it then.
- **Saves:** 2 lines
- **Verify:** `npx tsc --noEmit`

**✅ Done.**

---

## Tier 2 — duplication (mechanical, low risk)

### R-06 `shrink:` one `clamp`, not four
`clamp(n, lo, hi)` is defined identically in four files, plus inlined twice in
`DeskObjects.tsx`.

- **Do:** move it to `src/ui/math.ts` (new, ~3 lines) and import.
- **Files:** [audio.ts:125](src/ui/audio.ts#L125), [drag.ts:20](src/ui/drag.ts#L20), [hooks.ts:138](src/ui/hooks.ts#L138), [spotlightPos.ts:27](src/ui/spotlightPos.ts#L27), [DeskObjects.tsx:186-187](src/ui/components/DeskObjects.tsx#L186-L187)
- **Note:** `spotlightPos.ts`'s variant is `Math.max(lo, Math.min(v, Math.max(lo, hi)))`
  — it guards an inverted range. Keep that behaviour in the shared version or it
  silently changes the coach-mark position.
- **Saves:** ~10 lines
- **Verify:** `npx vitest run`

**✅ Done.** `src/ui/math.ts` owns `clamp`; the inverted-range guard from `spotlightPos.ts` is the shared behaviour. Five call sites.

### R-07 `yagni:` collapse the three `*CardArt` wrappers into one
`FableCardArt`, `ConstellationCardArt`, and `GamblerCardArt` are the same
component three times: take an id, look up art, render `<FamilyCardArt>`. The
only difference is which art registry they call.

- **Do:** one `<CardArt family="fable|constellation|gambler" id=… />` that
  resolves through a `{ fable: fableArt, constellation: constellationArt, gambler: gamblerArt }`
  map. Adding a fourth family becomes a registry row, not a new file.
- **Files:** [FableCardArt.tsx](src/ui/components/FableCardArt.tsx), [ConstellationCardArt.tsx](src/ui/components/ConstellationCardArt.tsx), [GamblerCardArt.tsx](src/ui/components/GamblerCardArt.tsx) → one file; 5 call sites in `Collection.tsx`, `JokerShelf.tsx`, `PackOpening.tsx`, `Shop.tsx`, `PatternLevelUp.tsx`
- **Risk:** low. `GamblerCardArt` returns `null` for an unknown id (Rainman /
  Sake Cup have art but no engine id); keep that guard.
- **Saves:** ~45 lines, 2 files
- **Verify:** `npx vitest run && npx vite build`

**✅ Done.** `CardArt.tsx` replaces all three wrappers; `ART` maps family → art lookup. Three files deleted, five call sites plus three tests updated.

### R-08 `shrink:` one paged card grid, not five
`FablesView`, `ConstellationsView`, `GamblerCardsView`, `VouchersView`, and
`PacksView` are the same 25-line shape: `useState(0)` → `perPage` → `slice` →
grid → `<Pager>`. Three of them are byte-identical apart from the registry, the
CSS class, and the `classification` prop.

- **Do:** a `<PagedCardGrid items={…} perPage={10} className={…} renderCard={…} />`
  and delete the repeated paging state.
- **Files:** [Collection.tsx:391-560](src/ui/components/Collection.tsx#L391-L560), [Collection.tsx:688-781](src/ui/components/Collection.tsx#L688-L781)
- **Risk:** low, but `VouchersView` and `PacksView` clamp the page differently
  (`pages - 1` vs `pages.length - 1`) — fold the clamp into the shared component
  so the off-by-one cannot come back.
- **Saves:** ~90 lines off a 798-line file
- **Verify:** `npx vitest run && npx vite build`, then open Collection and page every tab.

**✅ Done, scoped down.** `WordsView` and `PacksView` turned out NOT to share the shape (search/filter and pre-built page arrays respectively), so they keep their own bodies. What shipped: `usePaged()` owns page state + clamping for Jokers/Vouchers/cards, and `CardFamilyView` collapses the three identical card grids into one generic. The two different page clamps are now one.

### R-09 `shrink:` one tile factory for the whole test suite
Test files hand-roll `{ id, letter, material: 'ceramic', font: 'medium' }`.
Three files additionally re-declare `submission()`, `runWith()`, `ctxFor()`, and
`fixedRng()` with small differences.

- **Do:** `tests/helpers.ts` exporting `tile()`, `submission()`, `runWith()`,
  `fixedRng()`. Migrate opportunistically — a test file you touch gets converted.
- **Files:** `tests/*.ts` (14 with the tile literal; `emoji-sample`, `emoji-roster`, `gamblers` with the fuller set)
- **Risk:** none to shipped code. Do NOT unify the tests' *assertions*, only
  their fixtures — the near-duplicate helpers differ in defaults on purpose.
- **Saves:** ~150 lines across `tests/`
- **Verify:** `npx vitest run`

### R-10 `shrink:` extract the repeated pack bookkeeping in `useGame`
`usePackFable`, `usePackGambler`, and `useHeldPackFable` each rebuild the same
two blocks by hand:

```ts
const bagById = new Map(run.bag.map((t) => [t.id, t]));
const candidateTiles = prev.pack.candidateTiles
  .map((t) => bagById.get(t.id))
  .filter((t): t is Tile => t !== undefined);
```

and the "drop this option, decrement `picksLeft`, close the pack if it hits 0"
fold. `recordVoucherProgress({ kind: 'editionedJokers', … })` appears 5× and
`patternLevelBus.emit({ … })` 3×.

- **Do:** two module-level helpers next to `useGame` — `syncCandidates(pack, run)`
  and `consumePackOption(pack, index)` — plus a `recordEditionedJokers(run)` one-liner.
- **Files:** [useGame.ts:703-919](src/ui/useGame.ts#L703-L919)
- **Risk:** low; these are pure transforms. Keep them OUTSIDE the hook so they
  need no `useCallback` deps.
- **Saves:** ~60 lines off a 1,449-line file
- **Verify:** `npx vitest run` and buy a Fable Pack + an Ink Pack in a real run.

**✅ Done.** `consumePackOption`, `syncCandidates`, and `recordEditionedJokers` at module scope; 4 duplicated candidate-rebuilds, 4 pack folds, and 5 `editionedJokers` blocks collapsed.

---

## Tier 3 — structural (worth doing, needs a decision first)

### R-11 `yagni:` unify the three consumable families behind one interface
This is the largest single win in the tree and the reason `useGame.ts` is 1,449
lines. Fable, Constellation, and Gambler each ship a parallel API:

| Fable | Gambler | Constellation |
|---|---|---|
| `isFableId` | `isGamblerId` | `isConstellationId` |
| `FABLE_IDS` / `_DEFS` / `_REGISTRY` | `GAMBLER_IDS` / `_DEFS` / `_REGISTRY` | `CONSTELLATION_IDS` / `_DEFS` |
| `fableTargetsTiles` | `gamblerTargetsTiles` | — |
| `fablePickCount` | `gamblerPickCount` | — |
| `canUseFable` / `canUseFableFromPack` / `canUseUnheldFable` / `canUseFableOnPouch` | `canUseGambler` / `canUseUnheldGambler` | — |
| `useFable` / `useFableOnPouch` | `useGambler` | inline in `useGame` |

**33 branch sites** across 9 files switch on which family an id belongs to
(`cardClassification.ts`, `descriptions.ts`, `JokerShelf.tsx`, `PackOpening.tsx`,
`RunView.tsx`, `Shop.tsx`, `useGame.ts` + the two engine modules). Every new
family — or every new Gambler that needs a held-slot path — pays this tax again.

- **Do:** one `ConsumableFamilyDef { id, classification, art, targetsTiles(id),
  pickCount(id), canUse(id, ctx), use(id, ctx) }` and a
  `CONSUMABLE_REGISTRY: Map<ConsumableId, ConsumableFamilyDef>`. Call sites become
  `familyOf(id).canUse(…)` instead of an `isX ? … : isY ? … :` chain. This is the
  same "data + hooks" shape `JokerDef` and `BossDef` already use, so it is the
  house pattern, not a new abstraction.
- **Note:** `ConsumableFamily` already exists in `types.ts` and is unused (see
  R-03) — it was presumably the start of exactly this. Revive it rather than deleting.
- **Risk:** **medium-high.** Touches the pack flow, the shelf, the shop, and the
  save-visible `run.consumables`. Do it in two commits: (1) introduce the registry
  and route the *predicates* through it, leaving `useFable`/`useGambler` intact;
  (2) move the `use` bodies behind it. Ship (1) alone if (2) looks hairy.
- **Saves:** ~200 lines, and every future card family becomes one file
- **Verify:** `npx vitest run` plus a manual pass: use a Fable in a blind, a Fable
  in its pack, a Gambler in an Ink Pack, a Gambler held into a blind, a
  Constellation in its pack, and a Constellation from the shelf.

### R-12 `shrink:` `sampleJokerDefs` regroups the whole pool every iteration
The `while` loop rebuilds `byRarity` from scratch on each pick, so drawing `n`
tiles is `O(n · |pool|)`. The pool is 32 entries, so this is not a performance
problem — it is 12 lines doing what 3 should.

- **Do:** build `byRarity` once above the loop and `splice` the picked entry out
  of its group. If the toolchain moves to `lib: ES2024`, `Map.groupBy` replaces
  the manual accumulate entirely.
- **Files:** [offers.ts:42-67](src/engine/offers.ts#L42-L67)
- **Risk:** **the seeded RNG draw order must not change.** `tests/feature03-offers.test.ts`
  asserts distribution, not exact sequences, so it will not catch a shift — add a
  snapshot of one seeded roll before you start.
- **Saves:** ~10 lines
- **Verify:** capture `sampleJokerDefs(run, 20, makeRng('x')).map(d => d.id)` before and after; they must be identical.

**✅ Done, equivalence proven.** Grouped once and drained; a rarity leaves the pool when its last member is taken. Verified by running the old and new implementations side by side over **1,000 draws** (counts 3/5/20/60/200 × 200 seeds, including counts past the pool size so the drained-rarity path is exercised): identical id sequences.

### R-13 `yagni:` retire the legacy engine identifiers
Display names were unified on 2026-07-30; the *code* names still carry the retired
vocabulary, and each one costs a reader a lookup:

| Identifier | Actually means | File |
|---|---|---|
| `PackOption.kind: 'punctuation'` | a Constellation card | [packs.ts:64](src/engine/packs.ts#L64) |
| `ShopItem.kind: 'punctuation'` | a Constellation card | [types.ts:284](src/engine/types.ts#L284) |
| `PUNCTUATION_POOL` | the Constellation pool | [packs.ts:45](src/engine/packs.ts#L45) |
| `STATIONERY_POOL` | the Fable pool | [packs.ts:39](src/engine/packs.ts#L39) |
| `CONSUMABLE_POOL` | alias of `STATIONERY_POOL` | [packs.ts:41](src/engine/packs.ts#L41) |
| `PackType 'consumable'` | the Fable Pack | [types.ts:290](src/engine/types.ts#L290) |
| `PackType 'pattern'` | the Constellation Pack | [types.ts:290](src/engine/types.ts#L290) |

- **Do it in two halves.** The pool constants (`STATIONERY_POOL`, `CONSUMABLE_POOL`,
  `PUNCTUATION_POOL` → `FABLE_POOL`, `CONSTELLATION_POOL`) are a pure rename with
  4 call sites — **do that half today, it is free.** The `kind` and `PackType`
  string literals are the expensive half.
- **Risk on the second half:** ⚠ save-affecting. `PackType` reaches `wj.run`
  through `ShopState.packs`, and `BALANCE.pack.typeWeights` / `artVariants` /
  `PACK_ART` are keyed by it. A rename needs a migration or a rest-of-shop reroll
  on load. **`CLAUDE.md` already rules that display terms never rename engine
  identifiers** — so this half is a genuine spec question, not a free cleanup.
  Raise it before starting.
- **Saves:** ~0 net lines; the win is entirely readability
- **Verify:** `npx vitest run && npx vite build && npm run build:desktop`

### R-14 `shrink:` split `useGame.ts` (1,449 lines, 30 callbacks)
The controller owns the blind loop, the shop, packs, consumables, drag-reorder,
persistence, and the tutorial bus. It is the file every feature has to touch.

- **Do:** peel off the self-contained groups into `useShop.ts`, `usePacks.ts`,
  and `useConsumables.ts`, each taking `(state, setState)` and returning its slice
  of the API. `useGame` keeps the state object and composes them, so `UseGame`'s
  public shape does not change and no component moves.
- **Order:** do R-10 and R-11 first — they delete ~260 lines from this file and
  make the seams obvious. Splitting before them just relocates the duplication.
- **Risk:** medium. Pure mechanical move, but a large diff; land it alone, not
  alongside a feature.
- **Saves:** no net lines; 1,449 → roughly 600 + 3 × ~250
- **Verify:** `npx vitest run && npx vite build`, then a full run: blind → clear → cash out → shop → pack → next blind.

---

## Tier 4 — CSS

### R-15 `delete:` ~46 selector lines for classes nothing renders
741 CSS classes; 93 are never named in `src/`. Most are false positives —
`edition-*`, `cat-*`, `fx-*`, `chroma-*`, `phase-*`, `desk-slot-*`, and `mat-*`
are composed at runtime (`` `edition-${owned.edition}` ``) and **must be kept**.
After discounting those, a real dead set remains:

- `.overwrite-*` (4 selectors — the removed modal, see R-02)
- `.bag-widget`, `.bag-widget-wrap`, `.bag-popover`, `.bag-toggle`, `.bag-body`,
  `.bag-col`, `.bag-grid`, `.bag-totals` — a pouch widget that predates `BagView.tsx`
- `.langbar`, `.options-fab` — replaced by the Options overlay
- `.card-family-gallery`, `.card-family-slot`, `.card-family-placeholder-grid`,
  `.cc-pack-art` — superseded by `packGalleryPages()`
- `.chip-icon`, `.chip-wrap`, `.badge-stats`, `.bg-count`, `.bg-letter`,
  `.bw-count`, `.bw-stack`, `.pack-frame`, `.pack-size`, `.letterhand-tag`, `.pouch-actions`

- **Files:** [play.css](src/ui/styles/play.css) (16 selector lines), [screens.css](src/ui/styles/screens.css) (30)
- **Risk:** low but not zero — **verify each one visually**, not by grep. A class
  can be applied from a template literal the scan cannot see. Delete in small
  commits so a regression is easy to bisect.
- **Saves:** ~150 CSS lines including bodies
- **Verify:** `npx vite build`, then walk Play / Shop / Pack / Collection / Options / Blind Select / Game Over at both languages.

**✅ Done.** 205 CSS lines removed across `play.css` and `screens.css`. Guard used: a rule was only cut when EVERY class token in its selector was on the dead list, so composed classes (`edition-*`, `fx-*`, `cat-*`, `chroma-*`) could not be caught. `vite build` clean.

---

## Deliberately NOT on this list

- **Dependencies.** `react`, `react-dom`, and four `@fontsource` packages. Nothing
  to strip; no hand-rolled stdlib worth replacing beyond R-06.
- **`BALANCE` as one big object.** It is the "no magic numbers" rule (`CLAUDE.md`
  principle 3) working as intended. Splitting it would scatter the thing whose
  whole value is being in one place.
- **The four mascot voice sets in `locales/`.** Four skins × N lines looks like
  duplication and is data. `voicedKeys()` already handles the fallback chain.
- **One-joker-per-file under `src/engine/jokers/`.** 32 small files is the
  documented convention and makes each tile independently reviewable.
- **`src/sim/` scripts.** Nine standalone entry points with no shared surface;
  they are meant to be read top-to-bottom.

---

## Remaining

Four items are still open. Two need a decision before they can start.

| Item | Why it is still open |
|---|---|
| **R-09** shared test fixtures | Deliberately deferred. It is opportunistic by design (convert a file when you touch it), and rewriting 14 test files while the Common-tile roster is mid-expansion would collide. |
| **R-11** unify the consumable families | The big one, ~200 lines. Medium-high risk; touches the pack flow, the shelf, the shop, and save-visible `run.consumables`. Ship it as two commits — predicates first, `use` bodies second. |
| **R-13b** rename the `punctuation` / `PackType` literals | **Needs your call.** `CLAUDE.md` rules that display terms never rename engine identifiers, and `PackType` reaches `wj.run` through `ShopState.packs`, so this is a spec question rather than a cleanup. R-13a (the pool constants) is done. |
| **R-14** split `useGame.ts` | Wants R-11 first; that is what exposes the seams. R-10 only took it from 1,449 to 1,441 lines, which is not the point — the point is that the pack paths now share their bookkeeping instead of repeating it. |

### Groundwork R-11 can build on

`src/engine/consumables.ts` (added by R-01) already unions the three families and
answers "can the engine resolve this id". That is the natural home for the
`ConsumableFamilyDef` registry, which turns R-11 into "add `targetsTiles` /
`pickCount` / `canUse` / `use` to a module that already knows every id" rather
than a new abstraction.

### Measured result of this pass

| | Before | After |
|---|---:|---:|
| `ConsumableId` members | 59 | 43 |
| locale keys | 720 | 697 |
| CSS lines (`play` + `screens`) | 7,637 | 7,447 |
| `*CardArt` component files | 4 | 2 |
| `clamp` definitions | 5 | 1 |

Roughly **-450 lines** and **-23 locale rows**, no dependency change. Verified at
each step with `npx tsc --noEmit`, `npx vitest run`, and `npx vite build`.

> **Verification refresh (2026-07-31).** The roster expansion and the former
> import-order failure are resolved. The current verification result belongs in
> `docs/CODEBASE_AUDIT_VERIFICATION_2026-07-31.md`; this file remains a
> historical refactoring ledger, not a live test dashboard.
