"""
Combined Belief Scorer - On-Chain + Builder Contributions

Integrates BOTH on-chain activity AND GitHub builder contributions
into a comprehensive belief score.

This properly recognizes:
- On-chain behavior (transactions, ethics)
- Builder contributions (code, commits, innovation)
- Community impact (repos, stars, followers)
"""

from typing import Dict, Optional
from pathlib import Path
import json
import sys

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.base_chain_fetcher import get_belief_metrics as get_onchain_metrics
from engine.github_builder_scorer import get_builder_metrics


def combine_metrics(
    onchain: Dict[str, float],
    builder: Dict[str, float],
    *,
    onchain_weight: float = 0.4,
    builder_weight: float = 0.6
) -> Dict[str, float]:
    """
    Combine on-chain and builder metrics with configurable weights.

    Default: Builder contributions weighted 60%, on-chain 40%
    Rationale: Building > transacting for protocol value
    """
    # Ensure weights sum to 1.0
    total_weight = onchain_weight + builder_weight
    onchain_w = onchain_weight / total_weight
    builder_w = builder_weight / total_weight

    combined = {}

    # Loyalty: Builder commitment + on-chain consistency
    combined["loyalty"] = (
        onchain.get("loyalty", 0) * onchain_w +
        builder.get("loyalty", 0) * builder_w
    )

    # Ethics: On-chain behavior + open source ethics
    combined["ethics"] = (
        onchain.get("ethics", 50) * onchain_w +
        builder.get("ethics", 50) * builder_w
    )

    # Frequency: On-chain activity + builder activity
    combined["frequency"] = (
        onchain.get("frequency", 0) * onchain_w +
        builder.get("frequency", 0) * builder_w
    )

    # Alignment: On-chain ecosystem + builder innovation
    combined["alignment"] = (
        onchain.get("alignment", 50) * onchain_w +
        builder.get("innovation", 0) * builder_w
    )

    # Hold Duration: On-chain age + builder account age (from metadata)
    combined["holdDuration"] = onchain.get("holdDuration", 0)

    # NEW: Builder Impact (unique to GitHub)
    combined["builderImpact"] = builder.get("impact", 0)

    return {k: round(v, 2) for k, v in combined.items()}


def calculate_composite_multiplier(metrics: Dict[str, float]) -> float:
    """
    Calculate belief multiplier from combined metrics.

    Uses enhanced formula that includes builder impact.
    """
    # Normalize to 0-1 range
    loyalty = metrics.get("loyalty", 0) / 100.0
    ethics = metrics.get("ethics", 50) / 100.0
    frequency = metrics.get("frequency", 0) / 100.0
    alignment = metrics.get("alignment", 50) / 100.0
    hold_duration = metrics.get("holdDuration", 0) / 100.0
    builder_impact = metrics.get("builderImpact", 0) / 100.0

    # Enhanced weights (sum to 1.0)
    # Builder impact gets significant weight
    weights = {
        "loyalty": 0.25,
        "ethics": 0.20,
        "frequency": 0.10,
        "alignment": 0.15,
        "holdDuration": 0.05,
        "builderImpact": 0.25  # NEW: Builder impact highly weighted
    }

    # Baseline multiplier
    baseline = 1.0

    # Calculate weighted sum
    multiplier = (
        baseline +
        loyalty * weights["loyalty"] +
        ethics * weights["ethics"] +
        frequency * weights["frequency"] +
        alignment * weights["alignment"] +
        hold_duration * weights["holdDuration"] +
        builder_impact * weights["builderImpact"]
    )

    return round(multiplier, 4)


def determine_tier(multiplier: float) -> str:
    """Determine belief tier from multiplier."""
    if multiplier >= 1.8:
        return "Legendary Builder"
    elif multiplier >= 1.6:
        return "Immortal Flame"
    elif multiplier >= 1.4:
        return "Ascendant"
    elif multiplier >= 1.2:
        return "Burner"
    elif multiplier >= 1.1:
        return "Glow"
    else:
        return "Spark"


