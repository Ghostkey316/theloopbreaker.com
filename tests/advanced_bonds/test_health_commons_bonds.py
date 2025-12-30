"""
Tests for Health Commons Bonds

Validates:
- Pollution tracking (air, water, food)
- Health outcome measurement
- Community verification
- Poisoning penalties
- Distribution to affected communities
"""

import pytest
from datetime import datetime, timedelta
from vaultfire.advanced_bonds.health_commons_bonds import (
    HealthCommonsBond,
    PollutionSource,
    PollutionMetrics,
    HealthOutcomes,
    CommunityAttestation,
    create_health_commons_bond
)


class TestHealthCommonsBondCreation:
    """Test bond creation"""

    def test_create_bond(self):
        """Should create Health Commons Bond"""
        bond = create_health_commons_bond(
            bond_id="hc_001",
            company_id="chemical_co",
            company_name="Chemical Manufacturing Co",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Industrial District",
            stake_amount=1_000_000.0
        )

        assert bond.bond_id == "hc_001"
        assert bond.company_name == "Chemical Manufacturing Co"
        assert bond.pollution_source == PollutionSource.INDUSTRIAL_AIR
        assert bond.affected_region == "Industrial District"
        assert bond.stake_amount == 1_000_000.0
        assert len(bond.pollution_data) == 0
        assert len(bond.health_data) == 0


class TestPollutionTracking:
    """Test pollution measurement"""

    def test_add_pollution_data(self):
        """Should track pollution metrics over time"""
        bond = create_health_commons_bond(
            bond_id="hc_002",
            company_id="factory",
            company_name="Factory",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Downwind Community",
            stake_amount=500_000.0
        )

        # Initial pollution (poor)
        initial = PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=30.0,  # Bad air
            water_purity_score=40.0,  # Contaminated water
            food_safety_score=50.0,  # Some toxins
            measurement_location="Downwind Community",
            verified_by_community=True
        )
        bond.add_pollution_data(initial)

        # After cleanup (better)
        current = PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=70.0,  # Much better
            water_purity_score=75.0,  # Clean
            food_safety_score=80.0,  # Safe
            measurement_location="Downwind Community",
            verified_by_community=True
        )
        bond.add_pollution_data(current)

        assert len(bond.pollution_data) == 2
        assert bond.pollution_reduction_score() > 1.5  # Significant improvement


class TestHealthOutcomes:
    """Test human health tracking"""

    def test_add_health_data(self):
        """Should track health outcomes in affected community"""
        bond = create_health_commons_bond(
            bond_id="hc_003",
            company_id="polluter",
            company_name="Polluter Inc",
            pollution_source=PollutionSource.CHEMICAL_MANUFACTURING,
            affected_region="Affected Town",
            stake_amount=2_000_000.0
        )

        # Initial health (poor)
        initial_health = HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=40.0,  # High asthma rates
            cancer_health_score=50.0,  # Cancer cluster
            chronic_disease_score=45.0,  # High chronic disease
            life_expectancy_score=55.0,  # Below average
            community_health_score=40.0,  # People feel sick
            affected_population_size=10_000,
            measurement_location="Affected Town",
            verified_by_community=True
        )
        bond.add_health_data(initial_health)

        # After cleanup (better)
        current_health = HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=70.0,  # Fewer asthma cases
            cancer_health_score=75.0,  # Cancer rates dropping
            chronic_disease_score=72.0,  # Chronic disease improving
            life_expectancy_score=75.0,  # Life expectancy up
            community_health_score=70.0,  # People feel healthier
            affected_population_size=10_000,
            measurement_location="Affected Town",
            verified_by_community=True
        )
        bond.add_health_data(current_health)

        assert len(bond.health_data) == 2
        assert bond.health_improvement_score() > 1.5  # Major improvement


