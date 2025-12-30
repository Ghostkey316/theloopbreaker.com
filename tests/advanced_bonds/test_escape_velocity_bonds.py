"""
Tests for Escape Velocity Bonds - Breaking the Survival Trap

Validates:
- Bond creation with trap validation
- Community staking (small amounts, many people)
- Escape success measurement
- Thriving duration checkpoints
- Pay it forward mechanism
- Anti-recapture protection
- Predatory entity blocking
- Final appreciation calculation
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.escape_velocity_bonds import (
    EscapeVelocityBond,
    create_escape_velocity_bond,
    TrapType,
    EscapePhase,
    Trap,
    EscapeAttempt,
    PayItForward,
    PredatoryEntity
)


class TestBondCreation:
    """Test bond creation and validation"""

    def test_create_basic_bond(self):
        """Should create bond for escaping a poverty trap"""
        bond = create_escape_velocity_bond(
            bond_id="escape_001",
            person_id="maria",
            trap_type=TrapType.CAR_BREAKDOWN,
            trap_description="Car needs $700 repair, can't get to work without it",
            escape_amount=800.0,
            escape_plan="Fix car, keep job"
        )

        assert bond.bond_id == "escape_001"
        assert bond.person_id == "maria"
        assert bond.trap.trap_type == TrapType.CAR_BREAKDOWN
        assert bond.trap.escape_amount_needed == 800.0
        assert bond.phase == EscapePhase.TRAPPED

    def test_minimum_escape_amount(self):
        """Should enforce $500 minimum"""
        with pytest.raises(ValueError, match="Minimum escape amount"):
            create_escape_velocity_bond(
                "test",
                "person",
                TrapType.CAR_BREAKDOWN,
                "Description",
                400.0,  # Too small
                "Plan"
            )

    def test_maximum_escape_amount(self):
        """Should enforce $5000 maximum (keep it accessible)"""
        with pytest.raises(ValueError, match="Maximum escape amount"):
            create_escape_velocity_bond(
                "test",
                "person",
                TrapType.HOUSING_CRISIS,
                "Description",
                6000.0,  # Too large
                "Plan"
            )

    def test_trap_types(self):
        """Should support various trap types"""
        trap_types = [
            TrapType.CAR_BREAKDOWN,
            TrapType.PREDATORY_DEBT,
            TrapType.HOUSING_CRISIS,
            TrapType.TOOLS_EQUIPMENT,
            TrapType.SKILLS_GAP,
            TrapType.MEDICAL_EMERGENCY,
            TrapType.ABUSE_ESCAPE,
            TrapType.CHILDCARE
        ]

        for trap_type in trap_types:
            bond = create_escape_velocity_bond(
                "test",
                "person",
                trap_type,
                "Description",
                1000.0,
                "Plan"
            )
            assert bond.trap.trap_type == trap_type


class TestCommunityStaking:
    """Test community staking mechanism"""

    def test_add_staker(self):
        """Should allow community members to stake small amounts"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("neighbor_1", 100)
        bond.add_staker("coworker_1", 200)
        bond.add_staker("church_1", 150)

        assert len(bond.stakers) == 3
        assert bond.total_stake() == 450

    def test_minimum_stake(self):
        """Should enforce $50 minimum stake"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        with pytest.raises(ValueError, match="Minimum stake"):
            bond.add_staker("someone", 40)  # Too small

    def test_maximum_individual_stake(self):
        """Should enforce $500 maximum individual stake (keep it small)"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        with pytest.raises(ValueError, match="Maximum individual stake"):
            bond.add_staker("whale", 600)  # Too large - this is for little guy

    def test_many_small_stakes(self):
        """Should support many small community stakes"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 1000, "Plan"
        )

        # 10 people each stake $100
        for i in range(10):
            bond.add_staker(f"community_member_{i}", 100)

        assert len(bond.stakers) == 10
        assert bond.total_stake() == 1000


class TestEscapeSuccess:
    """Test escape success measurement"""

    def test_no_escape_initially(self):
        """Should have 0 escape success initially"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )
        assert bond.escape_success() == 0.0

    def test_funds_release(self):
        """Should release funds to person"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)
        bond.release_funds(800, "Car repair and gas")

        assert bond.phase == EscapePhase.FUNDED
        assert bond.escape_attempt is not None
        assert bond.escape_attempt.amount_received == 800

    def test_successful_escape(self):
        """Should measure escape success"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)
        bond.release_funds(800, "Car repair")

        bond.mark_escape_successful(
            verifiers=["employer", "neighbor"],
            income_after=28000,
            qol_after=6
        )

        assert bond.phase == EscapePhase.FREE
        assert bond.escape_success() > 0.0

    def test_escape_with_significant_improvement(self):
        """Should give bonus for significant improvement"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.SKILLS_GAP, "Desc", 2000, "Plan"
        )

        bond.add_staker("staker1", 500)
        bond.add_staker("staker2", 500)
        bond.add_staker("staker3", 500)
        bond.add_staker("staker4", 500)
        bond.release_funds(2000, "Certification training")

        bond.income_before = 20000
        bond.quality_of_life_before = 3

        bond.mark_escape_successful(
            verifiers=["trainer", "new_employer"],
            income_after=40000,  # Doubled income
            qol_after=8  # Much better QOL
        )

        escape = bond.escape_success()
        assert escape > 1.5  # Should have bonuses for improvement

    def test_recapture_penalty(self):
        """Should penalize if person gets recaptured"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.PREDATORY_DEBT, "Desc", 3000, "Plan"
        )

        bond.add_staker("staker1", 500)
        bond.release_funds(500, "Pay off payday loan")
        bond.mark_escape_successful(["verifier"], 25000, 5)

        # Person gets recaptured by payday lender
        bond.mark_recaptured("payday_lender_inc")

        assert bond.escape_success() == 0.2  # Severe penalty


