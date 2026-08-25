# Skip reward verification

Profile: **full**

Command: `tsx src/sim/skip-verification.ts --profile=full --factor-snapshot=pre-tune --json=docs/balance/2026-08-22-skip-verification-full-pre-tune-corrected.json --markdown=docs/balance/2026-08-22-skip-verification-full-pre-tune-corrected.md`

Measured runtime: 476.6s (excluded from deterministic JSON).

Emoji factor snapshot: **pre-tune** (Word Hunter +0.1; Biochemistry +0.5).

Correction provenance: previous JSON SHA-256 `60164c39d56f47a2fe0681e3c86d7d15e41867b3094707fc637ae0291638052e` (Correct Coupon pricing and immediate Fable/Constellation/Ink Pack resolution at the original Emoji-factor snapshot.)


Proxy decisions: 8192/17032 (48.1%). The 20–35% human target is context only; this neutral single-decision counterfactual is not human behavior and does not tune rewards.

Telemetry: pending means a selected reward remained stored at simulation end; unresolved is the pending subset whose named resolution opportunity occurred but failed and left it stored.

Ordering: Chapter 8 win → furthest blind → terminal score/target → gold; ties choose Play.

Forced coverage: 30/30 IDs. Timing buckets: immediate 12, next blind 7, next shop 9, next clear 1, next Deadline 1.

Deadline guard: pass; offer no-repeat: pass; Chapter 38/no 39: pass.

No balance values were changed and no tuning claim is made.
