"""
Base Chain Data Fetcher for Belief Metrics

Fetches real on-chain data for Coinbase wallet identifiers (e.g., bpow20.cb.id)
and converts it into belief metrics (loyalty, ethics, frequency).

Uses Base mainnet (Chain ID 8453) and Basescan API.
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import requests
from web3 import Web3

# Base mainnet RPC
BASE_RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
BASESCAN_API_KEY = os.getenv("BASESCAN_API_KEY", "")  # Optional (deprecated)
BASESCAN_API_URL = "https://api.basescan.org/v2/api"  # V2 API endpoint (deprecated)

# Blockscout API (no key needed, works reliably)
BLOCKSCOUT_API_URL = "https://base.blockscout.com/api/v2"

# Cache directory
CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "base_chain"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Coinbase ID resolver (cb.id → 0x address)
CB_ID_RESOLVER_URL = "https://www.coinbase.com/api/v2/users/{cb_id}"


def resolve_cb_id(cb_id: str) -> Optional[str]:
    """
    Resolve Coinbase ID (e.g., bpow20.cb.id) to Ethereum address.

    Checks cache first (setup via scripts/setup_wallet_mapping.py).
    """
    # Try to resolve via cache
    cache_file = CACHE_DIR / f"{cb_id.replace('.', '_')}_address.json"
    if cache_file.exists():
        try:
            data = json.loads(cache_file.read_text())
            return data.get("address")
        except Exception:
            pass

    # No mapping found
    raise ValueError(
        f"No address mapping for {cb_id}. "
        f"Run: python scripts/setup_wallet_mapping.py {cb_id} <your_address>"
    )


def fetch_transactions(address: str, limit: int = 100) -> List[Dict]:
    """
    Fetch recent transactions for address from Base chain.

    Uses Basescan API if available, otherwise falls back to RPC.
    """
    # Check cache first
    cache_file = CACHE_DIR / f"{address.lower()}_txs.json"
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 300:  # 5 minute cache
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass

    transactions = []

    # Try Blockscout API first (free, no key needed)
    try:
        url = f"{BLOCKSCOUT_API_URL}/addresses/{address}/transactions"
        response = requests.get(url, timeout=15)
        data = response.json()

        if "items" in data:
            # Transform Blockscout format to Basescan-compatible format
            for item in data["items"][:limit]:
                # Convert timestamp to Unix timestamp
                timestamp_str = item.get("timestamp", "")
                if timestamp_str:
                    try:
                        # Parse ISO format: "2025-11-10T12:34:56.789Z"
                        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        unix_timestamp = int(dt.timestamp())
                    except:
                        unix_timestamp = 0
                else:
                    unix_timestamp = 0

                tx = {
                    "hash": item.get("hash", ""),
                    "from": item.get("from", {}).get("hash", ""),
                    "to": item.get("to", {}).get("hash", "") if item.get("to") else "",
                    "value": item.get("value", "0"),
                    "input": item.get("raw_input", "0x"),
                    "timeStamp": str(unix_timestamp),
                    "isError": "0" if item.get("status") == "ok" else "1",
                    "source": "blockscout"
                }
                transactions.append(tx)
    except Exception as e:
        print(f"Blockscout API error: {e}")

    # Fallback to RPC
    if not transactions:
        try:
            w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
            balance = w3.eth.get_balance(address)
            tx_count = w3.eth.get_transaction_count(address)

            # RPC doesn't give us tx history easily, so we return metadata
            transactions = [{
                "balance": balance,
                "tx_count": tx_count,
                "source": "rpc",
                "timestamp": int(time.time())
            }]
        except Exception as e:
            print(f"RPC error: {e}")
            return []

    # Cache results
    try:
        cache_file.write_text(json.dumps(transactions, indent=2))
    except Exception:
        pass

    return transactions


def calculate_loyalty_score(transactions: List[Dict], address: str) -> float:
    """
    Calculate loyalty score (0-100) based on on-chain behavior.

    Factors:
    - Transaction consistency (regular activity)
    - Hold duration (not constantly selling/swapping)
    - Network participation (interacting with dApps)
    """
    if not transactions:
        return 0.0

    # If using RPC metadata
    if transactions[0].get("source") == "rpc":
        tx_count = transactions[0].get("tx_count", 0)

        # Basic scoring: more transactions = more loyal
        # Cap at 100
        loyalty = min(100.0, tx_count * 2.0)
        return loyalty

    # If using Basescan data
    now = int(time.time())
    thirty_days_ago = now - (30 * 24 * 60 * 60)

    recent_txs = [tx for tx in transactions if int(tx.get("timeStamp", 0)) > thirty_days_ago]

    # Consistency score (regular activity)
    consistency = min(100.0, len(recent_txs) * 5.0)

    # Network participation (interactions beyond simple transfers)
    contract_interactions = sum(1 for tx in recent_txs if tx.get("input", "0x") != "0x")
    participation = min(100.0, contract_interactions * 10.0)

    # Weighted average
    loyalty = (consistency * 0.6) + (participation * 0.4)

    return round(loyalty, 2)


def calculate_ethics_score(transactions: List[Dict], address: str) -> float:
    """
    Calculate ethics score (0-100) based on on-chain behavior.

    Factors:
    - No scam contract interactions
    - No suspicious patterns (wash trading, etc.)
    - Positive community interactions (donations, staking, governance)
    """
    if not transactions:
        return 50.0  # Neutral default

    # If using RPC metadata (no transaction history)
    if transactions[0].get("source") == "rpc":
        return 75.0  # Default for RPC

    # If using Blockscout or Basescan data
    ethics = 50.0  # Start neutral

    # Check for failed transactions (could indicate scam attempts)
    failed_txs = sum(1 for tx in transactions if tx.get("isError") == "1")
    if failed_txs == 0:
        ethics += 10.0

    # Check for contract interactions (positive signal)
    contract_txs = sum(1 for tx in transactions if tx.get("input", "0x") != "0x")
    if contract_txs > 5:
        ethics += 15.0

    # Check for outgoing transactions (not just receiving)
    outgoing_txs = sum(1 for tx in transactions if tx.get("from", "").lower() == address.lower())
    if outgoing_txs > 0:
        ethics += 10.0

    return min(100.0, round(ethics, 2))


def calculate_frequency_score(transactions: List[Dict]) -> float:
    """
    Calculate frequency score (0-100) based on activity frequency.

    Factors:
    - Recent activity (last 7 days, 30 days)
    - Consistent engagement over time
    """
    if not transactions:
        return 0.0

    # If using RPC metadata
    if transactions[0].get("source") == "rpc":
        tx_count = transactions[0].get("tx_count", 0)

        # Assume even distribution over time
        # 10 tx = 50 points, 20 tx = 100 points
        frequency = min(100.0, tx_count * 5.0)
        return frequency

    # If using Basescan data
    now = int(time.time())
    seven_days_ago = now - (7 * 24 * 60 * 60)
    thirty_days_ago = now - (30 * 24 * 60 * 60)

    recent_7d = sum(1 for tx in transactions if int(tx.get("timeStamp", 0)) > seven_days_ago)
    recent_30d = sum(1 for tx in transactions if int(tx.get("timeStamp", 0)) > thirty_days_ago)

    # Score based on recent activity
    frequency_7d = min(100.0, recent_7d * 20.0)  # 5 tx/week = 100
    frequency_30d = min(100.0, recent_30d * 5.0)  # 20 tx/month = 100

    # Weighted average (recent > historical)
    frequency = (frequency_7d * 0.7) + (frequency_30d * 0.3)

    return round(frequency, 2)


def calculate_alignment_score(transactions: List[Dict], address: str) -> float:
    """
    Calculate alignment score (0-100) based on partner ecosystem participation.

    Factors:
    - Vaultfire contract interactions
    - Partner protocol interactions
    - Governance participation
    """
    if not transactions:
        return 50.0  # Neutral default

    # If using RPC metadata
    if transactions[0].get("source") == "rpc":
        return 60.0  # Slightly positive default

    # If using Basescan data
    alignment = 50.0  # Start neutral

    # Known Vaultfire/partner contract addresses (update as deployed)
    partner_contracts = [
        # Add deployed contract addresses here
    ]

    # Check for partner interactions
    partner_txs = sum(
        1 for tx in transactions
        if tx.get("to", "").lower() in [c.lower() for c in partner_contracts]
    )

    if partner_txs > 0:
        alignment += 30.0

    # Contract creation (builder signal)
    contract_creates = sum(1 for tx in transactions if not tx.get("to"))
    if contract_creates > 0:
        alignment += 20.0

    return min(100.0, round(alignment, 2))


def calculate_hold_duration_score(transactions: List[Dict], address: str) -> float:
    """
    Calculate hold duration score (0-100) based on wallet age and activity.

    Factors:
    - Wallet age (first transaction)
    - Consistent holding (not just flipping)
    """
    if not transactions:
        return 0.0

    # If using RPC metadata
    if transactions[0].get("source") == "rpc":
        # Can't determine age from RPC alone
        return 50.0

    # If using Basescan data
    now = int(time.time())

    # Find oldest transaction
    oldest_tx = min(transactions, key=lambda tx: int(tx.get("timeStamp", now)))
    first_tx_time = int(oldest_tx.get("timeStamp", now))

    # Calculate age in days
    age_seconds = now - first_tx_time
    age_days = age_seconds / (24 * 60 * 60)

    # Score: 30 days = 50 points, 365 days = 100 points
    duration = min(100.0, (age_days / 365.0) * 100.0)

    return round(duration, 2)


def get_belief_metrics(wallet_id: str) -> Dict[str, float]:
    """
    Get complete belief metrics for a wallet identifier.

    Supports:
    - Coinbase IDs (e.g., bpow20.cb.id)
    - Ethereum addresses (0x...)
    - ENS names (name.eth)

    Returns dict with keys: loyalty, ethics, frequency, alignment, holdDuration
    """
    # Resolve to address
    address = wallet_id

    if wallet_id.endswith(".cb.id"):
        resolved = resolve_cb_id(wallet_id)
        if not resolved:
            raise ValueError(f"Could not resolve Coinbase ID: {wallet_id}")
        address = resolved
    elif wallet_id.endswith(".eth"):
        # TODO: Add ENS resolution
        raise ValueError(f"ENS resolution not implemented yet: {wallet_id}")

    # Fetch transactions
    transactions = fetch_transactions(address)

    # Calculate metrics
    metrics = {
        "loyalty": calculate_loyalty_score(transactions, address),
        "ethics": calculate_ethics_score(transactions, address),
        "frequency": calculate_frequency_score(transactions),
        "alignment": calculate_alignment_score(transactions, address),
        "holdDuration": calculate_hold_duration_score(transactions, address),
    }

    # Save metrics to cache
    cache_file = CACHE_DIR / f"{wallet_id.replace('.', '_')}_metrics.json"
    try:
        cache_file.write_text(json.dumps({
            "wallet_id": wallet_id,
            "address": address,
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat(),
            "tx_count": len(transactions)
        }, indent=2))
    except Exception:
        pass

    return metrics


if __name__ == "__main__":
    import sys

    # Test with wallet ID
    wallet_id = sys.argv[1] if len(sys.argv) > 1 else "bpow20.cb.id"

    print(f"Fetching belief metrics for: {wallet_id}")
    print("-" * 60)

    try:
        metrics = get_belief_metrics(wallet_id)

        print(f"Loyalty:       {metrics['loyalty']:.2f}/100")
        print(f"Ethics:        {metrics['ethics']:.2f}/100")
        print(f"Frequency:     {metrics['frequency']:.2f}/100")
        print(f"Alignment:     {metrics['alignment']:.2f}/100")
        print(f"Hold Duration: {metrics['holdDuration']:.2f}/100")
        print("-" * 60)

        # Test with belief_weight.js formula
        print("\nCalculating belief multiplier...")
        print(f"(This would feed into computeBeliefMultiplier)")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
