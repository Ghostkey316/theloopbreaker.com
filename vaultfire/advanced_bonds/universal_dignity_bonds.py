"""
Universal Dignity Bonds (UDB) - Economic Equality Mechanism

Revolutionary innovation: First economic mechanism in history where
human worth ≠ human productivity.

Stakes in DELTA (change/growth), not POSITION (status).
Values people by trajectory and constraints overcome, not absolute outcomes.

Core Principle:
- Going from 20 → 40 flourishing is MORE valuable than 80 → 90
- Overcoming disability/poverty/discrimination multiplies value
- Sustained improvement compounds over time
- Human dignity has inherent economic value

This mathematically solves inequality by making helping the most
disadvantaged the most economically profitable.

Use Cases:
- Refugee support (extreme constraints = 5x multiplier)
- Disability care (severe disability = 4x multiplier)
- Elder care (age constraints = 2x multiplier)
- Poverty alleviation (economic constraints = 2.5x multiplier)
- Recovery support (addiction, trauma = 3x multiplier)
- Universal human dignity (everyone has inherent worth)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class FlourishingDimension(Enum):
    """Dimensions of human flourishing"""
    HEALTH = "health"  # Physical + mental wellbeing
    CONNECTION = "connection"  # Relationships, community, belonging
    GROWTH = "growth"  # Learning, development, progress
    DIGNITY = "dignity"  # Respect, autonomy, agency
    PURPOSE = "purpose"  # Meaning, contribution (optional)


class ConstraintType(Enum):
    """Types of constraints that multiply bond value"""
    DISABILITY = "disability"  # Physical or mental disability
    CHRONIC_ILLNESS = "chronic_illness"  # Ongoing health challenges
    MENTAL_HEALTH = "mental_health"  # Mental health struggles
    POVERTY = "poverty"  # Economic disadvantage
    DISCRIMINATION = "discrimination"  # Social marginalization
    GEOGRAPHIC_ISOLATION = "geographic_isolation"  # Rural, conflict zones
    EDUCATIONAL_ACCESS = "educational_access"  # Limited learning opportunities
    REFUGEE_STATUS = "refugee_status"  # Forced displacement
    ELDERLY_AGE = "elderly_age"  # Age-related constraints
    TRAUMA = "trauma"  # PTSD, abuse, violence recovery
    ADDICTION_RECOVERY = "addiction_recovery"  # Substance abuse recovery


@dataclass
class FlourishingScore:
    """
    Multi-dimensional measurement of human flourishing.

    Each dimension scored 0-100.
    Total flourishing = weighted average.

    Crucially: Purpose/contribution is ONLY 20% of score.
    Can achieve 80/100 without producing anything economically.
    """
    health: float = 50.0  # Physical + mental health (0-100)
    connection: float = 50.0  # Relationships, belonging (0-100)
    growth: float = 50.0  # Learning, development (0-100)
    dignity: float = 50.0  # Respect, autonomy (0-100)
    purpose: float = 50.0  # Meaning, contribution (0-100)

    # Weights (sum to 1.0)
    health_weight: float = 0.25
    connection_weight: float = 0.25
    growth_weight: float = 0.15
    dignity_weight: float = 0.15
    purpose_weight: float = 0.20  # Only 20% - can score high without "producing"

    timestamp: datetime = field(default_factory=datetime.now)

    def total_score(self) -> float:
        """Calculate weighted total flourishing score (0-100)"""
        total = (
            self.health * self.health_weight +
            self.connection * self.connection_weight +
            self.growth * self.growth_weight +
            self.dignity * self.dignity_weight +
            self.purpose * self.purpose_weight
        )
        return min(100.0, max(0.0, total))

    def to_dict(self) -> Dict:
        """Export scores for verification"""
        return {
            "health": self.health,
            "connection": self.connection,
            "growth": self.growth,
            "dignity": self.dignity,
            "purpose": self.purpose,
            "total": self.total_score(),
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class ConstraintProfile:
    """
    Tracks constraints a person faces.

    Multiple constraints stack multiplicatively.
    Harder constraints = higher multipliers.
    """
    constraints: Dict[ConstraintType, float] = field(default_factory=dict)

    # Constraint multipliers (difficulty of overcoming)
    MULTIPLIERS = {
        ConstraintType.DISABILITY: 3.0,
        ConstraintType.CHRONIC_ILLNESS: 2.5,
        ConstraintType.MENTAL_HEALTH: 2.0,
        ConstraintType.POVERTY: 2.5,
        ConstraintType.DISCRIMINATION: 2.0,
        ConstraintType.GEOGRAPHIC_ISOLATION: 1.8,
        ConstraintType.EDUCATIONAL_ACCESS: 1.5,
        ConstraintType.REFUGEE_STATUS: 5.0,  # Extreme constraints
        ConstraintType.ELDERLY_AGE: 2.0,
        ConstraintType.TRAUMA: 3.0,
        ConstraintType.ADDICTION_RECOVERY: 2.5,
    }

    def add_constraint(self, constraint_type: ConstraintType, severity: float):
        """
        Add constraint with severity (0.0 - 1.0).

        Severity adjusts multiplier:
        - 0.3 severity = mild (30% of full multiplier)
        - 0.7 severity = moderate (70% of full multiplier)
        - 1.0 severity = severe (100% of full multiplier)
        """
        if severity < 0.0 or severity > 1.0:
            raise ValueError("Severity must be 0.0-1.0")

        self.constraints[constraint_type] = severity

    def remove_constraint(self, constraint_type: ConstraintType):
        """Remove constraint (e.g., recovered from addiction)"""
        if constraint_type in self.constraints:
            del self.constraints[constraint_type]

    def calculate_total_multiplier(self) -> float:
        """
        Calculate total constraint multiplier.

        Multiple constraints stack multiplicatively:
        - Disability (3.0x) + Poverty (2.5x) = 7.5x combined
        - Refugee (5.0x) + Trauma (3.0x) + Poverty (2.5x) = 37.5x

        Makes investing in most disadvantaged the most profitable.
        """
        if not self.constraints:
            return 1.0  # No constraints = baseline

        total_mult = 1.0

        for constraint_type, severity in self.constraints.items():
            base_mult = self.MULTIPLIERS.get(constraint_type, 1.0)
            # Adjust by severity (0.0-1.0)
            adjusted_mult = 1.0 + ((base_mult - 1.0) * severity)
            total_mult *= adjusted_mult

        return total_mult

    def constraint_summary(self) -> Dict:
        """Summary of all constraints"""
        return {
            "constraints": {
                ct.value: severity
                for ct, severity in self.constraints.items()
            },
            "total_multiplier": self.calculate_total_multiplier(),
            "count": len(self.constraints)
        }


@dataclass
class HumanFlourishingProfile:
    """
    Complete profile tracking a person's flourishing over time.

    Stores historical scores to calculate delta (change).
    Tracks constraints to calculate context multiplier.
    """
    person_id: str
    baseline_flourishing: FlourishingScore
    current_flourishing: FlourishingScore
    constraint_profile: ConstraintProfile

    flourishing_history: List[FlourishingScore] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def update_flourishing(self, new_score: FlourishingScore):
        """Record new flourishing measurement"""
        self.flourishing_history.append(self.current_flourishing)
        self.current_flourishing = new_score

    def calculate_delta(self) -> float:
        """
        Calculate change in flourishing from baseline.

        This is the KEY metric:
        - Person going from 20 → 40 has delta = +20
        - Person going from 80 → 90 has delta = +10
        - First person's bonds appreciate 2x more
        """
        baseline_total = self.baseline_flourishing.total_score()
        current_total = self.current_flourishing.total_score()

        return current_total - baseline_total

    def calculate_trajectory(self, window_days: int = 30) -> float:
        """
        Calculate recent trajectory (positive = improving).

        Looks at last N days to determine direction.
        """
        if len(self.flourishing_history) < 2:
            return 0.0

        cutoff = datetime.now() - timedelta(days=window_days)
        recent_scores = [
            s for s in self.flourishing_history
            if s.timestamp >= cutoff
        ]

        if len(recent_scores) < 2:
            return 0.0

        # Simple linear trend
        first = recent_scores[0].total_score()
        last = recent_scores[-1].total_score()

        return last - first

    def time_multiplier(self) -> float:
        """
        Sustained improvement compounds over time.

        1 month: 1.0x
        6 months: 1.3x
        1 year: 1.5x
        2 years: 2.0x
        5 years: 3.0x
        """
        age = datetime.now() - self.created_at
        months = age.days / 30

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


@dataclass
class UniversalDignityBond:
    """
    Economic stake in a person's flourishing.

    Bond appreciates based on:
    1. Delta (change in flourishing)
    2. Context multiplier (constraints overcome)
    3. Time multiplier (sustained improvement)

    Key Innovation: Person doesn't need to "produce" anything.
    Bonds appreciate based on human flourishing, not economic output.
    """
    bond_id: str
    staker_id: str
    person_id: str
    person_profile: HumanFlourishingProfile

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    vesting_period: timedelta = timedelta(days=730)  # 2 years

    total_earnings: float = 0.0
    is_active: bool = True

    def __post_init__(self):
        self.current_value = self.initial_stake

    def calculate_value_from_flourishing_change(self) -> float:
        """
        Calculate bond appreciation from flourishing improvement.

        Formula:
        Appreciation = Stake × Delta × Context_Multiplier × Time_Multiplier

        Example:
        - Stake: 1000
        - Delta: +20 (20 → 40 flourishing)
        - Context: 3.0x (disability)
        - Time: 1.5x (1 year sustained)
        - Appreciation: 1000 × 0.20 × 3.0 × 1.5 = 900
        - New value: 1900
        """
        # Calculate delta (as ratio 0-1)
        delta = self.person_profile.calculate_delta()
        delta_ratio = delta / 100.0  # Convert to 0-1 range

        # Get multipliers
        context_mult = self.person_profile.constraint_profile.calculate_total_multiplier()
        time_mult = self.person_profile.time_multiplier()

        # Calculate appreciation
        appreciation = self.initial_stake * delta_ratio * context_mult * time_mult

        # Update value
        old_value = self.current_value
        self.current_value = self.initial_stake + appreciation

        # Track earnings
        value_increase = max(0, self.current_value - old_value)
        self.total_earnings += value_increase

        return value_increase

    def dignity_floor(self) -> float:
        """
        Bond NEVER goes to zero.

        Every human has inherent dignity = minimum bond value.
        Even if flourishing decreases, bond has floor.
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


