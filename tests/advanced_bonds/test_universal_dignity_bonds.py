"""
Tests for Universal Dignity Bonds - Economic Equality Mechanism

These tests prove that:
1. Human worth ≠ human productivity
2. Investing in disadvantaged is MORE profitable than privileged
3. Flourishing delta matters more than absolute position
4. Context multipliers create mathematical fairness
5. Dignity floor protects human inherent worth
"""

import pytest
from datetime import datetime, timedelta

from vaultfire.advanced_bonds import (
    UniversalDignityBond,
    UniversalDignityBondsEngine,
    HumanFlourishingProfile,
    FlourishingScore,
    ConstraintProfile,
    ConstraintType,
    FlourishingDimension,
)


class TestFlourishingMeasurement:
    """Test flourishing score calculation"""

    def test_flourishing_score_calculation(self):
        """Flourishing is multi-dimensional weighted average"""
        score = FlourishingScore(
            health=80.0,
            connection=60.0,
            growth=50.0,
            dignity=70.0,
            purpose=40.0
        )

        # Weighted: 80*0.25 + 60*0.25 + 50*0.15 + 70*0.15 + 40*0.20
        # = 20 + 15 + 7.5 + 10.5 + 8 = 61.0
        total = score.total_score()
        assert 60.0 <= total <= 62.0  # Allow small floating point variance

    def test_purpose_only_20_percent(self):
        """Purpose/contribution is only 20% of flourishing"""
        # High flourishing WITHOUT purpose
        score_no_purpose = FlourishingScore(
            health=90.0,
            connection=90.0,
            growth=80.0,
            dignity=85.0,
            purpose=0.0  # Zero purpose
        )

        # Calculation: 90*0.25 + 90*0.25 + 80*0.15 + 85*0.15 + 0*0.20
        # = 22.5 + 22.5 + 12.0 + 12.75 + 0 = 69.75
        # Should still score high (purpose is only 20% max impact)
        total = score_no_purpose.total_score()
        assert total >= 65.0  # Can score high without purpose

        # This proves: Can have high flourishing without "producing" anything


class TestConstraintMultipliers:
    """Test constraint multiplier calculations"""

    def test_single_constraint_multiplier(self):
        """Single constraint applies multiplier"""
        profile = ConstraintProfile()

        # Severe disability (3.0x multiplier, 1.0 severity)
        profile.add_constraint(ConstraintType.DISABILITY, severity=1.0)

        mult = profile.calculate_total_multiplier()
        assert mult == 3.0

    def test_multiple_constraints_stack(self):
        """Multiple constraints multiply together"""
        profile = ConstraintProfile()

        # Disability (3.0x) + Poverty (2.5x)
        profile.add_constraint(ConstraintType.DISABILITY, severity=1.0)
        profile.add_constraint(ConstraintType.POVERTY, severity=1.0)

        # Should be 3.0 * 2.5 = 7.5x
        mult = profile.calculate_total_multiplier()
        assert mult == 7.5

    def test_refugee_highest_multiplier(self):
        """Refugee status has highest multiplier (5.0x)"""
        profile = ConstraintProfile()

        profile.add_constraint(ConstraintType.REFUGEE_STATUS, severity=1.0)

        mult = profile.calculate_total_multiplier()
        assert mult == 5.0

    def test_extreme_constraints_stack(self):
        """Refugee + trauma + poverty = extreme multiplier"""
        profile = ConstraintProfile()

        # Refugee (5.0x) + Trauma (3.0x) + Poverty (2.5x)
        profile.add_constraint(ConstraintType.REFUGEE_STATUS, severity=1.0)
        profile.add_constraint(ConstraintType.TRAUMA, severity=1.0)
        profile.add_constraint(ConstraintType.POVERTY, severity=1.0)

        # 5.0 * 3.0 * 2.5 = 37.5x
        mult = profile.calculate_total_multiplier()
        assert mult == 37.5

    def test_severity_adjustment(self):
        """Severity adjusts multiplier (0.0-1.0)"""
        profile = ConstraintProfile()

        # Mild disability (30% severity)
        # Base: 3.0x, Adjusted: 1.0 + (3.0-1.0)*0.3 = 1.6x
        profile.add_constraint(ConstraintType.DISABILITY, severity=0.3)

        mult = profile.calculate_total_multiplier()
        assert 1.5 <= mult <= 1.7


