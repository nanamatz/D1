import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function usage() {
  return `Usage: node scripts/prepare-steam-build.mjs \\
  --app-id ID --windows-depot-id ID --mac-depot-id ID \\
  --version VERSION --commit SHA [--content-root PATH] [--upload]`;
}

function parseArgs(argv) {
  const values = {};
  const known = new Set([
    '--app-id', '--windows-depot-id', '--mac-depot-id', '--version', '--commit', '--content-root',
  ]);
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--upload') {
      if (values.upload) throw new Error('--upload may be specified only once.');
      values.upload = true;
      continue;
    }
    if (!known.has(arg)) throw new Error(`Unknown argument: ${arg}\n${usage()}`);
    if (Object.hasOwn(values, arg)) throw new Error(`${arg} may be specified only once.`);
    const value = argv[++index];
    if (value == null || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
    values[arg] = value;
  }
  return values;
}

function requirePositiveId(value, label) {
  if (!/^[1-9]\d*$/.test(value ?? '')) throw new Error(`${label} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} must be a safe positive integer.`);
  return parsed;
}

function replaceAll(template, replacements, label) {
  let rendered = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, value);
  }
  if (/__[A-Z_]+__/.test(rendered)) throw new Error(`${label} has an unreplaced placeholder.`);
  return rendered;
}

function assertFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${label} not found: ${path}`);
}

export function assertSafeVdfPath(path, label) {
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path.`);
  if (/["\r\n]/.test(path)) throw new Error(`${label} contains a character unsafe for quoted VDF values.`);
  return path;
}

export function main(argv = process.argv.slice(2)) {
 try {
  const args = parseArgs(argv);
  const appId = requirePositiveId(args['--app-id'], 'AppID');
  const windowsDepotId = requirePositiveId(args['--windows-depot-id'], 'Windows DepotID');
  const macDepotId = requirePositiveId(args['--mac-depot-id'], 'Mac DepotID');
  if (new Set([appId, windowsDepotId, macDepotId]).size !== 3) {
    throw new Error('AppID, Windows DepotID, and Mac DepotID must be distinct.');
  }

  const version = args['--version']?.trim();
  const commit = args['--commit']?.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version ?? '')) {
    throw new Error('Version is missing or contains unsupported characters.');
  }
  if (!/^[0-9A-Fa-f]{7,64}$/.test(commit ?? '')) {
    throw new Error('Commit must be a 7-64 character hexadecimal SHA.');
  }

  const contentRoot = resolve(args['--content-root'] ?? resolve(REPO_ROOT, '..', 'D1-release'));
  if (!existsSync(contentRoot) || !statSync(contentRoot).isDirectory()) {
    throw new Error(`Content root is not a directory: ${contentRoot}`);
  }
  assertFile(resolve(contentRoot, 'win-unpacked', 'Play the World.exe'), 'Windows packaged executable');
  assertFile(
    resolve(contentRoot, 'mac-universal', 'Play the World.app', 'Contents', 'MacOS', 'Play the World'),
    'macOS packaged executable',
  );

  // Keep generated VDFs and SteamPipe build output outside the shared content root.
  const outputRoot = resolve(REPO_ROOT, '..', 'D1-steampipe');
  const buildOutput = resolve(outputRoot, 'build-output');
  const outputFromContent = relative(contentRoot, outputRoot);
  if (outputFromContent === '' || (!outputFromContent.startsWith('..') && !isAbsolute(outputFromContent))) {
    throw new Error('SteamPipe output must be outside the shared content root.');
  }

  const templateRoot = resolve(REPO_ROOT, 'steam');
  const appTemplate = readFileSync(resolve(templateRoot, 'app_build.template.vdf'), 'utf8');
  const windowsTemplate = readFileSync(resolve(templateRoot, 'depot_build_windows.template.vdf'), 'utf8');
  const macTemplate = readFileSync(resolve(templateRoot, 'depot_build_macos.template.vdf'), 'utf8');
  const appOutput = resolve(outputRoot, 'app_build.vdf');
  const windowsOutput = resolve(outputRoot, 'depot_build_windows.vdf');
  const macOutput = resolve(outputRoot, 'depot_build_macos.vdf');
  for (const [path, label] of [
    [contentRoot, 'Content root'],
    [buildOutput, 'Build output'],
    [windowsOutput, 'Windows depot script'],
    [macOutput, 'Mac depot script'],
  ]) {
    assertSafeVdfPath(path, label);
  }

  const appVdf = replaceAll(appTemplate, {
    __APP_ID__: String(appId),
    __WINDOWS_DEPOT_ID__: String(windowsDepotId),
    __MAC_DEPOT_ID__: String(macDepotId),
    __VERSION__: version,
    __COMMIT__: commit,
    __BUILD_OUTPUT__: buildOutput,
    __CONTENT_ROOT__: contentRoot,
    __WINDOWS_DEPOT_SCRIPT__: windowsOutput,
    __MAC_DEPOT_SCRIPT__: macOutput,
  }, 'App template').replace('"Preview" "1"', `"Preview" "${args.upload ? '0' : '1'}"`);
  const windowsVdf = replaceAll(windowsTemplate, { __DEPOT_ID__: String(windowsDepotId) }, 'Windows depot template');
  const macVdf = replaceAll(macTemplate, { __DEPOT_ID__: String(macDepotId) }, 'Mac depot template');

  mkdirSync(buildOutput, { recursive: true });
  writeFileSync(appOutput, appVdf, 'utf8');
  writeFileSync(windowsOutput, windowsVdf, 'utf8');
  writeFileSync(macOutput, macVdf, 'utf8');

  console.log(`Prepared SteamPipe VDFs (Preview ${args.upload ? '0' : '1'}):`);
  console.log(`  ${appOutput}`);
  console.log(`  ${windowsOutput}`);
  console.log(`  ${macOutput}`);
  console.log(`Content root: ${contentRoot}`);
  if (args.upload) console.log('Upload configuration prepared. SteamCMD was not started; no credentials were accepted.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
