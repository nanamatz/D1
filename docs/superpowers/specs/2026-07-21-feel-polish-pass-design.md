# Feel & Polish Pass — Design (2026-07-21)

A batch of 9 small, mostly-independent presentation / feel / balance changes from a
playtest review. One spec; each item is self-contained. Items cite the systems they
touch. The engine stays headless throughout (all UI-layer except items 1 & 3, which
are `balance.ts` numbers).

Source review (Korean), summarized:

- 기획 (design): 1 raise tile base chips · 2 visible sentence-bonus trigger animation ·
  3 +1 phase, +1 discard · 4 tile draw/discard slide animation · 5 add ghost + alien
  mascots (5.1 show locked mascots as silhouettes in the 도감).
- 피드백 (feedback): F1 audio not playing · F2 scanline hurts text readability.

Decisions taken during brainstorming:

- **F1 is NOT a design change.** Silent-start is intended (GDD §13 / feature-02 C-6).
  We keep the unlock mechanic and only make it *discoverable*.
- Tile chips scale **×N keeping Scrabble ratios** (not flat-add, not common-only).
- MONSTER → ALIEN is a **full rename** (trigger word + skin id + variant), all UI-layer.
- Locked mascots get a **dedicated 도감 category** with silhouettes.

---

## 1 · Tile base chips ×3 (keep ratios)

**Change:** multiply every value in `BALANCE.letterChips` (`src/engine/balance.ts`) by
a single factor **F = 3** (A 1→3, E 1→3, D 2→6, Q 10→30, Z 10→30). Ratios preserved.

**Difficulty guard:** tripling per-tile chips without touching `anteBaseTargets` lowers
effective blind difficulty. After the change, run the headless simulator (`src/sim`) to
measure clear rates / gibberish-forced rate. **If antes trivialize, scale
`anteBaseTargets` to compensate** (pure "bigger numbers", relative difficulty held). If
the sim shows difficulty is still acceptable, leave targets as-is. Record the sim
outcome and whichever choice was made in the balance comment.

**Docs:** update the GDD §2.1 note if it quotes the raw Scrabble values as final; add a
one-line "chips scaled ×3 (feel pass 2026-07-21)" note next to `letterChips`.

**Files:** `src/engine/balance.ts`; sim scenario under `src/sim/`; GDD §2.1.

## 2 · Sentence-bonus trigger animation

**Goal (item 2.1):** at blind end the finalized sentence bonus is *seen* pushing the
score up — the scorebox's chips and mult climb by the bonus's chips and mult, then the
product rolls into the round total. Today the bonus finalizes and the round number
count-ups, but the chips×mult breakdown is never shown as a beat.

**Approach:** reuse the existing settle machinery (`src/ui/settle.tsx`,
`SettleProvider` + `useSettleView`) rather than a parallel animator.

- The sentence bonus breakdown is `(patternChips + 15·mods + unisonChips) ×
  (patternMult × unisonMult)` (feature-02 A, GDD §5.2). Emit it as a small ordered
  `ScoreEvent[]`-shaped timeline (or a dedicated `sentence` settle mode) so the scorebox
  fills **chips → bonusChips**, then **mult → bonusMult**, then holds the product.
- On completion the **product** rolls into the committed round total via the existing
  `useCountUp` (the same tween the round number already uses) — never per-beat stepping,
  never decreasing (playtest-04 A invariant preserved).
- A pattern/unison stamp lands during the beat (reuse `SettleView.stamp`).
- Reduced motion: collapse to the instant-fill path already in `settle.tsx`; the round
  total still eases to the finalized value.
- **Invariant kept (playtest-05 A):** the blind resolution / verdict stays gated on the
  settle-complete SIGNAL, never on the raw score. This new beat is part of the settle
  timeline, so `settleDurationMs` must account for it (extend the beat count) — the
  verdict beat still fires *after* the signal, not on a guessed delay.