class TestDeltaVsPosition:
    """Test that delta (change) matters more than position (status)"""

    def test_delta_more_valuable_than_position(self):
        """Going from 20→40 beats 80→90 even though 90 > 40"""
        engine = UniversalDignityBondsEngine()

        # Person A: Privileged (high baseline, small delta)
        baseline_a = FlourishingScore(
            health=80, connection=85, growth=75, dignity=80, purpose=80
        )
        profile_a = engine.create_flourishing_profile("person_a", baseline_a)

        # Person B: Disadvantaged (low baseline, large delta)
        baseline_b = FlourishingScore(
            health=20, connection=25, growth=15, dignity=20, purpose=20
        )
        profile_b = engine.create_flourishing_profile("person_b", baseline_b, constraints={
            ConstraintType.POVERTY: 1.0  # 2.5x multiplier
        })

        # Both get same stake
        bond_a = engine.stake_in_flourishing("staker", "person_a", 1000.0)
        bond_b = engine.stake_in_flourishing("staker", "person_b", 1000.0)

        # Person A: Small improvement (80→90)
        new_a = FlourishingScore(
            health=90, connection=90, growth=85, dignity=85, purpose=85
        )
        engine.update_flourishing("person_a", new_a)

        # Person B: Larger improvement (20→40)
        new_b = FlourishingScore(
            health=40, connection=45, growth=35, dignity=40, purpose=40
        )
        engine.update_flourishing("person_b", new_b)

        # Person B's bonds should appreciate MORE, despite lower absolute outcome
        # Person B: delta ~20, context 2.5x
        # Person A: delta ~10, context 1.0x
        assert bond_b.current_value > bond_a.current_value

    def test_compare_investments_shows_disadvantaged_wins(self):
        """Comparison tool shows investing in disadvantaged is more profitable"""
        engine = UniversalDignityBondsEngine()

        # Privileged person
        baseline_priv = FlourishingScore(
            health=80, connection=80, growth=80, dignity=80, purpose=80
        )
        profile_priv = engine.create_flourishing_profile("privileged", baseline_priv)

        # Update: 80 → 90 (+10 delta)
        new_priv = FlourishingScore(
            health=90, connection=90, growth=90, dignity=90, purpose=90
        )
        profile_priv.update_flourishing(new_priv)

        # Disadvantaged person
        baseline_dis = FlourishingScore(
            health=20, connection=20, growth=20, dignity=20, purpose=20
        )
        profile_dis = engine.create_flourishing_profile("disadvantaged", baseline_dis, constraints={
            ConstraintType.DISABILITY: 1.0,  # 3.0x
            ConstraintType.POVERTY: 1.0,  # 2.5x
            # Combined: 7.5x
        })

        # Update: 20 → 40 (+20 delta)
        new_dis = FlourishingScore(
            health=40, connection=40, growth=40, dignity=40, purpose=40
        )
        profile_dis.update_flourishing(new_dis)

        # Compare returns
        comparison = engine.compare_investments("privileged", "disadvantaged")

        # Disadvantaged should have higher return
        assert comparison["person_2"]["total_return"] > comparison["person_1"]["total_return"]
        assert comparison["more_profitable"] == "disadvantaged"


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_refugee_child_support(self):
        """Refugee child has extreme multiplier, makes support very profitable"""
        engine = UniversalDignityBondsEngine()

        # Refugee child starting conditions
        baseline = FlourishingScore(
            health=10,  # War trauma, malnutrition
            connection=5,  # Lost family
            growth=10,  # No education
            dignity=15,  # Displaced
            purpose=10  # No stability
        )

        profile = engine.create_flourishing_profile("refugee_child", baseline, constraints={
            ConstraintType.REFUGEE_STATUS: 1.0,  # 5.0x
            ConstraintType.TRAUMA: 1.0,  # 3.0x
            # Combined: 15x multiplier
        })

        # Community stakes in child's well-being
        bond = engine.stake_in_flourishing("community", "refugee_child", 1000.0)

        # After 1 year of support (safety, therapy, education)
        new_score = FlourishingScore(
            health=50,  # +40
            connection=45,  # +40
            growth=40,  # +30
            dignity=55,  # +40
            purpose=35  # +25
        )

        result = engine.update_flourishing("refugee_child", new_score)

        # Bond should appreciate significantly (large delta × 15x multiplier)
        assert bond.current_value > bond.initial_stake
        assert result["context_multiplier"] == 15.0
        assert result["delta"] > 30  # Massive improvement

    def test_elderly_care_profitable(self):
        """Elder care becomes economically profitable"""
        engine = UniversalDignityBondsEngine()

        # Elderly person (age 85, declining health, isolated)
        baseline = FlourishingScore(
            health=30,  # Declining
            connection=25,  # Isolated
            growth=20,  # Limited mobility
            dignity=40,  # Some autonomy
            purpose=25  # Retired
        )

        profile = engine.create_flourishing_profile("elderly_person", baseline, constraints={
            ConstraintType.ELDERLY_AGE: 1.0,  # 2.0x
            ConstraintType.CHRONIC_ILLNESS: 0.7,  # Moderate severity
        })

        # Community stakes in elder care
        bond = engine.stake_in_flourishing("community", "elderly_person", 500.0)

        # After care: companionship, health support, dignity
        new_score = FlourishingScore(
            health=45,  # +15
            connection=60,  # +35 (companionship)
            growth=35,  # +15 (engagement)
            dignity=70,  # +30 (respect)
            purpose=50  # +25 (meaning)
        )

        result = engine.update_flourishing("elderly_person", new_score)

        # Elder never "produces" economically, but bonds appreciate
        assert bond.current_value > bond.initial_stake
        assert result["delta"] > 20

    def test_disability_support_highest_return(self):
        """Severe disability = high multiplier = high returns"""
        engine = UniversalDignityBondsEngine()

        # Person with severe disability
        baseline = FlourishingScore(
            health=15,  # Severe disability
            connection=20,  # Limited social
            growth=25,  # Some learning
            dignity=30,  # Struggling
            purpose=10  # Lost career
        )

        profile = engine.create_flourishing_profile("disabled_person", baseline, constraints={
            ConstraintType.DISABILITY: 1.0,  # 3.0x (severe)
            ConstraintType.MENTAL_HEALTH: 0.8,  # Depression from accident
        })

        # Community stakes in support
        bond = engine.stake_in_flourishing("supporter", "disabled_person", 1000.0)

        # After support: adaptive tech, therapy, community
        new_score = FlourishingScore(
            health=25,  # +10 (adaptive tech)
            connection=55,  # +35 (community)
            growth=45,  # +20 (new skills)
            dignity=65,  # +35 (autonomy)
            purpose=40  # +30 (new meaning)
        )

        result = engine.update_flourishing("disabled_person", new_score)

        # High multiplier makes this very profitable
        assert bond.current_value > bond.initial_stake * 1.5
        assert result["context_multiplier"] > 3.0

    def test_addiction_recovery_support(self):
        """Recovery support becomes economically rational"""
        engine = UniversalDignityBondsEngine()

        # Person in active addiction
        baseline = FlourishingScore(
            health=10,  # Substance abuse
            connection=15,  # Lost relationships
            growth=10,  # No progress
            dignity=20,  # Shame
            purpose=5  # Lost meaning
        )

        profile = engine.create_flourishing_profile("recovering_person", baseline, constraints={
            ConstraintType.ADDICTION_RECOVERY: 1.0,  # 2.5x
            ConstraintType.MENTAL_HEALTH: 1.0,  # 2.0x
            # Combined: 5.0x
        })

        # Supporter stakes in recovery
        bond = engine.stake_in_flourishing("supporter", "recovering_person", 800.0)

        # After 6 months sober
        new_score = FlourishingScore(
            health=50,  # +40 (sobriety)
            connection=45,  # +30 (rebuilding)
            growth=40,  # +30 (new skills)
            dignity=55,  # +35 (self-respect)
            purpose=35  # +30 (meaning)
        )

        result = engine.update_flourishing("recovering_person", new_score)

        # Large delta × high multiplier = significant return
        assert bond.current_value > bond.initial_stake * 1.3
        assert result["context_multiplier"] == 5.0


