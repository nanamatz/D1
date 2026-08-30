# Mascot voices, character names, and the Emoji Tile terminology switch

**Date:** 2026-07-23
**Status:** Approved
**Bundle:** A of 5 (see "Batch context" below)

## Batch context

The user delivered a 17-item polish request spanning six independent subsystems.
It was decomposed into five bundles, to be specced and shipped **one at a time**:

| Bundle | Scope | Request items |
|---|---|---|
| **A (this spec)** | Terminology & mascot content | 3, 4, 6 |
| B | Collection / palette UX | 1, 2, 5, 13 |
| C | Shop & pack-opening Balatro-style layout | 7, 8, 12 |
| D | Audio pass | 9, 11 (sound), 15, 16 |
| E | Motion / feel pass | 10, 11 (visual), 14 |

Decisions already banked for later bundles (record them here so they are not
re-litigated): the Palette category split is **four** groups — 색상 / 음향 /
캐릭터 / **언어** (KOREAN gets its own group; it maps 1:1 to `UnlockEffect.kind`).
The `.cc-name` removal in item 5 applies to the **pack gallery only** — Jokers,
Palette, Mascots, and Bosses keep their names, because the Palette view renders
its locked hint (`R _ _`) through `.cc-name`.

## Goal

1. **Name the ghost and alien mascots** (item 3): GHOST → 이고야 / Egoya,
   ALIEN → 이고지 / Egoji.
2. **Give every mascot its own voice** (item 4): distinct register, verbal tic,
   and rewritten lines for 누렁이 / 이고야 / 이고지 / 느무보. 우땅 and 삐약 are
   already right and only move to the new key namespace.
3. **Switch the display term Joker → Emoji Tile** (item 6), display strings and
   docs only.

## Spec-conflict resolutions

Three conflicts were surfaced before design and resolved by the user
(CLAUDE.md spec-conflict protocol).

**Conflict 1 — "조커라는 용어를 이모지로 전면적으로 대체" vs. the terminology rule.**
CLAUDE.md states terminology is *display-strings only* and engine identifiers are
never renamed for it. `joker` appears **446 times across 50 files** including the
whole engine, while only **10 keys are user-visible**. GDD §11 is moreover already
titled *"Jokers (Emoji Tiles)"* — Emoji Tile was the intended display term all
along. **Decision: display strings + docs only.** `JokerDef`, `src/engine/jokers/`,
`BALANCE.jokerSlots`, `RunState.jokers` are untouched. This also avoids the
`JokerDef.emoji` → `EmojiDef.emoji` name collision, where "emoji tile" and "emoji
glyph" would become the same word.

**Conflict 2 — 거북이 "느무시" vs. the shipped "느무보".**
`mascot.turtle` currently reads 느무보 (ko.json). **Decision: keep 느무보.** The
"느무시" in the request is treated as a slip; this spec and all copy use 느무보.

**Conflict 3 — 이고지's unintelligible speech vs. functional tutorial text.**
The encounter coach-marks (`tutorial.*.body`) are instructional: they explain boss
debuffs, vouchers, materials. Rendering them in untranslated alien speech means a
player who picks 이고지 cannot read them, and encounters fire once per profile.
**Decision: full alien speech, no subtitle** — the user chose flavour over
legibility, explicitly. The trade-off is acceptable because the Collection (도감)
independently carries the same information (`materialdesc.*`, `fontdesc.*`,
`bossdesc.*`, `voucherdesc.*`, `packdesc.*`), so nothing is permanently lost, and
because selecting 이고지 is a deliberate opt-in the player can reverse in
Collection → Mascots at any time. The lexicon remains shared, but its written
form is locale-specific: Romanized alien in English and fixed Hangul alien
transliterations in Korean (changed 2026-08-31).

## Part A — Character names (item 3)

i18n display strings only; the unlock/skin **ids stay `ghost` / `alien`**, as do
the trigger words GHOST / ALIEN shown in the Palette view.

