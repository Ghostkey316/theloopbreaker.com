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

def _load_log():
    if not LOG_PATH.exists():
        return []
    with open(LOG_PATH) as f:
        return [json.loads(line) for line in f if line.strip()]

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

def codexMemory(event):
    """Embed event into immutable log as an origin sync node."""
    log = _load_log()
    prev_hash = log[-1]["hash"] if log else "0" * 64
    entry = {
        "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat() + "Z",
        "type": "ASM_Sync",
        "data": event,
        "prev_hash": prev_hash,
    }
    entry["hash"] = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry

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
    sub.add_parser("verify", help="Verify identity")
    sub.add_parser("yield", help="Check ASM yield")
    sub.add_parser("loyalty", help="Log proof of loyalty")
    sub.add_parser("retro", help="Run retro yield simulation")
    args = parser.parse_args()

    if args.cmd == "sync":
        result = syncToASM()
    elif args.cmd == "verify":
        result = verifyIdentity()
    elif args.cmd == "yield":
        result = checkASMYield()
    elif args.cmd == "loyalty":
        result = logProofOfLoyalty()
    elif args.cmd == "retro":
        result = runRetroYield()
    else:
        parser.print_help()
        return

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