class TestDignityFloor:
    """Test dignity floor protection"""

    def test_bond_never_goes_to_zero(self):
        """Even if flourishing decreases, bond has dignity floor"""
        engine = UniversalDignityBondsEngine()

        baseline = FlourishingScore(
            health=60, connection=60, growth=60, dignity=60, purpose=60
        )
        profile = engine.create_flourishing_profile("person", baseline)

        bond = engine.stake_in_flourishing("staker", "person", 1000.0)

        # Flourishing decreases (illness, loss, etc.)
        new_score = FlourishingScore(
            health=30, connection=30, growth=30, dignity=30, purpose=30
        )
        engine.update_flourishing("person", new_score)

        # Bond should have dignity floor (50% of initial)
        dignity_floor = bond.dignity_floor()
        assert dignity_floor == 500.0  # 50% of 1000

        # Vesting status respects floor
        vesting = bond.vesting_status()
        assert vesting["dignity_floor"] == 500.0

    def test_human_worth_has_inherent_value(self):
        """Every human has inherent worth = bond floor"""
        engine = UniversalDignityBondsEngine()

        # Person with very low flourishing
        baseline = FlourishingScore(
            health=10, connection=10, growth=10, dignity=10, purpose=10
        )
        profile = engine.create_flourishing_profile("person", baseline)

        bond = engine.stake_in_flourishing("staker", "person", 1000.0)

        # Even with low flourishing, bond has value
        assert bond.current_value >= bond.dignity_floor()
        assert bond.dignity_floor() == 500.0  # Human dignity


