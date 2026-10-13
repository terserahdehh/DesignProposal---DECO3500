# Syifa's laptop: USB + Vercel

Keep Syifa's band plugged into Syifa's laptop, and Nayaka's band plugged into Nayaka's laptop. Each laptop needs its own USB bridge and its own visible Chrome Vercel page. Vercel hosts the page, not the serial connection or a central location relay: the paired bands exchange locations over ESP-NOW. No Expo/localhost website is needed.

On each laptop, start `hardware/bridge.py --allow-origin https://pulseband-steel.vercel.app` using that laptop's Python environment. Open https://pulseband-steel.vercel.app/phone, choose the matching wearer, select USB bridge, and use `http://localhost:8787`. Allow local-network and location permissions if Chrome asks. Press **Keep location updated**, keep the tab visible, and prevent laptop sleep. Check that the page says the band acknowledged a new fix and that both wearer locations are fresh. On each watch, press OK to open the menu, select Find Direction, then press OK.

The large centered arrow and 90-degree yellow/purple ring follow changed, usable location readings. Yellow finds Syifa; purple finds Nayaka. The ring brightens as calculated separation decreases. The top of the screen is north, not the direction the wrist faces. Moving just the ESP32 on its cable cannot update the laptop's position. A laptop's browser location cannot reliably measure centimetre movement; USB, pulling GitHub and redeploying Vercel do not improve that precision. Overlapping, identical, missing or expired readings cannot provide a reliable arrow. An uncertain computed separation is not a measured physical distance.

For messages, connect and **Load from band** before editing so existing watch messages are preserved. Add/Edit/Delete, then **Sync to Syifa** and wait for acknowledgement. Select the saved message on the watch and press OK twice to confirm sending. Message changes do not need a deployment.

## Paste into GPT on Syifa's laptop

```text
Set up Syifa's already-flashed PulseBand on this laptop using USB and Vercel.
Repository: https://github.com/terserahdehh/DesignProposal---DECO3500.git

Inspect git status first. Preserve local edits. If main is clean, pull with
git pull --ff-only origin main; otherwise explain what prevents a safe pull.
If missing, clone into a new folder. Read hardware/CONNECT_SYIFA.md,
hardware/README.md and hardware/LOCATION_TROUBLESHOOTING.md.

Do not start Expo or a localhost website. Check existing serial clients and
bridge processes before starting another. Use/create an OS-appropriate Python
venv with hardware/requirements.txt, then run hardware/bridge.py with
--allow-origin https://pulseband-steel.vercel.app. Confirm the plugged-in band
identifies as Syifa, MAC 8C:FD:49:9B:EE:84. Do not connect the wrong owner.

Open https://pulseband-steel.vercel.app/phone in regular Chrome, reload,
select Syifa and USB bridge, address http://localhost:8787. Keep just one
connected tab for Syifa. Allow Chrome local-network and location access and
OS location permission. Press Keep location updated, leave the page visible
and the laptop awake. Nayaka's laptop must separately share to Nayaka's band.
Read fresh firmware status: peerConnected, location.valid, peerLocation.valid,
timestamps, actual accuracy and guidance.usable. If Syifa expires, Retry fresh
location and inspect the real browser error rather than replaying an old fix.

Open Find Direction on the watch. Check its centered purple arrow/quarter-ring
only when both real fixes support a bearing. The location source is this laptop,
not the USB watch; centimetre movement is not measurable with this setup.
Never invent coordinates/timestamps, lower reported accuracy, force 0 metres,
or present an uncertain direction as accurate. Report limitations honestly.

Do not reflash, regenerate pairing keys, overwrite saved presets, reset edits,
or push/deploy extra changes. Load from band before any requested message edits.
Report the Vercel URL, actual owner/MAC, bridge status, both fix ages/accuracies,
peer connection and whether a real direction is currently usable.
```
