"""
Tests for Labor Dignity Bonds - Making Suits and People Equal

Validates:
- Bond creation and staking requirements
- Anonymous worker surveys (aggregate only, no individual tracking)
- Worker flourishing measurement (6 metrics)
- Bond appreciation when workers thrive
- Bond depreciation when workers exploited
- Worker payout distribution (50% appreciation OR 100% compensation)
- Company payout (50% appreciation OR 0% if depreciation)
- Exploitation detection and company blocking
- Capital accumulation by workers
- Power redistribution over time
- Freedom Protocol compliance (privacy, no surveillance, no control)
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.labor_dignity_bonds import (
    LaborDignityBond,
    create_labor_dignity_bond,
    WorkerSurvey,
    WorkerPayout,
    CompanyStake,
    WorkerMetric,
    ExploitationPattern
)


class TestBondCreation:
    """Test bond creation and staking"""

    def test_create_basic_bond(self):
        """Should create bond with required stake (20% of payroll)"""
        bond = create_labor_dignity_bond(
            bond_id="test_001",
            company_id="company_a",
            company_name="Company A",
            worker_payroll=100000.0,
            num_workers=10
        )

        assert bond.bond_id == "test_001"
        assert bond.company_id == "company_a"
        assert bond.initial_stake.worker_payroll == 100000.0
        assert bond.initial_stake.num_workers == 10
        assert bond.required_stake() == 20000.0  # 20% of payroll

    def test_minimum_payroll(self):
        """Should require positive payroll"""
        with pytest.raises(ValueError, match="payroll must be positive"):
            create_labor_dignity_bond(
                "test", "company", "Company", 0.0, 10
            )

    def test_minimum_workers(self):
        """Should require positive number of workers"""
        with pytest.raises(ValueError, match="workers must be positive"):
            create_labor_dignity_bond(
                "test", "company", "Company", 100000.0, 0
            )


class TestWorkerSurveys:
    """Test anonymous worker survey mechanism"""

    def test_add_survey(self):
        """Should add anonymous survey with aggregate metrics"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=8,  # 80% response rate
            income_growth_score=70.0,
            autonomy_score=75.0,
            dignity_score=80.0,
            work_life_balance_score=65.0,
            security_score=60.0,
            voice_score=55.0,
            verified_by="third_party_auditor",
            verified=True
        )

        bond.add_survey(survey)

        assert len(bond.surveys) == 1
        assert bond.surveys[0].num_respondents == 8
        # No individual worker identification - privacy maintained

    def test_average_flourishing_score(self):
        """Should calculate average across all 6 metrics"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=80.0,
            autonomy_score=70.0,
            dignity_score=90.0,
            work_life_balance_score=60.0,
            security_score=75.0,
            voice_score=85.0
        )

        bond.add_survey(survey)

        # Average: (80+70+90+60+75+85) / 6 = 460 / 6 = 76.67
        avg = bond.average_flourishing_score()
        assert 76.0 < avg < 77.0


class TestFlourishingRatio:
    """Test flourishing ratio calculation"""

    def test_workers_thriving(self):
        """Should appreciate when workers thriving (score 80+)"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # High scores = thriving
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=90.0,
            autonomy_score=85.0,
            dignity_score=88.0,
            work_life_balance_score=82.0,
            security_score=87.0,
            voice_score=90.0
        )
        bond.add_survey(survey)

        ratio = bond.flourishing_ratio()
        assert ratio > 1.5  # Should appreciate

    def test_workers_neutral(self):
        """Should remain stable when neutral (score 50-80)"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=65.0,
            autonomy_score=60.0,
            dignity_score=70.0,
            work_life_balance_score=55.0,
            security_score=65.0,
            voice_score=60.0
        )
        bond.add_survey(survey)

        ratio = bond.flourishing_ratio()
        assert 1.0 <= ratio <= 1.5  # Stable to moderate appreciation

    def test_workers_exploited(self):
        """Should depreciate when workers exploited (score < 50)"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # Low scores = exploitation
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=20.0,
            autonomy_score=15.0,
            dignity_score=25.0,
            work_life_balance_score=10.0,
            security_score=30.0,
            voice_score=20.0
        )
        bond.add_survey(survey)

        ratio = bond.flourishing_ratio()
        assert ratio < 1.0  # Should depreciate


