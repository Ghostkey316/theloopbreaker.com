"""
Common Ground Bonds - Healing the Divide

Economic mechanism that makes FINDING COMMON GROUND more profitable than deepening divides.

Philosophy:
- Unity without destroying diversity
- Understanding the "enemy" is rewarded
- Collaborative action on shared values
- Division becomes economically expensive
- Bridges at scale save humanity

The Problem:
- Humanity is too divided to solve existential problems
- Political polarization, wealth inequality, cultural conflicts
- Current systems make division profitable (social media, politics, media)
- We agree on problems but can't work together

The Solution:
- Two people from "opposite sides" stake bonds together
- Genuine listening and understanding phase
- Find common ground without forced consensus
- Collaborative project on shared values
- Bonds appreciate based on quality, action, time, and ripple effect

Formula:
Bond Value = Stake × Understanding_Quality × Diversity_Preserved × Action_Taken × Time_Sustained × Ripple_Multiplier

Freedom Protocol:
- No surveillance (community attestation only)
- Diversity preserved (bonus for maintaining different perspectives)
- No forced consensus (disagreement is fine, hate is not)
- Effort required (real projects, not virtue signaling)
- Privacy maintained (no tracking beliefs or conversations)
- Long-term > short-term (maximum value after years)
- Community > capital (local verifiers, no central authority)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum


class DivideType(Enum):
    """Types of divides that can be bridged"""
    POLITICAL = "political"           # Conservative vs Progressive
    ECONOMIC = "economic"             # Wealthy vs Working class
    CULTURAL = "cultural"             # Different cultures/religions
    GENERATIONAL = "generational"     # Boomer vs Gen Z
    GEOGRAPHIC = "geographic"         # Urban vs Rural
    OCCUPATIONAL = "occupational"     # Tech vs Manual labor
    OTHER = "other"


class BridgePhase(Enum):
    """Current phase of bridge building"""
    STAKED = "staked"                 # Initial stake placed
    LISTENING = "listening"           # Learning each other's perspectives
    DISCOVERY = "discovery"           # Finding common ground
    ACTION = "action"                 # Collaborative project
    SUSTAINED = "sustained"           # Long-term relationship
    RIPPLE = "ripple"                 # Inspiring others


@dataclass
class Perspective:
    """One person's perspective in the bridge"""
    person_id: str
    side_description: str             # Brief description of their "side"
    documented_view: str              # Their documented perspective
    timestamp: datetime = field(default_factory=datetime.now)

    # Verification that they genuinely engaged
    community_verifiers: List[str] = field(default_factory=list)  # From their side
    verified: bool = False


@dataclass
class CommonGround:
    """Areas where both parties found genuine agreement"""
    topic: str
    shared_value: str                 # What they both value
    agreement_description: str
    persistent_disagreements: str     # What they still disagree on (with respect)
    collaborative_project: str        # Concrete project they'll do together
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class CollaborativeAction:
    """Real project completed together on common ground"""
    project_name: str
    description: str
    start_date: datetime
    completion_date: Optional[datetime] = None
    impact_description: str = ""
    community_verified: bool = False
    verifiers: List[str] = field(default_factory=list)


