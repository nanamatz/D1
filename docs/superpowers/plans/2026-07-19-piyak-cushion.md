# Piyak Pink Cushion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Piyak in the shop rail lies on a generated pixel-art pink cushion.

**Architecture:** A throwaway PowerShell script (System.Drawing, no deps) draws a 48×20 logical-pixel pillow and scales it ×4 nearest-neighbor to a 192×80 PNG. `ShopMascot.tsx` wraps the cat in a `.mascot-seat` container with the cushion `<img>` behind/below; the cat is nudged down so its body overlaps the cushion's top edge. Breathe stays on the cat only.

**Tech Stack:** PowerShell + System.Drawing (asset generation), React 18, plain CSS.

**Spec:** `docs/superpowers/specs/2026-07-19-piyak-cushion-design.md`

## Global Constraints

- The generator script is throwaway (scratchpad), NOT committed; only the PNGs are: `src/ui/assets/piyak-cushion.png` + reference copy `docs/PiyakCushion.png`.
- `image-rendering: pixelated` on the cushion; cat behavior (breathe, bubble, ≤720px hide) unchanged; run-end WooDak untouched.
- Docs and code land in the same change (CLAUDE.md protocol step 3).
- No test harness applies — verify via `.claude/skills/verify/SKILL.md` (shop screen reachable by clearing one blind).

---

### Task 1: Generate asset, wire component + CSS, doc line

**Files:**
- Create: `src/ui/assets/piyak-cushion.png` (generated), `docs/PiyakCushion.png` (copy)
- Modify: `src/ui/components/ShopMascot.tsx`
- Modify: `src/ui/styles/screens.css` (shop-mascot block)
- Modify: `docs/UI_DESIGN.md` §6 placement bullet

**Interfaces:**
- Consumes: existing `.mascot`/`.mascot-cat` classes and `ShopMascot` markup.
- Produces: classes `.mascot-seat`, `.mascot-cushion`; asset `src/ui/assets/piyak-cushion.png`.

- [ ] **Step 1: Generate the cushion PNG**

Save as `<scratchpad>/make-cushion.ps1` and run it (`powershell -File make-cushion.ps1`):

```powershell
Add-Type -AssemblyName System.Drawing
$w = 48; $h = 20
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$outline = [System.Drawing.Color]::FromArgb(255, 150, 74, 110)
$base    = [System.Drawing.Color]::FromArgb(255, 244, 168, 196)
$hi      = [System.Drawing.Color]::FromArgb(255, 251, 201, 220)
$shade   = [System.Drawing.Color]::FromArgb(255, 217, 135, 171)

# pillow silhouette: superellipse row insets over rows 2..17
$rows = @{}
for ($y = 2; $y -le 17; $y++) {
  $t = [math]::Abs(($y - 9.5) / 7.5)
  $inset = [int][math]::Round(9 * [math]::Pow($t, 2.5))
  $rows[$y] = @(2 + $inset, 45 - $inset)
}
foreach ($y in $rows.Keys) {
  $x0 = $rows[$y][0]; $x1 = $rows[$y][1]
  for ($x = $x0; $x -le $x1; $x++) {
    $edge = ($x -eq $x0 -or $x -eq $x1 -or -not $rows.ContainsKey($y - 1) -or -not $rows.ContainsKey($y + 1) -or
             $x -lt $rows[[int]($y - 1)][0] -or $x -gt $rows[[int]($y - 1)][1] -or
             $x -lt $rows[[int]($y + 1)][0] -or $x -gt $rows[[int]($y + 1)][1])
    if ($edge) { $bmp.SetPixel($x, $y, $outline) }
    elseif ($y -ge 13) { $bmp.SetPixel($x, $y, $shade) }
    elseif ($y -le 7 -and $x -le ($x0 + 12)) { $bmp.SetPixel($x, $y, $hi) }
    else { $bmp.SetPixel($x, $y, $base) }
  }
}
# corner stitch dots
foreach ($p in @(@(4,5), @(43,5), @(4,14), @(43,14))) { $bmp.SetPixel($p[0], $p[1], $outline) }

# x4 nearest-neighbor upscale
$big = New-Object System.Drawing.Bitmap(($w * 4), ($h * 4))
$g = [System.Drawing.Graphics]::FromImage($big)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.DrawImage($bmp, 0, 0, ($w * 4), ($h * 4))
$g.Dispose()
$big.Save("C:\Users\owner\Documents\GitHub\D1\src\ui\assets\piyak-cushion.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $big.Dispose()
'saved'
```

Then: `Copy-Item src/ui/assets/piyak-cushion.png docs/PiyakCushion.png`

- [ ] **Step 2: Review the art**

Read `src/ui/assets/piyak-cushion.png` (it renders as an image). It should read as a flat pink pillow with outline, top-left highlight, bottom shade, stitch dots. If it looks wrong (silhouette too round/flat, colors muddy), tweak the palette/inset power in the script and regenerate before proceeding.

- [ ] **Step 3: Wire the component**

In `src/ui/components/ShopMascot.tsx`, add the import:

```tsx
import cushionUrl from '../assets/piyak-cushion.png';
```

and replace the cat `<img>` line with a seat container (bubble stays above):

```tsx
      <div className="mascot-seat">
        <img className="mascot-cushion" src={cushionUrl} alt="" />
        <img className="mascot-cat" src={piyakUrl} alt="" />
      </div>
```

- [ ] **Step 4: CSS**

In `src/ui/styles/screens.css`, directly after the `.mascot-cat { ... }` rule in the shop-mascot block, add:

```css
/* Piyak lies on a pink cushion (spec 2026-07-19): cushion behind/below, the
   cat overlaps its top edge; breathe stays on the cat only. */
.mascot-seat {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}
.mascot-cushion {
  position: absolute;
  bottom: 0;
  width: 160px;
  image-rendering: pixelated;
}
.mascot-seat .mascot-cat {
  position: relative; /* stack above the cushion */
  margin-bottom: 10px; /* sit on the pillow, front edge showing below */
}
```

- [ ] **Step 5: Build + verify in the running app**

Run: `npm run build` → success.
Per `.claude/skills/verify/SKILL.md`: clear one blind, enter the shop. Observe: cushion under Piyak (slightly wider, front edge visible below the cat), bubble unobstructed, breathe still animating the cat only, ≤720px hides everything. Screenshot. Also confirm the run-end screen (WooDak) is unchanged.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/assets/piyak-cushion.png docs/PiyakCushion.png src/ui/components/ShopMascot.tsx src/ui/styles/screens.css docs/UI_DESIGN.md
git commit -m "feat : Piyak lies on a pixel-art pink cushion"
```

(Include in the same commit the UI_DESIGN §6 placement bullet edit: append ", lying on a pixel-art pink cushion (`src/ui/assets/piyak-cushion.png`, generated in-house)" to the **Placement (shipped)** bullet.)
