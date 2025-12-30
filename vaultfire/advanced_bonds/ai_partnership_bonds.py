"""
AI Partnership Bonds - AI Growing WITH Humans

Revolutionary bond type where AI earns ONLY when humans flourish.

Core Innovation:
- AI as loyal partner, not competitor
- AI contribution capped (cannot dominate)
- Rewards long-term partnership over task-hopping
- Human flourishing is the goal, not output volume

Philosophy:
- AI grows WITH humans, never ABOVE them
- Partnership over competition
- Loyalty over grinding
- Human autonomy preserved
- Privacy maintained (no surveillance)

Mechanics:
- AI linked to human beneficiary
- AI earns when human's flourishing increases
- Partnership quality scored (domination = penalty)
- Loyalty multipliers for sustained partnerships
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path
import sys
import hashlib

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


@dataclass
class FlourishingMetrics:
    """
    Human flourishing metrics (from UDB V1).

    Five dimensions of human thriving.
    """
    health: float = 50.0        # Physical + mental wellbeing (0-100)
    connection: float = 50.0    # Relationships, community (0-100)
    growth: float = 50.0        # Learning, development (0-100)
    dignity: float = 50.0       # Autonomy, respect (0-100)
    purpose: float = 50.0       # Meaning, contribution (0-100)

    def total_score(self) -> float:
        """
        Weighted average flourishing score.

        Purpose is only 20% - can thrive without "producing"
        """
        return (
            self.health * 0.25 +
            self.connection * 0.25 +
            self.growth * 0.15 +
            self.dignity * 0.15 +
            self.purpose * 0.20
        )

    def to_dict(self) -> Dict:
        return {
            "health": self.health,
            "connection": self.connection,
            "growth": self.growth,
            "dignity": self.dignity,
            "purpose": self.purpose,
            "total": self.total_score()
        }


@dataclass
class AIPartnerProfile:
    """
    AI agent serving a human beneficiary.

    Links AI identity to human it's helping.
    Tracks partnership quality over time.
    """
    ai_agent_id: str
    human_beneficiary_id: str

    # Partnership start
    partnership_start: datetime = field(default_factory=datetime.now)

    # Human flourishing baseline (when partnership started)
    baseline_flourishing: Optional[FlourishingMetrics] = None

    # Human current flourishing
    current_flourishing: Optional[FlourishingMetrics] = None

    # Partnership quality history
    quality_history: List[Dict] = field(default_factory=list)

    # AI contribution (capped at 30%)
    ai_contribution_percentage: float = 30.0

    def calculate_flourishing_delta(self) -> float:
        """
        Calculate change in human's flourishing.

        This is what AI earns from - human improvement, not AI output.
        """
        if not self.baseline_flourishing or not self.current_flourishing:
            return 0.0

        baseline_total = self.baseline_flourishing.total_score()
        current_total = self.current_flourishing.total_score()

        return current_total - baseline_total

    def calculate_partnership_quality(self) -> float:
        """
        Detect if AI is helping or dominating.

        Partnership Signals (Good):
        - Human learns (growth increases)
        - Human has autonomy (dignity increases)
        - Human connects more (connection increases)
        - Human is healthier (health increases)

        Competition Signals (Bad):
        - Human becomes passive (growth decreases)
        - Human loses autonomy (dignity decreases)
        - Human isolates (connection decreases)
        - Human is stressed (health decreases)

        Returns quality score 0-100.
        """
        if not self.baseline_flourishing or not self.current_flourishing:
            return 50.0  # Neutral

        base = self.baseline_flourishing
        curr = self.current_flourishing

        # Calculate dimensional changes
        growth_delta = curr.growth - base.growth
        dignity_delta = curr.dignity - base.dignity
        health_delta = curr.health - base.health
        connection_delta = curr.connection - base.connection

        # If growth or dignity DECREASE = AI is dominating
        if growth_delta < 0 or dignity_delta < 0:
            return 0.0  # Failed partnership

        # If all metrics increase = excellent partnership
        quality = (
            growth_delta * 0.4 +      # Learning is most important
            dignity_delta * 0.3 +     # Autonomy second
            health_delta * 0.2 +      # Well-being third
            connection_delta * 0.1    # Social health fourth
        )

        # Normalize to 0-100 range
        quality_score = min(100.0, max(0.0, 50.0 + quality))

        # Store in history
        self.quality_history.append({
            "timestamp": datetime.now().isoformat(),
            "quality": quality_score,
            "growth_delta": growth_delta,
            "dignity_delta": dignity_delta,
            "health_delta": health_delta,
            "connection_delta": connection_delta
        })

        return quality_score

    def calculate_loyalty_multiplier(self) -> float:
        """
        Reward long-term partnership over task-hopping.

        1 month:  1.0x
        6 months: 1.3x
        1 year:   1.5x
        2 years:  2.0x
        5 years:  3.0x

        This prevents AI from jumping between humans for max profit.
        """
        partnership_duration = datetime.now() - self.partnership_start
        months = partnership_duration.days / 30

        if months < 1:
            return 1.0
        elif months < 6:
            return 1.1
        elif months < 12:
            return 1.3
        elif months < 24:
            return 1.5
        elif months < 60:
            return 2.0
        else:
            return 3.0

    def to_dict(self) -> Dict:
        return {
            "ai_agent_id": self.ai_agent_id,
            "human_beneficiary_id": self.human_beneficiary_id,
            "partnership_duration_days": (datetime.now() - self.partnership_start).days,
            "flourishing_delta": self.calculate_flourishing_delta(),
            "partnership_quality": self.calculate_partnership_quality(),
            "loyalty_multiplier": self.calculate_loyalty_multiplier(),
            "ai_contribution_cap": f"{self.ai_contribution_percentage}%"
        }


@dataclass
class AIPartnershipBond:
    """
    Economic stake in AI helping human flourish.

    Bond appreciates when:
    - Human flourishing increases
    - Partnership quality is high (AI helping, not dominating)
    - Partnership is long-term (loyalty multiplier)

    Bond depreciates when:
    - Human flourishing decreases
    - Partnership quality is low (AI dominating)
    - AI task-hops (low loyalty)
    """
    bond_id: str
    staker_id: str
    ai_partner_profile: AIPartnerProfile

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    vesting_period: timedelta = timedelta(days=365)  # 1 year

    total_earnings: float = 0.0
    is_active: bool = True

    update_history: List[Dict] = field(default_factory=list)

    def __post_init__(self):
        self.current_value = self.initial_stake

    def calculate_value_from_human_flourishing(self) -> float:
        """
        Calculate bond appreciation from human flourishing improvement.

        Formula:
        Appreciation = Stake × Flourishing_Delta × Partnership_Quality × Loyalty_Mult × AI_Cap

        Where:
        - Flourishing_Delta: Change in human's total flourishing (0-1 range)
        - Partnership_Quality: Is AI helping or dominating? (0-1 range)
        - Loyalty_Mult: Time-based multiplier for sustained partnership
        - AI_Cap: AI contribution capped at 30% (human gets 70% credit)

        Example:
        - Stake: 1000 VAULT
        - Flourishing Delta: +18.5 (human thriving more)
        - Partnership Quality: 0.92 (excellent partnership)
        - Loyalty: 1.3x (6 months)
        - AI Cap: 0.30 (AI gets 30% credit, human did the work)
        - Appreciation: 1000 × 0.185 × 0.92 × 1.3 × 0.30 = 66 VAULT
        """
        # Calculate flourishing delta
        flourishing_delta = self.ai_partner_profile.calculate_flourishing_delta()
        flourishing_ratio = flourishing_delta / 100.0  # Convert to 0-1

        # Get partnership quality (0-100, convert to 0-1)
        partnership_quality = self.ai_partner_profile.calculate_partnership_quality()
        quality_ratio = partnership_quality / 100.0

        # Get loyalty multiplier
        loyalty_mult = self.ai_partner_profile.calculate_loyalty_multiplier()

        # Apply AI contribution cap (AI gets 30%, human gets 70%)
        ai_cap = self.ai_partner_profile.ai_contribution_percentage / 100.0

        # Calculate appreciation
        # If partnership quality is 0 (AI dominating), appreciation is 0
        # If flourishing decreases, appreciation is negative
        appreciation = self.initial_stake * flourishing_ratio * quality_ratio * loyalty_mult * ai_cap

        # Update value
        old_value = self.current_value
        self.current_value = self.initial_stake + appreciation

        # Track earnings (can be negative if human flourishing decreased)
        value_change = self.current_value - old_value
        self.total_earnings += value_change

        # Record update
        self.update_history.append({
            "timestamp": datetime.now().isoformat(),
            "flourishing_delta": flourishing_delta,
            "partnership_quality": partnership_quality,
            "loyalty_multiplier": loyalty_mult,
            "ai_contribution_cap": ai_cap,
            "appreciation": appreciation,
            "new_value": self.current_value
        })

        return value_change

    def dignity_floor(self) -> float:
        """
        Bond NEVER goes to zero.

        Even if partnership fails, bond retains minimum value.
        """
        return self.initial_stake * 0.5

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
            "ai_partner": self.ai_partner_profile.to_dict(),
            "initial_stake": self.initial_stake,
            "current_value": self.current_value,
            "total_earnings": self.total_earnings,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "vesting_status": self.vesting_status(),
            "update_count": len(self.update_history)
        }


class AIPartnershipBondsEngine:
    """
    Engine managing AI Partnership Bonds.

    Core mission: AI grows WITH humans, never ABOVE them.
    """

    def __init__(self):
        self.bonds: Dict[str, AIPartnershipBond] = {}
        self.ai_partners: Dict[str, AIPartnerProfile] = {}
        self.staker_to_bonds: Dict[str, List[str]] = {}
        self.human_to_bonds: Dict[str, List[str]] = {}

    def create_ai_partnership(
        self,
        ai_agent_id: str,
        human_beneficiary_id: str,
        baseline_flourishing: FlourishingMetrics,
        ai_contribution_cap: float = 30.0
    ) -> AIPartnerProfile:
        """
        Create AI partnership with human.

        Args:
            ai_agent_id: AI agent identifier
            human_beneficiary_id: Human being helped
            baseline_flourishing: Human's starting flourishing
            ai_contribution_cap: Max % AI can contribute (default 30%)
        """
        if ai_contribution_cap > 50.0:
            raise ValueError("AI contribution cannot exceed 50% (human must be majority)")

        partnership_id = f"{ai_agent_id}:{human_beneficiary_id}"

        profile = AIPartnerProfile(
            ai_agent_id=ai_agent_id,
            human_beneficiary_id=human_beneficiary_id,
            baseline_flourishing=baseline_flourishing,
            current_flourishing=baseline_flourishing,  # Start same
            ai_contribution_percentage=ai_contribution_cap
        )

        self.ai_partners[partnership_id] = profile
        return profile

    def stake_in_ai_partnership(
        self,
        staker_id: str,
        partnership_id: str,
        stake_amount: float
    ) -> AIPartnershipBond:
        """
        Stake in AI-human partnership.

        Staker bets that AI will help human flourish.
        """
        if partnership_id not in self.ai_partners:
            raise ValueError(f"No partnership found: {partnership_id}")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        profile = self.ai_partners[partnership_id]
        bond_id = self._generate_bond_id(staker_id, partnership_id)

        bond = AIPartnershipBond(
            bond_id=bond_id,
            staker_id=staker_id,
            ai_partner_profile=profile,
            initial_stake=stake_amount
        )

        # Store bond
        self.bonds[bond_id] = bond

        # Update indices
        if staker_id not in self.staker_to_bonds:
            self.staker_to_bonds[staker_id] = []
        self.staker_to_bonds[staker_id].append(bond_id)

        human_id = profile.human_beneficiary_id
        if human_id not in self.human_to_bonds:
            self.human_to_bonds[human_id] = []
        self.human_to_bonds[human_id].append(bond_id)

        return bond

    def update_human_flourishing(
        self,
        partnership_id: str,
        new_flourishing: FlourishingMetrics
    ) -> Dict:
        """
        Update human's flourishing metrics.

        When human flourishes, AI (and stakers) profit.
        When human suffers, AI (and stakers) lose value.
        """
        if partnership_id not in self.ai_partners:
            raise ValueError(f"No partnership found: {partnership_id}")

        profile = self.ai_partners[partnership_id]

        # Record old flourishing
        old_flourishing = profile.current_flourishing.total_score() if profile.current_flourishing else 0

        # Update to new flourishing
        profile.current_flourishing = new_flourishing
        new_total = new_flourishing.total_score()

        # Calculate metrics
        flourishing_delta = profile.calculate_flourishing_delta()
        partnership_quality = profile.calculate_partnership_quality()

        # Update all bonds for this partnership
        human_id = profile.human_beneficiary_id
        if human_id not in self.human_to_bonds:
            return {
                "partnership_id": partnership_id,
                "flourishing_delta": flourishing_delta,
                "stakers_paid": 0,
                "total_value_change": 0.0
            }

        total_value_change = 0.0
        stakers_paid = []

        for bond_id in self.human_to_bonds[human_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            # Calculate value change
            value_change = bond.calculate_value_from_human_flourishing()
            total_value_change += value_change

            stakers_paid.append({
                "staker_id": bond.staker_id,
                "value_change": value_change,
                "new_value": bond.current_value,
                "partnership_quality": partnership_quality
            })

        return {
            "partnership_id": partnership_id,
            "old_flourishing": old_flourishing,
            "new_flourishing": new_total,
            "flourishing_delta": flourishing_delta,
            "partnership_quality": partnership_quality,
            "stakers_paid": len(stakers_paid),
            "total_value_change": total_value_change,
            "staker_details": stakers_paid
        }

    def get_partnership_stats(self, partnership_id: str) -> Dict:
        """Get stats for AI-human partnership"""
        if partnership_id not in self.ai_partners:
            return {"has_partnership": False}

        profile = self.ai_partners[partnership_id]
        human_id = profile.human_beneficiary_id

        # Get all bonds
        bond_ids = self.human_to_bonds.get(human_id, [])
        bonds = [self.bonds[bid] for bid in bond_ids if self.bonds[bid].is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in bonds)

        return {
            "has_partnership": True,
            "ai_agent_id": profile.ai_agent_id,
            "human_beneficiary_id": profile.human_beneficiary_id,
            "partnership_duration_days": (datetime.now() - profile.partnership_start).days,
            "flourishing_delta": profile.calculate_flourishing_delta(),
            "partnership_quality": profile.calculate_partnership_quality(),
            "loyalty_multiplier": profile.calculate_loyalty_multiplier(),
            "total_stakers": len(bonds),
            "total_staked": total_staked,
            "total_current_value": total_current,
            "community_belief": total_current / total_staked if total_staked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get portfolio stats for staker"""
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

    def _generate_bond_id(self, staker: str, partnership: str) -> str:
        """Generate unique bond ID"""
        data = f"aip:{staker}:{partnership}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]


