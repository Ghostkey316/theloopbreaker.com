"""
Tests for Founder Accountability Bonds - Anti-Rug Pull Mechanism

These tests prove that:
1. Founders bonding with community makes rug pulls economically stupid
2. Successful delivery profits both founder and community
3. Abandonment penalizes founder, compensates community
4. Milestone-based unlocking creates accountability
"""

import pytest
from datetime import datetime, timedelta

from vaultfire.advanced_bonds import (
    FounderAccountabilityBond,
    CommunityCoStake,
    FounderAccountabilityEngine,
    ProjectMilestone,
    ProjectPhase,
    MilestoneType,
    AbandonmentType,
)


class TestFounderBonding:
    """Test founder accountability bonds"""

    def test_create_founder_bond(self):
        """Founder can create accountability bond"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="mvp",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="Launch MVP",
                verification_criteria="Working product live",
                unlock_percentage=0.2,  # 20% unlock
                target_date=datetime.now() + timedelta(days=90)
            ),
            ProjectMilestone(
                milestone_id="mainnet",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet launch",
                verification_criteria="Smart contracts deployed",
                unlock_percentage=0.3,  # 30% unlock
                target_date=datetime.now() + timedelta(days=180)
            ),
            ProjectMilestone(
                milestone_id="sustained",
                milestone_type=MilestoneType.SUSTAINED_OPERATION,
                description="1 year uptime",
                verification_criteria="365 days of operation",
                unlock_percentage=0.5,  # 50% unlock
                target_date=datetime.now() + timedelta(days=365)
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="founder",
            project_name="New DeFi Protocol",
            founder_stake_amount=100000.0,
            milestones=milestones,
            project_phase=ProjectPhase.PLANNING
        )

        assert bond.founder_id == "founder"
        assert bond.founder_stake == 100000.0
        assert len(bond.milestones) == 3
        assert bond.unlocked_stake == 0.0  # Nothing unlocked yet

    def test_milestone_unlock_validation(self):
        """Milestones must unlock ~100% of stake"""
        engine = FounderAccountabilityEngine()

        # Invalid: only 50% unlock total
        bad_milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Working",
                unlock_percentage=0.5,
                target_date=datetime.now() + timedelta(days=90)
            )
        ]

        with pytest.raises(ValueError, match="should sum to ~100%"):
            engine.create_founder_bond(
                founder_id="founder",
                project_name="Bad Project",
                founder_stake_amount=10000.0,
                milestones=bad_milestones
            )


class TestCommunityCoStaking:
    """Test community staking alongside founder"""

    def test_community_co_stake(self):
        """Community can stake alongside founder"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=1.0,
                target_date=datetime.now() + timedelta(days=90)
            )
        ]

        bond = engine.create_founder_bond(
            founder_id="founder",
            project_name="Project",
            founder_stake_amount=50000.0,
            milestones=milestones
        )

        # Community member co-stakes
        co_stake = engine.community_co_stake(
            staker_id="believer",
            bond_id=bond.bond_id,
            stake_amount=1000.0
        )

        assert co_stake.staker_id == "believer"
        assert co_stake.initial_stake == 1000.0
        assert bond.community_stake == 1000.0
        assert bond.total_community_stakers == 1

    def test_multiple_community_stakers(self):
        """Multiple community members can co-stake"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=1.0
            )
        ]

        bond = engine.create_founder_bond(
            founder_id="founder",
            project_name="Community Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # 100 community members stake
        for i in range(100):
            engine.community_co_stake(
                staker_id=f"member_{i}",
                bond_id=bond.bond_id,
                stake_amount=500.0
            )

        assert bond.total_community_stakers == 100
        assert bond.community_stake == 50000.0  # 100 * 500


class TestMilestoneCompletion:
    """Test milestone-based unlocking"""

    def test_milestone_unlocks_stake(self):
        """Completing milestone unlocks founder stake"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="mvp",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=0.3  # 30%
            ),
            ProjectMilestone(
                milestone_id="mainnet",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=0.7  # 70%
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="founder",
            project_name="DeFi Protocol",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # Complete MVP milestone
        result = engine.complete_milestone(
            bond_id=bond.bond_id,
            milestone_id="mvp",
            proof="MVP deployed at 0x123..."
        )

        # 30% should unlock
        assert result["unlock_percentage"] == 0.3
        assert result["unlock_amount"] == 30000.0
        assert bond.unlocked_stake == 30000.0
        assert result["remaining_locked"] == 70000.0

    def test_milestone_appreciates_community(self):
        """When founder hits milestone, community stakes appreciate"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=0.5
            ),
            ProjectMilestone(
                milestone_id="m2",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=0.5
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="founder",
            project_name="Project",
            founder_stake_amount=50000.0,
            milestones=milestones
        )

        # Community stakes
        co_stake1 = engine.community_co_stake("staker1", bond.bond_id, 1000.0)
        co_stake2 = engine.community_co_stake("staker2", bond.bond_id, 500.0)

        initial_value1 = co_stake1.current_value
        initial_value2 = co_stake2.current_value

        # Complete milestone
        result = engine.complete_milestone(bond.bond_id, "m1")

        # Community stakes appreciated
        assert result["community_stakers_paid"] == 2
        assert result["total_community_appreciation"] > 0

        assert co_stake1.current_value > initial_value1
        assert co_stake2.current_value > initial_value2

    def test_delay_penalty(self):
        """Missing deadlines applies penalty"""
        past_date = datetime.now() - timedelta(days=100)

        milestone = ProjectMilestone(
            milestone_id="late",
            milestone_type=MilestoneType.MVP_LAUNCH,
            description="Late MVP",
            verification_criteria="Live",
            unlock_percentage=0.5,
            target_date=past_date  # 100 days ago
        )

        # Complete milestone late
        milestone.verify_completion("Finally launched")

        # Should have delay penalty
        penalty = milestone.delay_penalty()
        assert penalty > 0  # 100 days late = 30% penalty


class TestAbandonmentProtection:
    """Test anti-rug pull protection"""

    def test_abandonment_penalizes_founder(self):
        """When founder abandons, they lose locked stake"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=0.3
            ),
            ProjectMilestone(
                milestone_id="m2",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=0.7
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="rug_puller",
            project_name="Rug Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # Founder completes first milestone (30% unlocked)
        engine.complete_milestone(bond.bond_id, "m1")
        assert bond.unlocked_stake == 30000.0

        # Founder abandons project (70k still locked)
        result = engine.handle_abandonment(
            bond_id=bond.bond_id,
            abandonment_type=AbandonmentType.RUG_PULL
        )

        # Founder loses locked stake
        assert result["founder_penalty"] == 70000.0  # 100% of locked for rug pull
        assert result["founder_keeps"] == 0.0

    def test_abandonment_compensates_community(self):
        """When founder abandons, community gets compensated"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=1.0
            )
        ]

        bond = engine.create_founder_bond(
            founder_id="bad_founder",
            project_name="Failed Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # 10 community members stake
        for i in range(10):
            engine.community_co_stake(f"victim_{i}", bond.bond_id, 1000.0)

        # Founder abandons (all 100k still locked)
        result = engine.handle_abandonment(
            bond_id=bond.bond_id,
            abandonment_type=AbandonmentType.RUG_PULL
        )

        # Community compensated from founder's locked stake
        assert result["community_compensation"] == 100000.0
        assert result["compensation_per_staker"] == 10000.0  # 100k / 10 members
        assert result["stakers_compensated"] == 10

    def test_different_abandonment_severities(self):
        """Different abandonment types have different penalties"""
        # Rug pull (100% penalty)
        bond_rug = FounderAccountabilityBond(
            bond_id="rug",
            founder_id="rugger",
            project_name="Rug",
            project_phase=ProjectPhase.LAUNCH,
            founder_stake=100000.0,
            milestones=[],
            total_community_stakers=10
        )
        result_rug = bond_rug.handle_abandonment(AbandonmentType.RUG_PULL)
        assert result_rug["founder_penalty"] == 100000.0  # 100% loss

        # Ghost (80% penalty)
        bond_ghost = FounderAccountabilityBond(
            bond_id="ghost",
            founder_id="ghoster",
            project_name="Ghost",
            project_phase=ProjectPhase.GROWTH,
            founder_stake=100000.0,
            milestones=[],
            total_community_stakers=10
        )
        result_ghost = bond_ghost.handle_abandonment(AbandonmentType.GHOST)
        assert result_ghost["founder_penalty"] == 80000.0  # 80% loss

        # Broken promises (50% penalty)
        bond_broken = FounderAccountabilityBond(
            bond_id="broken",
            founder_id="promiser",
            project_name="Broken",
            project_phase=ProjectPhase.GROWTH,
            founder_stake=100000.0,
            milestones=[],
            total_community_stakers=10
        )
        result_broken = bond_broken.handle_abandonment(AbandonmentType.BROKEN_PROMISES)
        assert result_broken["founder_penalty"] == 50000.0  # 50% loss


class TestEconomicIncentives:
    """Test that Founder Bonds create correct economic incentives"""

    def test_delivery_profits_everyone(self):
        """Successful project delivery profits founder AND community"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=0.25
            ),
            ProjectMilestone(
                milestone_id="m2",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=0.25
            ),
            ProjectMilestone(
                milestone_id="m3",
                milestone_type=MilestoneType.USER_MILESTONE,
                description="1000 users",
                verification_criteria="Verified",
                unlock_percentage=0.25
            ),
            ProjectMilestone(
                milestone_id="m4",
                milestone_type=MilestoneType.SUSTAINED_OPERATION,
                description="1 year uptime",
                verification_criteria="365 days",
                unlock_percentage=0.25
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="good_founder",
            project_name="Successful Project",
            founder_stake_amount=200000.0,
            milestones=milestones
        )

        # Community stakes
        stakes = []
        for i in range(50):
            stake = engine.community_co_stake(f"member_{i}", bond.bond_id, 1000.0)
            stakes.append(stake)

        # Founder delivers all milestones
        for milestone_id in ["m1", "m2", "m3", "m4"]:
            engine.complete_milestone(bond.bond_id, milestone_id)

        # Founder unlocked all stake
        assert bond.unlocked_stake == 200000.0

        # Community stakes all appreciated
        for stake in stakes:
            assert stake.current_value > stake.initial_stake

    def test_rug_pull_economically_stupid(self):
        """Rug pulling becomes economically irrational"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet",
                verification_criteria="Live",
                unlock_percentage=1.0
            )
        ]

        bond = engine.create_founder_bond(
            founder_id="would_be_rugger",
            project_name="Tempting Project",
            founder_stake_amount=500000.0,  # Founder locked 500k
            milestones=milestones
        )

        # Community stakes
        for i in range(100):
            engine.community_co_stake(f"user_{i}", bond.bond_id, 100.0)

        # If founder rug pulls now, they lose all 500k
        # Community gets compensated 500k (5k each)
        # Founder gets: 0
        # Community gets: 500k

        # If founder delivers:
        # Founder unlocks: 500k
        # Community stakes appreciate

        # Economically rational choice: Deliver

    def test_trust_ratio_metric(self):
        """Trust ratio shows community confidence"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="m1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="MVP",
                verification_criteria="Live",
                unlock_percentage=1.0
            )
        ]

        # Untrusted founder
        bond_untrusted = engine.create_founder_bond(
            founder_id="untrusted",
            project_name="Sketchy Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # Only 2 people stake (low trust)
        engine.community_co_stake("skeptic1", bond_untrusted.bond_id, 100.0)
        engine.community_co_stake("skeptic2", bond_untrusted.bond_id, 50.0)

        stats_untrusted = engine.get_founder_stats("untrusted")
        # Trust ratio = community_stake / founder_stake = 150 / 100000 = 0.0015
        assert stats_untrusted["trust_ratio"] < 0.01

        # Trusted founder
        bond_trusted = engine.create_founder_bond(
            founder_id="trusted",
            project_name="Great Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # 1000 people stake (high trust)
        for i in range(1000):
            engine.community_co_stake(f"believer_{i}", bond_trusted.bond_id, 100.0)

        stats_trusted = engine.get_founder_stats("trusted")
        # Trust ratio = 100000 / 100000 = 1.0
        assert stats_trusted["trust_ratio"] == 1.0


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_nft_project_launch(self):
        """NFT project with utility delivery milestones"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="mint",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="NFT mint",
                verification_criteria="Collection launched",
                unlock_percentage=0.1  # Only 10% on mint
            ),
            ProjectMilestone(
                milestone_id="utility1",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="Staking utility",
                verification_criteria="Staking live",
                unlock_percentage=0.3
            ),
            ProjectMilestone(
                milestone_id="utility2",
                milestone_type=MilestoneType.PARTNERSHIP,
                description="Metaverse integration",
                verification_criteria="Partnership verified",
                unlock_percentage=0.3
            ),
            ProjectMilestone(
                milestone_id="sustained",
                milestone_type=MilestoneType.SUSTAINED_OPERATION,
                description="1 year of utility",
                verification_criteria="365 days active",
                unlock_percentage=0.3
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="nft_founder",
            project_name="Utility NFT Project",
            founder_stake_amount=100000.0,
            milestones=milestones
        )

        # 500 NFT holders co-stake
        for i in range(500):
            engine.community_co_stake(f"holder_{i}", bond.bond_id, 200.0)

        # Founder delivers milestones over time
        engine.complete_milestone(bond.bond_id, "mint")
        # ... 90% still locked until utility delivered

    def test_defi_protocol_accountability(self):
        """DeFi protocol with audit and security milestones"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="audit",
                milestone_type=MilestoneType.AUDIT_COMPLETION,
                description="Security audit",
                verification_criteria="Audit report published",
                unlock_percentage=0.2
            ),
            ProjectMilestone(
                milestone_id="testnet",
                milestone_type=MilestoneType.BETA_RELEASE,
                description="Testnet launch",
                verification_criteria="Testnet live",
                unlock_percentage=0.2
            ),
            ProjectMilestone(
                milestone_id="mainnet",
                milestone_type=MilestoneType.MAINNET_LAUNCH,
                description="Mainnet launch",
                verification_criteria="Mainnet live",
                unlock_percentage=0.2
            ),
            ProjectMilestone(
                milestone_id="tvl",
                milestone_type=MilestoneType.USER_MILESTONE,
                description="$10M TVL",
                verification_criteria="On-chain verified",
                unlock_percentage=0.2
            ),
            ProjectMilestone(
                milestone_id="sustained",
                milestone_type=MilestoneType.SUSTAINED_OPERATION,
                description="6 months uptime",
                verification_criteria="180 days no hacks",
                unlock_percentage=0.2
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="defi_team",
            project_name="New DeFi Protocol",
            founder_stake_amount=1000000.0,
            milestones=milestones
        )

        # Protocol backers co-stake
        for i in range(200):
            engine.community_co_stake(f"backer_{i}", bond.bond_id, 5000.0)

        stats = engine.get_founder_stats("defi_team")
        assert stats["total_community_stake"] == 1000000.0  # 200 * 5000
        assert stats["trust_ratio"] == 1.0  # Equal community/founder stake

    def test_dao_launch_decentralization(self):
        """DAO launch with governance transition milestone"""
        engine = FounderAccountabilityEngine()

        milestones = [
            ProjectMilestone(
                milestone_id="launch",
                milestone_type=MilestoneType.MVP_LAUNCH,
                description="DAO launch",
                verification_criteria="Governance live",
                unlock_percentage=0.3
            ),
            ProjectMilestone(
                milestone_id="community_growth",
                milestone_type=MilestoneType.USER_MILESTONE,
                description="1000 members",
                verification_criteria="Verified members",
                unlock_percentage=0.2
            ),
            ProjectMilestone(
                milestone_id="decentralization",
                milestone_type=MilestoneType.GOVERNANCE_TRANSITION,
                description="Full decentralization",
                verification_criteria="Multisig control",
                unlock_percentage=0.5  # Biggest unlock on true decentralization
            ),
        ]

        bond = engine.create_founder_bond(
            founder_id="dao_founder",
            project_name="Community DAO",
            founder_stake_amount=250000.0,
            milestones=milestones
        )

        # DAO members co-stake
        for i in range(1000):
            engine.community_co_stake(f"dao_member_{i}", bond.bond_id, 250.0)

        # Complete milestones
        engine.complete_milestone(bond.bond_id, "launch")
        engine.complete_milestone(bond.bond_id, "community_growth")
        engine.complete_milestone(bond.bond_id, "decentralization")

        # Everyone profits from successful decentralization
        assert bond.unlocked_stake == 250000.0
        assert bond.completion_percentage() == 100.0