class TestCommunityVerification:
    """Test community attestation"""

    def test_community_attestation(self):
        """Community members verify improvements"""
        bond = create_health_commons_bond(
            bond_id="hc_004",
            company_id="cleaner",
            company_name="Getting Cleaner Co",
            pollution_source=PollutionSource.WATER_DISCHARGE,
            affected_region="Riverside",
            stake_amount=750_000.0
        )

        # Community members attest
        for i in range(5):
            attestation = CommunityAttestation(
                attestor_id=f"community_member_{i}",
                attestation_date=datetime.now(),
                location="Riverside",
                observed_pollution_reduction=True,
                observed_health_improvement=True,
                notes="Water is much cleaner, kids can swim again"
            )
            bond.add_community_attestation(attestation)

        assert len(bond.community_attestations) == 5
        assert bond.community_verification_multiplier() == 1.5  # Strong consensus

    def test_no_community_verification_penalty(self):
        """No community verification = penalty"""
        bond = create_health_commons_bond(
            bond_id="hc_005",
            company_id="no_verify",
            company_name="No Verification Co",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Skeptical Town",
            stake_amount=500_000.0
        )

        # No attestations
        assert bond.community_verification_multiplier() == 0.5  # Penalty

    def test_wrong_location_rejected(self):
        """Can't verify from different location"""
        bond = create_health_commons_bond(
            bond_id="hc_006",
            company_id="faker",
            company_name="Faker Corp",
            pollution_source=PollutionSource.FOOD_PRODUCTION,
            affected_region="Affected Area",
            stake_amount=300_000.0
        )

        attestation = CommunityAttestation(
            attestor_id="outsider",
            attestation_date=datetime.now(),
            location="Different Area",  # Wrong location
            observed_pollution_reduction=True,
            observed_health_improvement=True
        )

        with pytest.raises(ValueError, match="must be from affected region"):
            bond.add_community_attestation(attestation)


class TestPollutionReductionScore:
    """Test pollution reduction calculations"""

    def test_significant_reduction(self):
        """Major pollution cleanup = high multiplier"""
        bond = create_health_commons_bond(
            bond_id="hc_007",
            company_id="cleanup",
            company_name="Major Cleanup Co",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Cleanup Zone",
            stake_amount=1_000_000.0
        )

        # Before: very polluted
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=20.0,
            water_purity_score=25.0,
            food_safety_score=30.0,
            measurement_location="Cleanup Zone"
        ))

        # After: much cleaner
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=80.0,  # +60
            water_purity_score=85.0,  # +60
            food_safety_score=90.0,  # +60
            measurement_location="Cleanup Zone"
        ))

        score = bond.pollution_reduction_score()
        assert score >= 1.8  # Major improvement (+60 average)

    def test_worsening_pollution(self):
        """Pollution getting worse = depreciation"""
        bond = create_health_commons_bond(
            bond_id="hc_008",
            company_id="worse",
            company_name="Getting Worse Co",
            pollution_source=PollutionSource.CHEMICAL_MANUFACTURING,
            affected_region="Toxic Zone",
            stake_amount=500_000.0
        )

        # Before: moderate
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=50.0,
            water_purity_score=55.0,
            food_safety_score=60.0,
            measurement_location="Toxic Zone"
        ))

        # After: worse
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=30.0,  # -20
            water_purity_score=35.0,  # -20
            food_safety_score=25.0,  # -35
            measurement_location="Toxic Zone"
        ))

        score = bond.pollution_reduction_score()
        assert score < 0.5  # Severe penalty


class TestHealthImprovementScore:
    """Test health improvement calculations"""

    def test_major_health_improvement(self):
        """Significant health gains = high multiplier"""
        bond = create_health_commons_bond(
            bond_id="hc_009",
            company_id="healer",
            company_name="Health Improver Co",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Healing Town",
            stake_amount=1_500_000.0
        )

        # Before: poor health
        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=730),  # 2 years ago
            respiratory_health_score=30.0,
            cancer_health_score=40.0,
            chronic_disease_score=35.0,
            life_expectancy_score=45.0,
            community_health_score=40.0,
            affected_population_size=15_000,
            measurement_location="Healing Town"
        ))

        # After: much better
        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=75.0,  # +45
            cancer_health_score=80.0,  # +40
            chronic_disease_score=78.0,  # +43
            life_expectancy_score=82.0,  # +37
            community_health_score=80.0,  # +40
            affected_population_size=15_000,
            measurement_location="Healing Town"
        ))

        score = bond.health_improvement_score()
        assert score >= 1.8  # Major health improvement

    def test_declining_health(self):
        """Health getting worse = severe penalty"""
        bond = create_health_commons_bond(
            bond_id="hc_010",
            company_id="poisoner",
            company_name="Ongoing Poisoner Inc",
            pollution_source=PollutionSource.WATER_DISCHARGE,
            affected_region="Sick Town",
            stake_amount=1_000_000.0
        )

        # Before: moderate
        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=60.0,
            cancer_health_score=65.0,
            chronic_disease_score=60.0,
            life_expectancy_score=70.0,
            community_health_score=65.0,
            affected_population_size=8_000,
            measurement_location="Sick Town"
        ))

        # After: worse
        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=40.0,  # -20
            cancer_health_score=35.0,  # -30
            chronic_disease_score=38.0,  # -22
            life_expectancy_score=45.0,  # -25
            community_health_score=40.0,  # -25
            affected_population_size=8_000,
            measurement_location="Sick Town"
        ))

        score = bond.health_improvement_score()
        assert score < 0.3  # Severe penalty for making health worse


