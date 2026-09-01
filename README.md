# PulseBand

PulseBand is a context-aware smart concert wristband prototype for **DECO3500 — Social & Mobile Computing**. The experience is designed to happen inside a wearable display, helping concertgoers stay connected to music, friends, accessibility features, and venue support without repeatedly checking a phone.

The current prototype uses the supplied `watch.png` as the literal physical watch frame. The black display area is replaced with an original PulseBand interface containing the interactive system.

## Run the prototype

```bash
cd prototype
npm install
npx expo start --web
```

The browser shows only the watch. Start at **Welcome, Nayaka**, enter Pulse Festival, then explore live mode, haptic music, friends, quick signals, lyrics, venue cues, quiet space, accessibility settings, help and Live Context. The Live Context screen keeps the beat, network, crowd, proximity and incoming-signal simulations inside the wristband interface.

## Prototype scope

Real prototype functionality includes interface navigation, state changes, accessibility settings, animations, lyric highlighting, friend-distance and venue-route simulations, compass feedback, light cues, safe browser vibration fallback, group signal delivery states, incoming signals, group responses, and the hold-to-confirm support flow.

Simulated functionality includes Bluetooth proximity, physical haptic motors, live concert synchronisation, crowd sensing, real friend locations, venue routing, and emergency communication.

## Project files

The complete Expo project is in [`prototype/`](prototype/):

```text
prototype/
  App.js
  components/
  screens/
  data/
  static/
    watch.png
    Initial Idea.png
  package.json
```

The initial Miro concept is available at [`prototype/static/Initial Idea.png`](prototype/static/Initial%20Idea.png).
