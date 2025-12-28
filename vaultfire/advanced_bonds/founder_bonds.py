"""
Founder Accountability Bonds - Anti-Rug Pull Mechanism

Revolutionary innovation: Founders bond with their community BEFORE launch.
Breaking promises = lose stake. Successful delivery = everyone profits.

This makes rug pulls economically stupid and founder commitment verifiable.

Core Concept:
- Founder locks stake tied to project milestones
- Community members co-stake with founder
- As milestones are hit → everyone profits
- Abandonment/rug pull → founder loses stake, community compensated
- Graduated unlocking based on sustained success

Use Cases:
- NFT projects (actual utility delivery, not just mint)
- DeFi protocols (prevent founder exit scams)
- DAO launches (founder accountability to community)
- Token launches (anti-rug protection)
- Any project where founder could abandon community
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class ProjectPhase(Enum):
    """Phases of project development"""
    PLANNING = "planning"  # Pre-launch
    LAUNCH = "launch"  # Initial launch
    GROWTH = "growth"  # Active development
    MATURITY = "maturity"  # Established
    COMPLETE = "complete"  # Fully delivered
    ABANDONED = "abandoned"  # Rug pull / abandoned


class MilestoneType(Enum):
    """Types of project milestones"""
    WHITEPAPER = "whitepaper"
    MVP_LAUNCH = "mvp_launch"
    BETA_RELEASE = "beta_release"
    MAINNET_LAUNCH = "mainnet_launch"
    USER_MILESTONE = "user_milestone"  # 100 users, 1000 users, etc.
    REVENUE_MILESTONE = "revenue_milestone"
    PARTNERSHIP = "partnership"
    AUDIT_COMPLETION = "audit_completion"
    GOVERNANCE_TRANSITION = "governance_transition"  # Decentralization
    SUSTAINED_OPERATION = "sustained_operation"  # 6mo, 1yr, 2yr uptime


class AbandonmentType(Enum):
    """Types of founder abandonment"""
    RUG_PULL = "rug_pull"  # Exit scam, liquidity drain
    GHOST = "ghost"  # Disappeared, no communication
    BROKEN_PROMISES = "broken_promises"  # Didn't deliver promised features
    MALICIOUS_CODE = "malicious_code"  # Backdoors, exploits
    REPUTATIONAL_DAMAGE = "reputational_damage"  # Scandal, fraud


@dataclass
class ProjectMilestone:
    """
    Verifiable milestone that unlocks founder stake.

    Example:
    - Milestone: Mainnet Launch
    - Verification: Contract deployed + 30 days uptime
    - Unlock: 20% of founder stake
    """
    milestone_id: str
    milestone_type: MilestoneType
    description: str
    verification_criteria: str
    unlock_percentage: float  # % of founder stake to unlock

    target_date: Optional[datetime] = None
    completed: bool = False
    completion_date: Optional[datetime] = None
    verification_proof: str = ""

    def verify_completion(self, proof: str = "") -> bool:
        """
        Mark milestone as completed.

        In production: Use BeliefSync + NS3 + oracles
        """
        if self.completed:
            return False

        self.completed = True
        self.completion_date = datetime.now()
        self.verification_proof = proof

        return True

    def days_overdue(self) -> int:
        """How many days past target date (0 if on time or no target)"""
        if not self.target_date:
            return 0

        if self.completed and self.completion_date:
            delta = self.completion_date - self.target_date
        else:
            delta = datetime.now() - self.target_date

        return max(0, delta.days)

    def delay_penalty(self) -> float:
        """
        Penalty for missing deadlines.

        On time: 0% penalty
        1-30 days late: 5% penalty
        31-90 days late: 15% penalty
        90+ days late: 30% penalty
        """
        days_late = self.days_overdue()

        if days_late == 0:
            return 0.0
        elif days_late <= 30:
            return 0.05
        elif days_late <= 90:
            return 0.15
        else:
            return 0.30


@dataclass
class FounderAccountabilityBond:
    """
    Founder's economic commitment to their community.

    Founder locks stake, community co-stakes. Success = everyone profits.
    Abandonment = founder loses stake, community compensated.
    """
    bond_id: str
    founder_id: str
    project_name: str
    project_phase: ProjectPhase

    founder_stake: float  # Founder's locked stake
    community_stake: float = 0.0  # Community co-stake

    milestones: List[ProjectMilestone] = field(default_factory=list)
    unlocked_stake: float = 0.0  # How much founder has unlocked

    created_at: datetime = field(default_factory=datetime.now)
    vesting_start: Optional[datetime] = None
    vesting_period: timedelta = timedelta(days=730)  # 2 year vesting

    total_community_stakers: int = 0
    is_active: bool = True
    is_abandoned: bool = False

    def add_milestone(self, milestone: ProjectMilestone):
        """Add milestone to accountability bond"""
        self.milestones.append(milestone)

    def complete_milestone(self, milestone_id: str, proof: str = "") -> Dict:
        """
        When founder completes milestone, unlock stake for everyone.

        Founder unlocks their %, community bonds appreciate.
        """
        milestone = None
        for m in self.milestones:
            if m.milestone_id == milestone_id:
                milestone = m
                break

        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found")

        if milestone.completed:
            return {"already_completed": True, "unlock_amount": 0.0}

        # Verify completion
        milestone.verify_completion(proof)

        # Calculate unlock amount (with delay penalties)
        delay_penalty = milestone.delay_penalty()
        unlock_percentage = milestone.unlock_percentage * (1 - delay_penalty)

        unlock_amount = self.founder_stake * unlock_percentage
        self.unlocked_stake += unlock_amount

        return {
            "milestone": milestone.description,
            "unlock_percentage": unlock_percentage,
            "unlock_amount": unlock_amount,
            "total_unlocked": self.unlocked_stake,
            "delay_penalty": delay_penalty,
            "remaining_locked": self.founder_stake - self.unlocked_stake
        }

    def handle_abandonment(self, abandonment_type: AbandonmentType) -> Dict:
        """
        When founder abandons project, distribute locked stake to community.

        This compensates community for founder's broken promises.
        """
        if not self.is_active or self.is_abandoned:
            return {"already_handled": True}

        self.is_abandoned = True
        self.is_active = False
        self.project_phase = ProjectPhase.ABANDONED

        # Calculate what founder loses
        remaining_locked = self.founder_stake - self.unlocked_stake

        # Severity of abandonment affects penalty
        severity_multipliers = {
            AbandonmentType.RUG_PULL: 1.0,  # Lose 100% of locked
            AbandonmentType.MALICIOUS_CODE: 1.0,
            AbandonmentType.GHOST: 0.8,  # Lose 80% of locked
            AbandonmentType.BROKEN_PROMISES: 0.5,  # Lose 50% of locked
            AbandonmentType.REPUTATIONAL_DAMAGE: 0.3,  # Lose 30% of locked
        }

        severity_mult = severity_multipliers.get(abandonment_type, 0.8)
        founder_penalty = remaining_locked * severity_mult

        # Distribute to community stakers
        community_compensation = founder_penalty

        return {
            "abandonment_type": abandonment_type.value,
            "founder_penalty": founder_penalty,
            "community_compensation": community_compensation,
            "founder_keeps": remaining_locked - founder_penalty,
            "compensation_per_staker": community_compensation / self.total_community_stakers if self.total_community_stakers > 0 else 0.0
        }

    def completion_percentage(self) -> float:
        """How many milestones completed (0-100%)"""
        if not self.milestones:
            return 0.0

        completed = len([m for m in self.milestones if m.completed])
        return (completed / len(self.milestones)) * 100

    def time_multiplier(self) -> float:
        """
        Sustained operation compounds value.

        Launch: 1.0x
        6 months: 1.2x
        1 year: 1.5x
        2 years: 2.0x
        """
        age = datetime.now() - self.created_at
        months = age.days / 30

        if months < 1:
            return 1.0
        elif months < 6:
            return 1.1
        elif months < 12:
            return 1.2
        elif months < 24:
            return 1.5
        else:
            return 2.0


@dataclass
class CommunityCoStake:
    """
    Community member co-staking with founder.

    If founder delivers → profit.
    If founder abandons → compensated from founder's locked stake.
    """
    stake_id: str
    staker_id: str
    founder_bond_id: str

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    total_earnings: float = 0.0
    is_active: bool = True

    def __post_init__(self):
        self.current_value = self.initial_stake

    def appreciate_from_milestone(self, milestone_unlock_pct: float, founder_bond: FounderAccountabilityBond) -> float:
        """
        When milestone is hit, community stake appreciates.

        Value = stake * milestone_unlock% * time_multiplier
        """
        time_mult = founder_bond.time_multiplier()
        appreciation = self.initial_stake * milestone_unlock_pct * time_mult

        self.current_value += appreciation
        self.total_earnings += appreciation

        return appreciation

    def receive_abandonment_compensation(self, compensation_amount: float):
        """
        When founder abandons, receive compensation from their locked stake.
        """
        self.current_value += compensation_amount
        self.total_earnings += compensation_amount


class FounderAccountabilityEngine:
    """
    Global engine managing all founder accountability bonds.

    Tracks milestones, handles abandonments, protects communities.
    """

    def __init__(self):
        self.founder_bonds: Dict[str, FounderAccountabilityBond] = {}
        self.community_stakes: Dict[str, CommunityCoStake] = {}
        self.founder_to_bonds: Dict[str, List[str]] = {}  # founder_id -> bond_ids
        self.bond_to_stakes: Dict[str, List[str]] = {}  # bond_id -> stake_ids
        self.staker_to_stakes: Dict[str, List[str]] = {}  # staker_id -> stake_ids

    def create_founder_bond(
        self,
        founder_id: str,
        project_name: str,
        founder_stake_amount: float,
        milestones: List[ProjectMilestone],
        project_phase: ProjectPhase = ProjectPhase.PLANNING
    ) -> FounderAccountabilityBond:
        """
        Founder creates accountability bond BEFORE launch.

        This locks their stake and opens co-staking to community.
        """
        if founder_stake_amount <= 0:
            raise ValueError("Founder stake must be positive")

        if not milestones:
            raise ValueError("Must define at least one milestone")

        # Validate milestone unlock percentages sum to ~100%
        total_unlock = sum(m.unlock_percentage for m in milestones)
        if total_unlock < 0.9 or total_unlock > 1.1:
            raise ValueError(f"Milestone unlocks should sum to ~100%, got {total_unlock*100}%")

        bond_id = self._generate_bond_id(founder_id, project_name)

        bond = FounderAccountabilityBond(
            bond_id=bond_id,
            founder_id=founder_id,
            project_name=project_name,
            project_phase=project_phase,
            founder_stake=founder_stake_amount,
            milestones=milestones,
            vesting_start=datetime.now()
        )

        # Store bond
        self.founder_bonds[bond_id] = bond
        self.bond_to_stakes[bond_id] = []

        # Update founder index
        if founder_id not in self.founder_to_bonds:
            self.founder_to_bonds[founder_id] = []
        self.founder_to_bonds[founder_id].append(bond_id)

        return bond

    def community_co_stake(
        self,
        staker_id: str,
        bond_id: str,
        stake_amount: float
    ) -> CommunityCoStake:
        """
        Community member stakes alongside founder.

        Shares in success, protected from abandonment.
        """
        if bond_id not in self.founder_bonds:
            raise ValueError(f"Founder bond {bond_id} not found")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        bond = self.founder_bonds[bond_id]
        if not bond.is_active:
            raise ValueError("Bond is no longer active")

        stake_id = self._generate_stake_id(staker_id, bond_id)

        co_stake = CommunityCoStake(
            stake_id=stake_id,
            staker_id=staker_id,
            founder_bond_id=bond_id,
            initial_stake=stake_amount
        )

        # Store stake
        self.community_stakes[stake_id] = co_stake

        # Update bond
        bond.community_stake += stake_amount
        bond.total_community_stakers += 1

        # Update indices
        self.bond_to_stakes[bond_id].append(stake_id)

        if staker_id not in self.staker_to_stakes:
            self.staker_to_stakes[staker_id] = []
        self.staker_to_stakes[staker_id].append(stake_id)

        return co_stake

    def complete_milestone(
        self,
        bond_id: str,
        milestone_id: str,
        proof: str = ""
    ) -> Dict:
        """
        When founder completes milestone, ALL stakers profit.

        Founder unlocks stake, community stakes appreciate.
        """
        if bond_id not in self.founder_bonds:
            raise ValueError(f"Bond {bond_id} not found")

        bond = self.founder_bonds[bond_id]

        # Complete milestone (unlocks founder stake)
        result = bond.complete_milestone(milestone_id, proof)

        if result.get("already_completed"):
            return result

        # Appreciate community stakes
        unlock_pct = result["unlock_percentage"]
        total_appreciation = 0.0
        stakers_paid = []

        for stake_id in self.bond_to_stakes[bond_id]:
            stake = self.community_stakes[stake_id]
            if not stake.is_active:
                continue

            appreciation = stake.appreciate_from_milestone(unlock_pct, bond)
            total_appreciation += appreciation

            stakers_paid.append({
                "staker_id": stake.staker_id,
                "appreciation": appreciation,
                "new_value": stake.current_value
            })

        result["community_stakers_paid"] = len(stakers_paid)
        result["total_community_appreciation"] = total_appreciation
        result["staker_details"] = stakers_paid

        return result

    def handle_abandonment(
        self,
        bond_id: str,
        abandonment_type: AbandonmentType,
        reporter_id: str = "",
        evidence: str = ""
    ) -> Dict:
        """
        When founder abandons, penalize founder and compensate community.

        This is the anti-rug protection in action.
        """
        if bond_id not in self.founder_bonds:
            raise ValueError(f"Bond {bond_id} not found")

        bond = self.founder_bonds[bond_id]

        # Handle abandonment (calculates compensation)
        result = bond.handle_abandonment(abandonment_type)

        if result.get("already_handled"):
            return result

        # Compensate community stakers
        compensation_per_staker = result["compensation_per_staker"]
        total_compensated = 0.0
        stakers_compensated = []

        for stake_id in self.bond_to_stakes[bond_id]:
            stake = self.community_stakes[stake_id]
            if not stake.is_active:
                continue

            stake.receive_abandonment_compensation(compensation_per_staker)
            total_compensated += compensation_per_staker

            stakers_compensated.append({
                "staker_id": stake.staker_id,
                "compensation": compensation_per_staker,
                "new_value": stake.current_value
            })

        result["stakers_compensated"] = len(stakers_compensated)
        result["total_compensated"] = total_compensated
        result["staker_details"] = stakers_compensated

        return result

    def get_founder_stats(self, founder_id: str) -> Dict:
        """Get stats for a founder"""
        if founder_id not in self.founder_to_bonds:
            return {
                "total_bonds": 0,
                "active_bonds": 0,
                "total_stake_locked": 0.0
            }

        bonds = [self.founder_bonds[bid] for bid in self.founder_to_bonds[founder_id]]

        total_locked = sum(b.founder_stake - b.unlocked_stake for b in bonds if b.is_active)
        total_community = sum(b.community_stake for b in bonds)
        avg_completion = sum(b.completion_percentage() for b in bonds) / len(bonds) if bonds else 0.0

        return {
            "total_bonds": len(bonds),
            "active_bonds": len([b for b in bonds if b.is_active]),
            "abandoned_bonds": len([b for b in bonds if b.is_abandoned]),
            "total_stake_locked": total_locked,
            "total_community_stake": total_community,
            "average_completion": avg_completion,
            "trust_ratio": total_community / total_locked if total_locked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get stats for community staker"""
        if staker_id not in self.staker_to_stakes:
            return {
                "total_stakes": 0,
                "total_staked": 0.0,
                "total_current": 0.0
            }

        stakes = [self.community_stakes[sid] for sid in self.staker_to_stakes[staker_id]]
        active_stakes = [s for s in stakes if s.is_active]

        total_staked = sum(s.initial_stake for s in stakes)
        total_current = sum(s.current_value for s in active_stakes)
        total_earnings = sum(s.total_earnings for s in stakes)

        return {
            "total_stakes": len(stakes),
            "active_stakes": len(active_stakes),
            "total_staked": total_staked,
            "total_current": total_current,
            "total_earnings": total_earnings,
            "roi": ((total_current - total_staked) / total_staked * 100) if total_staked > 0 else 0.0
        }

    def _generate_bond_id(self, founder_id: str, project_name: str) -> str:
        """Generate unique bond ID"""
        data = f"founder_bond:{founder_id}:{project_name}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _generate_stake_id(self, staker_id: str, bond_id: str) -> str:
        """Generate unique stake ID"""
        data = f"co_stake:{staker_id}:{bond_id}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
