"""
Impact Bonds - Real-World Impact Stake Mechanism

Revolutionary innovation: Stake in someone's commitment to create measurable
positive real-world impact. Profit when they achieve verified impact.

This makes solving real-world problems economically optimal, not just
philanthropic. Aligns profit with positive change.

Core Concept:
- Someone commits to measurable impact (clean ocean, reduce CO2, save lives)
- Community stakes belief in their commitment
- As they achieve verified impact → stakers profit
- Bigger/harder impact = higher multipliers
- Negative impact = penalties for everyone

Use Cases:
- Ocean cleanup projects (tons of plastic removed)
- Carbon reduction (tons of CO2 offset)
- Reforestation (trees planted and surviving)
- Education (students taught, outcomes measured)
- Healthcare (lives saved, diseases cured)
- Scientific research (discoveries, papers, citations)
- Humanitarian aid (people helped, verified outcomes)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class ImpactCategory(Enum):
    """Categories of real-world impact"""
    ENVIRONMENTAL = "environmental"  # Ocean, climate, wildlife
    SOCIAL = "social"  # Education, inequality, poverty
    HUMANITARIAN = "humanitarian"  # Disaster relief, refugees
    SCIENTIFIC = "scientific"  # Research, discoveries, cures
    HEALTH = "health"  # Lives saved, diseases treated
    INFRASTRUCTURE = "infrastructure"  # Clean water, energy, housing
    EDUCATION = "education"  # Learning, skills, knowledge
    ECONOMIC = "economic"  # Jobs created, economies built


class ImpactMetric(Enum):
    """Measurable impact metrics"""
    # Environmental
    PLASTIC_REMOVED_KG = "plastic_removed_kg"
    CO2_OFFSET_TONS = "co2_offset_tons"
    TREES_PLANTED = "trees_planted"
    OCEAN_CLEANED_M2 = "ocean_cleaned_m2"
    SPECIES_PROTECTED = "species_protected"

    # Social/Humanitarian
    PEOPLE_HELPED = "people_helped"
    LIVES_SAVED = "lives_saved"
    MEALS_PROVIDED = "meals_provided"
    SHELTERS_BUILT = "shelters_built"

    # Education/Health
    STUDENTS_TAUGHT = "students_taught"
    DISEASES_CURED = "diseases_cured"
    VACCINATIONS_GIVEN = "vaccinations_given"

    # Scientific
    PAPERS_PUBLISHED = "papers_published"
    CITATIONS_RECEIVED = "citations_received"
    PATENTS_FILED = "patents_filed"

    # Economic
    JOBS_CREATED = "jobs_created"
    BUSINESSES_LAUNCHED = "businesses_launched"


class VerificationMethod(Enum):
    """How impact is verified"""
    ORACLE = "oracle"  # Chainlink, Band Protocol, etc.
    ATTESTATION = "attestation"  # Community attestations
    SENSOR_DATA = "sensor_data"  # IoT sensors, satellites
    THIRD_PARTY_AUDIT = "third_party_audit"  # Independent auditors
    BLOCKCHAIN_PROOF = "blockchain_proof"  # On-chain verification
    SCIENTIFIC_PEER_REVIEW = "scientific_peer_review"  # Academic validation


@dataclass
class ImpactCommitment:
    """
    Commitment to create measurable real-world impact.

    Example:
    - Category: Environmental
    - Metric: Ocean cleanup (plastic removed)
    - Target: 10,000 kg of plastic in 1 year
    - Verification: Sensor data + third-party audit
    """
    commitment_id: str
    creator_id: str
    category: ImpactCategory
    metric: ImpactMetric
    target_amount: float  # What they're committing to
    target_deadline: datetime  # When they'll achieve it
    verification_method: VerificationMethod

    current_impact: float = 0.0  # What they've achieved so far
    verified_impact: float = 0.0  # What's been verified

    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True

    def record_impact(self, impact_amount: float, verification_proof: str = "") -> float:
        """
        Record new impact achievement.

        Returns: New total impact
        """
        if not self.is_active:
            raise ValueError("Commitment is no longer active")

        self.current_impact += impact_amount
        return self.current_impact

    def verify_impact(self, verified_amount: float, verifier: str = "") -> float:
        """
        Third-party verification of impact.

        Only verified impact counts for bond appreciation.
        """
        if verified_amount > self.current_impact:
            raise ValueError("Cannot verify more than claimed impact")

        self.verified_impact = verified_amount
        return self.verified_impact

    def progress_percentage(self) -> float:
        """How far toward target (0-100%, can exceed 100%)"""
        return (self.verified_impact / self.target_amount) * 100

    def impact_difficulty_multiplier(self) -> float:
        """
        Harder impacts get higher multipliers.

        Easy impact (students taught): 1.2x
        Medium impact (trees planted): 1.5x
        Hard impact (CO2 offset): 2.0x
        Extreme impact (lives saved): 3.0x
        """
        difficulty_map = {
            # Easy (educational, awareness)
            ImpactMetric.STUDENTS_TAUGHT: 1.2,
            ImpactMetric.PAPERS_PUBLISHED: 1.3,

            # Medium (physical, environmental)
            ImpactMetric.TREES_PLANTED: 1.5,
            ImpactMetric.PLASTIC_REMOVED_KG: 1.6,
            ImpactMetric.OCEAN_CLEANED_M2: 1.7,

            # Hard (systemic change)
            ImpactMetric.CO2_OFFSET_TONS: 2.0,
            ImpactMetric.JOBS_CREATED: 2.0,
            ImpactMetric.SHELTERS_BUILT: 2.2,

            # Extreme (life-saving)
            ImpactMetric.LIVES_SAVED: 3.0,
            ImpactMetric.DISEASES_CURED: 3.5,
            ImpactMetric.SPECIES_PROTECTED: 3.0,
        }

        return difficulty_map.get(self.metric, 1.5)

    def time_multiplier(self) -> float:
        """
        Sustained impact compounds over time.

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
            return 3.0  # Long-term sustained impact


