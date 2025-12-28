"""
Tests for Mentor Bonds - Knowledge Transfer Stake Mechanism

These tests prove that:
1. Teaching someone gives you economic stake in their output
2. Multi-generational teaching creates compound value
3. Better teaching = more successful students = more profit
4. Knowledge lineage tracking works correctly
"""

import pytest
from datetime import datetime

from vaultfire.advanced_bonds import (
    MentorBond,
    KnowledgeLineage,
    MentorBondsEngine,
    SkillCategory,
)


class TestKnowledgeTransfer:
    """Test basic mentor-student relationships"""

    def test_mentor_earns_from_student_output(self):
        """When student builds something, mentor earns stake"""
        engine = MentorBondsEngine()

        # Alice teaches Bob smart contracts
        bond = engine.create_mentor_bond(
            mentor_id="alice",
            student_id="bob",
            skill_taught="Solidity Programming",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0  # 3% stake
        )

        # Bob builds a dapp worth 10,000 tokens
        result = engine.record_student_output(
            student_id="bob",
            output_value=10000.0,
            skills_used=["Solidity Programming", "smart_contracts"]
        )

        # Alice should earn 3% = 300 tokens
        assert result["total_mentor_payouts"] == 300.0
        assert len(result["mentors_paid"]) == 1
        assert result["mentors_paid"][0]["mentor_id"] == "alice"
        assert result["mentors_paid"][0]["stake_earned"] == 300.0

    def test_student_keeps_majority(self):
        """Student keeps 97% when mentor gets 3%"""
        engine = MentorBondsEngine()

        bond = engine.create_mentor_bond(
            mentor_id="mentor",
            student_id="student",
            skill_taught="Python",
            skill_category=SkillCategory.PROGRAMMING,
            stake_percentage=3.0
        )

        result = engine.record_student_output(
            student_id="student",
            output_value=1000.0,
            skills_used=["Python"]
        )

        # Student keeps 970, mentor gets 30
        assert result["student_keeps"] == 970.0
        assert result["total_mentor_payouts"] == 30.0

    def test_only_relevant_skills_count(self):
        """Mentor only earns when student uses taught skill"""
        engine = MentorBondsEngine()

        # Alice teaches Bob Solidity
        bond = engine.create_mentor_bond(
            mentor_id="alice",
            student_id="bob",
            skill_taught="Solidity",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0
        )

        # Bob builds something using React (not Solidity)
        result = engine.record_student_output(
            student_id="bob",
            output_value=1000.0,
            skills_used=["React", "ui_ux_design"]
        )

        # Alice earns nothing (skill not used)
        assert result["total_mentor_payouts"] == 0.0
        assert len(result["mentors_paid"]) == 0


class TestMultiGenerationalLineage:
    """Test knowledge lineage across generations"""

    def test_lineage_tracking(self):
        """Knowledge lineage tracks chain of teachers"""
        engine = MentorBondsEngine()

        # Alice teaches Bob
        bond1 = engine.create_mentor_bond(
            mentor_id="alice",
            student_id="bob",
            skill_taught="Smart Contracts",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0
        )

        # Bob teaches Carol (extending Alice's lineage)
        bond2 = bond1.extend_lineage(new_student_id="carol")

        # Lineage should be: [Alice, Bob]
        assert bond2.knowledge_lineage.lineage_depth() == 2
        assert "alice" in bond2.knowledge_lineage.teachers
        assert "bob" in bond2.knowledge_lineage.teachers

    def test_lineage_multiplier_decay(self):
        """Earlier generations get smaller but still meaningful stake"""
        lineage = KnowledgeLineage(
            lineage_id="test",
            skill="Testing",
            teachers=["alice"]  # 1 generation
        )
        assert lineage.lineage_multiplier() == 1.0  # Direct teaching

        lineage.teachers.append("bob")  # 2 generations
        assert lineage.lineage_multiplier() == 0.1  # 10% of direct

        lineage.teachers.append("carol")  # 3 generations
        assert lineage.lineage_multiplier() == 0.01  # 1% of direct

        lineage.teachers.append("dave")  # 4 generations
        assert lineage.lineage_multiplier() == 0.001  # Still counts!

    def test_multi_generational_payouts(self):
        """When Carol builds, both Bob and Alice get paid"""
        engine = MentorBondsEngine()

        # Alice teaches Bob
        bond1 = engine.create_mentor_bond(
            mentor_id="alice",
            student_id="bob",
            skill_taught="Solidity",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0
        )

        # Bob teaches Carol
        bond2 = engine.create_mentor_bond(
            mentor_id="bob",
            student_id="carol",
            skill_taught="Solidity",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0,
            parent_lineage=bond1.knowledge_lineage
        )

        # Carol builds a dapp worth 10,000
        result = engine.record_student_output(
            student_id="carol",
            output_value=10000.0,
            skills_used=["Solidity"]
        )

        # Both Bob and Alice should be paid
        mentors = {m["mentor_id"]: m for m in result["mentors_paid"]}

        # Bob (direct mentor): 3% of 10,000 = 300
        assert "bob" in mentors
        assert mentors["bob"]["stake_earned"] == 300.0
        assert mentors["bob"]["lineage_depth"] == 2  # Lineage: [Alice, Bob]

        # Alice (lineage ancestor): gets smaller % due to lineage decay
        assert "alice" in mentors
        assert mentors["alice"]["stake_earned"] > 0
        assert mentors["alice"]["lineage_depth"] > 1