def comprehensive_belief_check(
    wallet_id: str,
    github_username: Optional[str] = None,
    *,
    onchain_weight: float = 0.4,
    builder_weight: float = 0.6
) -> Dict:
    """
    Complete belief check combining on-chain AND builder data.

    Args:
        wallet_id: Coinbase ID or address (e.g., bpow20.cb.id)
        github_username: GitHub username (e.g., Ghostkey316)
        onchain_weight: Weight for on-chain metrics (default 0.4)
        builder_weight: Weight for builder metrics (default 0.6)

    Returns:
        Comprehensive belief score with all metrics
    """
    # Fetch on-chain metrics
    try:
        onchain_metrics = get_onchain_metrics(wallet_id)
    except Exception as e:
        print(f"Warning: Could not fetch on-chain metrics: {e}")
        onchain_metrics = {
            "loyalty": 0,
            "ethics": 50,
            "frequency": 0,
            "alignment": 50,
            "holdDuration": 0
        }

    # Fetch builder metrics
    builder_metrics = {}
    if github_username:
        try:
            builder_metrics = get_builder_metrics(github_username)
        except Exception as e:
            print(f"Warning: Could not fetch builder metrics: {e}")
            builder_metrics = {
                "loyalty": 0,
                "ethics": 50,
                "impact": 0,
                "frequency": 0,
                "innovation": 0
            }

    # Combine metrics
    if builder_metrics:
        combined_metrics = combine_metrics(
            onchain_metrics,
            builder_metrics,
            onchain_weight=onchain_weight,
            builder_weight=builder_weight
        )
        method = "combined"
    else:
        # No builder data, use on-chain only
        combined_metrics = {
            **onchain_metrics,
            "builderImpact": 0
        }
        method = "onchain_only"

    # Calculate multiplier
    multiplier = calculate_composite_multiplier(combined_metrics)
    tier = determine_tier(multiplier)

    return {
        "wallet_id": wallet_id,
        "github_username": github_username,
        "onchain_metrics": onchain_metrics,
        "builder_metrics": builder_metrics,
        "combined_metrics": combined_metrics,
        "multiplier": multiplier,
        "tier": tier,
        "method": method,
        "weights": {
            "onchain": onchain_weight,
            "builder": builder_weight
        }
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python combined_belief_scorer.py <wallet_id> [github_username]")
        print("Example: python combined_belief_scorer.py bpow20.cb.id Ghostkey316")
        sys.exit(1)

    wallet_id = sys.argv[1]
    github_username = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"\n{'='*70}")
    print(f"COMPREHENSIVE BELIEF CHECK")
    print(f"{'='*70}\n")

    if github_username:
        print(f"Wallet:  {wallet_id}")
        print(f"GitHub:  {github_username}")
    else:
        print(f"Wallet:  {wallet_id}")
        print(f"GitHub:  (not provided - on-chain only)")
    print()

    try:
        result = comprehensive_belief_check(wallet_id, github_username)

        print("ON-CHAIN METRICS:")
        print("-" * 70)
        for key, value in result["onchain_metrics"].items():
            print(f"  {key:15s}: {value:6.2f}/100")

        if result["builder_metrics"]:
            print("\nBUILDER METRICS (GitHub):")
            print("-" * 70)
            for key, value in result["builder_metrics"].items():
                print(f"  {key:15s}: {value:6.2f}/100")

        print("\nCOMBINED METRICS:")
        print("-" * 70)
        for key, value in result["combined_metrics"].items():
            print(f"  {key:15s}: {value:6.2f}/100")

        print("\nFINAL SCORE:")
        print("-" * 70)
        print(f"  Multiplier: {result['multiplier']:.4f}x")
        print(f"  Tier:       {result['tier']}")
        print(f"  Method:     {result['method']}")
        print(f"  Weights:    On-chain {result['weights']['onchain']*100:.0f}% | Builder {result['weights']['builder']*100:.0f}%")

        print("\nINTERPRETATION:")
        print("-" * 70)
        if result["multiplier"] >= 1.8:
            print("  🚀 LEGENDARY BUILDER - Revolutionary contributions")
        elif result["multiplier"] >= 1.6:
            print("  🔥 IMMORTAL FLAME - Exceptional builder + believer")
        elif result["multiplier"] >= 1.4:
            print("  ⭐ ASCENDANT - Strong contributions")
        elif result["multiplier"] >= 1.2:
            print("  ✓  BURNER - Good contributions")
        else:
            print("  ○  BUILDING - Early stage")

        print(f"\n{'='*70}\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
