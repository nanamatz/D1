import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('Sweet Turtles boot splash', () => {
  const app = source('src/ui/App.tsx');
  const splash = source('src/ui/components/DeveloperSplash.tsx');
  const startupAudio = source('src/ui/startupAudio.ts');
  const css = source('src/ui/styles/screens.css');
  const identCss = css.slice(
    css.indexOf('/* Developer ident before the real preload screen.'),
    css.indexOf('/* D-4', css.indexOf('/* Developer ident before the real preload screen.')),
  );
  const tokens = source('src/ui/styles/tokens.css');
  const desktop = source('desktop/main.js');
  const gdd = source('docs/GDD.md');
  const uiDesign = source('docs/UI_DESIGN.md');
  const screensSpec = source('docs/screens-spec.md');
  const audioLicenses = source('assets/AUDIO_LICENSES.md');

  it('gates the existing real LoadingScreen without a publisher stage', () => {
    expect(app).toMatch(/showDeveloperSplash[\s\S]*<DeveloperSplash[\s\S]*:\s*loading\s*\?[\s\S]*<LoadingScreen/);
    expect(splash).not.toMatch(/publisher/i);
    expect(splash).toContain('Sweet Turtles');
    expect(splash).toContain('role="img"');
    expect(splash).toContain('aria-label="Sweet Turtles"');
    expect((splash.match(/aria-label=/g) ?? [])).toHaveLength(1);
    expect(splash).toMatch(/assets\/branding\/sweet-turtles\.png/);
  });

  it('keeps save-health and Steam ownership notices unmounted until the ident finishes', () => {
    expect(app).toContain('const [showDeveloperSplash, setShowDeveloperSplash] = useState(true)');
    expect(app).toMatch(/\{!showDeveloperSplash && \([\s\S]*<SaveHealthNotice \/>[\s\S]*<SteamOwnershipNotice \/>[\s\S]*\)\}/);
    expect((app.match(/<SaveHealthNotice \/>/g) ?? [])).toHaveLength(1);
    expect((app.match(/<SteamOwnershipNotice \/>/g) ?? [])).toHaveLength(1);
  });

  it('renders one two-sided circular coin and preserves the first-paint monochrome gate', () => {
    expect((splash.match(/<img\b/g) ?? [])).toHaveLength(1);
    expect(splash).toContain("effect.kind === 'color'");
    expect(splash).toContain('developer-splash--mono');
    expect(splash).toContain('developer-splash__coin-front');
    expect(splash).toContain('developer-splash__coin-back');
    expect(splash).toMatch(/developer-splash__coin-back[\s\S]*<span>ST<\/span>/);
    expect(css).toMatch(/\.developer-splash__coin-stage\s*\{[^}]*aspect-ratio:\s*1[^}]*perspective:\s*900px/s);
    expect(css).toMatch(/\.developer-splash__coin-face\s*\{[^}]*overflow:\s*hidden[^}]*border-radius:\s*50%[^}]*backface-visibility:\s*hidden/s);
    expect(css).toMatch(/\.developer-splash__coin-front\s*\{[^}]*transform:\s*translateZ\(4px\)/s);
    expect(css).toMatch(/\.developer-splash__coin-back\s*\{[^}]*transform:\s*rotateX\(180deg\) translateZ\(4px\)/s);
    expect(identCss).not.toContain('rotateY(');
    expect(css).toMatch(/\.developer-splash__logo\s*\{[^}]*object-fit:\s*cover[^}]*object-position:\s*center/s);
    expect(css).toMatch(/\.developer-splash--mono\s*\{[^}]*filter:\s*grayscale\(1\)/s);
  });

  it('ships the optimized square logo master in the local bundle source', () => {
    const file = readFileSync('src/ui/assets/branding/sweet-turtles.png');
    expect(file.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect({ width: file.readUInt32BE(16), height: file.readUInt32BE(20) })
      .toEqual({ width: 600, height: 600 });
    expect(file.byteLength).toBeGreaterThan(500_000);
    expect(file.byteLength).toBeLessThan(650_000);
  });

  it('auto-runs five flips, contacts, bounce, and an exact front-face lock', () => {
    expect(splash).toContain('const SPLASH_MS = 3850');
    expect(splash).toContain('const REDUCED_SPLASH_MS = 2240');
    expect(splash).toContain('const FALLBACK_SPLASH_MS = 700');
    expect(app).toContain('reducedMotion={settings.reducedMotion}');
    expect(splash).toContain('const reduce = reducedMotion || motionOff()');
    expect(splash).toContain('developer-splash--reduced');
    expect(splash).toContain('doneRef.current = true');
    expect(splash).toContain('window.clearTimeout(timer)');
    expect(css).toMatch(/\.developer-splash__coin\s*\{[^}]*animation:\s*developer-coin-drop 3850ms linear both/s);
    expect(css).toMatch(/@keyframes developer-coin-drop\s*\{[\s\S]*25\.974%\s*\{[^}]*rotateX\(1260deg\)[\s\S]*31\.688%\s*\{[^}]*translate3d\(0, -18px, 0\)[^}]*rotateX\(1440deg\)[\s\S]*37\.662%\s*\{[^}]*rotateX\(1710deg\)[\s\S]*41\.558%, 100%\s*\{[^}]*rotateX\(1800deg\)/s);
    expect(css).toMatch(/\.developer-splash--reduced \.developer-splash__coin\s*\{[^}]*rotateX\(0deg\)[^}]*animation:\s*none !important/s);
    expect(css).toMatch(/@keyframes developer-splash-out\s*\{\s*0%, 93\.506%\s*\{\s*opacity:\s*1;\s*\}\s*100%\s*\{\s*opacity:\s*0;/s);
    expect(css).toMatch(/\.developer-splash--reduced \.developer-splash__content\s*\{[^}]*developer-splash-reduced 2240ms/s);
    expect(css).toMatch(/@keyframes developer-splash-reduced\s*\{[\s\S]*5\.357%, 94\.643%\s*\{\s*opacity:\s*1;/s);
  });

  it('uses palette-independent pure black above every CRT layer', () => {
    const backdrop = identCss.match(/\.developer-splash\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(backdrop).toMatch(/z-index:\s*10000;[\s\S]*background:\s*#000;/);
    expect(backdrop).not.toContain('var(');
    const crtLayers = [...tokens.matchAll(/\.crt-[^{]+\{[^}]*z-index:\s*(\d+)/gs)]
      .map((match) => Number(match[1]));
    expect(crtLayers.length).toBeGreaterThan(0);
    expect(Math.max(...crtLayers)).toBeLessThan(10_000);
  });

  it('has no gesture gate and keeps startup audio outside every game audio control', () => {
    expect(splash).not.toMatch(/pointerdown|keydown|click|preventDefault|addEventListener/i);
    expect(splash).not.toMatch(/press|continue|시작|클릭|아무 키/i);
    expect(startupAudio).not.toMatch(/from ['"].*(?:audio|settings|storage|unlocks)/);
    expect(startupAudio).not.toMatch(/master|music|sfx|mute|SOUND|MUSIC/);
    expect(startupAudio).toContain('output.gain.value = 0.6');
    expect(startupAudio).toContain('if (context.state !== \'running\')');
    expect(startupAudio).toContain('void context.resume().catch(() => undefined)');
  });

  it('synchronizes the audio schedule with contact, bounce, and final-front frames', () => {
    // Audio contacts remain at 1000/1220/1600ms while the front then holds.
    expect(startupAudio).toContain('tone(1.00, 0.28');
    expect(startupAudio).toContain('tone(1.22, 0.22');
    expect(startupAudio).toContain('tone(1.60, 0.36');
    expect(startupAudio).toContain('closeTimer = setTimeout(dispose, 2000)');
    expect(startupAudio).toMatch(/if \(reducedMotion\)[\s\S]*tone\(0\.08[\s\S]*closeTimer = setTimeout\(dispose, 700\)/);
  });

  it('enables only the desktop ident autoplay path before app readiness', () => {
    const autoplay = desktop.indexOf("app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')");
    expect(autoplay).toBeGreaterThan(-1);
    expect(autoplay).toBeLessThan(desktop.indexOf('app.whenReady()'));
    expect(autoplay).toBeLessThan(desktop.indexOf('function createWindow()'));
  });

  it('documents the mixer exception, autoplay caveat, timing, and original synthesis', () => {
    expect(gdd).toContain('developer ident is the sole audio exception');
    expect(gdd).toContain('never imports, reads, or obeys the gameplay mixer');
    expect(uiDesign).toContain('automatic 3850ms beat needs no input');
    expect(uiDesign).toContain('1600–3600ms locks the front for exactly two seconds');
    expect(uiDesign).toContain('static front fades in for 120ms, stays fully visible for exactly two seconds');
    expect(screensSpec).toContain('there is no publisher stage or publisher copy');
    expect(screensSpec).toContain('a web browser may block it');
    expect(screensSpec).toContain('Visual timing never waits for audio');
    expect(audioLicenses).toContain('Sweet Turtles startup ident cue');
    expect(audioLicenses).toContain('Original deterministic Web Audio synthesis, no sample');
  });
});
