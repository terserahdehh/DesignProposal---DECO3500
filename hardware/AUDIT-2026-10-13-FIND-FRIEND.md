# Find Friend on the physical bands — 13 October 2026

Both bands now measure their distance to each other by Wi-Fi round-trip timing, show it with a pulsing proximity ring, and offer two clearly labelled direction aids (walk-to-find estimate and a demo arrow). They still cannot measure *which way* the other band is at desk scale, and centimetre movement is not detectable. Physical results below are kept separate from simulated tests.

## Hardware actually present

Read from both running bands (`status.sensors`): CST816S touch at I²C `0x15`, QMI8658 accelerometer/gyroscope at `0x6B` (WHO_AM_I `0x05`), nothing else on the bus. No GPS, magnetometer, direction-finding radio, buzzer or speaker. USB bridges are WCH CH343 (`5B91033770` Nayaka `8C:FD:49:9B:E7:40`, `5B91034227` Syifa `8C:FD:49:9B:EE:84`); owners and MACs were verified from firmware before every flash.

## Pairing key and backups

The laptop used for this update had no `pairing_keys.h`. Recovering the old key from the bands was not done; a new key was generated with `configure_pair.py` and both bands were flashed together. They pair normally (`peerConnected: true`). Another laptop's older key file no longer matches: copy the new file privately before building there. Before any write, 3.06 MB recovery images (`0x0–0x30ffff`, with the old key) and both preset lists were saved in the ignored `hardware/backups/2026-10-13-*-before-ranging.*`. Only the app, bootloader, partition table and OTA-select regions were written; NVS was untouched and both preset lists (Nayaka 6, Syifa 5) matched the backups after every flash.

## Distance: Wi-Fi Fine Timing Measurement (physical)

Each band runs a hidden, password-protected SoftAP that only answers FTM and times 16-frame sessions to the other. Raw round trips are quantised in 1.5625 ns steps (≈23 cm one way) and jump between two clusters 12.5 ns apart (one 80 MHz period), with a strong signal-dependent offset near the bands. The 20th-percentile frame is used, then a linear calibration fitted on three positions measured with the laptop width (31.3 cm) as a ruler:

| Position (flat, screens up) | Calibrated reading | Error |
| --- | --- | --- |
| Touching (fit) | 0.03 m | −0.02 m |
| 0.28 m, clear (fit) | 0.40 m | +0.12 m |
| 1.2 m, clear (fit) | 1.31 m | +0.11 m |
| 0.62 m, clear (held out) | 2.03 m | +1.41 m (multipath) |
| 0.25 m, laptop in between (held out) | 0.57 m | +0.32 m |

Later sessions read touching as 0.10–0.22 m and an estimated 1 m as 0.44–0.55 m. Readings depend on orientation and obstacles; beyond 1.2 m the calibration is an uncalibrated time-of-flight extension.

**Timing (telemetry from both bands).** One session every 615 ms (median; 90th percentile 719 ms), 98.7–99.2% successful. After a move the screen changes on the next session (~0.7 s) and the 3-session average settles in ~1.3–2 s.

**Disconnect and recovery.** Syifa was held in its ROM bootloader with a read-only `esptool chip-id` (no flash writes) while Nayaka's telemetry was recorded: ranging failed 0.7 s later, the light and pulses switched off at 2.0 s (three failed sessions), and the screen showed *Peer offline* at 6.0 s. After Syifa was reset, ranging, peer link, ring and pulses were back after 2.5 s.

## Light and pulses (physical)

The proximity curve is full brightness and 150 ms pulses at ≤0.2 m, dimmest and 2 s pulses at 20 m, silent beyond. With no buzzer, the ring flashes on each beep. Observed by the user: fast flashing when touching; clearly slower when ~1 m apart; brightness differences (1.00 vs 0.67 in the framebuffer) were *not* noticeable on the LCD. `/phone` plays the reported interval through the laptop speaker, labelled **LAPTOP PREVIEW**. An earlier curve (0.98 → 0.73 over the same move) was reported as "the same", which led to the steeper curve and the pulse.

## Direction

**Inertial tracking of the moved band does not work (physical).** Raw 112 Hz accelerometer/gyroscope data was recorded while Syifa's band was moved by hand. Moves involved 6–28 s of lifting and turning (up to 157°/s). Dead reckoning drifted metres to hundreds of metres; after returning the band to its start, the estimate placed it 0.94 m away. It was removed.

**Labelled demo (physical pixels).** `<` / `>` rotate a quarter light and arrow in 45° steps, labelled *DEMO - NOT MEASURED*; brightness follows the measured distance. From captured framebuffers, the ring's weighted centre and the arrow tip matched the demo bearing within 0.1° at every 45° step including 315° → 0°, and the lit arc spanned 90°.

**Walk-to-find (simulated; partly physical).** Steps (vertical bounce) and turns (gyroscope about gravity) trace the seeker's path; ranges along it locate a stationary friend by robust trilateration. Physical checks: a clockwise turn read as positive (~+90° peak); two 10-step marches on the spot counted 9 and 15 steps. The first march exposed a false arrow for 25 s (41 sessions). Two physical constraints now refuse such windows (triangle inequality between walk points; latest distance under 2 m). Replaying the recorded data gives 0 arrows, and that window is a regression test. A real walking test was not possible because both bands stay on this laptop's USB cables.

**GPS (unchanged).** North-up guidance from both phones' fixes is still available outdoors. A Wi-Fi distance shorter than the combined GPS uncertainty now hides the GPS arrow as contradicted.

A following arrow needs angle-of-arrival hardware (UWB with two antennas, e.g. Qorvo QM33120W, or NXP SR150 modules such as Murata Type 2BP) and a magnetometer for wrist-relative heading. See [what the bands actually measure](README.md#find-a-friend-what-the-bands-actually-measure).

## Live browser check (physical bands, no doubles)

Chrome (headless, via Playwright) opened `http://localhost:8081/phone` with the running USB bridge. For each wearer it showed *Distance to … · no direction yet*, ≈0.3–0.4 m ±0.15 m, a non-directional ring at 79–90% brightness, no arrow, and the labelled laptop preview reporting the band's real intervals (210–258 ms). No page errors; no horizontal overflow at 390 px.

## Tests and builds

- 12 native firmware-logic suites (`hardware/tests/run_native.sh`): ranging estimator/calibration/tracker, proximity curve and pulse scheduling, Find guidance (arrow/quarter alignment and wraparound, distance-only ring, uncertain GPS showing no number, contradiction, offline/stale/recovery, demo, walk estimate), walk solver (including the recorded march window), step tracker, a simulated end-to-end walk, plus the existing arc/arrow/layout/location/touch suites.
- 35 bridge tests, including ranging telemetry kept out of message history, the telemetry endpoint, `statusReceivedAt` and clearing stale measurement blocks.
- 127 Node tests and 18 browser UI tests on the production export (protocol doubles), including the distance-only ring, the beep preview stopping on unusable/stale data and recovering, the demo and walk-estimate labels.
- Firmware builds for both owners (RAM 21.3%, flash 45.8%); a `PULSE_BUZZER_PIN` build was also compiled.

Framebuffer captures show firmware pixels, not the physical LCD or the room.
