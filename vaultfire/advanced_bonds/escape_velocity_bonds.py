"""
Escape Velocity Bonds - Breaking the Survival Trap

Economic mechanism that helps the little guy escape poverty traps and build FREEDOM.

Philosophy:
- The little guy is TRAPPED in survival mode
- Small amount of help creates ESCAPE VELOCITY
- You don't owe money back, you owe FREEDOM FORWARD
- Predatory entities get BLOCKED from the system
- Measured by THRIVING, not payback

The Problem:
- Working 2-3 jobs just to survive
- One car breakdown away from losing everything
- No time to learn, no money to take risks
- Can't build when you're drowning
- Stuck in debt cycles with no way out
- All other bonds assume you have SLACK - the little guy has NO SLACK

The Solution:
- Community stakes small amounts ($50-$500 each)
- Total just enough to escape the trap ($500-$5000)
- Funds solve the immediate problem (car repair, debt payoff, tools, training)
- Person owes NOTHING back in money
- Person pays it forward by helping others escape
- Bonds appreciate when you THRIVE and help others

Formula:
Bond Value = Stake × Escape_Success × Thriving_Duration × Others_Helped × Anti_Recapture

Freedom Protocol:
- No debt (you don't owe money back)
- No surveillance (community attestation)
- Small enough suits don't care ($500-$5000)
- Too slow for institutional investors (2+ years)
- Anti-predatory (blocks entities that recapture people)
- Measured by freedom (did you stay free? help others?)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum


class TrapType(Enum):
    """Types of poverty traps"""
    CAR_BREAKDOWN = "car_breakdown"       # Can't get to work
    PREDATORY_DEBT = "predatory_debt"     # Payday loans, high interest
    HOUSING_CRISIS = "housing_crisis"     # Can't afford rent/deposit
    TOOLS_EQUIPMENT = "tools_equipment"   # Need tools for better job
    SKILLS_GAP = "skills_gap"             # Need certification/training
    MEDICAL_EMERGENCY = "medical_emergency"  # Can't afford treatment
    ABUSE_ESCAPE = "abuse_escape"         # Economically trapped in abuse
    CHILDCARE = "childcare"               # Can't work without childcare
    LEGAL_ISSUE = "legal_issue"           # Fines, fees, court costs
    OTHER = "other"


class EscapePhase(Enum):
    """Current phase of escape"""
    TRAPPED = "trapped"                   # Initial trap documented
    FUNDED = "funded"                     # Community provided escape funds
    ESCAPING = "escaping"                 # Using funds to escape
    FREE = "free"                         # Successfully escaped
    THRIVING = "thriving"                 # Sustained freedom 6+ months
    HELPING = "helping"                   # Helping others escape


@dataclass
class Trap:
    """Documentation of the poverty trap"""
    trap_type: TrapType
    description: str                      # What's the trap?
    impact: str                           # How does it hurt them?
    escape_amount_needed: float           # How much to escape?
    escape_plan: str                      # How will funds be used?

    # Verification
    community_verified: bool = False
    verifiers: List[str] = field(default_factory=list)

    # Anti-fraud
    is_real_trap: bool = True            # Not just wanting free money
    urgency: str = ""                    # How urgent is this?


@dataclass
class PredatoryEntity:
    """Entity that traps/recaptures people (gets BLOCKED)"""
    entity_id: str
    entity_name: str
    entity_type: str                      # payday_lender, employer, landlord, etc.
    trap_mechanism: str                   # How they trap people
    recapture_attempts: int = 0           # How many times tried to recapture
    blocked_from_bonds: bool = False      # Blocked from participating


@dataclass
class EscapeAttempt:
    """Using funds to escape the trap"""
    amount_received: float
    funds_used_for: str                   # What specifically was purchased/paid
    date_received: datetime
    escape_successful: bool = False
    success_verified: bool = False
    verifiers: List[str] = field(default_factory=list)

    # Tracking freedom
    still_free_6_months: Optional[bool] = None
    still_free_1_year: Optional[bool] = None
    still_free_2_years: Optional[bool] = None

    # Recapture detection
    recaptured: bool = False
    recapture_date: Optional[datetime] = None
    recaptured_by: Optional[str] = None   # Entity that recaptured them


@dataclass
class PayItForward:
    """Helping others escape after you escape"""
    helped_person_id: str
    help_type: str                        # money, time, skills, mentoring
    help_amount: float = 0.0              # If money
    help_description: str = ""
    date_helped: datetime = field(default_factory=datetime.now)
    their_escape_successful: bool = False


@dataclass
class EscapeVelocityBond:
    """
    Bond that helps one person escape a poverty trap.

    Multiple small community stakes ($50-$500 each) totaling $500-$5000.
    Person uses funds to escape trap (car repair, debt payoff, tools, etc.).
    Person owes NOTHING back in money - but owes FREEDOM FORWARD.
    Bonds appreciate when person THRIVES and helps others escape.
    """
    bond_id: str
    person_id: str
    trap: Trap
    created_at: datetime = field(default_factory=datetime.now)

    # Community stakes
    stakers: Dict[str, float] = field(default_factory=dict)  # {staker_id: amount}

    # Escape tracking
    phase: EscapePhase = EscapePhase.TRAPPED
    escape_attempt: Optional[EscapeAttempt] = None
    pay_it_forward: List[PayItForward] = field(default_factory=list)

    # Anti-predatory tracking
    original_predatory_entity: Optional[str] = None  # Who trapped them originally?
    predatory_entities_blocked: List[str] = field(default_factory=list)

    # Thriving metrics
    income_before: float = 0.0
    income_after: float = 0.0
    quality_of_life_before: int = 0      # 1-10 scale
    quality_of_life_after: int = 0       # 1-10 scale

    def total_stake(self) -> float:
        """Total amount staked by community"""
        return sum(self.stakers.values())

    def escape_success(self) -> float:
        """
        Did they actually escape the trap?

        Returns: 0.0 to 2.0
        - 0.0 = Failed to escape or recaptured quickly
        - 1.0 = Successfully escaped
        - 2.0 = Escaped AND significantly improved situation
        """
        if not self.escape_attempt:
            return 0.0

        if not self.escape_attempt.escape_successful:
            return 0.0

        if self.escape_attempt.recaptured:
            # Severe penalty if recaptured
            return 0.2

        # Base success
        multiplier = 1.0

        # Bonus for significant improvement
        if self.income_after > self.income_before * 1.5:
            multiplier += 0.3  # 50%+ income increase

        if self.quality_of_life_after > self.quality_of_life_before + 3:
            multiplier += 0.3  # Significant QOL improvement

        # Bonus for verified success
        if self.escape_attempt.success_verified:
            multiplier += 0.4

        return min(2.0, multiplier)

    def thriving_duration(self) -> float:
        """
        How long have they stayed free?

        Returns: 0.5 to 3.0
        - 0.5 = Less than 6 months
        - 1.0 = 6 months
        - 2.0 = 1 year
        - 3.0 = 2+ years
        """
        if not self.escape_attempt or not self.escape_attempt.escape_successful:
            return 0.0

        if self.escape_attempt.recaptured:
            return 0.3  # Severe penalty

        duration = datetime.now() - self.escape_attempt.date_received
        months = duration.days / 30.44

        if months < 6:
            return 0.5
        elif self.escape_attempt.still_free_6_months and months >= 6:
            if self.escape_attempt.still_free_1_year and months >= 12:
                if self.escape_attempt.still_free_2_years and months >= 24:
                    return 3.0  # 2+ years free
                return 2.0  # 1 year free
            return 1.0  # 6 months free
        else:
            return 0.5

    def others_helped(self) -> float:
        """
        How many others did they help escape?

        This is the PAY IT FORWARD mechanism - the core of the system.

        Returns: 1.0 to 10.0+
        - 1.0 = Helped no one yet
        - 2.0 = Helped 1 person
        - 5.0 = Helped 5 people
        - 10.0+ = Helped 10+ people (exponential freedom effect)
        """
        if not self.pay_it_forward:
            return 1.0

        # Count successful escapes they helped with
        successful_helps = [
            pif for pif in self.pay_it_forward
            if pif.their_escape_successful
        ]

        count = len(successful_helps)

        if count == 0:
            return 1.0
        elif count == 1:
            return 2.0
        elif count <= 3:
            return 2.0 + ((count - 1) * 1.0)  # 3.0 or 4.0
        elif count <= 5:
            return 4.0 + ((count - 3) * 0.8)  # Up to 5.6
        elif count <= 10:
            return 5.6 + ((count - 5) * 0.6)  # Up to 8.6
        else:
            return 8.6 + ((count - 10) * 0.4)  # 10+ creates exponential effect

    def anti_recapture(self) -> float:
        """
        Protection against predatory entities recapturing person.

        If same entity tries to trap them again, that entity gets BLOCKED.
        This creates economic pressure against predatory business models.

        Returns: 0.3 to 1.5
        - 0.3 = Recaptured by same entity
        - 1.0 = Stayed free
        - 1.5 = Helped block predatory entity from system
        """
        if not self.escape_attempt:
            return 1.0

        if self.escape_attempt.recaptured:
            # Severe penalty if recaptured
            if self.escape_attempt.recaptured_by == self.original_predatory_entity:
                # Extra severe if SAME entity recaptured them
                return 0.3
            return 0.5

        # Bonus if they helped identify and block predatory entities
        if self.predatory_entities_blocked:
            return 1.5

        return 1.0

    def calculate_appreciation(self) -> float:
        """
        Calculate bond appreciation based on all factors.

        Formula:
        Bond Value = Stake × Escape_Success × Thriving_Duration ×
                     Others_Helped × Anti_Recapture

        Returns total value for all stakers.
        """
        base = self.total_stake()

        escape = self.escape_success()
        thriving = self.thriving_duration()
        helped = self.others_helped()
        anti_recap = self.anti_recapture()

        appreciation = base * escape * thriving * helped * anti_recap

        return appreciation

    def staker_payout(self, staker_id: str) -> float:
        """Calculate individual staker's payout (proportional to stake)"""
        if staker_id not in self.stakers:
            return 0.0

        total_value = self.calculate_appreciation()
        stake_percent = self.stakers[staker_id] / self.total_stake()

        return total_value * stake_percent

    def add_staker(self, staker_id: str, amount: float):
        """Community member stakes to help person escape"""
        if amount < 50:
            raise ValueError("Minimum stake is $50")
        if amount > 500:
            raise ValueError("Maximum individual stake is $500 (keep it small)")

        self.stakers[staker_id] = amount

    def release_funds(self, amount: float, used_for: str):
        """Release funds to person to escape trap"""
        if amount > self.total_stake():
            raise ValueError("Cannot release more than total stake")

        self.escape_attempt = EscapeAttempt(
            amount_received=amount,
            funds_used_for=used_for,
            date_received=datetime.now()
        )
        self.phase = EscapePhase.FUNDED

    def mark_escape_successful(self, verifiers: List[str],
                               income_after: float = 0.0,
                               qol_after: int = 0):
        """Mark that person successfully escaped the trap"""
        if not self.escape_attempt:
            raise ValueError("No escape attempt to mark successful")

        self.escape_attempt.escape_successful = True
        self.escape_attempt.success_verified = True
        self.escape_attempt.verifiers = verifiers
        self.phase = EscapePhase.FREE

        if income_after > 0:
            self.income_after = income_after
        if qol_after > 0:
            self.quality_of_life_after = qol_after

    def update_thriving_status(self, months: int, still_free: bool):
        """Update whether person is still free at checkpoint"""
        if not self.escape_attempt:
            return

        if months == 6:
            self.escape_attempt.still_free_6_months = still_free
            if still_free:
                self.phase = EscapePhase.THRIVING
        elif months == 12:
            self.escape_attempt.still_free_1_year = still_free
        elif months == 24:
            self.escape_attempt.still_free_2_years = still_free

    def mark_recaptured(self, recaptured_by: str):
        """Mark that person was recaptured by a predatory entity"""
        if not self.escape_attempt:
            return

        self.escape_attempt.recaptured = True
        self.escape_attempt.recapture_date = datetime.now()
        self.escape_attempt.recaptured_by = recaptured_by

        # If same entity that originally trapped them, BLOCK that entity
        if recaptured_by == self.original_predatory_entity:
            if recaptured_by not in self.predatory_entities_blocked:
                self.predatory_entities_blocked.append(recaptured_by)

    def add_pay_it_forward(self, helped_person_id: str, help_type: str,
                          help_amount: float = 0.0, description: str = "",
                          their_success: bool = False):
        """Record helping another person escape"""
        pif = PayItForward(
            helped_person_id=helped_person_id,
            help_type=help_type,
            help_amount=help_amount,
            help_description=description,
            their_escape_successful=their_success
        )
        self.pay_it_forward.append(pif)
        self.phase = EscapePhase.HELPING


