"""
Tests for Common Ground Bonds - Healing the Divide

Validates:
- Bond creation and phase transitions
- Understanding quality verification (both sides)
- Diversity preservation (no forced conformity)
- Collaborative action requirements
- Time sustained multipliers
- Ripple effect mechanics
- Anti-gaming protection
- Final appreciation calculation
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.common_ground_bonds import (
    CommonGroundBond,
    create_common_ground_bond,
    DivideType,
    BridgePhase,
    Perspective,
    CommonGround,
    CollaborativeAction,
    RippleEffect
)


class TestBondCreation:
    """Test bond creation and initialization"""

    def test_create_basic_bond(self):
        """Should create bond between two people from opposite sides"""
        bond = create_common_ground_bond(
            bond_id="test_001",
            person_a_id="alice",
            person_b_id="bob",
            divide_type=DivideType.POLITICAL,
            stake_a=1000.0,
            stake_b=1000.0
        )

        assert bond.bond_id == "test_001"
        assert bond.person_a_id == "alice"
        assert bond.person_b_id == "bob"
        assert bond.divide_type == DivideType.POLITICAL
        assert bond.total_stake() == 2000.0
        assert bond.phase == BridgePhase.STAKED

    def test_divide_types(self):
        """Should support various divide types"""
        divide_types = [
            DivideType.POLITICAL,
            DivideType.ECONOMIC,
            DivideType.CULTURAL,
            DivideType.GENERATIONAL,
            DivideType.GEOGRAPHIC,
            DivideType.OCCUPATIONAL
        ]

        for divide_type in divide_types:
            bond = create_common_ground_bond(
                "test",
                "alice",
                "bob",
                divide_type,
                1000.0,
                1000.0
            )
            assert bond.divide_type == divide_type


class TestUnderstandingQuality:
    """Test understanding verification mechanism"""

    def test_no_understanding_initially(self):
        """Should have 0 understanding without perspectives"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )
        assert bond.understanding_quality() == 0.0

    def test_perspectives_documented(self):
        """Should require both perspectives documented"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.add_perspective(
            "alice",
            "Progressive",
            "Believes in collective action"
        )
        assert bond.phase == BridgePhase.STAKED  # Not listening yet

        bond.add_perspective(
            "bob",
            "Conservative",
            "Believes in individual responsibility"
        )
        assert bond.phase == BridgePhase.LISTENING  # Both documented

    def test_understanding_verification_both_sides(self):
        """Should require verification from BOTH sides"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.add_perspective("alice", "Progressive", "View A")
        bond.add_perspective("bob", "Conservative", "View B")

        # Only A's side verifies
        bond.verify_understanding("verifier_from_a", "a")
        assert bond.understanding_quality() == 0.0  # Need both sides

        # Now B's side verifies
        bond.verify_understanding("verifier_from_b", "b")
        assert bond.understanding_quality() == 1.0  # Basic understanding

    def test_understanding_quality_scaling(self):
        """Should scale with number of verifiers"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.add_perspective("alice", "Progressive", "View A")
        bond.add_perspective("bob", "Conservative", "View B")

        # 1 verifier each = 1.0
        bond.verify_understanding("a_verifier_1", "a")
        bond.verify_understanding("b_verifier_1", "b")
        assert bond.understanding_quality() == 1.0

        # 2 verifiers each = 1.5
        bond.verify_understanding("a_verifier_2", "a")
        bond.verify_understanding("b_verifier_2", "b")
        assert bond.understanding_quality() == 1.5

        # 3+ verifiers each = 2.0 (maximum)
        bond.verify_understanding("a_verifier_3", "a")
        bond.verify_understanding("b_verifier_3", "b")
        assert bond.understanding_quality() == 2.0


class TestDiversityPreserved:
    """Test diversity preservation mechanism"""

    def test_diversity_maintained(self):
        """Should reward maintaining distinct perspectives"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Neither changed their perspective
        assert bond.diversity_preserved() == 1.0

    def test_diversity_with_documented_disagreements(self):
        """Should give bonus for documenting respectful disagreements"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.set_common_ground(
            topic="Climate action",
            shared_value="Both want clean environment",
            agreement_desc="Regenerative agriculture works",
            disagreements="Still disagree on federal regulation vs local control",
            project="Collaborative farm demo"
        )

        assert bond.diversity_preserved() == 1.5  # Bonus for respectful disagreement

    def test_penalty_for_forced_conformity(self):
        """Should penalize if someone abandons their perspective"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Alice abandons her perspective (forced conformity)
        bond.mark_perspective_changed("alice")
        assert bond.diversity_preserved() == 0.5  # Penalty

    def test_no_fake_conversion(self):
        """Should prevent gaming via fake conversion"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Both abandon perspectives (both "converted")
        bond.mark_perspective_changed("alice")
        bond.mark_perspective_changed("bob")
        assert bond.diversity_preserved() == 0.5  # Still penalized


class TestCollaborativeAction:
    """Test collaborative project requirements"""

    def test_no_action_initially(self):
        """Should have 0 action without projects"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )
        assert bond.action_taken() == 0.0

    def test_action_requires_completion_and_verification(self):
        """Should require projects to be completed AND verified"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Start project but don't complete
        bond.add_collaborative_action(
            "Test Project",
            "Description",
            datetime.now(),
            "Impact"
        )
        assert bond.action_taken() == 0.0  # Not completed

        # Complete and verify
        bond.complete_action("Test Project", ["verifier1", "verifier2"])
        assert bond.action_taken() == 1.0  # One completed project

    def test_multiple_projects_scale(self):
        """Should scale with multiple completed projects"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # 1 project = 1.0
        bond.add_collaborative_action("Project 1", "Desc", datetime.now(), "Impact")
        bond.complete_action("Project 1", ["v1"])
        assert bond.action_taken() == 1.0

        # 2 projects = 1.8
        bond.add_collaborative_action("Project 2", "Desc", datetime.now(), "Impact")
        bond.complete_action("Project 2", ["v1"])
        assert bond.action_taken() == 1.8

        # 3 projects = 2.4
        bond.add_collaborative_action("Project 3", "Desc", datetime.now(), "Impact")
        bond.complete_action("Project 3", ["v1"])
        assert bond.action_taken() == 2.4

        # 4+ projects = 3.0 (maximum)
        bond.add_collaborative_action("Project 4", "Desc", datetime.now(), "Impact")
        bond.complete_action("Project 4", ["v1"])
        assert bond.action_taken() == 3.0

    def test_phase_transition_on_action(self):
        """Should transition to action phase"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.add_collaborative_action("Project", "Desc", datetime.now(), "Impact")
        assert bond.phase == BridgePhase.ACTION


class TestTimeSustained:
    """Test time-based appreciation"""

    def test_time_scaling(self):
        """Should scale with duration of relationship"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # < 6 months = 0.5
        bond.created_at = datetime.now() - timedelta(days=150)
        assert bond.time_sustained() == 0.5

        # 6+ months = 1.0
        bond.created_at = datetime.now() - timedelta(days=185)
        assert bond.time_sustained() == 1.0

        # 1 year = 2.0
        bond.created_at = datetime.now() - timedelta(days=370)
        assert bond.time_sustained() == 2.0

        # 2 years = 3.0
        bond.created_at = datetime.now() - timedelta(days=735)
        assert bond.time_sustained() == 3.0

        # 3 years = 4.0
        bond.created_at = datetime.now() - timedelta(days=1100)
        assert bond.time_sustained() == 4.0

        # 5+ years = 5.0
        bond.created_at = datetime.now() - timedelta(days=1830)
        assert bond.time_sustained() == 5.0

    def test_broken_bridge_penalty(self):
        """Should penalize if relationship fell apart"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.created_at = datetime.now() - timedelta(days=730)  # 2 years
        bond.break_bridge("Fundamental disagreement became conflict")

        assert bond.time_sustained() == 0.3  # Severe penalty


class TestRippleEffect:
    """Test ripple effect multiplier"""

    def test_no_ripple_initially(self):
        """Should have 1.0 multiplier with no ripple"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )
        assert bond.ripple_multiplier() == 1.0

    def test_ripple_scaling(self):
        """Should scale with number of inspired bridges"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # 1 inspired bridge
        bond.add_ripple_effect("bridge_002", DivideType.POLITICAL)
        assert bond.ripple_multiplier() == 1.5

        # 2 inspired bridges
        bond.add_ripple_effect("bridge_003", DivideType.ECONOMIC)
        assert bond.ripple_multiplier() == 2.0

        # 5 inspired bridges
        for i in range(3):
            bond.add_ripple_effect(f"bridge_00{4+i}", DivideType.CULTURAL)
        ripple = bond.ripple_multiplier()
        assert 3.5 < ripple < 4.5  # Should be around 4.0

        # 10+ inspired bridges (exponential effect)
        for i in range(6):
            bond.add_ripple_effect(f"bridge_0{10+i}", DivideType.GENERATIONAL)
        ripple = bond.ripple_multiplier()
        assert ripple > 6.0  # Significant ripple effect

    def test_phase_transition_on_ripple(self):
        """Should transition to ripple phase"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        bond.add_ripple_effect("bridge_002", DivideType.POLITICAL)
        assert bond.phase == BridgePhase.RIPPLE


