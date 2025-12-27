"""
Thriving Bonds - Collective Stake Mechanism

The first crypto primitive where helping others is MORE profitable than helping yourself.

Core Concept:
Instead of bonding 1:1 (RBB), you bond with a COMMUNITY. Your bond appreciates
based on collective success, not individual success.

Key Innovations:
- Cooperation beats competition (by economic design)
- Weakest link matters (incentivized to help struggling members)
- Individual extraction penalizes everyone
- Collective milestones unlock bonuses

Use Cases:
- Creator cohorts (50 creators bond together, mutual success)
- Builder collectives (devs on Base, quality self-enforcement)
- Local communities (towns, neighborhoods, mutual aid)
- AI swarms (agent cooperation with economic alignment)
- Student guilds (learning cohorts with shared success)
"""

from vaultfire.thriving_bonds.collective_stake import (
    # Core classes
    CommunityThrivingPool,
    ThrivingBondsEngine,
    ThrivingBondStake,
    CommunityMember,

    # Events
    ExtractionEvent,

    # Enums
    CommunityType,
    ExtractionEventType,
)

__all__ = [
    # Core
    "CommunityThrivingPool",
    "ThrivingBondsEngine",
    "ThrivingBondStake",
    "CommunityMember",

    # Events
    "ExtractionEvent",

    # Enums
    "CommunityType",
    "ExtractionEventType",
]

__version__ = "1.0.0"