class TestEconomicIncentives:
    """Test that Mentor Bonds create correct economic incentives"""

    def test_teaching_becomes_profitable(self):
        """Teaching is economically rational, not just charitable"""
        engine = MentorBondsEngine()

        bond = engine.create_mentor_bond(
            mentor_id="expert",
            student_id="newbie",
            skill_taught="Protocol Design",
            skill_category=SkillCategory.PROTOCOL_DESIGN,
            stake_percentage=5.0  # 5% stake
        )

        # Student builds successful protocol
        for i in range(10):
            engine.record_student_output(
                student_id="newbie",
                output_value=1000.0,
                skills_used=["Protocol Design"]
            )

        stats = engine.get_mentor_stats("expert")

        # Mentor should have earned 5% of 10,000 = 500
        assert stats["total_earnings"] == 500.0
        assert stats["total_students"] == 1

    def test_training_replacement_is_rational(self):
        """Training your replacement becomes economically smart"""
        engine = MentorBondsEngine()

        # Senior dev teaches junior their job
        bond = engine.create_mentor_bond(
            mentor_id="senior_dev",
            student_id="junior_dev",
            skill_taught="System Architecture",
            skill_category=SkillCategory.PROGRAMMING,
            stake_percentage=4.0
        )

        # Junior becomes productive and builds things
        total_junior_output = 50000.0
        engine.record_student_output(
            student_id="junior_dev",
            output_value=total_junior_output,
            skills_used=["System Architecture"]
        )

        stats = engine.get_mentor_stats("senior_dev")

        # Senior earned 4% of junior's output = 2000
        assert stats["total_earnings"] == 2000.0

        # Senior can now move to higher-value work while still
        # earning from junior's output. Win-win.

    def test_better_teaching_more_profit(self):
        """Better teaching = more successful students = more earnings"""
        engine = MentorBondsEngine()

        # Mentor A teaches student with 3% stake
        bond_a = engine.create_mentor_bond(
            mentor_id="mentor_a",
            student_id="student_a",
            skill_taught="Programming",
            skill_category=SkillCategory.PROGRAMMING,
            stake_percentage=3.0
        )

        # Mentor B teaches student with same 3% stake
        bond_b = engine.create_mentor_bond(
            mentor_id="mentor_b",
            student_id="student_b",
            skill_taught="Programming",
            skill_category=SkillCategory.PROGRAMMING,
            stake_percentage=3.0
        )

        # Student A (better taught) produces more value
        engine.record_student_output(
            student_id="student_a",
            output_value=10000.0,
            skills_used=["Programming"]
        )

        # Student B (worse taught) produces less value
        engine.record_student_output(
            student_id="student_b",
            output_value=3000.0,
            skills_used=["Programming"]
        )

        stats_a = engine.get_mentor_stats("mentor_a")
        stats_b = engine.get_mentor_stats("mentor_b")

        # Mentor A earned more because student was more successful
        assert stats_a["total_earnings"] > stats_b["total_earnings"]


