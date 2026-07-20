# Guided First-Run Intro (A-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 6-step passive coach-mark walkthrough that spotlights core play-screen controls on a player's first run, narrated by WooDak — skippable, re-playable from Help, never soft-locks.

**Architecture:** `tutorial.ts` gains an intro seen-flag (`wj.tutorialIntro`) + an `INTRO_STEPS` table (step key → CSS selector). A `GuidedIntro` component (mounted in RunView's playing board) measures the current step's target via `getBoundingClientRect()` and renders a `box-shadow` spotlight + a WooDak bubble with Next/Skip. RunView opens it on first play-screen entry when tips are on and it hasn't been seen. Options → Help gets a "Replay tutorial" button that resets the flag.

**Tech Stack:** TypeScript strict, React, plain CSS (reuses `.mascot-bubble` grammar + woodak.png), Vitest.

## Global Constraints

- Engine (`src/engine/`) untouched — pure presentation (`src/ui/`).
- Passive walkthrough: NO step requires performing the action — advance is always via the bubble's Next button. Never soft-lock; a missing target falls back to a centered bubble.
- Intro seen-flag in localStorage `wj.tutorialIntro` (try/catch-guarded, like the rest of `tutorial.ts`); distinct from `wj.tutorial` (encounter flags), `wj.collection`, `wj.settings`.
- Intro gates on `readTips()` (tips-off opts out, consistent with the A-2 popup layer) AND `!hasSeenIntro()`.
- Copy is i18n single-source: `intro.step.<key>.title` / `intro.step.<key>.body` + `intro.next`/`intro.skip`/`intro.done` + `help.replayIntro` (+ its confirmation). Body may use richtext `[c:]/[m:]/[b:]`.
- Reuse existing patterns: `src/ui/tutorial.ts` store idiom, `WooDakMascot`'s `.mascot`/`.mascot-bubble`/`.mascot-sway` markup + `woodakUrl`, the registry-sync test idiom for copy coverage.
- TypeScript strict; `npx tsc --noEmit` clean; full `npx vitest run` stays green.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `tutorial.ts` — intro seen-flag + INTRO_STEPS table

**Files:**
- Modify: `src/ui/tutorial.ts`
- Test: extend `tests/tutorial-store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface IntroStep { key: string; selector: string }`
  - `export const INTRO_STEPS: readonly IntroStep[]` (6 steps)
  - `hasSeenIntro(): boolean`, `markIntroSeen(): void`, `resetIntro(): void`

- [ ] **Step 1: Write the failing test** — append to `tests/tutorial-store.test.ts` (the file already installs a localStorage shim in `beforeEach` and calls `resetTutorial()`; add `resetIntro()` to that beforeEach too so intro state is clean per test):

```ts
import { hasSeenIntro, markIntroSeen, resetIntro, INTRO_STEPS } from '../src/ui/tutorial';

describe('guided intro flag (A-1)', () => {
  it('hasSeenIntro is false until marked, true after, reset clears it', () => {
    resetIntro();
    expect(hasSeenIntro()).toBe(false);
    markIntroSeen();
    expect(hasSeenIntro()).toBe(true);
    resetIntro();
    expect(hasSeenIntro()).toBe(false);
  });

  it('INTRO_STEPS has 6 steps, each with a key and a selector', () => {
    expect(INTRO_STEPS.length).toBe(6);
    for (const s of INTRO_STEPS) {
      expect(s.key).toBeTruthy();
      expect(s.selector.startsWith('.')).toBe(true);
    }
    // keys are unique
    expect(new Set(INTRO_STEPS.map((s) => s.key)).size).toBe(6);
  });
});
```

Also add `resetIntro()` to the existing `beforeEach` (next to `resetTutorial()`).

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/tutorial-store.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** — add to `src/ui/tutorial.ts` (after the encounter store functions):

```ts
// ----- Guided first-run intro (A-1) — a separate one-shot flag -----
const INTRO_KEY = 'wj.tutorialIntro';

export interface IntroStep {
  /** stable key → i18n copy `intro.step.<key>.title/.body` */
  key: string;
  /** CSS selector of the play-screen element to spotlight */
  selector: string;
}

/** The 6 core-loop steps, in order (selectors verified in the play screen). */
export const INTRO_STEPS: readonly IntroStep[] = [
  { key: 'hand', selector: '.hand' },
  { key: 'score', selector: '.score-panel' },
  { key: 'target', selector: '.bs-target' },
  { key: 'discard', selector: '.discard-btn' },
  { key: 'tray', selector: '.tray' },
  { key: 'clear', selector: '.round-panel' },
];

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) !== null;
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_KEY, String(Date.now()));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function resetIntro(): void {
  try {
    localStorage.removeItem(INTRO_KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/tutorial-store.test.ts` → PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tutorial.ts tests/tutorial-store.test.ts
git commit -m "feat : guided-intro seen-flag + INTRO_STEPS table (A-1 foundation)"
```

---

### Task 2: i18n copy for the 6 intro steps + buttons

**Files:**
- Modify: `locales/en.json`, `locales/ko.json`
- Test: extend `tests/tutorial-store.test.ts` (intro copy coverage)

**Interfaces:**
- Consumes: `INTRO_STEPS` (Task 1).
- Produces: `intro.step.<key>.title/.body` for all 6, plus `intro.next`/`intro.skip`/`intro.done`, in both locales.

- [ ] **Step 1: Write the failing test** — append to `tests/tutorial-store.test.ts`:

```ts
describe('guided intro copy coverage', () => {
  it('every intro step + button has copy in both locales', () => {
    for (const loc of [en, ko] as Record<string, string>[]) {
      for (const s of INTRO_STEPS) {
        expect(loc).toHaveProperty(`intro.step.${s.key}.title`);
        expect(loc).toHaveProperty(`intro.step.${s.key}.body`);
      }
      for (const k of ['intro.next', 'intro.skip', 'intro.done']) {
        expect(loc).toHaveProperty(k);
      }
    }
  });
});
```

(`en`/`ko` are already imported in this file from Task 2 of the previous slice.)

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/tutorial-store.test.ts` → FAIL.

- [ ] **Step 3: Add copy** — `locales/en.json`:

```json
  "intro.next": "Next",
  "intro.skip": "Skip tutorial",
  "intro.done": "Got it!",
  "intro.step.hand.title": "Spell a word",
  "intro.step.hand.body": "Click letter tiles in your hand to stage them into a word, then submit. This is how you score.",
  "intro.step.score.title": "Chips × Mult",
  "intro.step.score.body": "A played word settles as [c:chips] × [m:mult]. Watch the tally build up beat by beat.",
  "intro.step.target.title": "Reach the target",
  "intro.step.target.body": "Beat the [b:blind]'s target score. Your committed score climbs with every word you play.",
  "intro.step.discard.title": "Discard to dig",
  "intro.step.discard.body": "Stuck with an awkward hand? Right-click tiles to mark them, then Discard to swap them — limited per blind.",
  "intro.step.tray.title": "Build a sentence",
  "intro.step.tray.body": "The words you play line up into a sentence. Finish a grammatical pattern for a big bonus.",
  "intro.step.clear.title": "Auto-settle",
  "intro.step.clear.body": "Once your projected score clears the target, the blind settles itself. That's the loop — good luck!",
```

`locales/ko.json` (glossary: 초고/퇴고/마감, 원고료, 보따리; suit=접미):

```json
  "intro.next": "다음",
  "intro.skip": "튜토리얼 건너뛰기",
  "intro.done": "알겠어요!",
  "intro.step.hand.title": "단어 만들기",
  "intro.step.hand.body": "손패의 글자 타일을 클릭해 단어로 조합한 뒤 제출하세요. 이렇게 점수를 냅니다.",
  "intro.step.score.title": "칩 × 배수",
  "intro.step.score.body": "낸 단어는 [c:칩] × [m:배수]로 정산됩니다. 한 박자씩 쌓이는 정산을 지켜보세요.",
  "intro.step.target.title": "목표 점수 달성",
  "intro.step.target.body": "[b:블라인드]의 목표 점수를 넘기세요. 확정 점수는 단어를 낼 때마다 올라갑니다.",
  "intro.step.discard.title": "버려서 새로 뽑기",
  "intro.step.discard.body": "손패가 애매한가요? 타일을 우클릭해 표시한 뒤 버리기로 교체하세요 — 블라인드당 횟수 제한이 있습니다.",
  "intro.step.tray.title": "문장 만들기",
  "intro.step.tray.body": "낸 단어들이 문장으로 이어집니다. 문법 패턴을 완성하면 큰 보너스가 붙습니다.",
  "intro.step.clear.title": "자동 정산",
  "intro.step.clear.body": "예상 점수가 목표를 넘으면 블라인드가 스스로 정산됩니다. 이게 핵심 루프예요 — 행운을 빕니다!",
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/tutorial-store.test.ts` → PASS; full `npx vitest run` (JSON parses); `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/ko.json tests/tutorial-store.test.ts
git commit -m "feat : guided-intro copy (6 steps + buttons, ko/en) + coverage test"
```

---

### Task 3: `GuidedIntro` component + spotlight CSS

**Files:**
- Create: `src/ui/components/GuidedIntro.tsx`
- Modify: `src/ui/styles/screens.css` (spotlight + bubble block)

**Interfaces:**
- Consumes: `INTRO_STEPS`, `markIntroSeen` (Task 1); copy (Task 2); `woodakUrl`, `richText`, `useI18n`.
- Produces: `export function GuidedIntro({ onClose }: { onClose: () => void }): JSX.Element` — the caller renders it inside the play board and passes an `onClose` that clears its own open-state. The component calls `markIntroSeen()` before `onClose()` on finish/skip.

- [ ] **Step 1: Implement `src/ui/components/GuidedIntro.tsx`**

```tsx
import { type CSSProperties, useCallback, useLayoutEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { INTRO_STEPS, markIntroSeen } from '../tutorial';
import woodakUrl from '../assets/woodak.png';

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Guided first-run walkthrough (work order A-1). Passive coach-marks: dims the
 * board, spotlights the current step's target (measured live), and narrates it
 * with a WooDak bubble. Advance is always via Next — never gated on the player
 * performing the action, so it can't soft-lock. A missing target falls back to a
 * centered bubble. Mounted inside the play board so the target selectors resolve.
 */
export function GuidedIntro({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cur = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;

  const measure = useCallback(() => {
    const el = document.querySelector(INTRO_STEPS[step]!.selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const finish = () => { markIntroSeen(); onClose(); };
  const next = () => { if (last) finish(); else setStep((s) => s + 1); };

  const pad = 8;
  const box = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  // Place the bubble below the target when there's room, else above; centered w/o a rect.
  const belowRoom = rect ? rect.top + rect.height + 200 < window.innerHeight : true;
  const wrapStyle: CSSProperties | undefined = rect
    ? {
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
        ...(belowRoom
          ? { top: rect.top + rect.height + pad + 12 }
          : { bottom: window.innerHeight - rect.top + pad + 12 }),
      }
    : undefined;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      {box && (
        <div
          className="intro-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div
        className={['intro-wrap', rect ? '' : 'center'].filter(Boolean).join(' ')}
        style={wrapStyle}
      >
        <div className="mascot intro-mascot">
          <div className="mascot-bubble intro-bubble">
            <div className="intro-title">{t(`intro.step.${cur.key}.title`)}</div>
            <p className="intro-body">{richText(t(`intro.step.${cur.key}.body`))}</p>
            <div className="intro-actions">
              <button className="btn sm intro-skip" onClick={finish}>{t('intro.skip')}</button>
              <span className="intro-dots">{step + 1} / {INTRO_STEPS.length}</span>
              <button className="btn blue sm intro-next" onClick={next}>
                {last ? t('intro.done') : t('intro.next')}
              </button>
            </div>
          </div>
          <div className="mascot-sway">
            <img className="mascot-cat woodak-img" src={woodakUrl} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

(If `.btn sm` isn't an existing size variant, use plain `.btn` — grep `btn sm` in the components/CSS first; the exchange buttons use `btn exchange sm`, so `sm` exists.)

- [ ] **Step 2: CSS** — append to `src/ui/styles/screens.css`:

```css
/* ---------- guided first-run intro (work order A-1) ---------- */
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 70; /* above tutorial popups (60) and pause */
  pointer-events: auto; /* swallow board clicks; advance only via the bubble */
}
.intro-spot {
  position: fixed;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62);
  outline: 3px solid var(--accent, #ffd76a);
  pointer-events: none;
  transition: top 0.2s, left 0.2s, width 0.2s, height 0.2s;
}
.intro-wrap {
  position: fixed;
  width: min(360px, 88vw);
  pointer-events: auto;
}
.intro-wrap.center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.intro-bubble { text-align: left; }
.intro-title { font-weight: 700; font-size: 15px; margin-bottom: 6px; }
.intro-body { font-size: 13px; line-height: 1.5; margin-bottom: 10px; }
.intro-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.intro-dots { font-size: 12px; opacity: 0.7; }
```

(Confirm `--accent` exists in tokens.css; if not, use the established highlight token — grep `--accent`/`--gold` in tokens.css and substitute, noting it.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green (no new unit test — the component is DOM/measurement, covered by the Task 5 in-app smoke).

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/GuidedIntro.tsx src/ui/styles/screens.css
git commit -m "feat : GuidedIntro component — spotlight coach-marks with WooDak"
```

