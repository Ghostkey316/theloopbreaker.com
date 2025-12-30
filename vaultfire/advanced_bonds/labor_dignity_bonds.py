"""
Labor Dignity Bonds - Making Suits and People Equal

Economic mechanism that makes worker exploitation EXPENSIVE and worker thriving PROFITABLE.

Philosophy:
- Suits have all power (capital, time, exit options, legal protection)
- Workers have none of that
- NOT EQUAL - need to redistribute power
- Make exploitation economically toxic
- Make worker thriving economically profitable
- Workers accumulate capital over time
- Equality achieved through economic incentives

The Problem:
- Suits control everything: capital, hiring/firing, working conditions, wages
- Workers trapped: can't quit (need money), can't negotiate (replaceable)
- Exploitation is PROFITABLE for suits
- Current system makes inequality worse over time

The Solution:
- Companies stake bonds equal to 20% of worker payroll
- Bonds locked minimum 1 year
- Worker flourishing measured quarterly (6 metrics)
- Workers thriving → bonds appreciate → 50% to workers, 50% to company
- Workers exploited → bonds depreciate → lost value to workers as compensation
- Workers accumulate capital, become investors, gain power
- Over time: equality achieved

Formula:
Bond Value = Stake × Flourishing_Ratio × Sustainability × Anti_Exploitation × Time_Mult

Freedom Protocol:
- Privacy over surveillance (anonymous surveys, aggregate metrics only)
- No digital ID (don't identify individual workers)
- No control (voluntary participation)
- Morals before metrics (worker dignity FIRST)
- Humanity over greed (workers get 50% of appreciation)
- Effort over shortcuts (real thriving required, can't fake)
- Community > capital (workers pool payouts, start cooperatives)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum


class WorkerMetric(Enum):
    """Six dimensions of worker flourishing"""
    INCOME_GROWTH = "income_growth"           # Wages increasing above inflation?
    AUTONOMY = "autonomy"                     # Control over schedule/decisions?
    DIGNITY = "dignity"                       # Respect, safety, fair treatment?
    WORK_LIFE_BALANCE = "work_life_balance"   # Reasonable hours, no forced overtime?
    SECURITY = "security"                     # Job protection, not at-will firing?
    VOICE = "voice"                           # Say in company decisions?


class ExploitationPattern(Enum):
    """Types of worker exploitation to detect"""
    WAGE_THEFT = "wage_theft"                 # Not paying for hours worked
    UNSAFE_CONDITIONS = "unsafe_conditions"   # OSHA violations, injuries
    FORCED_OVERTIME = "forced_overtime"       # Mandatory unpaid overtime
    RETALIATION = "retaliation"               # Punishing workers for complaints
    DISCRIMINATION = "discrimination"         # Harassment, unfair treatment
    UNION_BUSTING = "union_busting"           # Preventing worker organizing
    MISCLASSIFICATION = "misclassification"   # Calling employees "contractors"
    WAGE_STAGNATION = "wage_stagnation"       # No raises for years


@dataclass
class WorkerSurvey:
    """
    Anonymous worker survey data (conducted by third-party verifiers)

    Privacy: No individual worker identification, aggregate only
    """
    company_id: str
    survey_date: datetime
    num_respondents: int                      # How many workers responded

    # Aggregate scores (0-100 for each metric, averaged across all respondents)
    income_growth_score: float = 0.0          # Are wages keeping up with inflation?
    autonomy_score: float = 0.0               # Do workers control their work?
    dignity_score: float = 0.0                # Are workers respected?
    work_life_balance_score: float = 0.0      # Reasonable hours?
    security_score: float = 0.0               # Job protection?
    voice_score: float = 0.0                  # Worker say in decisions?

    # Third-party verification
    verified_by: str = ""                     # External auditor who verified
    verification_date: Optional[datetime] = None
    verified: bool = False

    # Exploitation detection (aggregate flags, not individual)
    exploitation_flags: List[ExploitationPattern] = field(default_factory=list)

    # Turnover rate (public data)
    turnover_rate: float = 0.0                # % of workers who left this quarter


@dataclass
class WorkerPayout:
    """
    Payout to workers from bond appreciation

    Privacy: Workers receive payouts without individual tracking
    """
    company_id: str
    payout_date: datetime
    total_amount: float                       # Total payout to all workers
    num_workers: int                          # How many workers share it
    per_worker_amount: float                  # Amount each worker gets
    source: str = "bond_appreciation"         # Or "exploitation_compensation"


@dataclass
class CompanyStake:
    """Company's initial stake in Labor Dignity Bond"""
    company_id: str
    stake_amount: float
    worker_payroll: float                     # Total quarterly payroll
    num_workers: int
    stake_date: datetime = field(default_factory=datetime.now)
    locked_until: datetime = field(default_factory=lambda: datetime.now() + timedelta(days=365))


