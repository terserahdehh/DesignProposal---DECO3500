#!/usr/bin/env python3
"""Run actual local/Vercel browser UI against physical USB bands, restoring state.

No mock hardware, geolocation or HTTP responses. Known demonstration coordinates
are submitted only through demo_location and cleared in cleanup. Presets restored.
"""
import argparse
from pathlib import Path
import subprocess
import threading
from urllib.parse import urlparse
from bridge import BandBridge, BridgeHTTPServer
from verify_pair import PairVerifier, require

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--site', action='append', required=True)
args = parser.parse_args()
bridge = BandBridge()
verifier = PairVerifier(bridge)
server = None
try:
    for port in bridge.port_discovery(): bridge.connect_port(port)
    verifier.verify_identities()
    origins = {f'{urlparse(site).scheme}://{urlparse(site).netloc}' for site in args.site}
    server = BridgeHTTPServer(('127.0.0.1', 0), bridge, origins)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    for site in args.site:
        for owner in ('nayaka', 'syifa'): verifier.home(owner)
        verifier.set_demo_pair({'nayaka': (0, 0), 'syifa': (0, .001)}, accuracy=.5)
        for owner in ('nayaka', 'syifa'): verifier.open_find(owner)
        subprocess.run(['node', str(ROOT / 'prototype/tests/liveUsb.cjs'), site.rstrip('/'),
                        f'http://127.0.0.1:{server.server_port}'], cwd=ROOT / 'prototype', check=True, timeout=120)
finally:
    verifier.cleanup()
    if server: server.shutdown(); server.server_close()
    bridge.close()
require(all(item['ok'] for item in verifier.report['cleanup']), 'Original hardware state restoration failed')
print('PASS: original presets restored and test coordinates cleared on both bands')
