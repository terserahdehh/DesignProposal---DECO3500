# Experimental three-axis movement — 14 October 2026

The user reported that FIND SYIFA movement still failed after the signed
displacement/recovery fixes, and asked for movement off a flat surface if
possible. Physical controller snapshots contained more rejected lifting and
tipping. Later snapshots showed a successful flat Nayaka forward/back pair
after another R reset, but that does not establish unrestricted following.
The preceding audit records the unsuccessful physical revisions.

`rest_motion.h` adds a separate experimental inertial displacement for moves
rejected by the flat-table direction model. It rotates accelerometer readings
through measured three-axis gyro rotation into the known reset frame, subtracts
interpolated start/end resting gravity and integrates signed rest-to-rest
X/Y/Z. Finite displacement between 1.5 cm and 1.5 m can update the estimate.
Handling over the 12-second detector window and oversized estimates remain
unmeasured. Warmer/colder votes retain their existing rejection rules.

The gyro attitude persists between moves and through a vertical screen;
reinitializing from gravity on every move would lose the orientation after
crossing vertical. During detected stillness gravity corrects tilt, while
heading drift still requires R. The flat displacement calculation remains
in use for face-up moves that pass the original handling checks; a full
three-axis calculation is also used when a move starts more than 15 degrees
from face-up. Both are experimental displacement estimates.

`TableTracking` now retains Z alongside X/Y. MOTION_STATE uses its existing
accuracy field for estimated height; other packet kinds keep their existing
meaning and the fixed packet size is unchanged. Both bands are updated
together. Three-axis direction projects the estimated relative vector into
the current screen plane. If that projection vanishes, its previous angle
remains visible. Uncertainty after rejected table motion remains labelled
ESTIMATE - R RESET, but subsequent measurable moves can update both arrows.

All 16 native suites passed. The affected motion and shared-tracking suites
also passed after final mode-selection and vertical-bearing edits. Tests
use an analytical body-Y rotation through 120 degrees while translating by
known X/Y/Z, pure rotation with no translation, a real gyro-driven orientation
crossing vertical, common-frame heading, height sharing and screen projection.
The recorded fixture `tests/fixtures/lift-return-2026-10-14.txt` also exercises
a formerly rejected lifted forward estimate followed by a backward estimate,
requiring both arrows to respond and finish within 20 degrees of their seeded
bearings. Those recorded signs are a regression check; exact physical positions
were not independently measured. Flat recorded regressions remain passing.

This is a trial of three-axis dead reckoning, not established reliable wrist
navigation. It has no independent absolute position reference and accumulates
error. Updates happen after a measured movement ends, not continuously during
the movement. Physical ground-truth testing is still needed after installation.

Both final owner builds passed and were installed app-only at 0x10000 with
esptool hash verification. One Nayaka attempt was interrupted when the user
reopened the USB controller; the controller was closed and the upload was
retried successfully. Fresh USB status verified both owners/MACs, saved message
lists, present IMUs, ready radios and three-axis diagnostics. Firmware hashes
and status are in ignored `hardware/artifacts/three-axis-install-2026-10-14.json`.
The verification connection was then closed and the real Terminal R controller
reopened for the physical check. The final build uses 139,832 bytes of static
RAM (42.7%); both devices booted and answered full status after installation.

The user requested keeping this functionality as it is, then asked to remove
the four UI dots. The live recording contains both arrows remaining visible,
fresh coordinate changes reaching the peer, and repeated R resets. Some held
motions exceeded the detector window and estimates varied substantially.
User acceptance to retain the current behavior is not evidence of accurate
unrestricted direction tracking. The UI-only follow-up preserves this motion
implementation; diagnostics are retained in ignored
`hardware/artifacts/three-axis-live-2026-10-14.jsonl`.

The four corner-dot drawing calls were subsequently removed from the shared
renderer on the user's instruction. Tracking code was kept as-is. Both owner
builds and app-only uploads passed with hash verification. Fresh owner/MAC and
saved-message checks passed; atomic framebuffer snapshots of both devices had
neutral pixels at all four former dot centres, and both PNGs were visually
inspected. The UI report is in ignored
`hardware/artifacts/no-corner-dots-2026-10-14.json`. Existing display-verification
expectations and the current user guides were updated for the removed dots.
The reset controller was reopened after releasing the verification USB ports.
