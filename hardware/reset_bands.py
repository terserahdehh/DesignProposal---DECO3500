"""Reset both bands' Find Direction arrows to the known table arrangement.

R clears phone coordinates and starts one shared motion session on both bands
(the firmware's `motion_start`), so Nayaka's arrow points right at Syifa and
Syifa's points left at Nayaka. It seeds that known arrangement; it does not
measure it. Saved messages are kept. If the USB bridge is running, it holds the
USB ports, so the reset goes through it and the phone page stays connected.
"""

import argparse
import configparser
import json
from pathlib import Path
import secrets
import sys
import termios
import time
import tty
import urllib.error
import urllib.request

import serial

OWNERS = ("nayaka", "syifa")
BANDS = {"nayaka": "yellow ring, screen says FIND Syifa", "syifa": "purple ring, screen says FIND Nayaka"}
ARROWS = {"nayaka": "right", "syifa": "left"}
BRIDGE_URL = "http://127.0.0.1:8787"
BRIDGE_ACTIONS = {"status": "status", "clear_location": "clear-location", "motion_start": "motion-start"}


def ports():
    config = configparser.ConfigParser(interpolation=None)
    config.read(Path(__file__).with_name("platformio.ini"))
    return {owner: config[f"env:{owner}"]["upload_port"] for owner in OWNERS}


def open_band(port):
    # Open like bridge.py does. Setting DTR and RTS low before opening passes
    # through the auto-reset state on these boards and reboots the band,
    # which wipes the motion session this reset is meant to start.
    return serial.Serial(port, baudrate=115200, timeout=0.3, write_timeout=0.5, exclusive=True)


def rpc(device, owner, cmd, payload=None, timeout=12):
    """Send one firmware command, retrying while the band becomes ready."""
    request_id = f"{cmd}-{owner}-{time.monotonic_ns()}"
    request = {"id": request_id, "owner": owner, "cmd": cmd, **(payload or {})}
    device.reset_input_buffer()
    next_send = 0
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if time.monotonic() >= next_send:
            device.write((json.dumps(request) + "\n").encode())
            next_send = time.monotonic() + 1
        try:
            reply = json.loads(device.readline())
        except (ValueError, UnicodeDecodeError):
            continue
        if isinstance(reply, dict) and reply.get("type") == "response" and reply.get("id") == request_id:
            if reply.get("ok") is not True:
                raise RuntimeError(reply.get("error") or f"{cmd} was rejected")
            return reply
    raise RuntimeError(f"no reply to {cmd} within {timeout} seconds")


def bridge_running(url=BRIDGE_URL):
    try:
        with urllib.request.urlopen(f"{url}/api/bands", timeout=1):
            return True
    except (urllib.error.URLError, OSError):
        return False


def bridge_rpc(owner, cmd, payload=None, url=BRIDGE_URL):
    """Send one firmware command through the running bridge's USB connection."""
    request = urllib.request.Request(f"{url}/api/bands/{owner}/{BRIDGE_ACTIONS[cmd]}",
                                     data=json.dumps(payload or {}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            message = json.load(error).get("error")
        except (ValueError, AttributeError):
            message = None
        finally:
            error.close()
        raise RuntimeError(message or f"the bridge refused {cmd} (HTTP {error.code})") from error
    except (urllib.error.URLError, OSError) as error:
        raise RuntimeError(f"cannot reach the USB bridge ({error})") from error


def reset_bands(separation_cm=30, open_device=open_band, band_ports=None, bridge_check=bridge_running,
                bridge_call=bridge_rpc):
    """Seed both bands; returns True only if both show their arrows."""
    devices = {}
    try:
        if bridge_check():
            # The bridge holds the USB ports; going through it keeps the phone
            # page connected for messages.
            print("  Using the running USB bridge.")
            call = bridge_call
        else:
            band_ports = band_ports or ports()
            for owner in OWNERS:
                try:
                    devices[owner] = open_device(band_ports[owner])
                except (serial.SerialException, OSError) as error:
                    raise RuntimeError(f"cannot open {owner.title()}'s USB port ({error}); "
                                       "check its cable and close any serial monitor") from error

            def call(owner, cmd, payload=None):
                return rpc(devices[owner], owner, cmd, payload)
        # Check both before changing either, so a wrong cable changes nothing.
        for owner in OWNERS:
            state = call(owner, "status")
            if state.get("owner") != owner:
                raise RuntimeError(f"the band on {owner.title()}'s port reports owner {state.get('owner')!r}")
            if not state.get("sensors", {}).get("imu", {}).get("present"):
                raise RuntimeError(f"{owner.title()}'s motion sensor is missing")
        for owner in OWNERS:
            state = call(owner, "clear_location")
            if state.get("location", {}).get("valid") is not False:
                raise RuntimeError(f"{owner.title()} did not confirm clearing its coordinates")
        session = secrets.randbelow(0xFFFFFFFF) + 1
        for owner in OWNERS:
            call(owner, "motion_start", {"session": session, "separationMetres": separation_cm / 100})
        for owner in OWNERS:
            state = call(owner, "status")
            motion = state.get("find", {}).get("motion", {})
            if motion.get("session") != session or motion.get("active") is not True or state.get("directionArrowVisible") is not True:
                raise RuntimeError(f"{owner.title()} did not confirm the new session and its arrow")
        for owner in OWNERS:
            print(f"  {owner.title()} ({BANDS[owner].split(',')[0]}): arrow reset, pointing {ARROWS[owner]}.")
        return True
    except RuntimeError as error:
        print(f"  RESET INCOMPLETE: {error}. Fix that and press R again.")
        return False
    finally:
        for device in devices.values():
            device.close()


def instructions(separation_cm):
    print("PulseBand arrow reset. Saved messages are kept.")
    print(f"1. Put Nayaka's band ({BANDS['nayaka']}) on the LEFT and Syifa's band ({BANDS['syifa']}) on the RIGHT,")
    print(f"   {separation_cm:g} cm between screen centres (about one laptop width).")
    print("2. Lay both flat, text upright, screen tops pointing the same way. Hands off.")
    print("3. Press R. Press Q to quit. (The USB bridge can stay running.)")


def read_key():
    settings = termios.tcgetattr(sys.stdin)
    try:
        tty.setcbreak(sys.stdin.fileno())
        return sys.stdin.read(1).lower()
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, settings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Reset both bands once and exit")
    parser.add_argument("--separation-cm", type=float, default=30, help="Distance between screen centres (5-500)")
    args = parser.parse_args()
    if not 5 <= args.separation_cm <= 500:
        parser.error("--separation-cm must be 5 to 500")
    if args.once:
        return 0 if reset_bands(args.separation_cm) else 1
    if not sys.stdin.isatty():
        parser.error("Interactive mode needs a terminal; use --once to reset once.")
    instructions(args.separation_cm)
    while True:
        key = read_key()
        if key == "q":
            return 0
        if key == "r":
            print("Resetting both bands...", flush=True)
            reset_bands(args.separation_cm)
            print("Press R to reset again after rearranging. Press Q to quit.", flush=True)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nClosed.")
