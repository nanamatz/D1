# WooDak Position + Entrance Animation — Design

Date: 2026-07-19
Status: approved (design), pending implementation

## Goal

On the run-end screen 우땅 (WooDak) sits too low — the shop-mascot block's
`.mascot { margin-top: auto; }` (intended to park 삐약이 at the bottom of the
shop rail) pushes him to the bottom of the full-height overlay flex. Raise him
to eye level with the card, and give him a jump-pop entrance.

## Changes (CSS-only + doc line)

1. **Position:** `.go-mascot { margin-top: 0; align-self: center; }` —
   vertically centered beside the run-end card, bubble in the mid-screen zone.
   삐약이's shop placement is untouched (override lives on `.go-mascot` only).
2. **Entrance:** `woodakEnter` keyframes on `.go-mascot`, ~0.45s: rise from
   `translateY(36px) scale(0.5)` with overshoot (`scale 1.12` → `0.97` → `1`)
   — a landing squash in the pixel-art idiom. Bubble pop-in delay raised from
   0.25s to 0.5s via a `.go-mascot .mascot-bubble` override (Piyak keeps
   0.25s), so the beat reads: WooDak lands → bubble pops.
3. **Reduced motion:** add `woodakEnter`'s animation to the existing reduce
   block (static, instantly visible); `body.force-reduced-motion` is already
   covered globally.
4. **Docs:** update the placement/entrance line in UI_DESIGN §6.1, same
   commit.

Files: `src/ui/styles/screens.css`, `docs/UI_DESIGN.md`.

## Testing

Project verify skill: run-end screen shows WooDak centered beside the card,
jump-pop entrance then bubble; reduced-motion shows everything static;
shop's Piyak placement unchanged.
