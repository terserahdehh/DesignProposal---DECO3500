# Signed forward/backward position updates — 14 October 2026

The user reported that sliding either band forward/backward on a flat table,
without changing its orientation, did not adjust both arrows. The laptop R
reset and retained arrows were already working and remain in place.

An owner-verified raw IMU recording captured the user's movements with the
reset controller closed. The first timed recording missed the movements; a
second recording conflicted with a reopened controller. Neither is used as
movement evidence. The successful third recording contains a forward/backward
pair on Nayaka and two pairs on Syifa. Raw data and initial/final device status
remain in ignored `hardware/artifacts/forward-back-imu-2026-10-14-03.jsonl`.
The cropped regression fixture is `tests/fixtures/forward-back-2026-10-14.txt`.

The old position update projected the measured displacement onto a direction
estimated from high-pass acceleration, then took its absolute value. That
filter could reverse the direction: Nayaka's recorded forward and backward
slides both voted backward. Several Syifa slides also voted diagonally. The
gravity-corrected rest-to-rest acceleration integral already had the correct
signed Y movement, but the projection discarded it.

`SlideResult` now carries signed heading-frame X/Y displacement. Table position
tracking adds both components directly and shares the resulting position with
the peer. The filtered direction vote remains available for the separate
warmer/colder mode. Slide diagnostics expose `dx` and `dy` alongside length.
Lift, tilt, turn and long-movement rejection rules are unchanged. Position
tracking now has its own displacement threshold, described below.

All 15 native suites passed. The recorded regression requires exactly two
accepted moves per window, forward Y above +0.20 m, backward Y below -0.20 m,
and lateral movement below 0.06 m. Replayed Y displacements were +0.268/-0.269 m
for Nayaka, +0.266/-0.241 m and +0.244/-0.255 m for Syifa. Each pair turns both
arrows and returns them near the starting bearings. The user described roughly
20 cm slides; these estimates establish direction/sign behavior, not absolute
distance accuracy. Additional tests move either band in eight directions,
return it to its starting position and verify both reciprocal bearings. Moving
both bands equally correctly leaves their relative direction unchanged.

Both Nayaka and Syifa firmware builds passed. Pre-update owner/MAC/preset status
is saved in ignored `hardware/backups/2026-10-14-forward-back/`; earlier full
application partition backups remain available in the table-arrow backup folder.

Both application images were installed at 0x10000 on the owner-verified USB
devices with esptool hash verification. Fresh post-reboot USB status matched
both owners, MACs and saved message lists; both motion sensors and radios were
ready. That report is in ignored
`hardware/artifacts/forward-back-install-2026-10-14.json`. The actual macOS
Terminal R controller was reopened for the user's physical check. The serial
verification connection was closed before starting the controller.

This remains an experimental motion estimate. Coordinates update when a
measured flat slide finishes; they are not freshly measured positions during a
continuous slide. Missed movement and integration drift still require the
known physical starting arrangement followed by R. Moving directly along the
line between bands can correctly change distance without changing bearing.

## Return rejection and one-sided following

The user tested the first installed revision and reported that returns still
failed and only one band followed the other. Controller snapshots showed an
initial Nayaka Y update changing both bearings, followed by a rejected lift.
Syifa then reported fresh signed displacement, but both bearings stayed at
their older world direction because an invalid local or peer coordinate froze
the bearing calculation. The first installation therefore did not establish
the requested working behavior.

A second owner-verified raw recording is retained in ignored
`hardware/artifacts/return-slide-imu-2026-10-14-04.jsonl`. It contains a backward
Nayaka segment with signed Y = -0.039 m rejected as too-small because its
filtered direction weight was 0.0046. The regression fixture
`tests/fixtures/weak-return-2026-10-14.txt` verifies that this actual segment
now updates position. Position tracking accepts finite signed displacement of
1.5 cm to 1.5 m when only the filtered strength/peak checks fail; the original
warmer/colder acceptance rules remain unchanged. These are experimental bounds.

Rejected lifting, tipping, turning and overlong handling mark coordinates
uncertain. They no longer prevent later measurable flat movements from updating
that band's coordinates. Fresh peer coordinates can update both estimated
bearings even when either coordinate carries the uncertainty flag. The screen
says ESTIMATE - R RESET; R restores a known starting arrangement. This keeps
the arrows responsive to subsequent measurable movement, but does not measure
the rejected movement or repair an accumulated position error.

All 15 native suites passed with the new recorded-return regression, noise
rejection, weak returns and reciprocal following after a rejected lift. The
affected tracking suite also passed after extending the uncertainty flag to
rejected tipping/turning. Both revised owner builds passed. Arbitrary lifted
or wrist movement remains unsupported by this planar displacement model.

Both recovery revisions were installed on the verified USB bands with esptool
hash verification. Fresh USB status confirmed owner/MAC identity, unchanged
message lists, present IMUs, ready radios and the new positionUsable diagnostic
on both. The report is in ignored
`hardware/artifacts/return-recovery-install-2026-10-14.json`. The serial check
closed before reopening the actual Terminal R controller. Physical following
after this second installation is being checked separately from the replay.