@dataclass
class LaborDignityBond:
    """
    Bond that makes worker exploitation EXPENSIVE and worker thriving PROFITABLE.

    Companies stake bonds based on worker payroll.
    Bonds appreciate when workers thrive, depreciate when workers exploited.
    Workers get 50% of appreciation OR compensation from depreciation.
    Over time: workers accumulate capital, power redistributes.
    """
    bond_id: str
    company_id: str
    company_name: str
    initial_stake: CompanyStake
    created_at: datetime = field(default_factory=datetime.now)

    # Quarterly surveys
    surveys: List[WorkerSurvey] = field(default_factory=list)

    # Payouts to workers
    payouts: List[WorkerPayout] = field(default_factory=list)

    # Exploitation tracking
    exploitation_detected: bool = False
    exploitation_patterns: List[ExploitationPattern] = field(default_factory=list)
    blocked_from_future_bonds: bool = False

    # Capital accumulation tracking (aggregate only)
    total_capital_distributed_to_workers: float = 0.0

    def required_stake(self) -> float:
        """
        Required stake = 20% of quarterly worker payroll

        This ensures companies have skin in the game.
        """
        return self.initial_stake.worker_payroll * 0.20

    def add_survey(self, survey: WorkerSurvey):
        """Add quarterly worker survey"""
        self.surveys.append(survey)

        # Check for exploitation patterns
        if survey.exploitation_flags:
            self.exploitation_detected = True
            for pattern in survey.exploitation_flags:
                if pattern not in self.exploitation_patterns:
                    self.exploitation_patterns.append(pattern)

    def average_flourishing_score(self) -> float:
        """
        Average worker flourishing across all 6 metrics.

        Returns: 0-100 score
        - 0 = Complete exploitation
        - 50 = Neutral
        - 100 = Workers thriving
        """
        if not self.surveys:
            return 50.0  # Neutral if no data

        # Use most recent survey
        latest = self.surveys[-1]

        scores = [
            latest.income_growth_score,
            latest.autonomy_score,
            latest.dignity_score,
            latest.work_life_balance_score,
            latest.security_score,
            latest.voice_score
        ]

        return sum(scores) / len(scores)

    def flourishing_ratio(self) -> float:
        """
        Convert flourishing score to multiplier.

        Returns: 0.2 to 2.0
        - Workers thriving (80+) → 1.5x to 2.0x appreciation
        - Neutral (50-80) → 1.0x (stable)
        - Workers exploited (< 50) → 0.2x to 0.8x (depreciation)
        """
        score = self.average_flourishing_score()

        if score >= 80:
            # Workers thriving - strong appreciation
            return 1.5 + ((score - 80) / 20) * 0.5  # 1.5x to 2.0x
        elif score >= 50:
            # Neutral - stable value
            return 1.0 + ((score - 50) / 30) * 0.5  # 1.0x to 1.5x
        else:
            # Workers exploited - depreciation
            return 0.2 + (score / 50) * 0.8  # 0.2x to 1.0x

    def sustainability_multiplier(self) -> float:
        """
        Reward sustained worker thriving over time.

        Returns: 1.0 to 3.0
        - All quarters positive → high multiplier
        - Mixed quarters → moderate
        - Downward trend → penalty
        """
        if len(self.surveys) < 2:
            return 1.0

        # Calculate trend
        scores = [self.average_flourishing_score() for _ in self.surveys]
        positive_quarters = sum(1 for s in scores if s >= 60)

        ratio = positive_quarters / len(scores)

        if ratio >= 0.8:  # 80%+ positive
            return 2.0 + (ratio - 0.8) * 5  # Up to 3.0x
        elif ratio >= 0.5:  # 50%+ positive
            return 1.0 + (ratio - 0.5) * 3.33  # Up to 2.0x
        else:  # Less than 50% positive
            return 0.5 + ratio  # 0.5x to 1.0x

    def anti_exploitation_multiplier(self) -> float:
        """
        Severe penalty for exploitation patterns.

        Returns: 0.1 to 1.0
        - No exploitation → 1.0 (no penalty)
        - Some exploitation → 0.5 to 0.8
        - Severe exploitation → 0.1 to 0.3 (heavy penalty)
        """
        if not self.exploitation_patterns:
            return 1.0

        # Count severe vs moderate exploitation
        severe_patterns = [
            ExploitationPattern.WAGE_THEFT,
            ExploitationPattern.UNSAFE_CONDITIONS,
            ExploitationPattern.RETALIATION,
            ExploitationPattern.DISCRIMINATION
        ]

        severe_count = sum(1 for p in self.exploitation_patterns if p in severe_patterns)
        total_count = len(self.exploitation_patterns)

        if severe_count >= 2:
            # Multiple severe violations - company should be blocked
            self.blocked_from_future_bonds = True
            return 0.1
        elif severe_count == 1:
            return 0.3  # One severe violation
        elif total_count >= 3:
            return 0.5  # Multiple moderate violations
        else:
            return 0.8  # Few violations

    def time_multiplier(self) -> float:
        """
        Reward long-term worker thriving.

        Returns: 1.0 to 2.5
        - < 1 year → 1.0
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
        Calculate current bond value based on worker flourishing.

        Formula:
        Bond Value = Stake × Flourishing_Ratio × Sustainability ×
                     Anti_Exploitation × Time_Mult
        """
        base = self.initial_stake.stake_amount

        flourishing = self.flourishing_ratio()
        sustainability = self.sustainability_multiplier()
        anti_exploit = self.anti_exploitation_multiplier()
        time = self.time_multiplier()

        value = base * flourishing * sustainability * anti_exploit * time

        return value

    def calculate_appreciation(self) -> float:
        """How much has bond appreciated (or depreciated)?"""
        current = self.calculate_bond_value()
        initial = self.initial_stake.stake_amount
        return current - initial

    def distribute_to_workers(self) -> Optional[WorkerPayout]:
        """
        Distribute 50% of appreciation to workers.
        OR distribute depreciation as compensation.

        Returns: WorkerPayout if distribution happens
        """
        appreciation = self.calculate_appreciation()

        if appreciation > 0:
            # Bonds appreciated - workers get 50%
            worker_share = appreciation * 0.5
            source = "bond_appreciation"
        elif appreciation < 0:
            # Bonds depreciated - workers get 100% as compensation
            worker_share = abs(appreciation)
            source = "exploitation_compensation"
        else:
            return None  # No change

        # Create payout
        payout = WorkerPayout(
            company_id=self.company_id,
            payout_date=datetime.now(),
            total_amount=worker_share,
            num_workers=self.initial_stake.num_workers,
            per_worker_amount=worker_share / self.initial_stake.num_workers,
            source=source
        )

        self.payouts.append(payout)
        self.total_capital_distributed_to_workers += worker_share

        return payout

    def company_payout(self) -> float:
        """
        Company gets 50% of appreciation (if positive).
        Nothing if depreciated (workers get it all as compensation).
        """
        appreciation = self.calculate_appreciation()

        if appreciation > 0:
            return appreciation * 0.5
        else:
            return 0.0  # Company loses capital

    def worker_capital_accumulated(self) -> float:
        """Total capital workers have accumulated from this bond"""
        return self.total_capital_distributed_to_workers

    def is_exploitation_detected(self) -> bool:
        """Has exploitation been detected?"""
        return self.exploitation_detected

    def should_block_company(self) -> bool:
        """Should company be blocked from future bonds?"""
        return self.blocked_from_future_bonds