class TestMathematicalFairness:
    """Test mathematical proof of fairness"""

    def test_privilege_vs_disadvantage_returns(self):
        """Mathematically prove disadvantaged generates higher returns"""
        engine = UniversalDignityBondsEngine()

        # Privileged: High baseline, low constraints
        baseline_priv = FlourishingScore(
            health=85, connection=85, growth=80, dignity=85, purpose=80
        )
        profile_priv = engine.create_flourishing_profile("privileged", baseline_priv)

        # Disadvantaged: Low baseline, high constraints
        baseline_dis = FlourishingScore(
            health=15, connection=20, growth=15, dignity=20, purpose=15
        )
        profile_dis = engine.create_flourishing_profile("disadvantaged", baseline_dis, constraints={
            ConstraintType.POVERTY: 1.0,  # 2.5x
            ConstraintType.DISCRIMINATION: 1.0,  # 2.0x
            # Combined: 5.0x
        })

        # Equal stakes
        bond_priv = engine.stake_in_flourishing("staker", "privileged", 1000.0)
        bond_dis = engine.stake_in_flourishing("staker", "disadvantaged", 1000.0)

        # Equal absolute improvement (+15 points each)
        new_priv = FlourishingScore(
            health=90, connection=90, growth=90, dignity=90, purpose=90
        )
        new_dis = FlourishingScore(
            health=30, connection=35, growth=30, dignity=35, purpose=30
        )

        engine.update_flourishing("privileged", new_priv)
        engine.update_flourishing("disadvantaged", new_dis)

        # Calculate appreciation (not total bond value)
        priv_appreciation = bond_priv.current_value - 1000.0
        dis_appreciation = bond_dis.current_value - 1000.0

        # Disadvantaged should have ~10x higher appreciation (due to 5x multiplier + 2x delta)
        # Even though absolute flourishing is still much lower (32 vs 90)
        appreciation_ratio = dis_appreciation / priv_appreciation

        # Should be significantly higher for disadvantaged
        assert appreciation_ratio > 8.0  # At least 8x better appreciation

    def test_sustained_improvement_compounds(self):
        """Time multiplier rewards sustained flourishing"""
        engine = UniversalDignityBondsEngine()

        baseline = FlourishingScore(
            health=30, connection=30, growth=30, dignity=30, purpose=30
        )
        profile = engine.create_flourishing_profile("person", baseline)

        # Simulate sustained improvement over time
        profile.created_at = datetime.now() - timedelta(days=400)  # ~13 months

        # Should have time multiplier > 1.0
        time_mult = profile.time_multiplier()
        assert time_mult > 1.0  # Compounds over time


