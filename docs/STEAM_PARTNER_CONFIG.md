# Steam Achievement Partner Configuration

This is the manual-entry sheet for Steamworks Partner. The fixed API names and
thresholds in `desktop/steam-achievements.js` and GDD §14 remain authoritative.
If either changes, update this sheet in the same change.

Steamworks configuration reference:
[Stats and Achievements](https://partner.steamgames.com/doc/features/achievements).

## Stats

Use these common properties for all twenty rows:

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
| `single_hand_score` | `2147483647` | Best Single-Hand Score | 한 핸드 최고 점수 | 1ハンド最高スコア |
| `last_word_target` | `1` | Last-Word Target Reached | 마지막 핸드 목표 달성 | 最終ハンド目標達成 |
| `long_read` | `1` | Long Read Completed | 장문의 단어 완성 | 長文の単語達成 |
| `longform` | `1` | Longform Completed | 장편 원고 완성 | 長編原稿達成 |
| `perfect_syntax` | `1` | Perfect Syntax Completed | 완벽한 문장 완성 | 完璧な構文達成 |
| `emoji_effects_one_hand` | `150` | Distinct Emoji Effects in One Hand | 한 핸드 이모지 효과 수 | 1ハンド絵文字効果数 |
| `no_revisions` | `1` | No-Revisions Win | 무수정 승리 | 修正なし勝利 |
| `under_30_hands` | `1` | Win Within 30 Hands | 30핸드 이내 승리 | 30ハンド以内勝利 |
| `glass_destroyed_one_hand` | `68` | Glass Destroyed in One Hand | 한 핸드 유리 파괴 수 | 1ハンドガラス破壊数 |
| `fully_loaded_tile` | `1` | Fully Loaded Tile | 완전 강화 문자 타일 | 完全強化文字タイル |
| `pattern_run_max` | `2147483647` | Same-Pattern Run Maximum | 동일 패턴 런 최고 횟수 | 同一パターン最大回数 |
| `word_hand_run_max` | `2147483647` | Same-Word-Hand Run Maximum | 동일 단어 족보 런 최고 횟수 | 同一ワードハンド最大回数 |

The finite collection maxima remain 14 Pouches, 8 Records, 14×8 Pouch–Record
pairs, 6 Challenges, 150 Emoji Tiles, and 150×8 Record-sticker tiers. Boolean
achievement stats use max 1; the one-hand Glass maximum is the 68-tile Pouch.

## Achievements

Use these common properties for every row:

- Set By: `Client`
- Hidden: `No`
- Progress Stat and Unlock Value: exactly as listed below
- Achieved and unachieved icons: language-neutral

`ACH_CHALLENGE_ACCEPTED` and `ACH_SIX_ASSIGNMENTS` are prepared but held from
release until Challenge starts are available in production. Keep their stats,
localization, and icons ready; do not publish the two achievements before then.

The ready-to-import Japanese, Simplified Chinese, Traditional Chinese, Brazilian Portuguese, German, Spanish, French, Russian, Polish, and Turkish achievement tokens live in
`steam/achievement-localization/achievement_loc_japanese.vdf` and
`steam/achievement-localization/achievement_loc_schinese.vdf`, and
`steam/achievement-localization/achievement_loc_tchinese.vdf`, and
`steam/achievement-localization/achievement_loc_brazilian.vdf`, and
`steam/achievement-localization/achievement_loc_german.vdf`, and
`steam/achievement-localization/achievement_loc_spanish.vdf`, and
`steam/achievement-localization/achievement_loc_french.vdf`,
`steam/achievement-localization/achievement_loc_russian.vdf`,
`steam/achievement-localization/achievement_loc_polish.vdf`,
`steam/achievement-localization/achievement_loc_turkish.vdf`, alongside the
existing Korean VDF. Keep all eleven synchronized with the table below. The
Simplified Chinese stat display names are 标准游戏完成数, 标准游戏胜利数,
获胜字袋数, 获胜唱片数, 获胜字袋–唱片组合数, 已完成挑战数,
已贴纸表情牌数, and 唱片贴纸等级数, in table order.

Steamworks upload-ready copies for all twelve supported languages, including English and Korean, live in
`steam/achievement-localization/ready-to-upload/` and use the AppID filename format
`<AppID>_loc_<language>.vdf`. Each file contains the complete ordered token range
`NEW_ACHIEVEMENT_9_0` through `NEW_ACHIEVEMENT_9_29`.

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
| `ACH_TEN_THOUSAND` | 10K Draft | 만 자의 원고 | 一万字の原稿 | Score 10,000 points in a single hand. | 한 핸드에서 10,000점 이상 획득하세요. | 1回のハンドで10,000点以上獲得する。 | `single_hand_score` | `10000` |
| `ACH_MILLION_SELLER` | Million Seller | 밀리언셀러 | ミリオンセラー | Score 1,000,000 points in a single hand. | 한 핸드에서 1,000,000점 이상 획득하세요. | 1回のハンドで1,000,000点以上獲得する。 | `single_hand_score` | `1000000` |
| `ACH_WORLDWIDE_EDITION` | Worldwide Hit | 세계적인 대히트 | 世界的大ヒット | Score 100,000,000 points in a single hand. | 한 핸드에서 100,000,000점 이상 획득하세요. | 1回のハンドで100,000,000点以上獲得する。 | `single_hand_score` | `100000000` |
| `ACH_THE_LAST_WORD` | The Last Word | 마지막 한마디 | 最後の一言 | Reach the round's target score with your final remaining hand. | 마지막 남은 핸드에서 라운드 목표 점수를 돌파하세요. | 残り最後のハンドでラウンドの目標スコアに到達する。 | `last_word_target` | `1` |
| `ACH_LONG_READ` | Long Read | 장문의 단어 | 長文の単語 | Complete a valid sentence using a word with 10 or more letters. | 10글자 이상의 단어를 사용해 유효한 문장을 완성하세요. | 10文字以上の単語を使って有効な文を完成する。 | `long_read` | `1` |
| `ACH_LONGFORM` | Longform | 장편 원고 | 長編原稿 | Complete a valid sentence containing 6 or more words. | 6단어 이상의 유효한 문장을 완성하세요. | 6語以上の有効な文を完成する。 | `longform` | `1` |
| `ACH_PERFECT_SYNTAX` | Perfect Syntax | 완벽한 문장 | 完璧な構文 | Complete a highest-tier sentence pattern. | 최고 단계 문장 형식을 완성하세요. | 最高ランクの文型を完成する。 | `perfect_syntax` | `1` |
| `ACH_EMOTIONAL_OVERFLOW` | Emotional Overflow | 감정 과잉 | 感情過多 | Trigger 5 or more different Emoji effects in a single hand. | 한 핸드에서 서로 다른 이모지 효과를 5개 이상 발동하세요. | 1回のハンドで異なる絵文字タイル効果を5種類以上発動する。 | `emoji_effects_one_hand` | `5` |
| `ACH_NO_REVISIONS` | No Revisions | 수정 없이 출판 | 修正なしで出版 | Win a Standard Run without rerolling the shop or boss. | 상점을 새로고침하거나 보스를 재추첨하지 않고 일반 런에서 승리하세요. | ショップをリロールせず、ボスも再抽選せずに通常ランに勝利する。 | `no_revisions` | `1` |
| `ACH_BEAT_THE_DEADLINE` | Beat the Deadline | 마감 시간 준수 | 締切厳守 | Win a Standard Run within 30 hands. | 30핸드 이내로 일반 런에서 승리하세요. | 30ハンド以内に通常ランに勝利する。 | `under_30_hands` | `1` |
| `ACH_FRAGILE_BE_CAREFUL` | Fragile—Handle with Care! | 깨지기 쉬우니 조심! | 取扱注意！ | Destroy 2 or more Glass Tiles in a single hand. | 한 핸드에서 유리 타일을 2개 이상 파괴하세요. | 1回のハンドでガラスタイルを2枚以上破壊する。 | `glass_destroyed_one_hand` | `2` |
| `ACH_FULLY_LOADED_TILE` | Fully Loaded | 완전한 한 글자 | 完全装備 | Apply material, font, and edition enhancements to a single Letter Tile. | 하나의 문자 타일에 재질, 폰트, 에디션 강화를 모두 적용하세요. | 1枚の文字タイルに素材、フォント、エディションの強化をすべて適用する。 | `fully_loaded_tile` | `1` |
| `ACH_PATTERN_SPECIALIST` | Pattern Specialist | 패턴 전문가 | パターン専門家 | Use the same Letter Pattern 20 times in a single Standard Run. | 하나의 일반 런에서 동일한 문자 패턴을 20회 사용하세요. | 1回の通常ランで同じ文字パターンを20回使う。 | `pattern_run_max` | `20` |
| `ACH_WORD_HAND_SPECIALIST` | One-Trick Wordsmith | 한 우물만 파기 | 一筋の言葉職人 | Use the same Word Hand 50 times in a single Standard Run. | 하나의 일반 런에서 동일한 단어 족보를 50회 사용하세요. | 1回の通常ランで同じワードハンドを50回使う。 | `word_hand_run_max` | `50` |

## Icon brief

Steam upload files are `256x256` RGB JPGs. Steam accepts icons down to `64x64`,
but the larger size is the recommended authoring target. Lossless PNG sources
live in `steam/graphical-assets/source/achievements/`; the 60 upload files live
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
| `ACH_TEN_THOUSAND` | Printing press producing a bright `10K` manuscript | Gray press and manuscript |
| `ACH_MILLION_SELLER` | Bestseller on a press with a bright `1M` seal | Gray bestseller and press |
| `ACH_WORLDWIDE_EDITION` | Open book wrapped around a bright globe | Gray book and globe |
| `ACH_THE_LAST_WORD` | Final manuscript landing on its target line | Gray final manuscript and empty tray |
| `ACH_LONG_READ` | Long accordion manuscript with ten letter blocks | Gray folded manuscript |
| `ACH_LONGFORM` | Six linked manuscript pages | Six gray pages with no celebratory accents |
| `ACH_PERFECT_SYNTAX` | Gold syntax tree joining word blocks | Gray syntax tree without success check |
| `ACH_EMOTIONAL_OVERFLOW` | Five distinct Emoji Tile silhouettes bursting from a hand | Five subdued gray silhouettes |
| `ACH_NO_REVISIONS` | Clean manuscript passing an untouched revision control | Gray manuscript and inactive control |
| `ACH_BEAT_THE_DEADLINE` | Stopwatch and manuscript with thirty hand marks | Gray stopwatch with unlit marks |
| `ACH_FRAGILE_BE_CAREFUL` | Two Glass Letter Tiles shattering together | Two gray cracked tiles |
| `ACH_FULLY_LOADED_TILE` | Letter Tile with material, font, and edition badges | Gray tile with inactive badges |
| `ACH_PATTERN_SPECIALIST` | Twenty registration marks converging on one pattern | Gray pattern with unlit marks |
| `ACH_WORD_HAND_SPECIALIST` | Repeated Word Hands feeding one press with fifty marks | Gray press with unlit marks |

## Publish check

1. Verify every API name, Progress Stat, and Unlock Value against
   `desktop/steam-achievements.js`.
2. Upload all 30 achieved and 30 unachieved icons and inspect them at Steam's
   smallest preview size.
3. Preview English, Korean, Japanese, Simplified Chinese, Traditional Chinese, Brazilian Portuguese, German, Spanish, French, Russian, Polish, and Turkish independently; check truncation and punctuation.
4. In Store Page Info, select `Steam Achievements` under `Supported Features`.
5. Publish the stat, achievement, and Store Page Info changes before assigning
   the beta BuildID.
