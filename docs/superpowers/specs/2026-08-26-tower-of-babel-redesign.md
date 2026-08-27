# Tower of Babel redesign (design only)

Status: approved design direction, intentionally not implemented in the
2026-08-26 Emoji Tile revision. The live tile keeps its existing four-register
effect until this design receives dedicated implementation, QA, and simulation.

## Rule

Tower of Babel gains one virtual copy of every other owned Emoji Tile's effect.
The original tiles still run normally at their own shelf positions. At Tower's
shelf position, virtual sources run left-to-right in source shelf order and obey
the roster-wide per-qualifying-unit event rule.

## Identity and state

- Each virtual source is keyed by the source's stable owned-instance uid.
- Virtual growth/state is independent from the physical source and persists in
  Tower's namespaced state. Late-created history scalers initialize from the
  authoritative run history.
- Legacy owners receive deterministic stable uids during save normalization;
  save version is not bumped.
- Copied self-lifecycle effects target Tower itself. Hidden virtual cards cannot
  be destroyed or sold independently.

## Copy boundary

- Copy scoring, rule, economy, creation/destruction, blind, and shop hooks.
- After Book of Margins, Carte Blanche, and Copy Editor are expressed as
  `JokerDef` capabilities rather than pipeline id checks, copy those capabilities
  too. Examples: Book of Margins contributes another +3 slots; Carte Blanche
  another $2 price reduction.
- Do not copy rarity, price, art, unlock state, source edition, or White-slot
  contribution. Tower's own edition applies once after the virtual group.
- Never copy Tower itself or another Tower definition.
- A boss-disabled physical source disables its virtual copy for that event.

## Echo and recursion

An Echo source resolves the effect it would reach from its real shelf position.
Echo/Tower/future copier traversal carries a visited owned-instance uid set.
Missing, disabled, Tower, or already-visited targets are no-ops. The traversal
must have a hard bound of the owned shelf length.

## Ordering and RNG

Virtual hooks execute at Tower's shelf position in stable physical-source order.
Every copied random action consumes the normal seeded RNG at that exact point;
preview never advances it. Identical seed, shelf, state, and input must reproduce
score, event order, RNG counter, and virtual state exactly.

## Required implementation slice

1. Add stable optional owned-instance uids and legacy normalization.
2. Datafy all remaining non-hook Joker capabilities.
3. Add the generic virtual-instance dispatcher with source attribution and
   recursion guard; do not add per-Joker pipeline branches.
4. Add headless tests for state independence, lifecycle targeting, disabled
   propagation, editions, capabilities, Echo chains, RNG order, and event bounds.
5. Run at least 1,000 seeded control/focal simulations, including destruction,
   retrigger, economy, Book of Margins, Carte Blanche, Copy Editor, and Echo
   combinations. Reject Infinity/NaN, unbounded events, or non-reproducibility.
