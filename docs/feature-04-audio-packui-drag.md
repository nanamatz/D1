# Feature Work Order 04 — Audio Coverage · Pack Opening · Drag Physics · Tooltip Coverage

Playtest batch, 2026-07-27. **Docs already updated** (screens-spec §0 tooltip rule, §2.6.1 pack opening, build-notes sequencing rule; UI_DESIGN §4.10 drag physics; AGENTS+CLAUDE guardrails) — implement against them.

**Read this first:** five of these items (A, and parts of B/C) are *the same problem* — **feature-01 B (audio) has not shipped**. Individually they read as "add a sound here"; together they say the game is silent. Do feature-01 B as the vehicle and treat section A below as its expanded SFX manifest, rather than bolting sounds on one call site at a time.

Order: **A (audio, unblocks the most complaints) → B (tooltip + reaction coverage, cheap and broad) → C (pack opening) → D (drag physics, largest single job)**.

---

## A. Audio — extends the feature-01 B-1 manifest

feature-01 B-1 already lists the settle/interaction/shop set. These are **additions and emphases** from playtest:

### A-1. Money is never silent (playtest 9, 15)
- **Every gold change plays**, gain and loss, wherever it happens: purchase, sell, reroll, pack buy, Fee Settlement line items, interest, `goldPlay` font effect, Ivory/Brass material payouts.
- Purchase/open buttons specifically: a **coin jingle / vending-machine "ding"** — the request is exact and it's the right instinct, since these are the two buttons that spend money and currently give no confirmation at all.
- Gain and loss are **distinguishable** (rising vs falling figure), and repeated rapid changes (settlement count-up) use a pitch-escalating tick like the chip counter rather than retriggering one sample.

### A-2. Per-material tile sounds (playtest 16)
Each material gets a voice matching its physicality, played on **hand selection/interaction** and again — distinctly — when it **triggers during the scoring sequence**:

| Material | Character |
|---|---|
| Porcelain / Ceramic | light ceramic clink |
| Polished | smooth glassy chime |
| Glass | bright ring; **sharp shatter on destruction** |
| Stone | dull heavy knock |
| Lead plate | metallic dull thunk; **dice-roll rattle on its Lucky roll** |
| Ivory | warm hollow tock; **coin chime at blind-end payout** |
| Brass | bright metallic ring |
| Wood | dry woody knock; **rising pitch as it grows** (its +Chips climbs all run — let the sound climb with it) |

Implement as a material→sample map in the `audio.ts` facade, not as call-site branching. Fall back to the default tile sound for any material without a sample so nothing is ever silent.

### A-3. Object use/sell effects (playtest 11)
**Every** object action — using a consumable, selling an Emoji Tile or consumable, redeeming a voucher, applying a Fable/Constellation card — fires both a **visual effect and a sound**. Currently these resolve invisibly and inaudibly, which reads as "did that work?". Pair each with a brief on-object animation (pop/dissolve for consumed, slide-away + coin for sold).

### A-4. Selection feedback in packs (playtest 8)
Picking an item inside an opened pack plays a confirm sound (see C).

## B. Tooltip & hover coverage (playtest 12, 13)

Now a standing rule (screens-spec §0, mirrored into AGENTS/CLAUDE) — this task is to make reality match it:

- **Audit every surface** that renders an object and wire the shared tooltip + cursor reaction: play screen, shelves, shop slots, **opened-pack contents (the known gap)**, Collection grids, pouch modal, run-info.
- Letter-tile tooltips spell out **material, font, and edition separately** (three axes, GDD §2.4) with each effect's text.
- **Fix the Light Italic tooltip (playtest 13):** the cause is almost certainly the tooltip inheriting the tile's font style. Tooltip text uses the standard UI face at full contrast regardless of subject. Verify against every font and every dark material, in both the monochrome start state and full colour.
- Acceptance: no surface renders an interactive object without hover feedback and a tooltip; a Light Italic Lead-plate Foil tile reads clearly in one hover.

## C. Pack opening overlay (playtest 8) — screens-spec §2.6.1

Rebuild to the Balatro layout: contents fanned large and centred, explicit "Pick N of M" counter, single always-available Skip, nothing else competing for attention.

**Selection reaction is the actual complaint** — currently picking an item does nothing. Required: lift + pulse + selected outline on the chosen card, counter ticks down, confirm SFX, short beat before the overlay closes on the last pick. Blocked picks (Emoji Tile slots full) grey out with a reason label instead of failing silently.

Every revealed item hoverable + tooltipped (B).

## D. Drag physics (playtest 14) — UI_DESIGN §4.10

The biggest feel win available. Full spec is in the doc; the essentials:

spring-follow with lag · **rotation driven by drag velocity** (the detail that creates perceived weight) · grab scale-up + deeper shadow · release springs into the slot with overshoot · neighbours yield on staggered springs · un-dragged cards tilt toward a nearby cursor.

**Non-negotiable technical constraint:** GPU-composited `transform` driven by a single rAF spring loop or a spring library. **Never per-frame React re-renders of the hand** — many cards animate simultaneously here, so the existing transition-performance rule applies with more force. Pointer capture so fast drags can't drop the card. Reduced motion keeps positioning instant and drops tilt/overshoot/proximity.

Applies uniformly to letter tiles and Emoji Tiles, in hand, tile zone, and shelf.

## E. Blind-entry sequencing (playtest 10) — screens-spec build notes

The hand-draw animation must start **after** the blind's slide transition completes, not alongside it. Chain it off the transition's completion signal. Same rule generalizes to every incoming screen's entrance animation (shelf fill, boss stamp).

---

## Docs sync (already applied — verify, don't redo)
screens-spec **§0** (universal tooltip + hover + no-style-inheritance), **§2.6.1** (new: pack opening overlay), **build notes** (transition→entrance sequencing) · UI_DESIGN **§4.10** (drag physics; also fixes a duplicate list number) · AGENTS.md + CLAUDE.md (two new guardrails: tooltip universality, entrance chaining).

**Process note (playtest 17):** the spec-conflict protocol in AGENTS/CLAUDE is the mechanism you asked for — on any conflict between an instruction and the docs, stop, surface it, ask, then update the docs in the same change. Nothing in this batch conflicted with existing design; these were gaps, so the docs were extended rather than corrected.
