#!/usr/bin/env python3
"""Local USB API for PulseBand firmware. Never assigns owners by port order.

Run `python hardware/bridge.py --help` for configuration. The API binds only to
127.0.0.1 unless --host is explicitly supplied. Firmware communication uses
newline-delimited JSON, with correlated responses and asynchronous events.
"""

from __future__ import annotations

import argparse
from collections import deque
import glob
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import math
import threading
import time
from typing import Any, Callable
from urllib.parse import urlparse
import uuid


OWNERS = ("nayaka", "syifa")
DEFAULT_ORIGINS = frozenset(
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (3000, 5173, 8081, 19006)
)
MAX_BODY_BYTES = 16384
MAX_LINE_BYTES = 65536  # Includes optional USB framebuffer snapshots.
LOG = logging.getLogger("pulseband.bridge")


class BridgeError(Exception):
    def __init__(self, message: str, status: int = 503):
        super().__init__(message)
        self.status = status


class Pending:
    def __init__(self):
        self.ready = threading.Event()
        self.response: dict[str, Any] | None = None
        self.error: str | None = None


class SerialConnection:
    """One serial reader and serialized RPCs; only hello verifies identity."""

    def __init__(self, port: str, device: Any, callback: Callable):
        self.port = port
        self.device = device
        self.callback = callback
        self.owner: str | None = None
        self.state: dict[str, Any] = {}
        self.lock = threading.RLock()
        self.request_lock = threading.Lock()
        self.pending: dict[str, Pending] = {}
        self.closed = False
        self.reader = threading.Thread(target=self._read, name=f"serial:{port}", daemon=True)
        self.reader.start()

    def _read(self):
        buffer = bytearray()
        try:
            while not self.closed:
                # A finite timeout is set when opening the serial port. readline
                # may return a partial line on that timeout; retain it until LF.
                chunk = self.device.readline(MAX_LINE_BYTES + 1)
                if not chunk:
                    continue
                buffer.extend(chunk)
                if len(buffer) > MAX_LINE_BYTES and b"\n" not in buffer:
                    raise BridgeError("Firmware sent an oversized serial line")
                while b"\n" in buffer:
                    line, _, remainder = buffer.partition(b"\n")
                    buffer = bytearray(remainder)
                    if len(line) > MAX_LINE_BYTES:
                        raise BridgeError("Firmware sent an oversized serial line")
                    try:
                        message = json.loads(line, parse_constant=_invalid_constant)
                    except (ValueError, UnicodeDecodeError):
                        # ESP32 boot diagnostics can share the USB serial port.
                        continue
                    if not isinstance(message, dict):
                        continue
                    self._accept(message)
        except Exception as exc:
            if not self.closed:
                LOG.warning("%s disconnected: %s", self.port, exc)
        finally:
            self.close()

    def _accept(self, message: dict[str, Any]):
        if self.owner is not None and message.get("owner") != self.owner:
            # Do not accept events or responses claiming a different wearer.
            return
        if message.get("type") == "response":
            if not isinstance(message.get("id"), str):
                return
            with self.lock:
                pending = self.pending.get(message.get("id"))
                if pending is not None:
                    pending.response = message
                    pending.ready.set()
            return
        if self.owner is not None and message.get("type") in ("status", "message", "sent", "send_failed", "dismissed"):
            self.callback(self, message)

    def rpc(self, command: str, payload: dict[str, Any] | None = None, timeout: float = 5):
        timeout = min(max(float(timeout), 0.01), 5)
        # Queue time also counts toward the maximum five-second request budget.
        started = time.monotonic()
        if not self.request_lock.acquire(timeout=timeout):
            raise BridgeError("Band is busy; retry the request", 504)
        request_id = uuid.uuid4().hex
        pending = Pending()
        try:
            with self.lock:
                if self.closed:
                    raise BridgeError("Band is disconnected")
                self.pending[request_id] = pending
            request = {"id": request_id, "cmd": command, **(payload or {})}
            encoded = (json.dumps(request, allow_nan=False, separators=(",", ":")) + "\n").encode()
            remaining = timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise BridgeError("Band is busy; retry the request", 504)
            try:
                self.device.write_timeout = min(0.5, remaining)
                self.device.write(encoded)
            except Exception as exc:
                self.close()
                raise BridgeError(f"USB write failed: {exc}") from exc
            remaining = max(0, timeout - (time.monotonic() - started))
            if not pending.ready.wait(remaining):
                raise BridgeError("Band did not acknowledge the request within five seconds", 504)
            if pending.error:
                raise BridgeError(pending.error)
            response = pending.response
            if response is None or response.get("ok") is not True:
                error = (response or {}).get("error", "Firmware rejected the request")
                raise BridgeError(str(error), 502)
            return response
        finally:
            with self.lock:
                self.pending.pop(request_id, None)
            self.request_lock.release()

    def close(self):
        with self.lock:
            if self.closed:
                return
            self.closed = True
            for pending in self.pending.values():
                pending.error = "Band disconnected before acknowledging the request"
                pending.ready.set()
        try:
            self.device.close()
        except Exception:
            pass


