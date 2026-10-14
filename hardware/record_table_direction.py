#!/usr/bin/env python3
"""Record actual band telemetry for a manual table direction test.

Close the USB bridge before running. This reads measurements only: open Find
Direction on both bands yourself. Move one band at a time, slide it flat and
pause four seconds at each end. Note where the friend is relative to the screen.
No demonstration positions or synthetic sensor readings are supplied.
"""
import argparse
import json
from pathlib import Path
import time

from bridge import BandBridge, OWNERS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=int, default=90)
    parser.add_argument("--output", type=Path, default=Path("hardware/artifacts/table-direction.jsonl"))
    args = parser.parse_args()
    if not 5 <= args.seconds <= 1800:
        parser.error("--seconds must be between 5 and 1800")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bridge = BandBridge()
    bridge.start()
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            with bridge.lock:
                connected = all(owner in bridge.connections for owner in OWNERS)
            if connected:
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("Both bands must be connected by USB")
        cursors = {owner: 0 for owner in OWNERS}
        records = 0
        # Exclusive creation prevents overwriting a previous calibration run.
        with args.output.open("x") as output:
            args.output.chmod(0o600)
            for owner in OWNERS:
                state = bridge.command(owner, "status", {})
                output.write(json.dumps({"kind": "initial", "state": state}) + "\n")
                if state.get("view") != "find":
                    print(f"Open Find Direction on {owner} before sliding it.", flush=True)
            print("Recording. Slide one band flat, stop four seconds, then try another direction.", flush=True)
            deadline = time.monotonic() + args.seconds
            last_probes = {owner: None for owner in OWNERS}
            while time.monotonic() < deadline:
                for owner in OWNERS:
                    for event in bridge.telemetry(owner, cursors[owner]):
                        cursors[owner] = max(cursors[owner], event["sequence"])
                        output.write(json.dumps({"kind": "measurement", "state": event}) + "\n")
                        records += 1
                        probe = event.get("probe", {})
                        motion = event.get("motion", {})
                        summary = {key: probe.get(key) for key in ("probes", "last", "phase", "change", "signalChange", "evidence")}
                        summary["motion"] = {key:motion.get(key) for key in ("state", "x", "y")}
                        bearing = motion.get("bearing", probe.get("bearing"))
                        summary["bearing"] = round(bearing) if isinstance(bearing, (int, float)) else None
                        if summary != last_probes[owner]:
                            print(owner, json.dumps(summary), flush=True)
                            last_probes[owner] = summary
                output.flush()
                time.sleep(0.1)
            print(f"Saved {records} real measurement records to {args.output}", flush=True)
    finally:
        bridge.close()


if __name__ == "__main__":
    main()
