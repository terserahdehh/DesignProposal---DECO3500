"""Generate a local ESP-NOW encryption key shared by these two prototype bands."""
from pathlib import Path
import secrets

target = Path(__file__).parent / 'include' / 'pairing_keys.h'
if not target.exists():
    target.parent.mkdir(exist_ok=True)
    key = ','.join(f'0x{x:02x}' for x in secrets.token_bytes(16))
    target.write_text(f'#pragma once\nstatic const uint8_t PAIR_KEY[16] = {{{key}}};\n')
print(f'Pair key ready: {target}. Keep this file to rebuild either band.')
