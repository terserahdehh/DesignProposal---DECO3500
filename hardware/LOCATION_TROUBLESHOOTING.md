# Location on Chrome / Vercel

On each device open https://pulseband-steel.vercel.app/phone and reload after deployment. Select that wearer's name, choose Direct Bluetooth, and connect their matching band. Connecting Bluetooth does not automatically share a location. Press Keep location updated and allow the separate location prompt. Chrome site settings and OS location/privacy settings must both permit location. Keep each page visible and each device awake.

Chrome laptops now use the standard location provider first to avoid repeated precise-provider timeouts. Phones request high accuracy and fall back to the standard provider if it fails. The actual reported accuracy is preserved: the app never fabricates a fresh timestamp or reduces the accuracy radius. Automatic mode requests a new position every 20 seconds while stationary as well as watching movement, and requests again on returning to the page. A failed/slow acquisition cannot guarantee a fix within the band's 60-second expiry. Permission denial stops updates so the permission can be corrected and sharing restarted; other provider errors are retryable.

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

The production deployment `dpl_8Jbqgw9195QwNawkBBRGdS2YYBgN` reached READY and https://pulseband-steel.vercel.app was assigned to it. Both `/phone` and `/phone/` returned HTTP 200. Three new location browser tests also passed on this actual public URL, using Bluetooth/location doubles (no physical-band writes). Repeat these safe deployed-page checks from `prototype/` with:

```bash
PULSEBAND_UI_BASE_URL=https://pulseband-steel.vercel.app npx playwright test --grep 'stationary laptop|laptop standard-provider|phone mode|stopping sharing'
```

A read-only fresh USB status request confirmed Syifa's radio and paired peer were connected but neither wearer had a valid location at the time of inspection. Syifa's Bluetooth was not connected to this laptop then. No firmware, presets, pairing key or coordinates were modified by that check; no real remote-laptop GPS success is claimed.

The acquisition behavior follows [getCurrentPosition options](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) and [watchPosition change callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).

### Follow-up on the actual user Chrome session

Screen inspection found existing Vercel tabs still running the older app (the location heading said "phone", not "device"). At the user's request localhost:8081 was stopped. The connected Vercel tab was reloaded, Syifa selected, its paired Bluetooth device reconnected and continuous location requested through visible browser controls. Chrome's existing JavaScript-from-Apple-Events restriction was left unchanged; no OS privacy settings, pairing keys or presets were changed.

Real, non-simulated browser locations reached Syifa over Bluetooth, and Nayaka's locations arrived over ESP-NOW. In one simultaneous fresh sample, local accuracy was 40 m, peer accuracy about 16 m and approximate separation 12 m. Another showed separation about 24 m with combined accuracy about 53 m. Guidance was correctly marked unusable because the accuracy ranges overlapped. This confirms actual location transport, not reliable indoor direction.

The initial high-accuracy-first laptop test also exposed provider timeouts and a temporary expiry despite a healthy Bluetooth connection. The laptop standard-provider-first change has regression coverage: 106 Node tests and 12 production-export UI protocol-double tests passed. Phone high-accuracy preference/fallback and preservation of coarse accuracy are tested separately. The application cannot guarantee fresh device fixes or a direction when OS/browser location is unavailable or uncertain.

The standard-provider build (`86e3b43`, bundle `AppEntry-c4ce7e1fd878218ff2428b7160e93078.js`) was deployed as READY `dpl_DvpptEKDBHCYZabkvQQZBDNAKYRn` and assigned to https://pulseband-steel.vercel.app. All four selected deployed-page browser tests passed. The user's actual tab was reloaded into this build and visibly showed Laptop mode before reconnecting Syifa and starting automatic sharing again. No localhost web server was restarted.

After this deployment, the actual Chrome session again delivered a non-simulated 40 m-accuracy fix to Syifa over Bluetooth. When both fixes were fresh, separation was about 23 m versus about 54 m combined reported accuracy, correctly suppressing the bearing. A subsequent 70-second observation still saw provider timeouts and temporary expiry; reliable continuous laptop positioning is **not** claimed. A read-only System Settings inspection showed global Location Services and Google Chrome location access already enabled. Neither toggle was changed. Chrome was returned to the connected Vercel tab with automatic sharing enabled. Testing accurate direction still requires more accurate, sufficiently separated location sources, ideally independently carried phones outdoors.
