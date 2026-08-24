# Emoji Tile board verification

Profile: **full**

Command: `tsx src/sim/board-verification.ts --profile=full --json=docs/balance/2026-08-22-board-verification-full.json --markdown=docs/balance/2026-08-22-board-verification-full.md`

Measured runtime: 3888.8s (runtime is intentionally excluded from JSON).

Source: Node v24.13.0; revision `3ee218b2b0b9`; uncommitted worktree.

Roster: 150 public Emoji Tiles; Common 34 / Uncommon 57 / Rare 54 / Legendary 5. Developer ids excluded: developerGrace.

Schema coverage: 150/150; focal coverage: 150/150; naturally offered/acquired: 145/145; triggered/state-changed: 124/150.

Flags: insufficient 0, unexercised 0, dead 0, outlier 43. Flags are review inputs and never auto-retune values.

Flag provenance: derived deterministically from the stored row metrics; reflagging changes no simulation values.

## Cohort summary

| cohort | runs | Ch8 reached | Ch8 natural wins | mean score/target | blind failures | Endless complete | peak Chapter |
|---|---:|---:|---:|---:|---:|---:|---:|
| controlNatural | 2000 | 0 | 0 | n/a | 45 | 0 | 6 |
| marketNatural | 2000 | 11 | 4 | 0.8884 | 60 | 0 | 8 |
| marketForced | 2000 | 2000 | 47 | 0.2025 | 310 | 0 | 8 |
| endlessMarket | 512 | 512 | 14 | 0.2095 | 579 | 512 | 38 |

## Deterministic review flags

- **insufficient (0):** none

- **unexercised (0):** none

- **dead (0):** none

- **outlier (43):** bagCounter, beehiveTile, biochemistry, bloodTypeA, brokenSentence, cadmusTeeth, censorsBane, civilTongue, classicist, cleanCopy, cubism, deadlineAuction, dryingInk, dullingPencil, dummyData, fullDesk, golem, handScholar, holePunch, hotOffThePress, houseStyle, interestGlutton, longFormSerial, materialPrism, materialSampler, megalith, miser, oneVoice, pouchTag, rareEarth, rotaryPress, royaltyContract, scarletLetter, scrapDealer, serial, shuriken, streetCred, syllableScale, typeOrchestra, voraciousReader, vowelChoir, woodblockPress, wordHunter

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

## Full-profile sweep

Completed with the full profile command shown above.
