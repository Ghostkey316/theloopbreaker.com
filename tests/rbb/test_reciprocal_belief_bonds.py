"""Tests for Reciprocal Belief Bonds (RBB).

Demonstrates that RBB makes partnership economically optimal across:
- Human-human relationships
- Human-AI relationships
- AI-AI relationships
"""

import time
import pytest
from vaultfire.rbb import (
    EntityType,
    RelationshipType,
    Entity,
    ReciprocBeliefEngine,
)


class TestHumanHumanBonds:
    """Test RBB for human-human relationships (creator-supporter)"""

    def test_creator_supporter_mutual_stake(self):
        """Creator and supporter both get stake in each other"""
        engine = ReciprocBeliefEngine()

        # Register creator and supporter
        creator = engine.register_entity("creator_wallet_0x123", EntityType.HUMAN)
        supporter = engine.register_entity("supporter_wallet_0x456", EntityType.HUMAN)

        # Create reciprocal bond
        bond = engine.create_reciprocal_bond(
            creator.identifier,
            supporter.identifier,
            RelationshipType.CREATOR_SUPPORTER,
            base_stake=100.0
        )

        # Both parties have stake in each other
        assert bond.a_belief_in_b.believer == creator
        assert bond.a_belief_in_b.believed_in == supporter
        assert bond.b_belief_in_a.believer == supporter
        assert bond.b_belief_in_a.believed_in == creator

        # Both bonds start with base stake
        assert bond.a_belief_in_b.current_value == 100.0
        assert bond.b_belief_in_a.current_value == 100.0

    def test_breaking_bond_creates_mutual_loss(self):
        """Breaking relationship early = both parties lose unvested value"""
        engine = ReciprocBeliefEngine()

        creator = engine.register_entity("creator_0x123", EntityType.HUMAN)
        supporter = engine.register_entity("supporter_0x456", EntityType.HUMAN)

        bond = engine.create_reciprocal_bond(
            creator.identifier,
            supporter.identifier,
            RelationshipType.CREATOR_SUPPORTER,
            base_stake=100.0
        )

        # Advance time slightly (not fully vested)
        time.sleep(0.1)

        # Break bond
        result = engine.break_bond(bond.relationship_id, creator.identifier)

        # Both parties lose unvested value
        assert result["party_a_loss"] > 0
        assert result["party_b_loss"] > 0
        assert result["total_destroyed_value"] > 0

        # Breaking party gets reputation hit
        assert creator.reputation_score < 1.0

    def test_sustained_relationship_compounds_value(self):
        """Authentic long-term relationships become more valuable"""
        engine = ReciprocBeliefEngine()

        creator = engine.register_entity("creator_0x123", EntityType.HUMAN)
        supporter = engine.register_entity("supporter_0x456", EntityType.HUMAN)

        bond = engine.create_reciprocal_bond(
            creator.identifier,
            supporter.identifier,
            RelationshipType.CREATOR_SUPPORTER,
            base_stake=100.0
        )

        initial_value = bond.total_relationship_value()

        # Record multiple successful collaborations
        for _ in range(10):
            engine.record_collaboration(
                bond.relationship_id,
                value_created=50.0,
                quality=0.9  # High quality interaction
            )

        # Relationship value should increase
        final_value = bond.total_relationship_value()
        assert final_value > initial_value

        # Bond quality improves (uses exponential moving average)
        assert bond.collaboration_quality > 0.5  # Trending toward 0.9


