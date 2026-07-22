# Feel & Polish Pass 2 — Design (2026-07-22)

A batch of 7 presentation-only feel items from a Korean playtest review. One spec;
each item is self-contained and UI-layer. **The headless engine is untouched** — no
change under `src/engine/`. All work lives in `src/ui/` (audio facade, board
animations, a new parallax hook) and `locales/` (copy).

Source review (Korean), summarized and scoped during brainstorming:

- **A1** 배경 음악 에셋 교체 — 상점 음악과 비슷한 라운지 느낌.
- **A2** 구매/판매 SFX 교체 — 짤랑거리는 (coin jingle).
- **A3** 타일 선택 시 SFX — 탁! 탁자에 두는 타격음.
- **A4** 타일 드로우 연출 — 주머니에서 하나씩 날아오는.
- **A5** 타일 드로우 효과음 — 타일마다 한 번씩.
- **A6** 마우스 좌표 기반 호버 애니메이션 — 타일/조커/소모품 (Balatro UX).
- **B2** 유니즌 설명을 더 알기 쉽게.

Decisions taken during brainstorming:

- **Audio stays synth-only.** No asset files — every change is a recipe/track edit in
  `src/ui/audio.ts` (facade philosophy: swappable for real audio later, see
  `assets/AUDIO_LICENSES.md`). "에셋 교체" = retune the synth recipes.
- **A1 = retune `play` + `menu`** MUSIC tracks to a lounge feel matching the existing
  `shop` track; **`boss` stays tense** (unchanged).
- **A4/A5 = the draw-ENTER half only.** FLIP reorder/shift and the discard fly-out
  already exist (`src/ui/hooks.ts` `useFlip`, `StagePanel` discard ghosts). Freshly
  drawn tiles are what's missing — they currently just appear.
- **Dropped from the original list:** 조커 슬롯 늘리기 was actually about 조커 *타일*
  개수 → **deferred to later** (not this spec); 게임 종료 버튼 → **already sufficient**
  (⚙ Options → Main Menu); 상점/블라인드 옵션 메뉴 → **already exists** (the options-FAB
  in `RunView.tsx:221`). None of these three are in scope.
- **Reduced motion** honored throughout: A4 collapses to instant (no flight), A6
  collapses to flat (no tilt).
- **Silent-start unchanged (GDD §13 / feature-02 C-6):** audio buses stay gated until
  SOUND/MUSIC are played. These recipe/track edits only surface once unlocked.

---

## A1 · Lounge BGM for `play` + `menu`