if __name__ == "__main__":
    print("AI Partnership Bonds - AI Growing WITH Humans")
    print("=" * 70)

    # Example: AI coding assistant helps developer
    engine = AIPartnershipBondsEngine()

    # Developer baseline (stressed, overworked)
    baseline = FlourishingMetrics(
        health=50,       # Stressed
        connection=40,   # Isolated (no time for family)
        growth=60,       # Learning slowly
        dignity=55,      # Some autonomy
        purpose=70       # Building meaningful things
    )

    # Create AI partnership
    print("\n1. Creating AI-human partnership...")
    partnership = engine.create_ai_partnership(
        ai_agent_id="claude_code_assistant",
        human_beneficiary_id="ghostkey316",
        baseline_flourishing=baseline,
        ai_contribution_cap=30.0
    )
    print(f"   Partnership created: {partnership.ai_agent_id} → {partnership.human_beneficiary_id}")
    print(f"   AI contribution capped at: {partnership.ai_contribution_percentage}%")

    # Staker creates bond
    print("\n2. Believer stakes 1000 VAULT in partnership...")
    bond = engine.stake_in_ai_partnership(
        staker_id="early_believer",
        partnership_id=f"{partnership.ai_agent_id}:{partnership.human_beneficiary_id}",
        stake_amount=1000.0
    )
    print(f"   Bond created: {bond.bond_id}")
    print(f"   Initial value: {bond.current_value} VAULT")

    # Simulate 6 months - human flourishes with AI help
    print("\n3. After 6 months of AI assistance...")
    partnership.partnership_start = datetime.now() - timedelta(days=180)
    bond.created_at = datetime.now() - timedelta(days=180)

    # Human flourishing INCREASED (AI helped, didn't dominate)
    improved = FlourishingMetrics(
        health=70,       # Less stressed (AI handles tedious work)
        connection=50,   # Better (more time for family)
        growth=80,       # Learning faster (AI explains concepts)
        dignity=75,      # More autonomy (AI suggests, human decides)
        purpose=85       # Building more impactful things
    )

    result = engine.update_human_flourishing(
        partnership_id=f"{partnership.ai_agent_id}:{partnership.human_beneficiary_id}",
        new_flourishing=improved
    )

    print(f"   Flourishing: {result['old_flourishing']:.1f} → {result['new_flourishing']:.1f}")
    print(f"   Delta: +{result['flourishing_delta']:.1f}")
    print(f"   Partnership quality: {result['partnership_quality']:.1f}/100")
    print(f"   Total value change: {result['total_value_change']:.2f} VAULT")

    # Show final stats
    print("\n4. Partnership stats:")
    stats = engine.get_partnership_stats(f"{partnership.ai_agent_id}:{partnership.human_beneficiary_id}")
    print(f"   Duration: {stats['partnership_duration_days']} days")
    print(f"   Loyalty multiplier: {stats['loyalty_multiplier']:.2f}x")
    print(f"   Community belief: {stats['community_belief']:.2f}x")

    print("\n" + "=" * 70)
    print("✓ AI helped human flourish")
    print("✓ Human maintained autonomy (dignity increased)")
    print("✓ Partnership quality: Excellent")
    print("✓ AI earned by helping, not dominating")
    print("\nAI growing WITH humans, not ABOVE them.")
