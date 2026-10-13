# Local USB bridge

Run the bridge from the repository root using the project environment:

```bash
hardware/.venv/bin/python hardware/bridge.py
```

Without `--port`, it discovers all attached USB bands and verifies each firmware owner and MAC. To restrict it to one band, supply `--port /dev/cu.usbmodem...`; repeat that option for multiple devices. Owners are never assigned by port order.

The default address is `http://127.0.0.1:8787`. The exact origin `https://pulseband-steel.vercel.app` and the known localhost development origins are allowed by default. A different deployment or LAN page needs its own `--allow-origin https://your-site.example`. Chrome may separately ask the user to allow local network access. An existing process must be restarted to pick up bridge source changes; do not start a second bridge on the same ports.

## Read live state and the watch screen

`GET /api/bands` returns the cached connection roster for Nayaka and Syifa. An offline entry can contain old metadata; it is not evidence of a current fix or remote connection. `POST /api/bands/{owner}/status` with an empty JSON object requests a fresh firmware response through the existing USB connection.

`GET /api/bands/{owner}/frame` requests one atomic capture of the current LCD frame through that same verified connection. It does not navigate the watch, send a message, change a location or save presets. To inspect Find Direction, first open that screen on the watch. Its actual captured screen name is returned in the top-level `view` field; the additional `band` field is the bridge's cached status.

```bash
curl http://localhost:8787/api/bands/syifa/frame
```

Successful captures return `ok`, `owner`, `width`, `height`, `view`, `encoding` and `pixels`. The firmware uses `encoding: "rgb565-rle"`: each group of eight hexadecimal characters contains a four-character repeat count followed by a four-character RGB565 colour. Expand the runs in order, then arrange the pixels into rows using `width`. Current bands return 240 × 240 pixels. The response has `Cache-Control: no-store`; it is captured when requested rather than read from an image cache.

An absent USB band returns HTTP 503, a rejected firmware capture returns 502, and a missing acknowledgement returns 504. Unknown owners/endpoints return 404. Disallowed browser origins return 403 before a capture command is sent.

## Bridge tests

```bash
hardware/.venv/bin/python -m unittest discover -s hardware/tests -v
```

These tests use serial doubles and a loopback HTTP server. They cover origin restrictions, live frame routing and payloads, preserved state, disconnected devices and acknowledgement errors; they do not supply or validate real GPS fixes.
