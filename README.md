# PulseBand

PulseBand is a context-aware smart concert wristband prototype for **DECO3500 — Social & Mobile Computing**. The experience is designed to happen inside a wearable display, helping concertgoers stay connected to music, friends, accessibility features, and venue support without repeatedly checking a phone.

The current prototype uses a code-built circular PulseBand body with a small rectangular display and four physical-style controls: Back, Next, OK and a red triangular SOS button below the display. Four colour indicators around the body represent group awareness. The supplied `watch.png` is retained as an earlier concept asset but is not used by the application.

## Run the prototype

```bash
cd prototype
npm install
npx expo start --web
```

First choose **Nayaka, Amy, Nala, or Syifa**. The identity is stored in this browser's local storage and survives refresh. **Switch user** returns to selection and disconnects hardware. Each phone can choose a different identity; this is not authentication or a globally reserved name. Self is excluded from friend selection and simulated recipients. Storage restrictions may require selecting again after refresh.

The existing band, friend lights, Back/Next/OK controls, quick signals and SOS simulation remain available without Bluetooth. Prototype controls still drive only the simulation.

## Real Web Bluetooth

Press **Connect Bluetooth** to open the browser permission/device chooser. Nothing connects automatically. The site must run over HTTPS (localhost also works). Select the physical band's owner using the manual test label; its real connection status appears on that friend's selection screen. This label does not authenticate a person. One physical peripheral can be connected at a time. Changing the label disconnects it.

The separate hardware panel connects a compatible BLE GATT peripheral, subscribes to notifications, sends compact signal codes, and handles permission rejection, cancellation, connection failure and disconnection. Received notifications update that panel. A successful write means the peripheral accepted a GATT write, not that a friend received or read it. Hardware SOS has its own three-confirmation flow and is not an emergency service. Simulator controls never write to hardware; hardware notifications never become simulated messages.

### Peripheral contract (firmware required)

No compatible firmware or physical hardware is included or was tested in this repository. A BLE peripheral (for example a programmed ESP32) must advertise service `b97b0001-7a62-4f1a-9b9c-0b13e9de3500`, exposing characteristic `b97b0002-7a62-4f1a-9b9c-0b13e9de3500` with **write with response** and **notify** properties. Both directions use exactly one unsigned byte:

| Code | Signal |
| --- | --- |
| 1 | I'm Safe |
| 2 | Toilet |
| 3 | Taking a Break |
| 4 | Going Home |
| 5 | Meet Me |
| 6 | SOS |

The browser filters for this service, so arbitrary headphones and unprogrammed bands will not appear. Firmware must process writes and emit notifications; it must implement any forwarding to another band itself. Malformed or unknown notification codes are ignored. No sender identity or recipient address is embedded in this single-peripheral protocol.

### Browser and phone limitations

Web Bluetooth is a **GATT client/central** API. Browser pages cannot advertise as BLE peripherals or host GATT servers, so four phones opening this site cannot exchange BLE messages with each other. True phone-to-phone messaging requires a backend with authenticated group membership and a realtime channel (e.g. WebSocket), or native applications/peripheral hardware implementing BLE advertising, routing and delivery acknowledgements. Vercel HTTPS alone does not provide that transport.

Use a supported Chromium browser such as Chrome on Android, macOS, Windows or ChromeOS; hardware, OS permissions and browser policy also matter. Safari (including iPhone/iPad Safari) and Firefox do not support this standard flow; ordinary iOS browsers should not be assumed compatible. Feature detection provides a usable simulator fallback. See [Chrome's Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth) and [MDN compatibility and secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

Ordinary GATT connections do not expose continuous RSSI or a distance measurement. Experimental advertisement/scanning APIs are not a portable basis for this prototype. **Far, Nearby and Close**, glow intensity, compass direction, battery and group delivery are simulated. No real metre values or BLE bearing are claimed. BLE direction finding would require additional hardware and an exposed protocol; this implementation has neither.

## Validation

```bash
cd prototype
npm test
npm run build
```

32 automated tests cover existing simulation behaviour plus support detection, permissions, connection/write failure, notifications, cancellation races, disconnects, identity persistence/switching, self-exclusion and separation of hardware from simulated movement. Hardware tests use injected GATT doubles: passing tests do not demonstrate a physical connection. Browser visual/mobile verification and physical-device acceptance testing remain necessary. To check manually: select each identity, refresh, switch users, cycle friends, try an unsupported browser, then connect compatible hardware, send each code, notify each code back, and turn off the peripheral. Verify the hardware status changes without moving simulated proximity/direction.

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
