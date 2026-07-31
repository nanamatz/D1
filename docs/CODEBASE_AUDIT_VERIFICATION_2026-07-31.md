# 전면 코드베이스 감사 검증본 — 2026-07-31

> 범위: `src/engine`, `src/ui`, `src/sim`, `tests`, `data`, `locales`,
> `desktop`, 빌드 산출물과 핵심 설계 문서
>
> 최초 감사 단계에서는 문서화만 수행했다. 이후 사용자의 순차 진행 지시에
> 따라 확정 결함을 수정했으며, 아래 1~9절은 발견 당시의 근거와 baseline,
> **10절은 수정 결과와 최종 재검증**을 기록한다.
>
> 같은 날짜의 미추적 초안 `docs/AUDIT-2026-07-31.md`가 검토 도중
> 별도로 발견됐다. 사용자 변경 가능성이 있어 덮어쓰지 않았으며, 이 문서는
> 현재 코드와 명령 실행 결과를 다시 대조한 독립 검증본이다.

## 1. 결론

전체 테스트와 일반 빌드는 건강하지만, 그것만으로 출시 무결성을 보장하지는
못한다. 가장 먼저 처리할 항목은 다음 네 가지다.

1. **엔진 순환 의존성:** 테스트와 일반 autoplay는 통과하지만, Emoji Tile
   레지스트리를 Node에서 직접 import하거나 `sim:emoji-sample`을 실행하면
   초기화 순서 오류로 즉시 종료된다. “headless engine” 계약의 실제 위반이다.
2. **설정값 손상 경로:** `useSettings()` 인스턴스들이 서로 동기화되지 않아,
   Options에서 바꾼 값을 오래 살아 있는 App 인스턴스가 fullscreen 이벤트 때
   과거 객체로 다시 덮어쓸 수 있다. 이전 버전의 부분 설정 객체도 기본값과
   병합되지 않는다.
3. **툴팁 단일 계약 위반:** 카드와 문자 타일이 서로 다른 portal/위치/표시
   구현을 쓰며, 키보드 focus로는 두 구현 모두 툴팁을 열지 못한다.
4. **Reduced Motion 불완전:** 인게임 토글을 보는 코드와 OS 미디어 쿼리만
   보는 코드가 나뉘어, 토글을 켜도 settle·카운트업·토마토 idle 등이 계속
   움직인다.

성능에서 가장 큰 확정 비용은 한 개로 몰린 초기 JS와 배포 에셋이다. VFX나
문장 판정 알고리즘보다 먼저 폰트 subset, 1024px Voucher PNG, 대형 path SVG,
화면 단위 code split을 처리하는 편이 효과가 크다.

밸런스는 **이상 징후는 있지만 즉시 수치를 고칠 근거는 부족하다.** 현재
시뮬레이터는 단일 블라인드 또는 “모든 타일이 같은 재질” 같은 극단 조건을
측정한다. 8 Chapter 전체에서 상점·팩·슬롯·구매 전략까지 포함한 성공률
시뮬레이터가 먼저 필요하다.

## 2. 기준선과 감사 방법

### 2.1 실행 결과

| 검증 | 결과 |
|---|---|
| `npm test -- --reporter=dot` | **89 files / 778 tests 통과** |
| `npm run build` | 성공 |
| Vite JS | **2,306.65 kB raw / 411.09 kB gzip**, 단일 chunk 경고 |
| Vite CSS | **328.46 kB raw / 90.59 kB gzip** |
| `dist/assets` | **827 files / 72.60 MiB** |
| 그중 이미지 | **38.90 MiB PNG + 21.92 MiB SVG** |
| 그중 폰트 | **5.22 MiB WOFF + 4.04 MiB WOFF2** |
| `npm run sim` | 정상 실행 |
| `npm run sim:emoji-sample` | **실패** — `RARE_JOKERS` TDZ 오류 |
| 직접 `import './src/engine/jokers/index.ts'` | **동일 실패** |

빌드 경고와 실패 명령은 이 보고서의 성능/무결성 우선순위에 반영했다.

### 2.2 레지스트리·로케일 교차검증

| 대상 | 코드 실측 | 판정 |
|---|---:|---|
| Emoji Tiles | 116 = 24 Common + 42 Uncommon + 45 Rare + 5 Legendary | 정상 |
| Bosses | 16 = 일반 12 + finisher 4 | 정상 |
| Starting Pouches | 14 | 정상 |
| Records | 8 | 정상 |
| Vouchers | 32 | 정상 |
| Fables / Constellations / 구현 Gambler | 18 / 12 / 12 | 정상 |
| locale keys | en 903 / ko 903 | 누락·고아 없음 |
| 툴팁 강조 태그 | 264개 설명 행 비교 | en/ko 태그 종류 불일치 0 |

레지스트리 ID와 설명 키 사이의 **직접적인 데이터 누락은 발견하지 못했다.**
이 점은 현재 코드베이스의 강점이다.

### 2.3 판정 표기

- **P0:** 실행 불능, 저장 손상, 핵심 아키텍처 계약 위반
- **P1:** 사용자에게 반복 노출되거나 출시 품질/성능에 큰 영향
- **P2:** 조건부 결함, 유지보수 위험, 낮은 빈도의 오동작
- **P3:** 정리 후보. 측정 없이 먼저 손댈 필요는 없음
- **재현:** 명령이나 직렬화 결과로 직접 확인
- **확정:** 코드와 문서의 정적 대조로 확인
- **검증 필요:** 이상 징후는 있으나 실제 플레이 분포 데이터가 더 필요

## 3. 문서 충돌과 확정 결정

### SPEC-01 · 중복 Emoji Tile 예외 — 해결됨 (2026-07-31)

- `docs/GDD.md` §9.2는 **Copy Editor**를 중복 제안/획득의 명시적 예외로
  규정한다.
- 같은 문서 §10.3의 **Boar**도 보유 타일 복사를 명시적 예외로 규정한다.
- 코드 `src/engine/vouchers.ts:211-213`과 테스트
  `tests/promoted-jokers.test.ts:103-109`는 Copy Editor 예외를 구현·보호한다.

