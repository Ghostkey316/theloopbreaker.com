"""
Tests for Redemption Bonds - Community Recovery Stake Mechanism

These tests prove that:
1. Staking in someone's redemption is economically rational
2. Successful rehabilitation profits stakers
3. Abandonment penalties prevent bad bets
4. Bigger failures = bigger redemption rewards
"""

import pytest
from datetime import datetime, timedelta

from vaultfire.advanced_bonds import (
    RedemptionBond,
    RedemptionPath,
    RedemptionBondsEngine,
    FailureType,
    RedemptionMilestone,
)


class TestRedemptionPath:
    """Test redemption journey tracking"""

    def test_start_redemption_path(self):
        """Someone who failed can start redemption path"""
        engine = RedemptionBondsEngine()

        # Alice had a rug pull
        path = engine.start_redemption_path(
            redeemer_id="alice",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=80.0,  # Major failure
            failure_description="NFT project rug pull"
        )

        assert path.redeemer_id == "alice"
        assert path.failure_type == FailureType.RUG_PULL
        assert path.failure_magnitude == 80.0
        assert path.current_reputation == 0.0  # Starts at 0 after failure

    def test_milestone_achievement(self):
        """Achieving milestones increases reputation"""
        engine = RedemptionBondsEngine()

        path = engine.start_redemption_path(
            redeemer_id="bob",
            failure_type=FailureType.BROKEN_PROMISE,
            failure_magnitude=50.0
        )

        initial_reputation = path.current_reputation

        # Bob acknowledges failure publicly
        reputation_gain = path.achieve_milestone(RedemptionMilestone.ACKNOWLEDGMENT)

        assert reputation_gain > 0
        assert path.current_reputation > initial_reputation
        assert RedemptionMilestone.ACKNOWLEDGMENT in path.milestones_achieved

    def test_redemption_multiplier(self):
        """Bigger failures = bigger redemption rewards"""
        # Small failure
        path_small = RedemptionPath(
            path_id="small",
            redeemer_id="alice",
            failure_type=FailureType.REPUTATION_LOSS,
            failure_magnitude=15.0,  # Small
            failure_timestamp=datetime.now()
        )
        assert path_small.redemption_multiplier() == 1.1

        # Medium failure
        path_medium = RedemptionPath(
            path_id="medium",
            redeemer_id="bob",
            failure_type=FailureType.BROKEN_PROMISE,
            failure_magnitude=50.0,  # Medium
            failure_timestamp=datetime.now()
        )
        assert path_medium.redemption_multiplier() == 1.5

        # Major failure
        path_major = RedemptionPath(
            path_id="major",
            redeemer_id="carol",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=95.0,  # Major
            failure_timestamp=datetime.now()
        )
        assert path_major.redemption_multiplier() == 3.0


class TestCommunityStaking:
    """Test community staking in redemption"""

    def test_stake_in_redemption(self):
        """Community can stake belief in someone's redemption"""
        engine = RedemptionBondsEngine()

        # Alice starts redemption path
        path = engine.start_redemption_path(
            redeemer_id="alice",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=70.0
        )

        # Bob stakes in Alice's redemption
        bond = engine.stake_in_redemption(
            staker_id="bob",
            path_id=path.path_id,
            stake_amount=1000.0
        )

        assert bond.staker_id == "bob"
        assert bond.redeemer_id == "alice"
        assert bond.initial_stake == 1000.0
        assert bond.current_value == 1000.0

    def test_milestone_appreciation(self):
        """When redeemer hits milestone, stakers profit"""
        engine = RedemptionBondsEngine()

        path = engine.start_redemption_path(
            redeemer_id="redeemer",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=80.0  # High multiplier
        )

        # Community stakes
        bond1 = engine.stake_in_redemption("staker1", path.path_id, 1000.0)
        bond2 = engine.stake_in_redemption("staker2", path.path_id, 500.0)

        initial_value1 = bond1.current_value
        initial_value2 = bond2.current_value

        # Redeemer hits acknowledgment milestone
        result = engine.achieve_milestone(
            path_id=path.path_id,
            milestone=RedemptionMilestone.ACKNOWLEDGMENT,
            proof="Public apology posted"
        )

        # All stakers should profit
        assert result["stakers_paid"] == 2
        assert result["total_paid"] > 0

        # Bonds appreciated
        assert bond1.current_value > initial_value1
        assert bond2.current_value > initial_value2

    def test_full_redemption_journey(self):
        """Complete redemption journey from failure to success"""
        engine = RedemptionBondsEngine()

        # Alice had major rug pull
        path = engine.start_redemption_path(
            redeemer_id="alice",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=90.0
        )

        # Bob believes in Alice's redemption
        bond = engine.stake_in_redemption("bob", path.path_id, 1000.0)

        # Alice goes through redemption milestones
        milestones = [
            RedemptionMilestone.ACKNOWLEDGMENT,
            RedemptionMilestone.RESTITUTION_PLAN,
            RedemptionMilestone.PARTIAL_RESTITUTION,
            RedemptionMilestone.FULL_RESTITUTION,
            RedemptionMilestone.NEW_SUCCESS,
            RedemptionMilestone.COMPLETE_REDEMPTION,
        ]

        for milestone in milestones:
            result = engine.achieve_milestone(path.path_id, milestone)
            assert result["stakers_paid"] == 1

        # Bob's stake should have appreciated significantly
        # High failure magnitude (90) = 3.0x multiplier
        assert bond.current_value > bond.initial_stake
        assert bond.total_earnings > 0

        # Alice should be close to full redemption
        assert path.redemption_progress() > 90.0


