# Audio asset licenses

Most audio is synthesized at runtime by `src/ui/audio.ts` (Web Audio
oscillators + filtered noise; BGM via a small looping note sequencer). The
sampled exceptions are listed below.

| Sound id | Source | License |
|---|---|---|
| Sweet Turtles startup ident cue (`src/ui/startupAudio.ts`, outside the game mixer) | Original deterministic Web Audio synthesis, no sample | © 2026 SweetTurtles — all rights reserved |
| synthesized SFX (`SFX_NAMES` except sampled entries) | Original synthesis, no sample | © 2026 SweetTurtles — all rights reserved |
| all BGM tracks (`MUSIC_TRACKS`: menu / play) | Original synthesis, no sample | © 2026 SweetTurtles — all rights reserved |
| `packOpen` (`Audio/cards-pack-open-2.ogg`) | Casino Audio 1.1 by Kenney Vleugels (Kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `reroll` (`Audio/rollover1.ogg`) | Casino Audio 1.1 by Kenney Vleugels (Kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Chips magnitude set (`Audio/chip-lay-*.ogg`, `chips-stack-*.ogg`, `chips-handle-*.ogg`, `chips-collide-*.ogg`) | Casino Audio 1.1 by Kenney Vleugels (Kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Score Keyboard keypress set (`Audio/Single Keys/keypress-*.wav`) | User-provided on 2026-09-02 | License not supplied — verify before distribution |

Add future samples here with their source and license before committing them.
The `audio.play(name)` / `audio.playMusic(track)` facades are the swap seam —
call sites do not change.
