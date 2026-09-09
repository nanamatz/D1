const fs = require('fs');

let patch = '*** Begin Patch\n';
for (const file of fs.readdirSync('locales').filter((name) => name.endsWith('.json')).sort()) {
  const lines = fs.readFileSync(`locales/${file}`, 'utf8').split(/\r?\n/);
  const edits = lines.filter((line) => /"[^"]*(?:desc|tooltip|body)[^"]*"\s*:/i.test(line) && /[;；]/u.test(line));
  if (edits.length === 0) continue;
  patch += `*** Update File: locales/${file}\n`;
  for (const line of edits) patch += `@@\n-${line}\n+${line.replace(/[;；]/gu, ',')}\n`;
}
process.stdout.write(`${patch}*** End Patch`);
