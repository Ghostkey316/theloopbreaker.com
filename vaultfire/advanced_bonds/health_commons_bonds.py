"""
Health Commons Bonds - Clean Air, Water, Food > Profit from Poisoning

Revolutionary bond system that makes environmental health economically profitable.

Core Innovation:
- Bonds tied to BOTH pollution reduction AND human health improvement
- Can't just move pollution - must improve health in affected communities
- 70% to affected communities, 30% to company (or 100% to communities if poisoning)
- Community verification (people living there attest)

Philosophy:
- Clean air/water/food is a human right, not a privilege
- Companies profit from healing, not poisoning
- Affected communities control verification
- Actual health outcomes matter, not just environmental numbers

Use Cases:
- Industrial facilities reducing air/water pollution
- Food producers eliminating toxic additives
- Manufacturing cleaning up contamination
- Regional pollution remediation

Economic Mechanism:
- Bond value = Stake × Pollution_Reduction × Health_Improvement × Community_Gain × Time
- Pollution measured: air quality, water purity, food safety
- Health measured: respiratory illness, cancer rates, chronic disease, life expectancy
- Community verification required (aggregate only, no surveillance)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from enum import Enum


class PollutionSource(Enum):
    """Type of pollution source"""
    INDUSTRIAL_AIR = "industrial_air"
    WATER_DISCHARGE = "water_discharge"
    FOOD_PRODUCTION = "food_production"
    CHEMICAL_MANUFACTURING = "chemical_manufacturing"
    WASTE_DISPOSAL = "waste_disposal"


@dataclass
class PollutionMetrics:
    """Environmental pollution measurements"""
    measurement_date: datetime

    # Air Quality (0-100, higher is cleaner)
    air_quality_score: float  # PM2.5, toxins, industrial emissions

    # Water Purity (0-100, higher is cleaner)
    water_purity_score: float  # Heavy metals, PFAS, contaminants

    # Food Safety (0-100, higher is cleaner)
    food_safety_score: float  # Pesticide residues, additives, contaminants

    # Measured in affected region
    measurement_location: str
    verified_by_community: bool = False


@dataclass
class HealthOutcomes:
    """Human health measurements in affected community"""
    measurement_date: datetime

    # Respiratory Health (0-100, higher is healthier)
    respiratory_health_score: float  # Asthma, COPD, respiratory illness rates

    # Cancer Incidence (0-100, higher is healthier - inverse of cancer rates)
    cancer_health_score: float  # Cancer cluster tracking

    # Chronic Disease (0-100, higher is healthier)
    chronic_disease_score: float  # Diabetes, heart disease, autoimmune

    # Life Expectancy (measured in years, converted to 0-100 scale)
    life_expectancy_score: float  # Regional life expectancy vs baseline

    # Community self-reported health
    community_health_score: float  # Aggregate survey (anonymous)

    # Measured in affected region
    affected_population_size: int
    measurement_location: str
    verified_by_community: bool = False


@dataclass
class CommunityAttestation:
    """Community verification of health improvements"""
    attestor_id: str  # Anonymous identifier
    attestation_date: datetime
    location: str

    # What did they observe?
    observed_pollution_reduction: bool
    observed_health_improvement: bool

    # Free text (optional)
    notes: Optional[str] = None


@dataclass
class HealthDistribution:
    """Distribution of bond proceeds to community"""
    distribution_date: datetime
    total_amount: float
    community_share: float  # 70% or 100%
    company_share: float  # 30% or 0%

    # How was it distributed?
    per_capita_amount: float
    affected_population: int

    # Why this split?
    reason: str


class HealthCommonsBond:
    """
    Bond that ties company profits to environmental health and human health outcomes.

    Makes cleaning up pollution more profitable than continuing to poison.
    """

    def __init__(
        self,
        bond_id: str,
        company_id: str,
        company_name: str,
        pollution_source: PollutionSource,
        affected_region: str,
        stake_amount: float,
        created_at: Optional[datetime] = None
    ):
        self.bond_id = bond_id
        self.company_id = company_id
        self.company_name = company_name
        self.pollution_source = pollution_source
        self.affected_region = affected_region
        self.stake_amount = stake_amount
        self.created_at = created_at or datetime.now()

        # Measurements over time
        self.pollution_data: List[PollutionMetrics] = []
        self.health_data: List[HealthOutcomes] = []

        # Community verification
        self.community_attestations: List[CommunityAttestation] = []

        # Distributions
        self.distributions: List[HealthDistribution] = []

        # Penalties
        self.poisoning_penalty_active: bool = False
        self.penalty_reason: str = ""

        # Companies that got blocked
        self.companies_blocked: List[str] = []

    def add_pollution_data(self, metrics: PollutionMetrics):
        """Add pollution measurements"""
        self.pollution_data.append(metrics)

    def add_health_data(self, outcomes: HealthOutcomes):
        """Add health outcome measurements"""
        self.health_data.append(outcomes)

    def add_community_attestation(self, attestation: CommunityAttestation):
        """Community member verifies improvements"""
        if attestation.location != self.affected_region:
            raise ValueError("Attestor must be from affected region")

        self.community_attestations.append(attestation)

    def pollution_reduction_score(self) -> float:
        """
        How much has pollution decreased?

        Measures across air, water, food.
        Returns: 0.0 to 2.0
        - Significant reduction → 1.5x to 2.0x
        - No change → 1.0x
        - Worsening pollution → 0.0x to 0.5x
        """
        if len(self.pollution_data) < 2:
            return 1.0

        initial = self.pollution_data[0]
        latest = self.pollution_data[-1]

        # Average across all pollution types
        initial_avg = (
            initial.air_quality_score +
            initial.water_purity_score +
            initial.food_safety_score
        ) / 3

        latest_avg = (
            latest.air_quality_score +
            latest.water_purity_score +
            latest.food_safety_score
        ) / 3

        improvement = latest_avg - initial_avg

        if improvement >= 30:  # Significant cleanup
            return 1.5 + (min(50, improvement - 30) / 50) * 0.5
        elif improvement >= 10:  # Moderate improvement
            return 1.0 + (improvement - 10) / 20 * 0.5
        elif improvement >= -10:  # Roughly stable
            return 1.0 + improvement / 10 * 0.0
        else:  # Getting worse
            return max(0.0, 0.5 + improvement / 40)

    def health_improvement_score(self) -> float:
        """
        How much has human health improved?

        This is the KEY metric - actual health outcomes.
        Returns: 0.0 to 2.0
        - Significant improvement → 1.5x to 2.0x
        - No change → 1.0x
        - Declining health → 0.0x to 0.5x
        """
        if len(self.health_data) < 2:
            return 1.0

        initial = self.health_data[0]
        latest = self.health_data[-1]

        # Average across all health metrics
        initial_avg = (
            initial.respiratory_health_score +
            initial.cancer_health_score +
            initial.chronic_disease_score +
            initial.life_expectancy_score +
            initial.community_health_score
        ) / 5

        latest_avg = (
            latest.respiratory_health_score +
            latest.cancer_health_score +
            latest.chronic_disease_score +
            latest.life_expectancy_score +
            latest.community_health_score
        ) / 5

        improvement = latest_avg - initial_avg

        if improvement >= 20:  # Major health improvement
            return 1.5 + (min(30, improvement - 20) / 30) * 0.5
        elif improvement >= 5:  # Moderate improvement
            return 1.0 + (improvement - 5) / 15 * 0.5
        elif improvement >= -5:  # Roughly stable
            return 1.0 + improvement / 5 * 0.0
        else:  # Health declining
            return max(0.0, 0.5 + improvement / 40)

    def community_verification_multiplier(self) -> float:
        """
        Do people living there confirm improvements?

        Community verification is REQUIRED for full value.
        Returns: 0.5 to 1.5
        """
        if not self.community_attestations:
            return 0.5  # No verification = penalty

        # Check recent attestations (last 6 months)
        cutoff = datetime.now() - timedelta(days=180)
        recent = [a for a in self.community_attestations if a.attestation_date >= cutoff]

        if not recent:
            return 0.7  # Old attestations = partial penalty

        # How many confirm improvements?
        pollution_confirmations = sum(1 for a in recent if a.observed_pollution_reduction)
        health_confirmations = sum(1 for a in recent if a.observed_health_improvement)

        total = len(recent)
        pollution_rate = pollution_confirmations / total if total > 0 else 0
        health_rate = health_confirmations / total if total > 0 else 0

        avg_rate = (pollution_rate + health_rate) / 2

        if avg_rate >= 0.8:  # Strong consensus
            return 1.5
        elif avg_rate >= 0.5:  # Moderate consensus
            return 1.0 + (avg_rate - 0.5) / 0.3 * 0.5
        else:  # Weak or no consensus
            return 0.5 + avg_rate / 0.5 * 0.5

    def time_multiplier(self) -> float:
        """
        Reward sustained health improvements.

        Returns: 1.0 to 3.0
        - < 1 year: 1.0x
        - 1-3 years: 1.0x to 2.0x
        - 3+ years: 2.0x to 3.0x
        """
        age = datetime.now() - self.created_at
        years = age.days / 365.25

        if years < 1:
            return 1.0
        elif years < 3:
            return 1.0 + (years - 1) / 2
        else:
            return min(3.0, 2.0 + (years - 3) / 2)

    def should_activate_poisoning_penalty(self) -> bool:
        """
        Should penalty activate for continued poisoning?

        Penalty if:
        - Pollution increased
        - Health declined
        - No community verification
        """
        pollution_score = self.pollution_reduction_score()
        health_score = self.health_improvement_score()
        community_score = self.community_verification_multiplier()

        # Pollution got worse
        if pollution_score < 0.8:
            self.poisoning_penalty_active = True
            self.penalty_reason = f"Pollution worsened (score: {pollution_score:.2f})"
            return True

        # Health got worse
        if health_score < 0.8:
            self.poisoning_penalty_active = True
            self.penalty_reason = f"Community health declined (score: {health_score:.2f})"
            return True

        # No community verification
        if community_score < 0.7:
            self.poisoning_penalty_active = True
            self.penalty_reason = f"Insufficient community verification (score: {community_score:.2f})"
            return True

        self.poisoning_penalty_active = False
        self.penalty_reason = ""
        return False

    def calculate_bond_value(self) -> float:
        """
        Calculate current bond value.

        Formula:
        Bond Value = Stake × Pollution_Reduction × Health_Improvement ×
                     Community_Verification × Time
        """
        base = self.stake_amount

        pollution = self.pollution_reduction_score()
        health = self.health_improvement_score()
        community = self.community_verification_multiplier()
        time = self.time_multiplier()

        value = base * pollution * health * community * time

        return value

    def calculate_appreciation(self) -> float:
        """How much has bond appreciated (or depreciated)?"""
        current = self.calculate_bond_value()
        initial = self.stake_amount
        return current - initial

    def distribute_to_community(self) -> Optional[HealthDistribution]:
        """
        Distribute proceeds to affected community.

        - Improvement: 70% community, 30% company
        - Poisoning: 100% community (compensation)
        """
        appreciation = self.calculate_appreciation()

        if appreciation == 0:
            return None

        # Check if poisoning penalty active
        penalty_active = self.should_activate_poisoning_penalty()

        # Get affected population (from latest health data)
        if not self.health_data:
            return None

        population = self.health_data[-1].affected_population_size

        if appreciation > 0:
            # Bond appreciated
            if penalty_active:
                # Poisoning ongoing - 100% to community
                community_share = appreciation
                company_share = 0.0
                reason = f"Poisoning penalty: {self.penalty_reason}"
            else:
                # Health improving - 70/30 split
                community_share = appreciation * 0.7
                company_share = appreciation * 0.3
                reason = "Health improvements confirmed"
        else:
            # Bond depreciated - all goes to community as compensation
            community_share = abs(appreciation)
            company_share = 0.0
            reason = "Depreciation compensation for continued harm"

        distribution = HealthDistribution(
            distribution_date=datetime.now(),
            total_amount=appreciation,
            community_share=community_share,
            company_share=company_share,
            per_capita_amount=community_share / population if population > 0 else 0,
            affected_population=population,
            reason=reason
        )

        self.distributions.append(distribution)
        return distribution

    def company_payout(self) -> float:
        """How much does company earn?"""
        if not self.distributions:
            return 0.0

        latest = self.distributions[-1]
        return latest.company_share

    def mark_company_blocked(self, reason: str):
        """Block company for severe ongoing poisoning"""
        if self.company_id not in self.companies_blocked:
            self.companies_blocked.append(self.company_id)
            self.poisoning_penalty_active = True
            self.penalty_reason = reason


def create_health_commons_bond(
    bond_id: str,
    company_id: str,
    company_name: str,
    pollution_source: PollutionSource,
    affected_region: str,
    stake_amount: float
) -> HealthCommonsBond:
    """Create a new Health Commons Bond"""
    return HealthCommonsBond(
        bond_id=bond_id,
        company_id=company_id,
        company_name=company_name,
        pollution_source=pollution_source,
        affected_region=affected_region,
        stake_amount=stake_amount
    )
