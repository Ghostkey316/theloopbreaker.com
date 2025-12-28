"""
Advanced Bond Mechanisms - Complete Economic Alignment Stack

Extends RBB and Thriving Bonds with specialized mechanisms:
1. Mentor Bonds - Knowledge transfer stake
2. Redemption Bonds - Community recovery
3. Impact Bonds - Real-world positive impact
4. Founder Accountability Bonds - Anti-rug protection

Together with RBB and Thriving Bonds, this creates complete economic
alignment across partnerships, communities, generations, failures, and impact.
"""

from vaultfire.advanced_bonds.mentor_bonds import (
    MentorBond,
    KnowledgeLineage,
    MentorBondsEngine,
    SkillCategory,
)

from vaultfire.advanced_bonds.redemption_bonds import (
    RedemptionBond,
    RedemptionPath,
    RedemptionBondsEngine,
    FailureType,
    RedemptionMilestone,
)

from vaultfire.advanced_bonds.impact_bonds import (
    ImpactBond,
    ImpactCommitment,
    ImpactBondsEngine,
    ImpactCategory,
    ImpactMetric,
    VerificationMethod,
)

from vaultfire.advanced_bonds.founder_bonds import (
    FounderAccountabilityBond,
    CommunityCoStake,
    FounderAccountabilityEngine,
    ProjectMilestone,
    ProjectPhase,
    MilestoneType,
    AbandonmentType,
)

__all__ = [
    # Mentor Bonds
    "MentorBond",
    "KnowledgeLineage",
    "MentorBondsEngine",
    "SkillCategory",

    # Redemption Bonds
    "RedemptionBond",
    "RedemptionPath",
    "RedemptionBondsEngine",
    "FailureType",
    "RedemptionMilestone",

    # Impact Bonds
    "ImpactBond",
    "ImpactCommitment",
    "ImpactBondsEngine",
    "ImpactCategory",
    "ImpactMetric",
    "VerificationMethod",

    # Founder Bonds
    "FounderAccountabilityBond",
    "CommunityCoStake",
    "FounderAccountabilityEngine",
    "ProjectMilestone",
    "ProjectPhase",
    "MilestoneType",
    "AbandonmentType",
]

__version__ = "1.0.0"
