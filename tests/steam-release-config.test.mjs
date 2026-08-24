import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertSafeVdfPath } from '../scripts/prepare-steam-build.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const appTemplate = read('steam/app_build.template.vdf');
const windowsDepotTemplate = read('steam/depot_build_windows.template.vdf');
const macDepotTemplate = read('steam/depot_build_macos.template.vdf');
const prepareScript = read('scripts/prepare-steam-build.mjs');
const powershellWrapper = read('scripts/prepare-steam-build.ps1');
const iconScript = read('scripts/make-icon.mjs');
const packageConfig = JSON.parse(read('package.json'));
const runbook = read('docs/STEAM_RELEASE.md');

describe('Steam release configuration', () => {
  it('keeps both checked-in depot templates safe and complete', () => {
    expect(appTemplate).toContain('"AppID" "__APP_ID__"');
    expect(appTemplate).toContain('"__WINDOWS_DEPOT_ID__" "__WINDOWS_DEPOT_SCRIPT__"');
    expect(appTemplate).toContain('"__MAC_DEPOT_ID__" "__MAC_DEPOT_SCRIPT__"');
    expect(appTemplate).toContain('"Preview" "1"');
    expect(appTemplate).toContain('__VERSION__ __COMMIT__');
    expect(appTemplate).toContain('"ContentRoot" "__CONTENT_ROOT__"');
    expect(appTemplate).toContain('"BuildOutput" "__BUILD_OUTPUT__"');

    expect(windowsDepotTemplate).toContain('"DepotID" "__DEPOT_ID__"');
    expect(windowsDepotTemplate).toContain('"LocalPath" "win-unpacked/*"');
    expect(macDepotTemplate).toContain('"DepotID" "__DEPOT_ID__"');
    expect(macDepotTemplate).toContain('"LocalPath" "mac-universal/*"');
    for (const template of [windowsDepotTemplate, macDepotTemplate]) {
      expect(template).toContain('"DepotPath" "."');
      expect(template).toMatch(/"recursive"\s+"1"/i);
    }
    expect(`${appTemplate}\n${windowsDepotTemplate}\n${macDepotTemplate}`)
      .not.toMatch(/SetLive|password|SteamGuard|login/i);
  });

  it('prepares both depots with distinct IDs and validates both artifacts', () => {
    for (const contract of [
      "'--windows-depot-id'",
      "'--mac-depot-id'",
      'new Set([appId, windowsDepotId, macDepotId]).size !== 3',
      "'win-unpacked', 'Play the World.exe'",
      "'mac-universal', 'Play the World.app', 'Contents', 'MacOS', 'Play the World'",
      "args.upload ? '0' : '1'",
      "writeFileSync(appOutput, appVdf, 'utf8')",
      "writeFileSync(windowsOutput, windowsVdf, 'utf8')",
      "writeFileSync(macOutput, macVdf, 'utf8')",
      "resolve(REPO_ROOT, '..', 'D1-steampipe')",
    ]) {
      expect(prepareScript).toContain(contract);
    }
    expect(prepareScript).not.toMatch(/Start-Process|Invoke-Expression|run_app_build/i);
    expect(prepareScript).not.toMatch(/password|SteamGuard|username|account/i);
    expect(powershellWrapper).toContain("Join-Path $PSScriptRoot 'prepare-steam-build.mjs'");
    expect(powershellWrapper).toContain("'--windows-depot-id'");
    expect(powershellWrapper).toContain("'--mac-depot-id'");
  });

  it('rejects quoted or multiline VDF paths while allowing ordinary spaces', () => {
    const safePath = process.platform === 'win32'
      ? 'C:\\Release Builds\\Play the World'
      : '/tmp/Release Builds/Play the World';
    expect(assertSafeVdfPath(safePath, 'Content root')).toBe(safePath);
    expect(() => assertSafeVdfPath('relative/path', 'Content root')).toThrow(/absolute path/);
    for (const unsafe of [`${safePath}"bad`, `${safePath}\rbad`, `${safePath}\nbad`]) {
      expect(() => assertSafeVdfPath(unsafe, 'Content root')).toThrow(/unsafe for quoted VDF/);
    }
  });

  it('configures explicit Windows x64 and macOS universal desktop builds', () => {
    expect(packageConfig.scripts['build:desktop']).toContain('build:desktop:prepare');
    expect(packageConfig.scripts['build:desktop:win']).toContain('--win dir --x64');
    expect(packageConfig.scripts['build:desktop:mac']).toContain('--mac dir --universal');
    expect(packageConfig.build.appId).toBe('com.kdg0711.playtheworld');
    expect(packageConfig.build.productName).toBe('Play the World');
    expect(packageConfig.build.win).toMatchObject({ target: 'dir', icon: 'desktop/icon.ico' });
    expect(packageConfig.build.mac).toMatchObject({
      target: 'dir',
      icon: 'desktop/icon.icns',
      category: 'public.app-category.games',
      minimumSystemVersion: '13.0',
      hardenedRuntime: true,
      notarize: true,
    });
  });

  it('generates the ICO, favicon, and PNG-backed ICNS from one source', () => {
    expect(iconScript).toContain("const SOURCE = 'docs/Arts/Icons/AppIcon.png'");
    expect(iconScript).toContain("const ICO_OUTPUTS = ['desktop/icon.ico', 'public/favicon.ico']");
    expect(iconScript).toContain("const ICNS_OUTPUT = 'desktop/icon.icns'");
    expect(iconScript).toContain("header.write('icns'");
    expect(iconScript).toContain("['ic10', 1024]");
  });

  it('documents both launch options and one cross-platform Auto-Cloud save set', () => {
    expect(runbook).toContain('- Executable: `Play the World.exe`');
    expect(runbook).toContain('- Executable: `Play the World.app`');
    expect(runbook).toContain('- Operating system: Windows');
    expect(runbook).toContain('- Operating system: macOS');

    const cloudRows = runbook
      .split(/\r?\n/)
      .filter((line) => line.startsWith('| `WinAppDataRoaming`'));
    expect(cloudRows).toHaveLength(4);
    expect(cloudRows.map((line) => line.match(/\| `([^`]+)` \| All OSes \| Off \|$/)?.[1])).toEqual([
      'run.json',
      'profile.json',
      'run.json.bak',
      'profile.json.bak',
    ]);
    expect(cloudRows.every((line) => line.includes('| `Play the World/saves` |'))).toBe(true);
    expect(runbook).toContain('Original Root: `WinAppDataRoaming`');
    expect(runbook).toContain('New Root: `MacAppSupport`');
    expect(runbook).toContain('Do not use wildcards.');
    expect(runbook).toMatch(/Do not enable \[Dynamic Cloud Sync\]/);
  });

  it('documents depot package ownership and evidence-gated macOS flags', () => {
    expect(runbook).toContain('Add **both** the Windows DepotID and Mac DepotID to the Developer Comp package');
    expect(runbook).toContain('every intended release/customer package');
    expect(runbook).toContain('Publish the package changes');
    expect(runbook).toContain('confirm the beta test account owns both depots');
    expect(runbook).toContain('Only after the `lipo`, `codesign`, notarization, stapler, and `spctl` evidence');
    expect(runbook).toContain('**64-bit binaries included**');
    expect(runbook).toContain('**App Bundles Are Notarized**');
  });

  it('does not document credentials or automatic live-branch promotion', () => {
    expect(runbook).not.toMatch(/APPLE_ID\s*=|APPLE_APP_SPECIFIC_PASSWORD\s*=|CSC_LINK\s*=/);
    expect(appTemplate).not.toMatch(/SetLive/);
  });
});
