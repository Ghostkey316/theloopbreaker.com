"""
Tests for AI Accountability Bonds - When Humans Have No Jobs

Validates:
- Bond creation for AI systems (30% revenue stake)
- Global human flourishing measurement (aggregate, no individual tracking)
- Flourishing multiplier (thriving vs suffering)
- Inclusion multiplier (purpose/education - human inclusion)
- Profit locking when humans suffer
- Distribution to humans (50% appreciation OR 100% compensation)
- AI company payout (50% OR 0% if locked)
- Works with ZERO employment
- Creates self-funding UBI from AI profits
- Freedom Protocol compliance (privacy, no surveillance, no control)
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.ai_accountability_bonds import (
    AIAccountabilityBond,
    create_ai_accountability_bond,
    GlobalFlourishingData,
    HumanDistribution,
    HumanFlourishingMetric,
    AIType
)


class TestBondCreation:
    """Test AI accountability bond creation"""

    def test_create_basic_bond(self):
        """Should create bond with 30% revenue stake"""
        bond = create_ai_accountability_bond(
            bond_id="ai_001",
            ai_system_id="ai_system_a",
            ai_system_name="AI System A",
            ai_type=AIType.HEALTHCARE,
            quarterly_revenue=1_000_000.0
        )

        assert bond.bond_id == "ai_001"
        assert bond.ai_system_name == "AI System A"
        assert bond.quarterly_revenue == 1_000_000.0
        assert bond.required_stake() == 300_000.0  # 30% of revenue

    def test_minimum_revenue(self):
        """Should require positive revenue"""
        with pytest.raises(ValueError, match="revenue must be positive"):
            create_ai_accountability_bond(
                "test", "ai", "AI", AIType.AUTOMATION, 0.0
            )

    def test_ai_types(self):
        """Should support various AI types"""
        ai_types = [
            AIType.AUTOMATION,
            AIType.AUGMENTATION,
            AIType.HEALTHCARE,
            AIType.EDUCATION,
            AIType.FINANCE,
            AIType.CREATIVE
        ]

        for ai_type in ai_types:
            bond = create_ai_accountability_bond(
                "test", "ai", "AI", ai_type, 1_000_000.0
            )
            assert bond.ai_type == ai_type


class TestGlobalFlourishing:
    """Test global human flourishing measurement"""

    def test_add_flourishing_data(self):
        """Should add global flourishing measurements (aggregate only)"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=60.0,
            poverty_rate_score=65.0,
            health_outcomes_score=70.0,
            mental_health_score=55.0,
            education_access_score=60.0,
            purpose_agency_score=58.0,
            data_source="WHO/World Bank",
            verified=True
        )

        bond.add_flourishing_data(data)

        assert len(bond.flourishing_data) == 1
        # Note: No individual human tracking - aggregate only

    def test_average_flourishing_score(self):
        """Should calculate average across 6 metrics"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=80.0,
            poverty_rate_score=70.0,
            health_outcomes_score=90.0,
            mental_health_score=60.0,
            education_access_score=75.0,
            purpose_agency_score=85.0
        )

        bond.add_flourishing_data(data)

        # Average: (80+70+90+60+75+85) / 6 = 76.67
        avg = bond.average_flourishing_score()
        assert 76.0 < avg < 77.0


class TestFlourishingMultiplier:
    """Test flourishing ratio calculation"""

    def test_humans_thriving(self):
        """Should appreciate when humans thriving (70+)"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=85.0,
            poverty_rate_score=80.0,
            health_outcomes_score=90.0,
            mental_health_score=75.0,
            education_access_score=85.0,
            purpose_agency_score=80.0
        )

        bond.add_flourishing_data(data)

        multiplier = bond.global_flourishing_multiplier()
        assert multiplier > 1.5  # Should appreciate

    def test_humans_neutral(self):
        """Should be moderate when neutral (40-70)"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.AUTOMATION, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=55.0,
            poverty_rate_score=60.0,
            health_outcomes_score=50.0,
            mental_health_score=50.0,
            education_access_score=55.0,
            purpose_agency_score=50.0
        )

        bond.add_flourishing_data(data)

        multiplier = bond.global_flourishing_multiplier()
        assert 0.8 <= multiplier <= 1.5

    def test_humans_suffering(self):
        """Should depreciate heavily when humans suffering (< 40)"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.FINANCE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=25.0,
            poverty_rate_score=30.0,
            health_outcomes_score=35.0,
            mental_health_score=20.0,
            education_access_score=30.0,
            purpose_agency_score=15.0
        )

        bond.add_flourishing_data(data)

        multiplier = bond.global_flourishing_multiplier()
        assert multiplier < 0.8  # Severe depreciation


