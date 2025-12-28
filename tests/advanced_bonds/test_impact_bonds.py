"""
Tests for Impact Bonds - Real-World Impact Stake Mechanism

These tests prove that:
1. Staking in positive impact is economically rational
2. Verified impact = profit for stakers
3. Harder impacts get higher multipliers
4. Negative impact penalizes everyone (incentivizes responsible impact)
"""

import pytest
from datetime import datetime, timedelta

from vaultfire.advanced_bonds import (
    ImpactBond,
    ImpactCommitment,
    ImpactBondsEngine,
    ImpactCategory,
    ImpactMetric,
    VerificationMethod,
)


class TestImpactCommitments:
    """Test creating and tracking impact commitments"""

    def test_create_impact_commitment(self):
        """Someone can commit to measurable impact"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="ocean_cleaner",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.PLASTIC_REMOVED_KG,
            target_amount=10000.0,  # 10,000 kg of plastic
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA,
            description="Remove 10 tons of ocean plastic"
        )

        assert commitment.creator_id == "ocean_cleaner"
        assert commitment.metric == ImpactMetric.PLASTIC_REMOVED_KG
        assert commitment.target_amount == 10000.0
        assert commitment.verified_impact == 0.0

    def test_impact_difficulty_multipliers(self):
        """Harder impacts get higher multipliers"""
        deadline = datetime.now() + timedelta(days=365)

        # Easy impact (teaching)
        easy = ImpactCommitment(
            commitment_id="easy",
            creator_id="teacher",
            category=ImpactCategory.EDUCATION,
            metric=ImpactMetric.STUDENTS_TAUGHT,
            target_amount=100.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.ATTESTATION
        )
        assert easy.impact_difficulty_multiplier() == 1.2

        # Medium impact (environmental)
        medium = ImpactCommitment(
            commitment_id="medium",
            creator_id="planter",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA
        )
        assert medium.impact_difficulty_multiplier() == 1.5

        # Hard impact (systemic change)
        hard = ImpactCommitment(
            commitment_id="hard",
            creator_id="climate_activist",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.CO2_OFFSET_TONS,
            target_amount=500.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.THIRD_PARTY_AUDIT
        )
        assert hard.impact_difficulty_multiplier() == 2.0

        # Extreme impact (life-saving)
        extreme = ImpactCommitment(
            commitment_id="extreme",
            creator_id="doctor",
            category=ImpactCategory.HEALTH,
            metric=ImpactMetric.LIVES_SAVED,
            target_amount=100.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.THIRD_PARTY_AUDIT
        )
        assert extreme.impact_difficulty_multiplier() == 3.0


class TestCommunityStaking:
    """Test staking in impact commitments"""

    def test_stake_in_impact(self):
        """Community can stake in impact commitments"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=180)

        commitment = engine.create_impact_commitment(
            creator_id="ocean_cleanup",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.OCEAN_CLEANED_M2,
            target_amount=50000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA
        )

        # Staker believes in the mission
        bond = engine.stake_in_impact(
            staker_id="environmentalist",
            commitment_id=commitment.commitment_id,
            stake_amount=1000.0
        )

        assert bond.staker_id == "environmentalist"
        assert bond.impact_creator_id == "ocean_cleanup"
        assert bond.initial_stake == 1000.0
        assert bond.current_value == 1000.0

    def test_verified_impact_appreciation(self):
        """When impact is verified, stakers profit"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="tree_planter",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA
        )

        # Community stakes
        bond1 = engine.stake_in_impact("staker1", commitment.commitment_id, 500.0)
        bond2 = engine.stake_in_impact("staker2", commitment.commitment_id, 300.0)

        initial_value1 = bond1.current_value
        initial_value2 = bond2.current_value

        # Record and verify 500 trees planted (50% progress)
        commitment.record_impact(500.0, "GPS coordinates of trees")

        result = engine.verify_impact(
            commitment_id=commitment.commitment_id,
            verified_amount=500.0,
            verifier_id="third_party_auditor",
            proof="Satellite imagery confirms 500 trees"
        )

        # All stakers should profit
        assert result["stakers_paid"] == 2
        assert result["total_appreciation"] > 0
        assert result["progress"] == 50.0

        # Bonds appreciated
        assert bond1.current_value > initial_value1
        assert bond2.current_value > initial_value2

    def test_multiple_verification_rounds(self):
        """Impact can be verified in multiple rounds"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="plastic_remover",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.PLASTIC_REMOVED_KG,
            target_amount=10000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.THIRD_PARTY_AUDIT
        )

        bond = engine.stake_in_impact("staker", commitment.commitment_id, 1000.0)

        # Month 1: 2000 kg verified
        commitment.record_impact(2000.0)
        result1 = engine.verify_impact(commitment.commitment_id, 2000.0, "auditor")
        value_after_month1 = bond.current_value

        # Month 2: 3000 more kg verified (5000 total)
        commitment.record_impact(3000.0)
        result2 = engine.verify_impact(commitment.commitment_id, 5000.0, "auditor")
        value_after_month2 = bond.current_value

        # Value should keep appreciating
        assert value_after_month2 > value_after_month1 > bond.initial_stake


