# PulseBand

PulseBand is a context-aware smart concert wristband prototype for **DECO3500 — Social & Mobile Computing**. The experience is designed to happen inside a wearable display, helping concertgoers stay connected to music, friends, accessibility features, and venue support without repeatedly checking a phone.

The current prototype uses a code-built circular PulseBand body with a small rectangular display and four physical-style controls: Back, Next, OK and a red triangular SOS button below the display. Four colour indicators around the body represent group awareness. The supplied `watch.png` is retained as an earlier concept asset but is not used by the application.

## Vercel deployment and access for friends

The shared production website is https://pulseband-steel.vercel.app; physical-band setup is https://pulseband-steel.vercel.app/phone. The existing Vercel project is **`pulseband`**, under **`andhikanayakaaws-projects`**. Its [project dashboard](https://vercel.com/andhikanayakaaws-projects/pulseband) requires an authorized Vercel account. Deploy the **`prototype/`** directory, not the repository root: `npm run build` exports the website to `dist`, using `prototype/vercel.json` for the `/phone` routes.

### First give each friend permission

An earlier check on 13 October 2026 found a **Hobby** team with no Git repository linked for automatic deployments. Recheck the existing project's Git integration before relying on a push: automatic deployment requires that integration and the correct production branch. Verify the resulting deployment and public bundle after pushing. The README, public website URL and project name are not deployment credentials.

To let friends redeploy this **same** project using their own accounts, the owner must approve a **Pro** upgrade, then open team **Settings → Members**, invite each friend's Vercel account email and assign the least-privileged available role that permits production deployment. Friends must accept the invitation and sign in with their own accounts. Read-only/Viewer access is insufficient. GitHub repository access is separate: grant it to friends who need to pull or push this repository, and connect their own Git provider in Vercel if commit-author checks require it. Never impersonate the owner's Git author identity.

Invitations are supported on Pro/Enterprise, not Hobby. Do not upgrade, transfer ownership or incur paid seats without the owner's explicit approval. Until permissions are granted, friends can use the existing website without deployment access; they cannot redeploy this shared project. With repository access, a friend can separately deploy a copy under their own Vercel account, but that is a different project/URL and must not replace this shared URL without agreement. See [Vercel team invitations](https://vercel.com/docs/rbac/managing-team-members) and [deployment-access troubleshooting](https://vercel.com/docs/deployments/troubleshoot-project-collaboration).

Do **not** put passwords, Vercel tokens or Deploy Hook URLs in this README, commits or shared prompts. Do not copy the owner's login/session to another laptop. A Deploy Hook URL itself grants deployment capability; this project is not currently Git-linked, so hooks are not configured. Any future hook must be kept private and requires deliberate setup, not a public "anyone can deploy" link.

### Redeploy from an authorized friend's laptop

Inspect `git status` first and preserve edits. On a clean `main` branch, pull without overwriting divergent work:

```bash
git pull --ff-only origin main
cd prototype
npm ci
npm test
npm run test:ui
npm run build
```

The browser tests require installed Google Chrome. Resolve failures before production deployment. Run the following **from `prototype/`**, after accepting the team invitation. Sign in personally; no shared token is needed:

```bash
npx vercel login
npx vercel whoami
npx vercel link --yes --team andhikanayakaaws-projects --project pulseband
npx vercel project inspect pulseband --scope andhikanayakaaws-projects
npx vercel deploy --prod --scope andhikanayakaaws-projects
```

Confirm the link selects the **existing** `pulseband` project in the stated team. If access is denied or Vercel offers to create another project, stop and ask the owner to fix permissions. Do not work around authorization by removing Git metadata, sharing credentials or changing the commit author. Keep the generated `.vercel/` directory ignored.

