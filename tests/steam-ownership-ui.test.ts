import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Steam ownership renderer boundary', () => {
  it('mounts one accessible non-identifying ownership modal with bilingual copy', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    const modal = readFileSync('src/ui/components/SteamOwnershipNotice.tsx', 'utf8');
    const en = JSON.parse(readFileSync('locales/en.json', 'utf8'));
    const ko = JSON.parse(readFileSync('locales/ko.json', 'utf8'));
    expect(app).toContain('<SteamOwnershipNotice />');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-labelledby="steam-owner-title"');
    expect(modal).toContain('id="steam-owner-title"');
    expect(modal).toContain("decideSteamClaim('accept')");
    expect(modal).toContain("decideSteamClaim('decline')");
    expect(modal).not.toContain('steamId64');
    expect(app).toContain("document.querySelector('.steam-owner-card')");
    expect(modal).toContain("event.key === 'Escape'");
    expect(modal).toContain("event.key !== 'Tab'");
    expect(modal).toContain('event.shiftKey');
    expect(modal).toContain('last.focus()');
    expect(modal).toContain('first.focus()');
    for (const key of [
      'steam.owner.claim-required.title', 'steam.owner.claim-required.body',
      'steam.owner.mismatch.title', 'steam.owner.invalid.title',
      'steam.owner.accept', 'steam.owner.decline',
    ]) {
      expect(en[key]).toBeTruthy();
      expect(ko[key]).toBeTruthy();
    }
  });
});