**확정:** Copy Editor와 Boar를 현재 규칙의 두 명시적 예외로 유지한다.
Copy Editor는 보유 중 공용 gate를 완화하는 지속 효과이고, Boar는 다른 보유
타일을 파괴하며 한 종류만 복제하는 일회성 효과다. 프로젝트 지침과 구현 전
상태를 가리키던 GDD/코드 주석을 이 결정에 맞춰 수정했다.

### SPEC-02 · 저장소 문서 드리프트 — P1 문서

- `CLAUDE.md:8`은 아직 “30 authored definitions”지만 GDD와 코드는 116이다.
- `CLAUDE.md:27`은 일반 Boss 12만 기술하고 finisher 4와 Endless 규칙을
  누락한다.
- `docs/REFACTORING.md` 마지막은 “테스트 3개 실패, tsc 1개 오류”라고 적지만
  현재는 778/778 통과 및 build 성공이다.
- `data/README.md`는 여전히 “dev stub” 한 줄뿐이지만 실제 데이터는 약
  30k 단어의 baked table이다.
- `desktop/main.js`는 1440×912 board라고 설명하지만
  `tokens.css`의 현재 `--board-h`는 965px이다. `tokens.css` 안에도 아직
  “~790px tall”이라는 오래된 주석이 남아 있다.

수치와 상태를 바꾸지 않고 문서만 현재 GDD/코드에 맞추는 작업이다.

## 4. 통일성 감사

### 4.1 툴팁 용어·문장 구조·강조

#### 잘 통일된 부분

- 카드 효과 본문은 `src/ui/descriptions.ts`의 공용 helper를 통해 shop,
  shelf, opened pack, Collection에서 재사용한다.
- 돈, Chips, Mult, Gibberish 등의 의미 강조는 `richtext.tsx` 한 파서가
  처리한다.
- en/ko 264개 설명 행에서 강조 태그 종류가 일치한다.
- 설명 영역에서 예전 표시 용어 `Joker`, `Charm card`, `보따리`, `조커`,
  `부적 카드`가 남은 사례는 찾지 못했다.
- 공용 카드 툴팁과 문자 타일 툴팁 모두 `document.body` portal을 사용하여
  피사체의 font/material 스타일을 상속하지 않는다.

#### TOOLTIP-01 · “One shared component” 계약 위반 — P1, 확정

`docs/screens-spec.md` §0은 모든 객체가 **한 공용 컴포넌트**를 사용해야
한다고 명시한다. 실제로는 다음 두 구현이 있다.

- 카드: `src/ui/components/Tooltip.tsx`
- 문자 타일: `src/ui/components/Tile.tsx:117-243` 안의 별도 portal,
  위치 상태, title/body markup

그 결과 이미 동작이 갈렸다.

- 카드 툴팁은 hover 중 매 frame 위치를 다시 읽는다.
- 문자 타일 툴팁은 pointer enter 시 위치를 한 번만 읽는다.
- 둘 다 `onFocus`로 열리지 않아 keyboard focus에서 툴팁이 보이지 않는다.
- `screens.css`의 `.tile-tt` compact 규칙은 실제 렌더 class
  `.tile-tt-portal`과 다르므로 적용되지 않는다.
- `.tile:hover .tile-tt`와 `.tile:focus-visible .tile-tt`도 portal 구조에서는
  죽은 selector다.

**처리:** 공용 `Tooltip`에 anchor element/ref와 compact tile variant를
추가하고 `TileView`도 그 경로를 사용한다. pointer와 keyboard 입력을 구분해
`focus-visible`일 때는 열되 pointer click focus가 잔류시키지 않게 한다.
죽은 `.tile-tt` selector는 통합 뒤 삭제한다.

#### TOOLTIP-02 · Pouch dock은 키보드로 열 수 없음 — P1, 확정

`BagWidget`의 `.pouch-widget`은 Pouch 이미지를 렌더하지만 공용 Tooltip이
없고, `div`에 `aria-expanded`만 둔 채 `role`, `tabIndex`, keyboard handler가
없다. mouse hover는 상세 modal을 열지만 keyboard 사용자는 객체에 도달할 수
없다. “Starting Pouch가 렌더되는 모든 surface는 hover/cursor reaction과
tooltip을 가진다”는 전역 계약의 예외다.

**처리:** dock을 실제 `button`으로 만들고 hover/focus 모두 같은 상세
surface를 열게 한다. modal과 tooltip을 동시에 띄우지 않도록 dock의 상세
표현을 어느 쪽으로 통일할지는 UI 문서에 한 줄 명시한다.

#### COPY-01 · 문장 종결 규칙이 도메인/언어마다 다름 — P2, 확정

| 설명군 | en | ko |
|---|---:|---:|
| `jokerdesc` 116 | 종결 부호 0 | 0 |
| `voucherdesc` 32 | 0 | 0 |
| `bossdesc` 16 | 0 | **16** |
| `packdesc` 5 | **5** | **5** |
| `consumabledesc` 43 | 30 / 없음 13 | 30 / 없음 13 |

ko Boss만 전부 `~합니다.` 문장이고, 대부분의 다른 효과 설명은 짧은
명사형/서술형 단편이다. `consumabledesc`의 무종결 13개는 Constellation
12개와 Magnifier다. Constellation 12개는 현재
`consumableTooltipBody()`가 `pack.constellationLevels`로 대체하므로 런타임에
쓰이지 않는 중복 번역이기도 하다.

**권장 규칙:** 객체 효과 툴팁은 en/ko 모두 종결 부호 없는 짧은 효과문,
pack 소개처럼 2~3문장인 설명만 마침표를 사용한다. Constellation의 죽은
`consumabledesc.*` 24개 행은 삭제하거나 실제 단일 source로 되돌린다.

#### COPY-02 · 수치 강조가 일부 설명에서 빠짐 — P2, 확정

마크업을 제거한 뒤에도 수치 delta가 평문으로 남는 설명은 en 20개,
ko 17개다. 대표 사례:

- `bossdesc.historyBook`: `−2 phases`
- `bossdesc.budgetBook`: `Hand size −3`
- `voucherdesc.memo` / `notebook`: `+1 phase`
- `voucherdesc.catalog` / `couponBook`: `+1 slot`, `3/4 total`
- `voucherdesc.yearBook`: `×1.5`
- `record.blueLp.desc` 등 Record penalty 수치

