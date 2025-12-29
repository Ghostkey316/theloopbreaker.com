"""
Comprehensive Belief Scorer V2

Integrates ALL data sources into holistic belief score:
1. On-Chain Activity (Base mainnet transactions)
2. GitHub Builder Contributions (commits, repos, activity)
3. Enhanced GitHub (revolutionary contributions, innovation)
4. X/Twitter Social Proof (engagement, thought leadership)

This is the COMPLETE recognition system for builder value.
"""

from typing import Dict, Optional
from pathlib import Path
import json
import sys

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.base_chain_fetcher import get_belief_metrics as get_onchain_metrics
from engine.github_builder_scorer import get_builder_metrics
from engine.github_enhanced_scorer import get_enhanced_github_metrics
from engine.twitter_social_scorer import get_social_metrics


def combine_all_metrics(
    onchain: Dict[str, float],
    builder: Dict[str, float],
    enhanced: Dict[str, float],
    social: Dict[str, float],
    *,
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, float]:
    """
    Combine all four data sources with intelligent weighting.

    Default weights:
    - On-chain: 20% (transactions are signals, not the work)
    - GitHub builder: 40% (actual building, commits, code)
    - Enhanced GitHub: 30% (revolutionary contributions, innovation)
    - Social: 10% (thought leadership, community impact)

    Total: 100%
    """
    if weights is None:
        weights = {
            "onchain": 0.20,
            "builder": 0.40,
            "enhanced": 0.30,
            "social": 0.10
        }

    # Normalize weights to sum to 1.0
    total_weight = sum(weights.values())
    norm_weights = {k: v / total_weight for k, v in weights.items()}

    combined = {}

    # Loyalty: Composite of all sources
    combined["loyalty"] = (
        onchain.get("loyalty", 0) * norm_weights["onchain"] +
        builder.get("loyalty", 0) * norm_weights["builder"] +
        enhanced.get("revolutionary", 0) * norm_weights["enhanced"] * 0.3 +
        enhanced.get("technical_depth", 0) * norm_weights["enhanced"] * 0.7 +
        social.get("loyalty", 0) * norm_weights["social"]
    )

    # Ethics: Behavior + open source commitment
    combined["ethics"] = (
        onchain.get("ethics", 50) * norm_weights["onchain"] +
        builder.get("ethics", 50) * norm_weights["builder"] +
        enhanced.get("originality", 50) * norm_weights["enhanced"] +
        social.get("leadership", 50) * norm_weights["social"]
    )

    # Frequency: Activity across all platforms
    combined["frequency"] = (
        onchain.get("frequency", 0) * norm_weights["onchain"] +
        builder.get("frequency", 0) * norm_weights["builder"] +
        # Enhanced GitHub doesn't have frequency, use builder
        builder.get("frequency", 0) * norm_weights["enhanced"] +
        social.get("frequency", 0) * norm_weights["social"]
    )

    # Alignment: Innovation + ecosystem participation
    combined["alignment"] = (
        onchain.get("alignment", 50) * norm_weights["onchain"] +
        builder.get("innovation", 0) * norm_weights["builder"] +
        enhanced.get("revolutionary", 0) * norm_weights["enhanced"] +
        social.get("impact", 0) * norm_weights["social"]
    )

    # Hold Duration: On-chain only (wallet age)
    combined["holdDuration"] = onchain.get("holdDuration", 0)

    # NEW: Builder Impact (from GitHub only)
    combined["builderImpact"] = (
        builder.get("impact", 0) * 0.5 +
        enhanced.get("technical_depth", 0) * 0.3 +
        enhanced.get("revolutionary", 0) * 0.2
    )

    # NEW: Revolutionary Score (enhanced GitHub primarily)
    combined["revolutionaryScore"] = (
        enhanced.get("revolutionary", 0) * 0.7 +
        builder.get("innovation", 0) * 0.2 +
        social.get("leadership", 0) * 0.1
    )

    # NEW: Social Impact (X/Twitter primarily)
    combined["socialImpact"] = social.get("impact", 0) if social else 0

    return {k: round(v, 2) for k, v in combined.items()}


def calculate_comprehensive_multiplier(metrics: Dict[str, float]) -> float:
    """
    Calculate belief multiplier from comprehensive metrics.

    Enhanced formula with new dimensions:
    - loyalty: 20%
    - ethics: 15%
    - frequency: 10%
    - alignment: 15%
    - holdDuration: 5%
    - builderImpact: 20%
    - revolutionaryScore: 10%
    - socialImpact: 5%

    Total: 100%
    """
    # Normalize to 0-1 range
    loyalty = metrics.get("loyalty", 0) / 100.0
    ethics = metrics.get("ethics", 50) / 100.0
    frequency = metrics.get("frequency", 0) / 100.0
    alignment = metrics.get("alignment", 50) / 100.0
    hold_duration = metrics.get("holdDuration", 0) / 100.0
    builder_impact = metrics.get("builderImpact", 0) / 100.0
    revolutionary = metrics.get("revolutionaryScore", 0) / 100.0
    social_impact = metrics.get("socialImpact", 0) / 100.0

    # Comprehensive weights
    weights = {
        "loyalty": 0.20,
        "ethics": 0.15,
        "frequency": 0.10,
        "alignment": 0.15,
        "holdDuration": 0.05,
        "builderImpact": 0.20,
        "revolutionaryScore": 0.10,
        "socialImpact": 0.05
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
        builder_impact * weights["builderImpact"] +
        revolutionary * weights["revolutionaryScore"] +
        social_impact * weights["socialImpact"]
    )

    return round(multiplier, 4)