**Change:** rewrite the voice `steps` (and `bpm` where it helps) of the `play` and
`menu` entries in `MUSIC` (`src/ui/audio.ts`) so they read as relaxed lounge, in the
family of the existing `shop` track (triangle lead, gentle 7th-ish motion, softer
bass). `play` may stay a touch more energetic than `shop` (it's the board), but the
palette and mood match. **`boss` and `shop` are untouched.**

**Constraints:**
- Keep each track a loop-safe 16-step (one-bar) grid, same `TrackDef` shape — no
  sequencer changes.
- Keep voice `gain` values in the current low range (BGM sits under SFX; `MUSIC_HEADROOM`
  unchanged).
- `MUSIC_TRACKS` / `MusicTrack` union unchanged (still `menu|play|shop|boss`).

**Files:** `src/ui/audio.ts` (the `MUSIC` table only).

## A2 · Coin-jingle buy/sell SFX (+ recipe `delay` extension)

**Problem:** a coin "짤랑" is a quick *arpeggio* of bright notes, but today every tone in
a `Recipe.tones[]` starts at the same instant (`now`) and rings for the whole `dur`, so
recipes can only make chords, never sequences.

**Facade extension (small, reusable):** add an optional `delay?: number` (seconds from
the recipe start) to the tone layer type `{ wave; from; to?; delay? }`. In `play()`,
each tone's oscillator starts at `now + (t.delay ?? 0)` and stops at
`now + r.dur` (envelope unchanged). Backward-compatible: existing recipes omit `delay`
→ behaves exactly as today. The rising count-up `bend` still applies.

**Recipes retuned:** `purchase` and `sell` become short, bright triangle/square
arpeggios (2–3 ascending notes for `purchase`, a lighter 2-note figure for `sell`) with
a high-cutoff `noise` shimmer for the metallic "jingle." Gains stay in the current SFX
range.

**Files:** `src/ui/audio.ts` (`Recipe` tone type, `play()` start-time, `purchase`/`sell`
recipes). `tests/audio-facade.test.ts` if it asserts the tone shape.

## A3 · "Tak" tile-select SFX

**Change:** retune the `tileSelect` recipe (`src/ui/audio.ts`) from a thin square blip
into a short, dry table-slap: a fast low-pitched square/triangle thock (~140→90 Hz) plus
a brief high-cutoff `noise` click, short `dur` (~0.06s). Model on the existing
`submitThock`/`stamp` recipes (which already combine a low tone + noise) but lighter and
quicker — it fires on every tile selection, so it must stay unobtrusive.

**Files:** `src/ui/audio.ts` (`tileSelect` recipe).

## A4 · Draw-enter animation — fly from the pouch, staggered

**Goal:** tiles drawn into the hand slide in one-by-one from the pouch anchor, instead
of appearing instantly. Reorder/shift and discard fly-out already animate (keep them).

**Approach — extend the existing FLIP layer** (`src/ui/hooks.ts` `useFlip`), don't add a
parallel animator:

- `useFlip` already snapshots each keyed child's container-relative position per layout.
  A child present in `next` but **absent from the previous snapshot** is a freshly drawn
  tile (an *enter*). Today it's skipped; now it gets an enter animation.
- **Origin:** the pouch widget's on-screen rect. `useFlip` gains an optional origin
  accessor (e.g. a `getEnterOrigin?: () => {x,y} | null` param, or a documented data
  attribute on the pouch node) resolved to container-relative coords. **Fallback** when
  the pouch is closed / not mounted: a point just below the hand row (offset origin +
  fade), so the enter never no-ops.
- **Play:** invert = translate from (origin − slot) with a slight fade/scale, then
  animate to `none`. **Stagger** each entering tile by `index * ~60ms` (left-to-right)
  so they arrive in sequence, matching A5's per-tile sound.
- **Reduced motion:** no enter transition (instant), consistent with the rest of the
  board.

**Design note (isolation):** the enter logic is added inside `useFlip`'s existing
layout effect so the measure/invert pass is shared; the hook keeps one job (animate hand
layout changes: reorder, shift, enter) behind one interface (`ref` + `key` + optional
origin). Callers pass the origin; the hook owns the animation.

**Files:** `src/ui/hooks.ts` (`useFlip` enter branch + origin param),
`src/ui/components/StagePanel.tsx` (wire the pouch origin + fire A5 per enter),
`src/ui/styles/play.css` (any enter keyframe/fade if not done via `element.animate`).

## A5 · Per-tile draw SFX

**Change:** add a new `SfxName` `'tileDeal'` — a soft, short "fwip/place" (light triangle
blip + faint noise; distinct from `tilePlace`/`tileSelect`). It fires **once per drawn
tile**, on the **same staggered timer as A4** (`delay = index * ~60ms`), from the enter
path in `StagePanel`. One draw of N tiles → N staggered `tileDeal` plays.

**Files:** `src/ui/audio.ts` (add `tileDeal` to `SfxName` + `RECIPES`),
`src/ui/components/StagePanel.tsx` (fire it per enter),
`tests/audio-facade.test.ts` (the `SFX_NAMES`/recipe-coverage assertion picks up the new
name automatically; update only if it hard-codes the count).

## A6 · Mouse-parallax hover (Balatro UX)

**Goal:** hovering a card tilts it in 3D toward the cursor, with a slight lift/scale,
then eases back flat on leave — on hand tiles, joker cards, and consumable cards.

**Approach — one reusable hook `usePointerTilt`** (new, in `src/ui/hooks.ts` or a small
`src/ui/useTilt.ts`):

- Attach to a card element via `ref`. On `pointermove`, compute the cursor's normalized
  position within the element rect: `nx = (px - cx)/(w/2)`, `ny = (py - cy)/(h/2)`, each
  clamped to −1…1. Write CSS custom properties on the element: `--tilt-x` (from `ny`),
  `--tilt-y` (from `nx`), and optional `--glow-x/--glow-y` (px %) for a subtle sheen.
- The **CSS** (not JS) applies the transform:
  `transform: perspective(600px) rotateX(calc(var(--tilt-x) * <maxDeg>)) rotateY(calc(var(--tilt-y) * <maxDeg>)) scale(1.04)`
  with a short transition so `pointerleave` (which resets the vars to 0) eases back flat.
  `<maxDeg>` a small tunable (~8–10°).
- **Throttle** writes with `requestAnimationFrame` (one pending frame; coalesce moves).
- **Reduced motion:** the hook no-ops (vars never set) → cards stay flat.
- Applied to `Tile` (hand), joker cards (`JokerShelf`), consumable cards
  (`JokerShelf`). Same hook → shop cards can adopt it later with one line (noted, not
  done here).

**Alternative rejected:** a single container-level `pointermove` that figures out which
card the cursor is over — more code to hit-test, no benefit at ~12 cards, and tilt is
naturally per-card-relative.

**Design note (isolation):** `usePointerTilt` has one job (map cursor→tilt vars for one
element), a clear interface (`ref` in, CSS vars out), and no dependency on game state —
testable/reasoned-about in isolation, reusable across every card surface.

**Files:** `src/ui/useTilt.ts` (or `hooks.ts`), `src/ui/components/Tile.tsx`,
`src/ui/components/JokerShelf.tsx`, `src/ui/styles/play.css` (transform + transition
rules; a shine layer if included).

## B2 · Clearer Unison explanation

**Problem:** the current copy leans on poker knowledge and an odd term.

- `tutorial.firstUnison.body` (en): *"When every word in the sentence shares one suit (2
  or more words), Unison adds a bonus — our take on a flush."*