같은 성격의 돈/Chips/Mult에는 이미 의미 색이 적용되므로 시각 계층이
들쭉날쭉하다.

**처리:** `+/- count`는 `[n:]`, Mult는 `[m:]`, Chips는 `[c:]`, 돈은
`[$:]`로 태깅한다. 모든 숫자를 자동 강조하지 말고 “게임 규칙을 바꾸는
수치”만 대상으로 하는 locale lint를 추가한다.

#### COPY-03 · 한국어 미번역 1건 — P2, 확정

`boss.notAllowed`가 en/ko 모두 `Not Allowed`다. zero-score Boss의 tile tag와
status notice에 직접 노출된다. 한국어를 `플레이 불가` 또는 GDD에서 확정한
표현으로 바꿔야 한다.

#### TOOLTIP-03 · 폭 정책 주석과 구현이 반대 — P3, 확정

`tokens.css:97-104`는 `--tt-w: 280px`을 “fixed width, not max”라고 설명하지만
`screens.css:48-56`은 `width: max-content; max-width: var(--tt-w)`를 사용한다.
`UI_DESIGN.md`도 280px **maximum**이라고 적는다. 런타임 구현이 GDD 계열
문서와 일치하므로 token 주석을 고치면 된다.

### 4.2 UI 컴포넌트 크기

핵심 객체 크기는 대체로 문서와 일치한다.

| 객체 | 현재 규칙 | 판정 |
|---|---|---|
| Letter Tile | 64×64px | 문서 일치 |
| Mini Letter Tile | 36×36px | 의도된 compact variant |
| Emoji Tile / held consumable / Voucher / 일반 shop card | `--shop-card-w/h` = 124×165px | 통일됨 |
| Shop sale pack | 131×229px | 문서화된 예외 |
| Collection pack | 81×132px | 문서화된 예외 |
| Pouch | dock 72, New Run 140, Collection 176 | 문서화된 context size |
| Record | New Run 88×88px | 문서 일치 |
| 핵심 action button | `--shop-action-h` = 44px | Buy/Open/Use에 적용 |

124×165는 CSS에 raw 숫자로 반복되지 않고 token을 27곳에서 재사용한다.
따라서 “모든 컴포넌트가 크기 규칙 없이 제각각”인 상태는 아니다.

다만 Tile, pack, Pouch, Record의 context별 크기는 아직 raw px다.
새 surface 추가 시 drift를 막기 위해 `--tile-size`, `--pack-sale-*`,
`--pack-collection-*`, `--pouch-dock-*` 정도만 token화하면 충분하다.
모든 숫자를 design-token abstraction으로 옮기는 것은 과하다.

### 4.3 기능 밸런스

#### BALANCE-01 · 재질 극단 조건에서 Brass와 골드 재질이 큰 이상치 — P1, 검증 필요

`npm run sim:materials`의 500회 결과:

| 재질 | 평균 word score | Ceramic 대비 | 추가 경제 |
|---|---:|---:|---:|
| Ceramic | 61.0 | 1.0× | — |
| Porcelain | 341.0 | 5.6× | — |
| Polished | 232.3 | 3.8× | — |
| Glass | 190.4 | 3.1× | — |
| Stone | 150.0 | 2.5× | — |
| Lead Plate | 228.2 | 3.7× | **$10.24/word** |
| Ivory | 61.0 | 1.0× | **$33/blind end** |
| Brass | 1,642.0 | **26.9×** | — |

비교용 기본 clear reward는 $3/$4/$5, Common Emoji Tile 가격은 $5다.
따라서 Lead Plate와 Ivory의 극단 수익, Brass의 held-tile compounding은
우선 관찰 대상이다.

그러나 이 sim은 **가방 전체가 한 재질**인 비현실적 상한 실험이다.
Fable 획득 빈도, 실제 타일 변환 개수, 파괴 확률, 상점 기회비용을 반영하지
않는다. 지금 수치를 바로 낮추면 안 된다.

**먼저 추가할 측정:** 실제 pack/shop 확률로 0~8 Chapter를 진행시키고,
재질별 평균 보유 수, clear 기여도, 획득 골드, 승률 delta를 기록한다.

#### BALANCE-02 · 기본 타일만으로는 Chapter 2부터 거의 진행 불가 — P2, 검증 필요

업그레이드·상점·discard를 제외한 200 seed sweep:

| sim | Chapter 1 | Chapter 2 | Chapter 3 | Chapter 4 |
|---|---:|---:|---:|---:|
| `feel-chip-scale` | 73.5% | 3.5% | 0% | 0% |
| `length-mult` | 79.0% | 2.5% | 0% | 0% |

이는 Chapter 2부터 build 획득이 필수라는 뜻이다. 그 자체가 roguelite 설계
오류는 아니지만, shop/pack 전략까지 포함한 전체 런 승률 sim이 없어
“의도한 난이도”인지 검증할 수 없다.

#### BALANCE-03 · Boss reroll이 같은 Boss를 반환할 수 있음 — P2, 재현 가능한 확률

`useGame.ts:1516-1517`은 현재 Boss가 나오면 한 번만 다시 뽑는다. 두 번째도
같으면 그대로 확정한다.

- 일반 pool 12종: 같은 Boss가 남을 확률 약 0.69%
- finisher pool 4종: 약 **6.25%**

$10을 지불한 reroll이 무효처럼 보이는 사용자 경험이다. 현재 ID를 뺀 pool에서
한 번 뽑는 것이 더 단순하고 확정적이다.

#### BALANCE-04 · offer 확률 자체는 설정과 일치

20,000회 실측은 Common 69.7%, Uncommon 25.5%, Rare 4.8%,
Legendary 0%로 `70/25/5/0` 목표와 일치했다. Pack type/size도 설정된
가중치와 대체로 일치한다.

Rare가 45종이라 개별 Rare 노출률이 낮은 것은 사실이나, 그것만으로 버그라
판정하지 않는다. Collection 발견률 telemetry나 전체 런에서의 고유 Rare
노출 수를 먼저 측정해야 한다.

`offer-distribution.ts`의 “owned 0~116 shrinking pool” 구간은 Copy Editor를
보유 목록에 포함하는 순간 중복 gate가 다시 열려 의도한 pool exhaustion을
검증하지 못한다. Copy Editor 미보유/보유 시나리오를 분리해야 한다.

### 4.4 VFX / SFX

#### 잘 통일된 부분

- settle의 점수 beat 순서와 속도는 `SettleProvider`와
  `settleDurationMs()`에 집중되어 있다.
- game speed가 settle multiplier에만 적용되는 것은
  `screens-spec.md` §2.11의 명시적 계약과 일치한다.
- enabled button press SFX는 App의 delegated listener가 공통 적용한다.
- 모든 gold delta는 RunView의 한 watcher에서 gain/loss 음색으로 분기한다.
- 9개 문자 재질의 소리는 `MATERIAL_SFX` 한 map으로 관리된다.
- 엔진에서 `Math.random()` 사용은 발견하지 못했다. audio noise와 UI 장식의
  사용은 headless/seeded engine 계약 밖이다.

#### VFX-01 · 인게임 Reduced Motion이 핵심 애니메이션을 멈추지 못함 — P1, 확정

다음 구현은 OS `prefers-reduced-motion`만 보고 body의
`force-reduced-motion`을 보지 않는다.

- `src/ui/settle.tsx:22-23`
- `src/ui/useAnim.ts:8-9`
- `src/ui/components/MoneyValue.tsx:3-4`
- `src/ui/components/Sidebar.tsx:143-146`
- `src/ui/useGame.ts:1388-1390`

반면 drag, card tilt, DeskObjects, PackOpening, Shop 등은 둘을 모두 본다.
따라서 Options 토글을 켜도 settle timeline, number count-up, money popup,
tomato hop, verdict timing 일부가 계속 동작한다. `UI_DESIGN.md` §4 quality
floor와 직접 충돌한다.

**처리:** `motionOff()` 한 함수를 export하여 모든 call site가 OS 설정과
인게임 class를 같은 방식으로 읽게 한다. 이 값은 엔진 상태가 아니라 UI
presentation helper로 유지한다.

#### VFX-02 · 모션 duration과 layer 규칙이 분산됨 — P2, 확정

- `play.css`와 `screens.css`에는 animation/transition 속성 선언이 각각
  144개, 54개다.
- `tokens.css`에는 공용 motion duration scale이 없다.
- UI TypeScript에 `setTimeout` 호출이 47곳 있고, PackOpening·Shop·BlindSelect
  일부는 CSS 종료 신호 대신 대응하는 ms를 다시 적는다.
- CSS의 `z-index` 선언은 98개지만 공용 layer token은 tooltip 한 개뿐이며,
  CRT는 9997~9999 raw 값을 사용한다.

모든 duration을 하나로 만들 필요는 없다. 다음 여섯 의미만 공용화하면 된다.

1. control feedback
2. card enter/exit
3. panel transition
4. reveal/stamp
5. ambient idle
6. settle beat — 기존 `settleDurationMs()` 유지

상태 전환을 일으키는 애니메이션은 `animationend`/완료 signal을 우선하고,
timer는 safety timeout으로만 둔다. z-index는 board / product / modal /
spotlight / CRT / tooltip의 작은 사다리만 정의한다.

#### VFX-03 · 노출된 설정 중 Screen Shake는 no-op — P2, 확정

`settings.screenshake`는 Settings slider에서 저장되지만 다른 코드가 읽지
않는다. 현재 UI는 기능이 있는 control처럼 보인다.

CRT on/off·intensity·bloom과 pixel-perfect toggle도 `screens-spec.md`
§2.11에는 있지만 `UI_DESIGN.md` §5가 “아직 wiring 예정”이라고 명시한
**알려진 미완성**이다. 출시 범위라면 구현하고, 아니라면 현재 Settings에서
숨기고 문서에 placeholder로 표시한다.

#### AUDIO-01 · background 복귀 시 BGM catch-up burst 위험 — P2, 정적 위험

`audio.ts:333-344`의 scheduler는 25ms interval이 오래 지연된 뒤에도
`nextStepTime`을 현재 AudioContext 시간으로 재동기화하지 않는다. 브라우저가
background timer를 throttle하고 audio clock은 진행한 경우, 복귀 tick의
`while`이 과거 step을 한꺼번에 schedule할 수 있다.

**처리:** tick 시작 시 `nextStepTime`이 현재 시간보다 충분히 뒤처졌으면
missed step 수만큼 index만 넘기고 `currentTime`부터 재개한다. 실제
Chrome/Electron background 복귀 테스트를 추가한다.

#### AUDIO-02 · noise buffer를 SFX 호출마다 생성 — P3, 측정 후

noise recipe는 호출마다 `AudioBuffer`를 만들고 sample마다 `Math.random()`을
호출한다. `deskCheck` 1.05초는 약 5만 sample이다. 다만 이런 긴 효과는
사용 빈도가 낮고, 현재 병목을 재현하지는 못했다.

먼저 performance trace로 audio callback/GC spike를 확인한다. 필요하면 공용
white-noise buffer 하나를 만들어 offset/playbackRate로 재사용한다.

## 5. 무결성 감사

### INTEGRITY-01 · 엔진 레지스트리 순환 import로 Node 실행 실패 — P0, 재현

재현:

```text
npm run sim:emoji-sample
ReferenceError: Cannot access 'RARE_JOKERS' before initialization
    at src/engine/gamblers.ts:90
```

직접 `src/engine/jokers/index.ts`만 import해도 같은 오류가 난다.

순환 경로:

```text
jokers/index
  → jokers/interestGlutton
  → economy
  → pouches
  → gamblers
  → jokers/index
```

`gamblers.ts:89-92`의 module-level `POOL_BY_RARITY`가 초기화가 끝나기 전
`RARE_JOKERS`와 `LEGENDARY_JOKERS`를 읽어 TDZ 오류가 발생한다.

테스트와 `npm run sim`은 다른 import 순서 때문에 우연히 통과한다. 따라서
“778 tests green”이 이 문제를 반증하지 않는다.

