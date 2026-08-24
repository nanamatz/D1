# Skip reward verification

Profile: **baseline**

Command: `tsx src/sim/skip-verification.ts --profile=baseline --json=docs/balance/2026-08-22-skip-verification.json --markdown=docs/balance/2026-08-22-skip-verification.md`

Measured runtime: 6.1s (excluded from deterministic JSON).

Proxy decisions: 43/74 (58.1%). The 20–35% human target is context only; this neutral single-decision counterfactual is not human behavior and does not tune rewards.

Telemetry: pending means a selected reward remained stored at simulation end; unresolved is the pending subset whose named resolution opportunity occurred but failed and left it stored.

Ordering: Chapter 8 win → furthest blind → terminal score/target → gold; ties choose Play.

Forced coverage: 30/30 IDs. Timing buckets: immediate 12, next blind 7, next shop 9, next clear 1, next Deadline 1.

Deadline guard: pass; offer no-repeat: pass; Chapter 38/no 39: pass.

No balance values were changed and no tuning claim is made.