---

### Task 4: Trigger in RunView + "Replay tutorial" in Help

**Files:**
- Modify: `src/ui/components/RunView.tsx` (open the intro on first play-screen entry; render it in the board)
- Modify: `src/ui/components/Options.tsx` (Help "Replay tutorial" button)
- Modify: `locales/en.json`, `locales/ko.json` (`help.replayIntro`, `help.replayIntroDone`)

**Interfaces:**
- Consumes: `GuidedIntro` (Task 3); `hasSeenIntro`, `resetIntro` (Task 1); `readTips` (settings).
- Produces: nothing.

- [ ] **Step 1: RunView trigger** — READ `src/ui/components/RunView.tsx` first. Add imports:

```ts
import { useState } from 'react'; // if not already importing useState
import { GuidedIntro } from './GuidedIntro';
import { hasSeenIntro } from '../tutorial';
import { readTips } from '../settings';
```

Add open-state + a first-entry effect (near the other phase effects):

```ts
  const [introOpen, setIntroOpen] = useState(false);
  useEffect(() => {
    if (phase === 'playing' && !hasSeenIntro() && readTips()) setIntroOpen(true);
  }, [phase]);
```

Render it inside the playing board `frame` return (as a sibling of `SettleProvider`/overlays, so the target selectors are mounted). Only while actually playing (not ending/settling):

