# Retained prototype arrows and laptop R reset — 14 October 2026

The user explicitly requested that the arrow stay visible even when tracking
is lost, and proposed a repeatable physical reset with Nayaka left, Syifa
right, both flat with parallel screen tops. They selected 30 cm between screen
centres. This changes the prior policy that hid uncertain arrows and cleared
invalid motion sessions automatically.

`ResetBands.command` opens the persistent terminal controller. R seeds one new
session on both bands, clears gyro/movement history, opens Find Direction and
checks both arrow acknowledgements. Device identities and sensors are checked
on both bands before writing either reset. The controller requires its terminal
to have keyboard focus. Q exits and releases USB without clearing watch arrows.
Status is saved locally in ignored `hardware/artifacts/reset-controller-state.json`.
A partial reset is reported for retry; it does not issue a command to blank arrows.

In calibrated motion mode the arrow now remains visible while moving, with
stale/offline peer data, without radio distance, with coincident estimates and
after local/peer integration failure. It retains the last world bearing and
continues compensating for measured wrist/screen turns. The known starting
left/right arrangement supplies initial right/left arrows even before the
first peer packet. Lost tracking is labelled TRACK LOST or LAST ESTIMATE with
R RESET. Invalid displacement is not silently added to the position. Only an
explicit reset restores a lost coordinate estimate; automatic fallback to
warmer/colder search was removed. Reopening Find preserves an active session.
Missing radio distance is still reported unknown rather than invented.

Verification: all 15 native suites passed, including paired reset, moving
friend, retained arrows through movement/loss/coincidence, heading changes and
offline/range-loss rendering. Three Python controller tests passed for shared
session, identity validation before changes and missing-ack reporting without
blanking. Both owner firmware builds passed. This is a retained experimental
arrow, not a newly established reliable bearing. Position updates are made
from completed measured flat slides; missed movement and integration drift
still require physical rearrangement followed by R.

Current owner/MAC/preset status was captured before updating in ignored
`hardware/backups/2026-10-14-r-reset/`. Earlier application partition backups
remain in `hardware/backups/2026-10-14-table-arrow/`.


## Installed and exercised

Both applications were flashed on the verified USB devices with esptool hash
verification. Live status independently matched the pre-update owner/MAC and
saved presets. A PTY smoke test exercised single R without Enter, state-file
writing and clean Q exit against simulated devices. The actual macOS Terminal
controller was then launched through ResetBands.command. The user pressed R
and confirmed Nayaka right / Syifa left. Live controller status registered at
least two resets, both devices in the same active session, both arrows visible
during reported movement and unchanged saved messages. The actual snapshot is
retained in ignored `hardware/artifacts/r-reset-live-2026-10-14.json`. The
controller was left open for further resets. This verifies reset and retention,
not precise physical bearing during arbitrary movement.
