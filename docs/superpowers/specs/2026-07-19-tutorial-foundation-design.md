# Tutorial foundation (A-2 encounter popups + A-3 Help) — design

Date: 2026-07-19. Approved in-session ("all good"). Work order: `docs/feature-01-tutorial-sound-fontseals.md` §A.

First slice of Work Order A (the largest). User chose **decompose, foundation first**:
this slice builds the shared foundation + Layer-2 encounter popups (A-2) + Layer-3
Help glossary (A-3). **A-1 (guided first-run intro / spotlight coach-marks) is a
LATER slice, out of scope here.**

## Goal

The first time the player meets a game element, a one-time explainer card appears
(dismissable, suppressible via a "don't show tips" toggle). Everything those cards
teach is also re-readable on an **Options → Help** glossary, greyed until encountered.
Copy is authored once in i18n and shared by both.

## Design

### 1. Seen-flags store — `src/ui/tutorial.ts`
Mirrors `src/ui/collection.ts`: `wj.tutorial` localStorage = `Record<encounterId, epochMs>`.
Pure/headless UI util (no React): `hasSeen(id)`, `markSeen(id)`, `loadTutorial()`,
`resetTutorial()`, `seenCount()`.

### 2. Encounter registry — `src/ui/tutorial.ts`
Data table `ENCOUNTERS: { id: EncounterId; group: EncounterGroup; icon?: string }[]`.
`EncounterId` union covers the A-2 non-boss list (13, extend as systems ship):
`firstJoker`, `firstMaterial`, `firstFont`, `firstLetterHand`, `firstPattern`,
`firstUnison`, `firstGibberish`, `shopFirstVisit`, `firstConsumable`, `firstVoucher`,
`firstPack`, `pouchHover`, `magnifier`. **Per-boss encounters are deferred to a later
slice** (bosses already carry `bossdesc.*` copy the future per-boss popup can reuse),
to keep this slice's copy volume bounded. Copy lives in i18n as
`tutorial.<id>.title` / `tutorial.<id>.body` (ko/en) — **the Help screen reuses the
exact same keys** (single copy source). Body copy uses the richtext markup
(`[c:]`/`[m:]`/`[b:]`) already in the tooltips.

### 3. Trigger transport — `tutorialBus` (module singleton in `src/ui/tutorial.ts`)
A tiny emitter: `fire(id)` and `subscribe(fn)`. Any trigger site (in `useGame`,
components) calls `tutorialBus.fire(id)` on the relevant state change — decoupled
exactly like the `audio` singleton, so triggers don't thread a callback through props.

### 4. Popup host + component — `src/ui/components/TutorialPopup.tsx`
One `<TutorialHost/>` mounted once (in `App.tsx`) subscribes to the bus. On `fire(id)`:
if `tips` setting is on AND `!hasSeen(id)`, it shows a small card (title + body +
"got it"), calls `markSeen(id)` on dismiss. Reuses the mascot grammar (`.mascot-bubble`
styling family); Piyak portrait optional. If tips-off or already-seen, `fire` is a no-op.

### 5. Trigger wiring — LOW-RISK SET FIRST (approved scope)
This slice wires only 4 proven-simple triggers, registering the rest in the registry
for the Help screen and later wiring:
- `firstGibberish` — in `useGame.playWord` success when `submission.isGibberish`.
- `shopFirstVisit` — in `RunView` phase→'shop' effect (alongside the catMeow beat).
- `firstPack` — in `useGame.buyPack` success.
- `firstVoucher` — in `useGame.buyVoucherAction` success.
The remaining encounters (per-boss, firstLetterHand, firstPattern, firstUnison,
firstJoker, firstMaterial, firstFont, firstConsumable, pouchHover, magnifier) are
registered (so Help lists them, greyed) and wired in a later slice — matching the work
order's "extend as systems ship".

### 6. Help glossary — Options → Help (A-3)
New `View: 'help'` in `Options.tsx` + a **Help** button on the Options root (screens-spec
§2.10 already specs it). Renders the registry grouped by `EncounterGroup`; each entry
shows its `tutorial.<id>.title`/`.body`; `!hasSeen(id)` renders greyed (undiscovered).
Same copy keys as the popups.

### 7. "Don't show tips" toggle (A-2 kill switch)
`settings.ts` gains `tips: boolean` (default `true`); a Toggle in the Settings **Game**
tab (screens-spec §2.11 already specs it). When off, `TutorialHost` suppresses the whole
Layer-2 popup layer (Help stays available).

## Out of scope (later slices)
- A-1 guided first-run intro (spotlight coach-marks, 6 steps).
- Wiring the remaining ~10 encounter triggers.
- Per-boss encounter copy beyond registry stubs.

## Incidental cleanup
The Settings audio tab still renders `settings.audioStub` ("stub mixer") copy, now false
after Work Order B shipped. Update that one string in the same pass.

## Testing
- `tutorial.ts` seen-flags + registry: unit tests (hasSeen/markSeen roundtrip via a
  localStorage mock; registry ids all have both-locale copy — a sync test like the
  materials/fonts registry guard).
- Popup host / Help / triggers: in-app Playwright smoke (fresh profile → trigger fires
  once, second time silent; tips-off suppresses; Help lists entries, greyed vs seen).
