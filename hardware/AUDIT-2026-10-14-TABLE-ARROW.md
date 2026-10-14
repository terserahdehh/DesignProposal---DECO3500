# Table arrow update — 14 October 2026

The working tree already contained the measured-slide detector, recorded IMU
fixtures, and range/signal warmer-colder integration from an earlier attempt.
Those changes were preserved. This update fixes the displayed angular spread:
repeated slides along one line no longer imply improved sideways precision.
The estimate uses the weighted coverage of slide axes to narrow only when
movements cover additional directions. The number remains a heuristic.

The Find screen now prompts the wearer to hold still during baseline and
post-move collection. Opening Find clears the slide diagnostic count and last
result along with the probe history. A read-only manual trial recorder and
[table test instructions](TABLE_DIRECTION_TEST.md) were added. The hardware
README now describes measured pushes rather than the old top-of-screen aim
assumption, and explains the stationary-friend/tabletop requirement.

## Verification

- All 14 native C++ suites passed, including recorded physical IMU pushes and
  the new repeated-line ambiguity regression.
- Both owner firmware builds passed. Each application's written data hash was
  verified by esptool after flashing the actual USB device.
- Live readback verified owners/MACs, unchanged saved messages, both motion
  sensors, bidirectional ESP-NOW peer connection and valid Wi-Fi ranging.
- Both bands were left in Find Direction with previous estimates cleared.
- Live install results are saved locally in the ignored
  `hardware/artifacts/table-arrow-install-2026-10-14.json`.

Before flashing, each entire 3 MiB primary application partition at address
`0x10000` was backed up to the ignored
`hardware/backups/2026-10-14-table-arrow/`, along with full pre-update status
and saved messages. These are application backups, not complete flash images.
Only the application was flashed; NVS, pairing configuration and presets were
preserved.

A subsequent 90-second manual table trial recorded 283 actual measurement
sessions (142 Nayaka, 141 Syifa). Both produced counted probe estimates. The
user reported Nayaka pointed toward Syifa and Syifa pointed toward Nayaka in
the two requested trials. The recording and user observations are retained
locally as `hardware/artifacts/table-trial-2026-10-14-01.jsonl` and its summary.
The screen orientations and physical target bearing were not independently
measured, so this is a user-observed success rather than an angular-accuracy
verification. One slide
provides a broad approach/retreat hint; radio multipath, orientation changes,
gyro drift and a moving friend can still give a wrong or stale arrow. Ordinary
wrist movement and different heights are not verified by this update.


## Subsequent correction

The user later reported an opposite arrow and no following update on the
stationary band when the friend moved. The earlier visual confirmations do
not establish ongoing tracking. The warmer/colder method retains old votes;
it does not measure the friend's current X/Y position. A separate experimental
shared motion mode now addresses updates from either band's movement.