| key | EN (was → is) | KO (was → is) |
|---|---|---|
| `mascot.ghost` | Ghost → **Egoya** | 유령 → **이고야** |
| `mascot.alien` | Alien → **Egoji** | 외계인 → **이고지** |
| `mascot.dog` | Nurungi (unchanged) | 누렁이 (unchanged) |
| `mascot.turtle` | Turtle → **Nemubo** | 느무보 (unchanged) |

`mascot.turtle`'s English is aligned to the Korean name for consistency with the
other three romanised names (WooDak / Nurungi / Egoya / Egoji).

## Part B — Voice bible (item 4)

| Mascot | Concept | Register / tic |
|---|---|---|
| **우땅** WooDak | Orangutan editor-mentor. Unchanged. | `~다우땅`, warm senior |
| **삐약** Piyak | Shop proprietor. Unchanged. Fixed role, never re-skinned. | `~다냥`, sly merchant |
| **누렁이** Nurungi | Loyal dog. Addresses the player as **주인님**. Short declaratives, unconditional encouragement even on a loss. | `~다멍!` |
| **이고야** Egoya | Tricky, mischievous ghost. Informal speech (반말), teases and needles, trails off. Delivers the information but wrapped in a jab or a riddle. | `~지롱`, `~시지~`, `…` |
| **이고지** Egoji | Alien. **Alien speech only, no subtitle.** Uses a consistent alien lexicon so the lines read as a real language rather than noise. | Same lexicon; Roman EN / Hangul KO |
| **느무보** Nemubo | Crisp scholar. Formal 격식체, cites exact figures and terms, no filler. | `~습니다` |

### Approved tone samples

`won` — victory:
```
우땅   축하한다우땅! 원고가 드디어 책이 됐다우땅.
누렁이  해냈다멍! 주인님이 해낼 줄 알았다멍! 꼬리가 멈추질 않는다멍!
이고야  어라, 진짜 끝냈네? 시시하게시리~ …아니 뭐, 잘했어. 조금은.
이고지 EN  Vor'nak! Tolun mi'ren — do'gan thal. Zk'tha, zk'tha!
이고지 KO  보르'낙! 톨룬 미'렌 — 도'간 탈. 즈크'타, 즈크'타!
느무보  완료되었습니다. 원고가 서적의 형태를 갖추었군요. 통계적으로 드문 결과입니다.
```

`tip.reroll` — never rerolled:
```
우땅   리롤을 한 번도 안 썼다우땅. 좋은 이모지는 기다려 주지 않는다우땅.
누렁이  주인님, 리롤을 한 번도 안 썼다멍. 마음에 안 들면 말만 하라멍, 다시 물어 오겠다멍!
이고야  리롤 한 번도 안 썼지롱~ 겁쟁이. 상점 물건이 그렇게 무섭던가?
이고지 EN  Mi'ren re'rol nu'kha Mor'ka tolun vok'tu — shi'mela
이고지 KO  미'렌 레'롤 누'카 모르'카 톨룬 보크'투 — 시'멜라
느무보  리롤 사용 0회로 기록되었습니다. 상점 재고는 확률 분포이지 운명이 아닙니다.
```

`tip.3` — interest:
```
우땅   이자는 $5마다 $1이라우땅. 지갑을 불려 두라우땅.
누렁이  $5마다 $1이 붙는다멍! 주인님 지갑은 제가 지키겠다멍!
이고야  $5마다 $1… 계산도 안 해봤지? 알려줘도 안 쓸 거면서~
느무보  이자는 보유금 $5당 $1입니다. 복리는 아니며, 블라인드 종료 시마다 정산됩니다.
이고지 EN  Kel'dan pen'ta — kel'dan unn Vor'nak shi'mela
이고지 KO  켈'단 펜'타 — 켈'단 운 보르'낙 시'멜라
```

### 이고지 alien lexicon

A fixed glossary is what makes the speech read as *"의미는 있는 말"*. Every 이고지
line MUST be built from it; do not invent a new token for a concept that already
has one. Extend the table (in this spec) if a new concept is needed.

