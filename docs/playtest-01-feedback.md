# Playtest 01 — Feedback & Work Order

Drop this file into `docs/` and work through it top-down. Priorities: **P0 blocks further playtesting**, P1 is core UX, P2 is features, then deferred design notes. Each item has acceptance criteria. Apply the GDD sync section at the end so `docs/GDD.md` stays the source of truth.

---

## P0 — Data: the stub dictionary is poisoning playtests

Playtesters hit rejections on common words (pig, gem, gemini). This is the known dev stub (~2k words) from CLAUDE.md — but it invalidates difficulty feedback ("I lose my phase because nothing I spell counts"), so the real validity layer is now promoted to top priority.

### P0-1. Real validity dictionary (layer 1)
- Source an open word list (ENABLE or equivalent permissive list) and cut to roughly the **top 20k–30k words by frequency** (SUBTLEX-US or COCA frequency ranks; if unavailable offline, a reasonable proxy list is fine for now).
- **Inflected forms are IN** (decision confirmed): plurals, past tense, -ing, comparatives — Scrabble convention. ENABLE already contains inflections; do not lemmatize them away.
- Acceptance: `pig`, `pigs`, `gem`, `gems`, `ran`, `eating` all validate; dictionary loads as a `Set` at startup; size/memory logged.

### P0-2. Lexicon (suit/POS, layer 2) inherits by lemma
- Tag suit + POS at the **lemma** level; map inflections to their lemma (rule-based + small exceptions list is fine). Untagged words default to `standard` per GDD §3.2.
- Acceptance: `PIGS` resolves to the suit/POS of `pig`; `RAN` to `run`.

### P0-3. Verify gibberish is implemented and *visible* (GDD §6.4)
- Confirm the b-2 path works: any tile set is submittable; pays letter chips ×1.0; no suit; records a hole.
- **UX surfacing:** when the staged tiles are not a valid word, the staged preview must say so explicitly, e.g. `Not a word — submit as gibberish: +14 chips, breaks the sentence`. The "my phase is wasted" complaint should be impossible to have once the escape valve is visible.
- No free "no valid words exist in hand" detector — with 11 tiles + inflections this is near-impossible, and exchange/gibberish are the intended valves. (Hints are a paid resource, see P2-1.)

---

## P1 — Core UX

### P1-1. Hand sorting (3 modes)
Buttons like Balatro's Rank/Suit sort: **vowel/consonant · by chip value · alphabetical**. Persist last choice. Acceptance: sorting is stable and animates tiles to new positions.

### P1-2. Drag & drop reorder — with a hard scope boundary
- Draggable: **hand tiles** (organization) and **staged word tiles** (changes the spelling).
- **NOT draggable: the sentence tray.** Sequence order = submission order is a game rule (GDD §5.1); the tray is immutable history. Do not add reordering there.
- Acceptance: reordering staged tiles re-validates the word and updates the preview live.

### P1-3. Settle juice
Implement the word-settle sequence per `docs/UI_DESIGN.md` §4, priority order as written (settle sequence → projected update → idle wobble → hover/select). Respect `prefers-reduced-motion`.

### P1-4. Korean UI localization
- Externalize **all UI strings** to `locales/en.json` + `locales/ko.json` now (before hardcoding spreads). Game words/tiles stay English — the puzzle is English by design.
- Acceptance: language toggle in settings; no user-visible hardcoded strings remain in components.

---

## P2 — Features

### P2-1. Hints as an economy resource (decision confirmed)
No always-on highlighting, no free hint button. Hints enter through the existing consumable economy:
- New Stationery consumable — **Magnifier (돋보기) 🔍**: on use, highlights up to 3 valid words spellable from the current hand (prefer highest-scoring). Appears in shop item slots and Stationery Packs like any stationery item.
- Implementation: per-hand solver = letter-count multiset subset check over the curated dictionary (20–30k words is trivial to scan per use; no need for a DAWG yet).
- Acceptance: using it consumes the item, highlights up to 3 words, works with duplicate letters.

### P2-2. Word collection (도감) — data now, UI later
- Track first-time-played words per player in `localStorage` (word + timestamp). Gibberish does not count.
- Collection screen is a later milestone; only the tracking hook ships now.
- Acceptance: replaying a run accumulates flags across sessions.

### P2-3. Tile visual language (decisions confirmed)
- **Score tiers via letter ink color** (NOT font size — size/weight is semantically owned by the font-edition layer). Suggested tiers on ivory ceramic, keep subtle and readable:
  - 1 pt: `#2B2620` (default ink) · 2–3 pt: `#54432F` · 4–5 pt: `#6E3A2A` · 8–10 pt: `#8A6420` (gilded)
- **Vowel/consonant face tint** (ceramic base tiles only; material variants like glass/stone keep their own faces):
  - vowels: light beige `#F7F0E1` · consonants: darker beige `#EBE0C9`
- Update `docs/mockups/play-screen.html` tokens to match — the mockup remains the visual contract.

---

## Deferred — design decisions recorded, do not implement yet

- **Grammar-strictness stakes** (playtest idea #6): adopted in spirit, reframed. True grammar checking (aux inversion, agreement — "Do you want…" vs "You wanna…") is out of scope by design (GDD §4.1 level 3). Instead, future stake levels will modulate **matcher leniency knobs that already exist**: modifier absorption on/off, hole forgiveness, unison strictness. To be designed with the stakes system (GDD §12 open item).
- **Word-length base scoring** (idea #8): not adopted. Length already scales chips (letter sum) and suit already provides the multiplier "character"; an explicit length-tier base would double-reward length and collide with joker #6 Long-Word Fan. Revisit only if long words feel unrewarding after P0 lands.
- **Font-size score scaling** (design idea #1): rejected — conflicts with the font-edition visual axis. Resolved via ink tiers (P2-3).

---

## GDD sync (apply to `docs/GDD.md`)

1. §3.2: add "inflected forms included; suit/POS tagged at lemma and inherited by inflections."
2. §10.1: add **Magnifier** to the Stationery table (9th item): "highlights up to 3 valid words spellable from the current hand."
3. §12 open items: add "stakes = matcher-leniency knobs (reframed from grammar strictness)" and "word collection UI."
4. §6.4: add the UX note that gibberish submission must be explicitly surfaced in the staged preview.
