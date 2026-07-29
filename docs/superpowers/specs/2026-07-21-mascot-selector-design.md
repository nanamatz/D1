# WooDak mascot selector — design (2026-07-21)

> **Superseded 2026-07-29:** selection moved from Options/Settings to
> **Collection → Mascots**. Persistence and resolver architecture below remain valid.

## Goal

Let players re-skin the **WooDak (우땅)** ally mascot with an unlocked character. First
skin shipping: **누렁이 (DOG)**, using `docs/Arts/T_Dog.png`. Selection now lives in
Collection → Mascots. Piyak (shop proprietor) is unchanged.

Follows the chromatic-unlock system (GDD §13): the mascot skins are the existing
`{ kind: 'mascot', variant }` unlock rows (ALIEN/GHOST/DOG/CAT), which were
"data slots, art later." DOG now has art and a real effect.

## Decisions (from brainstorming)

- **Target mascot = WooDak only.** The skin replaces WooDak across all three of his
  surfaces: run-end companion (`WooDakMascot`), tutorial coach-marks (`SpotlightBubble`),
  tutorial popups (`TutorialPopup`). Piyak stays the fixed shop cat.
- **Selector lists Default + unlocked skins that have art.** Today: WooDak(default) +
  누렁이(Dog) + 유령(Ghost) + 외계인(Alien). CAT appears automatically once art is added. No
  locked placeholder entries.

## Architecture

### 1. `src/ui/mascots.ts` (new) — skin registry + resolver

- `type WooDakSkin = 'woodak' | 'alien' | 'ghost' | 'dog' | 'cat'` (default `'woodak'`).
- `WOODAK_SKINS: { id: WooDakSkin; unlockId: string | null; nameKey: string; art: string | null }[]`
  - `woodak`: `unlockId: null` (always available), `art: woodak.png`.
  - `dog`: `unlockId: 'DOG'`, `art: dog.png`.
  - `ghost`: `unlockId: 'GHOST'`, `art: ghost.png`.
  - `alien`: `unlockId: 'ALIEN'`, `art: alien.png`.
  - `cat`: `art: null` (not selectable yet).
- `availableWooDakSkins(active: Set<string>): WooDakSkin[]` — default plus every skin
  with `art != null` AND (`unlockId == null` OR `active.has(unlockId)`).
- `mascotSrc(role: 'piyak' | 'woodak'): string` — **the single resolver used at every
  render site.** `'piyak'` → `piyak.png`. `'woodak'` → the selected skin's art when it is
  unlocked and has art, else fall back to `woodak.png` (safe against a reset unlock or a
  removed asset). Reads the live selection + unlock state from storage (see §2), so it
  does not depend on the caller being inside the settings React tree.

Data-driven: adding a future skin = fill in its `art` field. No hard-coded word checks in
components (CLAUDE.md guardrail).

### 2. Setting

- Add `mascot: WooDakSkin` to `Settings` (`settings.ts`), default `'woodak'`, persisted in
  `wj.settings`.
- Add `readMascot(): WooDakSkin` (mirrors the existing `readTips()`) so `mascotSrc()` reads
  the current value straight from localStorage — the tutorial host is long-lived and
  `usePersistedState` does not cross-sync instances.
- Availability reuses `activeUnlocks(settings.unlockAll)` (from `unlocks.ts`), so the
  "reveal all presentation" override (C-4) also makes art skins selectable — consistent
  with how it reveals colours/audio.

### 3. Collection UI — Mascot equip cards

- The Collection Mascots page renders every registry row. Locked skins remain
  non-selectable silhouettes; unlocked art cards select `settings.mascot`.
- The equipped card is highlighted with a gold outline and Selected label.
- `activeUnlocks(settings.unlockAll)` grants selection access under the override
  without changing real discovery progress.

### 4. Wiring

- `WooDakMascot.tsx`: `src={mascotSrc('woodak')}`.
- `SpotlightBubble.tsx` and `TutorialPopup.tsx`: replace the duplicated
  `MASCOT_SRC` maps with `mascotSrc(mascot)`.
- The dog fills the same `.woodak-img` art slot; verify framing on screen and adjust CSS
  only if the aspect ratio needs it.

### 5. Assets · i18n · docs

- Copy `docs/Arts/T_Dog.png` → `src/ui/assets/dog.png`.
- i18n (en + ko): `collection.mascot.*`, `mascot.woodak`, `mascot.dog` (+ `mascot.alien` /
  `mascot.ghost` / `mascot.cat` for the future rows).
- Update GDD §13 mascot row ("data slots now, art later" → DOG art shipped + Collection
  selector) and the CLAUDE.md mascot note, in the same pass (principle 6).

## Out of scope (YAGNI)

- No cat art.
- No Piyak reskinning; no global "all mascots" setting.
- No in-shop live preview of the selection.

## Testing

- Headless `mascots.ts` resolver unit: default fallback, dog selected-but-not-unlocked →
  fallback, dog selected + unlocked → dog art, unlockAll → dog available.
- Visual: play DOG → select 누렁이 in Collection → Mascots → WooDak surfaces
  (run-end, tutorial) show the dog.
