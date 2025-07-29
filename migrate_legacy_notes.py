from __future__ import annotations
import json
import shutil
from datetime import datetime
from pathlib import Path

SRC_DIRS = ['legacy', 'chatlogs', 'uploads']
DEST_DIR = Path('Vaultfire_Memory_Index')

def migrate() -> None:
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for src in SRC_DIRS:
        p = Path(src)
        if not p.exists():
            continue
        for file in p.rglob('*'):
            if not file.is_file():
                continue
            if file.suffix.lower() not in {'.txt', '.md', '.json', '.log'}:
                continue
            ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
            dest = DEST_DIR / f'{ts}_{file.name}'
            shutil.move(str(file), dest)
            meta = {'source': str(file), 'timestamp': ts, 'contributor': p.name}
            dest.with_suffix(dest.suffix + '.meta').write_text(json.dumps(meta, indent=2))
        try:
            p.rmdir()
        except OSError:
            pass

if __name__ == '__main__':
    migrate()