def determine_tier(multiplier: float) -> str:
    """Determine belief tier from comprehensive multiplier."""
    if multiplier >= 1.9:
        return "Legendary Builder"
    elif multiplier >= 1.7:
        return "Revolutionary"
    elif multiplier >= 1.5:
        return "Immortal Flame"
    elif multiplier >= 1.3:
        return "Ascendant"
    elif multiplier >= 1.15:
        return "Burner"
    elif multiplier >= 1.05:
        return "Glow"
    else:
        return "Spark"


def comprehensive_belief_check(
    wallet_id: str,
    github_username: Optional[str] = None,
    x_username: Optional[str] = None,
    *,
    weights: Optional[Dict[str, float]] = None
) -> Dict:
    """
    Complete comprehensive belief check.

    Args:
        wallet_id: Coinbase ID or address (e.g., bpow20.cb.id)
        github_username: GitHub username (e.g., Ghostkey316)
        x_username: X/Twitter username (e.g., ghostkey316)
        weights: Optional custom weights for data sources

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

    # Fetch enhanced GitHub metrics
    enhanced_metrics = {}
    if github_username:
        try:
            enhanced_metrics = get_enhanced_github_metrics(github_username)
        except Exception as e:
            print(f"Warning: Could not fetch enhanced GitHub metrics: {e}")
            enhanced_metrics = {
                "revolutionary": 0,
                "technical_depth": 0,
                "originality": 0
            }

    # Fetch social metrics
    social_metrics = {}
    if x_username:
        try:
            social_metrics = get_social_metrics(x_username)
        except Exception as e:
            print(f"Warning: Could not fetch social metrics: {e}")
            print(f"Note: Requires X_BEARER_TOKEN environment variable")
            social_metrics = {
                "loyalty": 0,
                "impact": 0,
                "leadership": 0,
                "frequency": 0
            }

    # Combine metrics
    if any([builder_metrics, enhanced_metrics, social_metrics]):
        combined_metrics = combine_all_metrics(
            onchain_metrics,
            builder_metrics,
            enhanced_metrics,
            social_metrics,
            weights=weights
        )
        method = "comprehensive"
    else:
        # No builder/social data, use on-chain only
        combined_metrics = {
            **onchain_metrics,
            "builderImpact": 0,
            "revolutionaryScore": 0,
            "socialImpact": 0
        }
        method = "onchain_only"

    # Calculate multiplier
    multiplier = calculate_comprehensive_multiplier(combined_metrics)
    tier = determine_tier(multiplier)

    return {
        "wallet_id": wallet_id,
        "github_username": github_username,
        "x_username": x_username,
        "onchain_metrics": onchain_metrics,
        "builder_metrics": builder_metrics,
        "enhanced_metrics": enhanced_metrics,
        "social_metrics": social_metrics,
        "combined_metrics": combined_metrics,
        "multiplier": multiplier,
        "tier": tier,
        "method": method
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python comprehensive_belief_scorer.py <wallet_id> [github_username] [x_username]")
        print("Example: python comprehensive_belief_scorer.py bpow20.cb.id Ghostkey316 ghostkey316")
        sys.exit(1)

    wallet_id = sys.argv[1]
    github_username = sys.argv[2] if len(sys.argv) > 2 else None
    x_username = sys.argv[3] if len(sys.argv) > 3 else None

    print(f"\n{'='*70}")
    print(f"COMPREHENSIVE BELIEF CHECK")
    print(f"{'='*70}\n")

    print(f"Wallet:  {wallet_id}")
    if github_username:
        print(f"GitHub:  {github_username}")
    if x_username:
        print(f"X:       @{x_username}")
    print()

    try:
        result = comprehensive_belief_check(wallet_id, github_username, x_username)

        print("ON-CHAIN METRICS:")
        print("-" * 70)
        for key, value in result["onchain_metrics"].items():
            print(f"  {key:15s}: {value:6.2f}/100")

        if result["builder_metrics"]:
            print("\nBUILDER METRICS (GitHub):")
            print("-" * 70)
            for key, value in result["builder_metrics"].items():
                print(f"  {key:15s}: {value:6.2f}/100")

        if result["enhanced_metrics"]:
            print("\nENHANCED GITHUB METRICS:")
            print("-" * 70)
            for key, value in result["enhanced_metrics"].items():
                print(f"  {key:15s}: {value:6.2f}/100")

        if result["social_metrics"]:
            print("\nSOCIAL METRICS (X/Twitter):")
            print("-" * 70)
            for key, value in result["social_metrics"].items():
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

        print("\nINTERPRETATION:")
        print("-" * 70)
        if result["multiplier"] >= 1.9:
            print("  🚀 LEGENDARY BUILDER - Unprecedented revolutionary contributions")
        elif result["multiplier"] >= 1.7:
            print("  💎 REVOLUTIONARY - Groundbreaking innovations")
        elif result["multiplier"] >= 1.5:
            print("  🔥 IMMORTAL FLAME - Exceptional builder + believer")
        elif result["multiplier"] >= 1.3:
            print("  ⭐ ASCENDANT - Strong contributions")
        elif result["multiplier"] >= 1.15:
            print("  ✓  BURNER - Good contributions")
        else:
            print("  ○  BUILDING - Early stage")

        print(f"\n{'='*70}\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