class TestAbandonmentPenalties:
    """Test abandonment handling"""

    def test_abandonment_penalizes_stakers(self):
        """When redeemer gives up, stakers lose value"""
        engine = RedemptionBondsEngine()

        path = engine.start_redemption_path(
            redeemer_id="quitter",
            failure_type=FailureType.BROKEN_PROMISE,
            failure_magnitude=50.0
        )

        # Community stakes
        bond1 = engine.stake_in_redemption("staker1", path.path_id, 1000.0)
        bond2 = engine.stake_in_redemption("staker2", path.path_id, 500.0)

        initial_total = bond1.current_value + bond2.current_value

        # Redeemer abandons redemption journey
        result = engine.handle_abandonment(path.path_id)

        # Stakers should lose value
        assert result["total_penalties"] > 0
        assert result["stakers_affected"] == 2

        final_total = bond1.current_value + bond2.current_value
        assert final_total < initial_total

    def test_early_abandonment_worse_penalty(self):
        """Quitting early = worse penalty than quitting late"""
        # Early abandonment (within 30 days)
        bond_early = RedemptionBond(
            bond_id="early",
            staker_id="staker",
            redeemer_id="quitter_early",
            redemption_path=RedemptionPath(
                path_id="path_early",
                redeemer_id="quitter_early",
                failure_type=FailureType.BROKEN_PROMISE,
                failure_magnitude=50.0,
                failure_timestamp=datetime.now()
            ),
            initial_stake=1000.0
        )
        bond_early.created_at = datetime.now() - timedelta(days=15)
        bond_early.current_value = 1000.0

        penalty_early = bond_early.abandonment_penalty()

        # Late abandonment (after 200 days)
        bond_late = RedemptionBond(
            bond_id="late",
            staker_id="staker",
            redeemer_id="quitter_late",
            redemption_path=RedemptionPath(
                path_id="path_late",
                redeemer_id="quitter_late",
                failure_type=FailureType.BROKEN_PROMISE,
                failure_magnitude=50.0,
                failure_timestamp=datetime.now()
            ),
            initial_stake=1000.0
        )
        bond_late.created_at = datetime.now() - timedelta(days=200)
        bond_late.current_value = 1000.0

        penalty_late = bond_late.abandonment_penalty()

        # Early abandonment should have higher penalty
        assert penalty_early > penalty_late