class TestImpactMultipliers:
    """Test impact difficulty and time multipliers"""

    def test_time_multiplier_compounds(self):
        """Sustained impact compounds value over time"""
        deadline = datetime.now() + timedelta(days=730)

        # New commitment
        commitment_new = ImpactCommitment(
            commitment_id="new",
            creator_id="creator",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA,
            created_at=datetime.now()
        )
        assert commitment_new.time_multiplier() == 1.0

        # 1-year old commitment
        commitment_old = ImpactCommitment(
            commitment_id="old",
            creator_id="creator",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA,
            created_at=datetime.now() - timedelta(days=365)
        )
        assert commitment_old.time_multiplier() == 1.5

        # 2+ year old commitment
        commitment_sustained = ImpactCommitment(
            commitment_id="sustained",
            creator_id="creator",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA,
            created_at=datetime.now() - timedelta(days=800)
        )
        assert commitment_sustained.time_multiplier() == 2.0

    def test_achievement_bonus(self):
        """Exceeding target gives bonus"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="overachiever",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.CO2_OFFSET_TONS,
            target_amount=100.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.ORACLE
        )

        bond = engine.stake_in_impact("staker", commitment.commitment_id, 1000.0)

        # Achieve 200% of target (100 tons → 200 tons)
        commitment.record_impact(200.0)
        engine.verify_impact(commitment.commitment_id, 200.0, "oracle")

        # Should get achievement bonus
        bonus = bond.achievement_bonus()
        assert bonus > 0
        assert commitment.progress_percentage() == 200.0


class TestNegativeImpact:
    """Test negative impact penalties"""

    def test_negative_impact_penalty(self):
        """Causing harm penalizes all stakers"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="ocean_cleanup",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.OCEAN_CLEANED_M2,
            target_amount=10000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA
        )

        # Community stakes
        bond1 = engine.stake_in_impact("staker1", commitment.commitment_id, 1000.0)
        bond2 = engine.stake_in_impact("staker2", commitment.commitment_id, 500.0)

        # Build up some value first
        commitment.record_impact(5000.0)
        engine.verify_impact(commitment.commitment_id, 5000.0, "auditor")

        values_before = {
            "bond1": bond1.current_value,
            "bond2": bond2.current_value
        }

        # Negative impact discovered (cleanup harmed wildlife)
        result = engine.handle_negative_impact(
            commitment_id=commitment.commitment_id,
            severity=0.3,  # 30% severity
            description="Cleanup methods harmed marine life"
        )

        # All stakers should lose value
        assert result["total_penalties"] > 0
        assert result["stakers_affected"] == 2

        assert bond1.current_value < values_before["bond1"]
        assert bond2.current_value < values_before["bond2"]