class TestInclusionMultiplier:
    """Test human inclusion measurement"""

    def test_high_inclusion(self):
        """Should reward AI that includes humans"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.EDUCATION, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=50.0,
            poverty_rate_score=50.0,
            health_outcomes_score=50.0,
            mental_health_score=50.0,
            education_access_score=85.0,  # High access to learning
            purpose_agency_score=80.0      # People have purpose
        )

        bond.add_flourishing_data(data)

        multiplier = bond.inclusion_multiplier()
        assert multiplier > 1.5  # High inclusion bonus

    def test_low_inclusion(self):
        """Should penalize AI that excludes humans"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.AUTOMATION, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=50.0,
            poverty_rate_score=50.0,
            health_outcomes_score=50.0,
            mental_health_score=50.0,
            education_access_score=25.0,  # Can't learn new skills
            purpose_agency_score=20.0      # No purpose, no jobs
        )

        bond.add_flourishing_data(data)

        multiplier = bond.inclusion_multiplier()
        assert multiplier < 1.0  # Low inclusion penalty


class TestProfitLocking:
    """Test profit locking when humans suffer"""

    def test_lock_when_humans_suffering(self):
        """Should lock profits when humans suffering (< 40)"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.FINANCE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=25.0,
            poverty_rate_score=30.0,
            health_outcomes_score=35.0,
            mental_health_score=25.0,
            education_access_score=30.0,
            purpose_agency_score=20.0
        )

        bond.add_flourishing_data(data)

        assert bond.should_lock_profits()
        assert "suffering" in bond.lock_reason.lower()

    def test_lock_when_declining(self):
        """Should lock profits when trend declining"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.AUTOMATION, 1_000_000
        )

        # Start okay
        data1 = GlobalFlourishingData(
            measurement_date=datetime.now() - timedelta(days=180),
            income_distribution_score=60.0,
            poverty_rate_score=65.0,
            health_outcomes_score=70.0,
            mental_health_score=60.0,
            education_access_score=65.0,
            purpose_agency_score=60.0
        )
        bond.add_flourishing_data(data1)

        # Then decline significantly
        data2 = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=45.0,
            poverty_rate_score=48.0,
            health_outcomes_score=50.0,
            mental_health_score=42.0,
            education_access_score=46.0,
            purpose_agency_score=40.0
        )
        bond.add_flourishing_data(data2)

        assert bond.flourishing_trend() == "declining"
        assert bond.should_lock_profits()

    def test_no_lock_when_thriving(self):
        """Should not lock when humans thriving"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=75.0,
            poverty_rate_score=80.0,
            health_outcomes_score=85.0,
            mental_health_score=70.0,
            education_access_score=78.0,
            purpose_agency_score=75.0
        )

        bond.add_flourishing_data(data)

        assert not bond.should_lock_profits()


class TestPayouts:
    """Test payout distribution"""

    def test_human_payout_on_appreciation(self):
        """Should give humans 50% of appreciation"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        # Humans thriving
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=80.0,
            poverty_rate_score=85.0,
            health_outcomes_score=90.0,
            mental_health_score=75.0,
            education_access_score=80.0,
            purpose_agency_score=85.0
        )

        bond.add_flourishing_data(data)

        appreciation = bond.calculate_appreciation()
        human_dist = bond.distribute_to_humans()

        assert human_dist is not None
        assert human_dist.total_amount == appreciation * 0.5
        assert human_dist.targeted_to_suffering

    def test_ai_payout_on_appreciation(self):
        """Should give AI 50% when humans thrive"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.HEALTHCARE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=80.0,
            poverty_rate_score=85.0,
            health_outcomes_score=90.0,
            mental_health_score=75.0,
            education_access_score=80.0,
            purpose_agency_score=85.0
        )

        bond.add_flourishing_data(data)

        appreciation = bond.calculate_appreciation()
        ai_payout = bond.ai_company_payout()

        assert ai_payout == appreciation * 0.5
        assert ai_payout > 0

    def test_human_compensation_on_depreciation(self):
        """Should give humans 100% compensation when suffering"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.FINANCE, 1_000_000
        )

        # Humans suffering
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=25.0,
            poverty_rate_score=30.0,
            health_outcomes_score=35.0,
            mental_health_score=25.0,
            education_access_score=30.0,
            purpose_agency_score=20.0
        )

        bond.add_flourishing_data(data)

        depreciation = bond.calculate_appreciation()  # Negative
        human_dist = bond.distribute_to_humans()

        assert human_dist is not None
        assert human_dist.total_amount == abs(depreciation)  # Get all of it

    def test_ai_gets_nothing_when_suffering(self):
        """Should give AI nothing when humans suffer"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.FINANCE, 1_000_000
        )

        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=25.0,
            poverty_rate_score=30.0,
            health_outcomes_score=35.0,
            mental_health_score=25.0,
            education_access_score=30.0,
            purpose_agency_score=20.0
        )

        bond.add_flourishing_data(data)

        ai_payout = bond.ai_company_payout()
        assert ai_payout == 0.0  # AI gets nothing

    def test_ai_gets_nothing_when_locked(self):
        """Should give AI nothing when profits locked"""
        bond = create_ai_accountability_bond(
            "test", "ai", "AI", AIType.AUTOMATION, 1_000_000
        )

        # Low inclusion (AI excluding humans)
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=50.0,
            poverty_rate_score=50.0,
            health_outcomes_score=50.0,
            mental_health_score=50.0,
            education_access_score=25.0,
            purpose_agency_score=20.0
        )

        bond.add_flourishing_data(data)

        assert bond.should_lock_profits()
        ai_payout = bond.ai_company_payout()
        assert ai_payout == 0.0


class TestRealWorldScenarios:
    """Test realistic AI scenarios"""

    def test_healthcare_ai_helps_humans(self):
        """Healthcare AI: replaces doctors but improves outcomes"""
        bond = create_ai_accountability_bond(
            bond_id="med_ai",
            ai_system_id="medai_diagnostics",
            ai_system_name="MedAI Diagnostics",
            ai_type=AIType.HEALTHCARE,
            quarterly_revenue=10_000_000.0
        )

        # Simulate 1 year
        bond.created_at = datetime.now() - timedelta(days=365)

        # Doctors lost jobs BUT health outcomes improved
        for _ in range(4):
            data = GlobalFlourishingData(
                measurement_date=datetime.now(),
                income_distribution_score=60.0,   # Moderate (some lost jobs)
                poverty_rate_score=65.0,           # Some struggle
                health_outcomes_score=90.0,        # MUCH better healthcare!
                mental_health_score=70.0,          # Better health helps
                education_access_score=75.0,       # Doctors reskilling
                purpose_agency_score=72.0          # New roles emerging
            )
            bond.add_flourishing_data(data)

        appreciation = bond.calculate_appreciation()
        human_dist = bond.distribute_to_humans()
        ai_payout = bond.ai_company_payout()

        # Everyone wins (even with job loss, overall flourishing)
        assert appreciation > 0
        assert human_dist.total_amount > 0
        assert ai_payout > 0
        assert not bond.should_lock_profits()

        print(f"\nHealthcare AI:")
        print(f"  Humans benefited: ${bond.total_human_benefit():,.0f}")
        print(f"  AI earned: ${ai_payout:,.0f}")
        print(f"  ✅ AI helps humans thrive despite job loss")

    def test_trading_ai_concentrates_wealth(self):
        """Trading AI: makes profits but humans suffer"""
        bond = create_ai_accountability_bond(
            bond_id="trade_ai",
            ai_system_id="quant_trader",
            ai_system_name="QuantTrader X",
            ai_type=AIType.FINANCE,
            quarterly_revenue=50_000_000.0
        )

        # AI makes huge profits but concentrates wealth
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=20.0,   # Wealth concentrating!
            poverty_rate_score=25.0,           # Poverty increasing
            health_outcomes_score=40.0,        # Can't afford healthcare
            mental_health_score=30.0,          # Anxiety/depression rising
            education_access_score=35.0,       # Can't afford education
            purpose_agency_score=15.0          # No jobs, no purpose
        )

        bond.add_flourishing_data(data)

        depreciation = bond.calculate_appreciation()
        human_dist = bond.distribute_to_humans()
        ai_payout = bond.ai_company_payout()

        # AI profits locked, humans compensated
        assert depreciation < 0
        assert human_dist.total_amount > 0  # Humans compensated
        assert ai_payout == 0.0  # AI gets nothing
        assert bond.should_lock_profits()

        print(f"\nTrading AI:")
        print(f"  Humans compensated: ${bond.total_human_benefit():,.0f}")
        print(f"  AI earned: ${ai_payout:,.0f}")
        print(f"  ⚠️  Profits locked, wealth concentration punished")

    def test_automation_ai_low_inclusion(self):
        """Automation AI: fires everyone, doesn't include humans"""
        bond = create_ai_accountability_bond(
            bond_id="auto_ai",
            ai_system_id="warehouse_auto",
            ai_system_name="Warehouse Automation",
            ai_type=AIType.AUTOMATION,
            quarterly_revenue=20_000_000.0
        )

        # Fired all workers, no reskilling, no purpose
        # Overall score OK, but LOW inclusion (education + purpose)
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=50.0,
            poverty_rate_score=50.0,
            health_outcomes_score=55.0,
            mental_health_score=45.0,
            education_access_score=30.0,  # No reskilling offered
            purpose_agency_score=15.0      # No alternative work
        )

        bond.add_flourishing_data(data)

        # Low inclusion should trigger lock
        assert bond.inclusion_multiplier() < 0.8
        assert bond.should_lock_profits()
        assert "inclusion" in bond.lock_reason.lower()

        ai_payout = bond.ai_company_payout()
        assert ai_payout == 0.0

        print(f"\nAutomation AI:")
        print(f"  Inclusion multiplier: {bond.inclusion_multiplier():.2f}")
        print(f"  AI earned: ${ai_payout:,.0f}")
        print(f"  ⚠️  Low human inclusion = profits locked")

    def test_education_ai_high_inclusion(self):
        """Education AI: helps humans learn AI skills"""
        bond = create_ai_accountability_bond(
            bond_id="edu_ai",
            ai_system_id="learning_platform",
            ai_system_name="AI Learning Platform",
            ai_type=AIType.EDUCATION,
            quarterly_revenue=5_000_000.0
        )

        # High education access and purpose
        data = GlobalFlourishingData(
            measurement_date=datetime.now(),
            income_distribution_score=65.0,
            poverty_rate_score=68.0,
            health_outcomes_score=70.0,
            mental_health_score=72.0,
            education_access_score=90.0,  # Everyone can learn!
            purpose_agency_score=85.0      # People reskilling, finding purpose
        )

        bond.add_flourishing_data(data)

        # High inclusion bonus
        inclusion = bond.inclusion_multiplier()
        assert inclusion > 1.5  # Bonus for including humans

        appreciation = bond.calculate_appreciation()
        assert appreciation > 0  # Should appreciate

        print(f"\nEducation AI:")
        print(f"  Inclusion multiplier: {inclusion:.2f}")
        print(f"  ✅ High human inclusion rewarded")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