```tsx
      {!ending && !settling && introOpen && (
        <GuidedIntro onClose={() => setIntroOpen(false)} />
      )}
```

- [ ] **Step 2: Help "Replay tutorial" button** — in `src/ui/components/Options.tsx` `HelpView`, add `resetIntro` to the tutorial import (`import { ENCOUNTERS, hasSeen, resetIntro, type EncounterGroup } from '../tutorial';`) and a small local state + button at the top of the Help view:

```tsx
  const { t } = useI18n();
  const [replayed, setReplayed] = useState(false);
  // ... existing groups ...
  return (
    <>
      <h2 className="scr-title">{t('help.title')}</h2>
      <div className="help-replay">
        <button
          className="btn exchange sm"
          onClick={() => { resetIntro(); setReplayed(true); }}
        >
          {t('help.replayIntro')}
        </button>
        {replayed && <span className="help-replay-note">{t('help.replayIntroDone')}</span>}
      </div>
      <div className="help-groups">
        {/* ... */}
```

(Import `useState` in Options.tsx if not already imported — it is, the file uses it.)

Copy — en: `"help.replayIntro": "Replay tutorial"`, `"help.replayIntroDone": "The tutorial will play again next time you enter a blind."`; ko: `"help.replayIntro": "튜토리얼 다시 보기"`, `"help.replayIntroDone": "다음 블라인드에 들어가면 튜토리얼이 다시 표시됩니다."`.

Optional tiny CSS (append to screens.css): `.help-replay { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; } .help-replay-note { font-size: 12px; opacity: 0.75; }`

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green; JSON valid.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/RunView.tsx src/ui/components/Options.tsx locales/en.json locales/ko.json src/ui/styles/screens.css
git commit -m "feat : trigger guided intro on first play entry + Replay-tutorial button in Help"
```

---

### Task 5: End-to-end verification + docs

**Files:**
- Verify: the running app.
- Modify: `docs/screens-spec.md` only if a tutorial PLACEHOLDER remains to close (grep first).

- [ ] **Step 1: Full green** — `npx vitest run` (incl. tutorial-store) and `npx tsc --noEmit` clean.

- [ ] **Step 2: In-app smoke (Playwright)** — fresh profile:
  - (a) Start a run → on the first play screen the `.intro-overlay` auto-appears with step 1 (`.intro-spot` present, bubble shows step "1 / 6"). Assert no console errors.
  - (b) Click Next 5× → dots advance 2/6…6/6, the last button reads `intro.done`; clicking it closes the overlay (`.intro-overlay` gone).
  - (c) Reload / start another run → NO `.intro-overlay` (seen).
  - (d) Options → Help → click "Replay tutorial"; the confirmation note shows. Start a run → intro re-appears.
  - (e) Fresh profile with tips off (seed `wj.settings` `tips:false`) → start a run → NO intro overlay.
  - Screenshot step 1 and a mid-step to confirm the spotlight tracks different targets.
  - If the spotlight rect is visibly off (targets measured before layout settles), add a one-frame `requestAnimationFrame` re-measure in GuidedIntro and note it.

- [ ] **Step 3: Docs** — `grep -rn "PLACEHOLDER\|A-1\|guided" docs/screens-spec.md`; if a §2.x line still calls the guided intro a placeholder / "planned", update it to shipped (feature-01 A-1). Keep to changed lines. (If the file carries unrelated pre-staged edits, leave those — commit only if a genuine tutorial line needs closing; otherwise skip the docs commit.)

- [ ] **Step 4: Commit** (only if a doc line changed)

```bash
git add docs
git commit -m "docs : guided first-run intro (A-1) shipped"
```