def _invalid_constant(value: str):
    raise ValueError(f"Invalid JSON number: {value}")


def discover_ports() -> list[str]:
    # Prefer macOS call-out names; never open both cu.* and tty.* for one device.
    patterns = ("/dev/cu.usbmodem*", "/dev/cu.usbserial*")
    ports = sorted({p for pattern in patterns for p in glob.glob(pattern)})
    if ports:
        return ports
    return sorted({p for pattern in ("/dev/ttyACM*", "/dev/ttyUSB*") for p in glob.glob(pattern)})


def open_serial(port: str, baud: int):
    import serial
    return serial.Serial(port, baudrate=baud, timeout=0.2, write_timeout=0.5)


class BandBridge:
    def __init__(self, ports=None, baud=115200, serial_factory=open_serial,
                 port_discovery=discover_ports, rpc_timeout=5):
        self.explicit_ports = list(dict.fromkeys(ports or []))
        self.baud = baud
        self.serial_factory = serial_factory
        self.port_discovery = port_discovery
        self.rpc_timeout = min(max(float(rpc_timeout), 0.01), 5)
        self.lock = threading.RLock()
        self.connections: dict[str, SerialConnection] = {}
        self.history = {owner: deque(maxlen=100) for owner in OWNERS}
        self.last_state: dict[str, dict[str, Any]] = {owner: {} for owner in OWNERS}
        self.stop = threading.Event()
        self.thread: threading.Thread | None = None
        self.event_sequence = 0

    def _event(self, connection: SerialConnection, message: dict[str, Any]):
        with self.lock:
            if self.connections.get(connection.owner) is not connection:
                return
            self.event_sequence += 1
            event = {**message, "sequence": self.event_sequence, "receivedAt": int(time.time() * 1000)}
            if "sequence" in message:
                event["deviceSequence"] = message["sequence"]
            self.history[connection.owner].append(event)
            if message.get("type") == "status":
                self._save_state(connection.owner, message)
            else:
                for field in ("view", "incoming", "unread", "result", "notificationLed"):
                    if field in message:
                        self.last_state[connection.owner][field] = message[field]
                if message.get("type") == "message":
                    self.last_state[connection.owner].update(
                        incoming=message.get("incoming", message.get("text", "")), unread=True, view="incoming",
                        incomingSequence=message.get("sequence", 0))

    def _save_state(self, owner: str, message: dict[str, Any]):
        state = {k: v for k, v in message.items()
                 if k not in ("type", "id", "ok", "owner", "port", "connected")}
        self.last_state[owner].update(state)
        if ("location" in message or "peerLocation" in message) and "guidance" not in message:
            # Full firmware status omits guidance when either position is stale
            # or cleared. Do not retain a former valid bearing in the cache.
            self.last_state[owner].pop("guidance", None)

    def connect_port(self, port: str) -> bool:
        """Return true only after hello verifies a unique owner and MAC."""
        with self.lock:
            if any(c.port == port and not c.closed for c in self.connections.values()):
                return True
        connection = None
        try:
            device = self.serial_factory(port, self.baud)
            connection = SerialConnection(port, device, self._event)
            response = connection.rpc("hello", timeout=self.rpc_timeout)
            owner = response.get("owner")
            mac = response.get("mac")
            if owner not in OWNERS or not isinstance(mac, str) or not mac.strip():
                raise BridgeError("Hello must identify Nayaka or Syifa and provide the device MAC")
            with self.lock:
                existing = self.connections.get(owner)
                if existing is not None and not existing.closed:
                    raise BridgeError(f"Duplicate owner {owner}; refusing second port {port}")
                connection.owner = owner
                self.connections[owner] = connection
                self._save_state(owner, response)
            LOG.info("Verified %s on %s (%s)", owner, port, mac)
            return True
        except Exception as exc:
            LOG.warning("Cannot verify %s: %s", port, exc)
            if connection:
                connection.close()
            return False

    def start(self):
        if self.thread is not None:
            return
        self.thread = threading.Thread(target=self._reconnect, name="band-discovery", daemon=True)
        self.thread.start()

    def _reconnect(self):
        while not self.stop.is_set():
            try:
                ports = self.explicit_ports or self.port_discovery()
                for port in ports:
                    if self.stop.is_set():
                        break
                    self.connect_port(port)
            except Exception as exc:
                LOG.warning("Serial discovery failed: %s", exc)
            self.stop.wait(2)

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=6)
        with self.lock:
            connections = list(self.connections.values())
        for connection in connections:
            connection.close()

    def snapshot(self, owner: str):
        with self.lock:
            connection = self.connections.get(owner)
            connected = connection is not None and not connection.closed
            state = {**self.last_state[owner], "owner": owner, "connected": connected,
                     "port": connection.port if connection is not None else None}
            if not connected:
                state["peerConnected"] = False
            return state

    def snapshots(self):
        return [self.snapshot(owner) for owner in OWNERS]

    def events(self, owner: str, after: int = 0):
        with self.lock:
            return [dict(event) for event in self.history[owner] if event["sequence"] > after]

    def command(self, owner: str, command: str, payload: dict[str, Any]):
        with self.lock:
            connection = self.connections.get(owner)
            if connection is None or connection.closed:
                raise BridgeError(f"{owner.title()}'s band is disconnected")
        response = connection.rpc(command, payload, self.rpc_timeout)
        with self.lock:
            if command not in ("frame_row", "frame_snapshot"):
                self._save_state(owner, response)
        return {**response, "band": self.snapshot(owner)}