class TestEconomicIncentives:
    """Test that Redemption Bonds create correct economic incentives"""

    def test_second_chances_profitable(self):
        """Giving second chances becomes economically rational"""
        engine = RedemptionBondsEngine()

        # Someone had major failure
        path = engine.start_redemption_path(
            redeemer_id="failed_founder",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=85.0  # Major failure
        )

        # Community takes a chance on them
        bond = engine.stake_in_redemption("community_member", path.path_id, 500.0)

        # They go through redemption successfully
        milestones = [
            RedemptionMilestone.ACKNOWLEDGMENT,
            RedemptionMilestone.RESTITUTION_PLAN,
            RedemptionMilestone.PARTIAL_RESTITUTION,
            RedemptionMilestone.FULL_RESTITUTION,
        ]

        for milestone in milestones:
            engine.achieve_milestone(path.path_id, milestone)

        # Community member should profit
        assert bond.current_value > bond.initial_stake
        assert bond.total_earnings > 0

        # This makes giving second chances economically smart

    def test_reputation_recovery(self):
        """Successful redemption restores reputation"""
        engine = RedemptionBondsEngine()

        path = engine.start_redemption_path(
            redeemer_id="recovering",
            failure_type=FailureType.REPUTATION_LOSS,
            failure_magnitude=60.0
        )

        # Start at 0 reputation
        assert path.current_reputation == 0.0

        # Achieve all milestones
        milestones = [
            RedemptionMilestone.ACKNOWLEDGMENT,
            RedemptionMilestone.RESTITUTION_PLAN,
            RedemptionMilestone.PARTIAL_RESTITUTION,
            RedemptionMilestone.NEW_SUCCESS,
            RedemptionMilestone.COMMUNITY_TRUST,
            RedemptionMilestone.COMPLETE_REDEMPTION,
        ]

        for milestone in milestones:
            path.achieve_milestone(milestone)

        # Should be close to or at full redemption
        assert path.current_reputation >= 0.9


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_rug_pull_recovery(self):
        """Founder who rug pulled can rebuild trust"""
        engine = RedemptionBondsEngine()

        # Founder rug pulled NFT project
        path = engine.start_redemption_path(
            redeemer_id="rug_puller",
            failure_type=FailureType.RUG_PULL,
            failure_magnitude=95.0,  # Severe
            failure_description="Abandoned NFT project with 500 ETH"
        )

        # 10 community members give them a chance
        stakers = [f"staker_{i}" for i in range(10)]
        for staker in stakers:
            engine.stake_in_redemption(staker, path.path_id, 100.0)

        # Founder works through redemption
        engine.achieve_milestone(path.path_id, RedemptionMilestone.ACKNOWLEDGMENT)
        engine.achieve_milestone(path.path_id, RedemptionMilestone.RESTITUTION_PLAN)
        engine.achieve_milestone(path.path_id, RedemptionMilestone.PARTIAL_RESTITUTION)

        stats = engine.get_redemption_stats("rug_puller")

        assert stats["has_active_path"] is True
        assert stats["total_stakers"] == 10
        assert stats["redemption_progress"] > 30.0  # Made progress

    def test_failed_protocol_restart(self):
        """Protocol that failed can restart with community support"""
        engine = RedemptionBondsEngine()

        # Protocol had security breach
        path = engine.start_redemption_path(
            redeemer_id="hacked_protocol",
            failure_type=FailureType.SECURITY_BREACH,
            failure_magnitude=70.0
        )

        # Community stakes in recovery
        for i in range(50):
            engine.stake_in_redemption(f"user_{i}", path.path_id, 50.0)

        # Protocol achieves recovery milestones
        engine.achieve_milestone(path.path_id, RedemptionMilestone.ACKNOWLEDGMENT)
        engine.achieve_milestone(path.path_id, RedemptionMilestone.FULL_RESTITUTION)
        engine.achieve_milestone(path.path_id, RedemptionMilestone.NEW_SUCCESS)

        stats = engine.get_redemption_stats("hacked_protocol")

        # Community belief should be positive (value > initial stake)
        assert stats["community_belief"] > 1.0
        assert stats["total_stakers"] == 50

    def test_preventing_bad_bets(self):
        """Abandonment penalty prevents staking in bad redemptions"""
        engine = RedemptionBondsEngine()

        # Someone starts redemption path
        path = engine.start_redemption_path(
            redeemer_id="unreliable",
            failure_type=FailureType.BROKEN_PROMISE,
            failure_magnitude=40.0
        )

        # Only 2 people stake (low confidence)
        bond1 = engine.stake_in_redemption("skeptic1", path.path_id, 100.0)
        bond2 = engine.stake_in_redemption("skeptic2", path.path_id, 50.0)

        # Person abandons redemption
        result = engine.handle_abandonment(path.path_id)

        # Stakers lose money
        assert bond1.current_value < bond1.initial_stake
        assert bond2.current_value < bond2.initial_stake

        # This teaches people to only stake in serious redemptions

    def test_community_forgiveness(self):
        """Community trust milestone requires genuine recovery"""
        engine = RedemptionBondsEngine()

        path = engine.start_redemption_path(
            redeemer_id="earnest_redeemer",
            failure_type=FailureType.ETHICAL_VIOLATION,
            failure_magnitude=65.0
        )

        # Stake in redemption
        bond = engine.stake_in_redemption("community", path.path_id, 1000.0)

        # Go through early milestones
        engine.achieve_milestone(path.path_id, RedemptionMilestone.ACKNOWLEDGMENT)
        engine.achieve_milestone(path.path_id, RedemptionMilestone.RESTITUTION_PLAN)

        # Community trust requires sustained behavior
        result = engine.achieve_milestone(
            path.path_id,
            RedemptionMilestone.COMMUNITY_TRUST,
            proof="6 months of positive contributions"
        )

        # Stakers profit from genuine redemption
        assert bond.current_value > bond.initial_stake