@dataclass
class RippleEffect:
    """Other bridges inspired by this one"""
    inspired_bridge_id: str
    divide_type: DivideType
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class CommonGroundBond:
    """
    Bond between two people from opposite sides of a divide.

    Appreciates based on:
    - Quality of understanding (can each explain the other's view?)
    - Preserved diversity (did they maintain distinct perspectives?)
    - Collaborative action (did they DO something together?)
    - Time sustained (still talking years later?)
    - Ripple effect (did they inspire others?)
    """
    bond_id: str
    person_a_id: str
    person_b_id: str
    divide_type: DivideType
    initial_stake_a: float            # Person A's stake
    initial_stake_b: float            # Person B's stake
    created_at: datetime = field(default_factory=datetime.now)

    # Bridge building data
    phase: BridgePhase = BridgePhase.STAKED
    perspective_a: Optional[Perspective] = None
    perspective_b: Optional[Perspective] = None
    common_ground: Optional[CommonGround] = None
    collaborative_actions: List[CollaborativeAction] = field(default_factory=list)
    ripple_effects: List[RippleEffect] = field(default_factory=list)

    # Verification
    understanding_verified_by_a_side: List[str] = field(default_factory=list)  # Verifiers from A's side
    understanding_verified_by_b_side: List[str] = field(default_factory=list)  # Verifiers from B's side

    # Tracking
    last_interaction: datetime = field(default_factory=datetime.now)
    bridge_broken: bool = False       # Did the relationship fall apart?
    bridge_broken_reason: str = ""

    # Diversity tracking
    a_perspective_changed: bool = False  # Did A abandon their perspective?
    b_perspective_changed: bool = False  # Did B abandon their perspective?

    def total_stake(self) -> float:
        """Total stake from both parties"""
        return self.initial_stake_a + self.initial_stake_b

    def understanding_quality(self) -> float:
        """
        Can each person explain the other's view accurately?

        Verified by third parties from EACH side:
        - People from A's side verify that B truly understands A's view
        - People from B's side verify that A truly understands B's view

        Returns: 0.0 to 2.0
        - 0.0 = No understanding
        - 1.0 = Basic understanding
        - 2.0 = Deep, nuanced understanding
        """
        if not self.perspective_a or not self.perspective_b:
            return 0.0

        # Need verification from BOTH sides
        a_side_verifications = len(self.understanding_verified_by_a_side)
        b_side_verifications = len(self.understanding_verified_by_b_side)

        if a_side_verifications == 0 or b_side_verifications == 0:
            return 0.0

        # Quality increases with more verifiers (up to 2.0)
        # 1 verifier each = 1.0, 3+ verifiers each = 2.0
        quality = min(2.0, 0.5 + (a_side_verifications * 0.25) + (b_side_verifications * 0.25))

        return quality

    def diversity_preserved(self) -> float:
        """
        Did they maintain their distinct perspectives?

        Bonus for preserving diversity while finding common ground.
        Penalty if either person abandoned their own perspective (forced conformity).

        Returns: 0.5 to 1.5
        - 0.5 = One or both abandoned their perspective (fake conversion)
        - 1.0 = Both maintained perspectives
        - 1.5 = Both maintained perspectives AND documented respectful disagreements
        """
        if self.a_perspective_changed or self.b_perspective_changed:
            # Penalty for fake conversion
            return 0.5

        # Bonus if they documented persistent disagreements with mutual respect
        if self.common_ground and self.common_ground.persistent_disagreements:
            return 1.5

        return 1.0

    def action_taken(self) -> float:
        """
        Did they complete real collaborative projects?

        Can't just talk - must DO something together on common ground.

        Returns: 0.0 to 3.0
        - 0.0 = No action
        - 1.0 = One small project
        - 3.0 = Multiple significant projects
        """
        if not self.collaborative_actions:
            return 0.0

        # Count completed AND verified projects
        completed_verified = [
            action for action in self.collaborative_actions
            if action.completion_date and action.community_verified
        ]

        if not completed_verified:
            return 0.0

        # Scale based on number of projects (diminishing returns)
        count = len(completed_verified)
        if count == 1:
            return 1.0
        elif count == 2:
            return 1.8
        elif count == 3:
            return 2.4
        else:
            return 3.0

    def time_sustained(self) -> float:
        """
        How long has the relationship lasted?

        Maximum appreciation only after years of sustained relationship.

        Returns: 0.5 to 5.0
        - 0.5 = Less than 6 months
        - 1.0 = 6 months
        - 2.0 = 1 year
        - 3.0 = 2 years
        - 4.0 = 3 years
        - 5.0 = 5+ years
        """
        if self.bridge_broken:
            # Penalty if relationship fell apart
            return 0.3

        duration = datetime.now() - self.created_at
        months = duration.days / 30.44  # Average month length

        if months < 6:
            return 0.5
        elif months < 12:
            return 1.0
        elif months < 24:
            return 2.0
        elif months < 36:
            return 3.0
        elif months < 60:
            return 4.0
        else:
            return 5.0

    def ripple_multiplier(self) -> float:
        """
        Did this bridge inspire others to build bridges?

        Exponential effect: One bridge can inspire many.

        Returns: 1.0 to 20.0+
        - 1.0 = No ripple effect
        - 2.0 = Inspired 1-2 other bridges
        - 5.0 = Inspired 5-10 bridges
        - 10.0 = Inspired 20+ bridges
        - 20.0+ = Sparked movement in their community
        """
        if not self.ripple_effects:
            return 1.0

        count = len(self.ripple_effects)

        if count <= 2:
            return 1.0 + (count * 0.5)
        elif count <= 5:
            return 2.0 + ((count - 2) * 0.6)
        elif count <= 10:
            return 4.0 + ((count - 5) * 0.4)
        elif count <= 20:
            return 6.0 + ((count - 10) * 0.3)
        else:
            return 9.0 + ((count - 20) * 0.2)

    def calculate_appreciation(self) -> float:
        """
        Calculate bond appreciation based on all factors.

        Formula:
        Bond Value = Stake × Understanding_Quality × Diversity_Preserved ×
                     Action_Taken × Time_Sustained × Ripple_Multiplier

        Returns total value for BOTH parties combined.
        """
        base = self.total_stake()

        understanding = self.understanding_quality()
        diversity = self.diversity_preserved()
        action = self.action_taken()
        time = self.time_sustained()
        ripple = self.ripple_multiplier()

        appreciation = base * understanding * diversity * action * time * ripple

        return appreciation

    def person_a_payout(self) -> float:
        """Person A's share of appreciation (50/50 split)"""
        return self.calculate_appreciation() * 0.5

    def person_b_payout(self) -> float:
        """Person B's share of appreciation (50/50 split)"""
        return self.calculate_appreciation() * 0.5

    def add_perspective(self, person_id: str, side_description: str, documented_view: str):
        """Document one person's perspective"""
        perspective = Perspective(
            person_id=person_id,
            side_description=side_description,
            documented_view=documented_view
        )

        if person_id == self.person_a_id:
            self.perspective_a = perspective
        elif person_id == self.person_b_id:
            self.perspective_b = perspective

        # Update phase if both perspectives documented
        if self.perspective_a and self.perspective_b:
            self.phase = BridgePhase.LISTENING

    def verify_understanding(self, verifier_id: str, verifying_for_side: str):
        """
        Third party verifies that one person understands the other's view.

        Args:
            verifier_id: Person doing the verification (from one side)
            verifying_for_side: Which side they're verifying understanding of ("a" or "b")
        """
        if verifying_for_side == "a":
            # Verifier from A's side confirms B understands A's view
            if verifier_id not in self.understanding_verified_by_a_side:
                self.understanding_verified_by_a_side.append(verifier_id)
        elif verifying_for_side == "b":
            # Verifier from B's side confirms A understands B's view
            if verifier_id not in self.understanding_verified_by_b_side:
                self.understanding_verified_by_b_side.append(verifier_id)

    def set_common_ground(self, topic: str, shared_value: str, agreement_desc: str,
                          disagreements: str, project: str):
        """Document the common ground they found"""
        self.common_ground = CommonGround(
            topic=topic,
            shared_value=shared_value,
            agreement_description=agreement_desc,
            persistent_disagreements=disagreements,
            collaborative_project=project
        )
        self.phase = BridgePhase.DISCOVERY

    def add_collaborative_action(self, project_name: str, description: str,
                                 start_date: datetime, impact: str):
        """Start a collaborative project"""
        action = CollaborativeAction(
            project_name=project_name,
            description=description,
            start_date=start_date,
            impact_description=impact
        )
        self.collaborative_actions.append(action)
        self.phase = BridgePhase.ACTION
        self.last_interaction = datetime.now()
        return action

    def complete_action(self, project_name: str, verifiers: List[str]):
        """Mark a project as completed and verified"""
        for action in self.collaborative_actions:
            if action.project_name == project_name:
                action.completion_date = datetime.now()
                action.verifiers = verifiers
                action.community_verified = True
                self.last_interaction = datetime.now()
                break

    def add_ripple_effect(self, inspired_bridge_id: str, divide_type: DivideType):
        """Record that this bridge inspired another bridge"""
        ripple = RippleEffect(
            inspired_bridge_id=inspired_bridge_id,
            divide_type=divide_type
        )
        self.ripple_effects.append(ripple)
        self.phase = BridgePhase.RIPPLE

    def break_bridge(self, reason: str):
        """Mark bridge as broken (relationship fell apart)"""
        self.bridge_broken = True
        self.bridge_broken_reason = reason

    def mark_perspective_changed(self, person_id: str):
        """
        Mark that someone abandoned their perspective (forced conformity).
        This REDUCES bond value (we want diversity preserved).
        """
        if person_id == self.person_a_id:
            self.a_perspective_changed = True
        elif person_id == self.person_b_id:
            self.b_perspective_changed = True


