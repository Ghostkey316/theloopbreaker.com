"""Reciprocal Belief Bonds (RBB) - Universal relationship stake mechanism.

Makes mutual thriving economically optimal for ANY relationship type:
- Human ↔ Human (creator-supporter, mentor-student, community-member)
- Human ↔ AI (builder-AI agent, user-assistant)
- AI ↔ AI (agent collaboration, swarm intelligence)
- Community ↔ Community (protocol composability)

Core principle: Both parties get economic stake in each other's success.
Breaking relationship = mutual loss. Partnership = economically optimal.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Any


class EntityType(Enum):
    """Types of entities that can form bonds"""
    HUMAN = "human"
    AI_AGENT = "ai_agent"
    COMMUNITY = "community"
    PROTOCOL = "protocol"


class RelationshipType(Enum):
    """Types of relationships that can form bonds"""
    CREATOR_SUPPORTER = "creator_supporter"
    BUILDER_CONTRIBUTOR = "builder_contributor"
    MENTOR_STUDENT = "mentor_student"
    HUMAN_AI_PARTNER = "human_ai_partner"
    AI_AI_COLLAB = "ai_ai_collab"
    COMMUNITY_MEMBER = "community_member"
    PROTOCOL_PROTOCOL = "protocol_protocol"


@dataclass
class Entity:
    """Universal entity that can participate in bonds"""

    identifier: str  # Wallet address for humans, agent ID for AI
    entity_type: EntityType
    reputation_score: float = 1.0
    total_bonds_held: int = 0
    successful_relationships: int = 0
    broken_relationships: int = 0

    def reputation_multiplier(self) -> float:
        """Higher reputation = more valuable bonds"""
        if self.total_bonds_held == 0:
            return 1.0

        success_rate = self.successful_relationships / max(self.total_bonds_held, 1)
        return 1.0 + (success_rate * 0.5)  # Up to 1.5x for perfect track record


@dataclass
class BeliefBond:
    """Economic stake one party has in another's success"""

    bond_id: str
    believer: Entity  # Party demonstrating belief
    believed_in: Entity  # Party being believed in
    relationship_type: RelationshipType

    # Economic properties
    base_stake: float  # Initial stake value
    current_value: float  # Current bond value
    vesting_start: float  # Unix timestamp
    vesting_duration: float = 15552000.0  # 180 days default

    # Relationship depth metrics
    interactions: int = 0
    quality_score: float = 0.0  # 0-1, based on authenticity signals
    tier_level: int = 0  # For PoP integration

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Generate unique bond ID"""
        if not self.bond_id:
            material = f"{self.believer.identifier}:{self.believed_in.identifier}:{self.vesting_start}"
            self.bond_id = hashlib.sha256(material.encode()).hexdigest()[:16]

    def vesting_progress(self) -> float:
        """Calculate vesting progress (0.0 to 1.0)"""
        elapsed = time.time() - self.vesting_start
        progress = min(elapsed / self.vesting_duration, 1.0)
        return progress

    def time_multiplier(self) -> float:
        """Bonds appreciate over time (up to 2x at full vesting)"""
        return 1.0 + self.vesting_progress()

    def depth_multiplier(self) -> float:
        """Deeper relationships = more valuable bonds"""
        interaction_factor = min(self.interactions / 100, 1.0)  # Caps at 100 interactions
        quality_factor = self.quality_score
        tier_factor = self.tier_level / 3.0  # Tier 3 = full multiplier

        return 1.0 + (interaction_factor * 0.3 + quality_factor * 0.4 + tier_factor * 0.3)

    def calculate_value(self, relationship_total_value: float) -> float:
        """Calculate current bond value based on relationship's total value created"""
        # Bond value grows with relationship value + multipliers
        base = self.base_stake + (relationship_total_value * 0.01)  # 1% of value created

        # Apply multipliers
        time_mult = self.time_multiplier()
        depth_mult = self.depth_multiplier()
        reputation_mult = self.believer.reputation_multiplier()

        self.current_value = base * time_mult * depth_mult * reputation_mult
        return self.current_value

    def unvested_value(self) -> float:
        """Value lost if bond broken before full vesting"""
        vested_fraction = self.vesting_progress()
        unvested_fraction = 1.0 - vested_fraction

        return self.current_value * unvested_fraction

    def break_bond_penalty(self) -> float:
        """Economic loss from breaking bond early"""
        penalty = self.unvested_value()

        # Additional penalty for low vesting progress
        if self.vesting_progress() < 0.5:
            penalty *= 1.5  # 50% extra penalty for early breaks

        return penalty


