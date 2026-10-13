"""Serial doubles and loopback HTTP tests; these are not physical-board tests."""

import http.client
import importlib.util
import json
from pathlib import Path
import queue
import threading
import time
import unittest

SPEC = importlib.util.spec_from_file_location("pulseband_bridge", Path(__file__).parents[1] / "bridge.py")
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


class FakeSerial:
    def __init__(self, owner, store=None):
        self.owner = owner
        self.store = store if store is not None else {"messages": [], "location": None}
        self.lines = queue.Queue()
        self.closed = False
        self.commands = []
        self.peer = None
        self.respond = True
        self.reject = None
        self.partial = False
        self.fail_write = False
        self.frame = {"width": 240, "height": 240, "encoding": "rgb565-rle",
                      "view": "home", "incoming": "", "unread": False,
                      "pixels": "e1000863"}

    def emit(self, message):
        encoded = (json.dumps(message) + "\n").encode()
        if self.partial:
            self.lines.put(encoded[:len(encoded) // 2])
            self.lines.put(encoded[len(encoded) // 2:])
        else:
            self.lines.put(encoded)

    def state(self):
        return {"mac": "01:02:03:04:05:" + ("06" if self.owner == "nayaka" else "07"),
                "peerConnected": self.peer is not None and not self.peer.closed,
                "presets": self.store["messages"], "messages": self.store["messages"],
                "location": self.store["location"], "view": "home", "incoming": None}

    def write(self, encoded):
        if self.closed or self.fail_write:
            raise OSError("USB unplugged")
        command = json.loads(encoded)
        self.commands.append(command)
        if not self.respond:
            return len(encoded)
        if self.reject:
            self.emit({"type": "response", "id": command["id"], "owner": self.owner,
                       "ok": False, "error": self.reject})
            return len(encoded)
        if command["cmd"] == "frame_snapshot":
            self.emit({"type": "response", "id": command["id"], "ok": True,
                       "owner": self.owner, **self.frame})
            return len(encoded)
        if command["cmd"] == "presets":
            self.store["messages"] = command["messages"]
        elif command["cmd"] == "location":
            self.store["location"] = {key: command[key] for key in ("lat", "lon", "accuracy", "timestamp", "simulated")}
        elif command["cmd"] == "clear_location":
            self.store["location"] = None
        elif command["cmd"] == "send" and self.peer:
            self.peer.emit({"type": "message", "owner": self.peer.owner,
                            "sender": self.owner, "text": command["text"]})
            self.emit({"type": "sent", "owner": self.owner, "text": command["text"], "delivered": True})
        self.emit({"type": "response", "id": command["id"], "ok": True,
                   "owner": self.owner, **self.state()})
        return len(encoded)

    def readline(self, _limit):
        if self.closed:
            raise OSError("USB unplugged")
        try:
            return self.lines.get(timeout=0.02)
        except queue.Empty:
            return b""

    def close(self):
        self.closed = True


def eventually(assertion, timeout=1):
    deadline = time.monotonic() + timeout
    while True:
        try:
            assertion()
            return
        except AssertionError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.01)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.nayaka = FakeSerial("nayaka")
        self.syifa = FakeSerial("syifa")
        self.nayaka.peer, self.syifa.peer = self.syifa, self.nayaka
        self.devices = {"second-port": self.nayaka, "first-port": self.syifa}
        self.bridge = bridge.BandBridge(serial_factory=lambda port, _baud: self.devices[port], rpc_timeout=0.1)

    def tearDown(self):
        self.bridge.close()

    def connect(self):
        self.assertTrue(self.bridge.connect_port("first-port"))
        self.assertTrue(self.bridge.connect_port("second-port"))

    def test_owner_verification_ignores_port_order(self):
        self.connect()
        self.assertEqual(self.bridge.snapshot("nayaka")["port"], "second-port")
        self.assertEqual(self.bridge.snapshot("syifa")["port"], "first-port")
        self.assertTrue(all(status["connected"] for status in self.bridge.snapshots()))

    def test_unknown_or_duplicate_owner_is_refused(self):
        self.connect()
        duplicate = self.devices["third-port"] = FakeSerial("nayaka")
        self.assertFalse(self.bridge.connect_port("third-port"))
        self.assertTrue(duplicate.closed)
        self.assertEqual(self.bridge.snapshot("nayaka")["port"], "second-port")
        unknown = self.devices["unknown"] = FakeSerial("amy")
        self.assertFalse(self.bridge.connect_port("unknown"))
        self.assertTrue(unknown.closed)

    def test_serial_boot_noise_partial_lines_and_malformed_response_are_ignored(self):
        self.nayaka.partial = True
        self.nayaka.lines.put(b"ESP-ROM boot info\n")
        self.nayaka.lines.put(b'{"type":"response","id":[],"ok":true}\n')
        self.assertTrue(self.bridge.connect_port("second-port"))
        self.assertTrue(self.bridge.snapshot("nayaka")["connected"])

    def test_presets_acknowledge_saved_values_and_survive_simulated_reconnect(self):
        self.connect()
        messages = [{"id": "meet", "text": "Meet at the main gate"}]
        result = self.bridge.command("nayaka", "presets", {"messages": messages})
        self.assertEqual(result["band"]["messages"], messages)
        store = self.nayaka.store
        self.bridge.connections["nayaka"].close()
        self.nayaka = self.devices["second-port"] = FakeSerial("nayaka", store)
        self.assertTrue(self.bridge.connect_port("second-port"))
        self.assertEqual(self.bridge.snapshot("nayaka")["messages"], messages)

    def test_two_way_messages_are_recorded_as_device_events(self):
        self.connect()
        for owner, peer, message in (("nayaka", "syifa", "I am here"), ("syifa", "nayaka", "Meet me")):
            self.bridge.command(owner, "send", {"text": message})
            def check():
                received = [event for event in self.bridge.events(peer) if event["type"] == "message"]
                self.assertTrue(any(event["text"] == message and event["sender"] == owner for event in received))
            eventually(check)

    def test_repeated_custom_messages_keep_their_device_sequence_for_phone_popups(self):
        self.connect()
        for sequence in (42, 43):
            self.nayaka.emit({"type": "message", "owner": "nayaka", "from": "syifa", "text": "Meet at gate", "sequence": sequence})
            eventually(lambda: self.assertEqual(self.bridge.snapshot("nayaka").get("incomingSequence"), sequence))
            self.assertEqual(self.bridge.snapshot("nayaka")["incoming"], "Meet at gate")

    def test_status_snapshot_follows_events_and_disconnection(self):
        self.connect()
        self.syifa.emit({"type": "status", "owner": "syifa", "view": "incoming", "incoming": {"text": "Hello"}})
        eventually(lambda: self.assertEqual(self.bridge.snapshot("syifa")["view"], "incoming"))
        self.bridge.connections["syifa"].close()
        self.assertFalse(self.bridge.snapshot("syifa")["connected"])
        self.assertFalse(self.bridge.snapshot("syifa")["peerConnected"])
        with self.assertRaises(bridge.BridgeError) as error:
            self.bridge.command("syifa", "send", {"text": "Hello"})
        self.assertEqual(error.exception.status, 503)

    def test_message_dismissal_and_failed_send_events_preserve_device_state(self):
        self.connect()
        self.syifa.emit({"type": "message", "owner": "syifa", "from": "nayaka", "text": "Hello", "sequence": 123})
        eventually(lambda: self.assertTrue(self.bridge.snapshot("syifa").get("unread")))
        self.assertEqual(self.bridge.snapshot("syifa")["incoming"], "Hello")
        self.assertEqual(self.bridge.events("syifa")[-1]["deviceSequence"], 123)
        self.syifa.emit({"type": "dismissed", "owner": "syifa", "incoming": "", "unread": False, "view": "home"})
        eventually(lambda: self.assertFalse(self.bridge.snapshot("syifa")["unread"]))
        self.syifa.emit({"type": "send_failed", "owner": "syifa", "text": "Hello", "view": "result"})
        eventually(lambda: self.assertEqual(self.bridge.events("syifa")[-1]["type"], "send_failed"))

    def test_rpc_timeout_and_firmware_rejection_do_not_claim_success(self):
        self.connect()
        self.nayaka.respond = False
        with self.assertRaises(bridge.BridgeError) as error:
            self.bridge.command("nayaka", "presets", {"messages": []})
        self.assertEqual(error.exception.status, 504)
        self.nayaka.respond = True
        self.nayaka.reject = "Flash save failed"
        with self.assertRaisesRegex(bridge.BridgeError, "Flash save failed"):
            self.bridge.command("nayaka", "presets", {"messages": []})

    def test_wrong_owner_response_cannot_acknowledge_an_rpc(self):
        self.connect()
        original = self.nayaka.emit
        self.nayaka.emit = lambda message: original({**message, "owner": "syifa"})
        with self.assertRaises(bridge.BridgeError) as error:
            self.bridge.command("nayaka", "status", {})
        self.assertEqual(error.exception.status, 504)

    def test_usb_write_failure_immediately_disconnects_band(self):
        self.connect()
        self.nayaka.fail_write = True
        with self.assertRaisesRegex(bridge.BridgeError, "USB write failed"):
            self.bridge.command("nayaka", "status", {})
        self.assertFalse(self.bridge.snapshot("nayaka")["connected"])

    def test_real_phone_locations_and_clear_command(self):
        self.connect()
        command, payload = bridge.validate_command("location", {"lat": -27.497, "lon": 153.013, "accuracy": 8,
                                                                "timestamp": 1791432000000, "simulated": False})
        result = self.bridge.command("nayaka", command, payload)
        self.assertEqual(result["band"]["location"], payload)
        command, payload = bridge.validate_command("clear-location", {})
        self.assertIsNone(self.bridge.command("nayaka", command, payload)["band"]["location"])

    def test_cleared_or_stale_status_removes_previous_guidance_from_cache(self):
        self.connect()
        self.nayaka.emit({"type": "status", "owner": "nayaka", "location": {"valid": True},
                          "peerLocation": {"valid": True}, "guidance": {"bearing": 42, "metres": 149}})
        eventually(lambda: self.assertIn("guidance", self.bridge.snapshot("nayaka")))
        self.nayaka.emit({"type": "status", "owner": "nayaka", "location": {"valid": False},
                          "peerLocation": {"valid": False}})
        eventually(lambda: self.assertNotIn("guidance", self.bridge.snapshot("nayaka")))

    def test_status_without_measurements_removes_cached_range_and_proximity(self):
        self.connect()
        self.nayaka.emit({"type": "status", "owner": "nayaka", "location": {"valid": False},
                          "range": {"valid": True, "metres": 0.4}, "proximity": {"active": True, "beepIntervalMillis": 170},
                          "find": {"mode": "distance"}})
        eventually(lambda: self.assertIn("range", self.bridge.snapshot("nayaka")))
        # Firmware without a current measurement block must not inherit the old one.
        self.nayaka.emit({"type": "status", "owner": "nayaka", "location": {"valid": False}})
        def cleared():
            snapshot = self.bridge.snapshot("nayaka")
            for field in ("range", "proximity", "find"):
                self.assertNotIn(field, snapshot)
        eventually(cleared)

    def test_snapshot_reports_when_the_last_full_status_arrived(self):
        self.connect()
        before = int(time.time() * 1000)
        self.nayaka.emit({"type": "status", "owner": "nayaka", "location": {"valid": False}})
        eventually(lambda: self.assertGreaterEqual(self.bridge.snapshot("nayaka").get("statusReceivedAt", 0), before))
        stamp = self.bridge.snapshot("nayaka")["statusReceivedAt"]
        time.sleep(0.01)
        # Partial events do not make an old measurement look fresh.
        self.nayaka.emit({"type": "dismissed", "owner": "nayaka", "unread": False})
        eventually(lambda: self.assertIs(self.bridge.snapshot("nayaka").get("unread"), False))
        self.assertEqual(self.bridge.snapshot("nayaka")["statusReceivedAt"], stamp)

    def test_range_telemetry_is_timestamped_and_kept_out_of_message_history(self):
        self.connect()
        self.syifa.emit({"type": "message", "owner": "syifa", "from": "nayaka", "text": "Hello", "sequence": 7})
        eventually(lambda: self.assertEqual(len(self.bridge.events("syifa")), 1))
        for index in range(250):
            self.syifa.emit({"type": "range", "owner": "syifa", "t": index, "valid": True, "metres": 0.4})
        eventually(lambda: self.assertEqual([sample["t"] for sample in self.bridge.telemetry("syifa")][-1:], [249]))
        # Frequent ranging samples cannot evict the latest message popup event.
        self.assertEqual([event["type"] for event in self.bridge.events("syifa")], ["message"])
        samples = self.bridge.telemetry("syifa")
        self.assertTrue(all(sample["type"] == "range" and "receivedAt" in sample for sample in samples))
        self.assertLessEqual(len(samples), bridge.TELEMETRY_LIMIT)
        self.assertEqual(self.bridge.telemetry("syifa", samples[-2]["sequence"]), samples[-1:])
        self.assertEqual(self.bridge.telemetry("nayaka"), [])
        # Range samples do not overwrite the band's full status snapshot.
        self.assertNotIn("metres", self.bridge.snapshot("syifa"))

    def test_background_reconnect_recovers_disconnected_owner(self):
        self.connect()
        self.bridge.connections["nayaka"].close()
        replacement = self.devices["second-port"] = FakeSerial("nayaka")
        self.bridge.port_discovery = lambda: list(self.devices)
        self.bridge.start()
        eventually(lambda: self.assertTrue(self.bridge.snapshot("nayaka")["connected"]))
        self.assertIs(self.bridge.connections["nayaka"].device, replacement)

    def test_history_is_bounded_and_supports_sequence_cursor(self):
        self.connect()
        for index in range(120):
            self.syifa.emit({"type": "message", "owner": "syifa", "sender": "nayaka", "text": str(index)})
        def received_all():
            events = self.bridge.events("syifa")
            self.assertTrue(events)
            self.assertEqual(events[-1]["text"], "119")
        eventually(received_all)
        history = self.bridge.events("syifa")
        self.assertEqual(len(history), 100)
        self.assertEqual(len(self.bridge.events("syifa", history[-3]["sequence"])), 2)


class ValidationTests(unittest.TestCase):
    def test_empty_presets_supported(self):
        self.assertEqual(bridge.validate_command("presets", {"messages": []}), ("presets", {"messages": []}))

    def test_rejects_unsupported_presets(self):
        invalid = [None, {"messages": "hello"}, {"messages": [{}]},
                   {"messages": [{"id": "a", "text": "hello"}] * 9},
                   {"messages": [{"id": "a", "text": "hello"}, {"id": "a", "text": "again"}]},
                   {"messages": [{"id": "a", "text": "é"}]},
                   {"messages": [{"id": "a", "text": "Hello\nthere"}]},
                   {"messages": [{"id": "a", "text": "x" * 41}]},
                   {"messages": [{"id": "i" * 33, "text": "hello"}]}]
        for body in invalid:
            with self.subTest(body=body), self.assertRaises(bridge.BridgeError):
                bridge.validate_command("presets", body)

    def test_rejects_fake_or_invalid_locations(self):
        valid = {"lat": -27.5, "lon": 153.0, "accuracy": 10, "timestamp": 1791432000000, "simulated": False}
        for modification in ({"lat": True}, {"lon": 181}, {"accuracy": -1}, {"lat": float("nan")},
                             {"timestamp": "now"}, {"simulated": True}, {"simulated": 0}):
            with self.subTest(modification=modification), self.assertRaises(bridge.BridgeError):
                bridge.validate_command("location", {**valid, **modification})
        missing = dict(valid)
        del missing["simulated"]
        with self.assertRaises(bridge.BridgeError):
            bridge.validate_command("location", missing)


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.device = FakeSerial("nayaka")
        self.bridge = bridge.BandBridge(serial_factory=lambda _port, _baud: self.device, rpc_timeout=0.1)
        self.bridge.connect_port("verified")
        self.server = bridge.BridgeHTTPServer(("127.0.0.1", 0), self.bridge)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.bridge.close()
        self.thread.join(timeout=1)

    def request(self, method, path, body=None, origin=None, raw=None, extra_headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        headers = dict(extra_headers or {})
        if origin:
            headers["Origin"] = origin
        if body is not None or raw is not None:
            headers.setdefault("Content-Type", "application/json")
        content = raw if raw is not None else json.dumps(body) if body is not None else None
        connection.request(method, path, body=content, headers=headers)
        response = connection.getresponse()
        result = response.read()
        status, returned_headers = response.status, dict(response.getheaders())
        connection.close()
        return status, json.loads(result) if result else None, returned_headers

    def test_bands_always_include_both_owners(self):
        status, result, _ = self.request("GET", "/api/bands")
        self.assertEqual(status, 200)
        self.assertEqual([band["owner"] for band in result["bands"]], ["nayaka", "syifa"])
        self.assertTrue(result["bands"][0]["connected"])
        self.assertFalse(result["bands"][1]["connected"])

    def test_cors_accepts_known_origin_and_refuses_other_origins(self):
        status, _, headers = self.request("OPTIONS", "/api/bands", origin="http://localhost:8081")
        self.assertEqual(status, 204)
        self.assertEqual(headers["Access-Control-Allow-Origin"], "http://localhost:8081")
        status, _, headers = self.request("POST", "/api/bands/nayaka/presets", {"messages": []}, origin="https://untrusted.example")
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertEqual(len(self.device.commands), 1)  # hello only; rejected origin never writes.

    def test_production_origin_is_allowed_by_default_including_private_network_preflight(self):
        origin = "https://pulseband-steel.vercel.app"
        status, _, headers = self.request("OPTIONS", "/api/bands/nayaka/frame", origin=origin,
                                          extra_headers={"Access-Control-Request-Method": "GET",
                                                         "Access-Control-Request-Private-Network": "true"})
        self.assertEqual(status, 204)
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        self.assertEqual(headers["Access-Control-Allow-Private-Network"], "true")
        self.assertEqual(headers["Vary"], "Origin")
        status, _, headers = self.request("GET", "/api/bands", origin=origin)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        status, result, headers = self.request("POST", "/api/bands/nayaka/status", {}, origin=origin)
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)

    def test_production_origin_match_is_exact_and_other_sites_cannot_capture_frames(self):
        for origin in ("http://pulseband-steel.vercel.app", "https://other-project.vercel.app",
                       "https://pulseband-steel.vercel.app.untrusted.example"):
            with self.subTest(origin=origin):
                status, result, headers = self.request("GET", "/api/bands/nayaka/frame", origin=origin)
                self.assertEqual(status, 403)
                self.assertFalse(result["ok"])
                self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertEqual(len(self.device.commands), 1)  # hello only.

    def test_frame_get_reuses_verified_connection_and_preserves_current_band_state(self):
        before = self.bridge.snapshot("nayaka")
        stored = json.loads(json.dumps(self.device.store))
        self.device.frame.update(view="find", pixels="0001ffffe0ff0863")
        status, result, headers = self.request("GET", "/api/bands/nayaka/frame",
                                               origin="https://pulseband-steel.vercel.app")
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["owner"], "nayaka")
        for field in ("width", "height", "encoding", "view", "pixels"):
            self.assertEqual(result[field], self.device.frame[field])
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.device.commands[-1]["cmd"], "frame_snapshot")
        self.assertEqual(set(self.device.commands[-1]), {"id", "cmd"})
        self.assertIs(self.bridge.connections["nayaka"].device, self.device)
        self.assertFalse(self.device.closed)
        self.assertEqual(self.device.store, stored)
        self.assertEqual(self.bridge.snapshot("nayaka"), before)
        self.assertNotIn("pixels", result["band"])

    def test_frame_get_handles_a_large_atomic_frame_without_truncation(self):
        pixels = "0001ffff00010863" * 2500 + f"{240*240-5000:04x}0863"
        self.assertGreater(len(pixels), 16384)
        self.device.frame["pixels"] = pixels
        status, result, _ = self.request("GET", "/api/bands/nayaka/frame")
        self.assertEqual(status, 200)
        self.assertEqual(result["pixels"], pixels)

    def test_frame_errors_do_not_return_a_cached_image_or_claim_success(self):
        status, result, _ = self.request("GET", "/api/bands/syifa/frame")
        self.assertEqual(status, 503)
        self.assertNotIn("pixels", result)
        self.device.reject = "Frame is too complex for serial capture"
        status, result, _ = self.request("GET", "/api/bands/nayaka/frame")
        self.assertEqual(status, 502)
        self.assertIn("too complex", result["error"])
        self.assertNotIn("pixels", result)
        self.device.reject = None
        self.device.respond = False
        status, result, _ = self.request("GET", "/api/bands/nayaka/frame")
        self.assertEqual(status, 504)
        self.assertFalse(result["ok"])
        self.assertNotIn("pixels", result)

    def test_frame_route_accepts_only_the_read_only_get_for_a_known_owner(self):
        for method, path, body in (("GET", "/api/bands/amy/frame", None),
                                   ("GET", "/api/bands/nayaka/frame/extra", None),
                                   ("POST", "/api/bands/nayaka/frame", {})):
            with self.subTest(method=method, path=path):
                status, result, _ = self.request(method, path, body)
                self.assertEqual(status, 404)
                self.assertFalse(result["ok"])
        self.assertEqual(len(self.device.commands), 1)  # routing rejects before USB writes.

    def test_save_empty_presets_reports_confirmed_band_state(self):
        status, result, _ = self.request("POST", "/api/bands/nayaka/presets", {"messages": []})
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["band"]["messages"], [])

    def test_status_readback_uses_fresh_firmware_reply_instead_of_cached_presets(self):
        messages = [{"id": "changed", "text": "Changed on another phone"}]
        self.device.store["messages"] = messages
        self.assertEqual(self.bridge.snapshot("nayaka")["messages"], [])
        status, result, _ = self.request("POST", "/api/bands/nayaka/status", {})
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result["owner"], "nayaka")
        self.assertEqual(result["messages"], messages)
        self.assertEqual(self.device.commands[-1]["cmd"], "status")
        self.assertEqual(self.bridge.snapshot("nayaka")["messages"], messages)

    def test_json_and_unknown_endpoint_errors_are_precise(self):
        for path, raw, expected in (("/api/bands/nayaka/presets", "{bad", 400),
                                    ("/api/bands/nayaka/location", '{"lat":NaN}', 400),
                                    ("/api/bands/amy/send", '{}', 404),
                                    ("/api/bands/nayaka/unknown", '{}', 404),
                                    ("/api/bands/nayaka/control", '{"button":"wrong"}', 400)):
            with self.subTest(path=path, raw=raw):
                status, result, _ = self.request("POST", path, raw=raw)
                self.assertEqual(status, expected)
                self.assertFalse(result["ok"])

    def test_disconnected_and_acknowledgement_timeout_are_not_successful(self):
        status, _, _ = self.request("POST", "/api/bands/syifa/send", {"text": "Hello"})
        self.assertEqual(status, 503)
        self.device.respond = False
        status, result, _ = self.request("POST", "/api/bands/nayaka/send", {"text": "Hello"})
        self.assertEqual(status, 504)
        self.assertIn("acknowledge", result["error"])

    def test_telemetry_endpoint_reads_range_samples_with_a_cursor(self):
        self.device.emit({"type": "range", "owner": "nayaka", "t": 1, "valid": True, "metres": 0.4})
        self.device.emit({"type": "range", "owner": "nayaka", "t": 2, "valid": False, "state": "stale"})
        eventually(lambda: self.assertEqual(len(self.bridge.telemetry("nayaka")), 2))
        status, result, headers = self.request("GET", "/api/bands/nayaka/telemetry?after=0")
        self.assertEqual(status, 200)
        self.assertEqual([sample["t"] for sample in result["samples"]], [1, 2])
        self.assertEqual(headers["Cache-Control"], "no-store")
        after = result["samples"][0]["sequence"]
        status, result, _ = self.request("GET", f"/api/bands/nayaka/telemetry?after={after}")
        self.assertEqual([sample["state"] for sample in result["samples"]], ["stale"])
        status, _, _ = self.request("GET", "/api/bands/nayaka/telemetry?after=-1")
        self.assertEqual(status, 400)
        self.assertEqual(len(self.device.commands), 1)  # read-only: hello only.

    def test_events_cursor_and_location_status(self):
        self.device.emit({"type": "message", "owner": "nayaka", "sender": "syifa", "text": "Meet me"})
        eventually(lambda: self.assertEqual(len(self.bridge.events("nayaka")), 1))
        status, result, _ = self.request("GET", "/api/bands/nayaka/events?after=0")
        self.assertEqual(status, 200)
        self.assertEqual(result["events"][0]["text"], "Meet me")
        status, _, _ = self.request("GET", "/api/bands/nayaka/events?after=no")
        self.assertEqual(status, 400)
        self.assertEqual(self.request("GET", "/api/bands/nayaka")[1]["owner"], "nayaka")


if __name__ == "__main__":
    unittest.main()