The complete fixed orthography is below. Each Roman token maps to exactly one
Hangul token; changing or adding a token requires updating this table, both
locale rows, and the paired lexicon tests in the same change.

| Roman | Hangul | Roman | Hangul |
|---|---|---|---|
| `an'ka` | `안'카` | `ao` | `아오` |
| `ar'ti` | `아르'티` | `blin` | `블린` |
| `bou'nak` | `부'낙` | `chap'ta` | `챕'타` |
| `chi` | `치` | `del'vo` | `델'보` |
| `do'gan` | `도'간` | `em'ji` | `엠'지` |
| `fa'zen` | `파'젠` | `flu'sha` | `플루'샤` |
| `fon'ta` | `폰'타` | `glo'ba` | `글로'바` |
| `gru'vak` | `그루'바크` | `hol'na` | `홀'나` |
| `il'ma` | `일'마` | `ka'lith` | `카'리스` |
| `ka'shen` | `카'셨` | `kel'dan` | `켈'단` |
| `kon'su` | `콘'수` | `kre'sha` | `크레'샤` |
| `ku'ren` | `쿠'렌` | `lo'ren` | `로'렌` |
| `ma'run` | `마'룬` | `mi'ren` | `미'렌` |
| `mor'ka` | `모르'카` | `mul` | `물` |
| `nak'ta` | `낙'타` | `ne'sha` | `네'샤` |
| `nu` | `누` | `nu'kha` | `누'카` |
| `nu'ven` | `누'벤` | `ol'dan` | `올'단` |
| `ollu` | `올루` | `pa'tarn` | `파'타른` |
| `pen'ta` | `펜'타` | `qa'shi` | `카'시` |
| `re'rol` | `레'롤` | `reth` | `레스` |
| `se'la` | `세'라` | `sen'tal` | `센'탈` |
| `shen` | `셨` | `shi'mela` | `시'멜라` |
| `ta'wen` | `타'웬` | `thal` | `탈` |
| `tolun` | `톨룬` | `tor'un` | `토르'운` |
| `tri'un` | `트리'운` | `u'nizn` | `우'니즌` |
| `unn` | `운` | `vai` | `바이` |
| `vau'cha` | `바우'차` | `vell` | `벨` |
| `vok'tu` | `보크'투` | `vor` | `보르` |
| `vor'nak` | `보르'낙` | `zar'ka` | `자르'카` |
| `zin'ka` | `진'카` | `zk'tha` | `즈크'타` |
| `zor'ga` | `조르'가` | — | — |

The semantic lexicon and token order are language-neutral, but the approved
orthography is not: `en` uses the Roman tokens above and `ko` uses one fixed
Hangul transliteration per token. Marker kinds and placeholders remain aligned;
marker payloads are localized too (`[c:chi]` → `[c:치]`). There is still no
subtitle or ordinary-language translation.

### Line inventory

**23 voiced lines per mascot:**

| group | count | ids |
|---|---|---|
| run-end | 3 | `unlocked`, `won`, `discovery` |
| run-end tips | 8 | `tip.reroll`, `tip.discard`, `tip.shop`, `tip.0`…`tip.4` |
| encounters | 12 | `enc.<id>`, one per WooDak encounter below |

WooDak encounter ids (`src/ui/tutorial.ts` `ENCOUNTERS`, `mascot: 'woodak'`):
`firstGibberish`, `firstLetterHand`, `firstPattern`, `firstUnison`,
`firstRegisterSynergy`, `firstMaterial`, `firstFont`, `firstJoker`,
`firstConsumable`, `firstVoucher`, `pouchHover`, `firstBoss`. (`shopFirstVisit`
is the remaining encounter and belongs to Piyak, not to this set.)

Writing budget: 23 × 4 mascots × 2 languages = **184 strings**.

Two line sets are deliberately **out of scope**:

- `intro.step.*` (3 lines) — the guided intro only runs on a first profile where
  no unlock exists, so it is structurally always WooDak. Re-voicing is unreachable.