class UniversalDignityBondsEngine:
    """
    Global engine managing all Universal Dignity Bonds.

    Tracks human flourishing, calculates bond values, ensures dignity.
    """

    def __init__(self):
        self.bonds: Dict[str, UniversalDignityBond] = {}
        self.profiles: Dict[str, HumanFlourishingProfile] = {}
        self.staker_to_bonds: Dict[str, List[str]] = {}
        self.person_to_bonds: Dict[str, List[str]] = {}

    def create_flourishing_profile(
        self,
        person_id: str,
        baseline_flourishing: FlourishingScore,
        constraints: Optional[Dict[ConstraintType, float]] = None
    ) -> HumanFlourishingProfile:
        """
        Create flourishing profile for a person.

        This is the foundation - measuring human flourishing.
        """
        constraint_profile = ConstraintProfile()

        if constraints:
            for constraint_type, severity in constraints.items():
                constraint_profile.add_constraint(constraint_type, severity)

        profile = HumanFlourishingProfile(
            person_id=person_id,
            baseline_flourishing=baseline_flourishing,
            current_flourishing=baseline_flourishing,
            constraint_profile=constraint_profile
        )

        self.profiles[person_id] = profile
        return profile

    def stake_in_flourishing(
        self,
        staker_id: str,
        person_id: str,
        stake_amount: float
    ) -> UniversalDignityBond:
        """
        Stake in a person's flourishing.

        If they improve, you profit.
        If they're disadvantaged, higher multiplier = more profit.
        """
        if person_id not in self.profiles:
            raise ValueError(f"No flourishing profile for {person_id}")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        profile = self.profiles[person_id]
        bond_id = self._generate_bond_id(staker_id, person_id)

        bond = UniversalDignityBond(
            bond_id=bond_id,
            staker_id=staker_id,
            person_id=person_id,
            person_profile=profile,
            initial_stake=stake_amount
        )

        # Store bond
        self.bonds[bond_id] = bond

        # Update indices
        if staker_id not in self.staker_to_bonds:
            self.staker_to_bonds[staker_id] = []
        self.staker_to_bonds[staker_id].append(bond_id)

        if person_id not in self.person_to_bonds:
            self.person_to_bonds[person_id] = []
        self.person_to_bonds[person_id].append(bond_id)

        return bond

    def update_flourishing(
        self,
        person_id: str,
        new_flourishing: FlourishingScore
    ) -> Dict:
        """
        Update person's flourishing score.

        When flourishing improves, ALL stakers profit.
        """
        if person_id not in self.profiles:
            raise ValueError(f"No profile for {person_id}")

        profile = self.profiles[person_id]

        # Record old score
        old_total = profile.current_flourishing.total_score()

        # Update to new score
        profile.update_flourishing(new_flourishing)
        new_total = new_flourishing.total_score()

        # Calculate delta
        delta = new_total - old_total

        # Update all bonds
        if person_id not in self.person_to_bonds:
            return {
                "delta": delta,
                "stakers_paid": 0,
                "total_appreciation": 0.0
            }

        total_appreciation = 0.0
        stakers_paid = []

        for bond_id in self.person_to_bonds[person_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            # Calculate appreciation
            appreciation = bond.calculate_value_from_flourishing_change()
            total_appreciation += appreciation

            stakers_paid.append({
                "staker_id": bond.staker_id,
                "appreciation": appreciation,
                "new_value": bond.current_value,
                "context_multiplier": profile.constraint_profile.calculate_total_multiplier()
            })

        return {
            "person_id": person_id,
            "old_flourishing": old_total,
            "new_flourishing": new_total,
            "delta": delta,
            "context_multiplier": profile.constraint_profile.calculate_total_multiplier(),
            "stakers_paid": len(stakers_paid),
            "total_appreciation": total_appreciation,
            "staker_details": stakers_paid
        }

    def get_flourishing_stats(self, person_id: str) -> Dict:
        """Get stats for a person's flourishing"""
        if person_id not in self.profiles:
            return {"has_profile": False}

        profile = self.profiles[person_id]

        # Get all bonds
        bond_ids = self.person_to_bonds.get(person_id, [])
        bonds = [self.bonds[bid] for bid in bond_ids if self.bonds[bid].is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in bonds)

        return {
            "has_profile": True,
            "baseline_flourishing": profile.baseline_flourishing.total_score(),
            "current_flourishing": profile.current_flourishing.total_score(),
            "delta": profile.calculate_delta(),
            "trajectory": profile.calculate_trajectory(),
            "constraints": profile.constraint_profile.constraint_summary(),
            "total_stakers": len(bonds),
            "total_staked": total_staked,
            "total_current_value": total_current,
            "community_belief": total_current / total_staked if total_staked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get stats for someone staking in flourishing"""
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
            "roi": ((total_current - total_staked) / total_staked * 100) if total_staked > 0 else 0.0
        }

    def compare_investments(self, person_id_1: str, person_id_2: str) -> Dict:
        """
        Compare investment returns between two people.

        Shows how UDB makes investing in disadvantaged MORE profitable.
        """
        if person_id_1 not in self.profiles or person_id_2 not in self.profiles:
            return {"error": "Missing profiles"}

        profile1 = self.profiles[person_id_1]
        profile2 = self.profiles[person_id_2]

        # Calculate returns for same stake amount
        test_stake = 1000.0

        # Person 1
        delta1 = profile1.calculate_delta() / 100.0
        context1 = profile1.constraint_profile.calculate_total_multiplier()
        time1 = profile1.time_multiplier()
        return1 = test_stake * delta1 * context1 * time1

        # Person 2
        delta2 = profile2.calculate_delta() / 100.0
        context2 = profile2.constraint_profile.calculate_total_multiplier()
        time2 = profile2.time_multiplier()
        return2 = test_stake * delta2 * context2 * time2

        return {
            "stake_amount": test_stake,
            "person_1": {
                "person_id": person_id_1,
                "delta": profile1.calculate_delta(),
                "context_multiplier": context1,
                "time_multiplier": time1,
                "total_return": return1,
                "roi_percent": (return1 / test_stake) * 100
            },
            "person_2": {
                "person_id": person_id_2,
                "delta": profile2.calculate_delta(),
                "context_multiplier": context2,
                "time_multiplier": time2,
                "total_return": return2,
                "roi_percent": (return2 / test_stake) * 100
            },
            "relative_return": return2 / return1 if return1 > 0 else 0,
            "more_profitable": person_id_2 if return2 > return1 else person_id_1
        }

    def _generate_bond_id(self, staker: str, person: str) -> str:
        """Generate unique bond ID"""
        data = f"udb:{staker}:{person}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
