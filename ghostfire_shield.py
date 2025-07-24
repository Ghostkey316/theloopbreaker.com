import argparse
import hashlib
import hmac
import json
import os
import secrets
import tempfile
from pathlib import Path
from typing import Dict, Optional

from engine.health_sync_engine import encrypt_data, decrypt_data

CONFIG_PATH = Path("ghostfire_config.json")
DEFAULT_CONFIG = {
    "decouple_all": True,
    "onioncloak": True,
    "zkproof": True,
    "ghostmode": True,
    "hide_ens": True,
    "hide_wallet": True,
    "alias_refresh": False,
    "authorize": False,
    "integrity_check": True,
    "vaultsecure": True,
    "burntrail": False,
    "reveal": False,
}

ALIASES = [
    "shadow", "ember", "specter", "cipher", "pixel", "nova", "echo",
]


class GhostfireShield:
    """Privacy and security layer for Vaultfire."""

    def __init__(self, config: Optional[Dict] = None) -> None:
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.alias_map: Dict[str, str] = {}
        self.session_dir = tempfile.TemporaryDirectory(prefix="ghostvault_")

    # ------------------------------------------------------------------
    # Identity decoupling
    # ------------------------------------------------------------------
    def decouple_identity(self, ens: str, wallet: str,
                          belief_id: str, session_id: str,
                          contributor: str) -> Dict[str, str]:
        """Return anonymized mapping if decoupling enabled."""
        if not self.config.get("decouple_all", False):
            return {
                "ens": ens,
                "wallet": wallet,
                "belief_id": belief_id,
                "session_id": session_id,
                "contributor": contributor,
            }
        hashed = lambda x: hashlib.sha256(x.encode()).hexdigest()
        return {
            "ens": hashed(ens),
            "wallet": hashed(wallet),
            "belief_id": hashed(belief_id),
            "session_id": hashed(session_id),
            "contributor": hashed(contributor),
        }

    # ------------------------------------------------------------------
    # Recursive stealth network
    # ------------------------------------------------------------------
    def route(self, url: str) -> Dict[str, str]:
        """Return layered route information."""
        if not self.config.get("onioncloak", False):
            return {"route": url}
        layers = [
            f"mirror:{secrets.token_hex(4)}",
            f"bounce:{secrets.token_hex(4)}",
            f"key:{secrets.token_hex(8)}",
        ]
        return {"route": url, "layers": layers}

    # ------------------------------------------------------------------
    # Zero knowledge belief proofs
    # ------------------------------------------------------------------
    def verify_zk_proof(self, challenge: str, response: str) -> bool:
        if not self.config.get("zkproof", False):
            return True
        digest = hashlib.sha256(challenge.encode()).hexdigest()
        return hmac.compare_digest(digest, response)

    # ------------------------------------------------------------------
    # Ghost mode
    # ------------------------------------------------------------------
    def encrypt_local(self, text: str, key: str) -> str:
        return encrypt_data(text, key)

    def decrypt_local(self, token: str, key: str) -> str:
        return decrypt_data(token, key)

    # ------------------------------------------------------------------
    # Alias engine
    # ------------------------------------------------------------------
    def get_alias(self, name: str) -> str:
        if not self.config.get("hide_ens", False) and not self.config.get("hide_wallet", False):
            return name
        if name not in self.alias_map or self.config.get("alias_refresh", False):
            self.alias_map[name] = secrets.choice(ALIASES) + secrets.token_hex(2)
        return self.alias_map[name]

    # ------------------------------------------------------------------
    # Partner gatekeeping
    # ------------------------------------------------------------------
    def verify_partner(self, data: str, key: str) -> bool:
        if not self.config.get("authorize", False):
            return False
        token = hmac.new(key.encode(), data.encode(), hashlib.sha256).hexdigest()
        return token.endswith("00")

    # ------------------------------------------------------------------
    # Integrity check
    # ------------------------------------------------------------------
    def file_hash(self, path: Path) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    def check_integrity(self, paths) -> Dict[str, str]:
        results = {}
        for p in paths:
            try:
                results[str(p)] = self.file_hash(Path(p))
            except Exception:
                results[str(p)] = "missing"
        return results

    # ------------------------------------------------------------------
    # Session isolation
    # ------------------------------------------------------------------
    def close(self) -> None:
        if self.config.get("burntrail", False):
            self.session_dir.cleanup()


# ----------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------

def load_config() -> Dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return DEFAULT_CONFIG
    else:
        with open(CONFIG_PATH, "w") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        return DEFAULT_CONFIG


def save_config(cfg: Dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def main(argv: Optional[list[str]] = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Ghostfire Shield")
    parser.add_argument("--decouple-all", action="store_true")
    parser.add_argument("--onioncloak", action="store_true")
    parser.add_argument("--zkproof", action="store_true")
    parser.add_argument("--ghostmode", action="store_true")
    parser.add_argument("--burntrail", action="store_true")
    parser.add_argument("--hide-ens", action="store_true")
    parser.add_argument("--hide-wallet", action="store_true")
    parser.add_argument("--alias-refresh", action="store_true")
    parser.add_argument("--authorize", action="store_true")
    parser.add_argument("--integrity-check", action="store_true")
    parser.add_argument("--vaultsecure", action="store_true")
    parser.add_argument("--reveal", action="store_true")
    parser.add_argument("--save", action="store_true", help="Persist changes")
    args = parser.parse_args(argv)

    for key in DEFAULT_CONFIG.keys():
        if getattr(args, key.replace('-', '_'), False):
            cfg[key] = True
    shield = GhostfireShield(cfg)
    if args.integrity_check:
        hashes = shield.check_integrity([__file__])
        print(json.dumps(hashes, indent=2))
    if args.save:
        save_config(cfg)
    shield.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
