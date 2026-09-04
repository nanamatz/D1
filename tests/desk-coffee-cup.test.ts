import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const component = readFileSync('src/ui/components/DeskObjects.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');
const audio = readFileSync('src/ui/audio.ts', 'utf8');
const app = readFileSync('src/ui/App.tsx', 'utf8');

describe('ambient coffee cup interaction', () => {
  it('uses the pixel-art asset and a separately animated liquid layer', () => {
    const cupArt = css.match(/\.desk-cup-art\s*\{([^}]*)\}/s)?.[1] ?? '';
    const cavity = css.match(/\.desk-cup-sprite::before\s*\{([^}]*)\}/s)?.[1] ?? '';
    const liquid = css.match(/\.desk-coffee-liquid\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(component).toContain("import coffeeCup from '../assets/desk-coffee-cup.png'");
    expect(component).toContain('className="desk-coffee-liquid"');
    expect(component).toContain('onClick={drinkCoffee}');
    expect(cupArt).toMatch(/z-index:\s*2/);
    expect(cavity).toMatch(/z-index:\s*3/);
    expect(cavity).toMatch(/left:\s*20%/);
    expect(cavity).toMatch(/top:\s*21%/);
    expect(cavity).toMatch(/width:\s*54%/);
    expect(cavity).toMatch(/height:\s*15%/);
    expect(cavity).toContain('#d8caa8 0 20%');
    expect(cavity).toContain('#817663 21% 45%');
    expect(cavity).toContain('#29241e 46% 100%');
    expect(cavity).not.toMatch(/(?:border|outline|box-shadow|animation|transition):/);
    expect(liquid).toMatch(/z-index:\s*4/);
    expect(liquid).toMatch(/left:\s*22%/);
    expect(liquid).toMatch(/top:\s*23%/);
    expect(liquid).toMatch(/width:\s*50%/);
    expect(liquid).toMatch(/height:\s*12%/);
    expect(liquid).toMatch(/box-shadow:\s*inset 0 2px/);
    expect(liquid).not.toMatch(/border:/);
    expect(css).toContain('@keyframes coffee-drain');
    expect(css).toContain('.desk-cup.desk-drinking .desk-coffee-liquid');
  });

  it('emits staggered pixel steam until the coffee is drunk', () => {
    const steam = css.match(/\.desk-coffee-steam\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(component).toContain('className="desk-coffee-steam"');
    expect(steam).toMatch(/z-index:\s*5/);
    expect(steam).toMatch(/left:\s*22%/);
    expect(steam).toMatch(/width:\s*50%/);
    expect(css).toContain('@keyframes coffee-steam-rise');
    expect(css).toContain('.desk-coffee-steam i:nth-child(3)');
    expect(css).toMatch(/\.desk-cup\.desk-drinking \.desk-coffee-steam\s*\{[^}]*opacity:\s*0/s);
  });

  it('sets the cup down from above and makes it larger than the old glyph', () => {
    expect(css).toContain('@keyframes desk-cup-down');
    expect(css).toContain('translateY(calc(-100vh - 110%))');
    expect(css).toContain('width: clamp(112px, 11vw, 168px)');
  });

  it('reserves runtime encounters for the right-side three-zone stack', () => {
    expect(component).toContain("side: 'right',");
    expect(component).not.toContain("side: Math.random() < 0.5 ? 'left' : 'right'");
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

  it('drinks once, plays its exit, and removes the cup', () => {
    expect(component).toContain('setCupDrinking(true)');
    expect(component).toContain('setCupDrinking(false)');
    expect(component).toContain('setCupLeaving(true)');
    expect(component).toContain('setCup(null)');
    expect(component).toContain("cupLeaving ? 'desk-leaving' : 'desk-entering'");
    expect(component).toContain('}, 820);');
    expect(component).toContain('}, 1280);');
    expect(audio).toMatch(/deskCup:\s*\{[\s\S]*?gain:\s*0\.4[\s\S]*?dur:\s*0\.86/);
  });

  it('shows the clicked cup empty under both Reduced Motion paths', () => {
    expect(css).toMatch(/\.desk-still\.desk-cup\.desk-drinking \.desk-coffee-liquid\s*\{[^}]*opacity:\s*0/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.desk-cup\.desk-drinking \.desk-coffee-liquid\s*\{[^}]*opacity:\s*0/s);
  });

  it('waits longer between one-shot encounters', () => {
    expect(component).toContain('ENCOUNTER_GAP_MIN_MS = 70_000');
    expect(component).toContain('ENCOUNTER_GAP_SPREAD_MS = 70_000');
    expect(component).toContain('setEncounterCycle((n) => n + 1)');
    expect(component).toContain('setCup(next)');
    expect(component).toContain('setBell(next)');
  });

  it('includes the coffee pot, tactile toys, Shaco box, fly, and bulldog encounters', () => {
    expect(component).toContain(
      "type DeskKind = 'cup' | 'pot' | 'bell' | 'check' | 'waxBall' | 'keycap' | 'shacoBox' | 'fly' | 'bulldog' | 'launchButton'",
    );
    expect(component).toContain("{ kind: 'pot', sfx: 'deskPour' }");
    expect(component).toContain("{ kind: 'bell', sfx: 'deskBell' }");
    expect(component).toContain("{ kind: 'check', sfx: 'deskCheck' }");
    expect(component).toContain("{ kind: 'waxBall', sfx: 'deskWaxCrunch' }");
    expect(component).toContain("{ kind: 'keycap', sfx: 'deskKeycap' }");
    expect(component).toContain("{ kind: 'shacoBox', sfx: 'deskJackPop' }");
    expect(component).toContain("{ kind: 'fly', sfx: 'deskFlySwat' }");
    expect(component).toContain("{ kind: 'bulldog', sfx: 'deskBulldogBite' }");
    expect(component).toContain("{ kind: 'launchButton', sfx: 'deskLaunchAlarm' }");
    expect(component).not.toContain("'pencil'");
    expect(component).not.toContain("'plane'");
    expect(component).toContain("import callBell from '../assets/desk-call-bell.png'");
    expect(component).toContain("import blankCheck from '../assets/desk-blank-check.png'");
    expect(component).toContain("import coffeePot from '../assets/desk-coffee-pot.png'");
    expect(component).toContain("import waxBall from '../assets/desk-wax-ball.png'");
    expect(component).toContain("import waxBallBroken from '../assets/desk-wax-ball-broken.png'");
    expect(component).toContain("import keycap from '../assets/desk-keycap.png'");
    expect(component).toContain("import shacoBox from '../assets/desk-shaco-box.png'");
    expect(component).toContain("import shacoBoxPopped from '../assets/desk-shaco-box-popped.png'");
    expect(component).toContain("import fly from '../assets/desk-fly.png'");
    expect(component).toContain("import flySwatter from '../assets/desk-fly-swatter.png'");
    expect(component).toContain("import bulldogRoulette from '../assets/desk-bulldog-roulette.png'");
    expect(component).toContain("import bulldogBite from '../assets/desk-bulldog-bite.png'");
    expect(component).toContain("import launchButtonCovered from '../assets/desk-launch-button-covered.png'");
    expect(component).toContain("import launchButtonOpen from '../assets/desk-launch-button-open.png'");
    expect(component).toContain("import launchButtonPressed from '../assets/desk-launch-button-pressed.png'");
    expect(component).not.toContain("'slangee'");
    expect(component).not.toContain("kind: 'refill'");
  });

  it('springs the Shaco clown from a transparent two-frame sprite pair', () => {
    for (const name of ['desk-shaco-box.png', 'desk-shaco-box-popped.png']) {
      const png = readFileSync(`src/ui/assets/${name}`);
      expect(png.readUInt32BE(16), name).toBe(1254);
      expect(png.readUInt32BE(20), name).toBe(1254);
      expect(png[25], name).toBe(6);
    }
    expect(component).toContain('className="desk-encounter-art desk-shaco-closed"');
    expect(component).toContain('className="desk-encounter-art desk-shaco-popped"');
    expect(css).toContain('@keyframes desk-shaco-pop');
    expect(css).toContain('.desk-shacoBox.desk-interacting .desk-shaco-popped');
    expect(audio).toMatch(/deskJackPop:\s*\{[\s\S]*?gain:\s*0\.46[\s\S]*?dur:\s*0\.74[\s\S]*?from:\s*145,\s*to:\s*560/);
  });

  it('swats the flying pest and knocks it out of the encounter', () => {
    for (const name of ['desk-fly.png', 'desk-fly-swatter.png']) {
      const png = readFileSync(`src/ui/assets/${name}`);
      expect(png.readUInt32BE(16), name).toBe(1254);
      expect(png.readUInt32BE(20), name).toBe(1254);
      expect(png[25], name).toBe(6);
    }
    expect(component).toContain('className="desk-encounter-art desk-fly-art"');
    expect(component).toContain('className="desk-encounter-art desk-fly-swatter"');
    expect(component).toContain('className="desk-fly-impact"');
    expect(css).toContain('@keyframes desk-fly-swatter-slap');
    expect(css).toContain('@keyframes desk-fly-knock-away');
    expect(audio).toMatch(/deskFlySwat:\s*\{[\s\S]*?gain:\s*0\.48[\s\S]*?dur:\s*0\.38[\s\S]*?color:\s*'brown'/);
  });

  it('keeps Bulldog Roulette active until one of eight teeth triggers the bite', () => {
    for (const name of ['desk-bulldog-roulette.png', 'desk-bulldog-bite.png']) {
      const png = readFileSync(`src/ui/assets/${name}`);
      expect(png.readUInt32BE(16), name).toBe(1254);
      expect(png.readUInt32BE(20), name).toBe(1254);
      expect(png[25], name).toBe(6);
    }
    expect(component).toContain('const BULLDOG_TEETH = 8');
    expect(component).toContain("trigger: base.kind === 'bulldog'");
    expect(component).toContain('Math.floor(Math.random() * BULLDOG_TEETH)');
    expect(component).toContain('Array.from({ length: BULLDOG_TEETH }');
    expect(component).toContain('onClick={() => pressBulldogTooth(index)}');
    expect(component).toContain("if (index !== encounter.trigger)");
    expect(component).toContain("audio.play('deskKeycap')");
    expect(component).toContain("audio.play('deskBulldogBite')");
    expect(component).toContain('later(() => setEncounterLeaving(true), 720)');
    expect(component).toContain('later(finishEncounter, 1260)');
    expect(css).toContain('@keyframes desk-bulldog-bite');
    expect(css).toContain('@keyframes desk-bulldog-scare-flash');
    expect(css).toContain('scale(1.62)');
    expect(css).toContain(':not(.desk-interacting).desk-entering .desk-glyph');
    expect(css).toContain('.desk-bulldog-tooth.pressed');
    expect(css).toMatch(/\.desk-bulldog-tooth\s*\{[\s\S]*?width:\s*12%[\s\S]*?height:\s*21%/);
    expect(css).toMatch(/\.desk-bulldog-teeth\s*\{[\s\S]*?clip-path:\s*polygon\(22% 40%/);
    expect(css).toContain('clip-path: polygon(50% 0, 100% 78%, 92% 100%, 8% 100%, 0 78%)');
    expect(css).toContain('transform-origin: 50% 88%');
    expect(css).toContain('.desk-bulldog.desk-interacting .desk-bulldog-bite');
    expect(audio).toMatch(/deskBulldogBite:\s*\{[\s\S]*?gain:\s*0\.56[\s\S]*?dur:\s*0\.7[\s\S]*?color:\s*'brown'/);
  });

  it('opens the launch-button cover before the second click activates and exits', () => {
    for (const name of [
      'desk-launch-button-covered.png',
      'desk-launch-button-open.png',
      'desk-launch-button-pressed.png',
    ]) {
      const png = readFileSync(`src/ui/assets/${name}`);
      expect(png.readUInt32BE(16), name).toBe(1254);
      expect(png.readUInt32BE(20), name).toBe(1254);
      expect(png[25], name).toBe(6);
    }
    expect(component).toContain('const [launchCoverOpen, setLaunchCoverOpen] = useState(false)');
    expect(component).toContain("if (!launchCoverOpen)");
    expect(component).toContain("audio.play('deskLaunchCover')");
    expect(component).toContain('setLaunchCoverOpen(true)');
    expect(component).toContain("audio.play('deskLaunchAlarm')");
    expect(component).toContain('later(() => setEncounterLeaving(true), 1260)');
    expect(component).toContain('later(finishEncounter, 1820)');
    expect(component).toContain('onClick={interactLaunchButton}');
    expect(css).toContain('@keyframes desk-launch-cover-open');
    expect(css).toContain('@keyframes desk-launch-activate');
    expect(css).toContain('@keyframes desk-launch-shockwave');
    expect(css).toContain('.desk-launchButton.desk-cover-open .desk-launch-open');
    expect(css).toContain('.desk-launchButton.desk-interacting .desk-launch-pressed');
    expect(audio).toMatch(/deskLaunchCover:\s*\{[\s\S]*?gain:\s*0\.4[\s\S]*?dur:\s*0\.3/);
    expect(audio).toMatch(/deskLaunchAlarm:\s*\{[\s\S]*?gain:\s*0\.52[\s\S]*?dur:\s*1\.28[\s\S]*?color:\s*'brown'/);
  });

  it('ships square transparent PNG art for both tactile toys', () => {
    for (const name of [
      'desk-wax-ball.png',
      'desk-wax-ball-broken.png',
      'desk-keycap.png',
    ]) {
      const png = readFileSync(`src/ui/assets/${name}`);
      expect(png.readUInt32BE(16), name).toBe(1254);
      expect(png.readUInt32BE(20), name).toBe(1254);
      expect(png[25], name).toBe(6);
    }
  });

  it('plays one tactile response before each simple encounter exits', () => {
    expect(component).toContain('const interactSimpleEncounter = () =>');
    expect(component).toContain('audio.play(encounter.sfx)');
    expect(audio).toMatch(/deskKeycap:\s*\{[\s\S]*?gain:\s*0\.5[\s\S]*?dur:\s*0\.16[\s\S]*?cutoff:\s*5200/);
    expect(audio).toMatch(/deskWaxCrunch:\s*\{[\s\S]*?gain:\s*0\.5[\s\S]*?dur:\s*0\.4[\s\S]*?color:\s*'brown'/);
    expect(component).toContain("encounterInteracting && encounter.kind !== 'check' && 'desk-interacting'");
    expect(css).toContain('@keyframes desk-pot-pour');
    expect(css).toContain('@keyframes desk-wax-pop');
    expect(css).toContain('@keyframes desk-keycap-click');
    expect(css).toContain('@keyframes desk-keycap-burst');
    expect(component).toContain('className="desk-encounter-art desk-wax-intact"');
    expect(component).toContain('className="desk-encounter-art desk-wax-broken"');
    expect(component).toContain('className="desk-encounter-art desk-keycap-art"');
    expect(component).toContain('className="desk-keycap-effect"');
    expect(component).not.toContain("onPointerDown={encounter.kind === 'keycap'");
    expect(component).toContain('onClick={interactSimpleEncounter}');
    expect(app).toContain("control.closest('.desk-object')");
    expect(css).toContain('.desk-waxBall.desk-interacting .desk-wax-broken');
    expect(css).toContain('.desk-keycap.desk-interacting .desk-keycap-art');
    expect(css).toContain('.desk-keycap.desk-interacting .desk-keycap-effect');
    expect(css).not.toContain('.desk-keycap-cap');
    expect(css).not.toContain('.desk-keycap-chain');
  });

  it('rings once, then plays its exit and removes the call bell', () => {
    expect(component).toContain("bellRinging && 'desk-ringing'");
    expect(component).toContain('className="desk-bell-art desk-bell-switch"');
    expect(component).toContain('setBellLeaving(true)');
    expect(component).toContain('setBell(null)');
    expect(component).toContain("bellLeaving ? 'desk-leaving' : 'desk-entering'");
    expect(css).toContain('clip-path: inset(12% 36% 75% 39%)');
    expect(css).toContain('@keyframes call-bell-ring');
    expect(css).toContain('@keyframes call-bell-switch-press');
    expect(css).toContain('.desk-bell.desk-ringing .desk-bell-switch');
    expect(css).toContain('@keyframes call-bell-waves');
    expect(audio).toMatch(/deskBell:\s*\{[\s\S]*?gain:\s*0\.4[\s\S]*?dur:\s*1\.12[\s\S]*?textured:\s*true/);
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
    expect(component).toContain('event.timeStamp - signatureScratchAt.current >= SIGNATURE_SCRATCH_INTERVAL_MS');
    expect(component).toContain("audio.play('deskCheck')");
    expect(component).toContain('points.length < SIGNATURE_MIN_POINTS');
    expect(component).toContain('later(() => setEncounterLeaving(true), 320)');
    expect(component).toContain('later(finishEncounter, 900)');
    expect(component).toContain('<polyline');
    expect(component).not.toContain('M3 29 C12 7');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('.desk-check.desk-drawing .desk-check-pen');
    expect(css).not.toContain('@keyframes check-signature-draw');
    expect(css).not.toContain('@keyframes check-pen-write');
    expect(audio).toMatch(/deskCheck:\s*\{[\s\S]*?gain:\s*0\.34[\s\S]*?dur:\s*0\.1[\s\S]*?textured:\s*true/);
  });

  it('adds a subtle localized signature hint that clears while drawing', () => {
    expect(component).toContain("t('desk.check.sign')");
    expect(component).toContain('className="desk-check-guide"');
    expect(css).toMatch(/\.desk-check-guide\s*\{[^}]*opacity:\s*0\.28/s);
    expect(css).toContain('.desk-check.desk-drawing .desk-check-guide');
  });

  it('shows a full cup first, then only the pot until it refills the cup', () => {
    const drink = component.slice(
      component.indexOf('const drinkCoffee'),
      component.indexOf('const ringBell'),
    );
    expect(component).not.toContain('REFILL_CHANCE');
    expect(component).not.toContain('cupEmpty');
    expect(component).toContain('const [coffeeReady, setCoffeeReady] = useState(true)');
    expect(component).toContain("(kind !== 'cup' || (coffeeReady && !cup))");
    expect(component).toContain("(kind !== 'pot' || !coffeeReady)");
    expect(drink).toContain('setCoffeeReady(false)');
    expect(component).toContain("if (encounter?.kind === 'pot') setCoffeeReady(true)");
    const pour = audio.slice(audio.indexOf('deskPour:'), audio.indexOf('deskKeycap:'));
    expect(pour).toMatch(/gain:\s*0\.42[\s\S]*?dur:\s*0\.9[\s\S]*?filter:\s*'highpass'/);
    expect(pour).toContain("color: 'brown'");
    expect(pour).not.toContain('tones:');
    expect(drink.indexOf('setCup(null)')).toBeLessThan(drink.indexOf('setCupDrinking(false)'));
    expect(css).toContain('.desk-cup.desk-drinking.desk-leaving .desk-coffee-liquid');
  });
});