class TestAppreciation:
    """Test full appreciation calculation"""

    def test_no_appreciation_without_work(self):
        """Should not appreciate without any bridge-building"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # No perspectives, no understanding, no action
        appreciation = bond.calculate_appreciation()
        assert appreciation == 0.0  # Understanding is 0, multiplies to 0

    def test_full_bridge_building_flow(self):
        """Should appreciate significantly with full bridge-building"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Document perspectives
        bond.add_perspective("alice", "Progressive", "View A")
        bond.add_perspective("bob", "Conservative", "View B")

        # Verify understanding (both sides)
        bond.verify_understanding("a_v1", "a")
        bond.verify_understanding("a_v2", "a")
        bond.verify_understanding("b_v1", "b")
        bond.verify_understanding("b_v2", "b")
        # understanding_quality = 1.5

        # Find common ground with respectful disagreement
        bond.set_common_ground(
            "Climate",
            "Clean environment",
            "Regen ag works",
            "Disagree on federal role",
            "Farm demo"
        )
        # diversity_preserved = 1.5

        # Complete project
        bond.add_collaborative_action("Farm Demo", "Desc", datetime.now(), "Impact")
        bond.complete_action("Farm Demo", ["v1", "v2"])
        # action_taken = 1.0

        # 2 years later
        bond.created_at = datetime.now() - timedelta(days=735)
        # time_sustained = 3.0

        # Inspired 3 bridges
        for i in range(3):
            bond.add_ripple_effect(f"bridge_{i}", DivideType.POLITICAL)
        # ripple_multiplier ≈ 2.6

        appreciation = bond.calculate_appreciation()
        # 2000 * 1.5 * 1.5 * 1.0 * 3.0 * 2.6 ≈ 35,100
        assert appreciation > 20000  # Adjusted for actual calculation
        assert appreciation < 40000

    def test_50_50_payout_split(self):
        """Should split payout 50/50 between both parties"""
        bond = create_common_ground_bond(
            "test", "alice", "bob", DivideType.POLITICAL, 1000, 1000
        )

        # Minimal setup for non-zero appreciation
        bond.add_perspective("alice", "Prog", "View")
        bond.add_perspective("bob", "Cons", "View")
        bond.verify_understanding("v1", "a")
        bond.verify_understanding("v2", "b")

        appreciation = bond.calculate_appreciation()
        payout_a = bond.person_a_payout()
        payout_b = bond.person_b_payout()

        assert abs(payout_a - appreciation * 0.5) < 0.01
        assert abs(payout_b - appreciation * 0.5) < 0.01
        assert abs(payout_a - payout_b) < 0.01  # Equal

    def test_real_world_scenario(self):
        """Test realistic bridge-building scenario"""
        # Conservative farmer + Progressive environmentalist
        bond = create_common_ground_bond(
            "bridge_rural_urban",
            "farmer_bob",
            "environmentalist_alice",
            DivideType.GEOGRAPHIC,
            1000.0,
            1000.0
        )

        # Phase 1: Document perspectives
        bond.add_perspective(
            "farmer_bob",
            "Conservative rural farmer",
            "Values property rights, distrusts government, local autonomy"
        )
        bond.add_perspective(
            "environmentalist_alice",
            "Progressive urban environmentalist",
            "Values collective action, climate urgency, regulation"
        )

        # Phase 2: Verify understanding (2 verifiers each)
        bond.verify_understanding("rural_neighbor", "a")
        bond.verify_understanding("farmer_association", "a")
        bond.verify_understanding("environmental_org", "b")
        bond.verify_understanding("urban_friend", "b")

        # Phase 3: Find common ground
        bond.set_common_ground(
            topic="Clean water and healthy soil",
            shared_value="Thriving local communities",
            agreement_desc="Regenerative agriculture benefits both environment and farm economics",
            disagreements="Federal regulation vs local control - still disagree",
            project="10-acre regenerative farming demonstration"
        )

        # Phase 4: Complete project
        bond.add_collaborative_action(
            "Regen Farm Demo",
            "10 acres regenerative practices, soil health measurement",
            datetime.now() - timedelta(days=365),
            "Soil carbon +15%, water retention improved, income stable"
        )
        bond.complete_action("Regen Farm Demo", ["soil_scientist", "local_coop"])

        # Phase 5: 2 years sustained
        bond.created_at = datetime.now() - timedelta(days=735)

        # Phase 6: Ripple - inspired 3 more rural/urban bridges
        bond.add_ripple_effect("bridge_002", DivideType.GEOGRAPHIC)
        bond.add_ripple_effect("bridge_003", DivideType.POLITICAL)
        bond.add_ripple_effect("bridge_004", DivideType.ECONOMIC)

        # Calculate
        appreciation = bond.calculate_appreciation()
        roi = (appreciation / bond.total_stake() - 1) * 100

        # Should have significant appreciation
        assert appreciation > bond.total_stake() * 10  # At least 10x
        assert roi > 900  # Over 900% ROI

        # Check individual factors
        assert bond.understanding_quality() == 1.5  # 2 verifiers each
        assert bond.diversity_preserved() == 1.5  # Maintained + disagreements
        assert bond.action_taken() == 1.0  # 1 completed project
        assert bond.time_sustained() == 3.0  # 2 years
        assert 2.0 < bond.ripple_multiplier() < 3.0  # 3 inspired bridges


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
