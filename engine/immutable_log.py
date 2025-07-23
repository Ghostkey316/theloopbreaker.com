import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "immutable_log.jsonl"


def _get_last_hash() -> str:
    if not LOG_PATH.exists():
        return "0" * 64
    try:
        with open(LOG_PATH, "rb") as f:
            f.seek(0, 2)
            if f.tell() == 0:
                return "0" * 64
            # read last line
            f.seek(-2, 2)
            while f.tell() > 0 and f.read(1) != b"\n":
                f.seek(-2, 1)
            last_line = f.readline().decode()
        last_entry = json.loads(last_line)
        return last_entry.get("hash", "0" * 64)
    except Exception:
        return "0" * 64


def _store_ipfs(data: bytes) -> Optional[str]:
    try:
        import ipfshttpclient  # type: ignore
    except Exception:
        return None
    try:
        client = ipfshttpclient.connect()
        cid = client.add_bytes(data)
        return cid
    except Exception:
        return None


def append_entry(entry_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    prev_hash = _get_last_hash()
    entry = {
        "timestamp": timestamp,
        "type": entry_type,
        "data": data,
        "prev_hash": prev_hash,
    }
    entry_json = json.dumps(entry, sort_keys=True).encode()
    entry_hash = hashlib.sha256(entry_json).hexdigest()
    entry["hash"] = entry_hash
    cid = _store_ipfs(entry_json)
    if cid:
        entry["ipfs_cid"] = cid
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry
