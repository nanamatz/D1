# WooDak (우땅) Run-End Mascot + Victory State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End the run as a **win** when the final chapter's Deadline is cleared, and show 우땅 (WooDak), the orangutan mentor mascot, on the run-end screen (win and loss) with a contextual tip / discovery line in a speech bubble.

**Architecture:** One engine flag (`BlindOutcome.won` in `resolveBlind`, still returning earnings + the advanced run so the planned endless mode can consume them later). `useGame.finalize` routes a won outcome to the existing `'gameover'` phase with `won: true` on the snapshot — no new phase. `GameOver.tsx` renders two framings and mounts `WooDakMascot`, which reuses the shop-mascot CSS block.

**Tech Stack:** TypeScript strict, Vitest (engine test), React 18, plain CSS.

**Spec:** `docs/superpowers/specs/2026-07-19-woodak-run-end-design.md`

## Global Constraints

- Engine (`src/engine/`) stays headless — no DOM/React imports; the ONLY engine change is the `won` field in `progression.ts`.
- All display strings live in `locales/en.json` + `locales/ko.json` (GDD §1.2). WooDak's Korean voice uses the sentence-final tic "~우땅".
- Endless mode is **planned, not implemented**: do not consume `outcome.run`/`outcome.earned` on a win beyond storing the run; do not add an endless button.
- No persist version bump: an old save's `gameover` lacking `won` reads falsy (= loss) and was never resumable anyway.
- Reduced motion: rely on the shared `.mascot` block's `@media (prefers-reduced-motion: reduce)` rule and the global `body.force-reduced-motion` kill-switch (screens.css); new keyframes need their own reduce rule.
- Docs and code land in the same change (CLAUDE.md protocol step 3).
- UI has no component test harness — UI tasks verify via `npm run build` + the project verify skill (`.claude/skills/verify/SKILL.md`); the engine task is TDD.

---

### Task 1: Engine — `BlindOutcome.won`

**Files:**
- Modify: `src/engine/progression.ts:33-71`
- Test: `tests/slice5-progression.test.ts` (append a describe block)

