import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertSafeVdfPath } from '../scripts/prepare-steam-build.mjs';

const url = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFileSync(url(path), 'utf8');
const appTemplate = read('steam/app_build.template.vdf');
const windowsDepotTemplate = read('steam/depot_build_windows.template.vdf');
const prepareScript = read('scripts/prepare-steam-build.mjs');
const powershellWrapper = read('scripts/prepare-steam-build.ps1');
const iconScript = read('scripts/make-icon.mjs');
const packageConfig = JSON.parse(read('package.json'));
const runbook = read('docs/STEAM_RELEASE.md');

describe('Steam release configuration', () => {
  it('keeps the single Windows depot template safe and complete', () => {
    expect(appTemplate).toContain('"AppID" "__APP_ID__"');
    expect(appTemplate).toContain('"__WINDOWS_DEPOT_ID__" "__WINDOWS_DEPOT_SCRIPT__"');
    expect(appTemplate.match(/"__WINDOWS_DEPOT_ID__"/g)).toHaveLength(1);
    expect(appTemplate).toContain('"Preview" "1"');
    expect(appTemplate).toContain('__VERSION__ __COMMIT__');
    expect(appTemplate).toContain('"ContentRoot" "__CONTENT_ROOT__"');
    expect(appTemplate).toContain('"BuildOutput" "__BUILD_OUTPUT__"');
    expect(windowsDepotTemplate).toContain('"DepotID" "__DEPOT_ID__"');
    expect(windowsDepotTemplate).toContain('"LocalPath" "win-unpacked/*"');
    expect(windowsDepotTemplate).toContain('"DepotPath" "."');
    expect(windowsDepotTemplate).toMatch(/"recursive"\s+"1"/i);
    expect(`${appTemplate}\n${windowsDepotTemplate}`).not.toMatch(/SetLive|password|SteamGuard|login/i);
  });

  it('prepares one Windows depot with distinct IDs and validates its artifact', () => {
    for (const contract of [
      "'--windows-depot-id'",
      'appId === windowsDepotId',
      "'win-unpacked', 'Play the World.exe'",
      "args.upload ? '0' : '1'",
      "writeFileSync(appOutput, appVdf, 'utf8')",
      "writeFileSync(windowsOutput, windowsVdf, 'utf8')",
      "resolve(REPO_ROOT, '..', 'D1-steampipe')",
    ]) {
      expect(prepareScript).toContain(contract);
    }
    expect(prepareScript).not.toMatch(/mac-universal|Mac Depot|depot_build_macos|__MAC_/i);
    expect(prepareScript).not.toMatch(/Start-Process|Invoke-Expression|run_app_build/i);
    expect(prepareScript).not.toMatch(/password|SteamGuard|username|account/i);
    expect(powershellWrapper).toContain("Join-Path $PSScriptRoot 'prepare-steam-build.mjs'");
    expect(powershellWrapper).toContain("'--windows-depot-id'");
    expect(powershellWrapper).not.toMatch(/MacDepot|--mac-depot/i);
  });

  it('rejects the retired macOS depot argument', () => {
    const result = spawnSync(process.execPath, [
      fileURLToPath(url('scripts/prepare-steam-build.mjs')),
      '--mac-depot-id', '123458',
    ], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown argument: --mac-depot-id');
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

  it('configures both desktop build aliases as explicit Windows x64 builds', () => {
    expect(packageConfig.scripts['build:desktop']).toContain('--win dir --x64');
    expect(packageConfig.scripts['build:desktop:win']).toContain('--win dir --x64');
    expect(packageConfig.scripts).not.toHaveProperty('build:desktop:mac');
    expect(packageConfig.build.appId).toBe('com.kdg0711.playtheworld');
    expect(packageConfig.build.productName).toBe('Play the World');
    expect(packageConfig.build.win).toMatchObject({ target: 'dir', icon: 'desktop/icon.ico' });
    expect(packageConfig.build).not.toHaveProperty('mac');
    expect(existsSync(url('desktop/icon.icns'))).toBe(false);
    expect(existsSync(url('steam/depot_build_macos.template.vdf'))).toBe(false);
  });

  it('generates only the Windows ICO and web favicon from one source', () => {
    expect(iconScript).toContain("const SOURCE = 'docs/Arts/Icons/AppIcon.png'");
    expect(iconScript).toContain("const OUTPUTS = ['desktop/icon.ico', 'public/favicon.ico']");
    expect(iconScript).toContain('const SIZES = [16, 32, 48, 256]');
    expect(iconScript).not.toMatch(/icns|ICNS|ic10/);
  });

  it('documents one Windows launch option and four exact Windows Cloud paths', () => {
    expect(runbook).toContain('Under Supported Platforms, select **Windows only**.');
    expect(runbook).toContain('- Executable: `Play the World.exe`');
    expect(runbook).toContain('- Operating system: Windows');
    expect(runbook).not.toMatch(/Play the World\.app|MacAppSupport|Root Override:/);

    const cloudRows = runbook
      .split(/\r?\n/)
      .filter((line) => line.startsWith('| `WinAppDataRoaming`'));
    expect(cloudRows).toHaveLength(4);
    expect(cloudRows.map((line) => line.match(/\| `([^`]+)` \| Windows \| Off \|$/)?.[1])).toEqual([
      'run.json', 'profile.json', 'run.json.bak', 'profile.json.bak',
    ]);
    expect(cloudRows.every((line) => line.includes('| `Play the World/saves` |'))).toBe(true);
    expect(runbook).toContain('Do not use wildcards.');
    expect(runbook).toContain('Do not configure a Root Override.');
    expect(runbook).toMatch(/Do not enable\s+\[Dynamic Cloud Sync\]/);
  });

  it('documents Windows depot package ownership before upload', () => {
    expect(runbook).toContain('Add the Windows DepotID to the Developer Comp package');
    expect(runbook).toContain('every intended');
    expect(runbook).toContain('release/customer package');
    expect(runbook).toContain('Publish the package changes');
    expect(runbook).toContain('confirm the beta');
    expect(runbook).toContain('test account owns the depot');
  });

  it('does not embed credentials or automatic live-branch promotion', () => {
    expect(runbook).not.toMatch(/APPLE_ID\s*=|APPLE_APP_SPECIFIC_PASSWORD\s*=|CSC_LINK\s*=/);
    expect(appTemplate).not.toMatch(/SetLive/);
  });
});
