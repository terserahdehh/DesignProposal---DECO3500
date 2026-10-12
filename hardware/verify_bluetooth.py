#!/usr/bin/env python3
"""Verify the two physical PulseBands using Bluetooth only; never open USB serial.

Close browser Bluetooth connections before running. Original presets are restored
in finally. Messages and control commands exercise the real bands and their
encrypted ESP-NOW link. No coordinates are submitted or written to the report.
On macOS the Python host must already have Bluetooth access in System Settings.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
import uuid

from bleak import BleakClient, BleakScanner


SERVICE_UUID = "b97b0001-7a62-4f1a-9b9c-0b13e9de3500"
SIGNAL_UUID = "b97b0002-7a62-4f1a-9b9c-0b13e9de3500"
CONFIG_UUID = "b97b0003-7a62-4f1a-9b9c-0b13e9de3500"
EXPECTED = {
    "nayaka": {"name": "PulseBand-Nayaka", "mac": "8C:FD:49:9B:E7:40", "peer": "syifa"},
    "syifa": {"name": "PulseBand-Syifa", "mac": "8C:FD:49:9B:EE:84", "peer": "nayaka"},
}


class VerificationError(Exception):
    pass


def require(condition, description):
    if not condition:
        raise VerificationError(description)


def safe_state(state):
    """Keep positions and user preset/message text out of failure reports."""
    return {key: state.get(key) for key in ("owner", "view", "peerConnected", "unread", "result")}


def problem_description(exc):
    description = f"{type(exc).__name__}: {exc}"
    lowered = description.lower()
    if any(word in lowered for word in ("not authorized", "not authorised", "unauthorized", "permission", "not permitted")):
        description += "; Bluetooth access was denied to the Python/terminal host. Check System Settings > Privacy & Security > Bluetooth for that host, then rerun. No permission setting was changed."
    elif any(word in lowered for word in ("powered off", "bluetooth is off", "not powered")):
        description += "; the Mac Bluetooth adapter is off."
    return description


async def discover_bands(timeout):
    discovered = await BleakScanner.discover(timeout=timeout, return_adv=True)
    matches = {}
    for device, advertisement in discovered.values():
        name = advertisement.local_name or device.name
        owner = next((owner for owner, expected in EXPECTED.items() if name == expected["name"]), None)
        if owner is None:
            continue
        advertised_services = {value.lower() for value in advertisement.service_uuids}
        if SERVICE_UUID not in advertised_services:
            continue
        require(owner not in matches, f"Multiple devices advertise {name}; identity is ambiguous")
        matches[owner] = device
    return matches


def collect_corebluetooth_disconnects(devices, events):
    """Observe the NSError Bleak drops for unsolicited macOS disconnects.

    This is local, read-only diagnostics against Bleak 3's Python delegate; it
    changes no OS settings or Bluetooth permissions and is restored in finally.
    Other peripherals' events are deliberately excluded.
    """
    if sys.platform != "darwin":
        return lambda: None
    delegates = {}
    for owner, device in devices.items():
        try:
            peripheral, delegate = device.details
            identifier = str(peripheral.identifier())
        except (AttributeError, TypeError, ValueError):
            continue
        delegates.setdefault(id(delegate), (delegate, {}))[1][identifier] = owner
    originals = []
    for delegate, owners in delegates.values():
        original = delegate.did_disconnect_peripheral

        def observer(central, peripheral, error, original=original, owners=owners):
            owner = owners.get(str(peripheral.identifier()))
            if owner is not None:
                detail = {"owner": owner, "occurredAt": datetime.now(timezone.utc).isoformat()}
                if error is None:
                    detail["error"] = None
                else:
                    detail.update(domain=str(error.domain()), code=int(error.code()),
                                  description=str(error.localizedDescription()))
                events.append(detail)
            return original(central, peripheral, error)

        delegate.did_disconnect_peripheral = observer
        originals.append((delegate, original))

    def restore():
        for delegate, original in originals:
            delegate.did_disconnect_peripheral = original
    return restore


class BandClient:
    def __init__(self, owner, device, timeout):
        self.owner, self.device, self.timeout = owner, device, timeout
        self.client = BleakClient(device, timeout=timeout, disconnected_callback=self._disconnected)
        self.buffer = bytearray()
        self.pending = {}
        self.rpc_lock = asyncio.Lock()
        self.state = {}
        self.events = []
        self.signals = []
        self.changed = asyncio.Event()
        self.counter = 0
        self.verified = False
        self.protocol_error = None
        self.protocol_metadata = None
        self.config_characteristic = None
        self.signal_characteristic = None
        self.phase = "idle"
        self.last_rpc = None
        self.received_line = False
        self.legacy_notifications = False

    def _disconnected(self, _client):
        self.changed.set()
        for future in list(self.pending.values()):
            if not future.done():
                future.set_exception(VerificationError(f"{self.owner}: Bluetooth disconnected before reply"))

    def _config_notification(self, _characteristic, data):
        self.buffer.extend(data)
        if len(self.buffer) > 20000:
            self.protocol_error = "Bluetooth JSON notification exceeded buffer limit"
            self.buffer.clear()
            self.changed.set()
            return
        while b"\n" in self.buffer:
            encoded, _, remaining = self.buffer.partition(b"\n")
            self.buffer[:] = remaining
            if not encoded.strip():
                continue
            try:
                message = json.loads(encoded.decode("utf-8"))
                if not isinstance(message, dict):
                    raise ValueError("notification must be a JSON object")
            except (ValueError, UnicodeDecodeError) as exc:
                # Subscription can begin halfway through the firmware's ongoing
                # status stream. Ignore that first incomplete line only; it can
                # never ACK a request. Subsequent malformed lines are failures.
                if not self.received_line:
                    self.received_line = True
                    continue
                self.protocol_error = "Malformed Bluetooth JSON notification"
                self.protocol_metadata = {"wireBytes": len(encoded), "errorOffset": getattr(exc, "pos", None),
                                          "errorType": type(exc).__name__, "sha256": hashlib.sha256(encoded).hexdigest()}
                self.changed.set()
                continue
            self.received_line = True
            self.counter += 1
            if message.get("type") == "status" or (message.get("type") == "response" and "mac" in message):
                self.state = message
            if message.get("type") == "response":
                request_id = message.get("id")
                future = self.pending.get(request_id) if isinstance(request_id, str) else None
                if future is not None and not future.done():
                    future.set_result(message)
            elif message.get("type") != "status":
                self.events.append((self.counter, message))
                self.events[:] = self.events[-100:]
            self.changed.set()

    def _signal_notification(self, _characteristic, data):
        self.counter += 1
        self.signals.append((self.counter, bytes(data)))
        self.signals[:] = self.signals[-100:]
        self.changed.set()

    async def connect(self):
        self.buffer.clear()
        self.received_line = False
        self.protocol_error = None
        self.protocol_metadata = None
        self.legacy_notifications = False
        self.phase = "BLE connection"
        print(f"Connecting {self.owner.title()} over BLE...", flush=True)
        await self.client.connect()
        self.phase = "GATT service validation"
        service = self.client.services.get_service(SERVICE_UUID)
        require(service is not None, f"{self.owner}: PulseBand GATT service is missing")
        self.config_characteristic = service.get_characteristic(CONFIG_UUID)
        self.signal_characteristic = service.get_characteristic(SIGNAL_UUID)
        require(self.config_characteristic is not None, f"{self.owner}: configuration characteristic is missing")
        require(self.signal_characteristic is not None, f"{self.owner}: legacy signal characteristic is missing")
        for name, characteristic in (("configuration", self.config_characteristic), ("legacy signal", self.signal_characteristic)):
            require("write" in characteristic.properties and "notify" in characteristic.properties,
                    f"{self.owner}: {name} characteristic must support write and notify")
        self.phase = "configuration notification subscription"
        await self.client.start_notify(self.config_characteristic, self._config_notification)
        self.phase = "hello RPC"
        hello = await self.rpc("hello")
        expected = EXPECTED[self.owner]
        require(hello.get("owner") == self.owner, f"{self.owner}: hello returned wrong owner")
        require(str(hello.get("mac", "")).upper() == expected["mac"], f"{self.owner}: hello MAC does not match the configured physical band")
        require(hello.get("peer") == expected["peer"], f"{self.owner}: hello returned wrong paired owner")
        self.verified = True
        self.phase = "verified"
        return hello

    async def enable_legacy_notifications(self):
        if not self.legacy_notifications:
            self.phase = "legacy notification subscription"
            await self.client.start_notify(self.signal_characteristic, self._signal_notification)
            self.legacy_notifications = True

    async def rpc(self, cmd, **fields):
        # Only a response with this unpredictable ID completes an RPC. Periodic
        # status, legacy notifications and another request's reply cannot ACK it.
        async with self.rpc_lock:
            require(self.client.is_connected, f"{self.owner}: Bluetooth is disconnected")
            request_id = uuid.uuid4().hex
            future = asyncio.get_running_loop().create_future()
            self.pending[request_id] = future
            request = {"id": request_id, "owner": self.owner, "cmd": cmd, **fields}
            encoded = (json.dumps(request, ensure_ascii=True, separators=(",", ":")) + "\n").encode("ascii")
            require(len(encoded) <= 2049, f"{self.owner}: command exceeds the firmware line buffer")
            self.last_rpc = {"cmd": cmd, "wireBytes": len(encoded), "chunksWritten": 0}
            try:
                for offset in range(0, len(encoded), 20):
                    self.phase = f"{cmd} write chunk {offset // 20 + 1}/{(len(encoded) + 19) // 20}"
                    await self.client.write_gatt_char(self.config_characteristic, encoded[offset:offset + 20], response=True)
                    self.last_rpc["chunksWritten"] += 1
                self.phase = f"{cmd} reply notification"
                reply = await asyncio.wait_for(future, timeout=self.timeout)
                require(reply.get("owner") == self.owner, f"{self.owner}: reply returned wrong owner")
                require(reply.get("ok") is True, f"{self.owner}: {cmd} rejected: {reply.get('error', 'missing positive acknowledgement')}")
                return reply
            except asyncio.TimeoutError as exc:
                raise VerificationError(f"{self.owner}: {cmd} received no correlated Bluetooth reply within {self.timeout:g}s") from exc
            finally:
                self.pending.pop(request_id, None)
                # A disconnect during a write can fail the pending reply before
                # it is awaited. Retrieve that exception to avoid orphan warnings.
                if future.done() and not future.cancelled():
                    future.exception()
                elif not future.done():
                    future.cancel()

    async def wait_for(self, predicate, description, timeout=None):
        deadline = time.monotonic() + (timeout or self.timeout)
        while True:
            self.changed.clear()
            if self.protocol_error:
                raise VerificationError(f"{self.owner}: {self.protocol_error}")
            require(self.client.is_connected, f"{self.owner}: Bluetooth disconnected while waiting for {description}")
            result = predicate()
            if result:
                return result
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise VerificationError(f"{self.owner}: timed out waiting for {description}; state={safe_state(self.state)}")
            try:
                await asyncio.wait_for(self.changed.wait(), timeout=remaining)
            except asyncio.TimeoutError as exc:
                raise VerificationError(f"{self.owner}: timed out waiting for {description}; state={safe_state(self.state)}") from exc

    async def wait_state(self, predicate, description):
        return await self.wait_for(lambda: self.state if predicate(self.state) else None, description)

    async def wait_event(self, after, event_type, text, sequence=None):
        def match():
            for counter, event in self.events:
                if counter <= after:
                    continue
                if event.get("type") == "send_failed":
                    raise VerificationError(f"{self.owner}: firmware reported delivery unconfirmed")
                if event.get("type") == event_type and event.get("text") == text:
                    if sequence is None or event.get("sequence") == sequence:
                        return event
            return None
        return await self.wait_for(match, f"real {event_type} event for current verification message")

    async def home(self):
        for _ in range(24):
            state = await self.rpc("status")
            if state.get("unread"):
                await self.rpc("control", button="ok")
            elif state.get("view") == "home":
                return state
            elif state.get("view") in ("sos", "confirm"):
                await self.rpc("control", button="back")
            elif state.get("view") == "menu":
                await self.rpc("control", button="ok" if state.get("menuIndex") == 0 else "back")
            else:
                await self.rpc("control", button="ok")
        raise VerificationError(f"{self.owner}: could not return home without sending a preset")


class PairVerifier:
    def __init__(self, clients, legacy_signal):
        self.clients, self.legacy_signal = clients, legacy_signal
        self.original_messages = {}
        self.changed_presets = set()
        self.report = {
            "startedAt": datetime.now(timezone.utc).isoformat(), "ok": False,
            "scope": {
                "transport": "physical Bluetooth GATT and encrypted ESP-NOW between both bands",
                "physicalFingerTouchTested": False,
                "display": "firmware pop-up and on-screen notification indicator state",
                "positionsSubmitted": False, "gpsOrWearerRelativeBearingTested": False,
                "presetPersistenceAcrossResetTested": False,
            },
            "devices": [], "checks": [], "cleanup": [],
        }

    def record(self, name, details=None, outcome="passed"):
        entry = {"name": name, "outcome": outcome}
        if details is not None:
            entry["details"] = details
        self.report["checks"].append(entry)
        print(f"{outcome.upper()}: {name}", flush=True)

    async def identify(self):
        # Capture each original list immediately; a failure connecting the second
        # band must not cause the first band's original presets to be lost.
        for owner, band in self.clients.items():
            hello = await band.connect()
            require(hello.get("radioReady") is True, f"{owner}: ESP-NOW radio is not ready")
            messages = hello.get("messages")
            require(isinstance(messages, list), f"{owner}: hello did not return stored presets")
            self.original_messages[owner] = json.loads(json.dumps(messages))
            self.report["devices"].append({
                "owner": owner, "advertisedName": EXPECTED[owner]["name"], "mac": hello["mac"],
                "model": hello.get("model"), "touchControllerDetected": hello.get("touchAvailable"),
                "originalPresetCount": len(messages), "configurationWriteAndNotify": True,
                "legacySignalWriteAndNotify": True,
            })
        await asyncio.gather(*(band.wait_state(lambda state: state.get("peerConnected") is True,
                                                "paired ESP-NOW heartbeat while both BLE clients are connected")
                               for band in self.clients.values()))
        self.record("Both BLE names, GATT service, owner/MAC pairs and radio heartbeats verified")

    async def presets(self):
        for owner, band in self.clients.items():
            title = owner.title()
            messages = [
                {"id": f"ble-{owner}-1", "text": f"{title} BLE check"},
                {"id": f"ble-{owner}-2", "text": "Meet me at Gate 2"},
                {"id": f"ble-{owner}-3", "text": "I'm Safe"},
                {"id": f"ble-{owner}-4", "text": 'Sign says "North" - wait here'},
                {"id": f"ble-{owner}-5", "text": "Check slash \\ and apostrophe '"},
                {"id": f"ble-{owner}-6", "text": "Taking a Break"},
                {"id": f"ble-{owner}-7", "text": "40 character boundary: " + "x" * 17},
                {"id": f"ble-{owner}-8", "text": "Going Home"},
            ]
            require(len(messages[6]["text"]) == 40, "Internal boundary-test text length is incorrect")
            self.changed_presets.add(owner)
            reply = await band.rpc("presets", messages=messages)
            require(reply.get("messages") == messages, f"{owner}: full eight-message acknowledgement differs from saved data")
            readback = await band.rpc("status")
            require(readback.get("messages") == messages and readback.get("presetCount") == 8,
                    f"{owner}: saved presets readback failed")
            self.record(f"{title}: eight presets saved and read back through fragmented BLE JSON", {
                "presetCount": 8, "longestTextLength": 40, "quotesAndBackslashPreserved": True,
                "nvsSaveAcknowledged": True,
            })

    async def delivery(self, sender, receiver, legacy=False):
        source, target = self.clients[sender], self.clients[receiver]
        await source.home()
        await target.home()
        sender_cursor, receiver_cursor = source.counter, target.counter
        text = "I'm Safe" if legacy else f"{sender.title()} Bluetooth delivery check"
        sequence = None
        if legacy:
            await target.enable_legacy_notifications()
            await source.client.write_gatt_char(source.signal_characteristic, b"\x01", response=True)
        else:
            queued = await source.rpc("send", text=text)
            require(queued.get("queued") is True and isinstance(queued.get("sequence"), int)
                    and queued["sequence"] > 0, f"{sender}: send was not queued with a real sequence")
            sequence = queued["sequence"]
        received, sent = await asyncio.gather(
            target.wait_event(receiver_cursor, "message", text, sequence),
            source.wait_event(sender_cursor, "sent", text),
        )
        require(received.get("from") == sender, f"{receiver}: message arrived from the wrong owner")
        expected_led = "purple" if sender == "nayaka" else "yellow"
        state = await target.wait_state(lambda item: item.get("unread") is True
                                        and item.get("view") == "incoming" and item.get("incoming") == text,
                                        "incoming pop-up for this message")
        require(state.get("notificationLed") == expected_led, f"{receiver}: wrong on-screen notification colour")
        await source.wait_state(lambda item: item.get("result") == "Received by band", "application ACK display")
        if legacy:
            await target.wait_for(lambda: any(counter > receiver_cursor and value == b"\x01"
                                             for counter, value in target.signals),
                                  "legacy code-1 receive notification")
        dismissed = await target.rpc("control", button="ok")
        require(dismissed.get("unread") is False and dismissed.get("incoming") == ""
                and dismissed.get("notificationLed") == "off", f"{receiver}: dismissal did not clear pop-up and indicator")
        await source.home()
        await target.home()
        self.record(f"{sender.title()} -> {receiver.title()}: {'legacy signal' if legacy else 'BLE-config message'} delivered", {
            "messageSequence": received.get("sequence"), "popUp": True, "notificationLed": expected_led,
            "applicationAckEvent": sent.get("type") == "sent", "dismissed": True,
            "legacyByteNotification": legacy,
        })

    async def cleanup(self):
        for owner, band in self.clients.items():
            if not band.verified:
                continue
            # A lost write ACK can still leave mutated NVS. Always restore when
            # a save was attempted, including if the earlier test disconnected.
            if not band.client.is_connected:
                try:
                    await band.connect()
                except Exception as exc:
                    self.report["cleanup"].append({"owner": owner, "action": "reconnect verified band", "ok": False,
                                                   "error": problem_description(exc)})
                    continue
            if owner in self.changed_presets:
                try:
                    messages = self.original_messages[owner]
                    restored = await band.rpc("presets", messages=messages)
                    require(restored.get("messages") == messages, f"{owner}: restoration acknowledgement mismatch")
                    require((await band.rpc("status")).get("messages") == messages, f"{owner}: restored presets readback differs")
                    self.report["cleanup"].append({"owner": owner, "action": "restore original presets", "ok": True,
                                                   "presetCount": len(messages)})
                except Exception as exc:
                    self.report["cleanup"].append({"owner": owner, "action": "restore original presets", "ok": False,
                                                   "error": problem_description(exc)})
            try:
                cleared = await band.rpc("clear_location")
                require(cleared.get("location", {}).get("valid") is False, f"{owner}: position did not clear")
                await band.home()
                self.report["cleanup"].append({"owner": owner, "action": "clear location and return home", "ok": True})
            except Exception as exc:
                self.report["cleanup"].append({"owner": owner, "action": "clear location and return home", "ok": False,
                                               "error": problem_description(exc)})
        for owner, band in self.clients.items():
            if band.verified and band.client.is_connected:
                try:
                    # Use fresh, correlated replies: a prior protocol fault is
                    # already reported but must not falsely label restoration
                    # failed when cleanup can still reach and verify the band.
                    deadline = time.monotonic() + band.timeout
                    while True:
                        state = await band.rpc("status")
                        if (state.get("location", {}).get("valid") is False
                                and state.get("peerLocation", {}).get("valid") is False and "guidance" not in state):
                            break
                        require(time.monotonic() < deadline, f"{owner}: locations or guidance remain after cleanup")
                        await asyncio.sleep(0.1)
                    self.report["cleanup"].append({"owner": owner, "action": "verify locations cleared", "ok": True})
                except Exception as exc:
                    self.report["cleanup"].append({"owner": owner, "action": "verify locations cleared", "ok": False,
                                                   "error": problem_description(exc)})

    async def run(self):
        try:
            await self.identify()
            await self.presets()
            await self.delivery("nayaka", "syifa")
            await self.delivery("syifa", "nayaka")
            if self.legacy_signal:
                await self.delivery("nayaka", "syifa", legacy=True)
            else:
                self.record("Legacy one-byte send compatibility", "Pass --legacy-signal to test code 1 (I'm Safe)", "skipped")
            self.report["ok"] = True
        except Exception as exc:
            self.report["failure"] = problem_description(exc)
            self.report["connectionPhases"] = {owner: band.phase for owner, band in self.clients.items()}
            self.report["lastRequests"] = {owner: band.last_rpc for owner, band in self.clients.items()}
            self.report["protocolFaults"] = {owner: band.protocol_metadata for owner, band in self.clients.items()
                                            if band.protocol_metadata is not None}
            print(f"FAILED: {self.report['failure']}", file=sys.stderr, flush=True)
        finally:
            await self.cleanup()
            if any(not entry["ok"] for entry in self.report["cleanup"]):
                self.report["ok"] = False
            self.report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        return self.report


async def execute(args):
    report = {"startedAt": datetime.now(timezone.utc).isoformat(), "ok": False, "scanOnly": args.scan_only,
              "devices": [], "checks": [], "cleanup": []}
    clients = {}
    disconnects = []
    restore_diagnostics = lambda: None
    try:
        print(f"Scanning Bluetooth for the two exact PulseBand names and service ({args.scan_timeout:g}s)...", flush=True)
        devices = await discover_bands(args.scan_timeout)
        report["devices"] = [{"owner": owner, "advertisedName": EXPECTED[owner]["name"], "serviceAdvertised": True}
                             for owner in devices]
        require(set(devices) == set(EXPECTED), "Both PulseBand-Nayaka and PulseBand-Syifa must advertise the PulseBand service; close browser BLE connections and confirm both boards have booted")
        if args.scan_only:
            report["ok"] = True
            report["checks"].append({"name": "Both exact names and PulseBand service advertised", "outcome": "passed"})
        else:
            restore_diagnostics = collect_corebluetooth_disconnects(devices, disconnects)
            clients = {owner: BandClient(owner, devices[owner], args.timeout) for owner in EXPECTED}
            report = await PairVerifier(clients, args.legacy_signal).run()
            report["advertisements"] = [{"owner": owner, "name": EXPECTED[owner]["name"], "serviceAdvertised": True}
                                        for owner in devices]
    except Exception as exc:
        report["failure"] = problem_description(exc)
        print(f"FAILED: {report['failure']}", file=sys.stderr, flush=True)
    finally:
        for owner, band in clients.items():
            try:
                if band.client.is_connected:
                    await band.client.disconnect()
            except Exception as exc:
                report["cleanup"].append({"owner": owner, "action": "disconnect BLE", "ok": False,
                                          "error": problem_description(exc)})
                report["ok"] = False
        restore_diagnostics()
        if disconnects:
            report["coreBluetoothDisconnects"] = disconnects
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scan-only", action="store_true", help="Only discover exact advertised names/service; make no connection or writes")
    parser.add_argument("--scan-timeout", type=float, default=8, help="BLE scan duration in seconds (default: 8)")
    parser.add_argument("--timeout", type=float, default=15, help="Connection/RPC/event timeout in seconds (default: 15)")
    parser.add_argument("--legacy-signal", action="store_true", help="Also test legacy characteristic code 1 (I'm Safe); never send SOS")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "bluetooth-verification.json",
                        help="Report path; no position values or original preset texts are recorded")
    args = parser.parse_args(argv)
    if args.scan_timeout <= 0 or args.timeout <= 0:
        parser.error("timeouts must be positive")
    try:
        report = asyncio.run(execute(args))
    except KeyboardInterrupt:
        report = {"ok": False, "failure": "Bluetooth verification interrupted; review cleanup before rerunning",
                  "finishedAt": datetime.now(timezone.utc).isoformat()}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Verification report: {args.output.resolve()}", flush=True)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
