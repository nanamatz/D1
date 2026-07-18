# WooDak Position + Entrance Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center 우땅 vertically beside the run-end card (he currently sinks to the overlay bottom via the shop block's `margin-top: auto`) and give him a jump-pop entrance, bubble popping after he lands.

**Architecture:** CSS-only: overrides on `.go-mascot` (position + entrance keyframes + bubble delay), scoped so 삐약이's shop placement is untouched. One doc line in UI_DESIGN §6.1.

**Tech Stack:** Plain CSS.

**Spec:** `docs/superpowers/specs/2026-07-19-woodak-entrance-design.md`

## Global Constraints

- CSS-only + one doc line; no component or engine changes.
- Overrides live on `.go-mascot` / `.go-mascot .mascot-bubble` only — the shared `.mascot` block and Piyak's shop behavior must not change.
- Reduced motion: `woodakEnter` must be disabled in the existing `@media (prefers-reduced-motion: reduce)` block; `body.force-reduced-motion` is already covered globally.
- Docs and code land in the same commit (CLAUDE.md protocol step 3).
- No test harness applies — verify in the running app per `.claude/skills/verify/SKILL.md`.

---

### Task 1: Position + entrance CSS + doc line

**Files:**
- Modify: `src/ui/styles/screens.css` — the WooDak block (search "Run-end mascot — 우땅/WooDak")
- Modify: `docs/UI_DESIGN.md` — §6.1 paragraph

**Interfaces:**
- Consumes: existing classes `.go-mascot`, `.mascot-bubble`, `.mascot-sway` and the shared `.mascot` block (shop-mascot section).
- Produces: keyframes `woodakEnter`; no new class names.

- [ ] **Step 1: Update the WooDak CSS block**

In `src/ui/styles/screens.css`, replace the `.go-mascot` rule:

```css
.go-mascot {
  width: 190px;
  flex: none;
  margin-right: 18px;
}
```

with:

```css
.go-mascot {
  width: 190px;
  flex: none;
  margin-right: 18px;
  /* The shared .mascot rule's margin-top:auto (shop-rail bottom parking) would
     sink him to the overlay floor — pin him to eye level with the card. */
  margin-top: 0;
  align-self: center;
  /* Jump-pop entrance: rise + overshoot squash, then the bubble pops (below). */
  animation: woodakEnter 0.45s ease-out backwards;
}
@keyframes woodakEnter {
  0% {
    opacity: 0;
    transform: translateY(36px) scale(0.5);
  }
  60% {
    opacity: 1;
    transform: translateY(-6px) scale(1.12);
  }
  80% {
    transform: translateY(0) scale(0.97);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}
.go-mascot .mascot-bubble {
  /* after the 0.45s landing (Piyak keeps the shared 0.25s) */
  animation-delay: 0.5s;
}
```

and extend the reduce block at the end of the WooDak section from:

```css
@media (prefers-reduced-motion: reduce) {
  .mascot-sway {
    animation: none;
  }
}
```

to:

```css
@media (prefers-reduced-motion: reduce) {
  .mascot-sway,
  .go-mascot {
    animation: none;
  }
}
```

- [ ] **Step 2: Update UI_DESIGN §6.1**

In `docs/UI_DESIGN.md` §6.1, replace the sentence fragment
"~150px wide beside the run-end card, hidden ≤720px, frozen under reduced motion."
with
"~150px wide, vertically centered beside the run-end card; enters with a jump-pop (rise + overshoot squash, ~0.45s) and the bubble pops right after landing; hidden ≤720px, frozen under reduced motion."

- [ ] **Step 3: Verify in the running app**

Per `.claude/skills/verify/SKILL.md`: dev server + Playwright, force a loss (gibberish phases). Observe: WooDak vertically centered beside the card (his box's midpoint within ~40px of the card's midpoint), entrance animation runs (`animationName` = `woodakEnter`), bubble appears after landing, reduced-motion shows him static and instantly visible. Screenshot. Also open the shop once to confirm Piyak still parks at the rail bottom.

- [ ] **Step 4: Commit**

```powershell
git add src/ui/styles/screens.css docs/UI_DESIGN.md
git commit -m "fix : center WooDak beside the run-end card + jump-pop entrance"
```