**Open implementation detail (resolve in the plan):** confirm whether the engine's
finalize already exposes the bonus's chip/mult components or whether the UI recomputes
them from `SentenceJudgment` + `BALANCE.patterns`/`unison`. Prefer reading engine-emitted
values if present; otherwise mirror the balance formula in one helper (single source).

**Files:** `src/ui/settle.tsx`, `src/ui/useGame.ts` (finalize hook), the scorebox in
`src/ui/components/Sidebar.tsx`, `src/ui/components/SentenceTray.tsx` (stamp reuse).

## 3 · +1 phase, +1 discard

**Change:** `BALANCE.basePhases` 4 → **5**; `BALANCE.discardsPerBlind` 3 → **4**
(`src/engine/balance.ts`).

**Docs (principle 6 — fix every cross-ref):** GDD §6.2 (phases) and §6.3 (discards),
plus any "4 phases" / "3 discards" mentions anywhere in `docs/`. Grep both numbers.

**Files:** `src/engine/balance.ts`; GDD §6.2/§6.3 + cross-refs.

## 4 · Tile draw / discard slide animation ("촤라락")

**Goal:** tiles glide instead of snapping — drawn tiles slide in from the pouch/deck
anchor, discarded tiles fly out toward the discard, and hand reorders animate.

**Approach:** FLIP (First-Last-Invert-Play) on the hand row, built on the existing
`src/ui/useAnim.ts` helper.

- Keyed hand tiles: on layout change, measure First/Last positions, invert with a
  transform, play the transition to zero. Reorders and shifts (after a play/discard)
  glide for free.
- **Draw (enter):** new tiles start at the pouch/deck anchor position (or a translated
  offset + faded) and slide/fade into their slot.
- **Discard (exit):** marked tiles translate toward the discard pile and fade before
  unmount; pair with the existing `audio.play('discardSwoosh')` (already wired — no new
  sfx). Multiple tiles discarded in one call animate together (discard is a whole-batch
  op, GDD §6.3).
- **Reduced motion:** no transition (instant), consistent with the rest of the board.

**Files:** `src/ui/components/StagePanel.tsx` (hand row), `src/ui/components/Tile.tsx`,
`src/ui/useAnim.ts`, `src/ui/styles/play.css`.

## 5 · Ghost + Alien mascots (MONSTER → ALIEN full rename)

**Assets:** copy `docs/Arts/T_Ghost.png` → `src/ui/assets/ghost.png` and
`docs/Arts/T_Alien.png` → `src/ui/assets/alien.png` (same convention as `dog.png`).

**Rename (all UI-layer — the engine never knew about mascot variants):**

- `src/ui/unlocks.ts`: the `MONSTER` row becomes `{ id:'ALIEN', word:'ALIEN',
  effect:{ kind:'mascot', variant:'alien' } }`. `UnlockEffect` mascot variant union
  `'monster'|'ghost'|'dog'|'cat'` → `'alien'|'ghost'|'dog'|'cat'`.
- `src/ui/mascots.ts`: `WooDakSkin` union `'monster'` → `'alien'`; import `ghostUrl`,
  `alienUrl`; fill `WOODAK_SKINS` so `ghost.art = ghostUrl`, `alien` row (id/unlockId
  `'ALIEN'`) `art = alienUrl`. Dog already has art. Cat stays `art: null`.
- i18n (`locales/en.json`, `locales/ko.json`): `mascot.monster` → `mascot.alien`
  (display "Alien" / "외계인"); ensure `mascot.ghost` exists. Any unlock-word copy that
  references MONSTER updates to ALIEN.

**Consequence:** playing the word **ALIEN** (not MONSTER) unlocks the alien skin.

**Docs (land with code):** the MONSTER/GHOST/DOG/CAT lists in **CLAUDE.md** (the
chromatic-unlock + mascot-skin guardrail bullets), **GDD §13**, and
`docs/superpowers/specs/2026-07-21-mascot-selector-design.md` update to ALIEN.

