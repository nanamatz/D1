# Steam Achievement Partner Configuration

This is the manual-entry sheet for Steamworks Partner. The fixed API names and
thresholds in `desktop/steam-achievements.js` and GDD §14 remain authoritative.
If either changes, update this sheet in the same change.

Steamworks configuration reference:
[Stats and Achievements](https://partner.steamgames.com/doc/features/achievements).

## Stats

Use these common properties for all eight rows:

- Type: `INT`
- Set By: `Client`
- Default: `0`
- Min: `0`
- Increment Only: `Yes`
- Max Change: blank (legacy claims, three-profile aggregation, and Cloud restore
  may legitimately jump by more than one)
- Aggregated: `No`

| API Name | Max | Display Name (English) | Display Name (Korean) | Display Name (Japanese) |
|---|---:|---|---|---|
| `std_runs` | `2147483647` | Standard Runs Finished | 완료한 일반 런 | 標準ラン完了数 |
| `std_wins` | `2147483647` | Standard Runs Won | 승리한 일반 런 | 標準ラン勝利数 |
| `pouches_won` | `14` | Winning Pouches | 승리한 주머니 종류 | 勝利したポーチの種類 |
| `records_won` | `8` | Winning Records | 승리한 레코드 종류 | 勝利したレコードの種類 |
| `pouch_record_pairs` | `112` | Winning Pouch–Record Pairs | 승리한 주머니–레코드 조합 | 勝利したポーチ・レコードの組み合わせ |
| `challenges_completed` | `6` | Challenges Completed | 완료한 챌린지 | 完了したチャレンジ |
| `emoji_mastered` | `150` | Stickered Emoji Tiles | 스티커를 얻은 이모지 타일 | ステッカー獲得済み絵文字タイル |
| `emoji_record_sticker_tiers` | `1200` | Record Sticker Tiers | 레코드 스티커 단계 | レコードステッカー段階 |

The finite maxima are 14 Pouches, 8 Records, 14×8 Pouch–Record pairs,
6 Challenges, 150 Emoji Tiles, and 150×8 Record-sticker tiers.

## Achievements

Use these common properties for every row:

- Set By: `Client`
- Hidden: `No`
- Progress Stat and Unlock Value: exactly as listed below
- Achieved and unachieved icons: language-neutral

The ready-to-import Japanese, Simplified Chinese, Traditional Chinese, Brazilian Portuguese, German, Spanish, French, and Russian achievement tokens live in
`steam/achievement-localization/achievement_loc_japanese.vdf` and
`steam/achievement-localization/achievement_loc_schinese.vdf`, and
`steam/achievement-localization/achievement_loc_tchinese.vdf`, and
`steam/achievement-localization/achievement_loc_brazilian.vdf`, and
`steam/achievement-localization/achievement_loc_german.vdf`, and
`steam/achievement-localization/achievement_loc_spanish.vdf`, and
`steam/achievement-localization/achievement_loc_french.vdf`,
`steam/achievement-localization/achievement_loc_russian.vdf`, alongside the
existing Korean VDF. Keep all nine synchronized with the table below. The
Simplified Chinese stat display names are 标准游戏完成数, 标准游戏胜利数,
获胜字袋数, 获胜唱片数, 获胜字袋–唱片组合数, 已完成挑战数,
已贴纸表情牌数, and 唱片贴纸等级数, in table order.

| API ID | English name | Korean name | Japanese name | English description | Korean description | Japanese description | Progress Stat | Unlock Value |
|---|---|---|---|---|---|---|---|---:|
| `ACH_FIRST_DRAFT` | First Draft | 첫 원고 | 初稿 | Finish 1 standard run. | 일반 런을 1회 끝내세요. | 標準ランを1回完了する | `std_runs` | `1` |
| `ACH_REGULAR_COLUMN` | Regular Column | 정기 연재 | 定期連載 | Finish 10 standard runs. | 일반 런을 10회 끝내세요. | 標準ランを10回完了する | `std_runs` | `10` |
| `ACH_PUBLISHED` | Published! | 출간! | 出版！ | Win 1 standard run. | 일반 런에서 1회 승리하세요. | 標準ランで1回勝利する | `std_wins` | `1` |
| `ACH_TEN_PRINTINGS` | Tenth Printing | 10쇄 달성 | 第10刷 | Win 10 standard runs. | 일반 런에서 10회 승리하세요. | 標準ランで10回勝利する | `std_wins` | `10` |
| `ACH_TWENTY_FIVE_PRINTINGS` | Twenty-Fifth Printing | 25쇄 달성 | 第25刷 | Win 25 standard runs. | 일반 런에서 25회 승리하세요. | 標準ランで25回勝利する | `std_wins` | `25` |
| `ACH_PACK_LIGHT` | Pack Light | 가볍게 꾸리기 | 身軽な旅 | Win standard runs with 3 different Starting Pouches. | 서로 다른 시작 주머니 3종으로 일반 런에서 승리하세요. | 3種類の開始ポーチで標準ランに勝利する | `pouches_won` | `3` |
| `ACH_POUCH_CABINET` | Pouch Cabinet | 주머니 장식장 | ポーチ棚 | Win standard runs with 7 different Starting Pouches. | 서로 다른 시작 주머니 7종으로 일반 런에서 승리하세요. | 7種類の開始ポーチで標準ランに勝利する | `pouches_won` | `7` |
| `ACH_WORLD_IN_A_BAG` | World in a Bag | 주머니 속 세계 | 袋の中の世界 | Win standard runs with all 14 Starting Pouches. | 시작 주머니 14종 모두로 일반 런에서 승리하세요. | 全14種類の開始ポーチで標準ランに勝利する | `pouches_won` | `14` |
| `ACH_B_SIDE` | B-Side | B면 | B面 | Win standard runs with 4 different Records. | 서로 다른 레코드 4종으로 일반 런에서 승리하세요. | 4種類のレコードで標準ランに勝利する | `records_won` | `4` |
| `ACH_FULL_DISCOGRAPHY` | Full Discography | 전 음반 수집 | 完全版ディスコグラフィ | Win standard runs with all 8 Records. | 레코드 8종 모두로 일반 런에서 승리하세요. | 全8種類のレコードで標準ランに勝利する | `records_won` | `8` |
| `ACH_CROSS_PRESS` | Cross-Press | 교차 인쇄 | クロスプレス | Win with 16 different Starting Pouch–Record combinations. | 서로 다른 시작 주머니–레코드 조합 16개로 일반 런에서 승리하세요. | 16種類の開始ポーチ・レコードの組み合わせで勝利する | `pouch_record_pairs` | `16` |
| `ACH_CHALLENGE_ACCEPTED` | Challenge Accepted | 도전 수락 | 挑戦受諾 | Complete 1 Challenge. | 챌린지 1개를 완료하세요. | チャレンジを1つ完了する | `challenges_completed` | `1` |
| `ACH_SIX_ASSIGNMENTS` | Six Assignments | 여섯 과제 | 六つの課題 | Complete all 6 Challenges. | 챌린지 6개를 모두 완료하세요. | 6つすべてのチャレンジを完了する | `challenges_completed` | `6` |
| `ACH_FIRST_PROOF` | First Proof | 첫 교정쇄 | 初校 | Earn a Record sticker for an Emoji Tile. | 이모지 타일 하나에 레코드 스티커를 획득하세요. | 絵文字タイルでレコードステッカーを1つ獲得する | `emoji_mastered` | `1` |
| `ACH_EMOJI_BOARD` | Emoji Board | 이모지 게시판 | 絵文字ボード | Earn Record stickers for 25 different Emoji Tiles. | 서로 다른 이모지 타일 25개에 레코드 스티커를 획득하세요. | 25種類の絵文字タイルでレコードステッカーを獲得する | `emoji_mastered` | `25` |
| `ACH_STICKER_ALBUM` | Sticker Album | 스티커 앨범 | ステッカーアルバム | Collect 100 total Record-sticker tiers across Emoji Tiles. | 이모지 타일의 레코드 스티커 단계를 합계 100단계 모으세요. | 絵文字タイル全体でレコードステッカー段階を合計100集める | `emoji_record_sticker_tiers` | `100` |

## Icon brief

Steam upload files are `256x256` RGB JPGs. Steam accepts icons down to `64x64`,
but the larger size is the recommended authoring target. Lossless PNG sources
live in `steam/graphical-assets/source/achievements/`; the 32 upload files live
in `steam/graphical-assets/ready-to-upload/achievements/` and use the API ID
plus `_achieved` / `_unachieved` suffixes.

Create square pixel-art masters with hard nearest-neighbor edges. Use the
project's deep navy ground and an off-white/red/yellow/cyan-led 3–5-color
palette. Prefer one large publishing-themed silhouette with sparse crop marks,
registration marks, or CRT scanlines. Do not use gradients, soft shadows,
photo texture, Steam logos, third-party characters, maze layouts, or copied
arcade sprites.

Achieved icons are colorful. The unachieved icon must keep the same composition
in charcoal/gray, omit the success mark, and remain fully grayscale. Do not
replace it with an unrelated lock. Every name and icon must remain appropriate
for all ages and audiences under Steam's
[community content guidelines](https://help.steampowered.com/faqs/view/6862-8119-C23E-EA7B).

| API ID | Achieved icon | Unachieved icon |
|---|---|---|
| `ACH_FIRST_DRAFT` | One manuscript entering a press with a red proof check | Gray manuscript with the check empty |
| `ACH_REGULAR_COLUMN` | Large `10` type block over repeating column tabs | Gray outline `10` and column tabs |
| `ACH_PUBLISHED` | One book leaving a press with an approval seal | Dark closed press and empty seal |
| `ACH_TEN_PRINTINGS` | Book-spine stack with a central `10` type block | Dark stack and outline `10` |
| `ACH_TWENTY_FIVE_PRINTINGS` | Wide print stack with a large `25` type block | Gray print stack and outline `25` |
| `ACH_PACK_LIGHT` | Three Pouches aligned on a travel tag | Three hollow gray Pouches |
| `ACH_POUCH_CABINET` | Seven-bin type cabinet with Pouch handles | Empty seven-bin gray cabinet |
| `ACH_WORLD_IN_A_BAG` | Pixel globe and colored type rising from an open Pouch | Closed Pouch with a faint globe outline |
| `ACH_B_SIDE` | Flipped Record with a `B` label and four bold progress ticks | Gray Record with empty ticks |
| `ACH_FULL_DISCOGRAPHY` | Eight Records fanned from a storage sleeve | Empty sleeve with eight gray outlines |
| `ACH_CROSS_PRESS` | Crossed Pouch cord and Record spindle behind a press, with 4×4 registration dots | Gray crossed silhouette with unlit dots |
| `ACH_CHALLENGE_ACCEPTED` | Red pencil making one bold check on an assignment | Unchecked assignment and gray pencil |
| `ACH_SIX_ASSIGNMENTS` | Editorial clipboard with six bold checks | Gray clipboard with six empty boxes |
| `ACH_FIRST_PROOF` | Emoji Tile silhouette with one Record sticker | Dark tile with an empty sticker ring |
| `ACH_EMOJI_BOARD` | Bright 5×5 editorial board of stickered tiles | Empty gray 5×5 board |
| `ACH_STICKER_ALBUM` | Open album with colored Record stickers and a large `100` seal | Empty sticker spaces and outline `100` seal |

## Publish check

1. Verify every API name, Progress Stat, and Unlock Value against
   `desktop/steam-achievements.js`.
2. Upload all 16 achieved and 16 unachieved icons and inspect them at Steam's
   smallest preview size.
3. Preview English, Korean, Japanese, Simplified Chinese, Traditional Chinese, Brazilian Portuguese, German, Spanish, French, and Russian independently; check truncation and punctuation.
4. In Store Page Info, select `Steam Achievements` under `Supported Features`.
5. Publish the stat, achievement, and Store Page Info changes before assigning
   the beta BuildID.
