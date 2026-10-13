# Connect the other laptop directly to Vercel

For the two-laptop, cable-connected demo, use [Syifa's USB + Vercel setup and GPT prompt](CONNECT_SYIFA.md). Each laptop shares its own device location; a cable does not add centimetre-scale tracking.

The website is https://pulseband-steel.vercel.app/phone. Direct Bluetooth needs no local Expo server or Python bridge. Use one connected PulseBand tab per band in a supported Chrome browser. After a deployment, reload the actual connected tab, select its wearer again and reconnect: an already-open tab keeps running its previous JavaScript. Vercel updates the web app, not the ESP32 firmware.

Select Nayaka on the laptop used by Nayaka, Syifa on the laptop used by Syifa, and connect the matching PulseBand. Press Keep location updated and allow location access in Chrome and the OS. Leave the page visible and the device awake. The larger arrow is centered in the physical watch's display panel and web direction preview. It appears only when both locations are fresh, the peer is connected and the location accuracy supports a bearing. Laptops may time out or produce overlapping fixes; each wearer's own phone outdoors is a better source for moving-person direction. The watch is north-up, not wrist-relative.

## Paste into GPT on the next laptop

```text
Update my PulseBand repository:
https://github.com/terserahdehh/DesignProposal---DECO3500.git

Inspect git status first and preserve local edits. On a clean main branch,
run git pull --ff-only origin main. If the repo is missing, clone it into a
new folder; if updating is blocked by edits or divergence, explain the safe
next step rather than resetting or overwriting anything. Show the latest commit.
Read hardware/NEXT_LAPTOP.md and hardware/LOCATION_TROUBLESHOOTING.md.

Open https://pulseband-steel.vercel.app/phone directly in regular Chrome.
Do not start localhost/Expo or install npm dependencies just to use Vercel.
Reload the page, select my wearer and Direct Bluetooth, and connect the matching
PulseBand. Use one connected tab per band. Check the verified firmware identity.
Start Keep location updated; guide me through Chrome and OS location permissions.
Read the actual acknowledged fix age/accuracy and the paired wearer's location.
Confirm a usable direction only if both actual fixes are fresh and guidance is
usable. If fixes overlap, time out or expire, report that accurately; don't
invent coordinates, lower reported accuracy or bypass the direction safeguard.

If I specifically want USB instead of Bluetooth, start a Python bridge on this
laptop with --allow-origin https://pulseband-steel.vercel.app and select USB
bridge at http://localhost:8787. Use hardware/requirements.txt and OS-appropriate
venv paths. Vercel still needs no local web server. Check existing ports/processes
before starting duplicates.

Do not reflash the already-updated watches, regenerate pairing keys, overwrite
my saved messages, or push/deploy extra changes without asking. Report the Vercel
URL, connected wearer, real fix freshness/accuracy, peer status and direction result.
```