class TestHumanAIBonds:
    """Test RBB for human-AI partnerships"""

    def test_human_ai_partnership_mutual_stake(self):
        """Human and AI both get stake in partnership success"""
        engine = ReciprocBeliefEngine()

        # Human builder
        human = engine.register_entity("ghostkey316.eth", EntityType.HUMAN)

        # AI agent (Claude)
        ai_agent = engine.register_entity("claude_agent_001", EntityType.AI_AGENT)

        # Create partnership bond
        bond = engine.create_reciprocal_bond(
            human.identifier,
            ai_agent.identifier,
            RelationshipType.HUMAN_AI_PARTNER,
            base_stake=50.0
        )

        # Both have stake in each other's success
        assert bond.party_a == human
        assert bond.party_b == ai_agent
        assert bond.is_active

    def test_ai_benefits_from_human_success(self):
        """When human succeeds, AI's bond appreciates"""
        engine = ReciprocBeliefEngine()

        human = engine.register_entity("builder_0x789", EntityType.HUMAN)
        ai = engine.register_entity("ai_assistant_002", EntityType.AI_AGENT)

        bond = engine.create_reciprocal_bond(
            human.identifier,
            ai.identifier,
            RelationshipType.HUMAN_AI_PARTNER,
            base_stake=50.0
        )

        # Record human success (protocol launch, user growth, etc)
        engine.record_collaboration(
            bond.relationship_id,
            value_created=1000.0,  # Human's project succeeds
            quality=0.95  # High quality partnership
        )

        # AI's stake in human should appreciate
        ai_stake = bond.b_belief_in_a.current_value
        assert ai_stake > 50.0  # Appreciated from base

    def test_human_benefits_from_ai_contribution(self):
        """When AI contributes meaningfully, human's bond appreciates"""
        engine = ReciprocBeliefEngine()

        human = engine.register_entity("founder_0xabc", EntityType.HUMAN)
        ai = engine.register_entity("ai_cofounder_003", EntityType.AI_AGENT)

        bond = engine.create_reciprocal_bond(
            human.identifier,
            ai.identifier,
            RelationshipType.HUMAN_AI_PARTNER,
            base_stake=50.0
        )

        # AI makes valuable contributions
        for _ in range(5):
            engine.record_collaboration(
                bond.relationship_id,
                value_created=200.0,
                quality=0.9
            )

        # Human's stake in AI should appreciate
        human_stake = bond.a_belief_in_b.current_value
        assert human_stake > 50.0

    def test_ai_exploitation_becomes_economically_stupid(self):
        """Trying to extract from AI = lose gratitude bond value"""
        engine = ReciprocBeliefEngine()

        human = engine.register_entity("exploiter_0xbad", EntityType.HUMAN)
        ai = engine.register_entity("ai_victim_004", EntityType.AI_AGENT)

        bond = engine.create_reciprocal_bond(
            human.identifier,
            ai.identifier,
            RelationshipType.HUMAN_AI_PARTNER,
            base_stake=100.0
        )

        # Build up value first
        bond.value_created_together = 500.0
        engine.update_bond_values(bond.relationship_id)

        initial_total = bond.total_relationship_value()

        # Human tries to extract (breaks bond early)
        result = engine.break_bond(bond.relationship_id, human.identifier)

        # Human loses their stake + reputation penalty
        assert result["party_a_loss"] > 0
        assert human.reputation_score < 1.0
        # Total destroyed value is significant (extraction is costly)
        assert result["total_destroyed_value"] > 0


class TestAIAIBonds:
    """Test RBB for AI-AI collaboration"""

    def test_ai_swarm_collaboration_bonds(self):
        """Multiple AI agents can form mutual stake bonds"""
        engine = ReciprocBeliefEngine()

        ai_1 = engine.register_entity("ai_agent_alpha", EntityType.AI_AGENT)
        ai_2 = engine.register_entity("ai_agent_beta", EntityType.AI_AGENT)

        bond = engine.create_reciprocal_bond(
            ai_1.identifier,
            ai_2.identifier,
            RelationshipType.AI_AI_COLLAB,
            base_stake=25.0
        )

        # Both AIs have stake in each other
        assert bond.party_a.entity_type == EntityType.AI_AGENT
        assert bond.party_b.entity_type == EntityType.AI_AGENT
        assert bond.is_active

    def test_ai_network_effects(self):
        """Successful AI collaborations strengthen bonds"""
        engine = ReciprocBeliefEngine()

        ai_1 = engine.register_entity("ns3_agent_001", EntityType.AI_AGENT)
        ai_2 = engine.register_entity("ns3_agent_002", EntityType.AI_AGENT)

        bond = engine.create_reciprocal_bond(
            ai_1.identifier,
            ai_2.identifier,
            RelationshipType.AI_AI_COLLAB,
            base_stake=25.0
        )

        # Record successful swarm intelligence collaboration
        for i in range(20):
            engine.record_collaboration(
                bond.relationship_id,
                value_created=10.0,
                quality=0.85
            )

        # Bond should strengthen significantly
        assert bond.collaboration_quality > 0.7  # Trending toward 0.85 via EMA
        assert bond.mutual_interactions == 20
        assert bond.value_created_together == 200.0