def create_escape_velocity_bond(
    bond_id: str,
    person_id: str,
    trap_type: TrapType,
    trap_description: str,
    escape_amount: float,
    escape_plan: str
) -> EscapeVelocityBond:
    """
    Create a new Escape Velocity Bond to help someone escape a poverty trap.

    Args:
        bond_id: Unique identifier
        person_id: Person who needs help
        trap_type: Type of trap they're in
        trap_description: What's the trap?
        escape_amount: How much needed to escape?
        escape_plan: How will funds be used?

    Returns:
        EscapeVelocityBond instance
    """
    if escape_amount < 500:
        raise ValueError("Minimum escape amount is $500")
    if escape_amount > 5000:
        raise ValueError("Maximum escape amount is $5000 (keep it accessible)")

    trap = Trap(
        trap_type=trap_type,
        description=trap_description,
        impact="Person trapped in survival mode, can't build or thrive",
        escape_amount_needed=escape_amount,
        escape_plan=escape_plan
    )

    return EscapeVelocityBond(
        bond_id=bond_id,
        person_id=person_id,
        trap=trap
    )


# Example usage and demonstration
if __name__ == "__main__":
    print("=" * 80)
    print("ESCAPE VELOCITY BONDS - Breaking the Survival Trap")
    print("=" * 80)
    print()

    # Scenario: Car breakdown trap
    print("Scenario: Single parent, car breaks down, can't afford $700 repair")
    print("-" * 80)

    # Create bond
    bond = create_escape_velocity_bond(
        bond_id="escape_001",
        person_id="maria_single_parent",
        trap_type=TrapType.CAR_BREAKDOWN,
        trap_description="Car needs $700 repair. Without car, can't get to work 20 miles away. Without work, lose apartment.",
        escape_amount=800.0,  # Repair + 1 month gas
        escape_plan="Fix car immediately, keep job, avoid cascading failure"
    )

    bond.income_before = 28000.0  # $28k/year
    bond.quality_of_life_before = 3  # Struggling

    print(f"Trap: {bond.trap.description}")
    print(f"Escape amount needed: ${bond.trap.escape_amount_needed:.2f}")
    print()

    # Community stakes
    print("Community Stakes (small amounts from many people)")
    print("-" * 80)
    bond.add_staker("neighbor_1", 100)
    bond.add_staker("coworker_1", 150)
    bond.add_staker("church_member_1", 200)
    bond.add_staker("local_business_1", 250)
    bond.add_staker("community_org_1", 100)

    print(f"Total staked: ${bond.total_stake():.2f} from {len(bond.stakers)} people")
    print("Each stake: $50-$250 (small enough anyone can participate)")
    print()

    # Release funds
    print("Funds Released")
    print("-" * 80)
    bond.release_funds(800, "Car repair ($700) + gas for month ($100)")
    print(f"Phase: {bond.phase.value}")
    print()

    # Escape successful
    print("6 Months Later: Escape Successful")
    print("-" * 80)
    bond.mark_escape_successful(
        verifiers=["employer", "neighbor_1", "coworker_1"],
        income_after=28000,  # Kept job
        qol_after=6  # Much better
    )
    bond.update_thriving_status(6, still_free=True)
    print(f"Escape success: {bond.escape_success():.2f}x")
    print(f"Thriving duration: {bond.thriving_duration():.2f}x")
    print(f"Phase: {bond.phase.value}")
    print()

    # 1 year later: Still free
    bond.escape_attempt.date_received = datetime.now() - timedelta(days=365)
    bond.update_thriving_status(12, still_free=True)

    # Pay it forward
    print("1 Year Later: Paying It Forward")
    print("-" * 80)
    bond.add_pay_it_forward(
        helped_person_id="coworker_2",
        help_type="money",
        help_amount=200,
        description="Helped co-worker fix their car",
        their_success=True
    )
    bond.add_pay_it_forward(
        helped_person_id="neighbor_2",
        help_type="time",
        description="Taught neighbor car maintenance, saved them $500",
        their_success=True
    )
    print(f"Helped {len(bond.pay_it_forward)} people escape their traps")
    print(f"Others helped multiplier: {bond.others_helped():.2f}x")
    print()

    # 2 years later: More helping
    bond.escape_attempt.date_received = datetime.now() - timedelta(days=730)
    bond.update_thriving_status(24, still_free=True)

    for i in range(3):
        bond.add_pay_it_forward(
            helped_person_id=f"person_{i}",
            help_type="mentoring",
            description="Financial literacy coaching",
            their_success=True
        )

    print("2 Years Later: Creating Freedom Wave")
    print("-" * 80)
    print(f"Total people helped: {len(bond.pay_it_forward)}")
    print(f"Still free: {bond.escape_attempt.still_free_2_years}")
    print()

    # Final appreciation
    print("=" * 80)
    print("FINAL BOND APPRECIATION")
    print("=" * 80)
    print(f"Initial stake: ${bond.total_stake():.2f}")
    print(f"Escape success: {bond.escape_success():.2f}x")
    print(f"Thriving duration: {bond.thriving_duration():.2f}x")
    print(f"Others helped: {bond.others_helped():.2f}x")
    print(f"Anti-recapture: {bond.anti_recapture():.2f}x")
    print()
    print(f"Total value: ${bond.calculate_appreciation():.2f}")
    print()
    print("Individual staker payouts:")
    for staker_id, stake in bond.stakers.items():
        payout = bond.staker_payout(staker_id)
        roi = (payout / stake - 1) * 100
        print(f"  {staker_id}: ${stake:.2f} → ${payout:.2f} ({roi:.1f}% ROI)")
    print()
    print(f"Average ROI: {(bond.calculate_appreciation() / bond.total_stake() - 1) * 100:.1f}%")
    print()
    print("🚀 ESCAPE VELOCITY ACHIEVED. One person free, 5+ others helped.")
    print("💪 The little guy gets to BUILD instead of just SURVIVE.")
