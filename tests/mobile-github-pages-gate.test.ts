import { describe, expect, it } from 'vitest';
import { shouldShowMobileGitHubPagesNotice } from '../src/ui/mobileGate';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

describe('GitHub Pages mobile gate', () => {
  it('shows only for a mobile visitor on a GitHub Pages hostname', () => {
    expect(shouldShowMobileGitHubPagesNotice('owner.github.io', IPHONE)).toBe(true);
    expect(shouldShowMobileGitHubPagesNotice('OWNER.GITHUB.IO.', IPHONE)).toBe(true);
    expect(shouldShowMobileGitHubPagesNotice('owner.github.io', DESKTOP)).toBe(false);
    expect(shouldShowMobileGitHubPagesNotice('play.example.com', IPHONE)).toBe(false);
    expect(shouldShowMobileGitHubPagesNotice('github.io.example.com', IPHONE)).toBe(false);
  });

  it('recognizes iPadOS when Safari uses a desktop-style user agent', () => {
    const ipadDesktopUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
    expect(shouldShowMobileGitHubPagesNotice('owner.github.io', ipadDesktopUa, 5)).toBe(true);
    expect(shouldShowMobileGitHubPagesNotice('owner.github.io', ipadDesktopUa, 0)).toBe(false);
  });
});
