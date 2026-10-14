#!/usr/bin/env python3
"""Start an experimental shared motion frame on both connected bands.

Before running: put both bands face up, screen tops parallel, Nayaka to the
left of Syifa. Supply their actual centre-to-centre separation. Hold still
while starting. This seeds a known position; it does not measure that position.
Close the USB bridge first. Use --interactive for a laptop R reset control.
"""
import argparse
import json
from pathlib import Path
import secrets
import select
import sys
import time
import termios
import tty

from bridge import BandBridge, OWNERS


def reset_pair(bridge, separation_cm):
    """Seed a single common frame after the user arranges both bands."""
    for owner in OWNERS:
        state = bridge.command(owner, "status", {})
        if state.get("owner") != owner or not state.get("sensors", {}).get("imu", {}).get("present"):
            raise RuntimeError(f"{owner}: missing motion sensor or wrong identity")
    session = secrets.randbelow(0xFFFFFFFF) + 1
    for owner in OWNERS:
        bridge.command(owner, "motion_start", {"session":session, "separationMetres":separation_cm/100})
    states = {owner:bridge.command(owner,"status",{}) for owner in OWNERS}
    for owner,state in states.items():
        motion = state.get("find",{}).get("motion",{})
        if motion.get("session") != session or motion.get("active") is not True or state.get("directionArrowVisible") is not True:
            raise RuntimeError(f"{owner}: reset was not acknowledged; arrange both and press R again")
    return states


def save_states(states, path, reset_count):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as output:
        temporary.chmod(0o600)
        json.dump({"resetCount":reset_count,"observedAt":int(time.time()*1000),"bands":states},output,indent=2)
    temporary.replace(path)


def interactive(bridge, separation_cm, state_file):
    print(f"\nPlace Nayaka LEFT and Syifa RIGHT, {separation_cm:g} cm between screen centres.",flush=True)
    print("Lay both flat, screen tops pointing the same way. Hold still before reset.",flush=True)
    print("Press R here to reset BOTH bands. Press Q to close this controller.",flush=True)
    print("The arrow keeps its last estimate if tracking is lost; R restores the known arrangement.\n",flush=True)
    terminal_settings = termios.tcgetattr(sys.stdin) if sys.stdin.isatty() else None
    reset_count = 0
    next_poll = time.monotonic()
    try:
        if terminal_settings is not None:
            tty.setcbreak(sys.stdin.fileno())
        while True:
            if select.select([sys.stdin],[],[],.1)[0]:
                key=sys.stdin.read(1)
                if not key or key.lower()=="q":
                    break
                if key.lower()=="r":
                    try:
                        states=reset_pair(bridge,separation_cm)
                        reset_count+=1
                        save_states(states,state_file,reset_count)
                        print(f"RESET {reset_count} OK: Nayaka -> right; Syifa -> left. Both arrows visible.",flush=True)
                        next_poll=time.monotonic()+2
                    except Exception as error:
                        print(f"RESET INCOMPLETE: {error}. Check both USB cables and retry R.",flush=True)
            if time.monotonic()>=next_poll:
                states={}
                for owner in OWNERS:
                    try:
                        states[owner]=bridge.command(owner,"status",{})
                    except Exception as error:
                        states[owner]={"owner":owner,"error":str(error)}
                save_states(states,state_file,reset_count)
                next_poll=time.monotonic()+2
    finally:
        if terminal_settings is not None:
            termios.tcsetattr(sys.stdin,termios.TCSADRAIN,terminal_settings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--separation-cm", type=float, required=True)
    parser.add_argument("--interactive", action="store_true",help="Keep a terminal open; R resets both bands after arranging them")
    parser.add_argument("--state-file",type=Path,default=Path(__file__).resolve().parent/"artifacts"/"reset-controller-state.json")
    args = parser.parse_args()
    if not 5 <= args.separation_cm <= 500:
        parser.error("--separation-cm must be 5 to 500")
    bridge = BandBridge()
    bridge.start()
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            with bridge.lock:
                ready = all(owner in bridge.connections for owner in OWNERS)
            if ready:
                break
            time.sleep(.2)
        else:
            raise RuntimeError("Both bands must be connected by USB")
        if args.interactive:
            interactive(bridge,args.separation_cm,args.state_file)
            return
        reset_pair(bridge,args.separation_cm)
        time.sleep(4)
        for owner in OWNERS:
            state = bridge.command(owner, "status", {})
            print(json.dumps({"owner":owner,"find":state.get("find"),"arrowVisible":state.get("directionArrowVisible")}))
        print("Motion estimate started. Slide either band flat, stop briefly, and check both arrows.")
    finally:
        bridge.close()


if __name__ == "__main__":
    main()
