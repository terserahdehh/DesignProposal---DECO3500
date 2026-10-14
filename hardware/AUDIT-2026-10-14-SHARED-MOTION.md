# Shared motion experiment — 14 October 2026

The user reported the warmer/colder arrow pointing opposite and staying at an
old bearing when the other band moved. That method combines past approach/
retreat votes; it does not supply the friend's current position. Both bands
now have a separate experimental shared-motion mode.

The user explicitly agreed to an aligned starting arrangement and confirmed
Nayaka left of Syifa, screen tops parallel, about 30 cm between centres. This
known initial arrangement seeds the common frame; it is not a radio-derived
position or an automatically measured bearing.

Each completed flat slide adds an experimental rest-to-rest displacement to
that band's X/Y estimate. Absolute X/Y estimates, session, sequence, validity
and moving state are sent over encrypted ESP-NOW every 100 ms using a new
packet kind without changing the packet size. The receiver rejects stale,
reordered and different-session coordinates. Either band's completed movement
therefore changes the relative vector, including when the seeker stays still.
Gyroscope heading makes the arrow relative to the current screen orientation.
RSSI and warmer/colder evidence do not reverse this motion arrow.

The physical screens label it MOTION ESTIMATE. While moving, without fresh
peer telemetry for 1.5 s, after a lift or an overlong slide, or when estimated
positions coincide, the arrow is withheld. Old walk/probe/demo arrows cannot
reappear as fallbacks in this mode. These conditions do not solve tracking;
they prevent an obsolete estimate from being presented as current.

All 15 native suites passed. Added regressions cover a moving friend updating
a stationary seeker, both bands moving, turns, stale/reordered/session-mismatched
telemetry, lost position and old-probe suppression. Smooth synthetic 30 cm
slides in eight directions reproduce displacement to within 3 cm. A recorded
physical rightward push estimated 21.9 cm; its exact physical length was not
independently measured, so this is not a displacement-accuracy result. Both
firmware builds passed.

The experiment updates once a short slide stops; it does not establish an
accurate position throughout continuous motion. Tilt, gentle missed slides,
acceleration bias and integration error can leave position estimates wrong.
Errors accumulate and need a new physical alignment and start command.
Ordinary wrist movement and different heights remain unverified. The public
phone preview has not been updated for this experimental mode.

Use `start_table_tracking.py --separation-cm <actual separation>` with both
bands correctly arranged and still. `record_table_direction.py` records the
real movement/position diagnostics. Earlier application backups remain in
ignored `hardware/backups/2026-10-14-table-arrow/`; current pre-update owner,
MAC and presets were also captured in `2026-10-14-shared-motion/`.


## First real shared-motion trial

The 90-second trial recorded 260 actual sessions. Nayaka's estimated position
changed from (0,0) to (-0.0614,0.1640) m while Syifa's remained (0.3,0) m.
Syifa's arrow changed from about 270 degrees to 294.4 degrees without a change
in its own estimated coordinates. This demonstrates reception of the moving
friend's estimate by the stationary band. The user reported the stationary
arrow followed the moving band. Screen/owner naming in the user's response
was not independently instrumented; the telemetry identifies the actual
firmware owners above. This does not establish angular accuracy.

Later both estimates became invalid, USB disconnected/reconnected and the
motion sessions were off. The user confirmed a new starting arrangement for
reinitialisation after the final firmware update. The first recording also
exposed incorrect stale labels from comparing the peer receive time against
the earlier ranging report time. That diagnostic now uses the current clock;
the actual arrow decisions already did.


## Final installed state

The final diagnostic correction was built and flashed on both verified USB
devices; esptool verified each application hash. The user confirmed the
starting arrangement again, and the final session was initialised at 30 cm.
Live responses showed both physical arrows visible in motion-estimate mode,
with Nayaka near 90 degrees and Syifa near 270 degrees, and fresh shared peer
positions. The bands were left in this mode. Saved messages were independently
matched to pre-update copies after the first shared-mode install; application
flashes do not overwrite their NVS partition.

This is a completed experimental update, not a claim that the original
continuous-navigation requirement is fully solved: short measured slides can
update a stationary friend's arrow, but mid-slide guidance is withheld and
position integration can drift or be lost.


## Missing-arrow recovery correction

A later live read showed both bands still in an active motion session with
state `realign`; valid distance and peer heartbeats remained available. That
terminal state suppressed the arrow indefinitely. The failed session was
cleared on both bands and new direction votes were reset. The user reported
a new slide produced an arrow toward the stationary friend. Independent USB
readback confirmed a visible Syifa probe arrow around 254.4 degrees, with a
counted 29.2 cm estimated slide. Its radio signal rose 14 dB and distance
changed -4.9 cm; this is a distance-plus-signal estimate, not verification of
a distance-only four-direction algorithm. Nayaka had not collected a probe.

The firmware now automatically leaves shared-motion mode when its position
estimate or its peer's becomes invalid, or when peer updates are missing for
five seconds. It clears all previous walk/probe/slide estimates and resumes
movement search. A five-second grace period is measured from actual session
start, preventing recovery from cancelling a new session immediately on a
long-running band. All 15 native suites passed, including invalid-local,
invalid-peer, short outage, prolonged outage and session-start grace checks.
Both firmware builds passed. This recovery does not invent a replacement
bearing; new usable movement measurements are required for another arrow.


The recovery correction was flashed to both owner-verified devices and each
application hash was verified by esptool. Actual USB tests started an unmatched
motion session on one band at a time, confirmed no navigation arrow without
a matching peer position, then verified automatic clearing after six seconds
with radio heartbeats and saved messages intact. Both passed. Both bands were
left on Find Direction in fresh movement search with valid Wi-Fi distance.
No claim is made that an arrow is visible before a new usable movement probe.
The actual recovery report is in ignored
`hardware/artifacts/automatic-direction-recovery-2026-10-14.json`.