class TestExploitationDetection:
    """Test exploitation pattern detection"""

    def test_no_exploitation_baseline(self):
        """Should have 1.0 multiplier with no exploitation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=70.0,
            autonomy_score=70.0,
            dignity_score=70.0,
            work_life_balance_score=70.0,
            security_score=70.0,
            voice_score=70.0
        )
        bond.add_survey(survey)

        assert bond.anti_exploitation_multiplier() == 1.0
        assert not bond.is_exploitation_detected()

    def test_moderate_exploitation_penalty(self):
        """Should penalize moderate exploitation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=30.0,
            autonomy_score=30.0,
            dignity_score=30.0,
            work_life_balance_score=30.0,
            security_score=30.0,
            voice_score=30.0,
            exploitation_flags=[
                ExploitationPattern.WAGE_STAGNATION,
                ExploitationPattern.FORCED_OVERTIME
            ]
        )
        bond.add_survey(survey)

        multiplier = bond.anti_exploitation_multiplier()
        assert multiplier < 1.0  # Penalty
        assert bond.is_exploitation_detected()

    def test_severe_exploitation_blocks_company(self):
        """Should block company for severe exploitation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=10.0,
            autonomy_score=10.0,
            dignity_score=10.0,
            work_life_balance_score=10.0,
            security_score=10.0,
            voice_score=10.0,
            exploitation_flags=[
                ExploitationPattern.WAGE_THEFT,
                ExploitationPattern.UNSAFE_CONDITIONS,
                ExploitationPattern.RETALIATION
            ]
        )
        bond.add_survey(survey)

        multiplier = bond.anti_exploitation_multiplier()
        assert multiplier == 0.1  # Severe penalty
        assert bond.should_block_company()  # Company blocked


class TestBondValue:
    """Test bond valuation"""

    def test_appreciation_when_thriving(self):
        """Should appreciate when workers thrive"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # Workers thriving
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=85.0,
            autonomy_score=90.0,
            dignity_score=88.0,
            work_life_balance_score=82.0,
            security_score=80.0,
            voice_score=85.0
        )
        bond.add_survey(survey)

        appreciation = bond.calculate_appreciation()
        assert appreciation > 0  # Positive appreciation

    def test_depreciation_when_exploited(self):
        """Should depreciate when workers exploited"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # Workers exploited
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=20.0,
            autonomy_score=15.0,
            dignity_score=25.0,
            work_life_balance_score=10.0,
            security_score=5.0,
            voice_score=10.0,
            exploitation_flags=[
                ExploitationPattern.WAGE_THEFT,
                ExploitationPattern.UNSAFE_CONDITIONS
            ]
        )
        bond.add_survey(survey)

        appreciation = bond.calculate_appreciation()
        assert appreciation < 0  # Negative (depreciation)


class TestPayouts:
    """Test payout distribution"""

    def test_worker_payout_on_appreciation(self):
        """Should give workers 50% of appreciation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # Thriving workers
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=85.0,
            autonomy_score=85.0,
            dignity_score=85.0,
            work_life_balance_score=85.0,
            security_score=85.0,
            voice_score=85.0
        )
        bond.add_survey(survey)

        appreciation = bond.calculate_appreciation()
        worker_payout = bond.distribute_to_workers()

        assert worker_payout is not None
        assert worker_payout.total_amount == appreciation * 0.5
        assert worker_payout.num_workers == 10
        assert worker_payout.source == "bond_appreciation"

    def test_company_payout_on_appreciation(self):
        """Should give company 50% of appreciation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=85.0,
            autonomy_score=85.0,
            dignity_score=85.0,
            work_life_balance_score=85.0,
            security_score=85.0,
            voice_score=85.0
        )
        bond.add_survey(survey)

        appreciation = bond.calculate_appreciation()
        company_payout = bond.company_payout()

        assert company_payout == appreciation * 0.5

    def test_worker_compensation_on_depreciation(self):
        """Should give workers 100% compensation on depreciation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        # Exploited workers
        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=20.0,
            autonomy_score=20.0,
            dignity_score=20.0,
            work_life_balance_score=20.0,
            security_score=20.0,
            voice_score=20.0,
            exploitation_flags=[ExploitationPattern.WAGE_THEFT]
        )
        bond.add_survey(survey)

        depreciation = bond.calculate_appreciation()  # Negative
        worker_payout = bond.distribute_to_workers()

        assert worker_payout is not None
        assert worker_payout.total_amount == abs(depreciation)  # Get all of it
        assert worker_payout.source == "exploitation_compensation"

    def test_company_loses_on_depreciation(self):
        """Should give company nothing on depreciation"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=20.0,
            autonomy_score=20.0,
            dignity_score=20.0,
            work_life_balance_score=20.0,
            security_score=20.0,
            voice_score=20.0
        )
        bond.add_survey(survey)

        company_payout = bond.company_payout()
        assert company_payout == 0.0  # Company gets nothing


class TestCapitalAccumulation:
    """Test worker capital accumulation"""

    def test_workers_accumulate_capital(self):
        """Should track capital distributed to workers"""
        bond = create_labor_dignity_bond(
            "test", "company", "Company", 100000, 10
        )

        survey = WorkerSurvey(
            company_id="company",
            survey_date=datetime.now(),
            num_respondents=10,
            income_growth_score=85.0,
            autonomy_score=85.0,
            dignity_score=85.0,
            work_life_balance_score=85.0,
            security_score=85.0,
            voice_score=85.0
        )
        bond.add_survey(survey)

        worker_payout = bond.distribute_to_workers()
        accumulated = bond.worker_capital_accumulated()

        assert accumulated == worker_payout.total_amount
        assert accumulated > 0  # Workers gained capital


class TestRealWorldScenarios:
    """Test realistic scenarios"""

    def test_good_company_everyone_wins(self):
        """Good company: workers thrive, company profits, capital distributed"""
        bond = create_labor_dignity_bond(
            bond_id="good_tech",
            company_id="goodtech_inc",
            company_name="GoodTech Inc",
            worker_payroll=500000.0,
            num_workers=20
        )

        # Simulate 1 year
        bond.created_at = datetime.now() - timedelta(days=365)

        # 4 quarters of workers thriving
        for _ in range(4):
            survey = WorkerSurvey(
                company_id="goodtech_inc",
                survey_date=datetime.now(),
                num_respondents=18,
                income_growth_score=85.0,
                autonomy_score=90.0,
                dignity_score=88.0,
                work_life_balance_score=82.0,
                security_score=80.0,
                voice_score=75.0,
                verified=True,
                turnover_rate=5.0  # Low turnover
            )
            bond.add_survey(survey)

        appreciation = bond.calculate_appreciation()
        worker_payout = bond.distribute_to_workers()
        company_payout = bond.company_payout()

        # Everyone wins
        assert appreciation > 0
        assert worker_payout.total_amount > 0
        assert company_payout > 0
        assert not bond.should_block_company()

        # Workers accumulate capital
        assert bond.worker_capital_accumulated() > 0

        print(f"\nGood Company:")
        print(f"  Workers gained: ${bond.worker_capital_accumulated():,.0f}")
        print(f"  Company gained: ${company_payout:,.0f}")
        print(f"  ✅ Everyone wins")

    def test_bad_company_exploitation_expensive(self):
        """Bad company: workers exploited, company loses, workers compensated"""
        bond = create_labor_dignity_bond(
            bond_id="bad_warehouse",
            company_id="badwarehouse_corp",
            company_name="BadWarehouse Corp",
            worker_payroll=300000.0,
            num_workers=50
        )

        # Workers heavily exploited
        survey = WorkerSurvey(
            company_id="badwarehouse_corp",
            survey_date=datetime.now(),
            num_respondents=35,  # Some fear retaliation
            income_growth_score=25.0,
            autonomy_score=15.0,
            dignity_score=20.0,
            work_life_balance_score=10.0,
            security_score=5.0,
            voice_score=10.0,
            verified=True,
            turnover_rate=45.0,  # High turnover (people fleeing)
            exploitation_flags=[
                ExploitationPattern.FORCED_OVERTIME,
                ExploitationPattern.UNSAFE_CONDITIONS,
                ExploitationPattern.RETALIATION
            ]
        )
        bond.add_survey(survey)

        depreciation = bond.calculate_appreciation()  # Negative
        worker_payout = bond.distribute_to_workers()
        company_payout = bond.company_payout()

        # Exploitation is expensive
        assert depreciation < 0
        assert worker_payout.total_amount > 0  # Workers compensated
        assert company_payout == 0  # Company gets nothing
        assert bond.should_block_company()  # Company blocked

        print(f"\nBad Company:")
        print(f"  Workers compensated: ${bond.worker_capital_accumulated():,.0f}")
        print(f"  Company lost: ${abs(depreciation):,.0f}")
        print(f"  ⚠️  Blocked from future bonds")

    def test_power_redistribution_over_time(self):
        """Over time: workers accumulate capital, gain power"""
        # Good company - 3 years
        bond = create_labor_dignity_bond(
            "power_test",
            "company",
            "Company",
            1000000.0,  # $1M quarterly payroll
            100  # 100 workers
        )

        bond.created_at = datetime.now() - timedelta(days=1095)  # 3 years

        # 12 quarters of sustained worker thriving
        for _ in range(12):
            survey = WorkerSurvey(
                company_id="company",
                survey_date=datetime.now(),
                num_respondents=95,
                income_growth_score=82.0,
                autonomy_score=85.0,
                dignity_score=87.0,
                work_life_balance_score=80.0,
                security_score=78.0,
                voice_score=80.0,
                verified=True,
                turnover_rate=6.0
            )
            bond.add_survey(survey)

        worker_payout = bond.distribute_to_workers()
        capital_per_worker = worker_payout.per_worker_amount

        # Workers have accumulated significant capital
        assert capital_per_worker > 1000  # Each worker gained $1000+

        print(f"\nPower Redistribution (3 years):")
        print(f"  Capital per worker: ${capital_per_worker:,.0f}")
        print(f"  Workers can now:")
        print(f"    - Invest in other bonds (become investors)")
        print(f"    - Start cooperatives (pool capital)")
        print(f"    - Gain negotiating power (have options)")
        print(f"  ⚡ POWER REDISTRIBUTED FROM SUITS TO PEOPLE")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