After deployment, inspect the URL printed by the CLI with `npx vercel inspect <deployment-url> --scope andhikanayakaaws-projects`. Wait for **Ready**, confirm the shared `pulseband-steel.vercel.app` alias points to that deployment, and check both `/` and `/phone` load successfully. If the alias needs repair, an authorized collaborator can use `npx vercel alias set <deployment-url> pulseband-steel.vercel.app --scope andhikanayakaaws-projects` after confirming the intended deployment is Ready. Reload connected Vercel tabs and reconnect/share location again; an existing tab may still run old JavaScript. Website deployment does not flash ESP32 firmware or change saved messages.

### Prompt for GPT on another device

```text
Help me update and redeploy the shared PulseBand Vercel website.
Repository: https://github.com/terserahdehh/DesignProposal---DECO3500.git
Production: https://pulseband-steel.vercel.app/phone
Existing Vercel team: andhikanayakaaws-projects
Existing project: pulseband

Inspect git status and preserve local edits. Clone into a new folder if missing;
otherwise pull main with --ff-only only when safe. Read the README section
"Vercel deployment and access for friends". Confirm my own Vercel account has
accepted a team invitation and has production deployment permission. If it does
not, stop and explain the access needed; do not create a replacement project,
upgrade a plan, use the owner's credentials or bypass Git-author checks.

From prototype/, install locked dependencies with npm ci, run npm test,
npm run test:ui and npm run build. Resolve failures before deploying.
Log in with my own account, link only the existing pulseband project under
andhikanayakaaws-projects, inspect the link, and deploy --prod to that scope.
Wait for Ready, verify the shared alias and both / and /phone routes. Report
the source commit, tests, deployment URL and production URL. Never publish
tokens, hook URLs or local .vercel files. Do not reflash watches, regenerate
pairing keys or overwrite saved band messages. For Syifa's USB setup, follow
hardware/CONNECT_SYIFA.md; Vercel needs no local Expo web server.
```

## Physical ESP32 bands and phone setup

The `/phone` quick-message editor now offers **Add text** and **Add image**, with image selection, black-and-white preview, caption editing, picture replacement and deletion. The currently installed watches remain text-only: image presets stay in the browser, while an explicitly labelled **Sync text only** action keeps normal text transfer working. Watch firmware and the separate tracking branch are not changed. See [the quick-start guide](hardware/QUICK_START.md) for steps and limits.

