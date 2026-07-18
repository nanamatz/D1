# Playtest 05 — Feedback & Work Order

Short round: two items. **A = clear-timing bug** (recurrence of playtest-04 A-1, top priority), **B = screen-transition animation** (detailed spec supplied by design). One item was discussed and dropped (see D). GDD/CLAUDE.md sync at the end.

---

## A. Round clear fires before the score finishes animating (BUG — recurrence)

Reported and addressed in playtest-04 (A-1) but still occurring: the round-clear UI appears before the round-score number has finished counting up to its final value. The player never sees their score actually reach/pass the target.

**Root cause (probable):** the clear check triggers off the *final score value* (computed instantly), while the count-up animation runs asynchronously. So the verdict fires before the animation lands.

**Fix — bind the clear trigger to animation completion, not to the value:**
- The clear check must await the **settlement-sequence completion signal** (the promise that resolves when tiles-pop → joker-triggers → sentence-bonus-landing → total-roll have all finished visually).
- After that resolves, hold a short beat (~0.5s, `balance.ts` or a UI constant) before showing the clear UI.
- This is the same root as playtest-04 A-2 (sentence bonus must be *seen* pushing the score over before the verdict). Unify them: **"settlement sequence complete" is the single event that gates the clear UI.**
- Acceptance: the round-score number is visibly at its final value (past target) on screen before the clear UI appears; a submission whose sentence bonus is the deciding factor shows that bonus landing first. Add/extend a test asserting the clear event fires only after the settle-complete signal.

## B. Screen-transition animation (design-supplied spec)

Replaces the vague "wipe" from playtest-04 E-1. Reference feel: **Animal Crossing** screen transitions. One shared transition component; all transitions use the same rules below.

- **Type:** Push slide or Overlay wipe. Push = both panels translate together (outgoing pushed off as incoming enters). Overlay = outgoing panel stays fixed while the incoming panel swipes over it with masking. (Implementer's choice per transition, but be consistent; Overlay reads better for entering-deeper, Push for peer swaps — optional nuance, not required.)
- **Axis & direction — UNIFIED: horizontal, right-to-left.** New screens slide in from the **right, moving left** ("advancing forward" feel). No diagonal movement; strict X-axis linear translation. (We chose one unified direction over an axis-by-hierarchy scheme for simplicity.)
- **Edge:** hard edge — pixel-crisp boundary, no gradient/alpha fade. On Overlay transitions, render a **dark, narrow, near-zero-blur semi-transparent shadow** just under the leading edge to make the Z-depth step between panels read clearly.
- **Z-order:** hierarchical stacking — the incoming screen has a higher z-index and renders over the outgoing one.
- **Curve:** spring / Ease-Out Back. NOT linear — the panel decelerates hard approaching its target, slightly **overshoots** the target pixel, then settles back (elastic). Physical inertia feel.
- **Applies to:** all screen transitions (menu↔run, blind→blind, →shop, →settlement, →game over).
- **Performance:** drive with CSS `transform` (translateX) on a GPU-composited layer (`will-change: transform`) or a spring lib (framer-motion) — do NOT animate via React re-renders per frame; the overshoot curve is per-frame and will jank if not composited.
- **Reduced motion:** `prefers-reduced-motion` replaces the slide+overshoot with a plain crossfade.
- Acceptance: every screen change slides in from the right with a visible overshoot-settle; reduced-motion falls back to fade; no frame drops during the transition.

---

## C. GDD & CLAUDE.md sync

1. CLAUDE.md "easy to get wrong": strengthen the settle bullet — **the round-clear (and game-over) UI is gated on the settlement-sequence completion signal, never on the raw final-score value.** This is now a twice-recurring bug; make it a first-class invariant.
2. GDD/screens-spec: record the transition spec (§B) as the canonical transition behavior (horizontal right-to-left, hard edge, spring/overshoot, Animal-Crossing reference).

## D. Discussed and dropped — special-character tiles

Explored adding special-character tiles (wildcard letter tiles à la Scrabble blanks; and mood-marker tiles where `?`/`!` would open interrogative/exclamatory sentence types without needing syntactic parsing). **Decision: dropped — keep §1's "no special characters" stance.** Rationale worth recording: each proposed role duplicated an existing system — wildcards overlap the Carving Knife consumable (letter change) and the pouch's draft-flavored sculpting; mood markers overlap the Punctuation consumables (which already map `!`→Imperative, and reserve `?`→Interrogative) and would force a large change to the §5 pattern system. The functionality we reached for already lives elsewhere, so nothing is added. Revisit only if a concrete need appears that no existing system covers.