@dataclass
class ImpactBond:
    """
    Economic stake in someone's impact commitment.

    When you stake belief in their impact, you profit when they achieve it.
    This makes solving real problems economically rational.
    """
    bond_id: str
    staker_id: str
    impact_creator_id: str
    commitment: ImpactCommitment

    initial_stake: float
    current_value: float = 0.0

    created_at: datetime = field(default_factory=datetime.now)
    vesting_period: timedelta = timedelta(days=730)  # 2 years for impact bonds

    total_earnings: float = 0.0
    is_active: bool = True

    def __post_init__(self):
        self.current_value = self.initial_stake

    def calculate_value_from_impact(self, new_verified_impact: float) -> float:
        """
        When impact is verified, bond appreciates.

        Value = stake * (verified_impact / target) * difficulty_mult * time_mult
        """
        if not self.is_active:
            return 0.0

        # Calculate progress toward target
        progress = new_verified_impact / self.commitment.target_amount

        # Apply multipliers
        difficulty_mult = self.commitment.impact_difficulty_multiplier()
        time_mult = self.commitment.time_multiplier()

        # Calculate new value: initial stake + appreciation from verified impact
        # Appreciation = initial_stake * progress * multipliers
        progress_appreciation = self.initial_stake * progress * difficulty_mult * time_mult
        new_value = self.initial_stake + progress_appreciation

        # Calculate appreciation (increase from current)
        old_value = self.current_value
        self.current_value = new_value

        appreciation = max(0, new_value - old_value)
        self.total_earnings += appreciation

        return appreciation

    def negative_impact_penalty(self, severity: float) -> float:
        """
        If impact creator causes harm, bonds lose value.

        Examples:
        - Ocean cleanup project causes wildlife harm
        - Reforestation uses invasive species
        - Educational program has abuse allegations

        Severity: 0.1 (minor) to 1.0 (catastrophic)
        """
        penalty = self.current_value * severity
        self.current_value = max(0, self.current_value - penalty)

        return penalty

    def achievement_bonus(self) -> float:
        """
        Bonus if target is exceeded.

        100% of target: 0% bonus
        150% of target: 25% bonus
        200% of target: 50% bonus
        """
        if self.commitment.verified_impact <= self.commitment.target_amount:
            return 0.0

        excess_ratio = self.commitment.verified_impact / self.commitment.target_amount
        if excess_ratio >= 2.0:
            bonus_mult = 0.5
        elif excess_ratio >= 1.5:
            bonus_mult = 0.25
        else:
            bonus_mult = 0.1

        bonus = self.current_value * bonus_mult
        self.current_value += bonus
        self.total_earnings += bonus

        return bonus

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