def _ascii_string(value: Any, field: str, maximum: int):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise BridgeError(f"{field} must contain 1–{maximum} characters", 400)
    if any(ord(char) < 32 or ord(char) > 126 for char in value):
        raise BridgeError(f"{field} must use printable ASCII characters supported by the band", 400)
    return value


def validate_command(action: str, body: Any):
    if not isinstance(body, dict):
        raise BridgeError("Request body must be a JSON object", 400)
    if action == "status":
        if body:
            raise BridgeError("Status requests must contain an empty object", 400)
        return "status", {}
    if action == "presets":
        messages = body.get("messages")
        if not isinstance(messages, list) or len(messages) > 8:
            raise BridgeError("messages must be an array containing at most eight presets", 400)
        result, ids = [], set()
        for message in messages:
            if not isinstance(message, dict):
                raise BridgeError("Each preset must be an object with id and text", 400)
            identifier = _ascii_string(message.get("id"), "Preset id", 32)
            if identifier in ids:
                raise BridgeError("Preset ids must be unique", 400)
            ids.add(identifier)
            result.append({"id": identifier, "text": _ascii_string(message.get("text"), "Preset text", 40)})
        return "presets", {"messages": result}
    if action == "location":
        result = {}
        for field, lower, upper in (("lat", -90, 90), ("lon", -180, 180), ("accuracy", 0, None)):
            value = body.get(field)
            try:
                finite = not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
            except OverflowError:
                finite = False
            if not finite:
                raise BridgeError(f"{field} must be a finite number", 400)
            if value < lower or (upper is not None and value > upper):
                raise BridgeError(f"{field} is outside the supported range", 400)
            result[field] = value
        stamp = body.get("timestamp")
        if isinstance(stamp, bool) or not isinstance(stamp, int) or stamp <= 0:
            raise BridgeError("timestamp must be a positive integer in milliseconds", 400)
        if body.get("simulated") is not False:
            raise BridgeError("Phone locations must explicitly set simulated:false", 400)
        return "location", {**result, "timestamp": stamp, "simulated": False}
    if action == "send":
        return "send", {"text": _ascii_string(body.get("text"), "Message text", 40)}
    if action == "control":
        button = body.get("button")
        if button not in ("back", "next", "ok", "sos"):
            raise BridgeError("button must be back, next, ok, or sos", 400)
        return "control", {"button": button}
    if action == "clear-location":
        return "clear_location", {}
    raise BridgeError("Unknown API endpoint", 404)


class BridgeHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, bridge: BandBridge, allowed_origins=DEFAULT_ORIGINS):
        self.bridge = bridge
        self.allowed_origins = frozenset(allowed_origins)
        super().__init__(address, BridgeHandler)


