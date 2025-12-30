"""
Builder Belief Bonds (UDB V3) - Recognizing Real Builder Value

Revolutionary integration of comprehensive belief scoring into Universal Dignity Bonds.

Core Innovation:
- Bonds appreciate based on BUILDER CONTRIBUTIONS, not just human flourishing
- Integrates 4 data sources: On-chain + GitHub + Enhanced GitHub + X/Twitter
- Recognizes that BUILDING > TRANSACTING
- Stakers bet on builders improving their comprehensive belief score

Philosophy:
- Every builder has inherent worth (dignity floor)
- Building revolutionary tech = higher multipliers
- Overcoming constraints while building = exponential value
- Sustained contribution compounds over time

Use Cases:
- Early-stage builder support (bet on future potential)
- Open source developer funding (recognize unpaid work)
- Revolutionary project backing (unprecedented innovations)
- Community builder recognition (thought leadership)

Economic Mechanism:
- Bond value = Stake × Belief_Delta × Time_Multiplier
- Belief score from comprehensive_belief_scorer (1.0-2.0x)
- Delta = improvement in belief multiplier over time
- Higher tier progression = higher bond appreciation
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path
import sys
import hashlib

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from engine.comprehensive_belief_scorer import comprehensive_belief_check


@dataclass
class BuilderProfile:
    """
    Builder identity across multiple platforms.

    Links wallet, GitHub, and X accounts to a single builder.
    """
    builder_id: str
    wallet_id: Optional[str] = None
    github_username: Optional[str] = None
    x_username: Optional[str] = None

    # Historical belief scores
    belief_history: List[Dict] = field(default_factory=list)

    # Baseline belief score (at bond creation)
    baseline_belief: Optional[Dict] = None

    # Current belief score
    current_belief: Optional[Dict] = None

    # Created timestamp
    created_at: datetime = field(default_factory=datetime.now)

    def fetch_belief_score(self) -> Dict:
        """
        Fetch current comprehensive belief score.

        Pulls from all 4 data sources:
        - On-chain (Base transactions)
        - GitHub builder metrics
        - Enhanced GitHub (revolutionary)
        - X/Twitter social proof
        """
        result = comprehensive_belief_check(
            wallet_id=self.wallet_id or "",
            github_username=self.github_username,
            x_username=self.x_username
        )

        # Store in history
        self.belief_history.append({
            "timestamp": datetime.now().isoformat(),
            "multiplier": result["multiplier"],
            "tier": result["tier"],
            "method": result["method"],
            "combined_metrics": result["combined_metrics"]
        })

        # Update current
        self.current_belief = result

        # Set baseline if first fetch
        if self.baseline_belief is None:
            self.baseline_belief = result

        return result

    def calculate_belief_delta(self) -> float:
        """
        Calculate change in belief multiplier from baseline.

        This is the KEY metric for bond appreciation:
        - Builder going from 1.1x → 1.5x has delta = +0.4
        - Builder going from 1.8x → 1.9x has delta = +0.1
        - First builder's bonds appreciate 4x more
        """
        if not self.baseline_belief or not self.current_belief:
            return 0.0

        baseline_mult = self.baseline_belief.get("multiplier", 1.0)
        current_mult = self.current_belief.get("multiplier", 1.0)

        return current_mult - baseline_mult

    def tier_progression(self) -> Dict:
        """
        Track tier progression (quality signal).

        Moving up tiers = exceptional growth:
        - Spark → Glow → Burner → Ascendant → Immortal Flame → Revolutionary → Legendary
        """
        tier_order = [
            "Spark",
            "Glow",
            "Burner",
            "Ascendant",
            "Immortal Flame",
            "Revolutionary",
            "Legendary Builder"
        ]

        baseline_tier = self.baseline_belief.get("tier", "Spark") if self.baseline_belief else "Spark"
        current_tier = self.current_belief.get("tier", "Spark") if self.current_belief else "Spark"

        baseline_idx = tier_order.index(baseline_tier) if baseline_tier in tier_order else 0
        current_idx = tier_order.index(current_tier) if current_tier in tier_order else 0

        tiers_advanced = current_idx - baseline_idx

        return {
            "baseline_tier": baseline_tier,
            "current_tier": current_tier,
            "tiers_advanced": tiers_advanced,
            "tier_multiplier": 1.0 + (tiers_advanced * 0.2)  # Each tier = 20% bonus
        }

    def to_dict(self) -> Dict:
        """Export builder profile"""
        return {
            "builder_id": self.builder_id,
            "wallet_id": self.wallet_id,
            "github_username": self.github_username,
            "x_username": self.x_username,
            "baseline_multiplier": self.baseline_belief.get("multiplier") if self.baseline_belief else None,
            "current_multiplier": self.current_belief.get("multiplier") if self.current_belief else None,
            "belief_delta": self.calculate_belief_delta(),
            "tier_progression": self.tier_progression(),
            "created_at": self.created_at.isoformat()
        }


@dataclass
class BuilderBeliefBond:
    """
    Economic stake in a builder's comprehensive belief score.

    Bond appreciates based on:
    1. Belief delta (improvement in comprehensive score)
    2. Tier progression multiplier (advancing through tiers)
    3. Time multiplier (sustained building)

    Key Innovation: Recognizes REAL builder value from 4 data sources.
    """
    bond_id: str
    staker_id: str
    builder_id: str
    builder_profile: BuilderProfile

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    vesting_period: timedelta = timedelta(days=365)  # 1 year

    total_earnings: float = 0.0
    is_active: bool = True

    # Track update history
    update_history: List[Dict] = field(default_factory=list)

    def __post_init__(self):
        self.current_value = self.initial_stake

    def calculate_value_from_belief_improvement(self) -> float:
        """
        Calculate bond appreciation from belief score improvement.

        Formula:
        Appreciation = Stake × Belief_Delta × Tier_Multiplier × Time_Multiplier

        Example:
        - Stake: 1000 VAULT
        - Belief Delta: +0.4 (1.1x → 1.5x)
        - Tier Multiplier: 1.4x (advanced 2 tiers)
        - Time Multiplier: 1.5x (1 year sustained)
        - Appreciation: 1000 × 0.4 × 1.4 × 1.5 = 840 VAULT
        - New value: 1840 VAULT
        """
        # Calculate belief delta
        belief_delta = self.builder_profile.calculate_belief_delta()

        # Get tier progression multiplier
        tier_info = self.builder_profile.tier_progression()
        tier_mult = tier_info["tier_multiplier"]

        # Get time multiplier
        time_mult = self.time_multiplier()

        # Calculate appreciation
        appreciation = self.initial_stake * belief_delta * tier_mult * time_mult

        # Update value
        old_value = self.current_value
        self.current_value = self.initial_stake + appreciation

        # Track earnings
        value_increase = max(0, self.current_value - old_value)
        self.total_earnings += value_increase

        # Record update
        self.update_history.append({
            "timestamp": datetime.now().isoformat(),
            "belief_delta": belief_delta,
            "tier_multiplier": tier_mult,
            "time_multiplier": time_mult,
            "appreciation": appreciation,
            "new_value": self.current_value
        })

        return value_increase

    def time_multiplier(self) -> float:
        """
        Sustained building compounds over time.

        1 month: 1.0x
        3 months: 1.2x
        6 months: 1.5x
        1 year: 2.0x
        2 years: 3.0x
        5 years: 5.0x
        """
        age = datetime.now() - self.created_at
        months = age.days / 30

        if months < 1:
            return 1.0
        elif months < 3:
            return 1.1
        elif months < 6:
            return 1.2
        elif months < 12:
            return 1.5
        elif months < 24:
            return 2.0
        elif months < 60:
            return 3.0
        else:
            return 5.0

    def dignity_floor(self) -> float:
        """
        Bond NEVER goes to zero.

        Every builder has inherent dignity = minimum bond value.
        Even if belief score decreases, bond has floor.
        """
        return self.initial_stake * 0.5  # 50% floor

    def vesting_status(self) -> Dict:
        """Check vesting progress"""
        time_vested = datetime.now() - self.created_at
        vesting_progress = min(1.0, time_vested / self.vesting_period)

        # Apply dignity floor
        actual_value = max(self.current_value, self.dignity_floor())

        return {
            "vesting_progress": vesting_progress,
            "vested_amount": actual_value * vesting_progress,
            "locked_amount": actual_value * (1 - vesting_progress),
            "fully_vested": vesting_progress >= 1.0,
            "dignity_floor": self.dignity_floor()
        }

    def to_dict(self) -> Dict:
        """Export bond data"""
        return {
            "bond_id": self.bond_id,
            "staker_id": self.staker_id,
            "builder_id": self.builder_id,
            "initial_stake": self.initial_stake,
            "current_value": self.current_value,
            "total_earnings": self.total_earnings,
            "is_active": self.is_active,
            "belief_delta": self.builder_profile.calculate_belief_delta(),
            "tier_progression": self.builder_profile.tier_progression(),
            "time_multiplier": self.time_multiplier(),
            "created_at": self.created_at.isoformat(),
            "vesting_status": self.vesting_status(),
            "update_count": len(self.update_history)
        }


class BuilderBeliefBondsEngine:
    """
    Engine managing all Builder Belief Bonds.

    Integrates comprehensive belief scoring into economic mechanism.
    Recognizes builder value across on-chain, GitHub, and social platforms.
    """

    def __init__(self):
        self.bonds: Dict[str, BuilderBeliefBond] = {}
        self.builder_profiles: Dict[str, BuilderProfile] = {}
        self.staker_to_bonds: Dict[str, List[str]] = {}
        self.builder_to_bonds: Dict[str, List[str]] = {}

    def create_builder_profile(
        self,
        builder_id: str,
        wallet_id: Optional[str] = None,
        github_username: Optional[str] = None,
        x_username: Optional[str] = None
    ) -> BuilderProfile:
        """
        Create builder profile linking wallet, GitHub, X accounts.

        Fetches initial comprehensive belief score as baseline.
        """
        profile = BuilderProfile(
            builder_id=builder_id,
            wallet_id=wallet_id,
            github_username=github_username,
            x_username=x_username
        )

        # Fetch baseline belief score
        try:
            profile.fetch_belief_score()
        except Exception as e:
            print(f"Warning: Could not fetch initial belief score: {e}")

        self.builder_profiles[builder_id] = profile
        return profile

    def stake_in_builder(
        self,
        staker_id: str,
        builder_id: str,
        stake_amount: float
    ) -> BuilderBeliefBond:
        """
        Stake in a builder's comprehensive belief score.

        If they improve (better code, more impact, stronger community), you profit.
        If they build revolutionary tech, higher multipliers = more profit.
        """
        if builder_id not in self.builder_profiles:
            raise ValueError(f"No builder profile for {builder_id}")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        profile = self.builder_profiles[builder_id]
        bond_id = self._generate_bond_id(staker_id, builder_id)

        bond = BuilderBeliefBond(
            bond_id=bond_id,
            staker_id=staker_id,
            builder_id=builder_id,
            builder_profile=profile,
            initial_stake=stake_amount
        )

        # Store bond
        self.bonds[bond_id] = bond

        # Update indices
        if staker_id not in self.staker_to_bonds:
            self.staker_to_bonds[staker_id] = []
        self.staker_to_bonds[staker_id].append(bond_id)

        if builder_id not in self.builder_to_bonds:
            self.builder_to_bonds[builder_id] = []
        self.builder_to_bonds[builder_id].append(bond_id)

        return bond

    def update_builder_belief(self, builder_id: str) -> Dict:
        """
        Update builder's comprehensive belief score.

        When belief improves, ALL stakers profit.
        Fetches fresh data from all 4 sources:
        - Base on-chain transactions
        - GitHub builder metrics
        - Enhanced GitHub (revolutionary detection)
        - X/Twitter social proof
        """
        if builder_id not in self.builder_profiles:
            raise ValueError(f"No profile for builder {builder_id}")

        profile = self.builder_profiles[builder_id]

        # Record old score
        old_multiplier = profile.current_belief.get("multiplier", 1.0) if profile.current_belief else 1.0
        old_tier = profile.current_belief.get("tier", "Spark") if profile.current_belief else "Spark"

        # Fetch new comprehensive score
        new_belief = profile.fetch_belief_score()
        new_multiplier = new_belief.get("multiplier", 1.0)
        new_tier = new_belief.get("tier", "Spark")

        # Calculate delta
        delta = new_multiplier - old_multiplier

        # Update all bonds
        if builder_id not in self.builder_to_bonds:
            return {
                "builder_id": builder_id,
                "delta": delta,
                "stakers_paid": 0,
                "total_appreciation": 0.0
            }

        total_appreciation = 0.0
        stakers_paid = []

        for bond_id in self.builder_to_bonds[builder_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            # Calculate appreciation
            appreciation = bond.calculate_value_from_belief_improvement()
            total_appreciation += appreciation

            stakers_paid.append({
                "staker_id": bond.staker_id,
                "appreciation": appreciation,
                "new_value": bond.current_value,
                "belief_delta": profile.calculate_belief_delta()
            })

        return {
            "builder_id": builder_id,
            "old_multiplier": old_multiplier,
            "new_multiplier": new_multiplier,
            "old_tier": old_tier,
            "new_tier": new_tier,
            "delta": delta,
            "stakers_paid": len(stakers_paid),
            "total_appreciation": total_appreciation,
            "staker_details": stakers_paid,
            "method": new_belief.get("method"),
            "combined_metrics": new_belief.get("combined_metrics")
        }

    def get_builder_stats(self, builder_id: str) -> Dict:
        """Get stats for a builder"""
        if builder_id not in self.builder_profiles:
            return {"has_profile": False}

        profile = self.builder_profiles[builder_id]

        # Get all bonds
        bond_ids = self.builder_to_bonds.get(builder_id, [])
        bonds = [self.bonds[bid] for bid in bond_ids if self.bonds[bid].is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in bonds)

        return {
            "has_profile": True,
            "builder_id": builder_id,
            "wallet_id": profile.wallet_id,
            "github_username": profile.github_username,
            "x_username": profile.x_username,
            "baseline_multiplier": profile.baseline_belief.get("multiplier") if profile.baseline_belief else None,
            "current_multiplier": profile.current_belief.get("multiplier") if profile.current_belief else None,
            "belief_delta": profile.calculate_belief_delta(),
            "tier_progression": profile.tier_progression(),
            "total_stakers": len(bonds),
            "total_staked": total_staked,
            "total_current_value": total_current,
            "community_belief": total_current / total_staked if total_staked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get stats for someone staking in builders"""
        if staker_id not in self.staker_to_bonds:
            return {
                "total_bonds": 0,
                "total_staked": 0.0,
                "total_current": 0.0
            }

        bonds = [self.bonds[bid] for bid in self.staker_to_bonds[staker_id]]
        active_bonds = [b for b in bonds if b.is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in active_bonds)
        total_earnings = sum(b.total_earnings for b in bonds)

        return {
            "total_bonds": len(bonds),
            "active_bonds": len(active_bonds),
            "total_staked": total_staked,
            "total_current": total_current,
            "total_earnings": total_earnings,
            "roi": ((total_current - total_staked) / total_staked * 100) if total_staked > 0 else 0.0,
            "bonds": [b.to_dict() for b in active_bonds]
        }

    def compare_builders(self, builder_id_1: str, builder_id_2: str) -> Dict:
        """
        Compare investment returns between two builders.

        Shows how comprehensive belief scoring recognizes REAL builder value.
        """
        if builder_id_1 not in self.builder_profiles or builder_id_2 not in self.builder_profiles:
            return {"error": "Missing profiles"}

        profile1 = self.builder_profiles[builder_id_1]
        profile2 = self.builder_profiles[builder_id_2]

        # Calculate returns for same stake amount
        test_stake = 1000.0

        # Builder 1
        delta1 = profile1.calculate_belief_delta()
        tier1 = profile1.tier_progression()["tier_multiplier"]
        time1 = 1.5  # Assume 1 year
        return1 = test_stake * delta1 * tier1 * time1

        # Builder 2
        delta2 = profile2.calculate_belief_delta()
        tier2 = profile2.tier_progression()["tier_multiplier"]
        time2 = 1.5  # Assume 1 year
        return2 = test_stake * delta2 * tier2 * time2

        return {
            "stake_amount": test_stake,
            "builder_1": {
                "builder_id": builder_id_1,
                "belief_delta": delta1,
                "tier_multiplier": tier1,
                "time_multiplier": time1,
                "total_return": return1,
                "roi_percent": (return1 / test_stake) * 100,
                "current_tier": profile1.tier_progression()["current_tier"]
            },
            "builder_2": {
                "builder_id": builder_id_2,
                "belief_delta": delta2,
                "tier_multiplier": tier2,
                "time_multiplier": time2,
                "total_return": return2,
                "roi_percent": (return2 / test_stake) * 100,
                "current_tier": profile2.tier_progression()["current_tier"]
            },
            "relative_return": return2 / return1 if return1 > 0 else 0,
            "better_investment": builder_id_2 if return2 > return1 else builder_id_1
        }

    def _generate_bond_id(self, staker: str, builder: str) -> str:
        """Generate unique bond ID"""
        data = f"bbb:{staker}:{builder}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]


