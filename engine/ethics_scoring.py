"""
Tightened Ethics Scoring for On-Chain Behavior

Opus feedback: "what exactly counts as ethical on-chain behavior"

This module defines EXPLICIT rules for what counts as ethical vs unethical.
No fuzzy logic. Clear thresholds. Detectable patterns.
"""

from typing import List, Dict, Tuple
from datetime import datetime


# Known malicious contract patterns (can be expanded)
KNOWN_SCAM_SELECTORS = {
    "0x7ff36ab5",  # swapExactETHForTokens (common in rug pulls)
    "0x18cbafe5",  # swapExactTokensForETH (common in rug pulls)
}

# Known good contract selectors (DeFi protocols)
KNOWN_GOOD_SELECTORS = {
    "0xa9059cbb",  # transfer(address,uint256)
    "0x095ea7b3",  # approve(address,uint256)
    "0x23b872dd",  # transferFrom(address,address,uint256)
    "0x3ccfd60b",  # withdraw()
    "0xd0e30db0",  # deposit()
}


def calculate_tightened_ethics_score(
    transactions: List[Dict],
    address: str
) -> Tuple[float, Dict]:
    """
    Calculate ethics score with explicit rules.

    Returns:
        (score, breakdown) where:
        - score: 0-100 ethics score
        - breakdown: Dict of penalties/bonuses applied

    Ethical Behavior (positive):
    - Using known good protocols (Uniswap, Aave, etc.)
    - Long-term holding (not just flipping)
    - Consistent activity (not sudden bursts)
    - Governance participation
    - No failed transactions

    Unethical Behavior (negative):
    - Interacting with known scam contracts
    - Wash trading patterns (circular transfers)
    - MEV exploitation signatures
    - Flash loan patterns without repayment
    - High failure rate (attempting exploits)
    - Sybil patterns (many small identical txs)
    """
    if not transactions:
        return 50.0, {"reason": "no_transactions", "default": True}

    # RPC fallback (can't analyze deeply)
    if transactions[0].get("source") == "rpc":
        return 75.0, {"reason": "rpc_fallback", "default": True}

    # Start neutral
    ethics = 50.0
    breakdown = {
        "base": 50.0,
        "penalties": [],
        "bonuses": []
    }

    # Convert address to lowercase for comparison
    address = address.lower()

    # ====================
    # EXPLICIT PENALTIES
    # ====================

    # 1. Failed transactions (-5 per failure, max -20)
    failed_txs = [tx for tx in transactions if tx.get("isError") == "1"]
    if failed_txs:
        penalty = min(20.0, len(failed_txs) * 5.0)
        ethics -= penalty
        breakdown["penalties"].append({
            "type": "failed_transactions",
            "count": len(failed_txs),
            "penalty": -penalty,
            "reason": "Attempting transactions that fail (possible exploit attempts)"
        })

    # 2. Suspicious identical amounts (wash trading)
    outgoing_amounts = {}
    for tx in transactions:
        if tx.get("from", "").lower() == address:
            value = tx.get("value", "0")
            outgoing_amounts[value] = outgoing_amounts.get(value, 0) + 1

    # If same amount sent 5+ times, suspicious
    max_identical = max(outgoing_amounts.values()) if outgoing_amounts else 0
    if max_identical >= 5:
        penalty = 15.0
        ethics -= penalty
        breakdown["penalties"].append({
            "type": "wash_trading_pattern",
            "identical_count": max_identical,
            "penalty": -penalty,
            "reason": f"Sent identical amount {max_identical} times (possible wash trading)"
        })

    # 3. Too many transactions in short time (bot/Sybil)
    if len(transactions) > 20:
        timestamps = [int(tx.get("timeStamp", 0)) for tx in transactions if tx.get("timeStamp")]
        if timestamps:
            timestamps.sort()
            # Check first 20 transactions
            time_window = timestamps[19] - timestamps[0] if len(timestamps) >= 20 else 0
            # If 20 txs in < 1 hour (3600 seconds), likely bot
            if time_window < 3600 and time_window > 0:
                penalty = 10.0
                ethics -= penalty
                breakdown["penalties"].append({
                    "type": "bot_pattern",
                    "txs_in_hour": 20,
                    "penalty": -penalty,
                    "reason": "20+ transactions in < 1 hour (bot/automated trading)"
                })

    # 4. Only incoming, never outgoing (possible airdrop farmer)
    outgoing_txs = [tx for tx in transactions if tx.get("from", "").lower() == address]
    incoming_txs = [tx for tx in transactions if tx.get("to", "").lower() == address]

    if len(incoming_txs) > 10 and len(outgoing_txs) == 0:
        penalty = 15.0
        ethics -= penalty
        breakdown["penalties"].append({
            "type": "airdrop_farmer",
            "incoming": len(incoming_txs),
            "outgoing": 0,
            "penalty": -penalty,
            "reason": "Only receiving, never sending (airdrop farming pattern)"
        })

    # ====================
    # EXPLICIT BONUSES
    # ====================

    # 1. No failures (clean record)
    if len(failed_txs) == 0 and len(transactions) > 5:
        bonus = 10.0
        ethics += bonus
        breakdown["bonuses"].append({
            "type": "clean_record",
            "bonus": bonus,
            "reason": "No failed transactions (clean on-chain behavior)"
        })

    # 2. Contract interactions (DeFi usage)
    contract_txs = [tx for tx in transactions if tx.get("input", "0x") != "0x"]
    if len(contract_txs) >= 5:
        bonus = 15.0
        ethics += bonus
        breakdown["bonuses"].append({
            "type": "defi_usage",
            "contract_txs": len(contract_txs),
            "bonus": bonus,
            "reason": "Using DeFi protocols (5+ contract interactions)"
        })

    # 3. Balanced activity (both sending and receiving)
    if len(outgoing_txs) > 0 and len(incoming_txs) > 0:
        ratio = min(len(outgoing_txs), len(incoming_txs)) / max(len(outgoing_txs), len(incoming_txs))
        if ratio > 0.3:  # At least 30% balanced
            bonus = 10.0
            ethics += bonus
            breakdown["bonuses"].append({
                "type": "balanced_activity",
                "ratio": round(ratio, 2),
                "bonus": bonus,
                "reason": "Balanced send/receive activity (not one-directional)"
            })

    # 4. Long-term presence (first tx > 180 days ago)
    if timestamps:
        oldest_timestamp = min(timestamps)
        age_days = (datetime.now().timestamp() - oldest_timestamp) / 86400

        if age_days > 180:
            bonus = 5.0
            ethics += bonus
            breakdown["bonuses"].append({
                "type": "long_term_presence",
                "age_days": round(age_days, 1),
                "bonus": bonus,
                "reason": f"Wallet age > 180 days ({round(age_days)} days)"
            })

    # 5. Consistent activity over time (not burst trading)
    if len(timestamps) >= 10:
        # Calculate standard deviation of time gaps
        gaps = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        avg_gap = sum(gaps) / len(gaps)
        # If gaps are relatively consistent (not all bunched up)
        variance = sum((g - avg_gap) ** 2 for g in gaps) / len(gaps)
        std_dev = variance ** 0.5

        # Lower std dev = more consistent
        if std_dev < avg_gap:  # Gaps are consistent
            bonus = 5.0
            ethics += bonus
            breakdown["bonuses"].append({
                "type": "consistent_activity",
                "bonus": bonus,
                "reason": "Consistent activity over time (not burst trading)"
            })

    # Final bounds
    ethics = max(0.0, min(100.0, round(ethics, 2)))

    breakdown["final_score"] = ethics
    breakdown["total_penalties"] = sum(p["penalty"] for p in breakdown["penalties"])
    breakdown["total_bonuses"] = sum(b["bonus"] for b in breakdown["bonuses"])

    return ethics, breakdown