class TestEconomicIncentives:
    """Test that Impact Bonds create correct economic incentives"""

    def test_solving_problems_profitable(self):
        """Creating positive impact becomes economically rational"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="climate_hero",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.CO2_OFFSET_TONS,
            target_amount=1000.0,  # 1000 tons CO2
            target_deadline=deadline,
            verification_method=VerificationMethod.ORACLE
        )

        # 100 people stake in the mission
        for i in range(100):
            engine.stake_in_impact(f"believer_{i}", commitment.commitment_id, 50.0)

        # Creator achieves impact over time
        milestones = [200, 500, 800, 1000]  # Progressive verification

        for milestone in milestones:
            commitment.record_impact(milestone)
            result = engine.verify_impact(
                commitment_id=commitment.commitment_id,
                verified_amount=float(milestone),
                verifier_id="climate_oracle"
            )

            # All 100 stakers profit
            assert result["stakers_paid"] == 100

        # Final verification shows everyone profited
        stats = engine.get_impact_stats("climate_hero")
        assert stats["community_confidence"] > 1.0  # Value > initial stake

    def test_responsible_impact_incentivized(self):
        """Negative impact penalties incentivize responsible methods"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        # Scenario 1: Irresponsible impact
        bad_commitment = engine.create_impact_commitment(
            creator_id="bad_actor",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.TREES_PLANTED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.THIRD_PARTY_AUDIT
        )

        bad_bond = engine.stake_in_impact("staker", bad_commitment.commitment_id, 1000.0)

        # They plant invasive species (negative impact)
        bad_commitment.record_impact(1000.0)
        engine.verify_impact(bad_commitment.commitment_id, 1000.0, "auditor")

        value_before_penalty = bad_bond.current_value

        # Negative impact discovered
        engine.handle_negative_impact(
            bad_commitment.commitment_id,
            severity=0.8,  # Severe negative impact
            description="Planted invasive species"
        )

        # Massive loss
        assert bad_bond.current_value < value_before_penalty * 0.3

        # This teaches: Do impact responsibly or lose money


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_ocean_cleanup_project(self):
        """Ocean cleanup project with staged verification"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=730)  # 2 years

        commitment = engine.create_impact_commitment(
            creator_id="ocean_cleanup_initiative",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.PLASTIC_REMOVED_KG,
            target_amount=100000.0,  # 100 tons
            target_deadline=deadline,
            verification_method=VerificationMethod.SENSOR_DATA
        )

        # 500 environmentalists stake
        for i in range(500):
            engine.stake_in_impact(f"environmentalist_{i}", commitment.commitment_id, 100.0)

        # Quarterly verification for 2 years
        quarterly_targets = [10000, 25000, 40000, 60000, 80000, 95000, 100000]

        for target in quarterly_targets:
            commitment.record_impact(target)
            engine.verify_impact(commitment.commitment_id, float(target), "sensor_network")

        stats = engine.get_impact_stats("ocean_cleanup_initiative")

        assert stats["total_stakers"] == 500
        assert stats["total_verified_impact"] == 100000.0
        assert stats["average_progress"] == 100.0

    def test_education_initiative(self):
        """Teaching students at scale"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="online_educator",
            category=ImpactCategory.EDUCATION,
            metric=ImpactMetric.STUDENTS_TAUGHT,
            target_amount=10000.0,  # 10k students
            target_deadline=deadline,
            verification_method=VerificationMethod.ATTESTATION
        )

        # 50 believers in education
        for i in range(50):
            engine.stake_in_impact(f"education_believer_{i}", commitment.commitment_id, 200.0)

        # Teach 12k students (120% of target)
        commitment.record_impact(12000.0)
        engine.verify_impact(commitment.commitment_id, 12000.0, "education_dao")

        stats = engine.get_impact_stats("online_educator")

        # All stakers should profit from exceeded target
        assert stats["community_confidence"] > 1.0
        assert stats["total_verified_impact"] == 12000.0

    def test_carbon_offset_program(self):
        """Carbon offset with high difficulty multiplier"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=1825)  # 5 years

        commitment = engine.create_impact_commitment(
            creator_id="carbon_offset_dao",
            category=ImpactCategory.ENVIRONMENTAL,
            metric=ImpactMetric.CO2_OFFSET_TONS,
            target_amount=50000.0,  # 50k tons CO2
            target_deadline=deadline,
            verification_method=VerificationMethod.ORACLE
        )

        # This is hard impact (2.0x multiplier)
        assert commitment.impact_difficulty_multiplier() == 2.0

        # 1000 climate activists stake
        for i in range(1000):
            engine.stake_in_impact(f"climate_activist_{i}", commitment.commitment_id, 50.0)

        # Verify 25k tons (50% progress)
        commitment.record_impact(25000.0)
        result = engine.verify_impact(commitment.commitment_id, 25000.0, "climate_oracle")

        # All 1000 stakers profit from hard impact
        assert result["stakers_paid"] == 1000
        assert result["total_appreciation"] > 0

    def test_lives_saved_extreme_multiplier(self):
        """Life-saving impact gets highest multiplier"""
        engine = ImpactBondsEngine()

        deadline = datetime.now() + timedelta(days=365)

        commitment = engine.create_impact_commitment(
            creator_id="medical_mission",
            category=ImpactCategory.HEALTH,
            metric=ImpactMetric.LIVES_SAVED,
            target_amount=1000.0,
            target_deadline=deadline,
            verification_method=VerificationMethod.THIRD_PARTY_AUDIT
        )

        # Extreme difficulty (3.0x multiplier)
        assert commitment.impact_difficulty_multiplier() == 3.0

        # Stake in life-saving work
        bond = engine.stake_in_impact("humanitarian", commitment.commitment_id, 10000.0)

        # 500 lives saved (50% progress)
        commitment.record_impact(500.0)
        engine.verify_impact(commitment.commitment_id, 500.0, "who_auditor")

        # High multiplier means significant appreciation
        assert bond.current_value > bond.initial_stake