class ImpactBondsEngine:
    """
    Global engine managing all impact bonds.

    Tracks commitments, verifies impact, calculates earnings.
    """

    def __init__(self):
        self.bonds: Dict[str, ImpactBond] = {}
        self.commitments: Dict[str, ImpactCommitment] = {}
        self.staker_to_bonds: Dict[str, List[str]] = {}  # staker_id -> bond_ids
        self.creator_to_bonds: Dict[str, List[str]] = {}  # creator_id -> bond_ids

    def create_impact_commitment(
        self,
        creator_id: str,
        category: ImpactCategory,
        metric: ImpactMetric,
        target_amount: float,
        target_deadline: datetime,
        verification_method: VerificationMethod,
        description: str = ""
    ) -> ImpactCommitment:
        """
        Create public commitment to measurable impact.

        This opens it up for community staking.
        """
        if target_amount <= 0:
            raise ValueError("Target amount must be positive")

        if target_deadline <= datetime.now():
            raise ValueError("Target deadline must be in the future")

        commitment_id = self._generate_commitment_id(creator_id, metric.value)

        commitment = ImpactCommitment(
            commitment_id=commitment_id,
            creator_id=creator_id,
            category=category,
            metric=metric,
            target_amount=target_amount,
            target_deadline=target_deadline,
            verification_method=verification_method
        )

        self.commitments[commitment_id] = commitment
        return commitment

    def stake_in_impact(
        self,
        staker_id: str,
        commitment_id: str,
        stake_amount: float
    ) -> ImpactBond:
        """
        Stake belief in someone's impact commitment.

        If they achieve verified impact, you profit.
        """
        if commitment_id not in self.commitments:
            raise ValueError(f"Commitment {commitment_id} not found")

        if stake_amount <= 0:
            raise ValueError("Stake amount must be positive")

        commitment = self.commitments[commitment_id]
        if not commitment.is_active:
            raise ValueError("Commitment is no longer active")

        bond_id = self._generate_bond_id(staker_id, commitment.creator_id)

        bond = ImpactBond(
            bond_id=bond_id,
            staker_id=staker_id,
            impact_creator_id=commitment.creator_id,
            commitment=commitment,
            initial_stake=stake_amount
        )

        # Store bond
        self.bonds[bond_id] = bond

        # Update indices
        if staker_id not in self.staker_to_bonds:
            self.staker_to_bonds[staker_id] = []
        self.staker_to_bonds[staker_id].append(bond_id)

        if commitment.creator_id not in self.creator_to_bonds:
            self.creator_to_bonds[commitment.creator_id] = []
        self.creator_to_bonds[commitment.creator_id].append(bond_id)

        return bond

    def verify_impact(
        self,
        commitment_id: str,
        verified_amount: float,
        verifier_id: str,
        proof: str = ""
    ) -> Dict:
        """
        Verify impact achievement.

        When impact is verified, ALL stakers profit.
        """
        if commitment_id not in self.commitments:
            raise ValueError(f"Commitment {commitment_id} not found")

        commitment = self.commitments[commitment_id]

        # Verify impact (in production: use oracles, attestations, etc.)
        old_verified = commitment.verified_impact
        commitment.verify_impact(verified_amount, verifier_id)
        new_verified = commitment.verified_impact

        # No new impact verified
        if new_verified <= old_verified:
            return {
                "new_impact": 0.0,
                "stakers_paid": 0,
                "total_appreciation": 0.0
            }

        # Pay all stakers
        if commitment.creator_id not in self.creator_to_bonds:
            return {
                "new_impact": new_verified - old_verified,
                "stakers_paid": 0,
                "total_appreciation": 0.0
            }

        total_appreciation = 0.0
        stakers_paid = []

        for bond_id in self.creator_to_bonds[commitment.creator_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            # Only update bonds for THIS commitment
            if bond.commitment.commitment_id != commitment_id:
                continue

            # Calculate appreciation from verified impact
            appreciation = bond.calculate_value_from_impact(new_verified)
            total_appreciation += appreciation

            stakers_paid.append({
                "staker_id": bond.staker_id,
                "appreciation": appreciation,
                "new_value": bond.current_value
            })

        return {
            "new_impact": new_verified - old_verified,
            "total_verified": new_verified,
            "progress": commitment.progress_percentage(),
            "stakers_paid": len(stakers_paid),
            "total_appreciation": total_appreciation,
            "staker_details": stakers_paid
        }

    def handle_negative_impact(
        self,
        commitment_id: str,
        severity: float,
        description: str = ""
    ) -> Dict:
        """
        When impact creator causes harm, penalize all stakers.

        This incentivizes staking in responsible impact.
        """
        if commitment_id not in self.commitments:
            raise ValueError(f"Commitment {commitment_id} not found")

        commitment = self.commitments[commitment_id]

        if severity < 0.0 or severity > 1.0:
            raise ValueError("Severity must be 0.0-1.0")

        # Penalize all bonds
        if commitment.creator_id not in self.creator_to_bonds:
            return {
                "total_penalties": 0.0,
                "stakers_affected": 0
            }

        total_penalties = 0.0
        stakers_affected = []

        for bond_id in self.creator_to_bonds[commitment.creator_id]:
            bond = self.bonds[bond_id]
            if not bond.is_active:
                continue

            if bond.commitment.commitment_id != commitment_id:
                continue

            penalty = bond.negative_impact_penalty(severity)
            total_penalties += penalty

            stakers_affected.append({
                "staker_id": bond.staker_id,
                "penalty": penalty,
                "remaining_value": bond.current_value
            })

        return {
            "severity": severity,
            "total_penalties": total_penalties,
            "stakers_affected": len(stakers_affected),
            "staker_details": stakers_affected
        }

    def get_impact_stats(self, creator_id: str) -> Dict:
        """Get stats for impact creator"""
        # Find their commitments
        creator_commitments = [
            c for c in self.commitments.values()
            if c.creator_id == creator_id
        ]

        if not creator_commitments:
            return {
                "total_commitments": 0,
                "total_stakers": 0,
                "total_staked": 0.0
            }

        # Get all bonds
        bond_ids = self.creator_to_bonds.get(creator_id, [])
        bonds = [self.bonds[bid] for bid in bond_ids if self.bonds[bid].is_active]

        total_staked = sum(b.initial_stake for b in bonds)
        total_current = sum(b.current_value for b in bonds)

        # Aggregate impact
        total_verified_impact = sum(c.verified_impact for c in creator_commitments)
        avg_progress = sum(c.progress_percentage() for c in creator_commitments) / len(creator_commitments)

        return {
            "total_commitments": len(creator_commitments),
            "active_commitments": len([c for c in creator_commitments if c.is_active]),
            "total_verified_impact": total_verified_impact,
            "average_progress": avg_progress,
            "total_stakers": len(bonds),
            "total_staked": total_staked,
            "total_current_value": total_current,
            "community_confidence": total_current / total_staked if total_staked > 0 else 0.0
        }

    def get_staker_stats(self, staker_id: str) -> Dict:
        """Get stats for someone staking in impact"""
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

        # Aggregate impact stats
        total_impact_backed = sum(
            b.commitment.verified_impact for b in active_bonds
        )

        return {
            "total_bonds": len(bonds),
            "active_bonds": len(active_bonds),
            "total_staked": total_staked,
            "total_current": total_current,
            "total_earnings": total_earnings,
            "total_impact_backed": total_impact_backed,
            "roi": ((total_current - total_staked) / total_staked * 100) if total_staked > 0 else 0.0
        }

    def _generate_commitment_id(self, creator_id: str, metric: str) -> str:
        """Generate unique commitment ID"""
        data = f"impact:{creator_id}:{metric}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _generate_bond_id(self, staker: str, creator: str) -> str:
        """Generate unique bond ID"""
        data = f"impact_bond:{staker}:{creator}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
