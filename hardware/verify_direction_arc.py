#!/usr/bin/env python3
"""Verify actual direction-ring status and framebuffer pixels on both bands.

Uses explicitly labelled demo coordinates. Restores presets, clears locations and
returns both watches home. Close serial clients and leave touchscreens untouched.
"""
import argparse
import json
import math
from pathlib import Path
from bridge import BandBridge, OWNERS
from verify_pair import PairVerifier, require
from verify_display import decode_pixels


def ring_pixels(snapshot, bearing, colour):
    pixels = decode_pixels(snapshot)
    samples, outside = [], 0
    for index, value in enumerate(pixels):
        x, y = index % 240 - 120, 120 - index // 240
        radius = math.hypot(x, y)
        if not 110 <= radius <= 116:
            continue
        r, g, b = ((value >> 11) & 31) / 31, ((value >> 5) & 63) / 63, (value & 31) / 31
        saturated = (r - b > .06 and g - b > .06) if colour == 'yellow' else (b - g > .06 and r - g > .025)
        if not saturated:
            continue
        angle = math.degrees(math.atan2(x, y)) % 360
        delta = abs((angle - bearing + 180) % 360 - 180)
        if delta > 47:
            outside += 1
        samples.append(max(r, g, b))
    require(len(samples) > 350, 'Directional outline has too few coloured pixels')
    require(outside == 0, 'Directional colour leaked outside the quarter circle')
    return {'colouredPixels': len(samples), 'outsideQuarter': outside, 'averageBrightness': sum(samples) / len(samples)}


def arrow_pixels(snapshot, colour):
    """Inspect the actual enlarged triangle, excluding coloured labels/ring."""
    pixels = decode_pixels(snapshot)
    points = [(x, y) for y in range(118, 165) for x in range(92, 149)
              if pixels[y * 240 + x] == colour]
    require(len(points) > 400, 'Central direction arrow did not enlarge')
    xs, ys = zip(*points)
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    require(abs((bounds[0] + bounds[2]) / 2 - 120) <= 3
            and abs((bounds[1] + bounds[3]) / 2 - 141) <= 3,
            'Direction arrow is not centered in the LCD panel')
    spans = sorted([bounds[2] - bounds[0], bounds[3] - bounds[1]])
    require(spans[0] >= 22 and spans[1] >= 38, 'Arrow is smaller than 24 x 40 pixels')
    return {'colouredPixels': len(points), 'bounds': bounds, 'centered': True}


def run(bridge):
    verifier = PairVerifier(bridge)
    report = {'ok': False, 'scope': 'real USB, ESP-NOW, firmware status and framebuffer; labelled demo positions', 'checks': []}
    try:
        verifier.verify_identities()
        readings = {}
        for case, positions in [
            ('east-far', {'nayaka': (0, 0), 'syifa': (0, .001)}),
            ('east-near', {'nayaka': (0, 0), 'syifa': (0, .0001)}),
            ('north', {'nayaka': (0, 0), 'syifa': (.001, 0)}),
        ]:
            verifier.set_demo_pair(positions, accuracy=.5)
            for owner in OWNERS:
                state = verifier.open_find(owner)
                light = state.get('directionLight', {})
                colour = 'yellow' if owner == 'nayaka' else 'purple'
                require(light.get('visible') is True and light.get('colour') == colour, 'Wrong or missing friend arc colour')
                require(light.get('spanDegrees') == 90 and light.get('northReferenced') is True, 'Ring must be a north-up quarter circle')
                expected = (0 if owner == 'nayaka' else 180) if case == 'north' else (90 if owner == 'nayaka' else 270)
                require(abs((light['bearing'] - expected + 180) % 360 - 180) < 1, 'Arc did not follow the peer position')
                snapshot = bridge.command(owner, 'frame_snapshot', {})
                require(snapshot.get('view') == 'find', 'Screen changed during capture; leave touchscreens untouched')
                pixels = ring_pixels(snapshot, light['bearing'], colour)
                arrow = arrow_pixels(snapshot, 0xFEA2 if colour == 'yellow' else 0xA2BE)
                readings[case, owner] = {'owner': owner, 'colour': colour, 'bearing': light['bearing'], 'brightness': light['brightness'], 'arrow': arrow, **pixels}
                report['checks'].append({'case': case, **readings[case, owner]})
                print(f'PASS: {owner} {case}: {colour} quarter arc, {pixels["colouredPixels"]} coloured pixels', flush=True)
        for owner in OWNERS:
            require(readings['east-near', owner]['brightness'] > readings['east-far', owner]['brightness'], 'Nearer position did not brighten status')
            require(readings['east-near', owner]['averageBrightness'] > readings['east-far', owner]['averageBrightness'], 'Nearer position did not brighten actual pixels')
        verifier.set_demo_pair({'nayaka': (0, 0), 'syifa': (0, 0)}, accuracy=1)
        for owner in OWNERS:
            require(verifier.open_find(owner)['directionLight']['visible'] is False, 'Uncertain direction still glows')
        verifier.clear_locations()
        for owner in OWNERS:
            require(verifier.status(owner)['directionLight']['visible'] is False, 'Cleared direction still glows')
        report['checks'].append({'case': 'both owners brighter when closer; uncertain and cleared locations hide arcs', 'ok': True})
        report['ok'] = True
    except Exception as exc:
        report['error'] = str(exc)
        print(f'FAIL: {exc}', flush=True)
    finally:
        verifier.cleanup()
        report['cleanup'] = verifier.report['cleanup']
        report['ok'] = report['ok'] and all(item['ok'] for item in report['cleanup'])
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'artifacts/direction-arc-live.json')
    args = parser.parse_args()
    bridge = BandBridge()
    try:
        for port in bridge.port_discovery():
            bridge.connect_port(port)
        report = run(bridge)
    finally:
        bridge.close()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    raise SystemExit(0 if report['ok'] else 1)
