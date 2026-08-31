const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i;

export function shouldShowMobileGitHubPagesNotice(
  hostname: string,
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, '');
  const isGitHubPages = normalizedHost === 'github.io' || normalizedHost.endsWith('.github.io');
  const isIPadOs = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  return isGitHubPages && (MOBILE_USER_AGENT.test(userAgent) || isIPadOs);
}