- `voice.piyak.*` — Piyak is a fixed role that is never re-skinned, and its
  existing copy is approved as-is. It only moves namespace.

## Part C — Voice routing (technical)

Only two call sites read mascot copy: `WooDakMascot.tsx:26` and
`TutorialPopup.tsx:49`.

**Chosen approach: a `voice.<skin>.<line>` namespace with a fallback chain.**
Rejected alternatives: per-mascot locale files (extra build wiring, hand-rolled
fallback) and skin resolution inside `t()` (makes i18n aware of mascots, a layer
violation).

### `src/ui/i18n.tsx`

`t` accepts a key **or an ordered array of keys**, returning the first key present
in the active language dict, then the English dict, then the raw last key. Every
existing `t('some.key')` call keeps working unchanged.

```ts
t: (key: string | string[], params?: TParams) => string
```

### `src/ui/mascots.ts`

`voicedKeys` is the **only** place that knows which skin is speaking. It reads the
live selection from storage, exactly as `mascotSrc` already does.

```ts
/** Fallback chain for a mascot-voiced line. Piyak is a fixed role; WooDak applies
 *  the player's selected skin and falls back to the default WooDak line whenever a
 *  skin has not written that line yet. */
export function voicedKeys(line: string, role: 'woodak' | 'piyak' = 'woodak'): string[]
```

- `role === 'piyak'` → `['voice.piyak.<line>']`
- selected skin `woodak` → `['voice.woodak.<line>']`
- selected skin `dog` → `['voice.dog.<line>', 'voice.woodak.<line>']`

A skin that is selected but no longer usable (unlock reset, missing art) must fall
back to `woodak`, matching `woodakArt`'s existing behaviour — reuse `isUsable`.

### Call sites

```tsx
// WooDakMascot.tsx — pickLine returns a bare line id ('won' | 'tip.reroll' | …)
const text = (won ? `${t(voicedKeys('won'))} ` : '') + t(voicedKeys(line.id), line.params);

// TutorialPopup.tsx — title is a term, not dialogue; only the body is voiced.
<p className="tut-body">{richText(t(voicedKeys(`enc.${active}`, mascot)))}</p>
```

`TutorialPopup` must default `mascot` to `'woodak'` when an encounter carries none
(every current encounter carries one, but the type allows it).

### Locale migration

```
woodak.won                    → voice.woodak.won
woodak.discovery              → voice.woodak.discovery
woodak.tip.{reroll,discard,shop,0..4}
                              → voice.woodak.tip.{…}
tutorial.<id>.body  (13 WooDak) → voice.woodak.enc.<id>
tutorial.shopFirstVisit.body    → voice.piyak.enc.shopFirstVisit
mascot.welcome.0..7             → voice.piyak.welcome.0..7

tutorial.<id>.title           ← stays (a term, not dialogue)
intro.step.*                  ← stays (first-run WooDak, unreachable by skins)

new: voice.{dog,ghost,alien,turtle}.{won,discovery,tip.*,enc.*}   23 lines each
     (alien shares one lexicon but uses Roman EN and fixed Hangul KO orthography)
```

`WooDakMascot.pickLine` currently returns full keys (`'woodak.tip.reroll'`); it
changes to return bare ids (`'tip.reroll'`) so `voicedKeys` can prefix them.
`GENERIC_TIPS = 5` stays as the `tip.0..4` pool size.

`ShopMascot` reads `mascot.welcome.N` and moves to
`t(voicedKeys(\`welcome.${n}\`, 'piyak'))`.

## Part D — Emoji Tile terminology (item 6)

Canonical display term: **이모지 타일 / Emoji Tile**; short form **이모지 / Emoji**
where space is tight. Engine identifiers are untouched.

