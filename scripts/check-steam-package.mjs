import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { listPackage } from '@electron/asar';

const root = process.cwd();
const MODULE_FILES = [
  'node_modules/steamworks.js/index.js',
  'node_modules/steamworks.js/package.json',
  'node_modules/steamworks.js/dist/win64/steamworksjs.win32-x64-msvc.node',
  'node_modules/steamworks.js/dist/win64/steam_api64.dll',
];
const UNPACKED_FILES = MODULE_FILES.slice(2);
const fail = (message) => { throw new Error(`Steam package check: ${message}`); };
const normalize = (file) => file.replaceAll('\\', '/').replace(/^\/+/, '');

export function validateSteamBuildConfig(pkg) {
  if (pkg.dependencies?.['steamworks.js'] !== '^0.4.0') fail('steamworks.js must be a production dependency');
  if (!pkg.scripts?.['build:desktop']?.includes('--win dir --x64')) fail('desktop build must target Windows x64');
  for (const file of MODULE_FILES) if (!pkg.build?.files?.includes(file)) fail(`missing build file: ${file}`);
  if (pkg.build.files.includes('node_modules/steamworks.js/**/*')) fail('broad steamworks.js packaging is forbidden');
  if (JSON.stringify(pkg.build?.asarUnpack) !== JSON.stringify(UNPACKED_FILES)) fail('only the two win64 runtime files may be unpacked');
}

export function assertAllowedSteamPaths(paths) {
  const files = paths.map(normalize);
  const steamFiles = files.filter((file) => file.includes('node_modules/steamworks.js/'));
  for (const file of steamFiles) {
    if (/\.(?:lib|so|dylib)$/i.test(file) || /\/dist\/(?:linux64|osx)\//i.test(file)) {
      fail(`foreign or link-time native shipped: ${file}`);
    }
  }
  for (const required of MODULE_FILES) {
    if (!files.some((file) => file.endsWith(required))) fail(`artifact missing: ${required}`);
  }
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const file = path.join(dir, name);
  return statSync(file).isDirectory() ? walk(file) : [file];
});

function containsLiteral(file, value) {
  return new RegExp(`(^|\\D)${value}(?!\\d)`).test(readFileSync(file).toString('latin1'));
}

function assertNoAppId(appId, artifactFiles = []) {
  if (!appId) return;
  if (!/^\d+$/.test(appId)) fail('--app-id must be a positive numeric Steam AppID');
  const safeRoot = root.replaceAll('\\', '/');
  const tracked = execFileSync('git', ['-c', `safe.directory=${safeRoot}`, 'ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).map((file) => path.join(root, file));
  for (const file of [...tracked, ...artifactFiles]) {
    if (existsSync(file) && statSync(file).isFile() && containsLiteral(file, appId)) {
      fail(`AppID literal leaked into ${path.relative(root, file)}`);
    }
  }
}

export function checkSteamPackage(packageDir, appId) {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  validateSteamBuildConfig(pkg);
  if (!packageDir) {
    assertNoAppId(appId);
    return 'Steam package config: OK';
  }
  const absolute = path.resolve(root, packageDir);
  if (!existsSync(absolute)) fail(`package directory not found: ${absolute}`);
  const artifactFiles = walk(absolute);
  if (artifactFiles.some((file) => path.basename(file).toLowerCase() === 'steam_appid.txt')) fail('steam_appid.txt must never be packaged');
  const archive = path.join(absolute, 'resources', 'app.asar');
  if (!existsSync(archive)) fail('resources/app.asar is missing');
  const archivePaths = listPackage(archive, { isPack: true });
  const unpackedRoot = path.join(absolute, 'resources', 'app.asar.unpacked');
  const unpackedPaths = artifactFiles.filter((file) => file.startsWith(unpackedRoot))
    .map((file) => path.relative(unpackedRoot, file));
  assertAllowedSteamPaths([...archivePaths, ...unpackedPaths]);
  for (const name of UNPACKED_FILES) {
    const file = path.join(unpackedRoot, name);
    const bytes = readFileSync(file);
    const pe = bytes.readUInt32LE(0x3c);
    if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0' || bytes.readUInt16LE(pe + 4) !== 0x8664) fail(`${path.basename(file)} is not Windows x64`);
  }
  assertNoAppId(appId, artifactFiles);
  return 'Steam package artifact: OK';
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
if (invoked) {
  const args = process.argv.slice(2);
  let packageDir;
  let appId;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--app-id') appId = args[++i];
    else if (!packageDir) packageDir = args[i];
    else fail(`unknown argument: ${args[i]}`);
  }
  console.log(checkSteamPackage(packageDir, appId));
}