**Interfaces:**
- Produces: `BlindOutcome.won: boolean` — consumed by Task 2 as `outcome.won`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/slice5-progression.test.ts` (the file already imports `newRun`, `resolveBlind`, `RunState`, and defines `blindWith`):

```ts
describe('slice5 progression — final-boss victory (spec 2026-07-19)', () => {
  it('clearing the final-chapter Boss flags won and still pays + advances (endless-ready)', () => {
    const run: RunState = { ...newRun('w'), gold: 0, ante: 8, blindIndex: 2 };
    const blind = blindWith({ kind: 'boss', target: 100, phasesUsed: 4 });
    const out = resolveBlind(run, blind, 500);
    expect(out.won).toBe(true);
    expect(out.cleared).toBe(true);
    expect(out.earned.reward).toBeGreaterThan(0);
    expect(out.run.ante).toBe(9); // advanced run kept for the future endless mode
  });

  it('won stays false on the ante-8 Big, an earlier Boss, and a loss', () => {
    const big = resolveBlind(
      { ...newRun('w'), ante: 8, blindIndex: 1 },
      blindWith({ kind: 'big', target: 100 }),
      500,
    );
    expect(big.won).toBe(false);
    const earlyBoss = resolveBlind(
      { ...newRun('w'), ante: 7, blindIndex: 2 },
      blindWith({ kind: 'boss', target: 100 }),
      500,
    );
    expect(earlyBoss.won).toBe(false);
    const loss = resolveBlind(
      { ...newRun('w'), ante: 8, blindIndex: 2 },
      blindWith({ kind: 'boss', target: 100 }),
      50,
    );
    expect(loss.won).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/slice5-progression.test.ts`
Expected: FAIL — `out.won` is `undefined`, not `true` (TS build may also flag the missing property; that's the same failure).

- [ ] **Step 3: Implement**

In `src/engine/progression.ts`, add to the `BlindOutcome` interface (after the `gameOver` field):

```ts
  /** cleared the final chapter's Boss — the run is won (GDD §8.2); endless mode
   *  (planned) will consume `run`/`earned` to continue past this instead */
  won: boolean;
```

In `resolveBlind`, the miss branch becomes:

```ts
    return { cleared: false, gameOver: true, won: false, earned: NO_EARNINGS, run };
```

and the cleared return gains the flag (before the `earned` field, computed from the PRE-advance run):

```ts
  return {
    cleared: true,
    gameOver: false,
    won: run.ante === BALANCE.runAntes && run.blindIndex === 2,
    earned: { reward, phases, interest: interestGold, thrift, total },
    run: { ...run, gold: run.gold + total, ante: next.ante, blindIndex: next.blindIndex },
  };
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests pass (281 existing + 2 new).

- [ ] **Step 5: Commit**

```powershell
git add src/engine/progression.ts tests/slice5-progression.test.ts
git commit -m "feat : resolveBlind flags a final-boss win (won)"
```

---

### Task 2: useGame — route a win to the run-end screen

**Files:**
- Modify: `src/ui/useGame.ts` — `GameOverInfo` (~line 44) and `finalize` (~line 272)

**Interfaces:**
- Consumes: `outcome.won` (Task 1).
- Produces: `GameOverInfo.won: boolean` — consumed by Tasks 4–5 as `g.state.gameover.won`.

- [ ] **Step 1: Extend the snapshot type**

In `src/ui/useGame.ts`, `GameOverInfo` gains (after `bossId`):

```ts
  /** true when the run ended by clearing the final chapter's Deadline (a win) */
  won: boolean;
```

- [ ] **Step 2: Set `won: false` on the loss branch**

In `finalize`'s `if (!outcome.cleared)` return, add `won: false` to the `gameover` object:

```ts
          gameover: {
            finalScore: Math.round(final.finalScore),
            target: s.blind.target,
            ante: outcome.run.ante,
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: false,
          },
```

- [ ] **Step 3: Add the win branch**

Directly after the `if (!outcome.cleared) { ... }` block (before the `phasesLeft` computation), insert:

```ts
      // Final-chapter Deadline cleared → the run is WON (spec 2026-07-19).
      // Skip Fee Settlement/shop for now; outcome.run (advanced, paid out) is
      // still applied so the planned endless mode can later route this through
      // the normal cashout path instead.
      if (outcome.won) {
        return {
          ...s,
          run: outcome.run,
          stats,
          phase: 'gameover',
          gameover: {
            finalScore: Math.round(final.finalScore),
            target: s.blind.target,
            ante: s.run.ante, // the chapter just completed, not the advanced one
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: true,
          },
        };
      }
```

- [ ] **Step 4: Verify it compiles + suite still green**

Run: `npm run build` then `npm test`
Expected: both succeed.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/useGame.ts
git commit -m "feat : route a final-boss win to the run-end screen (won snapshot)"
```

---

### Task 3: i18n — win framing + WooDak line pools (ko/en)

**Files:**
- Modify: `locales/ko.json` (after the `"gameover.score"` entry)
- Modify: `locales/en.json` (after the `"gameover.score"` entry)

**Interfaces:**
- Produces keys consumed by Tasks 4–5: `gameover.wonTitle`, `gameover.wonBy`, `gameover.wonReached` ({ante}), `woodak.won`, `woodak.discovery` ({n}), `woodak.tip.reroll`, `woodak.tip.discard`, `woodak.tip.shop`, `woodak.tip.0`–`woodak.tip.4`.

- [ ] **Step 1: Korean lines**

In `locales/ko.json`, directly after the `"gameover.score"` line, add:

```json
  "gameover.wonTitle": "출간 완료!",
  "gameover.wonBy": "최종 마감 격파",
  "gameover.wonReached": "챕터 {ante} 완주",
  "woodak.won": "축하한다우땅! 원고가 드디어 책이 됐다우땅.",
  "woodak.discovery": "이번 런에서 새 단어 {n}개를 도감에 실었다우땅. 대단하다우땅!",
  "woodak.tip.reroll": "리롤을 한 번도 안 썼다우땅. 좋은 조커는 기다려 주지 않는다우땅.",
  "woodak.tip.discard": "버리기를 아끼면 손패가 굳는다우땅. 다음엔 과감하게 버려 보라우땅.",
  "woodak.tip.shop": "문방구에서 아무것도 안 샀다우땅. 투자 없이는 베스트셀러도 없다우땅.",
  "woodak.tip.0": "문장 패턴을 완성하면 점수가 크게 뛴다우땅.",
  "woodak.tip.1": "곱셈 패턴은 후반 페이즈일수록 무섭게 커진다우땅.",
  "woodak.tip.2": "A, E, I, O, U를 다 넣으면 Vowel Flush다우땅. 횡설수설이라도 터진다우땅.",
  "woodak.tip.3": "이자는 $5마다 $1이라우땅. 지갑을 불려 두라우땅.",
  "woodak.tip.4": "관사와 형용사는 패턴을 깨지 않고 보너스만 얹는다우땅.",
```

- [ ] **Step 2: English lines**

In `locales/en.json`, directly after the `"gameover.score"` line, add:

```json
  "gameover.wonTitle": "Published!",
  "gameover.wonBy": "Final Deadline defeated",
  "gameover.wonReached": "All {ante} chapters cleared",
  "woodak.won": "Congratulations! Your manuscript is finally a book.",
  "woodak.discovery": "You logged {n} new words in the collection this run. Impressive!",
  "woodak.tip.reroll": "You never rerolled. Good jokers don't wait around.",
  "woodak.tip.discard": "Hoarding discards stiffens your hand. Toss boldly next time.",
  "woodak.tip.shop": "You bought nothing at the shop. No bestseller without investment.",
  "woodak.tip.0": "Completing a sentence pattern makes the score jump.",
  "woodak.tip.1": "Multiplicative patterns grow scariest in the late phases.",
  "woodak.tip.2": "Fit A, E, I, O and U in one word for a Vowel Flush — it even fires on gibberish.",
  "woodak.tip.3": "Interest pays $1 per $5 saved. Keep the purse fat.",
  "woodak.tip.4": "Articles and adjectives never break a pattern — they only add bonus.",
```

- [ ] **Step 3: Verify both files parse**

```powershell
node -e "JSON.parse(require('fs').readFileSync('locales/ko.json','utf8')); JSON.parse(require('fs').readFileSync('locales/en.json','utf8')); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```powershell
git add locales/ko.json locales/en.json
git commit -m "feat : add win-framing + WooDak line pools (i18n)"
```

---

### Task 4: GameOver — win framing

**Files:**
- Modify: `src/ui/components/GameOver.tsx:45-67`
- Modify: `src/ui/styles/screens.css` (after the `.go-title` rule, ~line 437)

**Interfaces:**
- Consumes: `gameover.won` (Task 2); i18n keys `gameover.wonTitle` / `wonBy` / `wonReached` (Task 3).
- Produces: card class `go-won` (styled here); the same component mounts `WooDakMascot` in Task 5.

- [ ] **Step 1: Branch the title and top panel**

In `GameOver.tsx`, after `const bestWord = stats.bestWord;` add:

```tsx
  const won = gameover.won;
```

Replace the card opening div and title:

```tsx
      <div className={['overlay-card', 'gameover', won ? 'go-won' : ''].filter(Boolean).join(' ')} role="dialog" aria-modal>
      <div className="go-title">{t(won ? 'gameover.wonTitle' : 'gameover.title')}</div>
```

Replace the defeat panel's label and reach line (the boss row and `go-score` stay as they are):

```tsx
        <span className="label">{t(won ? 'gameover.wonBy' : 'gameover.defeatedBy')}</span>
        <div className="go-defeat-row">
          {boss ? (
            <span className="go-boss">
              {boss.emoji} {lang === 'ko' ? boss.nameKo : boss.nameEn}
            </span>
          ) : (
            <span className="go-boss">{t(`blind.${gameover.blindKind}`)}</span>
          )}
          <span className="go-reach">
            {won
              ? t('gameover.wonReached', { ante: gameover.ante })
              : t('gameover.reached', { ante: gameover.ante, blind: t(`blind.${gameover.blindKind}`) })}
          </span>
        </div>
```

- [ ] **Step 2: Celebratory accent CSS**

In `src/ui/styles/screens.css`, directly after the `.go-title { ... }` rule, add:

```css
/* Win framing (spec 2026-07-19): same card, gold celebration accent. */
.go-won .go-title {
  color: var(--gold);
}
.overlay.gameover-overlay:has(.go-won) {
  background: rgba(52, 40, 6, 0.55);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: success. (Behavior is exercised end-to-end in Task 6.)

- [ ] **Step 4: Commit**

```powershell
git add src/ui/components/GameOver.tsx src/ui/styles/screens.css
git commit -m "feat : run-end screen win framing (Published!)"
```

---

### Task 5: WooDakMascot component + asset + CSS

**Files:**
- Create: `src/ui/assets/woodak.png` (copy of `docs/WooDak.png`)
- Create: `src/ui/components/WooDakMascot.tsx`
- Modify: `src/ui/components/GameOver.tsx` (import + mount beside the card)
- Modify: `src/ui/styles/screens.css` (after the shop-mascot block's 720px rule)

**Interfaces:**
- Consumes: `RunStats` type from `../useGame`; `woodak.*` keys (Task 3); shared `.mascot` / `.mascot-bubble` / `.mascot-cat` CSS (shop-mascot block).
- Produces: `WooDakMascot({ stats, won })` React component; classes `.go-mascot`, `.mascot-sway`, `.woodak-img`.

- [ ] **Step 1: Copy the asset**

```powershell
Copy-Item docs/WooDak.png src/ui/assets/woodak.png
```

- [ ] **Step 2: Create the component**

Create `src/ui/components/WooDakMascot.tsx`:

```tsx
import { useState } from 'react';
import { useI18n } from '../i18n';
import woodakUrl from '../assets/woodak.png';
import type { RunStats } from '../useGame';

/** Size of the woodak.tip.N generic pool in the locale files. */
const GENERIC_TIPS = 5;

/** Line priority (spec 2026-07-19): discoveries → stat-based tip → random tip. */
function pickLine(stats: RunStats): { key: string; params?: Record<string, number> } {
  if (stats.discoveries > 0) return { key: 'woodak.discovery', params: { n: stats.discoveries } };
  if (stats.rerollsUsed === 0) return { key: 'woodak.tip.reroll' };
  if (stats.tilesDiscarded === 0) return { key: 'woodak.tip.discard' };
  if (stats.itemsBought === 0) return { key: 'woodak.tip.shop' };
  return { key: `woodak.tip.${Math.floor(Math.random() * GENERIC_TIPS)}` };
}

/**
 * 우땅 (WooDak), the orangutan editor-mentor (spec 2026-07-19): run-end
 * companion with one contextual tip or discovery mention; a congratulation
 * leads on a win. UI-only cosmetic — Math.random is fine outside the engine.
 */
export function WooDakMascot({ stats, won }: { stats: RunStats; won: boolean }) {
  const { t } = useI18n();
  const [line] = useState(() => pickLine(stats));
  const text = (won ? `${t('woodak.won')} ` : '') + t(line.key, line.params);
  return (
    <div className="mascot go-mascot">
      <div className="mascot-bubble">{text}</div>
      <div className="mascot-sway">
        <img className="mascot-cat woodak-img" src={woodakUrl} alt="" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount it in GameOver**

In `GameOver.tsx`, add the import:

```tsx
import { WooDakMascot } from './WooDakMascot';
```

and render it as the overlay's first child, a SIBLING of the card (the
`.overlay` base style is already `display:flex; align-items:center;
justify-content:center`, so the mascot sits beside the card):

```tsx
    <div className="overlay gameover-overlay">
      <WooDakMascot stats={stats} won={gameover.won} />
      <div className={['overlay-card', 'gameover', won ? 'go-won' : ''].filter(Boolean).join(' ')} role="dialog" aria-modal>
```

- [ ] **Step 4: CSS — placement + sway**

In `src/ui/styles/screens.css`, directly after the shop-mascot block's closing `@media (max-width: 720px)` rule, add:

```css
/* ---------- Run-end mascot — 우땅/WooDak (spec 2026-07-19) ----------
   Sits beside the run-end card (overlay is already a centered flex row).
   Reuses the shared .mascot/.mascot-bubble grammar; adds a slow sway on a
   wrapper so it composes with the breathe squash on the img itself. */
.go-mascot {
  width: 190px;
  flex: none;
  margin-right: 18px;
}
.woodak-img {
  width: 150px;
}
.mascot-sway {
  animation: woodakSway 4s ease-in-out infinite;
  transform-origin: 50% 100%;
}
@keyframes woodakSway {
  0%,
  100% {
    transform: rotate(-1deg);
  }
  50% {
    transform: rotate(1deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mascot-sway {
    animation: none;
  }
}
@media (max-width: 720px) {
  .go-mascot {
    display: none;
  }
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/assets/woodak.png src/ui/components/WooDakMascot.tsx src/ui/components/GameOver.tsx src/ui/styles/screens.css
git commit -m "feat : WooDak run-end mascot (idle sway + contextual tip bubble)"
```

---

### Task 6: End-to-end verification + docs sync

**Files:**
- Modify: `docs/GDD.md` (§8.2 line ~397; §1.2 art note line ~42)
- Modify: `docs/screens-spec.md` (§2.7, lines ~72-79)
- Modify: `docs/UI_DESIGN.md` (append §6.1 after the Piyak §6 block)

**Interfaces:** none (docs + verification only).

- [ ] **Step 1: Verify in the running app (project verify skill)**

Follow `.claude/skills/verify/SKILL.md` (dev server + Playwright from the scratchpad, force-clicks for animated elements). Drive BOTH endings:

- **Loss:** fresh run, play weak/gibberish words until phases run out → run-end screen: red "Game Over" framing + 우땅 beside the card with a tip line (fresh run has 0 items bought etc. — a stat tip or discovery line appears; discoveries>0 shows the discovery line).
- **Win:** seed a near-win save: start a fresh run, play one word (so a mid-blind save exists), then read localStorage `wj.run`, edit the JSON envelope — `state.run.ante = 8`, `state.run.blindIndex = 2`, `state.blind.kind = 'boss'`, `state.blind.target = 10` (phase stays `'playing'`) — write it back, reload, Continue. Clear the blind with any word → "출간 완료!/Published!" gold framing, 우땅 congratulation + line, no Fee Settlement, no shop.
- Probes: reduced-motion (sway + breathe stop), 640px viewport (우땅 hidden), ko + en locales, reload on the run-end screen (not resumable — boots to menu with Continue disabled).

Expected: all observed; capture screenshots.

- [ ] **Step 2: GDD §8.2 — victory rule + endless status**

In `docs/GDD.md` line ~397, after the sentence ending "**A run = 8 antes + endless mode** (default, adopted as-is).", append to the same paragraph:

```markdown
**Victory (implemented):** clearing the ante-8 Deadline ends the run as a win — the engine flags it (`BlindOutcome.won`) while still paying out and advancing the run, and the UI routes to the run-end screen's win framing, skipping Fee Settlement and the shop. **Endless mode (planned, not yet implemented):** the win modal will gain an "무한 모드 →" button that routes into the normal Fee Settlement → shop flow and continues record-chasing chapters (ante 9+ target formula comes with it).
```

- [ ] **Step 3: GDD §1.2 art note — add 우땅**

In `docs/GDD.md` line ~42, after "…lives in the Stationery Shop (art: docs/Piyak.png)." append:

```markdown
A second mascot, **우땅 (WooDak)** — a pixel-art orangutan, the player's ally/editor-mentor — appears on the run-end screen with tips and discovery mentions, and will later host tutorials and notifications (art: docs/WooDak.png).
```

- [ ] **Step 4: screens-spec §2.7 — run-end screen**

Replace the `### 2.7 Game Over` heading and its intro line in `docs/screens-spec.md` with:

```markdown
### 2.7 Run End (Game Over / Published)
One screen, two framings on `gameover.won`: **loss** — red "Game Over", defeated-by panel; **win** — gold "출간 완료!/Published!", final-Deadline record panel; stats/seed/actions shared. A future **endless mode** button will join the action row (routing into Fee Settlement → shop; planned, not implemented). **우땅 (WooDak)**, the orangutan mentor mascot, stands beside the card (hidden ≤720px) with a speech bubble: discovery mention (`{n}` new words) → stat-based tip → random tip; a congratulation leads on a win. Idle = shared single-sprite breathe + slow sway. Art: `docs/WooDak.png` → `src/ui/assets/woodak.png`. Stats panel, translated to our terms:
```

(keep the existing stat bullets below it unchanged)

- [ ] **Step 5: UI_DESIGN §6.1 — WooDak companion note**

In `docs/UI_DESIGN.md`, append after the §6 Piyak block:

```markdown
### 6.1 Run-end mascot — 우땅 (WooDak), pixel-art orangutan mentor

The run-end screen (screens §2.7) has the game's second mascot: **우땅 (WooDak), the player's ally/editor-mentor** (art `docs/WooDak.png`, 1024×1054 transparent, shipped as `src/ui/assets/woodak.png`). Reuses the §6 mascot grammar verbatim (`.mascot`/`.mascot-bubble`, breathe keyframe, pixel bubble) plus a slow ±1° sway on a wrapper element; ~150px wide beside the run-end card, hidden ≤720px, frozen under reduced motion. Speech: one contextual line per run end (discoveries → stat tips → generic pool), congratulation prefix on a win; Korean voice tic "~우땅". Future roles (tutorial host, notifications) are planned, not implemented.
```

- [ ] **Step 6: Commit**

```powershell
git add docs/GDD.md docs/screens-spec.md docs/UI_DESIGN.md
git commit -m "docs : victory rule + endless status + WooDak mascot docs"
```