**최소 수정:** `POOL_BY_RARITY`를 effect 실행 시 읽는 함수로 바꾸어 즉시
TDZ를 제거한다.

**근본 수정:** rarity roster를 effect/hook barrel과 분리된 leaf data
module로 옮기거나, `interestGlutton`이 필요로 하는 순수 interest 계산을
`economy → pouches → gamblers` 경로 밖의 작은 leaf module로 분리한다.
수정 뒤 각 public engine entry를 **독립 프로세스**에서 import하는 smoke
test를 추가한다.

### DATA-01 · Settings 인스턴스가 과거 객체로 새 값을 덮어쓸 수 있음 — P1, 확정

`usePersistedState`는 인스턴스별 `useState`이고 storage event/context 동기화가
없다. App, Options, RunView 등이 각각 `useSettings()`를 호출한다.

구체적 손실 경로:

1. App의 settings state가 `master: 80`으로 mount된다.
2. Options의 별도 인스턴스에서 `master: 0`으로 바꾸고 저장한다.
3. Options를 닫아 그 인스턴스를 unmount한다.
4. fullscreen 상태가 바뀌면 App의 오래된 인스턴스가
   `{ ...current, fullscreen }`을 저장한다.
5. master가 다시 80으로 덮인다.

코드 주석도 App 인스턴스가 “frozen at page-load values”임을 명시한다.

또한 저장된 `wj.settings`가 이전 버전의 부분 객체이면
`{ ...DEFAULT_SETTINGS, ...stored }` 병합이나 값 검증이 없다.
`uiScale`, `master`, `music`, `sfx`가 `undefined`이면 CSS scale과 audio clamp에
`NaN`이 들어간다.

**처리:** App 최상단의 단일 Settings provider/store로 통합하고, 읽을 때
`normalizeSettings(stored)`가 기본값 병합, enum 검증, number clamp를
수행하게 한다. partial legacy object와 fullscreen overwrite 회귀 테스트를
추가한다.

### DATA-02 · Voucher 진행의 `Infinity`가 `null`이 되어 오해금 가능 — P2, 재현

`voucherProgress.EMPTY.lowestHandSize`는 `Infinity`다.

```text
JSON.stringify({ lowestHandSize: Infinity })
→ {"lowestHandSize":null}

null <= 8
→ true
```

실제로 `pictureDiary` rule에 `lowestHandSize: null`을 넣으면 `true`가 반환됐다.
정상 새 런은 `newRun` event가 먼저 finite hand size를 기록하므로 보통
발생하지 않는다. 하지만 이전 버전 저장이나 비정상 event 순서에서 첫 저장이
다른 progress event라면 Picture Diary가 잘못 해금될 수 있다.

**처리:** serializable sentinel을 사용하거나 `null`을 명시적 “미측정”으로
normalize한다. `loadVoucherProgress()`에서 non-finite/null migration을
수행하고 직렬화 round-trip 테스트를 추가한다.

### DATA-03 · 유효 lexicon 6개 행의 POS가 비어 있음 — P2, 재현

`data/lexicon.json`에서 다음 valid/tagged word는 `pos: []`다.

```text
wha, whats, ye, yours, yourself, yourselves
```

유효 단어로 제출할 수 있지만 sentence pattern의 어떤 POS skeleton에도
들어갈 수 없다. 특히 `yours/yourself/yourselves`는 GDD의 pronoun-as-noun
의도와 어긋날 가능성이 높다.

**처리:** baked lexicon 생성 시 `pos.length > 0` validation을 기본으로 하고,
정말 POS 없는 항목만 명시적 allowlist로 둔다. 여섯 행은 사전 pipeline의
원자료를 확인해 태깅한다.

### DATA-04 · 저장 실패가 사용자에게 완전히 보이지 않음 — P2, 위험

정상 desktop 저장은 다음 장점을 갖는다.

- run/profile 파일 분리
- temp write + `fsync` + rename
- 1세대 `.bak`
- 정상 quit 시 debounce flush
- save key drift test

직접적인 정상 경로 데이터 손실은 발견하지 못했다.

다만 web `localStorage.setItem` 실패와 desktop disk write 실패는 모두
삼켜지고 UI에 save health가 전달되지 않는다. quota, privacy mode, disk full,
permission 오류가 나도 사용자는 계속 저장된다고 생각한다. desktop의 300ms
debounce 안에서 강제 종료되면 마지막 행동이 유실될 수 있는 잔여 위험도 있다.

게임을 멈추게 할 필요는 없다. 첫 저장 실패만 non-blocking 경고와
“저장되지 않음” 상태로 노출하고, desktop bridge에 마지막 write 성공/실패
ack를 추가하는 것이 적절하다.

### QA-01 · UI 테스트가 소스 문자열 검사에 많이 의존 — P1, 확정

89개 test file 중 31개가 `readFileSync`/`source()`로 구현 문자열을 검사한다.
이 방식은 “class 이름이 존재한다”는 것은 잡지만 실제 focus, portal 위치,
animation 완료, old settings overwrite는 잡지 못한다.

현재 다음 문제들이 778/778 green인 이유이기도 하다.

- `.tile-tt` selector는 존재하지만 실제 class와 다름
- Tooltip은 portal을 쓰지만 keyboard focus로 열리지 않음
- Reduced Motion class는 CSS에 있지만 settle helper는 읽지 않음
- 특정 import 순서에서는 engine이 실패함

전체 E2E suite를 한꺼번에 도입할 필요는 없다. 다음 네 개만 실제 runtime
test로 바꾸는 것이 우선이다.

1. keyboard focus → tooltip visible
2. in-game Reduced Motion → settle/count-up snap
3. partial settings migration + fullscreen overwrite
4. engine public entry 독립 import

## 6. 최적화 감사

### PERFORMANCE-01 · 초기 모듈 그래프와 JS가 한 chunk에 집중 — P1, 재현

`App.tsx`가 MainMenu, NewRun, RunView, Collection, Options, Profile을 모두
정적 import한다. Collection은 다시 116 Joker art resolver, 32 Voucher,
pack/Fable/Constellation/Gambler/Boss registry를 정적 import한다.

