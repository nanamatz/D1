# Emoji Tile board verification

Profile: **baseline**

Command: `tsx src/sim/board-verification.ts --profile=baseline --json=docs/balance/2026-08-22-board-verification.json --markdown=docs/balance/2026-08-22-board-verification.md`

Measured runtime: 35.7s (runtime is intentionally excluded from JSON).

Source: Node v24.13.0; revision `3ee218b2b0b9`; uncommitted worktree.

Roster: 150 public Emoji Tiles; Common 34 / Uncommon 57 / Rare 54 / Legendary 5. Developer ids excluded: developerGrace.

Schema coverage: 150/150; focal coverage: 150/150; naturally offered/acquired: 122/82; triggered/state-changed: 109/54.

Flags: insufficient 1, unexercised 27, dead 0, outlier 33. Flags are review inputs and never auto-retune values.

Flag provenance: derived deterministically from the stored row metrics; reflagging changes no simulation values.

## Cohort summary

| cohort | runs | Ch8 reached | Ch8 natural wins | mean score/target | blind failures | Endless complete | peak Chapter |
|---|---:|---:|---:|---:|---:|---:|---:|
| controlNatural | 32 | 0 | 0 | n/a | 0 | 0 | 5 |
| marketNatural | 32 | 0 | 0 | n/a | 2 | 0 | 7 |
| marketForced | 32 | 32 | 1 | 0.2286 | 8 | 0 | 8 |
| endlessMarket | 8 | 8 | 0 | 0.1281 | 7 | 8 | 38 |

## Deterministic review flags

- **insufficient (1):** foldingManuscript

- **unexercised (27):** blacksmith, carteBlanche, clearDesk, copyEditor, counterfeit, dadaist, dogFood, fableHoard, gathering, holePunch, hollowPromise, host, iotaStroke, lastSort, leak, livingType, mirrorImage, nightOwl, outOfPrint, plagiarist, proofEraser, stargazer, stoneTongue, straightTalk, temurah, thirdParty, zombie

- **dead (0):** none

- **outlier (33):** alphabetSoup, bagCounter, bald, beehiveTile, bloodTypeA, cadmusTeeth, censorsBane, ceramicArtisan, classicist, cubism, deadlineAuction, dryingInk, dullingPencil, dummyData, fullDesk, glassInsurance, houseStyle, hypocrite, interestGlutton, longWordFan, materialSampler, megalith, miser, oneVoice, rareEarth, royaltyContract, royalWe, serial, shuriken, streetCred, tipJar, voraciousReader, wordHunter

## Interpretation limits

- Smoke proves deterministic schema, legal engine traversal, finite values, and one focal run per public id; it is not a tuning sample.
- Baseline is a bounded directional screen; only the full profile uses the designer-recommended statistical budgets.
- The bot chooses high base-score words, chases 3+ letters, buys Emoji Tiles and Charm/Tile Packs, and does not use Fables, rerolls, skips, or semantic condition planning.
- Forced cohorts measure exposure and late scaling, never a natural win rate.
- `unexercised` means no captured activation, state change, or per-axis delta; it does not mean weak.
- `dead` is intentionally disabled in v1. A future full sweep must add targeted per-effect condition opportunities before making any dead-effect claim.

## Profile budgets

| profile | global | focal/id | focal Chapters | Endless market | Endless focal/id | Pouch×Record/cell |
|---|---:|---:|---:|---:|---:|---:|
| smoke | 1 | 1 | 1 | 1 | 0 | 0 |
| baseline | 32 | 2 | 8 | 8 | 0 | 1 |
| full | 2000 | 128 | 8 | 512 | 16 | 64 |

## Full-profile command (not run by this baseline)

`npm run sim:board-full`
