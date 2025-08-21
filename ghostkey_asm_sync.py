import argparse
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

WALLET = "bpow20.cb.id"
IDENTITY = "Ghostkey-316"
TRIGGER = "loyalty"
LAYER = "tokenomics"
STATUS = "Active Sync Verified"

LOG_PATH = Path("immutable_log.jsonl")
RETRO_YIELD_PATH = Path("retro_yield.json")
CONTRIB_REG_PATH = Path("contributor_registry.json")

def _load_log():
    if not LOG_PATH.exists():
        return []
    with open(LOG_PATH) as f:
        return [json.loads(line) for line in f if line.strip()]


def _read_json(path: Path, default):
    """Read JSON file at ``path`` returning ``default`` on failure."""
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return default
    return default

def verifyIdentity():
    """Confirm Ghostkey-316 status via timestamped sync history."""
    history = _load_log()
    timestamps = [entry["timestamp"] for entry in history if entry.get("data", {}).get("identity") == IDENTITY]
    return {"identity": IDENTITY, "timestamps": timestamps, "verified": bool(timestamps)}

def checkASMYield():
    """Check for tokenomics-triggered rewards or multipliers."""
    rewards_path = Path("rewards_log.json")
    rewards = []
    if rewards_path.exists():
        try:
            rewards = json.loads(rewards_path.read_text())
        except json.JSONDecodeError:
            rewards = []
    if isinstance(rewards, list):
        wallet_rewards = [r for r in rewards if r.get("wallet") == WALLET]
    elif isinstance(rewards, dict):
        wallet_rewards = rewards.get(WALLET, [])
    else:
        wallet_rewards = []
    return {"wallet": WALLET, "rewards": wallet_rewards, "status": "checked"}

def logProofOfLoyalty():
    """Generate signed verification of behavior-based alignment."""
    timestamp = datetime.now(timezone.utc).isoformat()
    msg = f"{WALLET}:{timestamp}:{TRIGGER}"
    signature = hashlib.sha256(msg.encode()).hexdigest()
    return {"wallet": WALLET, "trigger": TRIGGER, "timestamp": timestamp, "signature": signature}

def runRetroYield():
    """Simulate past due yield drops for validation or testnet activation."""
    timestamp = datetime.now(timezone.utc).isoformat()
    return {"wallet": WALLET, "simulated_at": timestamp, "result": "ok"}


def verifyImmutableSync():
    """Confirm ``ghostkey_asm_sync.py`` executed and persisted a syncpoint."""
    log = _load_log()
    for entry in reversed(log):
        if entry.get("type") != "ASM_Sync":
            continue
        data = entry.get("data", {})
        proof = data.get("proof", {})
        if (
            data.get("identity") == IDENTITY
            and data.get("wallet") == WALLET
            and proof.get("trigger") == TRIGGER
            and data.get("status") == STATUS
        ):
            return {"verified": True, "syncpoint": entry}
    return {"verified": False}


def runRetroDrop(wallet: str = WALLET):
    """Simulate past ASM yield events and log virtual yield."""
    log = _load_log()
    events = [
        e
        for e in log
        if e.get("type") == "ASM_Sync" and e.get("data", {}).get("wallet") == wallet
    ]
    loyalty = _read_json(Path("loyalty_tiers.json"), {})
    tier_info = loyalty.get("ghostkey316.eth", {})
    multiplier = tier_info.get("multiplier", 1)
    yield_amount = len(events) * 10 * multiplier
    timestamp = datetime.now(timezone.utc).isoformat()
    retro_entry = {
        "wallet": wallet,
        "events": len(events),
        "yield": yield_amount,
        "timestamp": timestamp,
    }
    history = _read_json(RETRO_YIELD_PATH, [])
    if isinstance(history, list):
        history.append(retro_entry)
    else:
        history = [retro_entry]
    RETRO_YIELD_PATH.write_text(json.dumps(history, indent=2))
    return retro_entry


def grantContributorRole():
    """Grant or confirm Contributor Tier 1 role for Ghostkey-316."""
    verification = verifyImmutableSync()
    if not verification.get("verified"):
        return {"eligible": False, "reason": "syncpoint missing"}
    registry = _read_json(CONTRIB_REG_PATH, {})
    entry = registry.get(WALLET)
    if not entry:
        entry = {"identity": IDENTITY, "role": "Contributor Tier 1"}
        registry[WALLET] = entry
        CONTRIB_REG_PATH.write_text(json.dumps(registry, indent=2))
    return {"eligible": True, "role": entry}


def outputProof():
    """Generate signed ``.proof`` file for Ghostkey-316."""
    verification = verifyImmutableSync()
    if not verification.get("verified"):
        return {"error": "verification failed"}
    sync_hash = verification["syncpoint"]["hash"]
    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {
        "identity": IDENTITY,
        "wallet": WALLET,
        "sync_hash": sync_hash,
        "verified_at": timestamp,
        "verification": verification,
    }
    signature = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    payload["signature"] = signature
    proof_path = Path(f"{IDENTITY}.proof")
    proof_path.write_text(json.dumps(payload, indent=2))
    return {"proof": str(proof_path), "signature": signature}

def codexMemory(event, event_type: str = "ASM_Sync"):
    """Embed event into immutable log with chained hashing."""
    log = _load_log()
    prev_hash = log[-1]["hash"] if log else "0" * 64
    entry = {
        "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat() + "Z",
        "type": event_type,
        "data": event,
        "prev_hash": prev_hash,
    }
    entry["hash"] = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def forkProof():
    """Prepare Codex-fork partner export placeholder."""
    timestamp = datetime.now(timezone.utc).isoformat()
    return {"export_ready": True, "timestamp": timestamp}

def syncToASM():
    """Run the full ASM sync pipeline and log permanent verification."""
    identity_info = verifyIdentity()
    loyalty_proof = logProofOfLoyalty()
    asm_yield = checkASMYield()
    event = {
        "wallet": WALLET,
        "trigger": TRIGGER,
        "layer": LAYER,
        "identity": IDENTITY,
        "status": STATUS,
        "proof": loyalty_proof,
        "yield": asm_yield,
        "sync_time": datetime.now(timezone.utc).isoformat(),
    }
    codex_entry = codexMemory(event)
    return {"identity": identity_info, "codex": codex_entry}

def main():
    parser = argparse.ArgumentParser(description="Vaultfire ASM sync module")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("sync", help="Run full sync")
    sub.add_parser("verify", help="Verify last immutable syncpoint")
    retro = sub.add_parser("retrodrop", help="Simulate retro yield and log")
    retro.add_argument("--wallet", default=WALLET, help="Wallet to simulate drop for")
    sub.add_parser("contributor", help="Grant or confirm contributor role")
    sub.add_parser("proof", help="Export signed proof file")
    sub.add_parser("forkproof", help="Prepare partner export placeholder")
    args = parser.parse_args()

    if args.cmd == "sync":
        result = syncToASM()
    elif args.cmd == "verify":
        result = verifyImmutableSync()
    elif args.cmd == "retrodrop":
        result = runRetroDrop(args.wallet)
    elif args.cmd == "contributor":
        result = grantContributorRole()
    elif args.cmd == "proof":
        result = outputProof()
    elif args.cmd == "forkproof":
        result = forkProof()
    else:
        parser.print_help()
        return

    codexMemory({"command": args.cmd, "result": result}, event_type="CLI_Event")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