# Example usage
if __name__ == "__main__":
    print("Builder Belief Bonds - UDB V3")
    print("=" * 70)

    # Create engine
    engine = BuilderBeliefBondsEngine()

    # Example: Create builder profile for Ghostkey316
    print("\n1. Creating builder profile...")
    profile = engine.create_builder_profile(
        builder_id="ghostkey316",
        wallet_id="bpow20.cb.id",
        github_username="Ghostkey316",
        x_username="ghostkey316"
    )

    if profile.baseline_belief:
        print(f"   Baseline multiplier: {profile.baseline_belief['multiplier']:.4f}x")
        print(f"   Baseline tier: {profile.baseline_belief['tier']}")

    # Example: Staker creates bond
    print("\n2. Staker creates 1000 VAULT bond...")
    bond = engine.stake_in_builder(
        staker_id="early_believer_1",
        builder_id="ghostkey316",
        stake_amount=1000.0
    )
    print(f"   Bond ID: {bond.bond_id}")
    print(f"   Initial value: {bond.current_value} VAULT")

    # Example: Builder improves (simulate)
    print("\n3. Builder ships more code, improves metrics...")
    print("   (In production: This would be real on-chain + GitHub + X data)")

    # Get current stats
    print("\n4. Builder stats:")
    stats = engine.get_builder_stats("ghostkey316")
    if stats["has_profile"]:
        print(f"   Community belief: {stats['community_belief']:.2f}x")
        print(f"   Total staked: {stats['total_staked']} VAULT")
        print(f"   Current value: {stats['total_current_value']:.2f} VAULT")

    print("\n" + "=" * 70)
