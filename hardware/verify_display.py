#!/usr/bin/env python3
"""Capture and check actual PulseBand framebuffers over owner-verified USB.

Close the USB bridge and serial monitors before running. Commands exercise the
firmware controls; they do not test physical finger input or LCD optics. Captures
are atomic frame_snapshot replies, never a collection of independently read rows.
Only explicitly simulated locations are submitted. Original presets are restored,
locations cleared and bands returned home in finally. SOS is cancelled after two
confirmations and never deliberately sent. --self-test uses no serial devices.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import sys
import time

from bridge import BandBridge, OWNERS


WIDTH = HEIGHT = 240
PIXEL_COUNT = WIDTH * HEIGHT
INK = 0x0863
PAPER = 0xEF7C
WIDE_TEXT = "W" * 40
EXPECTED_MACS = {"nayaka": "8C:FD:49:9B:E7:40", "syifa": "8C:FD:49:9B:EE:84"}
DOT_CENTRES = ((48, 48), (192, 48), (48, 192), (192, 192))


class VerificationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def decode_pixels(snapshot):
    """Decode fixed-width count/color runs; reject truncation and excess pixels."""
    require(type(snapshot.get("width")) is int and snapshot["width"] == WIDTH,
            "Snapshot width must be exactly 240")
    require(type(snapshot.get("height")) is int and snapshot["height"] == HEIGHT,
            "Snapshot height must be exactly 240")
    require(snapshot.get("encoding") == "rgb565-rle", "Unsupported snapshot encoding")
    encoded = snapshot.get("pixels")
    require(isinstance(encoded, str) and bool(encoded) and len(encoded) % 8 == 0
            and re.fullmatch(r"[0-9a-fA-F]+", encoded), "Invalid RGB565-RLE run data")
    pixels = []
    for offset in range(0, len(encoded), 8):
        count = int(encoded[offset:offset + 4], 16)
        colour = int(encoded[offset + 4:offset + 8], 16)
        require(count > 0, "Zero-length RGB565-RLE run")
        require(len(pixels) + count <= PIXEL_COUNT, "RGB565-RLE contains excess pixels")
        pixels.extend([colour] * count)
    require(len(pixels) == PIXEL_COUNT, "RGB565-RLE did not decode exactly 57,600 pixels")
    return pixels


def inspect_pixels(pixels, sender=None):
    """Check generated bright pixels against the physical round-display boundary."""
    require(len(pixels) == PIXEL_COUNT, "Pixel inspection requires a complete frame")
    outside, samples, foreground = 0, [], 0
    for index, colour in enumerate(pixels):
        if colour == INK:
            continue
        foreground += 1
        x, y = index % WIDTH, index // WIDTH
        if (x - 120) ** 2 + (y - 120) ** 2 > 120 ** 2:
            outside += 1
            if len(samples) < 8:
                samples.append({"x": x, "y": y, "rgb565": f"{colour:04x}"})
    # The four dots were removed from every view, including unread messages.
    corners = [{"centre": [cx, cy], "clear": all(
        pixels[y * WIDTH + x] == PAPER
        for y in range(cy - 1, cy + 2) for x in range(cx - 1, cx + 2))}
        for cx, cy in DOT_CENTRES]
    return {"decodedPixels": len(pixels), "foregroundPixels": foreground,
            "outsideCirclePixels": outside, "outsideCircleSamples": samples,
            "roundBoundaryOk": outside == 0, "nonBlankWatchFrame": foreground >= 20000,
            "cornerDots": corners, "cornerDotsAbsent": all(item["clear"] for item in corners)}


def image_from_pixels(pixels):
    from PIL import Image

    rgb = bytearray()
    for colour in pixels:
        r, g, b = (colour >> 11) & 31, (colour >> 5) & 63, colour & 31
        rgb.extend(((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)))
    return Image.frombytes("RGB", (WIDTH, HEIGHT), bytes(rgb))


class DisplayVerifier:
    def __init__(self, bridge, output):
        self.bridge = bridge
        self.output = output
        self.directory = output.parent
        self.original_messages = {}
        self.verified_owners = []
        self.images = []
        self.last_demo_timestamp = 0
        self.report = {
            "startedAt": datetime.now(timezone.utc).isoformat(), "ok": False,
            "scope": {"transport": "real USB atomic firmware framebuffer snapshots and ESP-NOW",
                      "physicalFingerTouchTested": False, "physicalLcdOpticsTested": False,
                      "positions": "explicitly simulated examples only, cleared afterward",
                      "realGpsOrWristDirectionTested": False, "textFitHumanReviewed": False,
                      "mechanicalChecks": "57,600 pixels, round boundary and absence of four corner dots",
                      "sosSent": False},
            "devices": [], "captures": [], "checks": [], "cleanup": [],
        }

    def record(self, name, details=None, outcome="passed"):
        entry = {"name": name, "outcome": outcome}
        if details is not None:
            entry["details"] = details
        self.report["checks"].append(entry)
        print(f"{outcome.upper()}: {name}", flush=True)

    def status(self, owner):
        return self.bridge.command(owner, "status", {})

    def wait_status(self, owner, predicate, description, timeout=15):
        deadline = time.monotonic() + timeout
        last = {}
        while time.monotonic() < deadline:
            last = self.status(owner)
            if predicate(last):
                return last
            time.sleep(0.1)
        safe_state = {key: last.get(key) for key in ("view", "unread", "peerConnected", "result")}
        raise VerificationError(f"{owner}: timeout waiting for {description}; state={safe_state}")

    def press(self, owner, key):
        return self.bridge.command(owner, "control", {"button": key})

    def home(self, owner):
        # Avoid an OK press on a message confirmation or SOS sending an alert.
        for _ in range(24):
            state = self.status(owner)
            if state.get("unread"):
                self.press(owner, "back")
            elif state.get("view") == "home":
                return state
            elif state.get("view") in ("sos", "confirm"):
                self.press(owner, "back")
            elif state.get("view") == "menu":
                self.press(owner, "ok" if state.get("menuIndex") == 0 else "back")
            else:
                self.press(owner, "ok")
        raise VerificationError(f"{owner}: could not return home safely")

    def verify_identities(self):
        saved = {}
        for owner in OWNERS:
            state = self.status(owner)
            require(state.get("owner") == owner and state.get("mac", "").upper() == EXPECTED_MACS[owner],
                    f"{owner}: connected owner/MAC does not match the verified pair")
            require(state.get("radioReady") is True, f"{owner}: ESP-NOW is unavailable")
            require(isinstance(state.get("messages"), list), f"{owner}: stored presets are unavailable")
            saved[owner] = json.loads(json.dumps(state["messages"]))
            self.report["devices"].append({"owner": owner, "mac": state["mac"],
                                           "port": self.bridge.snapshot(owner)["port"],
                                           "model": state.get("model"),
                                           "originalPresetCount": len(saved[owner])})
        # Verify both before authorising any mutation, including cleanup writes.
        self.original_messages, self.verified_owners = saved, list(OWNERS)
        for owner in OWNERS:
            self.wait_status(owner, lambda state: state.get("peerConnected") is True, "paired radio heartbeat")
        self.record("Both USB owners and MACs verified with a connected ESP-NOW peer")

    def capture(self, owner, case, view, sender=None, incoming=""):
        snapshot = self.bridge.command(owner, "frame_snapshot", {})
        require(snapshot.get("owner") == owner, f"{owner}/{case}: snapshot owner mismatch")
        require(snapshot.get("view") == view, f"{owner}/{case}: snapshot changed to {snapshot.get('view')!r}")
        require(snapshot.get("unread") is (sender is not None), f"{owner}/{case}: unexpected unread state")
        require(snapshot.get("incoming") == incoming, f"{owner}/{case}: incoming text mismatch")
        pixels = decode_pixels(snapshot)
        metrics = inspect_pixels(pixels, sender)
        image = image_from_pixels(pixels)
        relative_path = Path("display") / f"{owner}-{case}.png"
        path = self.directory / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path)
        self.images.append((f"{owner.title()} / {case}", image))
        entry = {"owner": owner, "case": case, "view": view, "unread": snapshot["unread"],
                 "width": snapshot["width"], "height": snapshot["height"],
                 "encoding": snapshot["encoding"], "encodedBytes": len(snapshot["pixels"]),
                 "runCount": len(snapshot["pixels"]) // 8,
                 "png": relative_path.as_posix(), "atomic": True, **metrics}
        if sender:
            entry.update(sender=sender, incomingLength=len(incoming))
        self.report["captures"].append(entry)
        passed = metrics["roundBoundaryOk"] and metrics["nonBlankWatchFrame"] and metrics["cornerDotsAbsent"]
        self.record(f"{owner.title()}: {case} atomic pixels, round boundary and no corner dots", entry,
                    "passed" if passed else "failed")
        return entry

    def clear_locations(self):
        errors = []
        for owner in self.verified_owners:
            try:
                self.bridge.command(owner, "clear_location", {})
            except Exception as exc:
                errors.append(f"{owner}: {exc}")
        require(not errors, "; ".join(errors))
        for owner in self.verified_owners:
            self.wait_status(owner, lambda state: state.get("location", {}).get("valid") is False
                             and state.get("peerLocation", {}).get("valid") is False
                             and "guidance" not in state, "both positions cleared")

    def open_find(self, owner):
        self.home(owner)
        menu = self.press(owner, "ok")
        require(menu.get("view") == "menu" and menu.get("menuIndex") == 0,
                f"{owner}: Find Direction is not the first menu entry")
        state = self.press(owner, "ok")
        require(state.get("view") == "find", f"{owner}: Find Direction did not open")
        return state

    def set_demo_pair(self, coincident=False):
        coordinates = {"nayaka": (-27.4975, 153.0137),
                       "syifa": (-27.4975, 153.0137) if coincident else (-27.4965, 153.0147)}
        timestamp = max(int(time.time() * 1000), self.last_demo_timestamp + 1)
        self.last_demo_timestamp = timestamp
        for owner, (lat, lon) in coordinates.items():
            self.bridge.command(owner, "demo_location", {"lat": lat, "lon": lon, "accuracy": 8,
                                                        "timestamp": timestamp, "simulated": True})
        for owner in OWNERS:
            self.wait_status(owner, lambda state: state.get("location", {}).get("valid") is True
                             and state.get("peerLocation", {}).get("valid") is True
                             and state.get("location", {}).get("timestamp") == timestamp
                             and state.get("peerLocation", {}).get("timestamp") == timestamp
                             and state.get("guidance", {}).get("simulated") is True,
                             "latest labelled demonstration positions on both bands")

    def capture_message_flow(self, sender, receiver):
        for owner in (sender, receiver):
            self.home(owner)
        require(self.press(sender, "ok").get("menuIndex") == 0, f"{sender}: wrong initial menu entry")
        menu = self.press(sender, "next")
        require(menu.get("view") == "menu" and menu.get("menuIndex") == 1,
                f"{sender}: 40-character preset selection failed")
        self.capture(sender, "menu-wide40", "menu")
        require(self.press(sender, "ok").get("view") == "confirm", f"{sender}: confirmation did not open")
        self.capture(sender, "confirm-wide40", "confirm")
        events = self.bridge.events(sender)
        cursor = events[-1]["sequence"] if events else 0
        self.press(sender, "ok")
        state = self.wait_status(receiver, lambda state: state.get("view") == "incoming"
                                 and state.get("unread") is True and state.get("incoming") == WIDE_TEXT,
                                 "real incoming 40-character message")
        require(state.get("notificationLed") == INDICATORS[sender][3], f"{receiver}: wrong sender colour")
        self.wait_status(sender, lambda state: state.get("view") == "result"
                         and state.get("result") == "Received by band", "application delivery acknowledgement")
        require(any(event.get("type") == "sent" and event.get("text") == WIDE_TEXT
                    for event in self.bridge.events(sender, cursor)), f"{sender}: no fresh application ACK event")
        self.capture(receiver, f"incoming-{sender}-wide40", "incoming", sender=sender, incoming=WIDE_TEXT)
        self.capture(sender, "result-delivered", "result")
        for owner in (sender, receiver):
            self.home(owner)

    def capture_empty_menu(self):
        for owner in OWNERS:
            self.bridge.command(owner, "presets", {"messages": []})
            require(self.status(owner).get("messages") == [], f"{owner}: empty preset list was not saved")
            self.home(owner)
            menu = self.press(owner, "ok")
            require(menu.get("view") == "menu" and menu.get("menuIndex") == 0
                    and menu.get("presetCount") == 0, f"{owner}: empty menu did not retain Find Direction")
            for key in ("next", "back"):
                menu = self.press(owner, key)
                require(menu.get("view") == "menu" and menu.get("menuIndex") == 0,
                        f"{owner}: {key} broke the empty menu")
            self.capture(owner, "menu-empty-presets", "menu")
            require(self.press(owner, "ok").get("view") == "find", f"{owner}: empty menu cannot open Find Direction")
            self.home(owner)
        self.record("Deleting all presets retains Find Direction and safe Next/Back navigation on both bands")

    def capture_sos(self, owner):
        self.home(owner)
        require(self.press(owner, "sos").get("view") == "sos", f"{owner}: SOS confirmation did not open")
        self.capture(owner, "sos-zero-confirmations", "sos")
        for count in (1, 2):
            before = self.status(owner)
            require(before.get("view") == "sos" and before.get("unread") is False,
                    f"{owner}: view changed before SOS confirmation {count}")
            require(self.press(owner, "ok").get("view") == "sos", f"{owner}: SOS sent before third confirmation")
            self.capture(owner, f"sos-{count}-confirmations", "sos")
        require(self.press(owner, "back").get("view") == "home", f"{owner}: SOS cancellation failed")
        other = "syifa" if owner == "nayaka" else "nayaka"
        require(self.status(other).get("unread") is False, f"{owner}: cancelled SOS reached the other band")

    def capture_direction(self, coincident):
        self.set_demo_pair(coincident)
        for owner in OWNERS:
            state = self.open_find(owner)
            guide = state.get("guidance", {})
            require(guide.get("available") is True and guide.get("simulated") is True
                    and guide.get("northReferenced") is True, f"{owner}: missing labelled demo guidance")
            require(guide.get("usable") is (not coincident)
                    and state.get("directionArrowVisible") is (not coincident), f"{owner}: incorrect arrow confidence state")
            require(guide.get("accuracy") == 16, f"{owner}: combined reported accuracy mismatch")
            if coincident:
                require(guide.get("metres") == 0 and "bearing" not in guide,
                        f"{owner}: coincident fixes still report a bearing")
            else:
                require(140 < guide.get("metres", 0) < 160
                        and math.isfinite(guide.get("bearing", math.nan))
                        and 0 < guide.get("bearingUncertaintyDegrees", 0) < 90,
                        f"{owner}: separated demo direction is invalid")
            case = "find-demo-coincident" if coincident else "find-demo-usable"
            entry = self.capture(owner, case, "find")
            entry["guidance"] = {key: guide[key] for key in
                                 ("metres", "usable", "bearing", "bearingUncertaintyDegrees", "accuracy",
                                  "northReferenced", "simulated") if key in guide}

    def contact_sheet(self):
        if not self.images:
            return
        from PIL import Image, ImageDraw

        columns, cell_width, cell_height = 4, 280, 300
        rows = (len(self.images) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#e8e6e1")
        draw = ImageDraw.Draw(sheet)
        for index, (title, image) in enumerate(self.images):
            x, y = (index % columns) * cell_width, (index // columns) * cell_height
            owner, case = title.split(" / ", 1)
            draw.text((x + 12, y + 8), owner, fill="#202328")
            draw.text((x + 12, y + 23), case, fill="#202328")
            sheet.paste(image, (x + 20, y + 50))
        path = self.directory / "display-review.png"
        sheet.save(path)
        self.report["contactSheet"] = path.name

    def cleanup(self):
        try:
            self.clear_locations()
            self.report["cleanup"].append({"action": "clear all test positions", "ok": True})
        except Exception as exc:
            self.report["cleanup"].append({"action": "clear all test positions", "ok": False, "error": str(exc)})
        for owner in self.verified_owners:
            try:
                messages = self.original_messages[owner]
                self.bridge.command(owner, "presets", {"messages": messages})
                require(self.status(owner).get("messages") == messages, f"{owner}: original presets were not restored")
                state = self.home(owner)
                require(state.get("unread") is False, f"{owner}: unread notification remains")
                self.report["cleanup"].append({"owner": owner, "action": "restore presets and home",
                                               "ok": True, "presetCount": len(messages)})
            except Exception as exc:
                self.report["cleanup"].append({"owner": owner, "action": "restore presets and home",
                                               "ok": False, "error": str(exc)})

    def run(self):
        try:
            self.verify_identities()
            self.clear_locations()
            for owner in OWNERS:
                self.home(owner)
                self.capture(owner, "home", "home")
            self.capture_empty_menu()
            for owner in OWNERS:
                messages = [{"id": "display-wide40", "text": WIDE_TEXT}]
                self.bridge.command(owner, "presets", {"messages": messages})
                require(self.status(owner).get("messages") == messages, f"{owner}: test preset readback mismatch")
            self.capture_message_flow("nayaka", "syifa")
            self.capture_message_flow("syifa", "nayaka")
            for owner in OWNERS:
                self.capture_sos(owner)
                state = self.open_find(owner)
                require("guidance" not in state and state.get("directionArrowVisible") is False,
                        f"{owner}: direction shown without locations")
                self.capture(owner, "find-unavailable", "find")
            self.capture_direction(False)
            self.capture_direction(True)
        except Exception as exc:
            self.report["error"] = str(exc)
            self.record("Display verification completed", str(exc), "failed")
        finally:
            self.cleanup()
            try:
                self.contact_sheet()
            except Exception as exc:
                self.record("Contact sheet saved", str(exc), "failed")
            self.report["finishedAt"] = datetime.now(timezone.utc).isoformat()
            self.report["ok"] = bool(self.report["captures"]) and not self.report.get("error") \
                and all(check["outcome"] == "passed" for check in self.report["checks"]) \
                and all(check["ok"] for check in self.report["cleanup"])
        return self.report


def self_test():
    """Software-only tests for strict RLE decoding and round/corner inspection."""
    base = {"width": WIDTH, "height": HEIGHT, "encoding": "rgb565-rle"}
    assert decode_pixels({**base, "pixels": "e1000863"}) == [INK] * PIXEL_COUNT
    for encoded in ("", "00000863", "00010863", "e1010863", "ffff0863", "e100zzzz", "e100086"):
        try:
            decode_pixels({**base, "pixels": encoded})
        except VerificationError:
            pass
        else:
            raise AssertionError(f"Malformed/truncated/excess RLE accepted: {encoded!r}")
    pixels = [INK] * PIXEL_COUNT
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if (x - 120) ** 2 + (y - 120) ** 2 <= 119 ** 2:
                pixels[y * WIDTH + x] = PAPER
    assert inspect_pixels(pixels)["roundBoundaryOk"]
    assert inspect_pixels(pixels)["nonBlankWatchFrame"]
    pixels[0] = 0xFFFF
    assert inspect_pixels(pixels)["outsideCirclePixels"] == 1
    pixels[0] = INK
    assert inspect_pixels(pixels, "nayaka")["cornerDotsAbsent"]
    cx, cy, colour = 48, 48, 0xA2BE
    for y in range(cy - 10, cy + 11):
        for x in range(cx - 10, cx + 11):
            if (x - cx) ** 2 + (y - cy) ** 2 <= 10 ** 2:
                pixels[y * WIDTH + x] = colour
    assert not inspect_pixels(pixels, "nayaka")["cornerDotsAbsent"]
    print("PASS: software-only RLE, round-boundary and removed-corner-dot checks; no serial access")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", action="append", default=[], help="Verified USB port; repeat for both bands")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--timeout", type=float, default=15, help="Per-command USB timeout in seconds")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "display-verification.json")
    parser.add_argument("--self-test", action="store_true", help="Software-only decoder/pixel checks; never open serial")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    require(args.timeout > 0 and math.isfinite(args.timeout), "Timeout must be a positive finite number")
    try:
        from PIL import Image  # Verify optional dependency before opening ports.
    except ImportError:
        print("Pillow is required: python -m pip install -r hardware/requirements-dev.txt", file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bridge = BandBridge(ports=args.port, baud=args.baud, rpc_timeout=args.timeout)
    verifier = DisplayVerifier(bridge, args.output)
    try:
        bridge.start()
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            if all(bridge.snapshot(owner).get("connected") for owner in OWNERS):
                break
            time.sleep(0.2)
        require(all(bridge.snapshot(owner).get("connected") for owner in OWNERS),
                "Both physical bands must be connected; close other serial users and check USB ports")
        report = verifier.run()
    except Exception as exc:
        verifier.report.update(error=str(exc), finishedAt=datetime.now(timezone.utc).isoformat())
        report = verifier.report
    finally:
        bridge.close()
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(f"Report: {args.output}", flush=True)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
