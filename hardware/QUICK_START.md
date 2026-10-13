# Use your PulseBands

For a ready-to-paste GPT prompt on the other laptop, see [connect directly to Vercel](NEXT_LAPTOP.md).

For your cable-connected demo with Syifa on the other laptop, see [Syifa's USB + Vercel instructions and prompt](CONNECT_SYIFA.md). Run one bridge per laptop and choose different matching owners. Moving the USB watch alone does not move the laptop's reported location, and laptop location cannot reliably track centimetres.

**Phone + Vercel:** Open https://pulseband-steel.vercel.app/phone in Chrome on Android. Choose Nayaka or Syifa, select Direct Bluetooth, and connect that person's matching PulseBand. Allow Bluetooth and location access. Each wearer uses their own phone and band; ordinary iPhone browsers do not support this Direct Bluetooth flow.

**Add or change a popup message:** Connect, press Load from band, and confirm Replace browser list if asked. Type a message and press Add message, or use Edit/Delete. Press Sync to Nayaka/Syifa and wait for the band's acknowledgement. You can save eight messages with 40 printable characters each; use ordinary letters/punctuation rather than emoji. Saving a message in the browser alone does not update the watch. Preset changes need no GitHub push, reflash or Vercel redeployment.

**Send and dismiss:** On the watch, tap OK to open its menu. Use < or > to select a message, tap OK to select it, then OK again to send. The other watch opens a popup and lights the sender's colour; the connected `/phone` page also shows the incoming text. Tap the receiving watch to dismiss. Hide on this page hides only the browser popup. SOS uses the red triangle followed by three separate OK presses; < or > cancels.

**Find Direction:** On the watch, tap OK, then OK again on Find Direction. The bands measure their distance to each other by Wi-Fi timing, with no phone needed: the screen shows it (for example `0.4 m +/-0.15 m Wi-Fi timing`) with a full coloured ring that pulses faster and glows brighter as you get closer. Yellow finds Syifa; purple finds Nayaka. This works within a few centimetres when the bands nearly touch, but can be about 1 m wrong across a desk, and it cannot tell *which way*. To get an arrow, walk a few metres and then turn while your friend stays still: the band shows **WALK ESTIMATE ±N°** with a quarter light pointing relative to the top of your band. `<` / `>` show a **DEMO - NOT MEASURED** arrow you set yourself. With fresh phone GPS on both bands (outdoors, tens of metres apart) the arrow is north-up instead. Turn on **Play laptop beep preview** in `/phone` to hear the pulse timing; the bands have no speaker. An offline peer, failed ranging or unusable fixes switch the light and pulses off within about two seconds.

**Location not working on two Chrome laptops:** Bluetooth permission and location permission are separate. Reload the Vercel page on both laptops, select different matching owners/bands, allow Location in Chrome site settings and enable OS location access for Chrome. Press Keep location updated on each. The page shows fix age/accuracy and which wearer is missing a fix, requests fresh fixes every 20 seconds even while stationary, and offers Retry fresh location. Laptops use the standard provider first; phones request high accuracy with standard-provider fallback. Keep both tabs visible and devices awake. Two laptop locations may be too coarse or identical for a safe direction; each wearer's own Android phone outdoors is a better location source. Starting a local web server cannot add GPS accuracy. See [location troubleshooting and the other-GPT setup prompt](LOCATION_TROUBLESHOOTING.md).

**Laptop + Vercel:** Plug both bands into USB. From the repository root, start the bridge below, open https://pulseband-steel.vercel.app/phone, select USB bridge, and set the bridge address to http://localhost:8787. Allow local network access if Chrome asks. Choose the wearer, then load/edit/sync as above. A laptop can also use Direct Bluetooth to one band at a time in a supported browser.

```bash
hardware/.venv/bin/python hardware/bridge.py --allow-origin https://pulseband-steel.vercel.app
```

**Laptop + localhost:** Keep that bridge running and start the web app in another terminal. Open http://localhost:8081/phone, select USB bridge and use http://localhost:8787. The same wearer/message steps apply. Phone localhost means the phone itself; use the Vercel page and Direct Bluetooth for mobile location sharing.

```bash
npm --prefix prototype run web
```

**Reconnecting:** If a band drops out, reconnect its cable or Bluetooth and press Refresh/Connect. Load from band again before editing on a new browser. The watch keeps synced messages after disconnecting or restarting. Stop sharing location clears the shared fix; otherwise it expires after 60 seconds. Close USB bridge/serial monitor processes before flashing or running hardware verification scripts. Only source-code changes need a rebuild/redeploy.

**Firmware recovery:** The pre-arc firmware images and preset lists are stored locally in `hardware/backups/2026-10-12-*-before-arc.*`. The new shared pairing key is in the ignored `hardware/include/pairing_keys.h`; keep it to rebuild either watch. Both watches must use the same key. Restore a watch only from its own backup, and restore both older images together to recover the previous shared key.
