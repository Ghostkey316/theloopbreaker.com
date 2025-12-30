"""
Tests for Purchasing Power Bonds - Restoring 1990s Affordability
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.purchasing_power_bonds import (
    PurchasingPowerBond,
    PurchasingPowerMetrics,
    BaselinePurchasingPower,
    WorkerAttestation,
    PurchasingPowerDistribution,
    create_purchasing_power_bond
)


class TestPurchasingPowerBondCreation:
    """Test bond creation"""

    def test_create_bond(self):
        """Should create Purchasing Power Bond"""
        bond = create_purchasing_power_bond(
            bond_id="pp_001",
            company_id="company_001",
            company_name="Good Employer Inc",
            stake_amount=10_000_000.0
        )

        assert bond.bond_id == "pp_001"
        assert bond.company_id == "company_001"
        assert bond.stake_amount == 10_000_000.0
        assert bond.baseline.housing_target == 30.0
        assert len(bond.purchasing_power_data) == 0


class TestPurchasingPowerTracking:
    """Test purchasing power data tracking"""

    def test_add_purchasing_power_data(self):
        """Should track purchasing power metrics over time"""
        bond = create_purchasing_power_bond(
            bond_id="pp_002",
            company_id="company_002",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        metrics = PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=35.0,  # Worse than 1990s (30%)
            food_hours_per_week=5.0,  # Worse than 1990s (4 hours)
            healthcare_cost_percent=15.0,  # Worse than 1990s (7%)
            education_affordability_score=60.0,
            transportation_cost_percent=12.0,
            discretionary_income_percent=18.0,  # Worse than 1990s (25%)
            company_id="company_002",
            worker_count=500,
            average_wage=55_000.0
        )

        bond.add_purchasing_power_data(metrics)
        assert len(bond.purchasing_power_data) == 1

    def test_reject_wrong_company_data(self):
        """Should reject data from different company"""
        bond = create_purchasing_power_bond(
            bond_id="pp_003",
            company_id="company_003",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        metrics = PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=35.0,
            food_hours_per_week=5.0,
            healthcare_cost_percent=15.0,
            education_affordability_score=60.0,
            transportation_cost_percent=12.0,
            discretionary_income_percent=18.0,
            company_id="different_company",  # Wrong company
            worker_count=500,
            average_wage=55_000.0
        )

        with pytest.raises(ValueError, match="must be for this company"):
            bond.add_purchasing_power_data(metrics)


class TestWorkerVerification:
    """Test worker attestation"""

    def test_worker_attestation(self):
        """Workers verify purchasing power improvements"""
        bond = create_purchasing_power_bond(
            bond_id="pp_004",
            company_id="company_004",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        attestation = WorkerAttestation(
            attestor_id="worker_001",
            attestation_date=datetime.now(),
            company_id="company_004",
            can_afford_housing=True,
            can_afford_food=True,
            can_afford_healthcare=True,
            can_save_money=True,
            purchasing_power_improving=True,
            notes="Can finally afford rent without stress"
        )

        bond.add_worker_attestation(attestation)
        assert len(bond.worker_attestations) == 1

    def test_reject_wrong_company_attestation(self):
        """Should reject attestation from different company"""
        bond = create_purchasing_power_bond(
            bond_id="pp_005",
            company_id="company_005",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        attestation = WorkerAttestation(
            attestor_id="worker_001",
            attestation_date=datetime.now(),
            company_id="different_company",  # Wrong company
            can_afford_housing=True,
            can_afford_food=True,
            can_afford_healthcare=True,
            can_save_money=True,
            purchasing_power_improving=True
        )

        with pytest.raises(ValueError, match="must be worker at this company"):
            bond.add_worker_attestation(attestation)


class TestHousingAffordability:
    """Test housing affordability scoring"""

    def test_excellent_housing_affordability(self):
        """Housing at 25% of income = excellent"""
        bond = create_purchasing_power_bond(
            bond_id="pp_006",
            company_id="company_006",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        # Initial: bad
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=45.0,
            food_hours_per_week=6.0,
            healthcare_cost_percent=18.0,
            education_affordability_score=50.0,
            transportation_cost_percent=15.0,
            discretionary_income_percent=10.0,
            company_id="company_006",
            worker_count=500,
            average_wage=50_000.0
        ))

        # Latest: excellent
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=25.0,  # Better than 1990s!
            food_hours_per_week=6.0,
            healthcare_cost_percent=18.0,
            education_affordability_score=50.0,
            transportation_cost_percent=15.0,
            discretionary_income_percent=10.0,
            company_id="company_006",
            worker_count=500,
            average_wage=65_000.0
        ))

        score = bond.housing_affordability_score()
        assert score == 2.0  # Excellent

    def test_worse_housing_affordability(self):
        """Housing at 50% of income = much worse"""
        bond = create_purchasing_power_bond(
            bond_id="pp_007",
            company_id="company_007",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=30.0,
            food_hours_per_week=4.0,
            healthcare_cost_percent=7.0,
            education_affordability_score=75.0,
            transportation_cost_percent=10.0,
            discretionary_income_percent=25.0,
            company_id="company_007",
            worker_count=500,
            average_wage=50_000.0
        ))

        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=50.0,  # Much worse
            food_hours_per_week=4.0,
            healthcare_cost_percent=7.0,
            education_affordability_score=75.0,
            transportation_cost_percent=10.0,
            discretionary_income_percent=25.0,
            company_id="company_007",
            worker_count=500,
            average_wage=50_000.0
        ))

        score = bond.housing_affordability_score()
        assert score < 0.5


class TestFoodAffordability:
    """Test food affordability scoring"""

    def test_excellent_food_affordability(self):
        """3 hours of work for groceries = excellent"""
        bond = create_purchasing_power_bond(
            bond_id="pp_008",
            company_id="company_008",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=30.0,
            food_hours_per_week=6.0,
            healthcare_cost_percent=7.0,
            education_affordability_score=75.0,
            transportation_cost_percent=10.0,
            discretionary_income_percent=25.0,
            company_id="company_008",
            worker_count=500,
            average_wage=50_000.0
        ))

        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=30.0,
            food_hours_per_week=3.0,  # Better than 1990s!
            healthcare_cost_percent=7.0,
            education_affordability_score=75.0,
            transportation_cost_percent=10.0,
            discretionary_income_percent=25.0,
            company_id="company_008",
            worker_count=500,
            average_wage=70_000.0
        ))

        score = bond.food_affordability_score()
        assert score == 2.0


class TestOverallPurchasingPower:
    """Test overall purchasing power scoring"""

    def test_1990s_level_purchasing_power(self):
        """All metrics at 1990s baseline = 1.0x"""
        bond = create_purchasing_power_bond(
            bond_id="pp_009",
            company_id="company_009",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=40.0,
            food_hours_per_week=6.0,
            healthcare_cost_percent=15.0,
            education_affordability_score=50.0,
            transportation_cost_percent=15.0,
            discretionary_income_percent=10.0,
            company_id="company_009",
            worker_count=500,
            average_wage=50_000.0
        ))

        # 1990s baseline
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=30.0,  # 1990s level
            food_hours_per_week=4.0,  # 1990s level
            healthcare_cost_percent=7.0,  # 1990s level
            education_affordability_score=75.0,  # 1990s level
            transportation_cost_percent=10.0,  # 1990s level
            discretionary_income_percent=25.0,  # 1990s level
            company_id="company_009",
            worker_count=500,
            average_wage=65_000.0
        ))

        score = bond.overall_purchasing_power_score()
        assert 0.9 <= score <= 1.1  # Around 1.0x (1990s baseline)


class TestWorkerVerificationMultiplier:
    """Test worker verification multiplier"""

    def test_no_verification_penalty(self):
        """No worker verification = penalty"""
        bond = create_purchasing_power_bond(
            bond_id="pp_010",
            company_id="company_010",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        multiplier = bond.worker_verification_multiplier()
        assert multiplier == 0.5  # Penalty

    def test_strong_consensus_bonus(self):
        """Strong worker consensus = bonus"""
        bond = create_purchasing_power_bond(
            bond_id="pp_011",
            company_id="company_011",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        # 10 workers all confirm improvements
        for i in range(10):
            bond.add_worker_attestation(WorkerAttestation(
                attestor_id=f"worker_{i}",
                attestation_date=datetime.now(),
                company_id="company_011",
                can_afford_housing=True,
                can_afford_food=True,
                can_afford_healthcare=True,
                can_save_money=True,
                purchasing_power_improving=True
            ))

        multiplier = bond.worker_verification_multiplier()
        assert multiplier == 1.5  # Bonus


class TestDecliningPenalty:
    """Test declining purchasing power penalty"""

    def test_declining_penalty_activates(self):
        """Penalty activates when purchasing power declines"""
        bond = create_purchasing_power_bond(
            bond_id="pp_012",
            company_id="company_012",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        # Good initial state
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=30.0,
            food_hours_per_week=4.0,
            healthcare_cost_percent=7.0,
            education_affordability_score=75.0,
            transportation_cost_percent=10.0,
            discretionary_income_percent=25.0,
            company_id="company_012",
            worker_count=500,
            average_wage=60_000.0
        ))

        # Declining state
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=50.0,  # Worse
            food_hours_per_week=8.0,  # Worse
            healthcare_cost_percent=20.0,  # Worse
            education_affordability_score=40.0,  # Worse
            transportation_cost_percent=18.0,  # Worse
            discretionary_income_percent=5.0,  # Worse
            company_id="company_012",
            worker_count=500,
            average_wage=62_000.0  # Wage went up but purchasing power down!
        ))

        penalty = bond.should_activate_declining_penalty()
        assert penalty is True
        assert "declining" in bond.penalty_reason.lower()


class TestDistribution:
    """Test bond distribution"""

    def test_improvement_70_30_split(self):
        """Purchasing power improving = 70% workers, 30% company"""
        bond = create_purchasing_power_bond(
            bond_id="pp_013",
            company_id="company_013",
            company_name="Test Company",
            stake_amount=5_000_000.0
        )

        # Initial: current typical (bad)
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=45.0,
            food_hours_per_week=6.0,
            healthcare_cost_percent=18.0,
            education_affordability_score=55.0,
            transportation_cost_percent=15.0,
            discretionary_income_percent=12.0,
            company_id="company_013",
            worker_count=1000,
            average_wage=55_000.0
        ))

        # Latest: 1990s level restored
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=28.0,  # Better than 1990s
            food_hours_per_week=3.5,  # Better than 1990s
            healthcare_cost_percent=6.0,  # Better than 1990s
            education_affordability_score=80.0,
            transportation_cost_percent=8.0,
            discretionary_income_percent=28.0,  # Better than 1990s
            company_id="company_013",
            worker_count=1000,
            average_wage=75_000.0
        ))

        # Worker confirmation
        for i in range(10):
            bond.add_worker_attestation(WorkerAttestation(
                attestor_id=f"worker_{i}",
                attestation_date=datetime.now(),
                company_id="company_013",
                can_afford_housing=True,
                can_afford_food=True,
                can_afford_healthcare=True,
                can_save_money=True,
                purchasing_power_improving=True
            ))

        distribution = bond.distribute_to_workers()
        assert distribution is not None
        assert distribution.worker_share > 0
        assert distribution.company_share > 0
        assert abs(distribution.worker_share / distribution.company_share - 70/30) < 0.1

    def test_declining_100_percent_to_workers(self):
        """Purchasing power declining = 100% to workers"""
        bond = create_purchasing_power_bond(
            bond_id="pp_014",
            company_id="company_014",
            company_name="Bad Company",
            stake_amount=5_000_000.0
        )

        # Initial: okay
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=35.0,
            food_hours_per_week=5.0,
            healthcare_cost_percent=12.0,
            education_affordability_score=65.0,
            transportation_cost_percent=12.0,
            discretionary_income_percent=18.0,
            company_id="company_014",
            worker_count=500,
            average_wage=55_000.0
        ))

        # Latest: much worse
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=55.0,  # Much worse
            food_hours_per_week=9.0,  # Much worse
            healthcare_cost_percent=25.0,  # Much worse
            education_affordability_score=35.0,  # Much worse
            transportation_cost_percent=20.0,  # Much worse
            discretionary_income_percent=3.0,  # Much worse
            company_id="company_014",
            worker_count=500,
            average_wage=56_000.0  # Tiny raise, huge cost increases
        ))

        distribution = bond.distribute_to_workers()
        assert distribution is not None
        assert distribution.company_share == 0.0  # Company gets nothing
        assert distribution.worker_share > 0  # Workers get compensation


class TestRealWorldScenarios:
    """Real-world scenario tests"""

    def test_company_raises_wages_keeps_costs_low(self):
        """Company raises wages above inflation, workers thrive"""
        bond = create_purchasing_power_bond(
            bond_id="pp_real_001",
            company_id="good_company",
            company_name="Good Employer Inc",
            stake_amount=10_000_000.0
        )

        # 2 years ago
        bond.created_at = datetime.now() - timedelta(days=730)

        # Initial: typical current state
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=730),
            housing_cost_percent=42.0,
            food_hours_per_week=6.5,
            healthcare_cost_percent=16.0,
            education_affordability_score=58.0,
            transportation_cost_percent=13.0,
            discretionary_income_percent=14.0,
            company_id="good_company",
            worker_count=2000,
            average_wage=58_000.0
        ))

        # After 2 years: 1990s restored!
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=27.0,  # Company built affordable housing
            food_hours_per_week=3.5,  # Wages way up
            healthcare_cost_percent=5.0,  # Company subsidizes healthcare
            education_affordability_score=85.0,  # Free training programs
            transportation_cost_percent=7.0,  # Shuttle service
            discretionary_income_percent=30.0,  # Money left over!
            company_id="good_company",
            worker_count=2000,
            average_wage=85_000.0
        ))

        # Workers confirm
        for i in range(20):
            bond.add_worker_attestation(WorkerAttestation(
                attestor_id=f"worker_{i}",
                attestation_date=datetime.now(),
                company_id="good_company",
                can_afford_housing=True,
                can_afford_food=True,
                can_afford_healthcare=True,
                can_save_money=True,
                purchasing_power_improving=True,
                notes="Can finally afford a house, save money, feel secure"
            ))

        value = bond.calculate_bond_value()
        appreciation = bond.calculate_appreciation()

        print(f"\nGood Employer - Wages + Low Costs:")
        print(f"  Initial stake: ${bond.stake_amount:,.0f}")
        print(f"  Final value: ${value:,.0f}")
        print(f"  Appreciation: +{appreciation/bond.stake_amount*100:.1f}%")
        print(f"  Overall purchasing power: {bond.overall_purchasing_power_score():.2f}x")
        print(f"  Worker verification: {bond.worker_verification_multiplier():.2f}x")
        print(f"  Time multiplier: {bond.time_multiplier():.2f}x")

        assert appreciation > 0  # Bond appreciated

        distribution = bond.distribute_to_workers()
        assert distribution is not None
        assert bond.company_payout() > 0  # Company earned

    def test_company_raises_wages_but_raises_prices_too(self):
        """Company raises wages 3% but raises prices 15% - no real improvement"""
        bond = create_purchasing_power_bond(
            bond_id="pp_real_002",
            company_id="bad_company",
            company_name="Exploitative Corp",
            stake_amount=8_000_000.0
        )

        bond.created_at = datetime.now() - timedelta(days=365)

        # Initial
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            housing_cost_percent=40.0,
            food_hours_per_week=6.0,
            healthcare_cost_percent=15.0,
            education_affordability_score=60.0,
            transportation_cost_percent=12.0,
            discretionary_income_percent=15.0,
            company_id="bad_company",
            worker_count=1500,
            average_wage=55_000.0
        ))

        # After 1 year: wages up 3%, but costs up more
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=48.0,  # Worse (company raised rent on company housing)
            food_hours_per_week=7.5,  # Worse (food prices up)
            healthcare_cost_percent=18.0,  # Worse (reduced benefits)
            education_affordability_score=52.0,  # Worse
            transportation_cost_percent=15.0,  # Worse
            discretionary_income_percent=8.0,  # Much worse
            company_id="bad_company",
            worker_count=1500,
            average_wage=56_650.0  # +3% wages but purchasing power down
        ))

        value = bond.calculate_bond_value()
        appreciation = bond.calculate_appreciation()

        print(f"\nBad Company - Wages Up, Prices Up More:")
        print(f"  Initial stake: ${bond.stake_amount:,.0f}")
        print(f"  Final value: ${value:,.0f}")
        print(f"  Appreciation: {appreciation/bond.stake_amount*100:.1f}%")
        print(f"  Overall purchasing power: {bond.overall_purchasing_power_score():.2f}x")

        assert appreciation < 0  # Bond depreciated

        distribution = bond.distribute_to_workers()
        assert distribution is not None
        assert distribution.company_share == 0.0  # Company gets nothing
        assert distribution.worker_share > 0  # Workers get compensation

    def test_company_builds_affordable_housing(self):
        """Company builds affordable housing, housing costs drop"""
        bond = create_purchasing_power_bond(
            bond_id="pp_real_003",
            company_id="housing_company",
            company_name="Housing Builder Inc",
            stake_amount=15_000_000.0
        )

        bond.created_at = datetime.now() - timedelta(days=1095)  # 3 years

        # Initial: housing crisis
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now() - timedelta(days=1095),
            housing_cost_percent=52.0,  # Housing crisis!
            food_hours_per_week=5.5,
            healthcare_cost_percent=14.0,
            education_affordability_score=62.0,
            transportation_cost_percent=11.0,
            discretionary_income_percent=9.0,  # Almost nothing left
            company_id="housing_company",
            worker_count=3000,
            average_wage=62_000.0
        ))

        # After 3 years: built affordable housing complex
        bond.add_purchasing_power_data(PurchasingPowerMetrics(
            measurement_date=datetime.now(),
            housing_cost_percent=23.0,  # Massive improvement!
            food_hours_per_week=4.5,
            healthcare_cost_percent=12.0,
            education_affordability_score=70.0,
            transportation_cost_percent=9.0,
            discretionary_income_percent=32.0,  # Can save money!
            company_id="housing_company",
            worker_count=3000,
            average_wage=68_000.0
        ))

        # Workers confirm
        for i in range(30):
            bond.add_worker_attestation(WorkerAttestation(
                attestor_id=f"worker_{i}",
                attestation_date=datetime.now(),
                company_id="housing_company",
                can_afford_housing=True,
                can_afford_food=True,
                can_afford_healthcare=True,
                can_save_money=True,
                purchasing_power_improving=True,
                notes="Affordable housing changed our lives"
            ))

        value = bond.calculate_bond_value()
        appreciation = bond.calculate_appreciation()

        print(f"\nHousing Builder - Affordable Housing:")
        print(f"  Initial stake: ${bond.stake_amount:,.0f}")
        print(f"  Final value: ${value:,.0f}")
        print(f"  Appreciation: +{appreciation/bond.stake_amount*100:.1f}%")
        print(f"  Housing score: {bond.housing_affordability_score():.2f}x")
        print(f"  Discretionary income score: {bond.discretionary_income_score():.2f}x")

        assert appreciation > 0

        distribution = bond.distribute_to_workers()
        assert distribution is not None
        assert bond.company_payout() > 0
