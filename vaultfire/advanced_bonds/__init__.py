"""
Advanced Bond Mechanisms - Complete Economic Alignment Stack

Extends RBB and Thriving Bonds with specialized mechanisms:
1. Mentor Bonds - Knowledge transfer stake
2. Redemption Bonds - Community recovery
3. Impact Bonds - Real-world positive impact
4. Founder Accountability Bonds - Anti-rug protection
5. Universal Dignity Bonds - Economic equality (human worth ≠ productivity)

Together with RBB and Thriving Bonds, this creates complete economic
alignment across partnerships, communities, generations, failures, impact, and equality.
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

from vaultfire.advanced_bonds.universal_dignity_bonds import (
    UniversalDignityBond,
    UniversalDignityBondsEngine,
    HumanFlourishingProfile,
    FlourishingScore,
    ConstraintProfile,
    ConstraintType,
    FlourishingDimension,
)

# V2: Privacy-Preserving Universal Dignity Bonds (RECOMMENDED)
from vaultfire.advanced_bonds.universal_dignity_bonds_v2 import (
    PrivacyPreservingEngine,
    PrivacyPreservingBond,
    PrivacyPreservingFlourishingData,
    ZeroKnowledgeProof,
    CommunityAttestation,
    create_beneficiary_commitment,
    create_community_circle,
    verify_attestation_threshold,
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

    # Universal Dignity Bonds (V1 - for backwards compatibility)
    "UniversalDignityBond",
    "UniversalDignityBondsEngine",
    "HumanFlourishingProfile",
    "FlourishingScore",
    "ConstraintProfile",
    "ConstraintType",
    "FlourishingDimension",

    # Universal Dignity Bonds V2 - Privacy-Preserving (RECOMMENDED)
    "PrivacyPreservingEngine",
    "PrivacyPreservingBond",
    "PrivacyPreservingFlourishingData",
    "ZeroKnowledgeProof",
    "CommunityAttestation",
    "create_beneficiary_commitment",
    "create_community_circle",
    "verify_attestation_threshold",
]

__version__ = "1.0.0"
