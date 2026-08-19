import mitLicense from '../../node_modules/react/LICENSE?raw';
import oflLicense from '../../node_modules/@fontsource/jost/LICENSE?raw';
import wordNetLicense from '../../data/WORDNET_LICENSE.txt?raw';
import wiktionaryAttribution from '../../data/WIKTIONARY_ATTRIBUTION.md?raw';
import cc0License from './legal/CC0-1.0.txt?raw';

const NOTICE_INDEX = `THIRD-PARTY NOTICES — Play the Wor!d

Original contributions: Copyright © 2026 Ben Kim. All rights reserved.

SOFTWARE
React 18.3.1, ReactDOM 18.3.1, and scheduler 0.23.2
Copyright (c) Facebook, Inc. and its affiliates.
License: MIT License

FONTS
Bundled locally through Fontsource 5.3.0 under the SIL Open Font License 1.1:
- Jost — Copyright 2020 The Jost Project Authors (https://github.com/indestructible-type/Jost)
- Noto Sans KR — Google Inc.
- Baloo 2 — Copyright 2019 The Baloo 2 Project Authors (https://github.com/EkType/Baloo2)
- Jersey 10 — Copyright 2023 The Soft Type Project Authors (https://github.com/scfried/soft-type-jersey)

AUDIO SAMPLES
Casino Audio 1.1 by Kenney Vleugels (Kenney.nl), released under CC0 1.0.
The 17 imported samples are:
cards-pack-open-2.ogg
rollover1.ogg
chip-lay-1.ogg
chip-lay-2.ogg
chips-stack-1.ogg
chips-stack-2.ogg
chips-stack-3.ogg
chips-stack-5.ogg
chips-stack-6.ogg
chips-handle-1.ogg
chips-handle-2.ogg
chips-handle-3.ogg
chips-handle-4.ogg
chips-collide-1.ogg
chips-collide-2.ogg
chips-collide-3.ogg
chips-collide-4.ogg
All other sound effects and BGM are original runtime synthesis and are not CC0.

ENABLE WORD LIST
Enhanced North American Benchmark Lexicon (ENABLE), compiled by Alan Beale and
M. Cooper and released into the public domain. Source mirror used by the offline
pipeline: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
Upstream declaration:
“The ENABLE master word list, WORD.LST, is herewith formally released into the
Public Domain. Anyone is free to use it or distribute it in any manner they see
fit. No fee or registration is required for its use nor are ‘contributions’
solicited.”
Project transformation: lowercase ASCII alphabetic entries were restricted to
18 letters or fewer, then documented apostrophe-free tile-grammar forms were added.

MOBY PART-OF-SPEECH II
Moby Part-of-Speech II by Grady Ward.
Source: https://www.gutenberg.org/ebooks/3203
Upstream declaration:
“This documentation, the software and/or database are:
Public Domain material by grant from the author, January, 2001.”
Project transformation: exact-headword POS tags were unioned into the baked
lexicon, then explicit overrides and deterministic fallbacks were applied.

WORDNET 3.0
Princeton WordNet 3.0 POS data is used under the notice reproduced below.

WIKTIONARY
Register labels are partly derived from English Wiktionary usage categories.
Source: https://en.wiktionary.org/wiki/Category:English_terms_by_usage
Authors: Wiktionary contributors
License: Creative Commons Attribution-ShareAlike 4.0
https://creativecommons.org/licenses/by-sa/4.0/
Additional source terms: GNU Free Documentation License
https://en.wiktionary.org/wiki/Wiktionary:Copyrights
Offline snapshot retrieved: 2026-08-03
Entries were lowercased, restricted to unbroken ASCII alphabetic spellings,
intersected with the baked lexicon, and reduced to representative-meaning usage
classes with documented boundary examples and POS-compatible inflection inheritance.
Definitions are not redistributed.`;

export const THIRD_PARTY_NOTICES = [
  NOTICE_INDEX,
  'MIT LICENSE — VERBATIM',
  mitLicense.trim(),
  'SIL OPEN FONT LICENSE 1.1 — VERBATIM',
  oflLicense.trim(),
  'CC0 1.0 UNIVERSAL — VERBATIM',
  cc0License.trim(),
  'WORDNET 3.0 NOTICE — VERBATIM',
  wordNetLicense.trim(),
  'WIKTIONARY ATTRIBUTION',
  wiktionaryAttribution.trim(),
].join('\n\n');
