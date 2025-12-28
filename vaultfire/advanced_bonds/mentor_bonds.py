"""
Mentor Bonds - Knowledge Transfer Stake Mechanism

Revolutionary innovation: When you teach someone, you get economic stake
in everything they build using that knowledge. Forever.

This makes knowledge transfer profitable instead of charitable, aligns
AI incentives with human success, and creates multi-generational thinking.

Core Concept:
- Expert teaches Student a skill → Expert gets 1-5% stake in Student's output
- Student teaches their Student → Expert gets lineage bonus
- Better teaching = more successful students = more profit
- Makes "training your replacement" economically rational
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass, field
import hashlib


class SkillCategory(Enum):
    """Categories of teachable skills"""
    PROGRAMMING = "programming"
    SMART_CONTRACTS = "smart_contracts"
    PROTOCOL_DESIGN = "protocol_design"
    SECURITY_AUDITING = "security_auditing"
    UI_UX_DESIGN = "ui_ux_design"
    COMMUNITY_BUILDING = "community_building"
    TOKEN_ECONOMICS = "token_economics"
    DATA_SCIENCE = "data_science"
    AI_ML = "ai_ml"
    WRITING = "writing"
    MARKETING = "marketing"
    LEADERSHIP = "leadership"


@dataclass
class KnowledgeLineage:
    """
    Tracks the chain of teachers.

    Example:
    Alice teaches Bob → Bob teaches Carol → Carol builds dapp
    Lineage: [Alice, Bob, Carol]
    Alice gets lineage bonus from Carol's success
    """
    lineage_id: str
    skill: str
    teachers: List[str] = field(default_factory=list)  # Chain of mentors
    created_at: datetime = field(default_factory=datetime.now)

    def add_teacher(self, teacher_id: str):
        """Add teacher to lineage"""
        self.teachers.append(teacher_id)

    def lineage_depth(self) -> int:
        """How many generations deep"""
        return len(self.teachers)

    def lineage_multiplier(self) -> float:
        """
        Lineage bonus: Earlier teachers get smaller % but from entire tree

        Direct student: 3%
        Student's student: 0.3% (10% of your direct rate)
        Student's student's student: 0.03% (1% of your direct rate)
        """
        depth = self.lineage_depth()
        if depth == 1:
            return 1.0  # Direct teaching
        elif depth == 2:
            return 0.1  # Your student's student
        elif depth == 3:
            return 0.01  # 3 generations down
        else:
            return 0.001  # 4+ generations (still counts!)


@dataclass
class MentorBond:
    """
    Economic stake in student's success based on knowledge transfer.

    When you teach someone, you get a % of everything they build using
    that knowledge. This makes teaching profitable, not charitable.
    """
    bond_id: str
    mentor_id: str
    student_id: str
    skill_taught: str
    skill_category: SkillCategory
    stake_percentage: float  # 1-5% typical
    knowledge_lineage: KnowledgeLineage
    created_at: datetime = field(default_factory=datetime.now)

    total_student_output_value: float = 0.0  # Student's total output
    total_mentor_earnings: float = 0.0  # What mentor has earned

    verification_status: str = "pending"  # pending, verified, active

    def verify_knowledge_transfer(self) -> bool:
        """
        Verify that teaching actually happened.
        Could use:
        - Attestations from both parties
        - Proof of work from student
        - Community verification
        - NS3 BeliefSync validation
        """
        # In production: Use BeliefSync + NS3 for trustless verification
        self.verification_status = "verified"
        return True

    def calculate_mentor_stake(self, student_output_value: float) -> float:
        """
        Calculate how much mentor earns from student's output.

        Only counts if output uses the taught skill.
        """
        # Check if output uses taught skill (simplified)
        # In production: Use tags, categories, attestations

        # Direct mentor bond always gets 1.0x multiplier
        # (lineage multiplier only applies to ancestors)
        lineage_mult = 1.0

        # Calculate stake (convert percentage to decimal)
        mentor_stake = student_output_value * (self.stake_percentage / 100.0) * lineage_mult

        # Update totals
        self.total_student_output_value += student_output_value
        self.total_mentor_earnings += mentor_stake

        return mentor_stake

    def extend_lineage(self, new_student_id: str) -> 'MentorBond':
        """
        When your student teaches someone else, extend the lineage.

        This creates generational knowledge transfer where original
        teacher benefits from entire tree.
        """
        # Create new lineage with extended chain
        new_lineage = KnowledgeLineage(
            lineage_id=f"{self.knowledge_lineage.lineage_id}:{new_student_id}",
            skill=self.skill_taught,
            teachers=self.knowledge_lineage.teachers + [self.student_id]
        )

        # Create new bond for extended relationship
        new_bond = MentorBond(
            bond_id=self._generate_bond_id(self.student_id, new_student_id),
            mentor_id=self.student_id,  # Your student becomes the mentor
            student_id=new_student_id,
            skill_taught=self.skill_taught,
            skill_category=self.skill_category,
            stake_percentage=self.stake_percentage,
            knowledge_lineage=new_lineage
        )

        return new_bond

    def _generate_bond_id(self, mentor: str, student: str) -> str:
        """Generate unique bond ID"""
        data = f"mentor:{mentor}:student:{student}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]


class MentorBondsEngine:
    """
    Global engine managing all mentor bonds.

    Tracks knowledge lineages, calculates earnings, verifies transfers.
    """

    def __init__(self):
        self.bonds: Dict[str, MentorBond] = {}
        self.lineages: Dict[str, KnowledgeLineage] = {}
        self.mentor_to_bonds: Dict[str, List[str]] = {}  # mentor_id -> bond_ids
        self.student_to_bonds: Dict[str, List[str]] = {}  # student_id -> bond_ids

    def create_mentor_bond(
        self,
        mentor_id: str,
        student_id: str,
        skill_taught: str,
        skill_category: SkillCategory,
        stake_percentage: float = 3.0,
        parent_lineage: Optional[KnowledgeLineage] = None
    ) -> MentorBond:
        """
        Create new mentor bond when teaching occurs.

        Args:
            mentor_id: Teacher's identifier
            student_id: Student's identifier
            skill_taught: What skill is being taught
            skill_category: Category of skill
            stake_percentage: % of student's output mentor receives (1-5%)
            parent_lineage: If student is also teaching, the parent lineage
        """
        if stake_percentage < 0.1 or stake_percentage > 10.0:
            raise ValueError("Stake percentage must be between 0.1% and 10%")

        # Create or extend lineage
        if parent_lineage:
            lineage = KnowledgeLineage(
                lineage_id=f"{parent_lineage.lineage_id}:{student_id}",
                skill=skill_taught,
                teachers=parent_lineage.teachers + [mentor_id]
            )
        else:
            lineage = KnowledgeLineage(
                lineage_id=f"lineage:{mentor_id}:{student_id}",
                skill=skill_taught,
                teachers=[mentor_id]
            )

        # Generate bond ID
        bond_id = self._generate_bond_id(mentor_id, student_id)

        # Create bond
        bond = MentorBond(
            bond_id=bond_id,
            mentor_id=mentor_id,
            student_id=student_id,
            skill_taught=skill_taught,
            skill_category=skill_category,
            stake_percentage=stake_percentage,
            knowledge_lineage=lineage
        )

        # Store bond
        self.bonds[bond_id] = bond
        self.lineages[lineage.lineage_id] = lineage

        # Update indices
        if mentor_id not in self.mentor_to_bonds:
            self.mentor_to_bonds[mentor_id] = []
        self.mentor_to_bonds[mentor_id].append(bond_id)

        if student_id not in self.student_to_bonds:
            self.student_to_bonds[student_id] = []
        self.student_to_bonds[student_id].append(bond_id)

        return bond

    def record_student_output(
        self,
        student_id: str,
        output_value: float,
        skills_used: List[str]
    ) -> Dict:
        """
        When student creates something, calculate mentor earnings.

        This is called whenever a student builds/ships/deploys something.
        Mentors automatically earn their stake.
        """
        if student_id not in self.student_to_bonds:
            return {"total_mentor_payouts": 0.0, "mentors_paid": []}

        total_payouts = 0.0
        mentors_paid = []

        # Find all bonds where this person is the student
        for bond_id in self.student_to_bonds[student_id]:
            bond = self.bonds[bond_id]

            # Check if output uses taught skill
            if bond.skill_taught in skills_used or bond.skill_category.value in skills_used:
                # Calculate mentor's stake
                mentor_stake = bond.calculate_mentor_stake(output_value)

                total_payouts += mentor_stake
                mentors_paid.append({
                    "mentor_id": bond.mentor_id,
                    "skill": bond.skill_taught,
                    "stake_earned": mentor_stake,
                    "lineage_depth": bond.knowledge_lineage.lineage_depth()
                })

                # Also pay lineage ancestors (teachers of teachers)
                lineage_payouts = self._pay_lineage_ancestors(bond, output_value, skills_used)
                total_payouts += sum(p["stake_earned"] for p in lineage_payouts)
                mentors_paid.extend(lineage_payouts)

        return {
            "total_mentor_payouts": total_payouts,
            "mentors_paid": mentors_paid,
            "student_keeps": output_value - total_payouts
        }

    def _pay_lineage_ancestors(
        self,
        bond: MentorBond,
        output_value: float,
        skills_used: List[str]
    ) -> List[Dict]:
        """
        Pay all teachers in the lineage chain.

        If Alice taught Bob, and Bob taught Carol, and Carol builds something,
        both Bob and Alice get paid (Bob more than Alice).
        """
        payouts = []

        # Walk up the lineage tree
        for i, ancestor_id in enumerate(bond.knowledge_lineage.teachers[:-1]):
            # Earlier ancestors get smaller % (lineage decay)
            depth_from_student = len(bond.knowledge_lineage.teachers) - i
            lineage_mult = 0.1 ** depth_from_student  # 10% per generation

            # Calculate ancestor's stake (convert percentage to decimal)
            ancestor_stake = output_value * (bond.stake_percentage / 100.0) * lineage_mult

            payouts.append({
                "mentor_id": ancestor_id,
                "skill": bond.skill_taught,
                "stake_earned": ancestor_stake,
                "lineage_depth": depth_from_student,
                "relationship": f"{depth_from_student}-generation ancestor"
            })

        return payouts

    def get_mentor_stats(self, mentor_id: str) -> Dict:
        """Get statistics for a mentor"""
        if mentor_id not in self.mentor_to_bonds:
            return {
                "total_students": 0,
                "total_earnings": 0.0,
                "active_bonds": 0,
                "lineage_depth": 0
            }

        bonds = [self.bonds[bid] for bid in self.mentor_to_bonds[mentor_id]]

        total_earnings = sum(b.total_mentor_earnings for b in bonds)
        max_lineage = max([b.knowledge_lineage.lineage_depth() for b in bonds], default=0)

        return {
            "total_students": len(bonds),
            "total_earnings": total_earnings,
            "active_bonds": len([b for b in bonds if b.verification_status == "active"]),
            "lineage_depth": max_lineage,
            "bonds": bonds
        }

    def _generate_bond_id(self, mentor: str, student: str) -> str:
        """Generate unique bond ID"""
        data = f"mentor:{mentor}:student:{student}:{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
