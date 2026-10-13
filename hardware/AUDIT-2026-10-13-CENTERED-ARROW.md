# Larger centered arrow — 13 October 2026

The physical LCD arrow is now centered at `(120, 141)`, the middle of its black content panel, rather than at the left edge. Its cardinal triangle is 24 pixels wide and 40 pixels tall, compared with 12 by 22 before. Native geometry tests cover every degree of rotation and ensure the arrow stays clear of text. Distance/bearing sit above it, accuracy/uncertainty below it, and the north-up/demo label remains visible. Uncertain, missing, expired or offline guidance still hides the arrow.

The `/phone` preview uses a larger centered SVG arrow; the simulator now places its larger arrow above the distance label. Browser bounds tests verify both layouts, including the simulator on a 390-pixel-wide phone. The yellow/purple moving quarter-ring and proximity brightness are unchanged.

## Flashed and verified

Both USB owners/MACs were resolved before uploading: Nayaka `8C:FD:49:9B:E7:40`, Syifa `8C:FD:49:9B:EE:84`. Both PlatformIO builds succeeded (RAM 20.4%, flash 44.9%), and both 115200-baud uploads passed flash hash verification. The existing local pairing key was retained; no new key was generated.

Recovery images covering `0x000000–0x30ffff` (3,211,264 bytes each, not the entire 16 MB flash) and the exact preset lists are saved locally as ignored `hardware/backups/2026-10-13-*-before-centered-arrow.*`. Nayaka's first read failed without overwriting its firmware; retrying at 230400 baud succeeded. These files have owner-only permissions and are not published. Fresh readback after flashing matched the six Nayaka and five Syifa saved messages exactly.

- 107 Node tests, 25 Python bridge tests, four native C++ suites and 13 browser UI tests passed; the production web export succeeded.
- The physical arc verifier passed seven checks. Actual central-arrow colour pixels measured 497–569 pixels, with 24-by-40-pixel cardinal bounds centered near the panel center. East, west, north and south, both owner colours, quarter-only glow and increasing near brightness passed. Uncertain and cleared fixes suppressed the light.
- The physical display verifier passed 26 checks with 24 atomic framebuffer captures, including the new usable Find Direction layout and long-message, popup and SOS screens. All bright pixels remained inside the circular boundary. The generated [Nayaka](artifacts/display/nayaka-find-demo-usable.png) and [Syifa](artifacts/display/syifa-find-demo-usable.png) images were visually inspected for centered arrow and unobstructed labels.
- The full 13-check pair run passed, including actual restart persistence, bidirectional acknowledged messages, three-step SOS, uncertain/coincident suppression, and real 60-second expiry with `--quiet-touch`. Original presets were restored and all demonstration positions cleared.

The physical direction/display tests used explicitly labelled demo coordinates, not a claim of accurate indoor GPS. Earlier real Vercel/Bluetooth tests confirmed location transport, but the laptops' reported accuracy overlapped and their providers sometimes timed out. Enlarging the arrow does not remove those device limitations. Use independent accurate phone positions outdoors to verify a usable real direction; the watch remains north-up, not wrist-relative.

See [the next-laptop Vercel prompt](NEXT_LAPTOP.md) and [location troubleshooting](LOCATION_TROUBLESHOOTING.md). Firmware recovery, pairing keys and generated capture reports remain local.

## Production handoff

Deployment `dpl_4rigPCBdy7Xn7LhtAkEgpKcQtHJ5` reached READY and was assigned to https://pulseband-steel.vercel.app. Six selected browser regression tests passed on this public URL. The separate actual-USB browser verifier also passed there in Chrome 155, without hardware/API doubles: both bands produced the larger centered preview arrows and correct rings; actual message load/add/edit/delete/sync, repeated radio popups, acknowledgements, position clearing and mobile layout passed. Cleanup restored all original messages and cleared test locations. Later commits only update tests/docs; the deployed runtime remains the verified build.
