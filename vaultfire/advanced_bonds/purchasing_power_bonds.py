"""
Purchasing Power Bonds - Restoring 1990s Affordability (or Better)

Revolutionary bond system that makes real purchasing power economically profitable.

Core Innovation:
- Bonds tied to REAL affordability, not paper wages
- Can't game by raising wages 3% while raising prices 10%
- Must restore 1990s-level purchasing power (or better)
- 70% to workers, 30% to company (or 100% to workers if declining)
- Company chooses HOW (raise wages, lower costs, build housing, etc.)

Philosophy:
- Real wages > nominal wages
- Workers should afford what 1990s workers could afford (house, food, healthcare, savings)
- Working harder but affording LESS is broken
- Companies profit from workers affording MORE, not less

Use Cases:
- Companies raising wages above inflation
- Companies lowering costs for workers (housing, food, healthcare)
- Companies building affordable housing for workers
- Regional purchasing power improvements

Economic Mechanism:
- Bond value = Stake × Housing × Food × Healthcare × Education × Transport × Discretionary × Time
- Housing: rent/mortgage as % of income (target <30% like 1990s)
- Food: hours worked to buy groceries
- Healthcare: % of income on insurance/care
- Education: can workers afford training/college?
- Transportation: commute cost as % of income
- Discretionary: money left after necessities (savings, fun, family)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from enum import Enum


class AffordabilityBaseline(Enum):
    """Baseline eras for purchasing power comparison"""
    YEAR_1990 = "1990s"
    YEAR_2000 = "2000s"
    CURRENT = "current"


@dataclass
class PurchasingPowerMetrics:
    """Real purchasing power measurements for workers"""
    measurement_date: datetime

    # Housing affordability (% of income on rent/mortgage)
    # 1990s baseline: 25-30%, Current often: 40-50%
    housing_cost_percent: float  # 0-100 (lower is better, but we'll invert for scoring)

    # Food affordability (hours worked per week to afford groceries)
    # 1990s baseline: ~3-4 hours, Current: ~5-8 hours
    food_hours_per_week: float  # hours worked to buy weekly groceries

    # Healthcare affordability (% of income on healthcare)
    # 1990s baseline: 5-7%, Current: 15-20%
    healthcare_cost_percent: float  # 0-100

    # Education affordability (can workers afford training/college?)
    # 1990s baseline: state college ~1 year wages, Current: 2-4 years wages
    education_affordability_score: float  # 0-100 (100 = easily affordable)

    # Transportation affordability (commute cost as % of income)
    # 1990s baseline: 5-10%, Current: 10-15%
    transportation_cost_percent: float  # 0-100

    # Discretionary income (% of income left after necessities)
    # 1990s baseline: 20-30%, Current: often <10%
    discretionary_income_percent: float  # 0-100 (higher is better)

    # Measured for workers at this company
    company_id: str
    worker_count: int
    average_wage: float  # For reference

    # Anonymous aggregate data
    verified_by_workers: bool = False


@dataclass
class BaselinePurchasingPower:
    """1990s baseline for comparison"""
    housing_target: float = 30.0  # Max % of income on housing
    food_hours_target: float = 4.0  # Max hours per week for groceries
    healthcare_target: float = 7.0  # Max % of income on healthcare
    education_score_target: float = 75.0  # Min education affordability
    transportation_target: float = 10.0  # Max % on transportation
    discretionary_target: float = 25.0  # Min % discretionary income


@dataclass
class WorkerAttestation:
    """Worker verification of purchasing power improvements"""
    attestor_id: str  # Anonymous identifier
    attestation_date: datetime
    company_id: str

    # What did they observe?
    can_afford_housing: bool  # Can you afford rent/mortgage?
    can_afford_food: bool  # Can you afford groceries without stress?
    can_afford_healthcare: bool  # Can you afford insurance/care?
    can_save_money: bool  # Can you save money each month?

    # Overall improvement
    purchasing_power_improving: bool

    # Free text (optional)
    notes: Optional[str] = None


@dataclass
class PurchasingPowerDistribution:
    """Distribution of bond proceeds to workers"""
    distribution_date: datetime
    total_amount: float
    worker_share: float  # 70% or 100%
    company_share: float  # 30% or 0%

    # How was it distributed?
    per_worker_amount: float
    worker_count: int

    # Why this split?
    reason: str


class PurchasingPowerBond:
    """
    Bond that ties company profits to real worker purchasing power.

    Makes restoring 1990s affordability (or better) more profitable than wage stagnation.
    """

    def __init__(
        self,
        bond_id: str,
        company_id: str,
        company_name: str,
        stake_amount: float,
        baseline: BaselinePurchasingPower = None,
        created_at: Optional[datetime] = None
    ):
        self.bond_id = bond_id
        self.company_id = company_id
        self.company_name = company_name
        self.stake_amount = stake_amount
        self.baseline = baseline or BaselinePurchasingPower()
        self.created_at = created_at or datetime.now()

        # Measurements over time
        self.purchasing_power_data: List[PurchasingPowerMetrics] = []

        # Worker verification
        self.worker_attestations: List[WorkerAttestation] = []

        # Distributions
        self.distributions: List[PurchasingPowerDistribution] = []

        # Penalties
        self.declining_penalty_active: bool = False
        self.penalty_reason: str = ""

    def add_purchasing_power_data(self, metrics: PurchasingPowerMetrics):
        """Add purchasing power measurements"""
        if metrics.company_id != self.company_id:
            raise ValueError("Metrics must be for this company")
        self.purchasing_power_data.append(metrics)

    def add_worker_attestation(self, attestation: WorkerAttestation):
        """Worker verifies purchasing power improvements"""
        if attestation.company_id != self.company_id:
            raise ValueError("Attestor must be worker at this company")

        self.worker_attestations.append(attestation)

    def housing_affordability_score(self) -> float:
        """
        How affordable is housing?

        Returns: 0.0 to 2.0
        - Much better than 1990s → 1.5x to 2.0x
        - Same as 1990s (30%) → 1.0x
        - Worse than 1990s → 0.0x to 0.8x
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        initial = self.purchasing_power_data[0]
        latest = self.purchasing_power_data[-1]

        # How much better/worse than baseline?
        # Lower % is better for housing costs
        baseline_percent = self.baseline.housing_target  # 30%
        current_percent = latest.housing_cost_percent

        if current_percent <= 25:  # Much better than 1990s
            return 2.0
        elif current_percent <= baseline_percent:  # At or better than 1990s
            return 1.0 + (baseline_percent - current_percent) / baseline_percent * 1.0
        elif current_percent <= 40:  # Worse but not terrible
            return 1.0 - (current_percent - baseline_percent) / 20
        else:  # Much worse
            return max(0.0, 0.5 - (current_percent - 40) / 40)

    def food_affordability_score(self) -> float:
        """
        How affordable is food?

        Returns: 0.0 to 2.0
        - Much better than 1990s → 1.5x to 2.0x
        - Same as 1990s (4 hours) → 1.0x
        - Worse than 1990s → 0.0x to 0.8x
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        latest = self.purchasing_power_data[-1]

        # How many hours to afford groceries?
        baseline_hours = self.baseline.food_hours_target  # 4 hours
        current_hours = latest.food_hours_per_week

        if current_hours <= 3:  # Much better than 1990s
            return 2.0
        elif current_hours <= baseline_hours:  # At or better than 1990s
            return 1.0 + (baseline_hours - current_hours) / baseline_hours * 1.0
        elif current_hours <= 6:  # Worse but manageable
            return 1.0 - (current_hours - baseline_hours) / 4
        else:  # Much worse
            return max(0.0, 0.5 - (current_hours - 6) / 6)

    def healthcare_affordability_score(self) -> float:
        """
        How affordable is healthcare?

        Returns: 0.0 to 2.0
        - Much better than 1990s → 1.5x to 2.0x
        - Same as 1990s (7%) → 1.0x
        - Worse than 1990s → 0.0x to 0.8x
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        latest = self.purchasing_power_data[-1]

        baseline_percent = self.baseline.healthcare_target  # 7%
        current_percent = latest.healthcare_cost_percent

        if current_percent <= 5:  # Much better than 1990s
            return 2.0
        elif current_percent <= baseline_percent:  # At or better than 1990s
            return 1.0 + (baseline_percent - current_percent) / baseline_percent * 1.0
        elif current_percent <= 15:  # Worse but not terrible
            return 1.0 - (current_percent - baseline_percent) / 10
        else:  # Much worse
            return max(0.0, 0.5 - (current_percent - 15) / 20)

    def education_affordability_score(self) -> float:
        """
        How affordable is education/training?

        Returns: 0.0 to 2.0
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        latest = self.purchasing_power_data[-1]
        score = latest.education_affordability_score

        if score >= 90:  # Excellent affordability
            return 2.0
        elif score >= self.baseline.education_score_target:  # Good
            return 1.0 + (score - self.baseline.education_score_target) / 25
        elif score >= 50:  # Mediocre
            return 0.5 + (score - 50) / 50
        else:  # Poor
            return max(0.0, score / 100)

    def transportation_affordability_score(self) -> float:
        """
        How affordable is transportation?

        Returns: 0.0 to 2.0
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        latest = self.purchasing_power_data[-1]

        baseline_percent = self.baseline.transportation_target  # 10%
        current_percent = latest.transportation_cost_percent

        if current_percent <= 5:  # Much better than 1990s
            return 2.0
        elif current_percent <= baseline_percent:  # At or better
            return 1.0 + (baseline_percent - current_percent) / baseline_percent * 1.0
        elif current_percent <= 15:  # Worse but manageable
            return 1.0 - (current_percent - baseline_percent) / 10
        else:  # Much worse
            return max(0.0, 0.5 - (current_percent - 15) / 20)

    def discretionary_income_score(self) -> float:
        """
        How much money is left after necessities?

        Returns: 0.0 to 2.0
        - Much better than 1990s (30%+) → 1.5x to 2.0x
        - Same as 1990s (25%) → 1.0x
        - Worse than 1990s → 0.0x to 0.8x
        """
        if len(self.purchasing_power_data) < 2:
            return 1.0

        latest = self.purchasing_power_data[-1]

        baseline_percent = self.baseline.discretionary_target  # 25%
        current_percent = latest.discretionary_income_percent

        if current_percent >= 35:  # Much better than 1990s
            return 2.0
        elif current_percent >= baseline_percent:  # At or better
            return 1.0 + (current_percent - baseline_percent) / 15
        elif current_percent >= 15:  # Worse but some left
            return 0.5 + (current_percent - 15) / 20
        else:  # Much worse
            return max(0.0, current_percent / 30)

    def overall_purchasing_power_score(self) -> float:
        """
        Overall purchasing power score (average of all categories).

        Returns: 0.0 to 2.0
        """
        housing = self.housing_affordability_score()
        food = self.food_affordability_score()
        healthcare = self.healthcare_affordability_score()
        education = self.education_affordability_score()
        transportation = self.transportation_affordability_score()
        discretionary = self.discretionary_income_score()

        return (housing + food + healthcare + education + transportation + discretionary) / 6

    def worker_verification_multiplier(self) -> float:
        """
        Do workers confirm purchasing power improvements?

        Worker verification is REQUIRED for full value.
        Returns: 0.5 to 1.5
        """
        if not self.worker_attestations:
            return 0.5  # No verification = penalty

        # Check recent attestations (last 6 months)
        cutoff = datetime.now() - timedelta(days=180)
        recent = [a for a in self.worker_attestations if a.attestation_date >= cutoff]

        if not recent:
            return 0.7  # Old attestations = partial penalty

        # How many confirm improvements?
        housing_confirmations = sum(1 for a in recent if a.can_afford_housing)
        food_confirmations = sum(1 for a in recent if a.can_afford_food)
        healthcare_confirmations = sum(1 for a in recent if a.can_afford_healthcare)
        savings_confirmations = sum(1 for a in recent if a.can_save_money)
        overall_confirmations = sum(1 for a in recent if a.purchasing_power_improving)

        total = len(recent)
        avg_rate = (
            housing_confirmations / total +
            food_confirmations / total +
            healthcare_confirmations / total +
            savings_confirmations / total +
            overall_confirmations / total
        ) / 5 if total > 0 else 0

        if avg_rate >= 0.8:  # Strong consensus
            return 1.5
        elif avg_rate >= 0.5:  # Moderate consensus
            return 1.0 + (avg_rate - 0.5) / 0.3 * 0.5
        else:  # Weak or no consensus
            return 0.5 + avg_rate / 0.5 * 0.5

    def time_multiplier(self) -> float:
        """
        Reward sustained purchasing power improvements.

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

    def should_activate_declining_penalty(self) -> bool:
        """
        Should penalty activate for declining purchasing power?

        Penalty if:
        - Overall purchasing power declining
        - No worker verification
        """
        overall_score = self.overall_purchasing_power_score()
        worker_score = self.worker_verification_multiplier()

        # Purchasing power declining
        if overall_score < 0.8:
            self.declining_penalty_active = True
            self.penalty_reason = f"Purchasing power declining (score: {overall_score:.2f})"
            return True

        # No worker verification
        if worker_score < 0.7:
            self.declining_penalty_active = True
            self.penalty_reason = f"Insufficient worker verification (score: {worker_score:.2f})"
            return True

        self.declining_penalty_active = False
        self.penalty_reason = ""
        return False

    def calculate_bond_value(self) -> float:
        """
        Calculate current bond value.

        Formula:
        Bond Value = Stake × Overall_Purchasing_Power × Worker_Verification × Time
        """
        base = self.stake_amount

        purchasing_power = self.overall_purchasing_power_score()
        worker_verification = self.worker_verification_multiplier()
        time = self.time_multiplier()

        value = base * purchasing_power * worker_verification * time

        return value

    def calculate_appreciation(self) -> float:
        """How much has bond appreciated (or depreciated)?"""
        current = self.calculate_bond_value()
        initial = self.stake_amount
        return current - initial

    def distribute_to_workers(self) -> Optional[PurchasingPowerDistribution]:
        """
        Distribute proceeds to workers.

        - Improvement: 70% workers, 30% company
        - Declining: 100% workers (compensation)
        """
        appreciation = self.calculate_appreciation()

        if appreciation == 0:
            return None

        # Check if declining penalty active
        penalty_active = self.should_activate_declining_penalty()

        # Get worker count (from latest data)
        if not self.purchasing_power_data:
            return None

        worker_count = self.purchasing_power_data[-1].worker_count

        if appreciation > 0:
            # Bond appreciated
            if penalty_active:
                # Purchasing power not really improving - 100% to workers
                worker_share = appreciation
                company_share = 0.0
                reason = f"Penalty: {self.penalty_reason}"
            else:
                # Purchasing power improving - 70/30 split
                worker_share = appreciation * 0.7
                company_share = appreciation * 0.3
                reason = "Purchasing power improvements confirmed"
        else:
            # Bond depreciated - all goes to workers as compensation
            worker_share = abs(appreciation)
            company_share = 0.0
            reason = "Depreciation compensation for declining purchasing power"

        distribution = PurchasingPowerDistribution(
            distribution_date=datetime.now(),
            total_amount=appreciation,
            worker_share=worker_share,
            company_share=company_share,
            per_worker_amount=worker_share / worker_count if worker_count > 0 else 0,
            worker_count=worker_count,
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


def create_purchasing_power_bond(
    bond_id: str,
    company_id: str,
    company_name: str,
    stake_amount: float,
    baseline: Optional[BaselinePurchasingPower] = None
) -> PurchasingPowerBond:
    """Create a new Purchasing Power Bond"""
    return PurchasingPowerBond(
        bond_id=bond_id,
        company_id=company_id,
        company_name=company_name,
        stake_amount=stake_amount,
        baseline=baseline
    )