Vite 결과는 JS chunk 하나, raw 2.31MB다. 또한 App은 loading screen을
렌더하기 전에 `useGame()`을 호출하고, `useGame()`은 `loadBrowserLexicon()`으로
dictionary raw text와 30k JSON table을 즉시 parse한다.

중요한 구분:

- Vite가 asset URL을 정적 import했다고 해서 39MB 이미지가 첫 화면에서 모두
  자동 fetch/decode되는 것은 아니다.
- 하지만 모든 화면 코드와 URL registry, lexicon은 초기 JS parse/cache
  비용에 들어가고 code cache invalidation 범위가 커진다.
- `screens-spec.md` §2.0의 “Collection gallery와 complete art registry는
  on demand”라는 모듈 경계 의도와는 맞지 않는다.

**처리 순서:**

1. Collection / Profile / Options를 `React.lazy` screen chunk로 분리
2. RunView/NewRun도 필요 시 분리
3. `useGame`/lexicon 초기화는 Continue metadata 확인과 분리해 첫 Play/Continue
   직전으로 지연
4. 변경 전후 first paint, scripting time, chunk 크기를 기록

새 상태관리나 router dependency는 필요 없다.

### PERFORMANCE-02 · 배포 에셋 72.60 MiB — P1, 재현

#### 폰트

`main.tsx`가 일반 `500.css` 형태를 import해 Baloo의 Devanagari/Vietnamese,
Jost의 여러 불필요 subset과 WOFF/WOFF2를 모두 산출한다. 현재 폰트만
9.26 MiB, 554 files다.

**처리:** 사용 언어에 맞는 `latin-*`과 `korean-*` CSS를 import하고,
runtime target이 허용하면 woff2-only 자체 `@font-face`를 사용한다. 먼저
영문·한글·숫자·필요 문장부호 glyph coverage test를 만든다.

#### Voucher PNG

32개 Voucher PNG 합계는 28.87 MiB다. 큰 파일은 1024×1024, 1.4~1.9 MiB인데
runtime은 124×165px 카드다.

**처리:** 원본은 `docs/Arts`에 보존하고 runtime derivative만 2× 또는 3×
pixel density로 생성한다. lossless PNG optimize를 먼저 적용하고,
nearest-neighbor/downsample visual diff를 통과한 derivative만 import한다.

#### Card SVG

Fable/Gambler/Constellation vector 원본은 합계 약 18.8 MiB이고 dist SVG는
21.92 MiB다. UI 문서는 path-only SVG를 현재 계약으로 둔다.

**처리:** 우선 SVGO/path 단순화로 계약을 유지한다. raster derivative로
바꾸려면 `UI_DESIGN.md`의 path-only 계약을 먼저 변경하는 별도 결정이
필요하다.

### PERFORMANCE-03 · hover tooltip이 매 frame React state를 갱신 — P2, 확정

`Tooltip.tsx:85-104`는 open 동안 매 frame `getBoundingClientRect()`를 읽고
위치가 바뀌면 `setPosition`한다. idle card는 3px float/sway 중이므로 위치가
실제로 매 frame 달라져 hover 하나가 약 60 React render/s를 만들 수 있다.
이는 UI 문서의 “per-frame React re-render 금지” 원칙과 방향이 반대다.

**처리:** rAF는 유지하되 CSS custom property나 portal DOM style을 직접
갱신한다. 정지 객체는 pointer enter + scroll/resize/transition 동안만
재측정한다. 문자 타일과 통합하면 이 정책도 한 곳에서 관리할 수 있다.

### PERFORMANCE-04 · 저장 직렬화와 preview 재계산 — P3, 측정 후

- 모든 GameState 변경마다 `serializeRun(state)`가 먼저 전체 resting snapshot을
  stringify한 뒤 byte dedupe한다.
- RunView render는 `judgeSentence`와 `stagePreview`를 다시 계산한다.

현재 state와 sequence가 작아 확정 병목으로 재현하지는 못했다. React
Profiler와 long-run state 크기를 측정하기 전에는 selector/store abstraction을
추가하지 않는다. 실제 4ms 이상 frame cost가 보일 때 dependency narrowing과
`useMemo`를 적용한다.

### 성능상 현재 문제로 보지 않는 것

- 30k lexicon lookup 자체는 Set/Map 기반이다.
- sentence pattern은 현재 phase/sequence 길이가 짧다.
- 테스트 전체는 약 6초, 일반 build는 수 초 수준이다.
- 엔진의 seeded RNG와 headless score pipeline에 브라우저 API 병목은 없다.

## 7. 리팩터링 후보

기존 `docs/REFACTORING.md`의 열린 R-09, R-11, R-13b, R-14는 여전히 참고할
가치가 있다. 다만 R-11 전체 family executor와 R-14 대형 분할은 이번 감사의
P0/P1 결함보다 뒤다.

### 7.1 권장 순서

1. **문서 정리:** stale CLAUDE/REFACTORING 정리
2. **엔진:** import cycle 제거 + 독립 import smoke test
3. **설정/접근성:** Settings provider/normalizer + 공용 `motionOff`
4. **툴팁:** Tile을 shared Tooltip variant로 통합 + keyboard runtime test
5. **데이터:** Voucher sentinel migration + POS validation
6. **전달 성능:** screen code split → font subset → runtime art derivative
7. **밸런스:** 전체 런 sim을 만든 뒤 Brass/Lead/Ivory와 rarity 접근성 재평가
8. **구조:** consumable predicate 중복과 `useGame.ts` seam을 실제로 줄이는
   범위만 분리

### 7.2 Ponytail 과설계 감사

- `shrink:` `Tile.tsx`의 별도 tooltip portal/state/markup을 삭제하고 shared `Tooltip`의 compact variant로 흡수
- `shrink:` App/Options/RunView의 여러 `useSettings()`를 한 provider와 한 normalizer로 교체
- `shrink:` 12곳의 reduced-motion 판정을 공용 `motionOff()` 하나로 교체
- `delete:` 적용되지 않는 `.tile-tt` selector와 Constellation 중복 locale 24행, 미사용 `BALANCE.jokers.loanShark` knob 제거
- `native:` 화면 code split은 현재 React `lazy`/`Suspense`만 사용하고 router/state dependency를 추가하지 않음
- `yagni:` R-11은 먼저 family metadata/predicate만 합치고, 서로 다른 Fable/Gambler 실행기를 억지로 하나의 범용 command framework로 만들지 않음
- `shrink:` `useGame.ts`는 파일 이동이 아니라 pure transition/side-effect 경계를 실제로 줄이는 단위만 추출
- `shrink:` R-09 test fixture는 해당 test를 수정할 때 점진적으로 적용하고 14개 파일을 한 번에 재작성하지 않음