class TestThrivingDuration:
    """Test thriving duration checkpoints"""

    def test_no_thriving_without_escape(self):
        """Should have 0 thriving without successful escape"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )
        assert bond.thriving_duration() == 0.0

    def test_thriving_checkpoints(self):
        """Should track freedom at 6mo, 1yr, 2yr checkpoints"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)
        bond.release_funds(800, "Car repair")
        bond.mark_escape_successful(["v1"], 28000, 6)

        # < 6 months
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=120)
        assert bond.thriving_duration() == 0.5

        # 6 months
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=185)
        bond.update_thriving_status(6, still_free=True)
        assert bond.thriving_duration() == 1.0
        assert bond.phase == EscapePhase.THRIVING

        # 1 year
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=370)
        bond.update_thriving_status(12, still_free=True)
        assert bond.thriving_duration() == 2.0

        # 2+ years
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=735)
        bond.update_thriving_status(24, still_free=True)
        assert bond.thriving_duration() == 3.0

    def test_recapture_penalty_on_thriving(self):
        """Should penalize thriving if recaptured"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.PREDATORY_DEBT, "Desc", 3000, "Plan"
        )

        bond.add_staker("staker", 500)
        bond.release_funds(500, "Pay debt")
        bond.mark_escape_successful(["v1"], 25000, 5)
        bond.mark_recaptured("lender")

        assert bond.thriving_duration() == 0.3  # Severe penalty


class TestPayItForward:
    """Test pay it forward mechanism (core of system)"""

    def test_no_helping_initially(self):
        """Should have 1.0 multiplier without helping others"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )
        assert bond.others_helped() == 1.0

    def test_helping_one_person(self):
        """Should reward helping one person escape"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_pay_it_forward(
            helped_person_id="coworker",
            help_type="money",
            help_amount=200,
            description="Helped fix their car too",
            their_success=True
        )

        assert bond.others_helped() == 2.0
        assert bond.phase == EscapePhase.HELPING

    def test_helping_multiple_people(self):
        """Should scale with number of people helped"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.SKILLS_GAP, "Desc", 2000, "Plan"
        )

        # Help 1 person = 2.0
        bond.add_pay_it_forward("p1", "mentoring", 0, "Training", True)
        assert bond.others_helped() == 2.0

        # Help 3 people = 4.0
        bond.add_pay_it_forward("p2", "money", 300, "Tools", True)
        bond.add_pay_it_forward("p3", "time", 0, "Job training", True)
        helped = bond.others_helped()
        assert 3.9 < helped < 4.1

        # Help 5 people = 5.6
        bond.add_pay_it_forward("p4", "skills", 0, "Mentoring", True)
        bond.add_pay_it_forward("p5", "money", 150, "Cert fees", True)
        helped = bond.others_helped()
        assert 5.5 < helped < 5.7

        # Help 10+ people = exponential effect
        for i in range(6, 12):
            bond.add_pay_it_forward(f"p{i}", "various", 0, "Help", True)
        helped = bond.others_helped()
        assert helped > 8.0  # Exponential freedom effect

    def test_only_count_successful_helps(self):
        """Should only count helps where person successfully escaped"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        # Help 3 people but only 1 succeeds
        bond.add_pay_it_forward("p1", "money", 100, "Tried to help", their_success=False)
        bond.add_pay_it_forward("p2", "money", 200, "Successfully helped", their_success=True)
        bond.add_pay_it_forward("p3", "money", 150, "Tried to help", their_success=False)

        assert bond.others_helped() == 2.0  # Only 1 successful

    def test_help_types(self):
        """Should support various help types"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.SKILLS_GAP, "Desc", 2000, "Plan"
        )

        bond.add_pay_it_forward("p1", "money", 500, "Direct financial", True)
        bond.add_pay_it_forward("p2", "time", 0, "Mentoring hours", True)
        bond.add_pay_it_forward("p3", "skills", 0, "Taught welding", True)
        bond.add_pay_it_forward("p4", "mentoring", 0, "Career guidance", True)

        assert len(bond.pay_it_forward) == 4
        helped = bond.others_helped()
        assert helped > 4.0  # 4 people helped successfully