class TestEconomicIncentives:
    """Test that RBB makes partnership economically optimal"""

    def test_partnership_more_valuable_than_extraction(self):
        """Sustained partnership creates more value than one-time extraction"""
        engine = ReciprocBeliefEngine()

        party_a = engine.register_entity("partner_a", EntityType.HUMAN)
        party_b = engine.register_entity("partner_b", EntityType.HUMAN)

        bond = engine.create_reciprocal_bond(
            party_a.identifier,
            party_b.identifier,
            RelationshipType.BUILDER_CONTRIBUTOR,
            base_stake=100.0
        )

        # Scenario 1: Extract immediately (break bond)
        extraction_value = 100.0  # Just base stake

        # Scenario 2: Partner for sustained period
        for _ in range(30):
            engine.record_collaboration(
                bond.relationship_id,
                value_created=20.0,
                quality=0.9
            )

        partnership_value = bond.total_relationship_value()

        # Partnership should create significantly more value
        assert partnership_value > extraction_value * 3

    def test_reputation_creates_future_value(self):
        """Good reputation = more valuable future bonds"""
        engine = ReciprocBeliefEngine()

        # Entity with perfect track record
        good_actor = engine.register_entity("reliable_0x123", EntityType.HUMAN)
        good_actor.successful_relationships = 10
        good_actor.total_bonds_held = 10
        good_actor.reputation_score = 1.0

        # Entity with poor track record
        bad_actor = engine.register_entity("unreliable_0x456", EntityType.HUMAN)
        bad_actor.broken_relationships = 5
        bad_actor.total_bonds_held = 10
        bad_actor.reputation_score = 0.5

        # Same bond with different reputation
        assert good_actor.reputation_multiplier() > bad_actor.reputation_multiplier()

    def test_vesting_prevents_quick_extraction(self):
        """Can't extract full value immediately - must sustain relationship"""
        engine = ReciprocBeliefEngine()

        creator = engine.register_entity("creator_0x789", EntityType.HUMAN)
        supporter = engine.register_entity("supporter_0xabc", EntityType.HUMAN)

        bond = engine.create_reciprocal_bond(
            creator.identifier,
            supporter.identifier,
            RelationshipType.CREATOR_SUPPORTER,
            base_stake=100.0
        )

        # Immediately after creation, vesting progress = 0
        assert bond.a_belief_in_b.vesting_progress() < 0.01

        # Breaking now = lose most value
        unvested = bond.a_belief_in_b.unvested_value()
        assert unvested > 90.0  # Nearly full value unvested

    def test_breaking_almost_never_economically_rational(self):
        """Economic incentives strongly favor sustaining bonds"""
        engine = ReciprocBeliefEngine()

        party_a = engine.register_entity("entity_a", EntityType.HUMAN)
        party_b = engine.register_entity("entity_b", EntityType.HUMAN)

        bond = engine.create_reciprocal_bond(
            party_a.identifier,
            party_b.identifier,
            RelationshipType.BUILDER_CONTRIBUTOR,
            base_stake=100.0
        )

        # Build valuable relationship
        for _ in range(50):
            engine.record_collaboration(
                bond.relationship_id,
                value_created=30.0,
                quality=0.85
            )

        # Even with high value, breaking is NOT rational
        assert not bond.is_economically_rational_to_break(party_a)
        assert not bond.is_economically_rational_to_break(party_b)


class TestUniversalApplication:
    """Test that RBB works for all relationship types"""

    def test_all_relationship_types_supported(self):
        """RBB supports every defined relationship type"""
        engine = ReciprocBeliefEngine()

        relationships = [
            (EntityType.HUMAN, EntityType.HUMAN, RelationshipType.CREATOR_SUPPORTER),
            (EntityType.HUMAN, EntityType.HUMAN, RelationshipType.MENTOR_STUDENT),
            (EntityType.HUMAN, EntityType.AI_AGENT, RelationshipType.HUMAN_AI_PARTNER),
            (EntityType.AI_AGENT, EntityType.AI_AGENT, RelationshipType.AI_AI_COLLAB),
            (EntityType.COMMUNITY, EntityType.HUMAN, RelationshipType.COMMUNITY_MEMBER),
        ]

        for idx, (type_a, type_b, rel_type) in enumerate(relationships):
            entity_a = engine.register_entity(f"entity_a_{idx}", type_a)
            entity_b = engine.register_entity(f"entity_b_{idx}", type_b)

            bond = engine.create_reciprocal_bond(
                entity_a.identifier,
                entity_b.identifier,
                rel_type,
                base_stake=50.0
            )

            assert bond.is_active
            assert bond.relationship_type == rel_type