| key | EN | KO |
|---|---|---|
| `collection.cat.jokers` | Jokers → **Emoji Tiles** | 조커 → **이모지 타일** |
| `shop.yourJokers` | Your jokers → **Your emoji tiles** | 보유 조커 → **보유 이모지 타일** |
| `shop.noJokers` | No jokers yet. → **No emoji tiles yet.** | 아직 조커가 없습니다. → **아직 이모지 타일이 없습니다.** |
| `pack.jokersFull` | Joker slots full → **Emoji tile slots full** | 조커 슬롯 가득 참 → **이모지 타일 슬롯 가득 참** |
| `tutorial.firstJoker.title` | Joker → **Emoji Tile** | 조커 → **이모지 타일** |

In-body mentions to rewrite while re-voicing: `voice.woodak.enc.firstJoker`,
`voice.woodak.tip.reroll`,
`voice.piyak.enc.shopFirstVisit`, `voice.piyak.welcome.3`.

`pack.type.joker` ("부적 팩" / "Charm Pack") is **unchanged** — it never surfaces
the word "joker". Locale keys themselves keep their `joker` spelling; they are
identifiers, not display text.

## Part E — Docs updated in the same change

Per the spec-conflict protocol, the docs land with the code.

- **`docs/GDD.md`** — §11 heading `Jokers (Emoji Tiles)` → `Emoji Tiles`; §11.8
  `Joker Editions (planned…)` → `Emoji Tile Editions (planned…)`; prose that uses
  "joker" as a *display* noun switches to "emoji tile" (references to the engine
  type `JokerDef`/`JokerEdition` stay). §13's mascot row gains the Egoya / Egoji /
  Nemubo display names.
- **`CLAUDE.md`** —
  - Terminology bullet gains: *"The display term for a joker is **Emoji Tile /
    이모지 타일** (GDD §11); the engine identifier stays `joker` (`JokerDef`,
    `src/engine/jokers/`, `BALANCE.jokerSlots`)."*
  - Mascot bullet gains: *"Mascot dialogue routes through `voicedKeys()`
    (`src/ui/mascots.ts`) — **never write a `voice.*` locale key at a call site**.
    Adding a mascot voice = adding `voice.<skin>.*` rows, and a missing line falls
    back to WooDak's. 이고지 (alien) speaks untranslated alien only, from the fixed
    lexicon in the 2026-07-23 spec; English uses Romanized tokens and Korean uses
    fixed Hangul transliterations, with no subtitle."*

## Testing

`tests/mascot-voice.test.ts`:

1. **Completeness** — every skin in `WOODAK_SKINS` other than the default has all
   23 line ids present in both `ko.json` and `en.json`.
2. **Fallback** — `voicedKeys('won')` for a non-default skin returns the skin key
   first and `voice.woodak.won` second; `t()` on a chain whose first key is absent
   returns the second key's string, not the raw key.
3. **Alien orthography** — all 23 Korean `voice.alien.*` strings differ from
   English, contain no ASCII letters after control markup/placeholders are removed,
   and use only the approved fixed Hangul transliteration for each English token.
4. **Alien structure + lexicon** — marker kinds and placeholders match between
   locales; every English token appears in the approved glossary and the fallback
   chain remains unchanged. This keeps the language self-consistent as lines are added.
5. **No orphans** — the set of `voice.*` line ids in the locales equals the set the
   code can request: `unlocked`, `won`, `discovery`, `tip.reroll|discard|shop|0..4`, and
   `enc.<id>` for exactly the ids in `ENCOUNTERS` with the matching `mascot` role.
6. **Migration completeness** — none of the retired keys (`woodak.*`,
   `mascot.welcome.*`, `tutorial.*.body`) remain in either locale file.

`tests/pack-tooltip.test.ts` and any test asserting the old display strings are
updated in the same pass.

## Out of scope

- Any engine rename (`JokerDef`, `src/engine/jokers/`, `BALANCE.jokerSlots`).
- `intro.step.*` re-voicing.
- Per-mascot audio or typographic treatment of "억양" — the request's 억양 is
  expressed through written register only in this bundle. A per-mascot bubble
  font/typing-speed treatment, if wanted, belongs in bundle E (motion/feel).
- Bundles B–E.