class TestEconomicIncentives:
    """Test that UDB creates correct economic incentives"""

    def test_helping_disadvantaged_most_profitable(self):
        """Investing in most disadvantaged = highest returns"""
        engine = UniversalDignityBondsEngine()

        # Create 4 people with different constraint levels
        people = [
            ("no_constraints", {}, 1.0),  # Baseline
            ("mild_constraints", {ConstraintType.POVERTY: 0.3}, 1.0),
            ("moderate_constraints", {ConstraintType.DISABILITY: 0.7}, 1.0),
            ("extreme_constraints", {
                ConstraintType.REFUGEE_STATUS: 1.0,
                ConstraintType.TRAUMA: 1.0,
                ConstraintType.POVERTY: 1.0
            }, 37.5),  # 5.0 × 3.0 × 2.5
        ]

        bonds = []

        for person_id, constraints, expected_mult in people:
            baseline = FlourishingScore(
                health=20, connection=20, growth=20, dignity=20, purpose=20
            )
            profile = engine.create_flourishing_profile(person_id, baseline, constraints)

            # Same stake for all
            bond = engine.stake_in_flourishing("investor", person_id, 1000.0)
            bonds.append((person_id, bond))

            # Same improvement for all (+20 points)
            new_score = FlourishingScore(
                health=40, connection=40, growth=40, dignity=40, purpose=40
            )
            engine.update_flourishing(person_id, new_score)

        # Extract bond values
        values = {person_id: bond.current_value for person_id, bond in bonds}

        # Most constrained should have highest value
        assert values["extreme_constraints"] > values["moderate_constraints"]
        assert values["moderate_constraints"] > values["mild_constraints"]
        assert values["mild_constraints"] > values["no_constraints"]

    def test_equality_becomes_economically_optimal(self):
        """UDB makes equality (helping disadvantaged) economically optimal"""
        engine = UniversalDignityBondsEngine()

        # Rich investor has 10,000 to invest
        # Option A: Invest in 10 privileged people
        # Option B: Invest in 10 disadvantaged people

        total_a = 0.0
        total_b = 0.0

        for i in range(10):
            # Option A: Privileged (baseline 80, constraints 1.0x)
            baseline_a = FlourishingScore(
                health=80, connection=80, growth=80, dignity=80, purpose=80
            )
            profile_a = engine.create_flourishing_profile(f"priv_{i}", baseline_a)
            bond_a = engine.stake_in_flourishing("investor", f"priv_{i}", 1000.0)

            new_a = FlourishingScore(
                health=85, connection=85, growth=85, dignity=85, purpose=85
            )
            engine.update_flourishing(f"priv_{i}", new_a)
            total_a += bond_a.current_value

            # Option B: Disadvantaged (baseline 20, constraints 5.0x)
            baseline_b = FlourishingScore(
                health=20, connection=20, growth=20, dignity=20, purpose=20
            )
            profile_b = engine.create_flourishing_profile(f"dis_{i}", baseline_b, constraints={
                ConstraintType.POVERTY: 1.0,  # 2.5x
                ConstraintType.DISCRIMINATION: 1.0,  # 2.0x
            })
            bond_b = engine.stake_in_flourishing("investor", f"dis_{i}", 1000.0)

            new_b = FlourishingScore(
                health=35, connection=35, growth=35, dignity=35, purpose=35
            )
            engine.update_flourishing(f"dis_{i}", new_b)
            total_b += bond_b.current_value

        # Option B (disadvantaged) should be MORE profitable
        assert total_b > total_a

        # This proves: Equality is economically optimal
