import json
import hashlib
from pathlib import Path

from engine.identity_resolver import resolve_identity
from engine.loyalty_engine import loyalty_score

BASE_DIR = Path(__file__).resolve().parent
CORE_PATH = BASE_DIR / "ethics" / "core.mdx"
SNAPSHOT_PATH = BASE_DIR / "dashboards" / "contributor_snapshot.json"

DEFAULT_USER_ID = "ghostkey316"
DEFAULT_ENS = "ghostkey316.eth"
DEFAULT_WALLET = "bpow20.cb.id"


def parse_moral_framework(path: Path) -> list[str]:
    values = []
    capture = False
    with open(path) as f:
        for line in f:
            line = line.rstrip()
            if line.lower().startswith("## core values"):
                capture = True
                continue
            if capture:
                if line.startswith("##"):
                    break
                if line.lstrip().startswith("-"):
                    values.append(line.lstrip("- ").strip())
    return values


def build_snapshot(user_id: str = DEFAULT_USER_ID) -> dict:
    ens = DEFAULT_ENS
    wallet = DEFAULT_WALLET
    resolved_wallet = resolve_identity(wallet) or "unknown"
    loyalty = loyalty_score(user_id)
    moral_values = parse_moral_framework(CORE_PATH)
    sig_hash = hashlib.sha256(f"{ens}-{wallet}".encode()).hexdigest()[:10]

    return {
        "title": "Ghostkey-316: The Ethics Origin",
        "ens": ens,
        "wallet": wallet,
        "resolved_wallet": resolved_wallet,
        "visual_signature": f"signature-{sig_hash}",
        "moral_framework": moral_values,
        "loyalty_status": loyalty,
        "system_phase": "Vaultfire Init",
    }


def main():
    snapshot = build_snapshot()
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SNAPSHOT_PATH, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
