# Cushion Depth + Sunken Overlap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate the cushion with real volume (top face / side wall / ground shadow) and render it in front of the cat, raised so its rim overlaps the cat's lower body.

**Architecture:** Generator v2 (PowerShell + System.Drawing, scratchpad-only) draws a 48×22 logical sprite with a 4-band shade ramp, inner top-face plateau and baked semi-transparent ground shadow, upscaled ×4. `ShopMascot.tsx` swaps the img order (cushion after cat = in front); CSS raises the cat so ~15-20px of its lower body sits behind the cushion rim. Offsets tuned by screenshot.

**Tech Stack:** PowerShell + System.Drawing, React 18, plain CSS.

**Spec:** `docs/superpowers/specs/2026-07-19-cushion-depth-design.md`

## Global Constraints

- Generator stays in the scratchpad, NOT committed; only the regenerated PNGs are (`src/ui/assets/piyak-cushion.png`, `docs/PiyakCushion.png` — same paths, overwrite).
- Beware PowerShell comma precedence: array elements built from arithmetic MUST be parenthesized — `@((2 + $i), (45 - $i))`, never `@(2 + $i, 45 - $i)` (that parse produced a blank sprite last round).
- Cat behavior (breathe, bubble, ≤720px hide) unchanged; WooDak untouched.
- Docs and code land in the same commit (CLAUDE.md protocol step 3).
- Verify via `.claude/skills/verify/SKILL.md`; offsets are EXPECTED to need 1–2 tuning iterations from the screenshot.

---

### Task 1: Asset v2 + z-order + raise + doc line

**Files:**
- Create (overwrite): `src/ui/assets/piyak-cushion.png`, `docs/PiyakCushion.png`
- Modify: `src/ui/components/ShopMascot.tsx` (img order)
- Modify: `src/ui/styles/screens.css` (`.mascot-cushion`, `.mascot-seat .mascot-cat`)
- Modify: `docs/UI_DESIGN.md` §6 cushion phrase

**Interfaces:**
- Consumes: existing `.mascot-seat` / `.mascot-cushion` / `.mascot-cat` classes.
- Produces: no new names; regenerated asset at the same import path.

- [ ] **Step 1: Generator v2**

Save as `<scratchpad>/make-cushion-v2.ps1`, run with `. ./make-cushion-v2.ps1` in the tool shell:

```powershell
Add-Type -AssemblyName System.Drawing
$w = 48; $h = 22
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$outline   = [System.Drawing.Color]::FromArgb(255, 150, 74, 110)
$sideBase  = [System.Drawing.Color]::FromArgb(255, 232, 147, 182)
$sideShade = [System.Drawing.Color]::FromArgb(255, 201, 115, 157)
$deepShade = [System.Drawing.Color]::FromArgb(255, 176, 94, 134)
$topFace   = [System.Drawing.Color]::FromArgb(255, 244, 168, 196)
$topHi     = [System.Drawing.Color]::FromArgb(255, 251, 210, 225)
$ground    = [System.Drawing.Color]::FromArgb(80, 0, 0, 0)

# baked ground shadow (rows 18-19), narrower each row
for ($y = 18; $y -le 19; $y++) {
  $ins = 4 + (($y - 18) * 3)
  for ($x = (2 + $ins); $x -le (45 - $ins); $x++) { $bmp.SetPixel($x, $y, $ground) }
}

# pillow silhouette rows 2..17 (superellipse insets)
$rows = @{}
for ($y = 2; $y -le 17; $y++) {
  $t = [math]::Abs(($y - 9.5) / 7.5)
  $inset = [int][math]::Round(9 * [math]::Pow($t, 2.5))
  $rows[$y] = @((2 + $inset), (45 - $inset))
}
foreach ($y in ($rows.Keys | Sort-Object)) {
  $x0 = $rows[$y][0]; $x1 = $rows[$y][1]
  for ($x = $x0; $x -le $x1; $x++) {
    $edge = ($x -eq $x0 -or $x -eq $x1 -or -not $rows.ContainsKey([int]($y - 1)) -or -not $rows.ContainsKey([int]($y + 1)) -or
             $x -lt $rows[[int]($y - 1)][0] -or $x -gt $rows[[int]($y - 1)][1] -or
             $x -lt $rows[[int]($y + 1)][0] -or $x -gt $rows[[int]($y + 1)][1])
    if ($edge) { $bmp.SetPixel($x, $y, $outline); continue }
    if ($y -ge 15) { $bmp.SetPixel($x, $y, $deepShade) }
    elseif ($y -ge 12) { $bmp.SetPixel($x, $y, $sideShade) }
    else { $bmp.SetPixel($x, $y, $sideBase) }
  }
}
# inner top-face plateau (rows 3..11, inset 3 inside the silhouette)
for ($y = 3; $y -le 11; $y++) {
  $x0 = $rows[$y][0] + 3; $x1 = $rows[$y][1] - 3
  for ($x = $x0; $x -le $x1; $x++) {
    if ($y -le 5) { $bmp.SetPixel($x, $y, $topHi) } else { $bmp.SetPixel($x, $y, $topFace) }
  }
}
# stitch dots on the side wall
foreach ($p in @(@(6, 13), @(41, 13))) { $bmp.SetPixel($p[0], $p[1], $outline) }

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

Then `Copy-Item src/ui/assets/piyak-cushion.png docs/PiyakCushion.png`.
Read the PNG to review: top-face plateau + side wall + ground shadow must read as volume; iterate palette/insets if muddy.

- [ ] **Step 2: Z-order swap**

In `src/ui/components/ShopMascot.tsx`, swap the two imgs inside `.mascot-seat` (cushion now AFTER the cat = rendered in front):

```tsx
      <div className="mascot-seat">
        <img className="mascot-cat" src={piyakUrl} alt="" />
        <img className="mascot-cushion" src={cushionUrl} alt="" />
      </div>
```

- [ ] **Step 3: CSS — raise the cat behind the rim**

In `src/ui/styles/screens.css`, replace the cushion-block rules:

```css
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

with:

```css
.mascot-cushion {
  position: absolute;
  bottom: 0;
  width: 160px;
  image-rendering: pixelated;
  /* in front of the cat (DOM order) so the rim overlaps his lower body */
}
.mascot-seat .mascot-cat {
  /* raised so ~15-20px of the lower body sits behind the cushion rim —
     the sunken-into-the-cushion look; tuned by screenshot */
  margin-bottom: 46px;
}
```

(`position: relative` on the cat is dropped — the cushion must win the stack.)

- [ ] **Step 4: Verify + tune**

`npm run build` → success. Then per `.claude/skills/verify/SKILL.md`: clear a blind, screenshot the shop. Check: cushion rim in front of the cat's lower body (sunken look, not "floating cat" and not "cat buried"), ground shadow visible, bubble clear. Adjust `margin-bottom` (and cushion `bottom` if needed) and re-screenshot until it reads right; expect 1–2 iterations.

- [ ] **Step 5: Doc line + commit**

In `docs/UI_DESIGN.md` §6 Placement bullet, change "lying on a pixel-art pink cushion" to "lying sunken into a pixel-art pink cushion (rim overlaps his lower body; top-face/side shading + ground shadow)".

```powershell
git add src/ui/assets/piyak-cushion.png docs/PiyakCushion.png src/ui/components/ShopMascot.tsx src/ui/styles/screens.css docs/UI_DESIGN.md
git commit -m "feat : cushion v2 - volume shading + sunken overlap under Piyak"
```