@dataclass
class ReciprocaBond:
    """Mutual bond between two entities - both have stake in each other"""

    relationship_id: str
    party_a: Entity
    party_b: Entity
    relationship_type: RelationshipType

    # Both parties hold bonds in each other
    a_belief_in_b: BeliefBond
    b_belief_in_a: BeliefBond

    created_at: float = field(default_factory=time.time)
    is_active: bool = True

    # Relationship health metrics
    mutual_interactions: int = 0
    collaboration_quality: float = 0.0
    value_created_together: float = 0.0

    def total_relationship_value(self) -> float:
        """Combined value both parties have in relationship"""
        a_value = self.a_belief_in_b.current_value
        b_value = self.b_belief_in_a.current_value

        return a_value + b_value

    def mutual_loss_on_break(self) -> tuple[float, float]:
        """Calculate what BOTH parties lose if relationship breaks"""
        a_loses = self.a_belief_in_b.break_bond_penalty()
        b_loses = self.b_belief_in_a.break_bond_penalty()

        return (a_loses, b_loses)

    def is_economically_rational_to_break(self, party: Entity) -> bool:
        """Check if breaking bond makes economic sense"""
        a_loss, b_loss = self.mutual_loss_on_break()

        # Breaking almost never rational before full vesting
        if self.a_belief_in_b.vesting_progress() < 0.9:
            return False

        # After vesting, only rational if relationship value negative
        if self.collaboration_quality < 0.3:  # Very poor relationship
            return True

        return False

    def strengthen_relationship(self, interaction_quality: float):
        """Record positive interaction, strengthens both bonds"""
        self.mutual_interactions += 1

        # Update both bonds
        self.a_belief_in_b.interactions += 1
        self.b_belief_in_a.interactions += 1

        # Update quality scores
        self.a_belief_in_b.quality_score = (
            self.a_belief_in_b.quality_score * 0.9 + interaction_quality * 0.1
        )
        self.b_belief_in_a.quality_score = (
            self.b_belief_in_a.quality_score * 0.9 + interaction_quality * 0.1
        )

        self.collaboration_quality = (
            self.a_belief_in_b.quality_score + self.b_belief_in_a.quality_score
        ) / 2