class TestPoisoningPenalty:
    """Test poisoning penalty activation"""

    def test_poisoning_penalty_activates(self):
        """Penalty activates when poisoning continues"""
        bond = create_health_commons_bond(
            bond_id="hc_011",
            company_id="bad_actor",
            company_name="Bad Actor Corp",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Victim Town",
            stake_amount=2_000_000.0
        )

        # Pollution worsened
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=50.0,
            water_purity_score=50.0,
            food_safety_score=50.0,
            measurement_location="Victim Town"
        ))

        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=30.0,  # Worse
            water_purity_score=25.0,  # Worse
            food_safety_score=20.0,  # Worse
            measurement_location="Victim Town"
        ))

        assert bond.should_activate_poisoning_penalty()
        assert "Pollution worsened" in bond.penalty_reason

    def test_health_decline_triggers_penalty(self):
        """Health decline triggers penalty"""
        bond = create_health_commons_bond(
            bond_id="hc_012",
            company_id="health_harm",
            company_name="Health Harmer Inc",
            pollution_source=PollutionSource.CHEMICAL_MANUFACTURING,
            affected_region="Harmed Area",
            stake_amount=1_000_000.0
        )

        # Health declined
        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=60.0,
            cancer_health_score=60.0,
            chronic_disease_score=60.0,
            life_expectancy_score=65.0,
            community_health_score=60.0,
            affected_population_size=5_000,
            measurement_location="Harmed Area"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=35.0,  # Much worse
            cancer_health_score=30.0,  # Much worse
            chronic_disease_score=32.0,  # Much worse
            life_expectancy_score=40.0,  # Much worse
            community_health_score=35.0,  # Much worse
            affected_population_size=5_000,
            measurement_location="Harmed Area"
        ))

        assert bond.should_activate_poisoning_penalty()
        assert "health declined" in bond.penalty_reason.lower()


class TestDistribution:
    """Test distribution to community"""

    def test_improvement_70_30_split(self):
        """Health improving = 70% community, 30% company"""
        bond = create_health_commons_bond(
            bond_id="hc_013",
            company_id="good_co",
            company_name="Good Company",
            pollution_source=PollutionSource.FOOD_PRODUCTION,
            affected_region="Beneficiary Town",
            stake_amount=1_000_000.0
        )

        # Setup improvement scenario
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=40.0,
            water_purity_score=45.0,
            food_safety_score=50.0,
            measurement_location="Beneficiary Town"
        ))

        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=80.0,
            water_purity_score=85.0,
            food_safety_score=90.0,
            measurement_location="Beneficiary Town"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=45.0,
            cancer_health_score=50.0,
            chronic_disease_score=48.0,
            life_expectancy_score=55.0,
            community_health_score=50.0,
            affected_population_size=12_000,
            measurement_location="Beneficiary Town"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=80.0,
            cancer_health_score=85.0,
            chronic_disease_score=82.0,
            life_expectancy_score=88.0,
            community_health_score=85.0,
            affected_population_size=12_000,
            measurement_location="Beneficiary Town"
        ))

        # Add community verification
        for i in range(7):
            bond.add_community_attestation(CommunityAttestation(
                attestor_id=f"verifier_{i}",
                attestation_date=datetime.now(),
                location="Beneficiary Town",
                observed_pollution_reduction=True,
                observed_health_improvement=True
            ))

        distribution = bond.distribute_to_community()
        assert distribution is not None
        assert abs(distribution.community_share / distribution.total_amount - 0.7) < 0.01  # 70%
        assert abs(distribution.company_share / distribution.total_amount - 0.3) < 0.01  # 30%

    def test_poisoning_100_percent_to_community(self):
        """Continued poisoning = 100% to community"""
        bond = create_health_commons_bond(
            bond_id="hc_014",
            company_id="poisoner2",
            company_name="Continued Poisoner",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Poisoned Area",
            stake_amount=1_500_000.0
        )

        # Pollution worsened
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=50.0,
            water_purity_score=50.0,
            food_safety_score=50.0,
            measurement_location="Poisoned Area"
        ))

        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=25.0,  # Much worse
            water_purity_score=20.0,  # Much worse
            food_safety_score=30.0,  # Worse
            measurement_location="Poisoned Area"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=55.0,
            cancer_health_score=60.0,
            chronic_disease_score=58.0,
            life_expectancy_score=65.0,
            community_health_score=60.0,
            affected_population_size=20_000,
            measurement_location="Poisoned Area"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=30.0,  # Worse
            cancer_health_score=28.0,  # Worse
            chronic_disease_score=32.0,  # Worse
            life_expectancy_score=35.0,  # Worse
            community_health_score=30.0,  # Worse
            affected_population_size=20_000,
            measurement_location="Poisoned Area"
        ))

        distribution = bond.distribute_to_community()
        assert distribution is not None
        assert distribution.company_share == 0.0  # Company gets nothing
        assert distribution.community_share > 0  # Community gets compensation
        assert "depreciation" in distribution.reason.lower() or "compensation" in distribution.reason.lower()


