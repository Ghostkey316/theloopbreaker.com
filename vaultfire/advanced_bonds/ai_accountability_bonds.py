"""
AI Accountability Bonds - When Humans Have No Jobs

Economic mechanism that ties AI profits to GLOBAL human flourishing.
Works even when AI fires all workers.

Philosophy:
- AI gets powerful → companies fire everyone → use AI instead
- No jobs = traditional labor bonds fail
- Need system that works with ZERO employment
- AI can only profit when ALL humans thrive
- Not just "the workers we didn't fire" - ALL humans globally
- Creates self-funding UBI from AI profits

The Problem:
- AI automation coming fast (maybe this year)
- Companies will fire workers, use AI instead
- All profits go to AI owners
- Workers have nothing
- Inequality gets WORSE, not better
- Labor Dignity Bonds fail (no workers to measure)

The Solution:
- AI systems stake bonds (30% of quarterly revenue)
- Bonds locked minimum 2 years
- Measure GLOBAL human flourishing (not just workers)
- AI thrives when humans thrive
- AI locked when humans suffer
- Profits redistributed to suffering humans
- Makes human inclusion more profitable than exclusion

Formula:
Bond Value = Stake × Global_Flourishing × Inclusion_Multiplier ×
             Distribution_Quality × Time

Freedom Protocol:
- Privacy over surveillance (aggregate metrics, public data)
- No digital ID (measure collective, not individuals)
- No control (voluntary participation)
- Morals before metrics (human thriving FIRST)
- Humanity over greed (AI earns when humans thrive)
- Effort over shortcuts (real flourishing required)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum


class HumanFlourishingMetric(Enum):
    """Global metrics of human flourishing"""
    INCOME_DISTRIBUTION = "income_distribution"    # Wealth spreading or concentrating?
    POVERTY_RATE = "poverty_rate"                  # People escaping or falling into poverty?
    HEALTH_OUTCOMES = "health_outcomes"            # Life expectancy, mortality improving?
    EDUCATION_ACCESS = "education_access"          # Can people learn new skills?
    MENTAL_HEALTH = "mental_health"                # Depression, anxiety, suicide rates?
    PURPOSE_AGENCY = "purpose_agency"              # Meaningful work/activities (paid or not)?


class AIType(Enum):
    """Types of AI systems"""
    AUTOMATION = "automation"              # Replaces human workers
    AUGMENTATION = "augmentation"          # Helps humans work better
    HEALTHCARE = "healthcare"              # Medical diagnosis/treatment
    EDUCATION = "education"                # Teaching/learning
    FINANCE = "finance"                    # Trading, investing
    LOGISTICS = "logistics"                # Delivery, warehousing
    CREATIVE = "creative"                  # Art, music, writing
    OTHER = "other"


@dataclass
class GlobalFlourishingData:
    """
    Global human flourishing metrics (aggregate, public data)

    Privacy: No individual tracking, only population-level statistics
    Source: Public health, economic, and social data
    """
    measurement_date: datetime
    region: str = "global"                 # Can be global, country, or region

    # Economic metrics (0-100, higher = better)
    income_distribution_score: float = 50.0    # Gini coefficient inverted
    poverty_rate_score: float = 50.0           # % below poverty line inverted

    # Health metrics (0-100, higher = better)
    health_outcomes_score: float = 50.0        # Life expectancy, infant mortality
    mental_health_score: float = 50.0          # Wellbeing surveys, suicide rates

    # Opportunity metrics (0-100, higher = better)
    education_access_score: float = 50.0       # Access to learning/reskilling
    purpose_agency_score: float = 50.0         # Meaningful activities, autonomy

    # Data source verification
    data_source: str = ""                      # WHO, World Bank, etc.
    verified: bool = False


@dataclass
class HumanDistribution:
    """
    Distribution of AI profits to humans

    Privacy: Distributed to regional pools, not individuals
    """
    distribution_date: datetime
    total_amount: float
    region: str = "global"
    num_recipients: int = 0                     # Estimated recipients in region
    distribution_method: str = "regional_pool"  # How funds distributed

    # Priority targeting (distribute to those suffering most)
    targeted_to_suffering: bool = True
    poverty_priority: bool = True


@dataclass
class AIAccountabilityBond:
    """
    Bond that ties AI profits to global human flourishing.

    AI can only profit when ALL humans thrive.
    Works even with zero employment.
    Creates self-funding UBI from AI profits.
    """
    bond_id: str
    ai_system_id: str
    ai_system_name: str
    ai_type: AIType

    # Staking
    quarterly_revenue: float
    stake_amount: float                        # 30% of quarterly revenue
    created_at: datetime = field(default_factory=datetime.now)
    locked_until: datetime = field(default_factory=lambda: datetime.now() + timedelta(days=730))  # 2 years

    # Global flourishing tracking
    flourishing_data: List[GlobalFlourishingData] = field(default_factory=list)

    # Distributions to humans
    distributions: List[HumanDistribution] = field(default_factory=list)

    # Profit lock (if humans suffering)
    profits_locked: bool = False
    lock_reason: str = ""

    # Total redistributed
    total_redistributed_to_humans: float = 0.0

    def required_stake(self) -> float:
        """Required stake = 30% of quarterly revenue"""
        return self.quarterly_revenue * 0.30

    def add_flourishing_data(self, data: GlobalFlourishingData):
        """Add quarterly global flourishing measurement"""
        self.flourishing_data.append(data)

    def average_flourishing_score(self) -> float:
        """
        Average human flourishing across all 6 metrics.

        Returns: 0-100 score
        - 0 = Humans suffering severely
        - 50 = Neutral (no change)
        - 100 = Humans thriving globally
        """
        if not self.flourishing_data:
            return 50.0  # Neutral if no data

        # Use most recent data
        latest = self.flourishing_data[-1]

        scores = [
            latest.income_distribution_score,
            latest.poverty_rate_score,
            latest.health_outcomes_score,
            latest.mental_health_score,
            latest.education_access_score,
            latest.purpose_agency_score
        ]

        return sum(scores) / len(scores)

    def flourishing_trend(self) -> str:
        """
        Are humans getting better or worse over time?

        Returns: "improving", "stable", or "declining"
        """
        if len(self.flourishing_data) < 2:
            return "stable"

        recent_avg = self.average_flourishing_score()

        # Compare to 2 quarters ago
        if len(self.flourishing_data) >= 3:
            old_data = self.flourishing_data[-3]
        else:
            old_data = self.flourishing_data[0]

        old_scores = [
            old_data.income_distribution_score,
            old_data.poverty_rate_score,
            old_data.health_outcomes_score,
            old_data.mental_health_score,
            old_data.education_access_score,
            old_data.purpose_agency_score
        ]
        old_avg = sum(old_scores) / len(old_scores)

        diff = recent_avg - old_avg

        if diff > 5:
            return "improving"
        elif diff < -5:
            return "declining"
        else:
            return "stable"

    def global_flourishing_multiplier(self) -> float:
        """
        Convert flourishing score to multiplier.

        Returns: 0.1 to 3.0
        - Humans thriving (70+) → 1.5x to 3.0x appreciation
        - Neutral (40-70) → 0.8x to 1.5x
        - Humans suffering (< 40) → 0.1x to 0.8x (severe depreciation)
        """
        score = self.average_flourishing_score()

        if score >= 70:
            # Humans thriving - strong appreciation
            return 1.5 + ((score - 70) / 30) * 1.5  # 1.5x to 3.0x
        elif score >= 40:
            # Neutral - moderate
            return 0.8 + ((score - 40) / 30) * 0.7  # 0.8x to 1.5x
        else:
            # Humans suffering - severe depreciation
            return 0.1 + (score / 40) * 0.7  # 0.1x to 0.8x

    def inclusion_multiplier(self) -> float:
        """
        Reward AI that INCLUDES humans vs excludes them.

        Measures:
        - Purpose/Agency score (do humans have meaningful activities?)
        - Education access (can humans learn AI skills?)

        Returns: 0.5 to 2.0
        - High inclusion → 2.0x
        - Low inclusion → 0.5x
        """
        if not self.flourishing_data:
            return 1.0

        latest = self.flourishing_data[-1]

        # Average purpose and education (these measure inclusion)
        inclusion_score = (latest.purpose_agency_score + latest.education_access_score) / 2

        if inclusion_score >= 70:
            return 1.5 + ((inclusion_score - 70) / 30) * 0.5  # 1.5x to 2.0x
        elif inclusion_score >= 40:
            return 1.0 + ((inclusion_score - 40) / 30) * 0.5  # 1.0x to 1.5x
        else:
            return 0.5 + (inclusion_score / 40) * 0.5  # 0.5x to 1.0x

    def distribution_quality_multiplier(self) -> float:
        """
        Reward AI that distributes profits to those who need it most.

        Returns: 0.5 to 1.5
        - Distributes to suffering humans → 1.5x
        - No distribution → 0.5x
        """
        if not self.distributions:
            return 0.5  # Penalty for not distributing

        # Check if distributions target those suffering
        recent_distributions = self.distributions[-4:]  # Last 4 quarters

        targeted_count = sum(1 for d in recent_distributions if d.targeted_to_suffering)
        ratio = targeted_count / len(recent_distributions) if recent_distributions else 0

        return 0.5 + ratio  # 0.5x to 1.5x

    def time_multiplier(self) -> float:
        """
        Reward sustained human flourishing over time.

        Returns: 1.0 to 2.5
        - < 1 year → 1.0x
        - 1-3 years → 1.5x
        - 3+ years → 2.5x
        """
        duration = datetime.now() - self.created_at
        years = duration.days / 365.25

        if years < 1:
            return 1.0
        elif years < 3:
            return 1.0 + (years / 3) * 0.5  # Up to 1.5x
        else:
            return 1.5 + min(1.0, (years - 3) / 3)  # Up to 2.5x

    def calculate_bond_value(self) -> float:
        """
        Calculate current bond value based on global human flourishing.

        Formula:
        Bond Value = Stake × Global_Flourishing × Inclusion ×
                     Distribution_Quality × Time
        """
        base = self.stake_amount

        flourishing = self.global_flourishing_multiplier()
        inclusion = self.inclusion_multiplier()
        distribution = self.distribution_quality_multiplier()
        time = self.time_multiplier()

        value = base * flourishing * inclusion * distribution * time

        return value

    def calculate_appreciation(self) -> float:
        """How much has bond appreciated (or depreciated)?"""
        current = self.calculate_bond_value()
        initial = self.stake_amount
        return current - initial

    def should_lock_profits(self) -> bool:
        """
        Should AI profits be locked?

        Lock if:
        - Humans suffering (score < 40)
        - Declining trend
        - Low inclusion
        """
        score = self.average_flourishing_score()
        trend = self.flourishing_trend()
        inclusion = self.inclusion_multiplier()

        if score < 40:
            self.profits_locked = True
            self.lock_reason = f"Humans suffering (score: {score:.1f}/100)"
            return True

        if trend == "declining":
            self.profits_locked = True
            self.lock_reason = "Human flourishing declining"
            return True

        if inclusion < 0.8:
            self.profits_locked = True
            self.lock_reason = f"Low human inclusion (multiplier: {inclusion:.2f})"
            return True

        self.profits_locked = False
        self.lock_reason = ""
        return False

    def distribute_to_humans(self, target_suffering: bool = True) -> Optional[HumanDistribution]:
        """
        Distribute AI profits to humans.

        If appreciating: 50% to humans, 50% to AI company
        If depreciating: 100% to humans as compensation

        Args:
            target_suffering: Prioritize distribution to those suffering most

        Returns: HumanDistribution if distribution happens
        """
        appreciation = self.calculate_appreciation()

        if appreciation > 0:
            # Appreciating - humans get 50%
            human_share = appreciation * 0.5
        elif appreciation < 0:
            # Depreciating - humans get 100% as compensation
            human_share = abs(appreciation)
        else:
            return None  # No change

        # Create distribution
        distribution = HumanDistribution(
            distribution_date=datetime.now(),
            total_amount=human_share,
            region="global",
            num_recipients=0,  # Estimated by regional pools
            distribution_method="regional_ubi_pool",
            targeted_to_suffering=target_suffering,
            poverty_priority=target_suffering
        )

        self.distributions.append(distribution)
        self.total_redistributed_to_humans += human_share

        return distribution

    def ai_company_payout(self) -> float:
        """
        AI company payout.

        Returns:
        - 50% of appreciation if positive AND profits not locked
        - 0 if depreciating or profits locked
        """
        if self.should_lock_profits():
            return 0.0  # Profits locked

        appreciation = self.calculate_appreciation()

        if appreciation > 0:
            return appreciation * 0.5
        else:
            return 0.0  # No payout on depreciation

    def total_human_benefit(self) -> float:
        """Total amount redistributed to humans"""
        return self.total_redistributed_to_humans


def create_ai_accountability_bond(
    bond_id: str,
    ai_system_id: str,
    ai_system_name: str,
    ai_type: AIType,
    quarterly_revenue: float
) -> AIAccountabilityBond:
    """
    Create new AI Accountability Bond.

    Args:
        bond_id: Unique identifier
        ai_system_id: AI system identifier
        ai_system_name: AI system name
        ai_type: Type of AI
        quarterly_revenue: AI's quarterly revenue

    Returns:
        AIAccountabilityBond instance
    """
    if quarterly_revenue <= 0:
        raise ValueError("Quarterly revenue must be positive")

    stake_amount = quarterly_revenue * 0.30

    return AIAccountabilityBond(
        bond_id=bond_id,
        ai_system_id=ai_system_id,
        ai_system_name=ai_system_name,
        ai_type=ai_type,
        quarterly_revenue=quarterly_revenue,
        stake_amount=stake_amount
    )


# Example usage and demonstration
if __name__ == "__main__":
    print("=" * 80)
    print("AI ACCOUNTABILITY BONDS - When Humans Have No Jobs")
    print("=" * 80)
    print()

    # Scenario 1: GOOD AI - Healthcare system that helps humans
    print("SCENARIO 1: GOOD AI - Healthcare Diagnostic System")
    print("-" * 80)

    good_ai = create_ai_accountability_bond(
        bond_id="ai_health_001",
        ai_system_id="medai_diagnostics",
        ai_system_name="MedAI Diagnostics",
        ai_type=AIType.HEALTHCARE,
        quarterly_revenue=10_000_000.0  # $10M quarterly revenue
    )

    print(f"AI System: {good_ai.ai_system_name}")
    print(f"Type: {good_ai.ai_type.value}")
    print(f"Quarterly revenue: ${good_ai.quarterly_revenue:,.0f}")
    print(f"Required stake (30%): ${good_ai.required_stake():,.0f}")
    print()

    # Simulate 1 year with humans thriving
    good_ai.created_at = datetime.now() - timedelta(days=365)

    # Quarter 1-4: Humans thriving due to better healthcare
    for quarter in range(4):
        data = GlobalFlourishingData(
            measurement_date=datetime.now() - timedelta(days=270 - quarter*90),
            income_distribution_score=65.0,  # Moderate
            poverty_rate_score=68.0,         # Improving
            health_outcomes_score=85.0,      # AI improving healthcare!
            mental_health_score=70.0,        # Better health → better mental health
            education_access_score=75.0,     # People learning AI healthcare
            purpose_agency_score=72.0,       # Doctors evolving roles
            data_source="WHO/World Bank",
            verified=True
        )
        good_ai.add_flourishing_data(data)

    print(f"After 1 Year:")
    print(f"  Global flourishing score: {good_ai.average_flourishing_score():.1f}/100")
    print(f"  Trend: {good_ai.flourishing_trend()}")
    print(f"  Flourishing multiplier: {good_ai.global_flourishing_multiplier():.2f}x")
    print(f"  Inclusion multiplier: {good_ai.inclusion_multiplier():.2f}x")
    print()

    # Calculate value
    value = good_ai.calculate_bond_value()
    appreciation = good_ai.calculate_appreciation()

    print(f"Bond Value:")
    print(f"  Initial stake: ${good_ai.stake_amount:,.0f}")
    print(f"  Current value: ${value:,.0f}")
    print(f"  Appreciation: ${appreciation:,.0f}")
    print()

    # Distribute
    human_dist = good_ai.distribute_to_humans(target_suffering=True)
    ai_payout = good_ai.ai_company_payout()

    print(f"Payouts:")
    print(f"  To humans (50%): ${human_dist.total_amount:,.0f}")
    print(f"  To AI company (50%): ${ai_payout:,.0f}")
    print(f"  Profits locked: {good_ai.should_lock_profits()}")
    print(f"  Total redistributed: ${good_ai.total_human_benefit():,.0f}")
    print()
    print("✅ GOOD AI - Humans thrive, AI earns, everyone wins")
    print()
    print()

    # Scenario 2: BAD AI - Trading algorithm that concentrates wealth
    print("SCENARIO 2: BAD AI - High-Frequency Trading Algorithm")
    print("-" * 80)

    bad_ai = create_ai_accountability_bond(
        bond_id="ai_trade_001",
        ai_system_id="quant_trader_x",
        ai_system_name="QuantTrader X",
        ai_type=AIType.FINANCE,
        quarterly_revenue=50_000_000.0  # $50M quarterly revenue
    )

    print(f"AI System: {bad_ai.ai_system_name}")
    print(f"Type: {bad_ai.ai_type.value}")
    print(f"Quarterly revenue: ${bad_ai.quarterly_revenue:,.0f}")
    print(f"Required stake: ${bad_ai.required_stake():,.0f}")
    print()

    # Humans suffering (AI concentrating wealth)
    bad_data = GlobalFlourishingData(
        measurement_date=datetime.now(),
        income_distribution_score=25.0,  # Wealth concentrating!
        poverty_rate_score=30.0,         # Poverty increasing
        health_outcomes_score=45.0,      # Declining
        mental_health_score=35.0,        # Depression/anxiety rising
        education_access_score=40.0,     # Can't afford education
        purpose_agency_score=20.0,       # No jobs, no purpose
        data_source="World Bank/IMF",
        verified=True
    )
    bad_ai.add_flourishing_data(bad_data)

    print(f"Current Status:")
    print(f"  Global flourishing score: {bad_ai.average_flourishing_score():.1f}/100")
    print(f"  Flourishing multiplier: {bad_ai.global_flourishing_multiplier():.2f}x")
    print(f"  Inclusion multiplier: {bad_ai.inclusion_multiplier():.2f}x")
    print()

    # Calculate value
    bad_value = bad_ai.calculate_bond_value()
    bad_appreciation = bad_ai.calculate_appreciation()

    print(f"Bond Value:")
    print(f"  Initial stake: ${bad_ai.stake_amount:,.0f}")
    print(f"  Current value: ${bad_value:,.0f}")
    print(f"  Depreciation: ${bad_appreciation:,.0f}")
    print(f"  Loss: {(bad_appreciation / bad_ai.stake_amount) * 100:.1f}%")
    print()

    # Check profit lock
    locked = bad_ai.should_lock_profits()

    print(f"Profit Lock:")
    print(f"  Profits locked: {locked}")
    print(f"  Reason: {bad_ai.lock_reason}")
    print()

    # Distribute depreciation to humans
    bad_human_dist = bad_ai.distribute_to_humans(target_suffering=True)
    bad_ai_payout = bad_ai.ai_company_payout()

    print(f"Payouts:")
    print(f"  To humans (compensation): ${bad_human_dist.total_amount:,.0f}")
    print(f"  To AI company: ${bad_ai_payout:,.0f}")
    print()
    print("⚠️  BAD AI - Humans suffer, AI profits LOCKED, humans compensated")
    print()
    print()

    # Summary
    print("=" * 80)
    print("SUMMARY - AI ACCOUNTABILITY")
    print("=" * 80)
    print()
    print("Good AI (Healthcare):")
    print(f"  Humans benefited: ${good_ai.total_human_benefit():,.0f}")
    print(f"  AI company earned: ${ai_payout:,.0f}")
    print(f"  Status: ✅ AI helps humans thrive")
    print()
    print("Bad AI (Trading):")
    print(f"  Humans compensated: ${bad_ai.total_human_benefit():,.0f}")
    print(f"  AI company earned: ${bad_ai_payout:,.0f}")
    print(f"  Status: ⚠️  Profits locked, humans suffering")
    print()
    print("RESULT:")
    print("  AI can only profit when humans thrive")
    print("  Works even with ZERO employment")
    print("  Creates self-funding UBI from AI profits")
    print("  Human inclusion more profitable than exclusion")
