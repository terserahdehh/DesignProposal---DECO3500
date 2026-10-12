# Use your PulseBands

**Phone + Vercel:** Open https://pulseband-steel.vercel.app/phone in Chrome on Android. Choose Nayaka or Syifa, select Direct Bluetooth, and connect that person's matching PulseBand. Allow Bluetooth and location access. Each wearer uses their own phone and band; ordinary iPhone browsers do not support this Direct Bluetooth flow.

**Add or change a popup message:** Connect, press Load from band, and confirm Replace browser list if asked. Type a message and press Add message, or use Edit/Delete. Press Sync to Nayaka/Syifa and wait for the band's acknowledgement. You can save eight messages with 40 printable characters each; use ordinary letters/punctuation rather than emoji. Saving a message in the browser alone does not update the watch. Preset changes need no GitHub push, reflash or Vercel redeployment.

**Send and dismiss:** On the watch, tap OK to open its menu. Use < or > to select a message, tap OK to select it, then OK again to send. The other watch opens a popup and lights the sender's colour; the connected `/phone` page also shows the incoming text. Tap the receiving watch to dismiss. Hide on this page hides only the browser popup. SOS uses the red triangle followed by three separate OK presses; < or > cancels.

**Find Direction:** On each wearer's own phone, connect their own band and press Keep location updated. Keep both pages open. On the watch, open Find Direction. The quarter-circle outline points toward the other person's shared location: yellow for Syifa, purple for Nayaka. It moves as fresh positions change and gets brighter when closer. The top of the watch represents north; use a phone compass to orient yourself. The bands have no GPS or magnetometer. Poor/overlapping GPS fixes, an offline peer or expired locations suppress the arc; one laptop cannot supply two independent wearer positions.

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