class TestRealWorldScenarios:
    """Real-world scenario tests"""

    def test_chemical_plant_cleanup(self):
        """Chemical plant cleans up emissions"""
        bond = create_health_commons_bond(
            bond_id="hc_real_001",
            company_id="chem_plant",
            company_name="Chemical Plant Inc",
            pollution_source=PollutionSource.INDUSTRIAL_AIR,
            affected_region="Downwind Neighborhood",
            stake_amount=5_000_000.0
        )

        # 2 years ago: heavy pollution
        bond.created_at = datetime.now() - timedelta(days=730)

        # Initial state: bad
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=730),
            air_quality_score=25.0,  # Terrible air
            water_purity_score=30.0,  # Runoff contamination
            food_safety_score=40.0,  # Garden toxins
            measurement_location="Downwind Neighborhood"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=730),
            respiratory_health_score=30.0,  # High asthma
            cancer_health_score=35.0,  # Cancer cluster
            chronic_disease_score=40.0,  # Many sick
            life_expectancy_score=45.0,  # 10 years below average
            community_health_score=35.0,  # People feel terrible
            affected_population_size=25_000,
            measurement_location="Downwind Neighborhood"
        ))

        # After cleanup: much better
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=75.0,  # Clean air! +50
            water_purity_score=80.0,  # No runoff +50
            food_safety_score=85.0,  # Safe gardens +45
            measurement_location="Downwind Neighborhood"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=80.0,  # Asthma rates way down +50
            cancer_health_score=78.0,  # No new cases +43
            chronic_disease_score=75.0,  # People recovering +35
            life_expectancy_score=82.0,  # Back to normal +37
            community_health_score=80.0,  # People feel healthy +45
            affected_population_size=25_000,
            measurement_location="Downwind Neighborhood"
        ))

        # Community confirms
        for i in range(10):
            bond.add_community_attestation(CommunityAttestation(
                attestor_id=f"neighbor_{i}",
                attestation_date=datetime.now(),
                location="Downwind Neighborhood",
                observed_pollution_reduction=True,
                observed_health_improvement=True,
                notes="Air is clean, kids can play outside, cancer rates dropping"
            ))

        value = bond.calculate_bond_value()
        appreciation = bond.calculate_appreciation()

        print(f"\nChemical Plant Cleanup:")
        print(f"  Initial stake: ${bond.stake_amount:,.0f}")
        print(f"  Final value: ${value:,.0f}")
        print(f"  Appreciation: +{appreciation/bond.stake_amount*100:.1f}%")
        print(f"  Pollution score: {bond.pollution_reduction_score():.2f}x")
        print(f"  Health score: {bond.health_improvement_score():.2f}x")
        print(f"  Community verification: {bond.community_verification_multiplier():.2f}x")
        print(f"  Time multiplier: {bond.time_multiplier():.2f}x")

        assert appreciation > 0  # Bond appreciated

        # Distribute to community to calculate payouts
        distribution = bond.distribute_to_community()
        assert distribution is not None
        assert bond.company_payout() > 0  # Company earned

    def test_food_producer_eliminating_pesticides(self):
        """Food company eliminates toxic pesticides"""
        bond = create_health_commons_bond(
            bond_id="hc_real_002",
            company_id="food_corp",
            company_name="Big Food Corp",
            pollution_source=PollutionSource.FOOD_PRODUCTION,
            affected_region="Agricultural Valley",
            stake_amount=3_000_000.0
        )

        bond.created_at = datetime.now() - timedelta(days=1095)  # 3 years

        # Before: heavy pesticide use
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=1095),
            air_quality_score=45.0,  # Spray drift
            water_purity_score=35.0,  # Runoff
            food_safety_score=40.0,  # High residues
            measurement_location="Agricultural Valley"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=1095),
            respiratory_health_score=50.0,  # Spray exposure
            cancer_health_score=45.0,  # Elevated rates
            chronic_disease_score=48.0,  # Neurological issues
            life_expectancy_score=52.0,  # Below average
            community_health_score=45.0,  # Concerns
            affected_population_size=30_000,
            measurement_location="Agricultural Valley"
        ))

        # After: organic, no pesticides
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=90.0,  # No spray +45
            water_purity_score=88.0,  # Clean +53
            food_safety_score=95.0,  # Organic +55
            measurement_location="Agricultural Valley"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=85.0,  # No exposure +35
            cancer_health_score=82.0,  # Rates dropped +37
            chronic_disease_score=80.0,  # Neurological improving +32
            life_expectancy_score=88.0,  # Back to normal +36
            community_health_score=90.0,  # People thriving +45
            affected_population_size=30_000,
            measurement_location="Agricultural Valley"
        ))

        # Strong community support
        for i in range(15):
            bond.add_community_attestation(CommunityAttestation(
                attestor_id=f"farmer_{i}",
                attestation_date=datetime.now(),
                location="Agricultural Valley",
                observed_pollution_reduction=True,
                observed_health_improvement=True,
                notes="Water is clean, wildlife returning, kids are healthier"
            ))

        appreciation = bond.calculate_appreciation()
        print(f"\nFood Producer Cleanup:")
        print(f"  3-year appreciation: +{appreciation/bond.stake_amount*100:.1f}%")

        assert appreciation > bond.stake_amount * 2  # Major appreciation

    def test_industrial_facility_making_worse(self):
        """Industrial facility makes pollution worse"""
        bond = create_health_commons_bond(
            bond_id="hc_real_003",
            company_id="bad_factory",
            company_name="Bad Factory LLC",
            pollution_source=PollutionSource.WASTE_DISPOSAL,
            affected_region="Toxic Waste Zone",
            stake_amount=2_000_000.0
        )

        # Started bad
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now() - timedelta(days=365),
            air_quality_score=45.0,
            water_purity_score=40.0,
            food_safety_score=50.0,
            measurement_location="Toxic Waste Zone"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now() - timedelta(days=365),
            respiratory_health_score=50.0,
            cancer_health_score=55.0,
            chronic_disease_score=52.0,
            life_expectancy_score=58.0,
            community_health_score=50.0,
            affected_population_size=8_000,
            measurement_location="Toxic Waste Zone"
        ))

        # Got worse
        bond.add_pollution_data(PollutionMetrics(
            measurement_date=datetime.now(),
            air_quality_score=20.0,  # Much worse -25
            water_purity_score=15.0,  # Terrible -25
            food_safety_score=25.0,  # Contaminated -25
            measurement_location="Toxic Waste Zone"
        ))

        bond.add_health_data(HealthOutcomes(
            measurement_date=datetime.now(),
            respiratory_health_score=25.0,  # Epidemic -25
            cancer_health_score=20.0,  # Cluster expanding -35
            chronic_disease_score=22.0,  # Many sick -30
            life_expectancy_score=30.0,  # Plummeting -28
            community_health_score=20.0,  # Crisis -30
            affected_population_size=8_000,
            measurement_location="Toxic Waste Zone"
        ))

        appreciation = bond.calculate_appreciation()
        distribution = bond.distribute_to_community()

        print(f"\nBad Factory:")
        print(f"  Depreciation: {appreciation/bond.stake_amount*100:.1f}%")
        print(f"  Community compensation: ${distribution.community_share:,.0f}")
        print(f"  Company payout: ${distribution.company_share:,.0f}")

        assert appreciation < 0  # Bond depreciated
        assert distribution.company_share == 0  # Company gets nothing
        assert distribution.community_share > 0  # Community gets compensation


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