net: -450 lines, -0 deps possible.

## 8. 수정 단계별 검증 게이트

| 단계 | 반드시 추가/실행할 검증 |
|---|---|
| Import cycle | 각 engine public entry 독립 Node import, `sim`, `sim:emoji-sample`, 전체 tests |
| Settings | partial legacy object, 두 hook 인스턴스, fullscreen escape, NaN 방지 |
| Tooltip | pointer + keyboard, portal clipping, moving card tracking, compact tile width |
| Reduced Motion | OS 설정과 인게임 toggle 각각 settle/card/number/popup 정지 |
| Save progress | `Infinity/null` round-trip, active/inactive profile isolation, disk failure 상태 |
| Asset | offline checker, `file://`, gh-pages relative base, pixel visual diff, glyph coverage |
| Balance | 최소 1,000 seed × 8 Chapter, 실제 shop/pack/acquisition 전략, 재질별 기여 telemetry |
| 최종 | `npm test`, `npm run build`, `npm run build:desktop`, packaged Electron smoke |

## 9. 최종 우선순위

| 순위 | ID | 이유 |
|---:|---|---|
| 1 | INTEGRITY-01 | headless engine의 일부 entry가 실제로 실행 불능 |
| 2 | DATA-01 | 사용자가 바꾼 설정을 과거 값이 덮을 수 있음 |
| 3 | TOOLTIP-01 / 02 | 전역 tooltip 계약과 keyboard 접근성 위반 |
| 4 | VFX-01 | Reduced Motion 토글이 핵심 모션을 멈추지 못함 |
| 5 | PERFORMANCE-01 / 02 | 초기 chunk와 72.60 MiB 배포 비용 |
| 6 | DATA-02 / 03 | 조건부 오해금과 POS 데이터 공백 |
| 8 | BALANCE-01 / 02 | 큰 이상치는 보이나 전체 런 sim이 선행되어야 함 |
| 9 | BALANCE-03 / AUDIO-01 | 낮은 빈도지만 사용자가 체감하는 오동작 |
| 10 | COPY/VFX/PERFORMANCE P2~P3 | 일괄 정리보다 상위 결함 수정 때 함께 처리 |

이 보고서의 핵심 권고는 “전면 리팩터링”이 아니다. 먼저 import 순서,
설정 저장, 툴팁, Reduced Motion처럼 **작고 재현되는 계약 위반**을 고치고,
그 다음 전달 성능을 줄이며, 실제 전체 런 데이터가 생긴 뒤 밸런스를 조정하는
순서가 가장 안전하다.

## 10. 순차 수정 결과와 재검증 — 2026-07-31

### 10.1 처리 상태

| 항목 | 결과 |
|---|---|
| SPEC-01 | 해결. Copy Editor와 Boar를 유일한 명시적 중복 예외로 GDD·프로젝트 규칙·코드 주석에 동기화 |
| INTEGRITY-01 | 해결. `gamblerIds.ts` leaf 분리, 146개 engine module cycle 검사, 12개 public entry 독립 import gate 추가 |
| DATA-01 | 해결. key별 공유 external store, functional update, legacy Settings normalizer, mascot id 검증 적용 |
| TOOLTIP-01 / 02 | 해결. Tile을 shared Tooltip으로 통합하고 keyboard focus, `aria-describedby`, Pouch button, body portal 적용 |
| VFX-01 | 해결. OS와 인게임 설정을 함께 읽는 `motionOff()`로 settle/count-up/card/ambient 경로 통일 |
| VFX-03 | 해결. Screenshake slider를 settle score beat의 board impact 진폭에 연결; Reduced Motion에서는 실행되지 않음 |
| PERFORMANCE-01 | 해결. New Run/Run/Collection/Options/Profile을 `React.lazy`로 분리하고 lexicon은 첫 메뉴 동작 직전에 동적 import |
| PERFORMANCE-02 | 해결. 언어별 font subset + WOFF2-only, 17개 1024px Voucher의 512px runtime derivative 적용 |
| PERFORMANCE-03 | 해결. Tooltip rAF가 React state 대신 portal CSS 변수를 직접 갱신 |
| DATA-02 | 해결. `lowestHandSize` 미측정 sentinel을 `null`로 변경하고 JSON round-trip migration 검증 추가 |
| DATA-03 | 해결. 빈 POS 6행을 noun으로 보정하고 30,259행 production validator를 build gate에 추가 |
| BALANCE-03 | 해결. 유료 Boss reroll은 현재 id를 draw pool에서 먼저 제외 |
| AUDIO-01 | 해결. background throttling 동안 놓친 sequencer step을 건너뛰고 미래 시각부터 재개 |
| COPY-03 | 해결. locale 동일 영문 prose 검사에서 미번역 행 0건 |
| DATA-04 | 해결. web/desktop 저장 실패를 지속 경고하고 다음 정상 progress 저장 때 해제 |
| QA-01 핵심 흐름 | 해결. 실제 `file://` 빌드에서 도감→새 게임→플레이→재실행 복구→정산→상점→팩 E2E 추가 |
| 밸런스 telemetry | 해결. 커스텀 시드를 제외한 완료 run·승률·Chapter별 패배를 프로필에 누적 |
| Pack art | 해결. 32개 SVG 마스터를 보존하고 `244×400` PNG runtime derivative 사용 |
| COPY-01 / COPY-02 | 해결. 896개 locale key의 종결형·숫자 강조·변수/태그 parity를 build lint로 강제 |
| 리팩터링 소항목 | 죽은 `BALANCE.jokers.loanShark`와 사용되지 않는 Constellation 설명 24행 제거 |

