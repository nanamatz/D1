# Audio asset licenses

All audio (SFX **and** BGM) is **fully synthesized** at runtime by
`src/ui/audio.ts` (Web Audio oscillators + filtered noise; BGM via a small
looping note sequencer). There are **no external audio files** in this project,
so there is nothing third-party to attribute.

| Sound id | Source | License |
|---|---|---|
| all SFX (`SFX_NAMES` in `src/ui/audio.ts`) | Original synthesis, no sample | CC0 / original |
| all BGM tracks (`MUSIC_TRACKS`: menu / play / shop / boss) | Original synthesis, no sample | CC0 / original |

When real chiptune samples replace synthesis (phase 2+), add each file here with
its source URL and license BEFORE committing the asset. The `audio.play(name)` /
`audio.playMusic(track)` facades are the swap seam — call sites do not change.