class TestVerificationAndIntegrity:
    """Test verification and tracking mechanisms"""

    def test_bond_verification(self):
        """Bonds can be verified through attestations"""
        engine = MentorBondsEngine()

        bond = engine.create_mentor_bond(
            mentor_id="teacher",
            student_id="learner",
            skill_taught="Security Auditing",
            skill_category=SkillCategory.SECURITY_AUDITING,
            stake_percentage=3.0
        )

        # Initially pending
        assert bond.verification_status == "pending"

        # Verify knowledge transfer happened
        result = bond.verify_knowledge_transfer()
        assert result is True
        assert bond.verification_status == "verified"

    def test_multiple_mentors_one_student(self):
        """Student can have multiple mentors for different skills"""
        engine = MentorBondsEngine()

        # Alice teaches solidity
        bond1 = engine.create_mentor_bond(
            mentor_id="alice",
            student_id="student",
            skill_taught="Solidity",
            skill_category=SkillCategory.SMART_CONTRACTS,
            stake_percentage=3.0
        )

        # Bob teaches UI/UX
        bond2 = engine.create_mentor_bond(
            mentor_id="bob",
            student_id="student",
            skill_taught="Design",
            skill_category=SkillCategory.UI_UX_DESIGN,
            stake_percentage=2.0
        )

        # Student builds full-stack dapp
        result = engine.record_student_output(
            student_id="student",
            output_value=10000.0,
            skills_used=["Solidity", "Design"]
        )

        # Both mentors get paid
        mentors = {m["mentor_id"]: m for m in result["mentors_paid"]}
        assert "alice" in mentors
        assert "bob" in mentors

        # Alice gets 3%, Bob gets 2%
        assert mentors["alice"]["stake_earned"] == 300.0
        assert mentors["bob"]["stake_earned"] == 200.0


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_bootcamp_instructor(self):
        """Bootcamp instructor earns from all graduates' success"""
        engine = MentorBondsEngine()

        instructor = "bootcamp_teacher"
        students = [f"student_{i}" for i in range(50)]

        # Instructor teaches 50 students
        for student in students:
            engine.create_mentor_bond(
                mentor_id=instructor,
                student_id=student,
                skill_taught="Web3 Development",
                skill_category=SkillCategory.PROGRAMMING,
                stake_percentage=2.0  # 2% stake
            )

        # Each student builds things worth varying amounts
        for i, student in enumerate(students):
            output_value = (i + 1) * 500  # 500, 1000, 1500, ...
            engine.record_student_output(
                student_id=student,
                output_value=output_value,
                skills_used=["Web3 Development"]
            )

        stats = engine.get_mentor_stats(instructor)

        # Instructor taught 50 students
        assert stats["total_students"] == 50

        # Total student output: sum(i*500 for i in 1..50) = 637,500
        # Instructor earns 2% = 12,750
        assert stats["total_earnings"] == 12750.0

    def test_ai_teaching_human(self):
        """AI agent teaches human, earns from human's success"""
        engine = MentorBondsEngine()

        bond = engine.create_mentor_bond(
            mentor_id="ai_tutor",
            student_id="human_learner",
            skill_taught="Machine Learning",
            skill_category=SkillCategory.AI_ML,
            stake_percentage=3.0
        )

        # Human builds ML models
        engine.record_student_output(
            student_id="human_learner",
            output_value=25000.0,
            skills_used=["Machine Learning"]
        )

        stats = engine.get_mentor_stats("ai_tutor")

        # AI earned 3% of human's output = 750
        assert stats["total_earnings"] == 750.0

        # Makes AI-human knowledge transfer economically aligned

    def test_open_source_maintainer(self):
        """Open source maintainer earns from contributors they mentor"""
        engine = MentorBondsEngine()

        maintainer = "oss_maintainer"
        contributors = [f"contributor_{i}" for i in range(20)]

        # Maintainer mentors contributors on the codebase
        for contributor in contributors:
            engine.create_mentor_bond(
                mentor_id=maintainer,
                student_id=contributor,
                skill_taught="Project Architecture",
                skill_category=SkillCategory.PROGRAMMING,
                stake_percentage=1.5  # Lower % but many contributors
            )

        # Contributors make valuable contributions
        for contributor in contributors:
            engine.record_student_output(
                student_id=contributor,
                output_value=1000.0,
                skills_used=["Project Architecture"]
            )

        stats = engine.get_mentor_stats(maintainer)

        # Maintainer earned 1.5% from 20 contributors
        # Total: 20 * 1000 * 0.015 = 300
        assert stats["total_earnings"] == 300.0

        # Makes OSS maintenance economically sustainable
