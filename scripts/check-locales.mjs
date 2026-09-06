import { readFileSync, writeFileSync } from 'node:fs';

const FILES = {
  en: 'locales/en.json',
  ko: 'locales/ko.json',
  ja: 'locales/ja.json',
};
const TAG = /\[([mcbnkage$pCURLGvrw]):([^\]\r\n]+)\]/gu;
const TAG_LIKE = /\[[A-Za-z$]+:/u;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/gu;
const NUMBER = /(?:×\s*[+−-]?\d+(?:\.\d+)?|[+−-]?\d+(?:\.\d+)?%?)/gu;
const PERIOD = /\.(?!\d)|[。．]/gu;
const HAS_PERIOD = /\.(?!\d)|[。．]/u;
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
for (const [lang, dictionary] of Object.entries(dictionaries)) {
  if (lang === 'en') continue;
  for (const key of englishKeys.filter((key) => !(key in dictionary))) {
    errors.push(`Missing ${lang} key: ${key}`);
  }
  for (const key of Object.keys(dictionary).filter((key) => !(key in dictionaries.en))) {
    errors.push(`Unexpected ${lang} key: ${key}`);
  }
}

for (const key of englishKeys) {
  const en = dictionaries.en[key];
  for (const [lang, value] of Object.entries(dictionaries).map(([lang, dict]) => [lang, dict[key]])) {
    if (typeof value !== 'string') {
      errors.push(`Locale value must be a string: ${lang}.${key}`);
      continue;
    }
    const enPlaceholders = signature(en, PLACEHOLDER);
    const placeholders = signature(value, PLACEHOLDER);
    if (enPlaceholders !== placeholders) {
      errors.push(`Placeholder mismatch ${key}: en=[${enPlaceholders}] ${lang}=[${placeholders}]`);
    }
    const enTags = signature(en, TAG);
    const tags = signature(value, TAG);
    if (enTags !== tags) {
      errors.push(`Highlight mismatch ${key}: en=[${enTags}] ${lang}=[${tags}]`);
    }
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

console.log(`Locales OK: ${englishKeys.length} keys across ${Object.keys(FILES).length} languages, aligned variables/highlights/prose`);
