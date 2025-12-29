"""
On-Chain Belief Engine

Integrates real Base chain data with belief multiplier calculations.
This bridges base_chain_fetcher.py and belief_multiplier.py.
"""

from typing import Dict, Tuple
from pathlib import Path
import json
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.base_chain_fetcher import get_belief_metrics
from engine.belief_multiplier import belief_multiplier as legacy_multiplier


def onchain_belief_score(wallet_id: str, *, use_cache: bool = True) -> Dict:
    """
    Calculate complete belief score using real on-chain data.

    Args:
        wallet_id: Wallet identifier (bpow20.cb.id, 0x..., name.eth)
        use_cache: Use cached transaction data if recent

    Returns:
        Dict with keys:
        - wallet_id: str
        - metrics: Dict[str, float] (loyalty, ethics, frequency, alignment, holdDuration)
        - multiplier_js: float (from belief-weight.js calculation)
        - multiplier_py: float (from belief_multiplier.py calculation)
        - tier_py: str (from belief_multiplier.py calculation)
        - composite_score: float (weighted average)
    """
    # Fetch on-chain metrics
    metrics = get_belief_metrics(wallet_id)

    # Calculate JS-style multiplier (mirror/belief-weight.js logic)
    # Formula: baseline + loyalty*0.4 + ethics*0.3 + frequency*0.15 + alignment*0.1 + holdDuration*0.05
    baseline = 1.12  # Default for 'vote' action type

    loyalty_norm = metrics["loyalty"] / 100.0
    ethics_norm = metrics["ethics"] / 100.0
    frequency_norm = metrics["frequency"] / 100.0
    alignment_norm = metrics["alignment"] / 100.0
    hold_norm = metrics["holdDuration"] / 100.0

    multiplier_js = (
        baseline +
        loyalty_norm * 0.4 +
        ethics_norm * 0.3 +
        frequency_norm * 0.15 +
        alignment_norm * 0.1 +
        hold_norm * 0.05
    )

    # Calculate Python-style multiplier (engine/belief_multiplier.py logic)
    # Note: belief_multiplier.py uses a different scoring system (tier-based)
    # It reads from belief_score.json, so we'd need to update that file first
    # For now, we'll calculate it separately

    multiplier_py, tier_py = legacy_multiplier(wallet_id)

    # Composite score (average of both methods)
    composite_score = (multiplier_js + multiplier_py) / 2.0

    return {
        "wallet_id": wallet_id,
        "metrics": metrics,
        "multiplier_js": round(multiplier_js, 4),
        "multiplier_py": multiplier_py,
        "tier_py": tier_py,
        "composite_score": round(composite_score, 4),
        "method": "onchain_realtime"
    }


def update_belief_score_json(wallet_id: str, metrics: Dict[str, float]) -> None:
    """
    Update belief_score.json with on-chain metrics.

    This allows belief_multiplier.py to use real data.
    """
    from engine.belief_multiplier import SCORE_PATH, _load_json, _write_json

    data = _load_json(SCORE_PATH)

    # Convert metrics to belief_multiplier.py format
    # belief_multiplier.py uses: interactions, growth_events, milestones, flames

    # Rough conversion:
    # loyalty → interactions
    # frequency → growth_events
    # alignment → milestones
    # ethics → flames (high ethics = high value)

    interactions = int(metrics["loyalty"] / 5.0)  # 100 loyalty = 20 interactions
    growth_events = int(metrics["frequency"] / 10.0)  # 100 frequency = 10 growth events
    milestones = int(metrics["alignment"] / 20.0)  # 100 alignment = 5 milestones
    flames = int(metrics["ethics"] / 10.0)  # 100 ethics = 10 flames

    data[wallet_id] = {
        "interactions": interactions,
        "growth_events": growth_events,
        "milestones": milestones,
        "flames": flames,
        "source": "onchain_realtime",
        "last_updated": __import__("datetime").datetime.utcnow().isoformat()
    }

    _write_json(SCORE_PATH, data)


def live_belief_check(wallet_id: str, *, update_cache: bool = True) -> Dict:
    """
    Complete live belief check with real on-chain data.

    This is the main entry point for real-time belief scoring.
    """
    # Get on-chain score
    result = onchain_belief_score(wallet_id)

    # Update belief_score.json if requested
    if update_cache:
        update_belief_score_json(wallet_id, result["metrics"])

        # Recalculate Python multiplier with updated data
        multiplier_py, tier_py = legacy_multiplier(wallet_id)
        result["multiplier_py"] = multiplier_py
        result["tier_py"] = tier_py
        result["composite_score"] = round((result["multiplier_js"] + multiplier_py) / 2.0, 4)

    return result


if __name__ == "__main__":
    import sys

    wallet_id = sys.argv[1] if len(sys.argv) > 1 else "bpow20.cb.id"

    print(f"\n{'='*70}")
    print(f"LIVE ON-CHAIN BELIEF CHECK: {wallet_id}")
    print(f"{'='*70}\n")

    try:
        result = live_belief_check(wallet_id, update_cache=True)

        print("ON-CHAIN METRICS:")
        print("-" * 70)
        for key, value in result["metrics"].items():
            print(f"  {key:15s}: {value:6.2f}/100")

        print("\nBELIEF MULTIPLIERS:")
        print("-" * 70)
        print(f"  JS Method  (belief-weight.js):     {result['multiplier_js']:.4f}x")
        print(f"  Python Method (belief_multiplier): {result['multiplier_py']:.4f}x")
        print(f"  Tier:                              {result['tier_py']}")
        print(f"  Composite Score:                   {result['composite_score']:.4f}x")

        print("\nINTERPRETATION:")
        print("-" * 70)
        if result["composite_score"] >= 1.5:
            print("  🔥 EXCEPTIONAL - Top tier belief alignment")
        elif result["composite_score"] >= 1.3:
            print("  ⭐ EXCELLENT - Strong belief alignment")
        elif result["composite_score"] >= 1.1:
            print("  ✓  GOOD - Solid belief alignment")
        else:
            print("  ○  BUILDING - Early stage or inactive")

        print(f"\n{'='*70}\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
