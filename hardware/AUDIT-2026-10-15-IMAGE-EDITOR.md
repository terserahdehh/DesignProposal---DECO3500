# Text/image editor — 15 October 2026

The latest `main` (`eb021ab`) was pulled before implementation. The `/phone` editor now supports Add text/Add image, PNG/JPEG/WebP selection (5 MB maximum), local conversion into a 32×32 monochrome preview, captions, replacement, conversion back to text, deletion and browser persistence. Original pictures are not uploaded to a storage service. Eight combined browser presets and the existing 40-character ASCII caption/text limit apply.

## Physical-firmware boundary

The user explicitly requested **no watch flashing and no merge of `feature/find-friend-ranging`**. Both instructions were followed. The connected watches run Wi-Fi FTM/motion-tracking firmware from outside `main`; their capabilities do not include image presets. No firmware source, pairing key, ranging calibration or tracking implementation was changed. No upload or reset command was run.

Images therefore remain **browser-only on these watches**. The editor says so. Its explicit **Sync text only** action transmits text presets while retaining images locally; images are not silently converted into caption-only hardware messages. If only browser images remain, **Clear text list** deliberately synchronizes an empty text list. Image transfers are rejected unless compatible firmware advertises support. Tests using a compatible-firmware double exercise data preservation, not a claim that the current physical watches support images.

## Verification

- 120 Node tests passed, including bitmap encoding, malformed/oversized input rejection, mixed-preset save/import/reload, caption edits and capability-gated USB/Bluetooth requests.
- 18 production-export browser tests passed in Google Chrome. Image upload, exact pixel conversion, replacement, editing, reload, deletion, conversion to text, explicit text-only transfer and clearing the final text while retaining browser images are covered. These browser-contract tests use hardware/API doubles.
- All 31 existing Python bridge tests passed. No bridge or firmware source changes are included.
- The opt-in `prototype/tests/livePresets.cjs` also passed against **the public Vercel page and both actual USB/ESP-NOW watches**, with no API or hardware doubles. Each owner's text load/add/edit/delete/sync was confirmed by fresh firmware readback. An actual image selected in the browser stayed in browser storage while text-only synchronization left the physical preset list unchanged. Real text popups and sender acknowledgements passed in both directions.
- Both original preset lists (six Nayaka, five Syifa) were restored exactly. Sensor configuration remained equal before/after, and firmware uptime increased without resetting. No GPS/demo-location, motion, ranging-calibration or flashing commands were issued.

For use, see [Quick Start](QUICK_START.md). The live check needs the existing USB bridge running and both watches connected:

```bash
node prototype/tests/livePresets.cjs https://pulseband-steel.vercel.app http://127.0.0.1:8787
```

It needs one free preset slot per watch, refuses to start with unread real messages, uses temporary test text and restores the exact original lists in cleanup. The script does not measure location accuracy or physically test finger input.
