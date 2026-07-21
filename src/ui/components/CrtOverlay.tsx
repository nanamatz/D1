/**
 * Global CRT post-pass (UI_DESIGN §1/§5, play-screen mockup). Three fixed,
 * pointer-events:none layers mounted once above the app root so every screen
 * inherits the finish: scanlines · vignette+barrel · a faint neutral bloom.
 * Sits OUTSIDE the board containers, so the chromatic `world-mono` greyscale
 * never touches it. Scanline flicker is disabled under reduced motion (CSS).
 */
export function CrtOverlay() {
  return (
    <>
      <div className="crt-scan" aria-hidden />
      <div className="crt-vig" aria-hidden />
      <div className="crt-bloom" aria-hidden />
    </>
  );
}