- (ko): *"문장의 모든 단어가 같은 접미를 공유하면(2개 이상) 유니즌 보너스가 붙습니다 — 플러시에
  해당하는 규칙입니다."* — "접미" is confusing and "플러시" assumes poker.

**Change:** reword both locales so Unison reads without poker/jargon: state plainly that
when **all** words in the sentence share the **same suit** (and there are at least 2
words), you get a bonus, and briefly *why it matters* (bigger multiplier). Drop the
"flush" reference (or keep it only as a parenthetical aside, not the explanation). Keep
it short (tutorial-card length). Mirror the clarity in the tray/sidebar Unison strings
(`tray.unison*`, `sidebar.unisonOnly`) only if a gloss/tooltip is warranted — otherwise
leave those labels as-is (they're compact labels, not explanations).

**Files:** `locales/en.json`, `locales/ko.json` (`tutorial.firstUnison.body`; optionally
a short tooltip key if we add one).

---

## Testing

- **A2/A5:** `tests/audio-facade.test.ts` — the new `tileDeal` name is covered by the
  existing `SFX_NAMES`/recipe map; add/adjust an assertion for the optional tone `delay`
  field (that a delayed tone starts after `now`, and that omitting `delay` is unchanged).
  `effectiveGain` math is unaffected.
- **A1, A3, A4, A6, B2:** presentation — verify via the `verify` skill (run the game,
  drive the change): lounge tracks audibly relaxed; tile-select is a dry "tak"; drawn
  tiles fly in from the pouch staggered with a per-tile sound; hovering tiles/jokers/
  consumables tilts toward the cursor and eases back; Unison card reads clearly. Confirm
  reduced-motion collapses A4 (instant) and A6 (flat).
- No engine tests change (engine untouched).

## Out of scope

- No new audio **asset files** (synth-only, per the decision above).
- **B1** joker-*tile* count — deferred to a later spec.
- **B3** quit button, **B4** shop/blind options menu — already satisfied; no work.
- Shop-card parallax — the hook is built reusable, but wiring shop cards is left for
  later (YAGNI here).
- No holographic/foil edition shine beyond the optional subtle sheen in A6.
