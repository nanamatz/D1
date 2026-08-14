import { readFileSync, writeFileSync } from 'node:fs';

const FILES = {
  en: 'locales/en.json',
  ko: 'locales/ko.json',
};
const TAG = /\[([mcbnkage$pCURLGvrw]):([^\]\r\n]+)\]/gu;
const TAG_LIKE = /\[[A-Za-z$]+:/u;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/gu;
const NUMBER = /(?:×\s*[+−-]?\d+(?:\.\d+)?|[+−-]?\d+(?:\.\d+)?%?)/gu;
const PERIOD = /\.(?!\d)/gu;
const HAS_PERIOD = /\.(?!\d)/u;
const PROSE_PREFIX =
  /^(?:bossdesc|patterndesc|packdesc|consumabledesc|jokerdesc|voucherdesc|materialdesc|fontdesc|fonteffectdesc|editiondesc)\./u;
const PROSE_SUFFIX = /\.(?:body|warning|desc|tooltip)$/u;

const isProse = (key) => PROSE_PREFIX.test(key) || PROSE_SUFFIX.test(key) || /Body$/u.test(key);
const signature = (value, pattern, group = 1) =>
  [...value.matchAll(pattern)].map((match) => match[group]).sort().join(',');

function mapPlainText(value, transform) {
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(TAG)) {
    output += transform(value.slice(cursor, match.index));
    output += match[0];
    cursor = match.index + match[0].length;
  }
  return output + transform(value.slice(cursor));
}

function fixDescription(value) {
  let fixed = mapPlainText(value, (plain) =>
    plain.replace(NUMBER, (number) => `[n:${number}]`));
  return fixed.replace(PERIOD, '');
}

const dictionaries = Object.fromEntries(
  Object.entries(FILES).map(([lang, file]) => [
    lang,
    JSON.parse(readFileSync(file, 'utf8')),
  ]),
);

if (process.argv.includes('--fix')) {
  for (const [lang, file] of Object.entries(FILES)) {
    const fixed = Object.fromEntries(
      Object.entries(dictionaries[lang]).map(([key, value]) => [
        key,
        isProse(key) ? fixDescription(value) : value,
      ]),
    );
    dictionaries[lang] = fixed;
    writeFileSync(file, `${JSON.stringify(fixed, null, 2)}\n`);
  }
}

const errors = [];
const englishKeys = Object.keys(dictionaries.en);
const koreanKeys = Object.keys(dictionaries.ko);
for (const key of englishKeys.filter((key) => !(key in dictionaries.ko))) {
  errors.push(`Missing Korean key: ${key}`);
}
for (const key of koreanKeys.filter((key) => !(key in dictionaries.en))) {
  errors.push(`Missing English key: ${key}`);
}

for (const key of englishKeys.filter((candidate) => candidate in dictionaries.ko)) {
  const en = dictionaries.en[key];
  const ko = dictionaries.ko[key];
  if (typeof en !== 'string' || typeof ko !== 'string') {
    errors.push(`Locale values must be strings: ${key}`);
    continue;
  }

  const enPlaceholders = signature(en, PLACEHOLDER);
  const koPlaceholders = signature(ko, PLACEHOLDER);
  if (enPlaceholders !== koPlaceholders) {
    errors.push(`Placeholder mismatch ${key}: en=[${enPlaceholders}] ko=[${koPlaceholders}]`);
  }

  const enTags = signature(en, TAG);
  const koTags = signature(ko, TAG);
  if (enTags !== koTags) {
    errors.push(`Highlight mismatch ${key}: en=[${enTags}] ko=[${koTags}]`);
  }

  for (const [lang, value] of [['en', en], ['ko', ko]]) {
    const withoutTags = value.replace(TAG, '');
    if (TAG_LIKE.test(withoutTags)) errors.push(`Invalid highlight tag ${lang}.${key}`);
    if (isProse(key) && HAS_PERIOD.test(value)) {
      errors.push(`Description contains a period ${lang}.${key}`);
    }
    if (isProse(key) && NUMBER.test(withoutTags)) {
      errors.push(`Unhighlighted number ${lang}.${key}`);
    }
    NUMBER.lastIndex = 0;
  }
}

if (errors.length > 0) {
  throw new Error(`Locale check failed (${errors.length})\n${errors.join('\n')}`);
}

console.log(`Locales OK: ${englishKeys.length} paired keys, aligned variables/highlights/prose`);
