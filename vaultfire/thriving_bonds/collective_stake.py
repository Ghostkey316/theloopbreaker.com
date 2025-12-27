"""
Thriving Bonds - Collective Stake Mechanism

The first crypto primitive where helping others is MORE profitable than helping yourself.

Core Innovation:
- Stake belief in a community (not just one person)
- Bond appreciates based on collective thriving
- Individual extraction penalizes everyone's bonds
- Weakest link matters - incentivized to help struggling members

Economics:
- Cooperation > Competition (by design)
- Community success > Individual success
- Collective thriving compounds over time
- Extraction becomes economically stupid

Alignment:
- Humanity over control (community self-governs)
- Morals over metrics (helping others = profit)
- The little guy protected (weakest link multiplier)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class CommunityType(Enum):
    """Types of thriving communities"""
    CREATOR_COHORT = "creator_cohort"  # 50 creators bonded together
    BUILDER_COLLECTIVE = "builder_collective"  # Devs building on Base
    LOCAL_COMMUNITY = "local_community"  # Geographic community (town, neighborhood)
    AI_SWARM = "ai_swarm"  # AI agents cooperating
    STUDENT_GUILD = "student_guild"  # Learning cohort
    SUPPORT_NETWORK = "support_network"  # Mutual aid network
    RESEARCH_CONSORTIUM = "research_consortium"  # Research collaboration
    OPEN_SOURCE_COLLECTIVE = "open_source_collective"  # OSS maintainers


class ExtractionEventType(Enum):
    """Types of extraction that penalize the collective"""
    RUG_PULL = "rug_pull"  # Exit scam, abandoned project
    BETRAYAL = "betrayal"  # Breaking community trust
    PREDATORY_BEHAVIOR = "predatory_behavior"  # Exploiting members
    BREAKING_COVENANT = "breaking_covenant"  # Violating community rules
    COMPETITIVE_EXTRACTION = "competitive_extraction"  # Zero-sum behavior
    FORK_WITHOUT_ATTRIBUTION = "fork_without_attribution"  # Stealing work


@dataclass
class CommunityMember:
    """Member of a thriving community"""
    identifier: str
    entity_type: str  # "human", "ai_agent", "organization"
    reputation_score: float = 1.0  # 0.0 to 2.0, starts at 1.0
    total_impact: float = 0.0  # Value created for community
    contributions: int = 0
    joined_timestamp: datetime = field(default_factory=datetime.now)
    is_active: bool = True

    def reputation_multiplier(self) -> float:
        """Reputation affects bond value"""
        return max(0.1, min(2.0, self.reputation_score))

    def days_active(self) -> int:
        """How long member has been active"""
        return (datetime.now() - self.joined_timestamp).days

    def record_contribution(self, impact_value: float):
        """Record a contribution to the community"""
        self.total_impact += impact_value
        self.contributions += 1

    def penalize_reputation(self, penalty: float):
        """Apply reputation penalty for bad behavior"""
        self.reputation_score = max(0.0, self.reputation_score - penalty)
        if self.reputation_score < 0.1:
            self.is_active = False  # Ejected from community


@dataclass
class ThrivingBondStake:
    """A member's stake in the collective thriving pool"""
    bond_id: str
    staker: CommunityMember
    community_id: str
    base_stake: float  # Initial stake amount
    current_value: float = 0.0
    staked_at: datetime = field(default_factory=datetime.now)
    vesting_days: int = 180  # 6 months default
    is_active: bool = True

    def days_staked(self) -> int:
        """Days since staking"""
        return (datetime.now() - self.staked_at).days

    def vesting_progress(self) -> float:
        """Vesting progress 0.0 to 1.0"""
        return min(1.0, self.days_staked() / self.vesting_days)

    def time_multiplier(self) -> float:
        """Time bonus: 1.0x at start → 2.0x fully vested"""
        return 1.0 + self.vesting_progress()

    def vested_value(self) -> float:
        """Amount that can be withdrawn (vested portion)"""
        return self.current_value * self.vesting_progress()

    def unvested_value(self) -> float:
        """Amount still vesting"""
        return self.current_value - self.vested_value()

    def early_withdrawal_penalty(self) -> float:
        """Penalty for withdrawing before full vesting"""
        unvested = self.unvested_value()
        penalty_multiplier = 1.5  # Lose 150% of unvested amount
        return unvested * penalty_multiplier


