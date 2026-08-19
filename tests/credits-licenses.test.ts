import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const text = (path: string) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

describe('Credits legal notices', () => {
  it('uses the approved localized production and legal copy', () => {
    const en = JSON.parse(text('locales/en.json')) as Record<string, string>;
    const ko = JSON.parse(text('locales/ko.json')) as Record<string, string>;
    expect(en['credits.audio']).toBe('All BGM and most sound effects are generated at runtime from oscillator, noise, and sequencer recipes designed and implemented for this game with assistance from ChatGPT and Claude.');
    expect(en['credits.audioSource']).toBe('Pack-opening, reroll, and chip-laying, stacking, handling, and collision sounds use samples from Casino Audio 1.1 by Kenney Vleugels (Kenney.nl), released under CC0 1.0.');
    expect(en['credits.visuals']).toContain('they do not grant or imply rights in third-party material');
    expect(en['credits.legal.open']).toBe('Legal Notices');
    expect(ko['credits.legal.open']).toBe('법적 고지');
    expect(ko['credits.legal.verbatim']).toBe('라이선스 원문은 변경 없이 영어로 표시됩니다.');
  });

  it('locks shipped software/font versions and required notice signatures', () => {
    const lock = JSON.parse(text('package-lock.json')) as {
      packages: Record<string, { version?: string }>;
    };
    expect(lock.packages['node_modules/react']?.version).toBe('18.3.1');
    expect(lock.packages['node_modules/react-dom']?.version).toBe('18.3.1');
    expect(lock.packages['node_modules/scheduler']?.version).toBe('0.23.2');
    for (const id of ['jost', 'noto-sans-kr', 'baloo-2', 'jersey-10']) {
      expect(lock.packages[`node_modules/@fontsource/${id}`]?.version).toBe('5.3.0');
    }

    const notices = text('public/licenses/THIRD_PARTY_NOTICES.txt');
    for (const signature of [
      'Copyright (c) Facebook, Inc. and its affiliates.',
      'Copyright 2020 The Jost Project Authors',
      'Google Inc.',
      'Copyright 2019 The Baloo 2 Project Authors',
      'Copyright 2023 The Soft Type Project Authors',
      'Casino Audio 1.1 by Kenney Vleugels',
      'compiled by Alan Beale and',
      'Moby Part-of-Speech II by Grady Ward',
      'WordNet 3.0',
      'Wiktionary contributors',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'Offline snapshot retrieved: 2026-08-03',
    ]) expect(notices).toContain(signature);
    expect(text('public/licenses/MIT.txt')).toContain('Permission is hereby granted');
    expect(text('public/licenses/OFL-1.1.txt')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(text('public/licenses/CC0-1.0.txt')).toContain('CC0 1.0 Universal');
    expect(text('public/licenses/WORDNET_LICENSE.txt')).toContain('WordNet 3.0 Copyright 2006');
    expect(text('public/licenses/MIT.txt')).toBe(text('node_modules/react/LICENSE'));
    const oflHeading = 'SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007';
    const normalizeNotice = (value: string) => value.replace(/[-\s]+/g, ' ').trim();
    expect(normalizeNotice(text('public/licenses/OFL-1.1.txt'))).toBe(normalizeNotice(
      text('node_modules/@fontsource/jost/LICENSE').slice(
        text('node_modules/@fontsource/jost/LICENSE').indexOf(oflHeading),
      ),
    ));
    expect(text('public/licenses/WORDNET_LICENSE.txt')).toBe(text('data/WORDNET_LICENSE.txt'));
    expect(text('public/licenses/WIKTIONARY_ATTRIBUTION.md')).toBe(text('data/WIKTIONARY_ATTRIBUTION.md'));
    expect(text('public/licenses/CC0-1.0.txt')).toBe(text('src/ui/legal/CC0-1.0.txt'));
  });

  it('covers every imported OGG and never labels original synthesis CC0', () => {
    const audio = text('src/ui/audio.ts');
    const imports = [...audio.matchAll(/from '\.\.\/\.\.\/Audio\/([^']+\.ogg)'/g)]
      .map((match) => match[1]!);
    const notices = text('public/licenses/THIRD_PARTY_NOTICES.txt');
    expect(imports).toHaveLength(17);
    for (const file of imports) expect(notices).toContain(file);
    const audioLicenses = text('assets/AUDIO_LICENSES.md');
    expect(audioLicenses).not.toContain('CC0 / original');
    expect(audioLicenses).toContain('© 2026 Ben Kim — all rights reserved');
  });

  it('ships static notices through Vite public assets without navigation or fetch', () => {
    const component = text('src/ui/components/Options.tsx');
    const css = text('src/ui/styles/screens.css');
    const spec = text('docs/screens-spec.md');
    const vite = text('vite.config.ts');
    expect(component).toContain('<details className="cr-legal">');
    expect(component).toContain('<summary>{t(\'credits.legal.open\')}</summary>');
    expect(component).toContain('<pre>{THIRD_PARTY_NOTICES}</pre>');
    expect(component).not.toMatch(/fetch\(|window\.open|location\.href/);
    expect(css).toMatch(/\.cr-legal-body\s*\{[^}]*max-height:[^}]*overflow:\s*auto;/s);
    expect(spec).toContain('original runtime-synthesized BGM/most SFX from the 17 local Kenney');
    expect(spec).toContain('native **Legal Notices** disclosure');
    expect(spec).not.toContain('all SFX/BGM are original runtime synthesis');
    expect(vite).not.toMatch(/publicDir\s*:\s*false/);
    expect(text('LICENSE')).toContain('Copyright © 2026 Ben Kim. All rights reserved.');
    expect(text('LICENSE')).toContain('public/licenses');
  });

  it('marks superseded synth-only plans without rewriting their history', () => {
    const historicalAudioDocs = [
      'docs/superpowers/plans/2026-07-19-sound-phase1-sfx.md',
      'docs/superpowers/plans/2026-07-22-feel-polish-pass-2.md',
      'docs/superpowers/plans/2026-07-23-warmth-punch-polish.md',
      'docs/superpowers/specs/2026-07-22-feel-polish-pass-2-design.md',
      'docs/superpowers/specs/2026-07-23-warmth-punch-polish-design.md',
      'docs/superpowers/specs/2026-07-29-desktop-packaging-design.md',
    ];
    for (const file of historicalAudioDocs) {
      const doc = text(file);
      expect(doc).toContain('Superseded audio provenance (2026-08-19)');
      expect(doc).toContain('17 Kenney Casino Audio 1.1 samples');
      expect(doc).toContain('assets/AUDIO_LICENSES.md');
      expect(doc).toContain('docs/screens-spec.md` §2.13');
    }
  });
});