Use [the deployed physical-band setup page](https://pulseband-steel.vercel.app/phone) for actual ESP32 presets, incoming messages and phone location. Vercel HTTPS supports the same Direct Bluetooth workflow as localhost in compatible browsers. Hosted pages initially select Direct Bluetooth; select USB bridge explicitly when using the local companion service. The live band card displays the paired band's connection and approximate north-referenced guidance, and incoming custom messages open a browser popup. Hiding the browser popup leaves the watch popup available to dismiss on the watch.

The physical firmware pairs only **Nayaka and Syifa** using their configured MAC addresses and shared key. Connecting an additional ESP32 or opening another laptop page does not add it to this pair. The bands communicate directly over ESP-NOW even without a laptop. Direction needs two separately located sources: both bands receiving one laptop's coordinates cannot locate two moving wearers. See the [October 12 code and verification report](hardware/AUDIT-2026-10-12.md) for feature status, hosting setup and remaining physical checks.

The physical-band direction preview uses a large centered arrow and matching quarter light only when both actual fixes support guidance. It shows each wearer's fix age and accuracy, including missing or expired data. The verified 240×240 boards have no GPS, magnetometer or ranging hardware: the observed ±14–40 m laptop fixes cannot track half-metre or one-metre band movement. See [real location and direction](hardware/README.md#real-location-and-direction) for the limits and firmware update distinction, and [USB bridge setup](hardware/BRIDGE.md) for connecting both attached bands and reading their current screen pixels without changing saved messages.

The repository now includes firmware for the two verified **Waveshare ESP32-S3-Touch-LCD-1.28** boards. USB serial `5B91033770` is Nayaka; `5B91034227` is Syifa. Their LCDs show only the white watch frame, touch buttons, message screen, notification indicators and SOS control. Direct ESP-NOW carries messages between the bands; incoming messages appear as dismissible pop-ups with the sender's colour. Presets are stored in flash.

Open **`/phone`** and connect the selected wearer's band through the local USB bridge or Direct Bluetooth. **Load from band** reads its saved messages into a new or reconnected browser, asking before replacing a different local list or unfinished draft. Add, edit or delete messages locally, then use manual **Sync** to save them on the band with a hardware acknowledgement. This page can share each wearer's real phone location to their own band. The hardware has no GPS or magnetometer: guidance is an approximate, north-referenced bearing and distance from shared phone coordinates, with stale fixes rejected. Direction uses both reported accuracy radii and includes an angular uncertainty estimate; overlapping or near-coincident fixes suppress guidance. This cannot guarantee indoor positioning or wrist-relative direction. Notification lights are displayed on the LCD. See [hardware setup, use and validation](hardware/README.md) for supported browsers, startup commands, recovery backups and hardware limitations. The original `/` prototype below retains its separate simulation and browser messaging panels.

## Run the prototype

```bash
cd prototype
npm install
npx expo start --web
```

First choose **Nayaka, Amy, Nala, or Syifa**. The identity is stored in this browser's local storage and survives refresh. **Switch user** returns to selection and disconnects hardware. Each phone can choose a different identity; this is not authentication or a globally reserved name. Self is excluded from friend selection and simulated recipients. Storage restrictions may require selecting again after refresh.

The existing band, friend lights, Back/Next/OK controls, quick signals and SOS simulation remain available without Bluetooth. Prototype controls still drive only the simulation.

## Laptop-to-laptop connection on Vercel

Use **Browser connection · Network** for real messages between two browser laptops. The large **YOUR VISIBLE DEVICE NAME** card has a **Rename device** button; names persist for each identity on this browser and propagate to the connected peer.

1. On Nayaka's laptop, choose Nayaka, rename it if desired, then press **Create invitation**. Copy the entire code and share it privately with Nala using your usual messaging app.
2. On Nala's laptop, choose Nala, paste Nayaka's invitation and press **Accept invitation & create reply**. Copy the generated reply and send it back.
3. On Nayaka's laptop, paste Nala's reply and press **Finish connecting**. Wait for both pages to show **CONNECTED** with the other device's name.
4. Use the signal buttons in that panel. The other browser updates its screen; **received** means its application acknowledged the signal, not that the wearer read it. SOS requires three confirmation presses after selecting Send SOS.

This is a real encrypted WebRTC data channel over the network, **not Bluetooth**. It needs no camera/microphone permission or signalling backend; the two codes manually carry the SDP/ICE negotiation. One browser peer is supported at a time; switching identity, refreshing or disconnecting requires new codes. Pairing codes contain connection metadata and self-selected names, so share only with your intended peer; identities are not authenticated. No signal history or codes are stored. Acknowledgement timeout reports delivery as unconfirmed.

A public Google STUN server is used for network address discovery. There is no TURN relay configured: restrictive NAT, university Wi-Fi/client isolation, VPNs or firewalls can prevent the connection. Try the same permissive Wi-Fi or a hotspot; this is not guaranteed to connect on every network. A production service would need a signalling backend, authenticated membership and TURN credentials. These must not be hard-coded into a static bundle. See [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections) and [data channels](https://webrtc.org/getting-started/data-channels).

## Real Web Bluetooth

Use **Physical band · Bluetooth**, then **Find PulseBand device** to open the permission/device chooser. The default scan matches a `PulseBand` name prefix OR the PulseBand service, reducing unknown-device clutter. **Scan all BLE devices** is an explicit fallback for other discoverable BLE peripherals. Nothing connects automatically. HTTPS (or localhost) is required. Select the physical band's owner using the manual local label; its connection status appears on that friend's selection screen. One physical peripheral can be connected at a time. Changing the owner label disconnects it.

After selecting a device, its large **BLE DEVICE NICKNAME** card offers **Rename device**. This nickname is stored locally against the browser's Bluetooth device ID; the original advertised name remains visible underneath. It does **not** rename the device in Chrome's chooser or on another laptop. `BluetoothDevice.name` is [read-only](https://developer.mozilla.org/en-US/docs/Web/API/BluetoothDevice/name). The included firmware advertises **PulseBand-Nayaka** and **PulseBand-Syifa** in the chooser. The website nickname remains local; it does not change the firmware advertising name.

The separate hardware panel connects a compatible BLE GATT peripheral, subscribes to notifications, sends compact signal codes, and handles permission rejection, cancellation, connection failure and disconnection. Received notifications update that panel. A successful write means the peripheral accepted a GATT write, not that a friend received or read it. Hardware SOS has its own three-confirmation flow and is not an emergency service. Simulator controls never write to hardware; hardware notifications never become simulated messages. The included firmware forwards these codes to the paired physical band; its LCD reports the band-to-band acknowledgement. The `/phone` page uses a separate acknowledged JSON configuration characteristic for saved messages and phone coordinates.

### Legacy peripheral contract

The included [ESP32 firmware](hardware/src/main.cpp) advertises service `b97b0001-7a62-4f1a-9b9c-0b13e9de3500`, exposing characteristic `b97b0002-7a62-4f1a-9b9c-0b13e9de3500` with **write with response** and **notify** properties. This legacy characteristic uses exactly one unsigned byte in both directions. `/phone` additionally uses characteristic `b97b0003-7a62-4f1a-9b9c-0b13e9de3500` for owner-verified, acknowledged JSON configuration:

| Code | Signal |
| --- | --- |
| 1 | I'm Safe |
| 2 | Toilet |
| 3 | Taking a Break |
| 4 | Going Home |
| 5 | Meet Me |
| 6 | SOS |

Both scan modes request the PulseBand service in `optionalServices`. The all-devices fallback uses `acceptAllDevices`, and can find peripherals exposing the service without advertising its UUID or a PulseBand name. Bluetooth Classic-only devices and browser pages still cannot appear. A BLE connection without the required PulseBand service/properties is reported as connected but incompatible, with signal controls unavailable. No writes are made to unrelated services. Firmware must process writes and emit notifications; it must implement any forwarding to another band itself. Malformed or unknown notification codes are ignored. No sender identity or recipient address is embedded in this single-peripheral protocol.

### Browser and phone limitations

Web Bluetooth is a **GATT client/central** API. Browser pages cannot advertise as BLE peripherals or host GATT servers, so four phones opening this site cannot exchange BLE messages with each other. The separate Browser connection panel supplies WebRTC network messaging with manual pairing. BLE browser-to-browser transport would require native software/peripheral hardware implementing advertising and routing; Vercel HTTPS alone cannot provide that.

Use a supported Chromium browser such as Chrome on Android, macOS, Windows or ChromeOS; hardware, OS permissions and browser policy also matter. Safari (including iPhone/iPad Safari) and Firefox do not support this standard flow; ordinary iOS browsers should not be assumed compatible. Feature detection provides a usable simulator fallback. See [Chrome's Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth) and [MDN compatibility and secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

Ordinary GATT connections do not expose continuous RSSI or a distance measurement. Experimental advertisement/scanning APIs are not a portable basis for this prototype. In the original `/` simulator, **Far, Nearby and Close**, glow intensity, compass direction, battery and group delivery remain simulated. The physical bands separately calculate approximate metres and a north-referenced bearing from coordinates supplied through `/phone`. This is phone-location guidance, not BLE radio direction finding or a wrist compass.

## Why the two MacBooks showed empty choosers

Both Chrome pages were acting as BLE centrals (scanners); neither was advertising a GATT server. Choosing Nayaka or Nala is a local identity label, not Bluetooth registration. Turning on macOS Bluetooth or pairing the Macs in system settings does not turn the website into a BLE peripheral. The original service filter also hid devices that did not advertise the custom UUID; broad BLE discovery fixes that restriction, but cannot make browser peers discoverable.

For a browser-only MacBook setup, real inter-laptop Bluetooth messaging is **not supported**. Use the Browser connection panel for real network messaging, or use the included ESP32 firmware and `/phone` for the physical two-band prototype. The bands advertise as actual BLE peripherals and forward messages over their own ESP-NOW link. A native macOS GATT-peripheral application is not needed for this hardware flow.

## Validation

```bash
cd prototype
npm test
npm run build
npm run test:ui # Production export in installed Google Chrome; hardware APIs use test doubles.
```

The tests cover simulation, BLE discovery/capabilities/errors, persistent names and identities, WebRTC pairing/validation/cancellation, acknowledgements, and disconnects. `browserLink.integration.test.js` uses the development-only Werift implementation to establish two real ICE/DTLS/SCTP peers over local UDP and exchange all six signals both ways, rename a peer and disconnect. Socket access is required to run that integration test. Werift is not bundled in the website.

Browser BLE unit tests use injected GATT doubles. `hardware/verify_pair.py` passed 13 live USB/ESP-NOW checks on both physical bands, including restart persistence, bidirectional delivery, notifications, SOS and labelled simulated guidance with quality/expiry checks. `hardware/verify_bluetooth.py --legacy-signal` passed six physical Bluetooth protocol checks using Bleak. The actual `/phone` page passed 12 browser checks through USB and 13 through native Web Bluetooth in Chrome 122 on macOS. Both browser runs covered fresh load, explicit replacement/cancellation, CRUD, reload/reconnect persistence, wearer isolation and acknowledged manual sync, including clearing the band's list. Independent readback confirmed the physical Nayaka presets; Syifa stayed unchanged. Tests restored original presets and cleaned test storage/positions. See [hardware validation](hardware/README.md#validation-and-protocol) for the distinct test scopes, local reports and screenshots.

Physical finger touch, visual inspection of the actual LCD, GPS sharing from a physical phone, mobile-browser Bluetooth and two-physical-MacBook browser messaging have not been tested here. Display checks verify firmware state and framebuffer pixels. To validate your deployment's browser messaging: follow the three-step invitation/reply flow on two laptops, send signals in both directions, rename a browser and disconnect. To validate your phone setup, connect the band in a supported phone browser and check its owner, messages and location sharing. All proximity, compass direction, band controls and group deliveries in the original simulator remain simulated and independent of the real transports.

## SOS confirmation

Press the red triangular **SOS** button below the band display to open **Send SOS to group?**. Press the top **OK** button three separate times to send. The screen shows confirmation progress; **Back** or **Next** cancels and resets the count. SOS delivery is simulated and only includes connected friends.

## Prototype scope

Real prototype functionality includes interface navigation, state changes, accessibility settings, animations, lyric highlighting, friend-distance and venue-route simulations, compass feedback, light cues, safe browser vibration fallback, group signal delivery states, incoming signals, group responses, and the hold-to-confirm support flow.

Simulated functionality includes proximity and direction, physical haptic motors, live concert synchronisation, crowd sensing, real friend locations, venue routing, and emergency communication.

## Project files

The complete Expo project is in [`prototype/`](prototype/):

```text
prototype/
  App.js
  components/
  screens/
  data/
  static/
    watch.png (earlier concept asset, not used)
    BandFrame.js
    Initial Idea.png
  package.json
```

The initial Miro concept is available at [`prototype/static/Initial Idea.png`](prototype/static/Initial%20Idea.png).

## Research findings

Interviews, evaluations, usability testing, netnography, and secondary research
are organised in [`research-findings/`](research-findings/). Start with the
[research index](research-findings/README.md) for contributor folders and shared
themes.