@dataclass
class ExtractionEvent:
    """Record of extraction that penalized the collective"""
    event_id: str
    extractor: CommunityMember
    event_type: ExtractionEventType
    extraction_amount: float
    timestamp: datetime = field(default_factory=datetime.now)
    collective_penalty: float = 0.0
    members_affected: int = 0


class CommunityThrivingPool:
    """
    A pool of members with collective stake in each other's success.

    Key Mechanics:
    1. Collective Appreciation - All bonds grow with community success
    2. Weakest Link Multiplier - Lowest reputation sets ceiling
    3. Extraction Penalty Spreads - One person extracts, everyone loses
    4. Milestone Unlocks - Can't withdraw until collective goals hit
    """

    def __init__(
        self,
        pool_id: str,
        community_type: CommunityType,
        founding_members: List[CommunityMember],
        mission_statement: str,
        min_reputation_floor: float = 0.5
    ):
        self.pool_id = pool_id
        self.community_type = community_type
        self.members: Dict[str, CommunityMember] = {m.identifier: m for m in founding_members}
        self.mission_statement = mission_statement
        self.min_reputation_floor = min_reputation_floor

        self.stakes: Dict[str, ThrivingBondStake] = {}
        self.created_at = datetime.now()
        self.total_collective_impact = 0.0
        self.milestones_achieved = 0
        self.extraction_events: List[ExtractionEvent] = []

    def add_member(self, member: CommunityMember, stake_amount: float) -> ThrivingBondStake:
        """Add new member to thriving pool and create their stake"""
        if member.identifier in self.members:
            # Member already exists, just create stake
            return self.create_stake_for_member(member.identifier, stake_amount)

        self.members[member.identifier] = member

        # Create stake
        bond_id = self._generate_bond_id(member.identifier)
        stake = ThrivingBondStake(
            bond_id=bond_id,
            staker=member,
            community_id=self.pool_id,
            base_stake=stake_amount,
            current_value=stake_amount
        )
        self.stakes[bond_id] = stake

        return stake

    def create_stake_for_member(self, member_id: str, stake_amount: float) -> ThrivingBondStake:
        """Create stake for an existing member"""
        if member_id not in self.members:
            raise ValueError(f"Member {member_id} not in pool")

        member = self.members[member_id]

        # Create stake
        bond_id = self._generate_bond_id(member_id)
        stake = ThrivingBondStake(
            bond_id=bond_id,
            staker=member,
            community_id=self.pool_id,
            base_stake=stake_amount,
            current_value=stake_amount
        )
        self.stakes[bond_id] = stake

        return stake

    def reputation_floor(self) -> float:
        """Lowest reputation score in community (weakest link)"""
        if not self.members:
            return 1.0

        active_members = [m for m in self.members.values() if m.is_active]
        if not active_members:
            return 1.0

        return min(m.reputation_score for m in active_members)

    def cooperation_multiplier(self) -> float:
        """Multiplier based on collective cooperation (weakest link matters)"""
        floor = self.reputation_floor()
        # If reputation floor drops below minimum, multiplier tanks
        if floor < self.min_reputation_floor:
            return 0.1  # 90% penalty
        return floor

    def days_active(self) -> int:
        """Days since pool creation"""
        return (datetime.now() - self.created_at).days

    def time_multiplier(self) -> float:
        """Community time bonus: 1.0x → 2.0x over 180 days"""
        progress = min(1.0, self.days_active() / 180.0)
        return 1.0 + progress

    def milestone_multiplier(self) -> float:
        """Bonus for achieving collective milestones"""
        # Each milestone = +10% bonus
        return 1.0 + (self.milestones_achieved * 0.1)

    def calculate_collective_value(self) -> float:
        """
        Calculate total collective value based on all members' impact.

        Formula:
        collective_value = total_impact × cooperation_mult × time_mult × milestone_mult
        """
        base_value = self.total_collective_impact
        cooperation = self.cooperation_multiplier()
        time = self.time_multiplier()
        milestones = self.milestone_multiplier()

        return base_value * cooperation * time * milestones

    def update_bond_values(self):
        """Recalculate all bond values based on collective success"""
        collective_value = self.calculate_collective_value()
        total_staked = sum(s.base_stake for s in self.stakes.values())

        if total_staked == 0:
            return

        for stake in self.stakes.values():
            if not stake.is_active:
                continue

            # Each member's share of collective value
            share = stake.base_stake / total_staked
            collective_portion = collective_value * share

            # Apply member-specific multipliers
            member_time_mult = stake.time_multiplier()
            member_reputation = stake.staker.reputation_multiplier()

            # Bond value = base + collective share + multipliers
            stake.current_value = (
                stake.base_stake +
                collective_portion * member_time_mult * member_reputation
            )

    def record_contribution(
        self,
        member_id: str,
        impact_value: float,
        description: str = ""
    ) -> Dict:
        """
        Record a contribution to the collective.
        This increases total_collective_impact and the member's personal impact.
        """
        if member_id not in self.members:
            raise ValueError(f"Member {member_id} not in pool")

        member = self.members[member_id]
        member.record_contribution(impact_value)
        self.total_collective_impact += impact_value

        # Recalculate all bond values
        self.update_bond_values()

        return {
            "member": member_id,
            "impact_value": impact_value,
            "new_collective_value": self.calculate_collective_value(),
            "member_total_impact": member.total_impact
        }

    def handle_extraction_event(
        self,
        extractor_id: str,
        event_type: ExtractionEventType,
        extraction_amount: float
    ) -> Dict:
        """
        When one member extracts, EVERYONE's bonds lose value.
        This is the core mechanism that makes extraction economically stupid.
        """
        if extractor_id not in self.members:
            raise ValueError(f"Extractor {extractor_id} not in pool")

        extractor = self.members[extractor_id]

        # Calculate collective penalty (spreads across all bonds)
        penalty_per_bond = extraction_amount * 0.15  # 15% of extraction distributed
        total_collective_penalty = penalty_per_bond * len(self.stakes)

        # Apply penalty to ALL bonds
        affected_count = 0
        for stake in self.stakes.values():
            if stake.is_active:
                stake.current_value = max(0, stake.current_value - penalty_per_bond)
                affected_count += 1

        # Destroy extractor's reputation (severe penalty for extraction)
        reputation_penalty = 0.95  # Lose 95% reputation (usually ejects)
        extractor.penalize_reputation(reputation_penalty)

        # Reduce collective impact
        self.total_collective_impact = max(0, self.total_collective_impact - extraction_amount)

        # Record event
        event = ExtractionEvent(
            event_id=self._generate_event_id(extractor_id),
            extractor=extractor,
            event_type=event_type,
            extraction_amount=extraction_amount,
            collective_penalty=total_collective_penalty,
            members_affected=affected_count
        )
        self.extraction_events.append(event)

        # Update all bond values with new reputation floor
        self.update_bond_values()

        return {
            "extractor": extractor_id,
            "event_type": event_type.value,
            "extraction_amount": extraction_amount,
            "collective_penalty": total_collective_penalty,
            "members_affected": affected_count,
            "extractor_new_reputation": extractor.reputation_score,
            "new_reputation_floor": self.reputation_floor(),
            "extractor_ejected": not extractor.is_active
        }

    def withdraw_stake(self, member_id: str) -> Dict:
        """
        Withdraw vested stake. Early withdrawal incurs penalty.
        """
        stake = self._get_member_stake(member_id)

        vested = stake.vested_value()
        unvested = stake.unvested_value()
        penalty = 0.0

        if unvested > 0:
            # Early withdrawal - apply penalty
            penalty = stake.early_withdrawal_penalty()
            # Penalty goes back to collective pool
            self.total_collective_impact += penalty * 0.5  # 50% recycled

        withdrawal_amount = max(0, vested - penalty)

        # Mark stake as withdrawn
        stake.is_active = False
        stake.current_value = 0.0

        return {
            "member": member_id,
            "vested_amount": vested,
            "unvested_amount": unvested,
            "early_withdrawal_penalty": penalty,
            "withdrawal_amount": withdrawal_amount,
            "penalty_recycled_to_pool": penalty * 0.5
        }

    def achieve_milestone(self, description: str) -> Dict:
        """
        Community achieves a collective milestone.
        Unlocks bonuses for all bonds.
        """
        self.milestones_achieved += 1
        self.update_bond_values()

        return {
            "milestone": description,
            "total_milestones": self.milestones_achieved,
            "new_milestone_multiplier": self.milestone_multiplier(),
            "new_collective_value": self.calculate_collective_value()
        }

    def get_pool_stats(self) -> Dict:
        """Get comprehensive pool statistics"""
        active_members = [m for m in self.members.values() if m.is_active]
        active_stakes = [s for s in self.stakes.values() if s.is_active]

        return {
            "pool_id": self.pool_id,
            "community_type": self.community_type.value,
            "mission": self.mission_statement,
            "total_members": len(self.members),
            "active_members": len(active_members),
            "total_collective_impact": self.total_collective_impact,
            "collective_value": self.calculate_collective_value(),
            "reputation_floor": self.reputation_floor(),
            "cooperation_multiplier": self.cooperation_multiplier(),
            "time_multiplier": self.time_multiplier(),
            "milestones_achieved": self.milestones_achieved,
            "extraction_events": len(self.extraction_events),
            "total_stakes_value": sum(s.current_value for s in active_stakes),
            "days_active": self.days_active()
        }

    def _get_member_stake(self, member_id: str) -> ThrivingBondStake:
        """Get stake by member ID"""
        for stake in self.stakes.values():
            if stake.staker.identifier == member_id and stake.is_active:
                return stake
        raise ValueError(f"No active stake found for member {member_id}")

    def _generate_bond_id(self, member_id: str) -> str:
        """Generate unique bond ID"""
        data = f"{self.pool_id}:{member_id}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _generate_event_id(self, extractor_id: str) -> str:
        """Generate unique event ID"""
        data = f"{self.pool_id}:{extractor_id}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]


