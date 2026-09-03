# PulseBand

PulseBand is a context-aware smart concert wristband prototype for **DECO3500 — Social & Mobile Computing**. The experience is designed to happen inside a wearable display, helping concertgoers stay connected to music, friends, accessibility features, and venue support without repeatedly checking a phone.

The current prototype uses a code-built circular PulseBand body with a small rectangular display and three physical-style controls: Back, Next and OK. Four colour indicators around the body represent group awareness. The supplied `watch.png` is retained as an earlier concept asset but is not used by the application.

## Run the prototype

```bash
cd prototype
npm install
npx expo start --web
```

The browser shows only the band. Start at **Welcome, Nayaka**, touch the fingerprint or press OK to enter Pulse Festival, then explore live mode, haptic music, friends, quick signals, lyrics, venue cues, quiet space, accessibility settings, help and Live Context. The band buttons provide Back, Next and OK navigation while the rectangular screen provides direct prototype touch targets. The Live Context screen keeps the beat, Bluetooth link, crowd, proximity and incoming-signal simulations inside the band interface.

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
    watch.png (earlier concept asset, not used)
    BandFrame.js
    Initial Idea.png
  package.json
```

The initial Miro concept is available at [`prototype/static/Initial Idea.png`](prototype/static/Initial%20Idea.png).
