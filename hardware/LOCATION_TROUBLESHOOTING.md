# Location on Chrome / Vercel

On each device open https://pulseband-steel.vercel.app/phone and reload after deployment. Select that wearer's name, choose Direct Bluetooth, and connect their matching band. Connecting Bluetooth does not automatically share a location. Press Keep location updated and allow the separate location prompt. Chrome site settings and OS location/privacy settings must both permit location. Keep each page visible and each device awake.

If precise acquisition fails, the app tries the standard location provider with its actual reported accuracy. It never fabricates a fresh timestamp or reduces the accuracy radius. Automatic mode requests a new position every 20 seconds while stationary as well as watching movement, and requests again on returning to the page. A failed/slow acquisition cannot guarantee a fix within the band's 60-second expiry. Permission denial stops updates so the permission can be corrected and sharing restarted; other provider errors are retryable.

The location card shows coordinates, reported accuracy and age of the acknowledged device fix. The live band card separately identifies an offline peer, which wearer needs a fresh location, or overlapping/ambiguous positions. If both laptop fixes are almost identical or their reported accuracy radii overlap, no direction is shown intentionally. Running localhost instead of Vercel does not give a laptop GPS. Use two independently carried Android phones outdoors for moving-person guidance. Browser/OS accuracy, permission and background suspension are outside the app's control.

Direct Bluetooth does not need a Python bridge or local development server. Vercel already serves the fixed app; both browsers need to reload. USB access from Vercel needs a bridge on each laptop with its own band attached, listening on that laptop's localhost:8787 and allowing the exact Vercel origin.

## Prompt for GPT on the other laptop

```text
Update and start my PulseBand app from https://github.com/terserahdehh/DesignProposal---DECO3500.git.
Inspect git status first and preserve local edits; do not reset or overwrite them. On a clean main branch, run git pull --ff-only origin main; otherwise explain the safe update needed. Read hardware/QUICK_START.md and hardware/LOCATION_TROUBLESHOOTING.md.
The Vercel app is already deployed at https://pulseband-steel.vercel.app/phone. For Direct Bluetooth, no local server/bridge is needed: help me reload that page, select my wearer and matching PulseBand, allow Chrome and OS location permissions, and press Keep location updated. Show the exact error, acknowledged fix age/accuracy, peer connection, and which wearer's location is missing. Do not fake coordinates/timestamps or bypass accuracy safeguards. Laptop fixes may be coarse or identical; recommend two Android phones outdoors if no safe direction is possible.
If I want localhost, install with npm --prefix prototype ci and start npm --prefix prototype run web -- --port 8081. Open http://localhost:8081/phone. If I want USB, reuse/create hardware/.venv, install hardware/requirements.txt, and start that environment's Python running hardware/bridge.py --allow-origin https://pulseband-steel.vercel.app. Select USB bridge with http://localhost:8787; allow Chrome local-network access if prompted. Use OS-appropriate Python/venv paths. Check existing processes/ports before starting duplicates.
Do not reflash firmware, regenerate pairing keys, overwrite my messages, disconnect my active Bluetooth session, or claim successful real GPS tracking without observing both actual device locations. Report the app URL and live results.
```

## Validation on 13 October 2026 (Brisbane)

The fix passed 104 Node tests, 11 browser UI protocol-double tests against the production export, 25 Python bridge tests, and a successful web export. New tests cover genuinely fresh stationary requests past 60 seconds, high-accuracy fallback preserving coarse accuracy, actionable permission denial/retry, latest-fix queuing, tab-resume requests, and ignoring late callbacks after stop/disconnect. Browser doubles do not validate the other laptop's actual location provider or physical Bluetooth.

A read-only fresh USB status request confirmed Syifa's radio and paired peer were connected but neither wearer had a valid location at the time of inspection. Syifa's Bluetooth was not connected to this laptop then. No firmware, presets, pairing key or coordinates were modified by that check; no real remote-laptop GPS success is claimed.

The acquisition behavior follows [getCurrentPosition options](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) and [watchPosition change callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
