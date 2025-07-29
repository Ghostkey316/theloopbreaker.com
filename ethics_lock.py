from __future__ import annotations
import hashlib
from pathlib import Path

FILE = Path('ethics/core_v2.mdx')
HASH_FILE = Path('ethics/core_v2.hash')


def check_lock() -> bool:
    data = FILE.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    stored = HASH_FILE.read_text().split()[0]
    return digest == stored


if __name__ == '__main__':
    if check_lock():
        print('ethics framework locked')
    else:
        raise SystemExit('ethics framework hash mismatch')