class BridgeHandler(BaseHTTPRequestHandler):
    server: BridgeHTTPServer
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        LOG.info("HTTP %s", fmt % args)

    def _allowed(self):
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.allowed_origins:
            self._respond(403, {"ok": False, "error": "Origin is not allowed by this local bridge"})
            return False
        return True

    def _respond(self, status: int, body: Any = None):
        encoded = b"" if body is None else json.dumps(body, allow_nan=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        if status >= 400:
            self.send_header("Connection", "close")
            self.close_connection = True
        origin = self.headers.get("Origin")
        if origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # Chromium may preflight access from a public page to a loopback service.
        if origin in self.server.allowed_origins and self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        if encoded:
            self.wfile.write(encoded)

    def do_OPTIONS(self):
        if self._allowed():
            self._respond(204)

    def _route(self):
        parsed = urlparse(self.path)
        parts = parsed.path.rstrip("/").split("/")
        if parts[:3] != ["", "api", "bands"] or len(parts) > 5:
            raise BridgeError("Unknown API endpoint", 404)
        owner = parts[3] if len(parts) >= 4 else None
        action = parts[4] if len(parts) == 5 else None
        if owner is not None and owner not in OWNERS:
            raise BridgeError("Band owner must be nayaka or syifa", 404)
        return owner, action, parsed.query

    def do_GET(self):
        if not self._allowed():
            return
        try:
            owner, action, query = self._route()
            if owner is None:
                self._respond(200, {"ok": True, "bands": self.server.bridge.snapshots(), "transport": "usb", "locationSource": "phone"})
            elif action is None:
                self._respond(200, self.server.bridge.snapshot(owner))
            elif action == "events":
                from urllib.parse import parse_qs
                try:
                    after = int(parse_qs(query).get("after", ["0"])[0])
                    if after < 0:
                        raise ValueError()
                except ValueError:
                    raise BridgeError("after must be a non-negative event sequence", 400)
                self._respond(200, {"owner": owner, "events": self.server.bridge.events(owner, after)})
            else:
                raise BridgeError("Unknown API endpoint", 404)
        except BridgeError as exc:
            self._respond(exc.status, {"ok": False, "error": str(exc)})

    def do_POST(self):
        if not self._allowed():
            return
        try:
            owner, action, _ = self._route()
            if owner is None or action is None:
                raise BridgeError("Unknown API endpoint", 404)
            if self.headers.get_content_type() != "application/json":
                raise BridgeError("Content-Type must be application/json", 415)
            try:
                size = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                raise BridgeError("Invalid Content-Length", 400)
            if size < 0:
                raise BridgeError("Content-Length is required", 411)
            if size > MAX_BODY_BYTES:
                raise BridgeError("Request body is too large", 413)
            try:
                body = json.loads(self.rfile.read(size), parse_constant=_invalid_constant)
            except (ValueError, UnicodeDecodeError):
                raise BridgeError("Request body contains invalid JSON", 400)
            command, payload = validate_command(action, body)
            response = self.server.bridge.command(owner, command, payload)
            self._respond(200, response)
        except BridgeError as exc:
            self._respond(exc.status, {"ok": False, "error": str(exc)})


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1). Explicitly use a LAN address for phone access; there is no authentication.")
    parser.add_argument("--http-port", type=int, default=8787, help="HTTP port (default: 8787)")
    parser.add_argument("--port", action="append", default=[], help="USB serial port; repeat for both bands. Otherwise discover USB modem/serial ports.")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument("--allow-origin", action="append", default=[], help="Additional exact browser origin, e.g. http://192.168.1.10:8081. Known localhost development origins are already allowed.")
    args = parser.parse_args(argv)
    try:
        import serial  # noqa: F401
    except ImportError:
        parser.error("pyserial is missing; install hardware/requirements.txt in your Python virtual environment")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    origins = set(DEFAULT_ORIGINS)
    origins.update(f"http://{host}:{args.http_port}" for host in ("localhost", "127.0.0.1"))
    for origin in args.allow_origin:
        parsed = urlparse(origin)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
            parser.error("--allow-origin must be an exact http(s) origin with no path")
        origins.add(origin)
    bridge = BandBridge(ports=args.port, baud=args.baud)
    server = BridgeHTTPServer((args.host, args.http_port), bridge, origins)
    bridge.start()
    LOG.info("USB bridge listening on http://%s:%s (owners verified by firmware hello)", args.host, args.http_port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        bridge.close()


if __name__ == "__main__":
    main()
