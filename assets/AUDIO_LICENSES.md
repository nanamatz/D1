# Audio asset licenses

Phase 1 audio is **fully synthesized** at runtime by `src/ui/audio.ts` (Web Audio
oscillators + filtered noise). There are **no external audio files** in this
project, so there is nothing third-party to attribute.

| Sound id | Source | License |
|---|---|---|
| all SFX (`SFX_NAMES` in `src/ui/audio.ts`) | Original synthesis, no sample | CC0 / original |

When real chiptune samples replace synthesis (phase 2+), add each file here with
its source URL and license BEFORE committing the asset. The `audio.play(name)`
facade is the swap seam — call sites do not change.
