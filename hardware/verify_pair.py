#!/usr/bin/env python3
"""Verify two flashed PulseBands over real USB/ESP-NOW; never flashes firmware.

Close the USB bridge/serial monitor before running. Serial tap commands exercise
the firmware coordinate mapping and buttons, not the physical touch sensor.
Synthetic coordinates are explicitly sent with demo_location and always cleared.
Original presets are restored in finally, including on verification failure.
Use --test-expiry to wait for the real 60-second location lifetime, with progress
updates while the bands stop receiving fresh fixes.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys
import time
import traceback

from bridge import BandBridge, BridgeError, OWNERS, discover_ports


class VerificationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


class PairVerifier:
    def __init__(self, bridge: BandBridge, reset_for_persistence=False, test_expiry=False):
        self.bridge = bridge
        self.reset_for_persistence = reset_for_persistence
        self.test_expiry = test_expiry
        self.original_messages = {}
        self.custom_messages = {
            owner: [{"id": f"verify-{owner}-1", "text": f"{owner.title()} hardware check"},
                    {"id": f"verify-{owner}-2", "text": f"{owner.title()} meet at Gate 2"}]
            for owner in OWNERS
        }
        self.report = {
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "ok": False,
            "scope": {
                "transport": "physical USB and encrypted ESP-NOW",
                "buttonInput": "serial-injected tap coordinates through firmware touchButton mapping",
                "physicalFingerTouchTested": False,
                "led": "rendered on-screen notification indicator; serial state verified",
                "locations": "explicitly simulated demonstration coordinates; cleared after testing",
                "gpsOrWearerRelativeBearingTested": False,
                "persistenceResetRequested": reset_for_persistence,
                "realLocationExpiryRequested": test_expiry,
            },
            "devices": [], "checks": [], "cleanup": [],
        }

    def record(self, name, details=None, outcome="passed"):
        entry = {"name": name, "outcome": outcome}
        if details is not None:
            entry["details"] = details
        self.report["checks"].append(entry)
        print(f"{outcome.upper()}: {name}", flush=True)

    def status(self, owner):
        return self.bridge.command(owner, "status", {})

    def wait_status(self, owner, predicate, description, timeout=12):
        deadline = time.monotonic() + timeout
        last = {}
        while time.monotonic() < deadline:
            last = self.status(owner)
            if predicate(last):
                return last
            time.sleep(0.1)
        # Only report relevant state, avoiding actual latitude/longitude fields.
        state = {field: last.get(field) for field in ("view", "peerConnected", "unread", "result")}
        raise VerificationError(f"{owner}: timed out waiting for {description}; state={state}")

    def cursor(self, owner):
        events = self.bridge.events(owner)
        return events[-1]["sequence"] if events else 0

    def wait_event(self, owner, after, event_type, text, timeout=8):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for event in self.bridge.events(owner, after):
                if event.get("type") == "send_failed":
                    raise VerificationError(f"{owner}: firmware reported delivery unconfirmed")
                if event.get("type") == event_type and event.get("text") == text:
                    return event
            time.sleep(0.05)
        raise VerificationError(f"{owner}: missing real {event_type} event for verification message")

    def tap(self, owner, button):
        coordinates = {"back": (57, 66), "ok": (120, 66), "next": (183, 66),
                       "sos": (120, 209), "dismiss": (120, 140)}
        x, y = coordinates[button]
        return self.bridge.command(owner, "tap", {"x": x, "y": y})

    def home(self, owner):
        """Return home without accidentally sending a selected preset."""
        for _ in range(24):
            state = self.status(owner)
            if state.get("unread"):
                self.tap(owner, "dismiss")
            elif state.get("view") == "home":
                return state
            elif state.get("view") == "sos":
                self.tap(owner, "back")
            elif state.get("view") == "confirm":
                self.tap(owner, "back")
            elif state.get("view") == "menu":
                # Index zero is Find Direction, which cannot send a message.
                self.tap(owner, "ok" if state.get("menuIndex") == 0 else "back")
            else:
                self.tap(owner, "ok")
        raise VerificationError(f"Could not return {owner} to home safely")

    def wait_pair(self):
        for owner in OWNERS:
            self.wait_status(owner, lambda state: state.get("peerConnected") is True,
                             "ESP-NOW peer heartbeat", timeout=18)

    def verify_identities(self):
        for owner in OWNERS:
            state = self.status(owner)
            require(state.get("owner") == owner, f"Wrong owner identity on {owner}'s port")
            require(state.get("radioReady") is True, f"{owner}: ESP-NOW radio not ready")
            require(state.get("touchAvailable") is True, f"{owner}: touch controller not detected")
            messages = state.get("messages")
            require(isinstance(messages, list), f"{owner}: firmware did not echo stored presets")
            self.original_messages[owner] = json.loads(json.dumps(messages))
            self.report["devices"].append({"owner": owner, "mac": state["mac"],
                                           "port": self.bridge.snapshot(owner)["port"],
                                           "model": state.get("model"), "touchControllerDetected": True,
                                           "originalPresetCount": len(messages)})
        self.wait_pair()
        self.record("Firmware owner, MAC, touch-controller presence, and bidirectional ESP-NOW heartbeats")

    def sync_presets(self):
        for owner in OWNERS:
            reply = self.bridge.command(owner, "presets", {"messages": self.custom_messages[owner]})
            require(reply.get("messages") == self.custom_messages[owner], f"{owner}: preset save acknowledgement mismatch")
            require(self.status(owner).get("messages") == self.custom_messages[owner], f"{owner}: saved preset readback mismatch")
        self.record("Custom presets persisted and read back on both physical bands")

    def reset_and_verify_presets(self):
        if not self.reset_for_persistence:
            self.record("Preset persistence across hardware reset", "Reset option not requested; reconnect alone is insufficient proof", "skipped")
            return
        for owner in OWNERS:
            self.home(owner)
            # Allow enough uptime to distinguish a real reboot from ordinary
            # reconnect latency, even when the verifier starts just after flash.
            before = self.wait_status(owner, lambda state: isinstance(state.get("uptimeMillis"), int)
                                     and state["uptimeMillis"] >= 6000, "uptime >= six seconds")
            connection = self.bridge.connections[owner]
            port, expected_mac = connection.port, before["mac"]
            device = connection.device
            # Espressif/esptool hard-reset sequence for a USB-UART board:
            # release GPIO0 (DTR), pulse EN low using RTS, then release EN.
            device.setDTR(False)
            device.setRTS(True)
            time.sleep(0.15)
            device.setRTS(False)
            connection.close()
            deadline, connected = time.monotonic() + 15, False
            while time.monotonic() < deadline:
                time.sleep(0.4)
                if self.bridge.connect_port(port):
                    connected = True
                    break
            require(connected, f"{owner}: did not reconnect after hard reset")
            after = self.status(owner)
            require(after.get("mac") == expected_mac, f"{owner}: device MAC changed after reset")
            require(after.get("uptimeMillis", math.inf) < before["uptimeMillis"], f"{owner}: uptime did not drop; reset unproven")
            require(after.get("messages") == self.custom_messages[owner], f"{owner}: presets did not survive hardware reset")
        self.wait_pair()
        self.record("Custom presets survived actual RTS/EN hardware reset on both bands")

    def assert_delivery(self, sender, receiver, text, sender_cursor, receiver_cursor):
        received = self.wait_event(receiver, receiver_cursor, "message", text)
        require(received.get("from", received.get("sender")) == sender, "Received message came from unexpected owner")
        acknowledged = self.wait_event(sender, sender_cursor, "sent", text)
        state = self.wait_status(receiver, lambda item: item.get("view") == "incoming" and item.get("unread") is True,
                                 "incoming message pop-up")
        require(state.get("incoming") == text, f"{receiver}: incorrect pop-up text")
        expected_led = "purple" if sender == "nayaka" else "yellow"
        require(state.get("notificationLed") == expected_led, f"{receiver}: wrong notification LED indicator")
        require(self.status(sender).get("result") == "Received by band", f"{sender}: no application-level ACK display")
        dismissed = self.tap(receiver, "dismiss")
        require(dismissed.get("unread") is False and dismissed.get("incoming") == "", f"{receiver}: message dismissal failed")
        require(dismissed.get("notificationLed") == "off", f"{receiver}: LED did not clear after dismissal")
        self.home(sender)
        self.home(receiver)
        return {"sender": sender, "receiver": receiver, "popUp": True, "unreadLed": expected_led,
                "applicationAcknowledged": True, "dismissed": True,
                "receivedDeviceSequence": received.get("deviceSequence"),
                "ackEventObserved": acknowledged.get("type") == "sent"}

    def send_preset(self, sender, receiver):
        self.home(sender)
        self.home(receiver)
        sender_cursor, receiver_cursor = self.cursor(sender), self.cursor(receiver)
        state = self.tap(sender, "ok")
        require(state.get("view") == "menu" and state.get("menuIndex") == 0, "OK did not open band menu")
        state = self.tap(sender, "next")
        require(state.get("view") == "menu" and state.get("menuIndex") == 1, "Next did not select custom preset")
        state = self.tap(sender, "ok")
        require(state.get("view") == "confirm", "Preset selection skipped confirmation")
        self.tap(sender, "ok")
        details = self.assert_delivery(sender, receiver, self.custom_messages[sender][0]["text"], sender_cursor, receiver_cursor)
        self.record(f"{sender.title()} -> {receiver.title()} preset via injected touchscreen coordinates", details)

    def verify_sos(self):
        sender, receiver, text = "nayaka", "syifa", "SOS - I need help"
        for owner in OWNERS:
            self.home(owner)
        sender_cursor, receiver_cursor = self.cursor(sender), self.cursor(receiver)
        require(self.tap(sender, "sos").get("view") == "sos", "SOS button did not open confirmation")
        for number in (1, 2):
            state = self.tap(sender, "ok")
            require(state.get("view") == "sos", f"SOS sent before the third OK press ({number})")
        require(self.tap(sender, "back").get("view") == "home", "Back did not cancel SOS")
        time.sleep(0.5)
        require(not any(event.get("type") == "message" and event.get("text") == text
                        for event in self.bridge.events(receiver, receiver_cursor)), "Cancelled SOS was received")
        require(not self.status(receiver).get("unread"), "Cancelled SOS created an incoming pop-up")
        self.record("Two SOS confirmations followed by Back cancel without sending")
        self.tap(sender, "sos")
        for number in (1, 2):
            require(self.tap(sender, "ok").get("view") == "sos", f"SOS sent after only {number} confirmation presses")
        self.tap(sender, "ok")
        details = self.assert_delivery(sender, receiver, text, sender_cursor, receiver_cursor)
        details["confirmationPresses"] = 3
        self.record("SOS reaches the other band only after three OK presses", details)

    def set_demo_pair(self, examples=None, accuracy=1):
        # Public synthetic examples near Brisbane; never load/store real locations.
        examples = examples or {"nayaka": (-27.4975, 153.0137), "syifa": (-27.4965, 153.0147)}
        timestamp = int(time.time() * 1000)
        started = time.monotonic()
        for owner, (lat, lon) in examples.items():
            state = self.bridge.command(owner, "demo_location", {"lat": lat, "lon": lon, "accuracy": accuracy,
                                       "timestamp": timestamp, "simulated": True})
            require(state.get("location", {}).get("simulated") is True, "Demo coordinate not marked simulated")
        for owner in OWNERS:
            self.wait_status(owner, lambda item: item.get("location", {}).get("valid") is True
                             and item.get("peerLocation", {}).get("valid") is True
                             and item.get("location", {}).get("timestamp") == timestamp
                             and item.get("peerLocation", {}).get("timestamp") == timestamp
                             and item.get("guidance", {}).get("simulated") is True,
                             "the latest simulated location exchange and guidance")
        return started

    def open_find(self, owner):
        self.home(owner)
        self.tap(owner, "ok")
        state = self.tap(owner, "ok")
        require(state.get("view") == "find", "Find Direction did not open from watch menu")
        return state

    def check_direction_quality(self, owner, state, usable, expected_accuracy):
        guide = state.get("guidance", {})
        require(state.get("location", {}).get("valid") is True
                and state.get("peerLocation", {}).get("valid") is True,
                f"{owner}: direction quality must describe two fresh fixes")
        require(guide.get("simulated") is True, "Demo guidance lost its simulated label")
        require(guide.get("northReferenced") is True, "Direction must be referenced to north")
        require(guide.get("usable") is usable, f"{owner}: unexpected direction usability")
        require(abs(guide.get("accuracy", -1) - expected_accuracy) < 0.01,
                "Combined location accuracy missing or incorrect")
        uncertainty = guide.get("bearingUncertaintyDegrees")
        require(isinstance(uncertainty, (int, float)) and not isinstance(uncertainty, bool)
                and math.isfinite(uncertainty) and 0 <= uncertainty <= 180,
                "Bearing uncertainty must be a finite angle between zero and 180 degrees")
        require(state.get("view") == "find", "Quality check must run on the Find Direction screen")
        require(state.get("directionArrowVisible") is usable,
                f"{owner}: arrow visibility does not match usable direction guidance")
        if usable:
            distance = guide.get("metres", 0)
            require(distance > expected_accuracy, "Usable direction requires separation exceeding combined error")
            expected_uncertainty = math.degrees(math.asin(min(1, expected_accuracy / distance)))
            require(abs(uncertainty - expected_uncertainty) < 0.25,
                    "Reported bearing uncertainty does not match distance and combined position error")
        else:
            require(uncertainty >= 90, "Overlapping fixes must report broad bearing uncertainty")
        return {"owner": owner, "available": True, "usable": usable,
                "directionArrowVisible": state["directionArrowVisible"],
                "metres": round(guide.get("metres", 0), 2),
                "combinedAccuracyMetres": expected_accuracy,
                "bearingUncertaintyDegrees": round(uncertainty, 2), "simulated": True}

    def verify_demo_direction(self):
        self.set_demo_pair()
        directions = []
        for owner in OWNERS:
            state = self.open_find(owner)
            guide = state["guidance"]
            require(140 < guide.get("metres", 0) < 160, "Unexpected distance for known simulated positions")
            low, high = (40, 44) if owner == "nayaka" else (220, 224)
            require(low < guide.get("bearing", -1) < high, f"{owner}: wrong bearing for known simulated positions")
            details = self.check_direction_quality(owner, state, True, 2)
            details.update(bearingDegreesNorth=round(guide["bearing"], 2), northReferenced=True)
            directions.append(details)
        self.record("Simulated positions exchanged over ESP-NOW and shown as north-up Find Direction", directions)

    def verify_direction_uncertainty(self):
        cases = (
            ("Coincident fixes suppress the directional arrow", {
                "nayaka": (-27.4975, 153.0137), "syifa": (-27.4975, 153.0137)}, 1),
            ("Nearby fixes with overlapping accuracy suppress the directional arrow", {
                "nayaka": (-27.4975, 153.0137), "syifa": (-27.49749, 153.01371)}, 20),
        )
        for name, examples, accuracy in cases:
            self.set_demo_pair(examples, accuracy)
            details = []
            for owner in OWNERS:
                state = self.open_find(owner)
                require(state["guidance"].get("metres", math.inf) < accuracy * 2,
                        "Synthetic uncertainty case did not produce overlapping position errors")
                details.append(self.check_direction_quality(owner, state, False, accuracy * 2))
            self.record(name, details)
        # A bad fix must not leave the interface stuck without a usable bearing.
        self.set_demo_pair()
        details = [self.check_direction_quality(owner, self.open_find(owner), True, 2) for owner in OWNERS]
        self.record("Separated accurate fixes restore usable direction and the arrow on both bands", details)

    def verify_location_expiry(self):
        if not self.test_expiry:
            self.record("Location validity expires after the real 60-second lifetime",
                        "Use --test-expiry for the full timed hardware check", "skipped")
            return
        started = self.set_demo_pair()
        for owner in OWNERS:
            self.check_direction_quality(owner, self.open_find(owner), True, 2)
        print("EXPIRY: waiting for the real 60-second lifetime without refreshing either demo fix", flush=True)
        next_progress, expired = 30, False
        states = {}
        while time.monotonic() - started < 70:
            elapsed = time.monotonic() - started
            if elapsed >= next_progress:
                print(f"EXPIRY: {elapsed:.0f}s elapsed; checking freshness and arrow suppression on both bands", flush=True)
                next_progress += 30
            states = {owner: self.status(owner) for owner in OWNERS}
            for owner, state in states.items():
                require(state.get("peerConnected") is True, f"{owner}: link disconnected during location expiry test")
                require(state.get("view") == "find", f"{owner}: Find Direction screen changed during expiry test (view={state.get('view')}, unread={state.get('unread')}, physicalTouchPresses={state.get('touchPresses')}); leave touchscreens untouched")
                if not state.get("location", {}).get("valid") or not state.get("peerLocation", {}).get("valid"):
                    require("guidance" not in state, f"{owner}: stale location still produces guidance")
                    require(state.get("directionArrowVisible") is False, f"{owner}: stale location still displays an arrow")
                    require(state.get('directionLight', {}).get('visible', False) is False, f'{owner}: stale location still glows')
            expired = all(state.get("location", {}).get("valid") is False
                          and state.get("peerLocation", {}).get("valid") is False
                          for state in states.values())
            if expired:
                require(elapsed >= 59, "Locations expired before their expected real 60-second lifetime")
                break
            time.sleep(1)
        require(expired, "Both local and received peer fixes must expire by 60 seconds plus heartbeat latency")
        self.record("All local and peer fixes expire; stale guidance and arrows disappear while radio stays connected", {
            "elapsedSeconds": round(time.monotonic() - started, 2), "locationLifetimeSeconds": 60,
            "owners": [{"owner": owner, "localValid": state["location"]["valid"],
                        "peerValid": state["peerLocation"]["valid"], "guidancePresent": "guidance" in state,
                        "directionArrowVisible": state["directionArrowVisible"], "peerConnected": True}
                       for owner, state in states.items()],
            "simulated": True,
        })

    def finish_direction_checks(self):
        self.clear_locations()
        self.record("Demo coordinates cleared from both bands and no guidance remains")

    def clear_locations(self):
        errors = []
        for owner in OWNERS:
            try:
                self.bridge.command(owner, "clear_location", {})
            except Exception as exc:
                errors.append(f"{owner}: {exc}")
        if errors:
            raise VerificationError("; ".join(errors))
        for owner in OWNERS:
            self.wait_status(owner, lambda state: state.get("location", {}).get("valid") is False
                             and state.get("peerLocation", {}).get("valid") is False
                             and "guidance" not in state, "both locations cleared and direction unavailable")

    def cleanup(self):
        # Restoring presets and clearing demonstration locations are independent;
        # a failure in one must never prevent attempting all other restorations.
        try:
            self.clear_locations()
            self.report["cleanup"].append({"action": "clear simulated locations", "ok": True})
        except Exception as exc:
            self.report["cleanup"].append({"action": "clear simulated locations", "ok": False, "error": str(exc)})
        for owner, messages in self.original_messages.items():
            try:
                self.bridge.command(owner, "presets", {"messages": messages})
                require(self.status(owner).get("messages") == messages, f"{owner}: original preset restore mismatch")
                self.home(owner)
                self.report["cleanup"].append({"action": "restore original presets and home", "owner": owner,
                                               "ok": True, "presetCount": len(messages)})
            except Exception as exc:
                self.report["cleanup"].append({"action": "restore original presets and home", "owner": owner,
                                               "ok": False, "error": str(exc)})

    def run(self):
        try:
            self.verify_identities()
            self.sync_presets()
            self.reset_and_verify_presets()
            self.send_preset("nayaka", "syifa")
            self.send_preset("syifa", "nayaka")
            self.verify_sos()
            self.verify_demo_direction()
            self.verify_direction_uncertainty()
            self.verify_location_expiry()
            self.finish_direction_checks()
            self.report["ok"] = True
        except Exception as exc:
            self.report["failure"] = str(exc)
            print(f"FAILED: {exc}", file=sys.stderr, flush=True)
            traceback.print_exc()
        finally:
            self.cleanup()
            if not all(entry["ok"] for entry in self.report["cleanup"]):
                self.report["ok"] = False
            self.report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        return self.report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", action="append", default=[], help="Explicit serial port; repeat for both devices. Owners are verified by hello, not order.")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--reset-for-persistence", action="store_true", help="Pulse RTS/EN on each band, reverify owner/MAC/uptime, and prove presets survived reset. Close other serial applications first.")
    parser.add_argument("--test-expiry", action="store_true", help="Wait for the real 60-second location TTL, verify both local/peer fixes expire and stale arrows disappear, and print progress every 30 seconds.")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "verification.json", help="JSON verification report; real coordinate values and original preset texts are excluded.")
    args = parser.parse_args(argv)
    band_bridge = BandBridge(ports=args.port, baud=args.baud)
    verifier = PairVerifier(band_bridge, args.reset_for_persistence, args.test_expiry)
    try:
        ports = list(dict.fromkeys(args.port or discover_ports()))
        require(bool(ports), "No serial ports found; connect both bands or specify --port twice")
        for port in ports:
            band_bridge.connect_port(port)
        require(all(band_bridge.snapshot(owner)["connected"] for owner in OWNERS),
                "Both uniquely identified bands must connect; close the bridge/monitor and check flashed owners")
        report = verifier.run()
    except Exception as exc:
        verifier.report["failure"] = str(exc)
        verifier.report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        print(f"FAILED: {exc}", file=sys.stderr)
        report = verifier.report
    finally:
        band_bridge.close()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Verification report: {args.output.resolve()}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
