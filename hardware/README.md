# PulseBand on the two physical bands

The connected boards were identified from their factory firmware as **Waveshare ESP32-S3-Touch-LCD-1.28**: round 240×240 GC9A01 displays, CST816S touch, 16 MB flash and 2 MB QSPI PSRAM. The pin profile comes from the [official board documentation](https://docs.waveshare.com/ESP32-S3-Touch-LCD-1.28) and [Arduino examples](https://docs.waveshare.com/ESP32-S3-Touch-LCD-1.28/Arduino).

| Wearer | USB serial | Device MAC | Bluetooth name |
| --- | --- | --- | --- |
| Nayaka | `5B91033770` | `8C:FD:49:9B:E7:40` | `PulseBand-Nayaka` |
| Syifa | `5B91034227` | `8C:FD:49:9B:EE:84` | `PulseBand-Syifa` |

The watch displays only the white circular casing, its message screen, three touch buttons, coloured notification indicators and SOS button. It does not display the surrounding prototype website or strap. Messages travel directly between the two bands using encrypted ESP-NOW on Wi-Fi channel 1. An application acknowledgement distinguishes **Received by band** from **Delivery unconfirmed**; acknowledgement does not mean that the wearer read it. Both bands need power and radio range, but no router or laptop is required for this exchange.

## Use the bands

1. Tap **OK** to open the menu. Use **<** and **>** to cycle through Find Direction and saved messages.
2. Select a message with **OK**, then confirm with **OK** to send it to the other band. **<** cancels.
3. The receiving band shows the sender and message. Messages from Nayaka light the purple display indicator; messages from Syifa light the yellow indicator. Tap the message or any button to dismiss it.
4. Tap the red triangle to open SOS. Three separate **OK** presses send an alert to the paired band; **<** or **>** cancels. This is a prototype peer alert.
5. Open Find Direction to view location guidance. Missing or expired positions display **Location unavailable**.

These are touch controls drawn on the LCD. The board's BOOT/RESET buttons are not the watch navigation buttons. The coloured indicators are pixels on the LCD; these boards have no programmable notification RGB LEDs or vibration motor attached.

## Prepare messages at `/phone`

Start the web app from `prototype/` with `npm ci`, then `npm run web`. Open **http://localhost:8081/phone** and select Nayaka or Syifa. Connect that wearer's band using one of the methods below. On a new phone/browser, or after reconnecting, press **Load from band** to read its actual stored messages. The page verifies the responding owner and validates the returned list. If it differs from your browser list, or the message editor contains a draft, choose **Replace browser list** to import it or **Keep browser messages** to cancel. Cancelling preserves both the saved browser list and the unfinished draft; replacing also clears the draft.

Add, edit or delete messages in the browser, then press **Sync to Nayaka** or **Sync to Syifa** to save the selected wearer's list on their connected band. Local edits are saved separately for each wearer between visits; connecting, loading or editing does not automatically write presets to the band. Use manual **Sync** after making changes or reconnecting. Success is shown only after the correct band acknowledges saving the list in flash, so presets survive a restart. Delete every message and sync the empty list to clear the band's presets. The limit is eight messages of 40 printable ASCII characters; emoji are not supported by the firmware font.

For the two bands plugged into this laptop, run the USB bridge in another terminal:

```bash
# From the repository root. One-time Python setup:
python3 -m venv hardware/.venv
hardware/.venv/bin/python -m pip install -r hardware/requirements.txt

# Start each time you want the web page to access USB bands:
hardware/.venv/bin/python hardware/bridge.py
```

On `/phone`, choose **USB bridge** and keep `http://localhost:8787` as the bridge address. The bridge discovers the two ports and verifies the owner from firmware; it does not assign names by port order. Close the bridge before flashing or running the serial verification script.

For a supported phone, serve the web app over HTTPS, open `/phone` in Chrome on Android and choose **Direct Bluetooth**. Select your wearer, press **Connect**, and choose `PulseBand-Nayaka` or `PulseBand-Syifa`. The page checks the firmware identity before enabling sync. This mode uses Bluetooth to configure a band; messages between bands still use ESP-NOW. iPhone browsers do not support this Web Bluetooth flow. A laptop localhost page also supports Bluetooth when browser and OS permissions allow it. The existing Vercel configuration includes the `/phone` route fallback; edits must be deployed to your existing host before its public `/phone` URL changes.

## Real location and direction

These boards have an accelerometer/gyroscope, but **no GPS or magnetometer**. Each wearer must share their own phone's real location to their own band using `/phone`. Connect both phones separately, then use **Keep location updated** and leave the pages open. A position from a laptop represents that laptop, not a separately moving wearer.

The bands exchange coordinates and calculate approximate distance and bearing measured clockwise from north. The arrow is **north up**, not relative to the direction your wrist faces. Use a phone compass to orient yourself. The screen includes the combined position accuracy. Indoor GPS can be inaccurate; this is not indoor venue positioning. Positions expire after 60 seconds without an update, are not saved in flash, and are cleared by **Stop sharing location**. Location access requires HTTPS or localhost and permission from the browser. An HTTP page at a laptop's LAN address generally cannot obtain phone GPS. For mobile location use the HTTPS page and Direct Bluetooth.

Direction quality uses the sum of both phones' reported accuracy radii. Guidance is suppressed when that sum reaches the measured separation, when positions are within one metre, or when inputs or antipodal geometry make the direction ambiguous. A usable direction includes an angular uncertainty estimate: at nearby distances, 100 m separation with 20 m combined reported accuracy gives approximately **±11.5°**. This estimate uses spherical geometry and does not account for wrist orientation or independently verify the phones' locations. Browser accuracy represents a reported 95% position radius; combining the radii does not establish a calibrated 95% confidence interval for the bearing. See the [W3C Geolocation specification](https://www.w3.org/TR/geolocation/#latitude-longitude-and-accuracy-attributes). This quality check cannot provide guaranteed indoor or wrist-relative tracking.

Only the explicit development command `demo_location` accepts demonstration coordinates. That path labels the firmware screen/status **SIMULATED LOCATION**. Ordinary `/phone` location requests use actual browser Geolocation and reject `simulated:true`. Verification scripts clear demo positions after their checks.

## Build or reflash

Install the development tools in the same local Python environment:

```bash
hardware/.venv/bin/python -m pip install platformio==6.2.0 esptool==5.5.0
hardware/.venv/bin/python hardware/configure_pair.py
hardware/.venv/bin/pio run --project-dir hardware
hardware/.venv/bin/pio run --project-dir hardware -e nayaka -t upload
hardware/.venv/bin/pio run --project-dir hardware -e syifa -t upload
```

`configure_pair.py` creates the ignored `hardware/include/pairing_keys.h` once. Both bands must be built with the same file. Keep it locally; generating a different key requires reflashing both bands. These builds are tied to the verified device MAC addresses in `src/main.cpp`. Check the connected ports and MACs before reflashing replacement hardware. The default macOS ports in `platformio.ini` may need updating on another computer.

`partitions.csv` preserves the verified factory partition layout. The configuration pins TFT_eSPI and Arduino dependencies and explicitly selects FSPI to avoid the ESP32-S3 raw-register selection bug in TFT_eSPI 2.5.43. Upload speed is 115200 because faster baud rates were unreliable with this laptop's USB serial connection.

## Factory recovery

Before flashing, the complete address range that would be modified (`0x000000`–`0x30ffff`, including bootloader, partition table, NVS, OTA selection and primary application partition) was saved separately for each band in the ignored `hardware/backups/` directory. These are **3.06 MB recovery images, not full 16 MB flash dumps**. The higher application and filesystem regions are preserved by this firmware. Keep the backups locally; they may contain device settings.

Restore a band's own recovery image with the bridge closed:

```bash
hardware/.venv/bin/esptool --port /dev/cu.usbmodem5B910337701 --baud 115200 write-flash 0 hardware/backups/5B91033770-factory.bin
hardware/.venv/bin/esptool --port /dev/cu.usbmodem5B910342271 --baud 115200 write-flash 0 hardware/backups/5B91034227-factory.bin
```

## Validation and protocol

```bash
# From the repository root:
npm --prefix prototype test
npm --prefix prototype run build
hardware/.venv/bin/python -m unittest discover -s hardware/tests -v

# Close the USB bridge before the real USB/radio checks:
hardware/.venv/bin/python hardware/verify_pair.py --reset-for-persistence --test-expiry

# Install the additional Bluetooth verification dependency once:
hardware/.venv/bin/python -m pip install -r hardware/requirements-dev.txt
# With the USB bridge closed, capture and check the actual firmware screens:
hardware/.venv/bin/python hardware/verify_display.py
# Disconnect browser Bluetooth clients before testing both physical bands:
hardware/.venv/bin/python hardware/verify_bluetooth.py --legacy-signal
```

All 13 live USB/ESP-NOW checks passed on the two physical bands: owner identities, saved presets, persistence across an actual hardware reset, bidirectional messages, incoming pop-up and display-indicator state, dismissal, SOS confirmation/cancellation and explicitly simulated direction guidance. Direction checks covered usable bearings, coincident/overlapping fixes and expiry after 60 seconds while the radio connection remained active. The script restored the original presets and cleared its demonstration positions. The local report is [artifacts/verification.json](artifacts/verification.json).

All six live Bluetooth checks also passed with both bands connected concurrently. They verified the advertised names, GATT service and owner/MAC pairs; saved and read back eight presets per band, including 40-character text and escaped quotes/backslashes through 20-byte JSON fragments; and sent messages in both directions over the real ESP-NOW link. Receiving pop-up and display-indicator state, application delivery acknowledgements, dismissal, and the legacy code-1 **I'm Safe** notification passed. Original presets were restored and both locations cleared. The local report is [artifacts/bluetooth-verification.json](artifacts/bluetooth-verification.json). This script verifies the actual Bluetooth protocol using Bleak, independently of browser Web Bluetooth. It does not reset the bands; restart persistence is covered by the USB check above. Use `--scan-only` for discovery without connecting or writing. The USB bridge can remain running during Bluetooth verification.

The actual `/phone` page passed 12 browser checks against the running USB bridge and physical bands. Fresh owner-verified **Load from band**, explicit replacement, cancellation preserving the browser list and unsaved draft, add/edit/delete, reload persistence, wearer isolation and loading saved custom messages after reconnect all passed. Manual **Sync** produced a physical Nayaka acknowledgement and matching fresh readback; deleting all messages and syncing stored an empty list. Syifa's stored messages remained unchanged. There were no uncaught JavaScript exceptions or horizontal overflow at 390px and 1280px widths. Both bands' original presets and previous browser storage were restored. See the [USB browser report](artifacts/phone-ui-load-live.json), [acknowledged sync screenshot](artifacts/phone-ui-load-live.png) and [replacement confirmation](artifacts/phone-ui-load-confirmation.png).

A separate native Web Bluetooth browser run passed 13 checks in Chrome **122.0.6261.94 on macOS**, using the actual `/phone` page and physical Nayaka band. Trusted browser clicks opened the real device chooser, which discovered the physical PulseBand devices; the selected band verified its firmware identity. The same load/cancel/replace, CRUD, reload/reconnect and manual sync flow passed through Bluetooth, including syncing an empty list. Independent fresh USB readback confirmed Nayaka's stored messages and that Syifa was unchanged. All five connect clicks were trusted; no Bluetooth emulation, navigator mocks or OS permission bypass was used. The run restored both bands' original presets, disconnected Bluetooth and restored browser storage. See the [native browser report](artifacts/phone-ui-bluetooth-live.json), [Bluetooth sync screenshot](artifacts/phone-ui-bluetooth-live.png) and [replacement confirmation](artifacts/phone-ui-bluetooth-confirmation.png). This desktop browser run is distinct from the six-check Bleak protocol test above.

After adding per-instance request IDs to reject delayed replies from a previous page, a targeted native browser reconnect run passed six further checks: the updated bundle, owner-verified load, custom-message sync, actual page reload and reconnect, acknowledged sync after reconnect, and restoration through the UI. Fresh USB readback matched each physical Nayaka save, Syifa remained unchanged and browser storage was restored. See the [reconnect report](artifacts/phone-ui-bluetooth-reconnect-live.json). The mobile replacement dialog was also checked after its fade finished: the card and ancestors had opacity 1, both actions were enabled and inside the 390×844 viewport, and cancelling retained the draft and browser storage. See the [dialog review](artifacts/phone-ui-bluetooth-confirmation-review.json).

The native browser diagnostic recorded two caught JSON parse errors in the notification receiver from incomplete/leading fragments. The receiver discarded them before matching a pending request ID; every awaited correlated operation completed successfully and all independent physical readbacks matched. Raw notification headers were not retained, so the report cannot establish whether these fragments were unsolicited status events. There were no uncaught JavaScript exceptions. These caught diagnostics remain in the native browser report.

The firmware framebuffer was read back over USB in 24 atomic captures, covering both wearers, empty preset lists, 40-character menu/confirmation/pop-up text, delivery results, each SOS confirmation step, and unavailable/usable/uncertain direction screens. All 26 checks passed: each capture decoded to exactly 240×240 pixels, no bright pixels extended outside the round boundary, and both notification colours were visible. The notification indicators and footer fit the round screen, and long messages use a smaller font to fit above the dismiss prompt. See the [rendered watch screens](artifacts/display-review.png) and [display check](artifacts/display-verification.json). These captures show the pixels generated by the firmware. Native tests also passed for [distance/bearing geometry](tests/location_math_test.cpp) and [touch event sequences](tests/touch_press_test.cpp), including held contacts, separate taps and release reports. The touch handler counts one press until release, with explicit touch/change interrupts from the CST816S.

All 79 application tests, 24 bridge tests and the production web build passed. Bluetooth request IDs include a unique page-session identifier; a regression test confirms that a delayed acknowledgement from an older page cannot confirm a new page's preset write.

Touch-controller detection and serial-injected taps were verified; the latter exercise firmware button-coordinate mapping. Physical finger touch and visual inspection of the actual LCD have not been tested here. Pop-up and indicator checks above verify firmware state and framebuffer pixels. Direction tests used labelled demonstration coordinates; real GPS sharing from a physical phone, indoor positioning and wearer-relative guidance have not been tested. The native browser Bluetooth run used desktop Chrome on macOS, not an Android or iPhone browser. Reports and screenshots are in the ignored `hardware/artifacts/` directory and stay local.

USB and Bluetooth configuration exchange newline-delimited JSON requests `{id, cmd, ...}` and responses `{type:"response", id, ok, owner, ...}`. Commands include `hello`, `status`, `presets`, `location`, `clear_location`, `send` and `control`. Status events are emitted every two seconds. The local HTTP bridge exposes `/api/bands`, `/api/bands/{owner}`, and POST endpoints for status, presets, location, send, control and clear-location. **Load from band** uses a fresh correlated status request: `POST /api/bands/{owner}/status` with `{}` over USB, or the `status` RPC over Bluetooth. GET status endpoints are cached connection snapshots. The bridge listens on loopback by default; see `bridge.py --help` for optional LAN binding and allowed origins.

The original BLE service `b97b0001-7a62-4f1a-9b9c-0b13e9de3500` and one-byte signal characteristic `b97b0002-7a62-4f1a-9b9c-0b13e9de3500` remain supported. `/phone` uses the write/notify configuration characteristic `b97b0003-7a62-4f1a-9b9c-0b13e9de3500`, with JSON fragmented into 20-byte writes/notifications. Sending a legacy byte still reports only GATT acceptance in the existing web panel; actual band delivery is acknowledged by ESP-NOW on the physical watch.