class ThrivingBondsEngine:
    """
    Global engine managing all thriving pools.
    Provides analytics and cross-pool interactions.
    """

    def __init__(self):
        self.pools: Dict[str, CommunityThrivingPool] = {}
        self.members_registry: Dict[str, CommunityMember] = {}

    def create_pool(
        self,
        pool_id: str,
        community_type: CommunityType,
        founding_members: List[CommunityMember],
        mission_statement: str
    ) -> CommunityThrivingPool:
        """Create new thriving pool"""
        if pool_id in self.pools:
            raise ValueError(f"Pool {pool_id} already exists")

        pool = CommunityThrivingPool(
            pool_id=pool_id,
            community_type=community_type,
            founding_members=founding_members,
            mission_statement=mission_statement
        )

        self.pools[pool_id] = pool

        # Register members
        for member in founding_members:
            if member.identifier not in self.members_registry:
                self.members_registry[member.identifier] = member

        return pool

    def get_pool(self, pool_id: str) -> CommunityThrivingPool:
        """Get pool by ID"""
        if pool_id not in self.pools:
            raise ValueError(f"Pool {pool_id} not found")
        return self.pools[pool_id]

    def get_member_pools(self, member_id: str) -> List[CommunityThrivingPool]:
        """Get all pools a member belongs to"""
        return [
            pool for pool in self.pools.values()
            if member_id in pool.members
        ]

    def get_global_stats(self) -> Dict:
        """Get global statistics across all pools"""
        total_collective_value = sum(
            pool.calculate_collective_value()
            for pool in self.pools.values()
        )

        total_members = len(self.members_registry)
        total_stakes = sum(
            len(pool.stakes)
            for pool in self.pools.values()
        )

        avg_reputation = (
            sum(m.reputation_score for m in self.members_registry.values()) /
            total_members if total_members > 0 else 1.0
        )

        return {
            "total_pools": len(self.pools),
            "total_members": total_members,
            "total_stakes": total_stakes,
            "total_collective_value": total_collective_value,
            "average_reputation": avg_reputation,
            "community_types": {
                ct.value: sum(
                    1 for p in self.pools.values()
                    if p.community_type == ct
                )
                for ct in CommunityType
            }
        }