**Files:** `src/ui/assets/*` (new pngs), `src/ui/unlocks.ts`, `src/ui/mascots.ts`,
`locales/en.json`, `locales/ko.json`; CLAUDE.md, GDD §13, mascot-selector spec.
Existing tests `tests/mascot-skins.test.ts` update for the renamed id.

## 5.1 · New "Mascots" 도감 category

**Change:** add a `mascots` category to `src/ui/components/Collection.tsx`.

- A grid of `WOODAK_SKINS`. State per skin:
  - **Unlocked + art** (default woodak always; alien/ghost/dog once played, or with the
    `unlockAll` override) → full portrait + name.
  - **Locked, art exists** → **silhouette** (`filter: brightness(0)` on the img) + a
    "???" masked name, so the shape teases without revealing.
  - **No art yet** (cat) → generic locked placeholder card (no silhouette possible).
- "Unlocked" reuses `loadPlayed()` / `activeUnlocks(unlockAll)` (do NOT count the
  override as *discovered* for any collection record — display only, matching the
  Palette view's rule).
- Category count: `have` = usable (art + unlocked) skins, `total` = `WOODAK_SKINS.length`.
- Add `collection.cat.mascots` i18n + the category to the `CATS` array and `counts` map.

**Files:** `src/ui/components/Collection.tsx`, `src/ui/mascots.ts` (may export a helper
for lock/silhouette state), `src/ui/styles/screens.css` (silhouette style),
`locales/*.json`.

## F1 · Audio discoverability (keep silent-start)

**No mechanic change.** Surface the unlock:

- In the Options audio section (`src/ui/components/Options.tsx`), when a bus is locked
  (`audio.isBusEnabled('sfx')` / `'music'` false, i.e. `SOUND`/`MUSIC` not played and no
  override), show a hint note: *"Spell SOUND / MUSIC in a run to turn on audio"* and
  render the corresponding slider as muted/greyed.
- i18n keys in both locales (`settings.audioLockedHint` or similar).

**Files:** `src/ui/components/Options.tsx`, `locales/en.json`, `locales/ko.json`.
Optionally reads live lock state via `audio.isBusEnabled` (already exists).

## F2 · Scanline readability

**Change:** lighten `crt-scan` in `src/ui/styles/tokens.css` from
`rgba(0,0,0,0.24)` to `~rgba(0,0,0,0.12)` and widen the dark band gap
(`0 2px … 2px 4px` → `0 1px … 1px 4px`, i.e. thinner dark line, more transparent gap) so
text stays legible; keep `mix-blend-mode: multiply`, the flicker, vignette, and bloom
untouched. Mirror the same numbers in `docs/mockups/play-screen.html` (the visual
contract) for doc consistency.

**Files:** `src/ui/styles/tokens.css`, `docs/mockups/play-screen.html`.

---

## Testing

- **Item 1:** a `src/sim` scenario measuring clear rate before/after the ×3 (and after
  any target rescale). Balance test asserts the scaled `letterChips` keep ratios.
- **Item 3:** existing engine tests still pass with 5 phases / 4 discards; update any
  fixture asserting `4`/`3`.
- **Item 5:** update `tests/mascot-skins.test.ts` for `alien`; assert `WOODAK_SKINS`
  ghost/alien now art-backed and selectable when unlocked.
- **Items 2, 4, 5.1, F1, F2:** presentation — verify via the `verify` skill (run the
  game, drive the change) rather than unit tests. Item 2 keeps the playtest-05 A
  settle-signal invariant (no fixed delay); confirm `settleDurationMs` covers the new
  beat.

## Out of scope

- No new audio assets or a "reduce CRT intensity" settings toggle (YAGNI — F2 is a
  one-line lighten).
- No re-theming of the round box beyond the item-2 fill animation.
- Cat mascot art (still `art: null`).