class TestAntiRecapture:
    """Test anti-predatory recapture protection"""

    def test_no_recapture_baseline(self):
        """Should have 1.0 multiplier without recapture"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)
        bond.release_funds(800, "Car")
        bond.mark_escape_successful(["v"], 28000, 6)

        assert bond.anti_recapture() == 1.0

    def test_recapture_penalty(self):
        """Should penalize if recaptured"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.PREDATORY_DEBT, "Desc", 3000, "Plan"
        )

        bond.original_predatory_entity = "payday_lender_inc"
        bond.add_staker("staker", 500)
        bond.release_funds(500, "Pay debt")
        bond.mark_escape_successful(["v"], 25000, 5)

        # Recaptured by different entity
        bond.mark_recaptured("different_lender")
        assert bond.anti_recapture() == 0.5  # Penalty

    def test_same_entity_recapture_severe_penalty(self):
        """Should severely penalize if SAME entity recaptures"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.PREDATORY_DEBT, "Desc", 3000, "Plan"
        )

        bond.original_predatory_entity = "payday_lender_inc"
        bond.add_staker("staker", 500)
        bond.release_funds(500, "Pay debt")
        bond.mark_escape_successful(["v"], 25000, 5)

        # Recaptured by SAME lender
        bond.mark_recaptured("payday_lender_inc")
        assert bond.anti_recapture() == 0.3  # Extra severe penalty

        # Should block that entity
        assert "payday_lender_inc" in bond.predatory_entities_blocked

    def test_blocking_predatory_entities_bonus(self):
        """Should give bonus for helping block predatory entities"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.PREDATORY_DEBT, "Desc", 3000, "Plan"
        )

        bond.add_staker("staker", 500)
        bond.release_funds(500, "Pay debt")
        bond.mark_escape_successful(["v"], 25000, 5)

        # Person helps identify and block predatory lender
        bond.predatory_entities_blocked.append("payday_lender_inc")

        assert bond.anti_recapture() == 1.5  # Bonus