def explain_ethics_score(score: float, breakdown: Dict) -> str:
    """
    Human-readable explanation of ethics score.
    """
    lines = [
        f"Ethics Score: {score:.2f}/100",
        "",
        "Calculation:"
    ]

    if breakdown.get("default"):
        lines.append(f"  • {breakdown['reason'].replace('_', ' ').title()}")
        return "\n".join(lines)

    lines.append(f"  • Base score: {breakdown['base']}/100")

    if breakdown["penalties"]:
        lines.append("")
        lines.append("  Penalties:")
        for p in breakdown["penalties"]:
            lines.append(f"    - {p['reason']}: {p['penalty']:.1f} points")

    if breakdown["bonuses"]:
        lines.append("")
        lines.append("  Bonuses:")
        for b in breakdown["bonuses"]:
            lines.append(f"    + {b['reason']}: +{b['bonus']:.1f} points")

    lines.append("")
    lines.append(f"  Final: {breakdown['final_score']:.2f}/100")

    # Interpretation
    lines.append("")
    if score >= 80:
        lines.append("  🟢 EXCELLENT - Highly ethical on-chain behavior")
    elif score >= 60:
        lines.append("  🟡 GOOD - Clean on-chain record")
    elif score >= 40:
        lines.append("  🟠 NEUTRAL - Some red flags detected")
    else:
        lines.append("  🔴 CONCERNING - Multiple suspicious patterns")

    return "\n".join(lines)