대형 R-11 consumable executor 통합과 R-14 `useGame.ts` 물리 분할은 적용하지
않았다. 현재 확정 결함을 고치는 데 필요하지 않고 pack/save-visible 경로를
동시에 흔드는 medium-high risk 변경이므로, 단순화를 명분으로 위험을 늘리지
않는다는 Ponytail 원칙을 따랐다.

### 10.2 전달 성능

| 지표 | 감사 baseline | 수정 후 | 변화 |
|---|---:|---:|---:|
| 초기 static JS (`index` + preload) | 2,306.65 kB | 457.10 kB | -80.2% |
| 초기 static JS gzip | 411.09 kB | 148.65 kB | -63.8% |
| lexicon JS | 초기 chunk 포함 | 1,722.07 kB 별도 on-demand chunk | 첫 메뉴 동작 전 parse 없음 |
| `dist/assets` | 72.60 MiB / 827 files | 26.25 MiB / 297 files | -63.8% |
| PNG | 38.90 MiB | 22.62 MiB | -41.9% |
| SVG | 21.92 MiB | 0 MiB | runtime path parse 제거 |
| fonts | 9.26 MiB (WOFF+WOFF2) | 1.20 MiB (WOFF2) | -87.0% |

Voucher 원본은 `docs/Arts/Voucher`에 그대로 보존한다.
`scripts/build-voucher-assets.mjs`가 premultiplied-alpha 2× downsample로
512×512 파생본 17개를 만들며, `npm run check:assets`와 production build가
누락·stale 파생본을 거부한다. 대표 최댓값 BWPhoto도 1.98 MB에서 408 kB로
감소했다.

Fable/Constellation/Gambler 카드의 path-only SVG 원본 44개도 그대로
보존한다. 런타임은 tracer가 함께 만든 pixel-identical 500×700 PNG
파생본을 사용한다. 카드 아트는 18.42 MiB에서 5.02 MiB로 줄었고,
production 산출물에서 해당 SVG 44개와 125만 개 이상의 path 명령이
제거됐다. 첫 도감 페이지 전송량은 우화 4.04→1.15 MiB, 별자리
3.22→0.80 MiB, 노름꾼 4.79→1.31 MiB다.

Card Pack도 같은 구조로 전환했다. 32개 path-only SVG 마스터 3.68 MiB는
소스에 남고 runtime PNG는 1.14 MiB라서 해당 런타임 묶음이 69.1% 줄었다.

Vite의 500 kB 경고는 남는다. 대상은 초기 entry가 아니라 의도적으로 지연된
1.72 MB lexicon chunk다. 사전은 desktop `file://` 계약 때문에 여전히 번들
내부에 있고 runtime `fetch()`는 사용하지 않는다.

### 10.3 1,000 seed × 8 Chapter 밸런스 결과

새 `src/sim/full-run-balance.ts`는 실제 blind/Boss/shop/pack/Joker/material/
economy/progression pipeline을 사용한다. best base-score word, 3글자 미만일 때
discard, Emoji Tile 및 Charm/Tile Pack 구매 전략을 사용하며 Fable, shop
reroll, 정교한 synergy 판매 전략은 사용하지 않는다.

자연 생존:

| Chapter 진입 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 비율 | 100.0% | 97.5% | 82.5% | 33.5% | 3.1% | 0.1% | 0.0% | 0.0% |

승리는 `0/1000`이었다. 이는 목표 곡선 위험 신호지만 bot이 Fable·reroll·의도적
synergy를 사용하지 않으므로 이 결과만으로 GDD 목표 수치를 바꾸지 않았다.
목표 곡선 변경은 실제 숙련 플레이 telemetry와 설계 결정을 요구한다.

조기 사망의 survivor bias를 제거한 강제 8-Chapter market-exposure 군은
run당 평균 23 shops, 5.01 Emoji Tiles, 5.51 Charm Packs, 10.11 Tile Packs,
3.44 Vouchers를 거쳤다. 개별 강화 재질의 한 번 이상 획득률은 21.9~23.5%,
평균 획득량은 0.24~0.26개/run이었다.

| watchlist | 획득 run | 직접 기여/run |
|---|---:|---:|
| Lead Plate | 22.2% | +3.9 Mult, +$4.41 |
| Ivory | 22.7% | +$1.06 |
| Brass | 22.4% | +2.6 Mult |

따라서 “가방 전체가 같은 재질” 극단 sim의 Brass/Lead/Ivory 수치만 보고 즉시
nerf할 근거는 사라졌다. 접근성을 포함한 실전 노출에서는 기여가 제한적이다.

### 10.4 최종 게이트

| 검증 | 결과 |
|---|---|
| `npm test -- --reporter=dot` | **95 files / 803 tests 통과** |
| `npm run build` | data 30,259행, 76쌍 asset derivative, locale 896쌍, TypeScript, engine cycle, glyph coverage, Vite build 통과 |
| `node scripts/check-offline.mjs` | 12 build files 검사, 외부 URL/절대 asset path 0 |
| `npm run e2e:smoke` | `file://` Collection→New Run→Play→reload→Settlement→Shop→Pack 통과 |
| `npm run sim:full-run` | 1,000 seed × 자연 생존군 + 8-Chapter 노출군 완료 |
| `electron-builder --dir` | Windows x64 `Play the World.exe` 패키징 성공 (`../D1-release/win-unpacked`) |

### 10.5 후속 1~5 완료와 남은 작업

- DATA-04, 핵심 E2E, human balance telemetry, Card Pack runtime derivative,
  COPY-01/COPY-02 locale lint를 순서대로 완료했다.
- VFX-02: 모든 animation duration과 z-layer를 전역 token으로 옮기는 대형
  정리는 하지 않았다. 현재 재현 결함이 있는 경로만 공용 helper로 통일했다.
- QA-01: 출시 핵심 흐름 smoke는 생겼다. 모든 세부 상호작용을 포괄하는 대형
  browser E2E suite는 아직 없으며, 실제 재발 경로가 생길 때 확장한다.
- 밸런스 목표 곡선은 변경하지 않았다. 프로필 telemetry가 실제 비커스텀
  플레이의 승률과 패배 Chapter를 누적하므로 표본이 쌓인 뒤 판단한다.