def create_common_ground_bond(
    bond_id: str,
    person_a_id: str,
    person_b_id: str,
    divide_type: DivideType,
    stake_a: float,
    stake_b: float
) -> CommonGroundBond:
    """
    Create a new Common Ground Bond between two people from opposite sides.

    Args:
        bond_id: Unique identifier for the bond
        person_a_id: First person's ID
        person_b_id: Second person's ID
        divide_type: Type of divide being bridged
        stake_a: Person A's stake
        stake_b: Person B's stake

    Returns:
        CommonGroundBond instance
    """
    return CommonGroundBond(
        bond_id=bond_id,
        person_a_id=person_a_id,
        person_b_id=person_b_id,
        divide_type=divide_type,
        initial_stake_a=stake_a,
        initial_stake_b=stake_b
    )


# Example usage and demonstration
if __name__ == "__main__":
    print("=" * 80)
    print("COMMON GROUND BONDS - Healing the Divide")
    print("=" * 80)
    print()

    # Scenario: Conservative farmer + Progressive environmentalist
    print("Scenario: Conservative farmer + Progressive environmentalist")
    print("-" * 80)

    # Create bond
    bond = create_common_ground_bond(
        bond_id="bridge_001",
        person_a_id="alice_progressive",
        person_b_id="bob_conservative",
        divide_type=DivideType.POLITICAL,
        stake_a=1000.0,
        stake_b=1000.0
    )

    print(f"Initial stake: ${bond.total_stake():.2f}")
    print()

    # Phase 1: Document perspectives
    print("Phase 1: Genuine Listening")
    print("-" * 80)
    bond.add_perspective(
        "alice_progressive",
        "Progressive city dweller, environmentalist",
        "Believes climate action requires government regulation and collective action"
    )
    bond.add_perspective(
        "bob_conservative",
        "Conservative rural farmer, values local autonomy",
        "Distrusts government, believes in property rights and individual responsibility"
    )
    print(f"Current phase: {bond.phase.value}")
    print()

    # Phase 2: Verify understanding (from BOTH sides)
    print("Phase 2: Understanding Verification")
    print("-" * 80)
    bond.verify_understanding("progressive_verifier_1", "a")  # From Alice's side
    bond.verify_understanding("progressive_verifier_2", "a")
    bond.verify_understanding("conservative_verifier_1", "b")  # From Bob's side
    bond.verify_understanding("conservative_verifier_2", "b")
    print(f"Understanding quality: {bond.understanding_quality():.2f}x")
    print()

    # Phase 3: Find common ground
    print("Phase 3: Common Ground Discovery")
    print("-" * 80)
    bond.set_common_ground(
        topic="Clean water and healthy soil",
        shared_value="Both want thriving local communities",
        agreement_desc="Regenerative agriculture protects environment AND property rights",
        disagreements="Still disagree on role of federal regulation, but respect each other's views",
        project="Collaborative regenerative farming demonstration project"
    )
    print(f"Common ground: {bond.common_ground.topic}")
    print(f"Diversity preserved: {bond.diversity_preserved():.2f}x")
    print()

    # Phase 4: Collaborative action
    print("Phase 4: Collaborative Action")
    print("-" * 80)
    bond.add_collaborative_action(
        project_name="Regenerative Farm Demo",
        description="Convert 10 acres to regenerative practices, measure soil health improvements",
        start_date=datetime.now() - timedelta(days=120),
        impact="Soil carbon up 15%, water retention improved, both farmer income and environmental health increased"
    )
    bond.complete_action(
        "Regenerative Farm Demo",
        verifiers=["local_farmer_1", "environmental_org_1", "soil_scientist_1"]
    )
    print(f"Action taken: {bond.action_taken():.2f}x")
    print()

    # Simulate time passing (2 years)
    bond.created_at = datetime.now() - timedelta(days=730)
    bond.last_interaction = datetime.now() - timedelta(days=7)

    print("Phase 5: Sustained Relationship (2 years later)")
    print("-" * 80)
    print(f"Time sustained: {bond.time_sustained():.2f}x")
    print()

    # Ripple effect
    print("Phase 6: Ripple Effect")
    print("-" * 80)
    bond.add_ripple_effect("bridge_002", DivideType.POLITICAL)
    bond.add_ripple_effect("bridge_003", DivideType.GEOGRAPHIC)
    bond.add_ripple_effect("bridge_004", DivideType.POLITICAL)
    print(f"Inspired {len(bond.ripple_effects)} other bridges")
    print(f"Ripple multiplier: {bond.ripple_multiplier():.2f}x")
    print()

    # Final appreciation
    print("=" * 80)
    print("FINAL BOND APPRECIATION")
    print("=" * 80)
    print(f"Initial stake: ${bond.total_stake():.2f}")
    print(f"Understanding quality: {bond.understanding_quality():.2f}x")
    print(f"Diversity preserved: {bond.diversity_preserved():.2f}x")
    print(f"Action taken: {bond.action_taken():.2f}x")
    print(f"Time sustained: {bond.time_sustained():.2f}x")
    print(f"Ripple multiplier: {bond.ripple_multiplier():.2f}x")
    print()
    print(f"Total value: ${bond.calculate_appreciation():.2f}")
    print(f"Alice payout: ${bond.person_a_payout():.2f}")
    print(f"Bob payout: ${bond.person_b_payout():.2f}")
    print()
    print(f"ROI: {(bond.calculate_appreciation() / bond.total_stake() - 1) * 100:.1f}%")
    print()
    print("🌉 BRIDGE BUILT. Division became unity without destroying diversity.")