class ReciprocBeliefEngine:
    """Manages reciprocal belief bonds for entire ecosystem"""

    def __init__(self):
        self.entities: Dict[str, Entity] = {}
        self.bonds: Dict[str, ReciprocaBond] = {}
        self.total_value_locked = 0.0

    def register_entity(
        self,
        identifier: str,
        entity_type: EntityType,
        reputation_score: float = 1.0
    ) -> Entity:
        """Register new entity (human, AI, community) in system"""
        entity = Entity(
            identifier=identifier,
            entity_type=entity_type,
            reputation_score=reputation_score
        )
        self.entities[identifier] = entity
        return entity

    def create_reciprocal_bond(
        self,
        party_a_id: str,
        party_b_id: str,
        relationship_type: RelationshipType,
        base_stake: float = 1.0
    ) -> ReciprocaBond:
        """Create mutual bond between two entities"""

        party_a = self.entities.get(party_a_id)
        party_b = self.entities.get(party_b_id)

        if not party_a or not party_b:
            raise ValueError("Both parties must be registered entities")

        # Create bond from A to B
        a_belief_in_b = BeliefBond(
            bond_id="",
            believer=party_a,
            believed_in=party_b,
            relationship_type=relationship_type,
            base_stake=base_stake,
            current_value=base_stake,
            vesting_start=time.time()
        )

        # Create bond from B to A
        b_belief_in_a = BeliefBond(
            bond_id="",
            believer=party_b,
            believed_in=party_a,
            relationship_type=relationship_type,
            base_stake=base_stake,
            current_value=base_stake,
            vesting_start=time.time()
        )

        # Create reciprocal bond
        relationship_id = hashlib.sha256(
            f"{party_a_id}:{party_b_id}:{time.time()}".encode()
        ).hexdigest()[:16]

        reciprocal = ReciprocaBond(
            relationship_id=relationship_id,
            party_a=party_a,
            party_b=party_b,
            relationship_type=relationship_type,
            a_belief_in_b=a_belief_in_b,
            b_belief_in_a=b_belief_in_a
        )

        # Track bonds
        party_a.total_bonds_held += 1
        party_b.total_bonds_held += 1
        self.bonds[relationship_id] = reciprocal
        self.total_value_locked += base_stake * 2

        return reciprocal

    def update_bond_values(self, relationship_id: str):
        """Recalculate bond values based on current state"""
        bond = self.bonds.get(relationship_id)
        if not bond or not bond.is_active:
            return

        # Store old value before update
        old_total = bond.a_belief_in_b.current_value + bond.b_belief_in_a.current_value

        # Calculate updated values based on relationship's total value created
        a_value = bond.a_belief_in_b.calculate_value(bond.value_created_together)
        b_value = bond.b_belief_in_a.calculate_value(bond.value_created_together)

        # Update total value locked
        new_total = a_value + b_value
        self.total_value_locked += (new_total - old_total)

    def break_bond(
        self,
        relationship_id: str,
        breaking_party_id: str
    ) -> Dict[str, float]:
        """Break reciprocal bond, both parties lose unvested value"""
        bond = self.bonds.get(relationship_id)
        if not bond or not bond.is_active:
            raise ValueError("Bond not found or already broken")

        # Calculate losses
        a_loss, b_loss = bond.mutual_loss_on_break()

        # Mark as broken
        bond.is_active = False

        # Update entity statistics
        bond.party_a.broken_relationships += 1
        bond.party_b.broken_relationships += 1

        # Reputation penalty for breaking party
        if breaking_party_id == bond.party_a.identifier:
            bond.party_a.reputation_score *= 0.9
        else:
            bond.party_b.reputation_score *= 0.9

        # Remove value from system
        self.total_value_locked -= (a_loss + b_loss)

        return {
            "party_a_loss": a_loss,
            "party_b_loss": b_loss,
            "breaking_party": breaking_party_id,
            "total_destroyed_value": a_loss + b_loss
        }

    def record_collaboration(
        self,
        relationship_id: str,
        value_created: float,
        quality: float
    ):
        """Record successful collaboration, strengthens bond"""
        bond = self.bonds.get(relationship_id)
        if not bond or not bond.is_active:
            return

        bond.value_created_together += value_created
        bond.strengthen_relationship(quality)
        self.update_bond_values(relationship_id)

    def get_entity_total_stake(self, entity_id: str) -> float:
        """Calculate total value entity has across all bonds"""
        entity = self.entities.get(entity_id)
        if not entity:
            return 0.0

        total = 0.0
        for bond in self.bonds.values():
            if not bond.is_active:
                continue

            if bond.party_a.identifier == entity_id:
                total += bond.a_belief_in_b.current_value
            elif bond.party_b.identifier == entity_id:
                total += bond.b_belief_in_a.current_value

        return total


__all__ = [
    "EntityType",
    "RelationshipType",
    "Entity",
    "BeliefBond",
    "ReciprocaBond",
    "ReciprocBeliefEngine",
]