class TestAppreciation:
    """Test full appreciation calculation"""

    def test_no_appreciation_without_escape(self):
        """Should not appreciate without successful escape"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)

        # No escape attempt yet
        assert bond.calculate_appreciation() == 0.0

    def test_minimal_appreciation_flow(self):
        """Should appreciate with basic escape flow"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        bond.add_staker("staker1", 400)
        bond.add_staker("staker2", 400)
        bond.release_funds(800, "Car repair")
        bond.mark_escape_successful(["v"], 28000, 6)

        # Minimal: escaped but no time, no helping
        # escape_success includes verified bonus and QOL improvement
        # thriving < 6mo = 0.5
        appreciation = bond.calculate_appreciation()
        assert appreciation > 400  # Some appreciation from verified escape

    def test_full_escape_flow(self):
        """Should appreciate significantly with full flow"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 800, "Plan"
        )

        # Community stakes
        bond.add_staker("neighbor", 200)
        bond.add_staker("coworker", 200)
        bond.add_staker("church", 200)
        bond.add_staker("business", 200)
        # Total = 800

        # Escape
        bond.release_funds(800, "Car repair + gas")
        bond.income_before = 28000
        bond.quality_of_life_before = 3
        bond.mark_escape_successful(
            ["employer", "neighbor"],
            income_after=28000,  # Kept job
            qol_after=7  # Much better
        )
        # escape_success ≈ 1.3

        # 2 years later, still free
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=730)
        bond.update_thriving_status(6, True)
        bond.update_thriving_status(12, True)
        bond.update_thriving_status(24, True)
        # thriving_duration = 3.0

        # Helped 5 people escape
        for i in range(5):
            bond.add_pay_it_forward(f"p{i}", "various", 100, "Helped", True)
        # others_helped ≈ 5.6

        # No recapture
        # anti_recapture = 1.0

        appreciation = bond.calculate_appreciation()
        # 800 * 1.3 * 3.0 * 5.6 * 1.0 ≈ 17,472
        assert appreciation > 15000
        assert appreciation < 20000

    def test_staker_payout_proportional(self):
        """Should distribute payouts proportional to stake"""
        bond = create_escape_velocity_bond(
            "test", "person", TrapType.CAR_BREAKDOWN, "Desc", 1000, "Plan"
        )

        bond.add_staker("small_staker", 200)   # 20%
        bond.add_staker("medium_staker", 300)  # 30%
        bond.add_staker("large_staker", 500)   # 50%

        bond.release_funds(1000, "Escape")
        bond.mark_escape_successful(["v"], 30000, 7)

        # Simulate some time and helping
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=365)
        bond.update_thriving_status(6, True)
        bond.update_thriving_status(12, True)
        bond.add_pay_it_forward("p1", "money", 200, "Helped", True)

        total = bond.calculate_appreciation()
        small_payout = bond.staker_payout("small_staker")
        medium_payout = bond.staker_payout("medium_staker")
        large_payout = bond.staker_payout("large_staker")

        # Check proportions
        assert abs(small_payout - total * 0.2) < 0.01
        assert abs(medium_payout - total * 0.3) < 0.01
        assert abs(large_payout - total * 0.5) < 0.01

        # Check sum equals total
        assert abs(small_payout + medium_payout + large_payout - total) < 0.01

    def test_real_world_scenario_car_trap(self):
        """Test realistic car breakdown trap escape"""
        bond = create_escape_velocity_bond(
            bond_id="maria_car_escape",
            person_id="maria_single_parent",
            trap_type=TrapType.CAR_BREAKDOWN,
            trap_description="Car needs $700 repair. Without car, lose job 20 miles away, then lose apartment.",
            escape_amount=800.0,
            escape_plan="Fix car ($700) + gas for month ($100)"
        )

        bond.income_before = 28000
        bond.quality_of_life_before = 3

        # Community stakes (5 people, small amounts)
        bond.add_staker("neighbor_jose", 150)
        bond.add_staker("coworker_sarah", 200)
        bond.add_staker("church_group", 200)
        bond.add_staker("local_mechanic", 150)
        bond.add_staker("employer_advance", 100)

        # Escape
        bond.release_funds(800, "Car repair and gas money")
        bond.mark_escape_successful(
            verifiers=["employer", "neighbor_jose"],
            income_after=28000,  # Kept job
            qol_after=6  # Not stressed about losing everything
        )

        # 6 months: Still free
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=180)
        bond.update_thriving_status(6, True)

        # 1 year: Helped 2 co-workers
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=365)
        bond.update_thriving_status(12, True)
        bond.add_pay_it_forward("coworker_mike", "money", 200, "Helped fix car", True)
        bond.add_pay_it_forward("coworker_lisa", "time", 0, "Taught car maintenance", True)

        # 2 years: Helped 3 more people
        bond.escape_attempt.date_received = datetime.now() - timedelta(days=730)
        bond.update_thriving_status(24, True)
        for i in range(3):
            bond.add_pay_it_forward(f"neighbor_{i}", "various", 100, "Helped escape", True)

        # Calculate
        appreciation = bond.calculate_appreciation()
        roi = (appreciation / bond.total_stake() - 1) * 100

        # Should have good appreciation from sustained freedom + helping
        assert appreciation > bond.total_stake() * 5  # At least 5x
        assert roi > 400  # Over 400% ROI

        # Check individual payouts
        jose_payout = bond.staker_payout("neighbor_jose")
        jose_roi = (jose_payout / 150 - 1) * 100
        assert jose_roi > 400

        print(f"\nMaria's Escape:")
        print(f"  Total stake: ${bond.total_stake():.2f} from {len(bond.stakers)} people")
        print(f"  Escape success: {bond.escape_success():.2f}x")
        print(f"  Thriving duration: {bond.thriving_duration():.2f}x (2 years free)")
        print(f"  Others helped: {bond.others_helped():.2f}x (5 people)")
        print(f"  Total value: ${appreciation:.2f}")
        print(f"  Average ROI: {roi:.1f}%")
        print(f"  Jose's $150 → ${jose_payout:.2f} ({jose_roi:.1f}% ROI)")
        print(f"\n  🚀 ONE PERSON FREE. FIVE OTHERS HELPED. FREEDOM WAVE STARTED.")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