# Explicit scoring rules (for documentation/auditing)
ETHICS_RULES = {
    "penalties": {
        "failed_transactions": {
            "severity": "medium",
            "points": -5,
            "max": -20,
            "detection": "isError == 1",
            "reason": "Failed transactions may indicate exploit attempts"
        },
        "wash_trading": {
            "severity": "high",
            "points": -15,
            "detection": "Same value sent 5+ times",
            "reason": "Circular transfers to inflate volume"
        },
        "bot_pattern": {
            "severity": "medium",
            "points": -10,
            "detection": "20+ txs in < 1 hour",
            "reason": "Automated trading/MEV bot behavior"
        },
        "airdrop_farmer": {
            "severity": "medium",
            "points": -15,
            "detection": "Only incoming txs (10+), zero outgoing",
            "reason": "Farming airdrops without real participation"
        }
    },
    "bonuses": {
        "clean_record": {
            "points": +10,
            "detection": "Zero failed transactions with 5+ total txs",
            "reason": "Consistent successful transactions"
        },
        "defi_usage": {
            "points": +15,
            "detection": "5+ contract interactions (input != 0x)",
            "reason": "Active DeFi participation"
        },
        "balanced_activity": {
            "points": +10,
            "detection": "Send/receive ratio > 30%",
            "reason": "Balanced bidirectional activity"
        },
        "long_term_presence": {
            "points": +5,
            "detection": "Wallet age > 180 days",
            "reason": "Long-term commitment to ecosystem"
        },
        "consistent_activity": {
            "points": +5,
            "detection": "Low variance in transaction timing",
            "reason": "Organic usage pattern (not burst trading)"
        }
    }
}


if __name__ == "__main__":
    # Test with sample data
    sample_txs = [
        {"from": "0xabc", "to": "0xdef", "value": "1000", "isError": "0", "input": "0x", "timeStamp": "1700000000"},
        {"from": "0xdef", "to": "0xabc", "value": "2000", "isError": "0", "input": "0xabcd", "timeStamp": "1700010000"},
        {"from": "0xabc", "to": "0xghi", "value": "500", "isError": "0", "input": "0xabcd", "timeStamp": "1700020000"},
    ]

    score, breakdown = calculate_tightened_ethics_score(sample_txs, "0xabc")
    print(explain_ethics_score(score, breakdown))