def create_labor_dignity_bond(
    bond_id: str,
    company_id: str,
    company_name: str,
    worker_payroll: float,
    num_workers: int
) -> LaborDignityBond:
    """
    Create new Labor Dignity Bond for a company.

    Args:
        bond_id: Unique identifier
        company_id: Company identifier
        company_name: Company name
        worker_payroll: Quarterly total payroll
        num_workers: Number of workers

    Returns:
        LaborDignityBond instance
    """
    if worker_payroll <= 0:
        raise ValueError("Worker payroll must be positive")
    if num_workers <= 0:
        raise ValueError("Number of workers must be positive")

    # Calculate required stake (20% of payroll)
    stake_amount = worker_payroll * 0.20

    stake = CompanyStake(
        company_id=company_id,
        stake_amount=stake_amount,
        worker_payroll=worker_payroll,
        num_workers=num_workers
    )

    return LaborDignityBond(
        bond_id=bond_id,
        company_id=company_id,
        company_name=company_name,
        initial_stake=stake
    )


# Example usage and demonstration
if __name__ == "__main__":
    print("=" * 80)
    print("LABOR DIGNITY BONDS - Making Suits and People Equal")
    print("=" * 80)
    print()

    # Scenario: Two companies - one good, one exploitative

    # GOOD COMPANY - Tech startup that treats workers well
    print("GOOD COMPANY - Tech Startup")
    print("-" * 80)

    good_company = create_labor_dignity_bond(
        bond_id="labor_001",
        company_id="goodtech_inc",
        company_name="GoodTech Inc",
        worker_payroll=500000.0,  # $500k quarterly payroll
        num_workers=20
    )

    print(f"Company: {good_company.company_name}")
    print(f"Workers: {good_company.initial_stake.num_workers}")
    print(f"Quarterly payroll: ${good_company.initial_stake.worker_payroll:,.0f}")
    print(f"Required stake (20%): ${good_company.required_stake():,.0f}")
    print()

    # Quarter 1: Workers thriving
    survey_q1 = WorkerSurvey(
        company_id="goodtech_inc",
        survey_date=datetime.now(),
        num_respondents=18,  # 90% response rate
        income_growth_score=85.0,  # Raises above inflation
        autonomy_score=90.0,  # Flexible hours, remote work
        dignity_score=88.0,  # Respectful culture
        work_life_balance_score=82.0,  # Good hours
        security_score=80.0,  # Equity, job protection
        voice_score=75.0,  # Some say in decisions
        verified_by="third_party_auditor_1",
        verification_date=datetime.now(),
        verified=True,
        turnover_rate=5.0  # Low turnover (5%)
    )
    good_company.add_survey(survey_q1)

    print(f"Quarter 1 Survey:")
    print(f"  Average flourishing: {good_company.average_flourishing_score():.1f}/100")
    print(f"  Flourishing ratio: {good_company.flourishing_ratio():.2f}x")
    print(f"  Turnover: {survey_q1.turnover_rate}%")
    print()

    # Simulate 1 year
    good_company.created_at = datetime.now() - timedelta(days=365)

    # Add 3 more positive quarters
    for i in range(3):
        survey = WorkerSurvey(
            company_id="goodtech_inc",
            survey_date=datetime.now() - timedelta(days=270 - i*90),
            num_respondents=18,
            income_growth_score=83.0,
            autonomy_score=88.0,
            dignity_score=87.0,
            work_life_balance_score=84.0,
            security_score=82.0,
            voice_score=78.0,
            verified_by=f"auditor_{i}",
            verified=True,
            turnover_rate=4.0
        )
        good_company.add_survey(survey)

    print(f"After 1 Year (4 quarters):")
    print(f"  Sustainability multiplier: {good_company.sustainability_multiplier():.2f}x")
    print(f"  Time multiplier: {good_company.time_multiplier():.2f}x")
    print(f"  Anti-exploitation: {good_company.anti_exploitation_multiplier():.2f}x")
    print()

    # Calculate value
    value = good_company.calculate_bond_value()
    appreciation = good_company.calculate_appreciation()

    print(f"Bond Value:")
    print(f"  Initial stake: ${good_company.initial_stake.stake_amount:,.0f}")
    print(f"  Current value: ${value:,.0f}")
    print(f"  Appreciation: ${appreciation:,.0f}")
    print()

    # Distribute to workers
    worker_payout = good_company.distribute_to_workers()
    company_payout = good_company.company_payout()

    print(f"Payouts:")
    print(f"  To workers (50%): ${worker_payout.total_amount:,.0f}")
    print(f"  Per worker: ${worker_payout.per_worker_amount:,.0f}")
    print(f"  To company (50%): ${company_payout:,.0f}")
    print(f"  Workers accumulated capital: ${good_company.worker_capital_accumulated():,.0f}")
    print()
    print("✅ EVERYONE WINS - Workers thriving, company profitable, capital distributed")
    print()
    print()

    # BAD COMPANY - Exploitative warehouse
    print("BAD COMPANY - Exploitative Warehouse")
    print("-" * 80)

    bad_company = create_labor_dignity_bond(
        bond_id="labor_002",
        company_id="badwarehouse_corp",
        company_name="BadWarehouse Corp",
        worker_payroll=300000.0,  # $300k quarterly payroll
        num_workers=50
    )

    print(f"Company: {bad_company.company_name}")
    print(f"Workers: {bad_company.initial_stake.num_workers}")
    print(f"Required stake: ${bad_company.required_stake():,.0f}")
    print()

    # Quarter 1: Workers exploited
    bad_survey = WorkerSurvey(
        company_id="badwarehouse_corp",
        survey_date=datetime.now(),
        num_respondents=35,  # 70% response (some fear retaliation)
        income_growth_score=25.0,  # Wages stagnant
        autonomy_score=15.0,  # Algorithm controls everything
        dignity_score=20.0,  # Poor treatment
        work_life_balance_score=10.0,  # Forced overtime
        security_score=5.0,  # Fire at will
        voice_score=10.0,  # No say in anything
        verified_by="third_party_auditor_2",
        verified=True,
        turnover_rate=45.0,  # HIGH turnover (people fleeing)
        exploitation_flags=[
            ExploitationPattern.FORCED_OVERTIME,
            ExploitationPattern.UNSAFE_CONDITIONS,
            ExploitationPattern.WAGE_STAGNATION,
            ExploitationPattern.RETALIATION
        ]
    )
    bad_company.add_survey(bad_survey)

    print(f"Quarter 1 Survey:")
    print(f"  Average flourishing: {bad_company.average_flourishing_score():.1f}/100")
    print(f"  Flourishing ratio: {bad_company.flourishing_ratio():.2f}x")
    print(f"  Turnover: {bad_survey.turnover_rate}%")
    print(f"  Exploitation detected: {bad_company.is_exploitation_detected()}")
    print(f"  Patterns: {[p.value for p in bad_company.exploitation_patterns]}")
    print()

    # Calculate value
    bad_value = bad_company.calculate_bond_value()
    bad_appreciation = bad_company.calculate_appreciation()

    print(f"Bond Value:")
    print(f"  Initial stake: ${bad_company.initial_stake.stake_amount:,.0f}")
    print(f"  Current value: ${bad_value:,.0f}")
    print(f"  Depreciation: ${bad_appreciation:,.0f}")
    print(f"  Loss: {(bad_appreciation / bad_company.initial_stake.stake_amount) * 100:.1f}%")
    print()

    # Distribute depreciation to workers as compensation
    bad_worker_payout = bad_company.distribute_to_workers()
    bad_company_payout = bad_company.company_payout()

    print(f"Payouts:")
    print(f"  To workers (compensation): ${bad_worker_payout.total_amount:,.0f}")
    print(f"  Per worker: ${bad_worker_payout.per_worker_amount:,.0f}")
    print(f"  To company: ${bad_company_payout:,.0f}")
    print(f"  Company blocked from future bonds: {bad_company.should_block_company()}")
    print()
    print("⚠️  EXPLOITATION IS EXPENSIVE - Company loses capital, workers compensated")
    print()
    print()

    # Summary
    print("=" * 80)
    print("SUMMARY - POWER REDISTRIBUTION")
    print("=" * 80)
    print()
    print("Good Company:")
    print(f"  Workers gained: ${good_company.worker_capital_accumulated():,.0f}")
    print(f"  Company gained: ${company_payout:,.0f}")
    print(f"  Status: ✅ Everyone wins")
    print()
    print("Bad Company:")
    print(f"  Workers compensated: ${bad_company.worker_capital_accumulated():,.0f}")
    print(f"  Company lost: ${abs(bad_appreciation):,.0f}")
    print(f"  Status: ⚠️  Blocked from future bonds")
    print()
    print("RESULT:")
    print("  Workers accumulate capital → can invest → gain power")
    print("  Exploitation becomes economically TOXIC")
    print("  Over time: SUITS AND PEOPLE EQUAL")
