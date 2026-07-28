import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const component = readFileSync('src/ui/components/DeskObjects.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');
const audio = readFileSync('src/ui/audio.ts', 'utf8');

describe('ambient coffee cup interaction', () => {
  it('uses the pixel-art asset and a separately animated liquid layer', () => {
    expect(component).toContain("import coffeeCup from '../assets/desk-coffee-cup.png'");
    expect(component).toContain('className="desk-coffee-liquid"');
    expect(component).toContain('onClick={drinkCoffee}');
    expect(css).toContain('@keyframes coffee-drain');
    expect(css).toContain('.desk-cup.desk-drinking .desk-coffee-liquid');
  });

  it('emits staggered pixel steam until the coffee is drunk', () => {
    expect(component).toContain('className="desk-coffee-steam"');
    expect(css).toContain('@keyframes coffee-steam-rise');
    expect(css).toContain('.desk-coffee-steam i:nth-child(3)');
    expect(css).toMatch(/\.desk-cup\.desk-drinking \.desk-coffee-steam\s*\{[^}]*opacity:\s*0/s);
  });

  it('sets the cup down from above and makes it larger than the old glyph', () => {
    expect(css).toContain('@keyframes desk-cup-down');
    expect(css).toContain('translateY(calc(-100vh - 110%))');
    expect(css).toContain('width: clamp(112px, 11vw, 168px)');
  });

  it('stacks each side independently into three bottom-up height zones', () => {
    expect(component).toContain('const liveObjects = [cup, bell, encounter]');
    expect(component).toContain("const sideStack = (side: DeskObj['side'])");
    expect(component).toContain('liveObjects.filter((obj) => obj.side === side)');
    expect(component).toContain('`desk-slot-${sideStack(obj.side).indexOf(obj)}`');
    expect(component).not.toContain('style={{ top:');
    expect(css).toContain('.desk-slot-0');
    expect(css).toContain('.desk-slot-1');
    expect(css).toContain('.desk-slot-2');
    expect(css).toMatch(/\.desk-right\s*\{[^}]*--desk-stack-base:\s*max\(136px,\s*14vh\)/s);
    expect(css).toContain('transition: bottom 0.34s steps(6, end)');
  });

  it('finishes the slurp into a persistent empty-cup state', () => {
    expect(component).toContain('setCupDrinking(true)');
    expect(component).toContain('setCupEmpty(true)');
    expect(component).toContain('setCupDrinking(false)');
    expect(component).not.toContain('setTimeout(finishEncounter, 1480)');
    expect(css).toContain('.desk-cup.desk-empty .desk-coffee-liquid');
    expect(audio).toMatch(/deskCup:\s+\{[^}]*dur:\s*0\.68/s);
  });

  it('keeps persistent fixtures while waiting longer between transient encounters', () => {
    expect(component).toContain('ENCOUNTER_GAP_MIN_MS = 70_000');
    expect(component).toContain('ENCOUNTER_GAP_SPREAD_MS = 70_000');
    expect(component).toContain('setEncounterCycle((n) => n + 1)');
    expect(component).toContain('setCup(next)');
    expect(component).toContain('setBell(next)');
  });

  it('limits the pool to cup, call-bell, blank-check, and conditional refill encounters', () => {
    expect(component).toContain("type DeskKind = 'cup' | 'bell' | 'check' | 'refill'");
    expect(component).toContain("{ kind: 'bell', sfx: 'deskBell' }");
    expect(component).toContain("{ kind: 'check', sfx: 'deskCheck' }");
    expect(component).not.toContain("'pencil'");
    expect(component).not.toContain("'plane'");
    expect(component).toContain("import callBell from '../assets/desk-call-bell.png'");
    expect(component).toContain("import blankCheck from '../assets/desk-blank-check.png'");
  });

  it('rings repeatedly without removing the persistent call bell', () => {
    expect(component).toContain("bellRinging && 'desk-ringing'");
    expect(component).toContain('className="desk-bell-art desk-bell-switch"');
    expect(component).toContain('later(() => setBellRinging(false), 760)');
    expect(component).not.toContain('setTimeout(finishEncounter, 1340)');
    expect(css).toContain('clip-path: inset(12% 36% 75% 39%)');
    expect(css).toContain('@keyframes call-bell-ring');
    expect(css).toContain('@keyframes call-bell-switch-press');
    expect(css).toContain('.desk-bell.desk-ringing .desk-bell-switch');
    expect(css).toContain('@keyframes call-bell-waves');
    expect(audio).toMatch(/deskBell:\s+\{[^}]*dur:\s*0\.92/s);
    expect(audio).not.toContain('deskPencil:');
    expect(audio).not.toContain('deskPlane:');
  });

  it('requires a deliberate pointer-drag signature before the blank check exits', () => {
    expect(component).toContain("encounterInteracting && encounter.kind === 'check' && 'desk-signing'");
    expect(component).toContain('className="desk-check-sign-zone"');
    expect(component).toContain('className="desk-check-signature"');
    expect(component).toContain('onPointerDown={beginSignature}');
    expect(component).toContain('onPointerMove={drawSignature}');
    expect(component).toContain('onPointerUp={endSignature}');
    expect(component).toContain('onPointerCancel={cancelSignature}');
    expect(component).toContain('event.currentTarget.setPointerCapture(event.pointerId)');
    expect(component).toContain('distance < SIGNATURE_MIN_DISTANCE');
    expect(component).toContain('points.length < SIGNATURE_MIN_POINTS');
    expect(component).toContain('later(() => setEncounterLeaving(true), 320)');
    expect(component).toContain('later(finishEncounter, 900)');
    expect(component).toContain('<polyline');
    expect(component).not.toContain('M3 29 C12 7');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('.desk-check.desk-drawing .desk-check-pen');
    expect(css).not.toContain('@keyframes check-signature-draw');
    expect(css).not.toContain('@keyframes check-pen-write');
    expect(audio).toMatch(/deskCheck:\s+\{[^}]*dur:\s*1\.05/s);
  });

  it('offers a rare refill encounter only while the persistent cup is empty', () => {
    expect(component).toContain('const REFILL_CHANCE = 0.12');
    expect(component).toContain('if (cup && cupEmpty && Math.random() < REFILL_CHANCE)');
    expect(component).toContain("kind: 'refill'");
    expect(component).toContain("sfx: 'deskPour'");
    expect(component).toContain('side: cup.side');
    expect(component).toContain("import coffeePot from '../assets/desk-coffee-pot.png'");
  });

  it('pours coffee back into the empty cup before only the pot exits', () => {
    expect(component).toContain('setCupRefilling(true)');
    expect(component).toContain('setCupEmpty(false)');
    expect(component).toContain('setCupRefilling(false)');
    expect(component).toContain('later(finishEncounter, 1640)');
    expect(component).toContain('setEncounterLeaving(true)');
    expect(css).toContain('@keyframes coffee-fill');
    expect(css).toContain('@keyframes coffee-pot-pour');
    expect(css).toContain('@keyframes coffee-pour-stream');
    expect(css).toContain('@keyframes coffee-pour-droplets');
    expect(css).toContain('@keyframes coffee-cup-splash');
    expect(css).toContain('.desk-pour-stream::before');
    expect(css).toContain('.desk-pour-stream::after');
    expect(audio).toMatch(/deskPour:\s+\{[^}]*dur:\s*1\.08/s);
  });
});
