"""
Redemption Bonds - Community Recovery Stake Mechanism

Revolutionary innovation: When someone fails or makes mistakes, the community
can stake belief in their redemption. Successful rehabilitation = profit.

This makes second chances economically rational instead of charitable,
and helps people recover from crypto's brutal cancel culture.

Core Concept:
- Person has failed (rug pull, hack, bad decision, reputation loss)
- Community stakes belief in their redemption journey
- As they hit recovery milestones → stakers profit
- Bigger the failure, bigger the redemption reward
- Giving up = stakers lose (anti-abandonment)

Use Cases:
- Rug pull victims rebuilding trust
- Failed founders starting fresh
- Hacked protocols recovering security
- Community members recovering from mistakes
- AI agents learning from errors
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class FailureType(Enum):
    """Types of failures that can be redeemed"""
    RUG_PULL = "rug_pull"  # Project abandoned/exit scammed
    SECURITY_BREACH = "security_breach"  # Protocol hacked
    BROKEN_PROMISE = "broken_promise"  # Failed to deliver
    REPUTATION_LOSS = "reputation_loss"  # Community trust broken
    TECHNICAL_FAILURE = "technical_failure"  # Bug, exploit, mistake
    ETHICAL_VIOLATION = "ethical_violation"  # Moral failure
    FINANCIAL_LOSS = "financial_loss"  # Lost user funds
    ABANDONMENT = "abandonment"  # Left community hanging


class RedemptionMilestone(Enum):
    """Milestones on the path to redemption"""
    ACKNOWLEDGMENT = "acknowledgment"  # Admitted failure publicly
    RESTITUTION_PLAN = "restitution_plan"  # Plan to make things right
    PARTIAL_RESTITUTION = "partial_restitution"  # Started making amends
    FULL_RESTITUTION = "full_restitution"  # Made victims whole
    NEW_SUCCESS = "new_success"  # Built something new that works
    COMMUNITY_TRUST = "community_trust"  # Community forgives
    COMPLETE_REDEMPTION = "complete_redemption"  # Fully redeemed


@dataclass
class RedemptionPath:
    """
    Tracks someone's journey from failure to redemption.

    Example:
    - Day 0: Rug pull (-1000 reputation)
    - Day 30: Public acknowledgment (+100 reputation)
    - Day 90: Restitution plan (+200 reputation)
    - Day 180: Partial refunds (+400 reputation)
    - Day 365: Full redemption (+1000 reputation)
    """
    path_id: str
    redeemer_id: str
    failure_type: FailureType
    failure_magnitude: float  # How bad was it (1-100)
    failure_timestamp: datetime

    milestones_achieved: List[RedemptionMilestone] = field(default_factory=list)
    current_reputation: float = 0.0  # Starts at 0 after failure
    target_reputation: float = 1.0  # Full redemption

    created_at: datetime = field(default_factory=datetime.now)

    def achieve_milestone(self, milestone: RedemptionMilestone) -> float:
        """
        When milestone is achieved, reputation increases.
        Returns reputation gain.
        """
        if milestone in self.milestones_achieved:
            return 0.0  # Already achieved

        self.milestones_achieved.append(milestone)

        # Milestone value based on difficulty
        milestone_values = {
            RedemptionMilestone.ACKNOWLEDGMENT: 0.1,
            RedemptionMilestone.RESTITUTION_PLAN: 0.15,
            RedemptionMilestone.PARTIAL_RESTITUTION: 0.25,
            RedemptionMilestone.FULL_RESTITUTION: 0.4,
            RedemptionMilestone.NEW_SUCCESS: 0.3,
            RedemptionMilestone.COMMUNITY_TRUST: 0.2,
            RedemptionMilestone.COMPLETE_REDEMPTION: 0.5,
        }

        reputation_gain = milestone_values.get(milestone, 0.1)
        self.current_reputation = min(1.0, self.current_reputation + reputation_gain)

        return reputation_gain

    def redemption_progress(self) -> float:
        """How far along the redemption path (0-100%)"""
        return (self.current_reputation / self.target_reputation) * 100

    def time_since_failure(self) -> timedelta:
        """How long since the original failure"""
        return datetime.now() - self.failure_timestamp

    def redemption_multiplier(self) -> float:
        """
        Bigger failures = bigger redemption rewards.

        Small mistake (magnitude 10): 1.1x multiplier
        Medium failure (magnitude 50): 1.5x multiplier
        Major rug pull (magnitude 100): 3.0x multiplier

        This incentivizes helping people recover from big failures.
        """
        if self.failure_magnitude < 20:
            return 1.1
        elif self.failure_magnitude <= 50:
            return 1.5
        elif self.failure_magnitude < 80:
            return 2.0
        else:
            return 3.0  # Major redemption


@dataclass
class RedemptionBond:
    """
    Economic stake in someone's redemption journey.

    When you stake belief in someone's recovery, you profit if they succeed.
    This makes helping people recover economically rational.
    """
    bond_id: str
    staker_id: str
    redeemer_id: str
    redemption_path: RedemptionPath

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    vesting_period: timedelta = timedelta(days=365)  # 1 year to full redemption

    total_earnings: float = 0.0
    is_active: bool = True

    def __post_init__(self):
        self.current_value = self.initial_stake

    def calculate_value_from_milestone(self, milestone: RedemptionMilestone, reputation_gain: float) -> float:
        """
        When redeemer hits milestone, bond appreciates.

        Value increase = stake * reputation_gain * redemption_multiplier
        """
        multiplier = self.redemption_path.redemption_multiplier()
        appreciation = self.initial_stake * reputation_gain * multiplier

        self.current_value += appreciation
        self.total_earnings += appreciation

        return appreciation

    def abandonment_penalty(self) -> float:
        """
        If redeemer gives up, stakers lose value.

        This prevents staking in people who won't actually try to recover.
        """
        time_active = datetime.now() - self.created_at
        days_active = time_active.days

        if days_active < 30:
            penalty_rate = 0.8  # 80% loss if they quit immediately
        elif days_active < 90:
            penalty_rate = 0.5  # 50% loss if they quit early
        elif days_active < 180:
            penalty_rate = 0.3  # 30% loss if they quit mid-journey
        else:
            penalty_rate = 0.1  # 10% loss if they made it far

        penalty = self.current_value * penalty_rate
        self.current_value = max(0, self.current_value - penalty)
        self.is_active = False

        return penalty

    def vesting_status(self) -> Dict:
        """Check vesting progress"""
        time_vested = datetime.now() - self.created_at
        vesting_progress = min(1.0, time_vested / self.vesting_period)

        return {
            "vesting_progress": vesting_progress,
            "vested_amount": self.current_value * vesting_progress,
            "locked_amount": self.current_value * (1 - vesting_progress),
            "fully_vested": vesting_progress >= 1.0
        }


class RedemptionBondsEngine:
    """
    Global engine managing all redemption bonds.

    Tracks redemption paths, calculates earnings, validates milestones.
    """

    def __init__(self):
        self.bonds: Dict[str, RedemptionBond] = {}
        self.redemption_paths: Dict[str, RedemptionPath] = {}
        self.staker_to_bonds: Dict[str, List[str]] = {}  # staker_id -> bond_ids
        self.redeemer_to_bonds: Dict[str, List[str]] = {}  # redeemer_id -> bond_ids

    def start_redemption_path(
        self,
        redeemer_id: str,
        failure_type: FailureType,
        failure_magnitude: float,
        failure_description: str = ""
    ) -> RedemptionPath:
        """
        When someone has failed, they can start a redemption path.

        This creates public accountability and allows community to stake.
        """
        if failure_magnitude < 1 or failure_magnitude > 100:
            raise ValueError("Failure magnitude must be 1-100")

        path_id = self._generate_path_id(redeemer_id)

        path = RedemptionPath(
            path_id=path_id,
            redeemer_id=redeemer_id,
            failure_type=failure_type,
            failure_magnitude=failure_magnitude,
            failure_timestamp=datetime.now()
        )

        self.redemption_paths[path_id] = path
        return path

    def stake_in_redemption(
        self,
        staker_id: str,
        path_id: str,
        stake_amount: float
    ) -> RedemptionBond:
        """
        Stake belief in someone's redemption.

        If they succeed, you profit.
        If they give up, you lose.
        """
        if path_id not in self.redemption_paths:
            raise ValueError(f"Redemption path {path_id} not found")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        path = self.redemption_paths[path_id]
        bond_id = self._generate_bond_id(staker_id, path.redeemer_id)

        bond = RedemptionBond(
            bond_id=bond_id,
            staker_id=staker_id,
            redeemer_id=path.redeemer_id,
            redemption_path=path,
            initial_stake=stake_amount
        )

        # Store bond
        self.bonds[bond_id] = bond

        # Update indices
        if staker_id not in self.staker_to_bonds:
            self.staker_to_bonds[staker_id] = []
        self.staker_to_bonds[staker_id].append(bond_id)

        if path.redeemer_id not in self.redeemer_to_bonds:
            self.redeemer_to_bonds[path.redeemer_id] = []
        self.redeemer_to_bonds[path.redeemer_id].append(bond_id)

        return bond

    def achieve_milestone(
        self,
        path_id: str,
        milestone: RedemptionMilestone,
        proof: Optional[str] = None
    ) -> Dict:
        """
        When redeemer hits milestone, ALL stakers profit.

        This is the moment where belief pays off.
        """
        if path_id not in self.redemption_paths:
            raise ValueError(f"Redemption path {path_id} not found")

        path = self.redemption_paths[path_id]

        # Verify milestone (in production: use BeliefSync + NS3)
        # For now: simplified validation

        # Update path
        reputation_gain = path.achieve_milestone(milestone)

        # Pay all stakers
        if path.redeemer_id not in self.redeemer_to_bonds:
            return {
                "milestone": milestone.value,
                "reputation_gain": reputation_gain,
                "stakers_paid": 0,
                "total_paid": 0.0
            }

        total_paid = 0.0
        stakers_paid = []

        for bond_id in self.redeemer_to_bonds[path.redeemer_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            # Calculate value appreciation
            appreciation = bond.calculate_value_from_milestone(milestone, reputation_gain)
            total_paid += appreciation

            stakers_paid.append({
                "staker_id": bond.staker_id,
                "appreciation": appreciation,
                "new_value": bond.current_value
            })

        return {
            "milestone": milestone.value,
            "reputation_gain": reputation_gain,
            "redemption_progress": path.redemption_progress(),
            "stakers_paid": len(stakers_paid),
            "total_paid": total_paid,
            "staker_details": stakers_paid
        }

    def handle_abandonment(self, path_id: str) -> Dict:
        """
        When redeemer gives up, penalize all stakers.

        This prevents staking in people who won't actually try.
        """
        if path_id not in self.redemption_paths:
            raise ValueError(f"Redemption path {path_id} not found")

        path = self.redemption_paths[path_id]

        if path.redeemer_id not in self.redeemer_to_bonds:
            return {
                "total_penalties": 0.0,
                "stakers_affected": 0
            }

        total_penalties = 0.0
        stakers_affected = []

        for bond_id in self.redeemer_to_bonds[path.redeemer_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            penalty = bond.abandonment_penalty()
            total_penalties += penalty

            stakers_affected.append({
                "staker_id": bond.staker_id,
                "penalty": penalty,
                "remaining_value": bond.current_value
            })

        return {
            "total_penalties": total_penalties,
            "stakers_affected": len(stakers_affected),
            "staker_details": stakers_affected
        }

    def get_redemption_stats(self, redeemer_id: str) -> Dict:
        """Get stats for someone on redemption path"""
        # Find their active path
        active_paths = [
            p for p in self.redemption_paths.values()
            if p.redeemer_id == redeemer_id
        ]

        if not active_paths:
            return {
                "has_active_path": False,
                "total_stakers": 0,
                "total_staked": 0.0
            }

        path = active_paths[0]  # Most recent

        # Get all bonds
        bond_ids = self.redeemer_to_bonds.get(redeemer_id, [])
        bonds = [self.bonds[bid] for bid in bond_ids if self.bonds[bid].is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in bonds)

        return {
            "has_active_path": True,
            "failure_type": path.failure_type.value,
            "failure_magnitude": path.failure_magnitude,
            "redemption_progress": path.redemption_progress(),
            "milestones_achieved": [m.value for m in path.milestones_achieved],
            "current_reputation": path.current_reputation,
            "total_stakers": len(bonds),
            "total_staked": total_staked,
            "total_current_value": total_current,
            "community_belief": total_current / total_staked if total_staked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get stats for someone staking in redemptions"""
        if staker_id not in self.staker_to_bonds:
            return {
                "total_bonds": 0,
                "total_staked": 0.0,
                "total_current": 0.0,
                "total_earnings": 0.0
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

    def _generate_path_id(self, redeemer_id: str) -> str:
        """Generate unique redemption path ID"""
        data = f"redemption:{redeemer_id}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _generate_bond_id(self, staker: str, redeemer: str) -> str:
        """Generate unique bond ID"""
        data = f"redemption_bond:{staker}:{redeemer}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
