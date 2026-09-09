const { execFileSync } = require('child_process');
const fs = require('fs');

const isDescription = (key) =>
  /^(?:bossdesc|patterndesc|packdesc|consumabledesc|jokerdesc|voucherdesc|materialdesc|fontdesc|fonteffectdesc|editiondesc)\./u.test(key)
  || /\.(?:body|warning|desc|tooltip)$/u.test(key)
  || /(?:Body|Desc)$/u.test(key);

let patch = '*** Begin Patch\n';
for (const file of fs.readdirSync('locales').filter((name) => name.endsWith('.json')).sort()) {
  const path = `locales/${file}`;
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const current = JSON.parse(fs.readFileSync(path, 'utf8'));
  const baseline = JSON.parse(execFileSync(
    'git', ['-c', 'safe.directory=C:/Users/owner/Documents/GitHub/D1', 'show', `HEAD:${path}`],
    { encoding: 'utf8' },
  ));
  const edits = [];
  for (const [key, value] of Object.entries(current)) {
    const old = baseline[key];
    if (!isDescription(key) || typeof old !== 'string' || !/[;；]/u.test(old)) continue;
    const commaVersion = old.replace(/[;；]/gu, ',');
    if (value !== old && value !== commaVersion) continue;
    const target = old.replace(/[;；]/gu, '');
    const line = lines.find((candidate) => candidate.trimStart().startsWith(`${JSON.stringify(key)}:`));
    if (line) edits.push([line, line.replace(JSON.stringify(value), JSON.stringify(target))]);
  }
  if (edits.length === 0) continue;
  patch += `*** Update File: ${path}\n`;
  for (const [before, after] of edits) patch += `@@\n-${before}\n+${after}\n`;
}
process.stdout.write(`${patch}*** End Patch`);
