"""Reset controller tests with simulated bands (no USB hardware)."""

import contextlib
import functools
import importlib.util
import io
import json
from pathlib import Path
import threading
import time
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("pulseband_reset", Path(__file__).parents[1] / "reset_bands.py")
reset = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reset)
BRIDGE_SPEC = importlib.util.spec_from_file_location("pulseband_bridge", Path(__file__).parents[1] / "bridge.py")
bridge = importlib.util.module_from_spec(BRIDGE_SPEC)
BRIDGE_SPEC.loader.exec_module(bridge)


class FakeBand:
    """Answers firmware commands the way the table-tracking firmware does."""

    def __init__(self, owner, acknowledge_arrow=True):
        self.owner, self.acknowledge_arrow = owner, acknowledge_arrow
        self.commands, self.replies, self.closed = [], [], False
        self.session = 0

    def reset_input_buffer(self):
        pass

    def write(self, data):
        request = json.loads(data)
        self.commands.append(request)
        reply = {"type": "response", "id": request["id"], "ok": True, "owner": self.owner, "mac": f"mac-{self.owner}",
                 "sensors": {"imu": {"present": True}}, "location": {"valid": False}}
        if request["cmd"] == "motion_start":
            self.session = request["session"]
        if self.session and self.acknowledge_arrow:
            reply["find"] = {"motion": {"active": True, "session": self.session}}
            reply["directionArrowVisible"] = True
        self.replies.append((json.dumps(reply) + "\n").encode())

    def readline(self, _limit=None):
        if self.replies:
            return self.replies.pop(0)
        time.sleep(0.005)  # Like a serial read timeout, so the bridge reader does not spin.
        return b""

    def close(self):
        self.closed = True


def run(bands, **kwargs):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        result = reset.reset_bands(30, open_device=lambda port: bands[port], band_ports={o: o for o in bands},
                                   bridge_check=lambda: False, **kwargs)
    return result, output.getvalue()


class ResetBandsTest(unittest.TestCase):
    def test_reset_seeds_one_shared_session_and_both_arrows(self):
        bands = {"nayaka": FakeBand("nayaka"), "syifa": FakeBand("syifa")}
        ok, output = run(bands)
        self.assertTrue(ok)
        starts = [[c for c in band.commands if c["cmd"] == "motion_start"] for band in bands.values()]
        self.assertEqual([len(s) for s in starts], [1, 1])
        self.assertEqual(starts[0][0]["session"], starts[1][0]["session"])
        self.assertEqual(starts[0][0]["separationMetres"], 0.3)
        for band in bands.values():
            self.assertEqual([c["cmd"] for c in band.commands], ["status", "clear_location", "motion_start", "status"])
            self.assertTrue(all(c["owner"] == band.owner for c in band.commands))
            self.assertTrue(band.closed)
        self.assertIn("Nayaka (yellow ring): arrow reset, pointing right", output)
        self.assertIn("Syifa (purple ring): arrow reset, pointing left", output)

    def test_wrong_band_on_a_port_changes_neither_band(self):
        bands = {"nayaka": FakeBand("syifa"), "syifa": FakeBand("syifa")}
        ok, output = run(bands)
        self.assertFalse(ok)
        self.assertIn("RESET INCOMPLETE", output)
        for band in bands.values():
            self.assertNotIn("clear_location", [c["cmd"] for c in band.commands])
            self.assertNotIn("motion_start", [c["cmd"] for c in band.commands])
            self.assertTrue(band.closed)

    def test_unconfirmed_arrow_is_reported(self):
        bands = {"nayaka": FakeBand("nayaka"), "syifa": FakeBand("syifa", acknowledge_arrow=False)}
        ok, output = run(bands)
        self.assertFalse(ok)
        self.assertIn("Syifa did not confirm the new session and its arrow", output)

    def test_ports_open_without_lowering_dtr_and_rts_first(self):
        # Lowering DTR then RTS before opening rebooted both physical bands.
        with mock.patch.object(reset.serial, "Serial") as serial_class:
            reset.open_band("/dev/cu.test")
        serial_class.assert_called_once_with("/dev/cu.test", baudrate=115200, timeout=0.3,
                                             write_timeout=0.5, exclusive=True)
        self.assertNotIn("dtr", serial_class.return_value.__dict__)


class BridgeResetTest(unittest.TestCase):
    """With the bridge running, R goes through it so phone messages keep working."""

    def start_bridge(self, bands):
        self.bridge = bridge.BandBridge(serial_factory=lambda port, _baud: bands[port], rpc_timeout=1)
        for port in bands:
            self.assertTrue(self.bridge.connect_port(port))
        server = bridge.BridgeHTTPServer(("127.0.0.1", 0), self.bridge)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 1)
        self.addCleanup(self.bridge.close)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}"

    def run_through_bridge(self, url):
        def refuse_usb(port):
            raise AssertionError(f"opened {port}, which the bridge holds")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            ok = reset.reset_bands(30, open_device=refuse_usb, bridge_check=lambda: reset.bridge_running(url),
                                   bridge_call=functools.partial(reset.bridge_rpc, url=url))
        return ok, output.getvalue()

    def test_reset_goes_through_running_bridge_and_keeps_it_connected(self):
        bands = {"nayaka": FakeBand("nayaka"), "syifa": FakeBand("syifa")}
        ok, output = self.run_through_bridge(self.start_bridge(bands))
        self.assertTrue(ok, output)
        self.assertIn("Using the running USB bridge", output)
        starts = [[c for c in band.commands if c["cmd"] == "motion_start"] for band in bands.values()]
        self.assertEqual([len(s) for s in starts], [1, 1])
        self.assertEqual(starts[0][0]["session"], starts[1][0]["session"])
        self.assertEqual(starts[0][0]["separationMetres"], 0.3)
        for band in bands.values():
            self.assertEqual([c["cmd"] for c in band.commands],
                             ["hello", "status", "clear_location", "motion_start", "status"])
            self.assertFalse(band.closed)
        self.assertTrue(all(band["connected"] for band in self.bridge.snapshots()))
        self.assertIn("Nayaka (yellow ring): arrow reset, pointing right", output)
        self.assertIn("Syifa (purple ring): arrow reset, pointing left", output)

    def test_band_missing_from_bridge_changes_neither_band(self):
        bands = {"nayaka": FakeBand("nayaka")}
        ok, output = self.run_through_bridge(self.start_bridge(bands))
        self.assertFalse(ok)
        self.assertIn("RESET INCOMPLETE: Syifa's band is disconnected", output)
        self.assertEqual([c["cmd"] for c in bands["nayaka"].commands], ["hello", "status"])


if __name__ == "__main__":
    unittest.main()
