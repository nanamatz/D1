# Shop Mascot "Piyak" (삐약이) — Design

Date: 2026-07-18
Status: approved (design), pending implementation

## Goal

Ship the Stationery Shop's mascot (UI_DESIGN §6, screens-spec §2.6): the pixel-art
tuxedo cat proprietor, now named **삐약이 (Piyak)**, as an idle-animated decoration
with a speech bubble that shows one random welcome line per shop visit.

Scope change vs. the previous docs: the speech-bubble **welcome line** moves from
"later layer" into the shipped scope. Purchase/reroll reactions remain a later layer.

## Asset

- Source art: `docs/Piyak.png` — 896×1195 pixel-art tuxedo cat, transparent
  background (32-bit ARGB). This replaces the stale doc reference
  `docs/reference/mascot/cat.png` (never existed).
- Runtime copy: `src/ui/assets/piyak.png`, imported via Vite (`docs/` is not served).

## Component

- New file `src/ui/components/ShopMascot.tsx`, rendered by `Shop.tsx` at the bottom
  of the left rail (`.shop-rail`), below the gold panel — "proprietor behind the
  counter", never overlapping the sale slots.
- On mount (= each shop entry) it picks one line from the welcome pool with
  `Math.random()` and keeps it while the shop stays open. UI-only cosmetic, so the
  engine's seeded-RNG rule (engine-only) does not apply.
- Structure: bubble above, cat below. The bubble text comes from i18n.

## Welcome line pool (i18n)

- Keys `mascot.welcome.0` … `mascot.welcome.7` (8 lines) in `locales/ko.json` and
  `locales/en.json`; a `MASCOT_WELCOME_COUNT` constant in the component keeps the
  pool size in one place.
- Tone: cat proprietor of a publishing-world stationery shop (냥 speech tics in
  Korean, "meow" flavor in English).

## Idle animation + bubble (CSS)

- `image-rendering: pixelated`; display width ~140px (fits the 168px rail).
- Idle: a breathe keyframe — subtle squash (scaleY ≈ 0.985) with
  `transform-origin: bottom`, ~3s ease-in-out infinite. Single-sprite CSS only;
  the part-based blink/tail-flick from UI_DESIGN §6 needs extra frames and stays
  future work.
- Bubble: pixel-art grammar per UI_DESIGN (squared corners, blocky shadow, pixel
  tail pointing down at the cat), tokens from `tokens.css`; pop-in animation on
  entry.
- `prefers-reduced-motion: reduce` disables both animations (static cat, bubble
  appears without motion).
- ≤720px (single-column shop layout): the mascot is hidden so it never pushes the
  sale content.

## Docs to update in the same change

- `docs/UI_DESIGN.md` §6 — name (삐약이/Piyak), real art path, welcome bubble now
  shipped, idle = single-sprite CSS breathe (part-based anim future).
- `docs/screens-spec.md` §2.6 — same updates to the shop-mascot bullet.
- `docs/GDD.md` §1.2 art-direction note — add the mascot's name.

## Testing

- UI decoration only — no engine change, no sim impact. Verify by running the app:
  enter the shop, see Piyak + one welcome line; re-enter, line can differ; check
  reduced-motion and narrow-viewport behavior.
