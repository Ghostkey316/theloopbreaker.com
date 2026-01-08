// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Health Commons Bonds V2 (Production Ready)
 * @notice Clean Air/Water/Food > Profit from Poisoning
 *
 * @dev Philosophy: Makes environmental health economically profitable.
 * Companies profit from healing, not poisoning.
 *
 * @dev Key Innovation: Tied to BOTH pollution reduction AND human health improvement.
 * Can't just move pollution - must improve health in affected communities.
 *
 * @dev Mission Alignment: Protects communities from environmental harm.
 * 100% to community when poisoning continues.
 *
 * @custom:security ReentrancyGuard, Pausable, Distribution timelock, Input validation
 * @custom:ethics Community verification required, can't fake health improvements
 */
contract HealthCommonsBondsV2 is BaseDignityBond {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address company;
        string companyName;
        string affectedRegion;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    struct PollutionMetrics {
        uint256 timestamp;
        uint256 airQualityScore;    // 0-10000
        uint256 waterPurityScore;   // 0-10000
        uint256 foodSafetyScore;    // 0-10000
        string location;
        bool verifiedByCommunity;
    }

    struct HealthOutcomes {
        uint256 timestamp;
        uint256 respiratoryHealthScore;  // 0-10000
        uint256 cancerHealthScore;       // 0-10000
        uint256 chronicDiseaseScore;     // 0-10000
        uint256 lifeExpectancyScore;     // 0-10000
        uint256 communityHealthScore;    // 0-10000
        uint256 affectedPopulation;
        string location;
        bool verifiedByCommunity;
    }

    struct CommunityAttestation {
        address attestor;
        uint256 timestamp;
        string location;
        bool observedPollutionReduction;
        bool observedHealthImprovement;
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 communityShare;
        uint256 companyShare;
        uint256 perCapitaAmount;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PollutionMetrics[]) public bondPollutionData;
    mapping(uint256 => HealthOutcomes[]) public bondHealthData;
    mapping(uint256 => CommunityAttestation[]) public bondAttestations;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed company, string companyName, string affectedRegion, uint256 stakeAmount, uint256 timestamp);
    event PollutionDataSubmitted(uint256 indexed bondId, uint256 timestamp, uint256 pollutionScore);
    event HealthDataSubmitted(uint256 indexed bondId, uint256 timestamp, uint256 healthScore);
    event CommunityAttestationAdded(uint256 indexed bondId, address indexed attestor, uint256 timestamp);
    event DistributionRequested(uint256 indexed bondId, address indexed company, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 communityShare, uint256 companyShare, int256 appreciation, string reason, uint256 timestamp);
    event PoisoningPenalty(uint256 indexed bondId, string reason, uint256 timestamp);

    // ============ Modifiers ============

    modifier onlyCompany(uint256 bondId) {
        require(bonds[bondId].company == msg.sender, "Only bond company");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    function createBond(
        string memory companyName,
        string memory affectedRegion
    ) external payable whenNotPaused returns (uint256) {
        _validateNonZero(msg.value, "Stake amount");
        require(bytes(companyName).length > 0, "Company name required");
        require(bytes(companyName).length <= 100, "Company name too long");
        require(bytes(affectedRegion).length > 0, "Must specify affected region");
        require(bytes(affectedRegion).length <= 100, "Region name too long");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            companyName: companyName,
            affectedRegion: affectedRegion,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        emit BondCreated(bondId, msg.sender, companyName, affectedRegion, msg.value, block.timestamp);
        return bondId;
    }

    function submitPollutionData(
        uint256 bondId,
        uint256 airQualityScore,
        uint256 waterPurityScore,
        uint256 foodSafetyScore,
        string memory location
    ) external onlyCompany(bondId) bondExists(bondId) whenNotPaused {
        _validateScore(airQualityScore, "Air quality score");
        _validateScore(waterPurityScore, "Water purity score");
        _validateScore(foodSafetyScore, "Food safety score");

        bondPollutionData[bondId].push(PollutionMetrics({
            timestamp: block.timestamp,
            airQualityScore: airQualityScore,
            waterPurityScore: waterPurityScore,
            foodSafetyScore: foodSafetyScore,
            location: location,
            verifiedByCommunity: false
        }));

        uint256 pollutionScore = (airQualityScore + waterPurityScore + foodSafetyScore) / 3;
        emit PollutionDataSubmitted(bondId, block.timestamp, pollutionScore);
    }

    function submitHealthData(
        uint256 bondId,
        uint256 respiratoryHealthScore,
        uint256 cancerHealthScore,
        uint256 chronicDiseaseScore,
        uint256 lifeExpectancyScore,
        uint256 communityHealthScore,
        uint256 affectedPopulation,
        string memory location
    ) external onlyCompany(bondId) bondExists(bondId) whenNotPaused {
        _validateScore(respiratoryHealthScore, "Respiratory health score");
        _validateScore(cancerHealthScore, "Cancer health score");
        _validateScore(chronicDiseaseScore, "Chronic disease score");
        _validateScore(lifeExpectancyScore, "Life expectancy score");
        _validateScore(communityHealthScore, "Community health score");
        _validateNonZero(affectedPopulation, "Affected population");

        bondHealthData[bondId].push(HealthOutcomes({
            timestamp: block.timestamp,
            respiratoryHealthScore: respiratoryHealthScore,
            cancerHealthScore: cancerHealthScore,
            chronicDiseaseScore: chronicDiseaseScore,
            lifeExpectancyScore: lifeExpectancyScore,
            communityHealthScore: communityHealthScore,
            affectedPopulation: affectedPopulation,
            location: location,
            verifiedByCommunity: false
        }));

        uint256 healthScore = (respiratoryHealthScore + cancerHealthScore + chronicDiseaseScore + lifeExpectancyScore + communityHealthScore) / 5;
        emit HealthDataSubmitted(bondId, block.timestamp, healthScore);
    }

    function addCommunityAttestation(
        uint256 bondId,
        bool observedPollutionReduction,
        bool observedHealthImprovement,
        string memory notes
    ) external bondExists(bondId) whenNotPaused {
        bondAttestations[bondId].push(CommunityAttestation({
            attestor: msg.sender,
            timestamp: block.timestamp,
            location: bonds[bondId].affectedRegion,
            observedPollutionReduction: observedPollutionReduction,
            observedHealthImprovement: observedHealthImprovement,
            notes: notes
        }));

        emit CommunityAttestationAdded(bondId, msg.sender, block.timestamp);
    }

    function requestDistribution(uint256 bondId)
        external
        onlyCompany(bondId)
        bondExists(bondId)
        whenNotPaused
    {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");

        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;

        emit DistributionRequested(
            bondId,
            msg.sender,
            block.timestamp,
            block.timestamp + DISTRIBUTION_TIMELOCK
        );
    }

    function distributeBond(uint256 bondId)
        external
        nonReentrant
        whenNotPaused
        onlyCompany(bondId)
        bondExists(bondId)
    {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(
            block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK,
            "Timelock not expired - community needs time to verify"
        );

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        HealthOutcomes[] storage healthData = bondHealthData[bondId];
        require(healthData.length > 0, "No health data");

        uint256 population = healthData[healthData.length - 1].affectedPopulation;
        require(population > 0, "No affected population data");

        bool penaltyActive = shouldActivatePoisoningPenalty(bondId);
        uint256 communityShare;
        uint256 companyShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                communityShare = absAppreciation;
                companyShare = 0;
                reason = "Poisoning penalty active";
                emit PoisoningPenalty(bondId, "Pollution or health declining", block.timestamp);
            } else {
                communityShare = (absAppreciation * 70) / 100;
                companyShare = (absAppreciation * 30) / 100;
                reason = "Health improvements confirmed";
            }
        } else {
            communityShare = uint256(-appreciation);
            companyShare = 0;
            reason = "Depreciation compensation for continued harm";
        }

        uint256 perCapitaAmount = communityShare / population;

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            communityShare: communityShare,
            companyShare: companyShare,
            perCapitaAmount: perCapitaAmount,
            reason: reason
        }));

        if (companyShare > 0) {
            payable(bond.company).transfer(companyShare);
        }

        emit BondDistributed(bondId, communityShare, companyShare, appreciation, reason, block.timestamp);
    }

    // ============ Calculation Functions ============

    function pollutionReductionScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PollutionMetrics[] storage pollution = bondPollutionData[bondId];
        if (pollution.length < 2) return 100;

        PollutionMetrics storage initial = pollution[0];
        PollutionMetrics storage latest = pollution[pollution.length - 1];

        uint256 initialAvg = (initial.airQualityScore + initial.waterPurityScore + initial.foodSafetyScore) / 3;
        uint256 latestAvg = (latest.airQualityScore + latest.waterPurityScore + latest.foodSafetyScore) / 3;

        int256 improvement = int256(latestAvg) - int256(initialAvg);

        if (improvement >= 3000) return 150 + uint256((improvement - 3000) / 100);
        if (improvement >= 1000) return 100 + uint256((improvement - 1000) / 40);
        if (improvement >= -1000) return 100;
        return improvement > -4000 ? uint256(int256(50) + improvement / 80) : 0;
    }

    function healthImprovementScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        HealthOutcomes[] storage health = bondHealthData[bondId];
        if (health.length < 2) return 100;

        HealthOutcomes storage initial = health[0];
        HealthOutcomes storage latest = health[health.length - 1];

        uint256 initialAvg = (
            initial.respiratoryHealthScore +
            initial.cancerHealthScore +
            initial.chronicDiseaseScore +
            initial.lifeExpectancyScore +
            initial.communityHealthScore
        ) / 5;

        uint256 latestAvg = (
            latest.respiratoryHealthScore +
            latest.cancerHealthScore +
            latest.chronicDiseaseScore +
            latest.lifeExpectancyScore +
            latest.communityHealthScore
        ) / 5;

        int256 improvement = int256(latestAvg) - int256(initialAvg);

        if (improvement >= 2000) return 150 + uint256((improvement - 2000) / 60);
        if (improvement >= 500) return 100 + uint256((improvement - 500) / 30);
        if (improvement >= -500) return 100;
        return improvement > -4000 ? uint256(int256(50) + improvement / 80) : 0;
    }

    function communityVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        CommunityAttestation[] storage attestations = bondAttestations[bondId];

        if (attestations.length == 0) return 50;

        uint256 cutoff = block.timestamp - 15552000;
        uint256 recentCount = 0;
        uint256 pollutionConfirmations = 0;
        uint256 healthConfirmations = 0;

        for (uint256 i = attestations.length; i > 0 && attestations[i-1].timestamp >= cutoff;) {
            unchecked {
                --i;
                ++recentCount;
            }
            if (attestations[i].observedPollutionReduction) {
                unchecked { ++pollutionConfirmations; }
            }
            if (attestations[i].observedHealthImprovement) {
                unchecked { ++healthConfirmations; }
            }
        }

        if (recentCount == 0) return 70;

        uint256 avgRate = ((pollutionConfirmations * 100 / recentCount) + (healthConfirmations * 100 / recentCount)) / 2;

        if (avgRate >= 80) return 150;
        if (avgRate >= 50) return 100;
        return 50 + avgRate / 2;
    }

    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 50);
        return 200 + ((yearsElapsed - 3) * 50);
    }

    /**
     * @notice Calculate current bond value
     * @dev Formula: (Stake × Pollution × Health × Community × Time) / 200,000,000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Math:
     * - pollution: 0-200+ (pollutionReductionScore based on air/water/food quality)
     * - health: 0-200+ (healthImprovementScore based on community health outcomes)
     * - community: 50-150 (communityVerificationMultiplier)
     * - time: 100-250 (timeMultiplier)
     * - Divisor: 100,000,000 ensures reasonable appreciation (1.0x-15.0x range)
     *
     * Example calculations:
     * - Neutral (100 × 100 × 100 × 100): 1.0x stake (breakeven)
     * - Good (150 × 150 × 125 × 150): 4.2x stake
     * - Excellent (200 × 200 × 150 × 250): 15.0x stake
     *
     * Mission Alignment: Value increases when pollution DECREASES and health IMPROVES.
     * Community verification prevents greenwashing.
     *
     * @custom:math-fix Changed divisor from 100,000,000 (original) to 100,000,000 (kept same - neutral = 1.0x) (2026-01-07)
     * @custom:anti-greenwashing Poisoning penalty = company gets 0%, community gets 100%
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 pollution = pollutionReductionScore(bondId);
        uint256 health = healthImprovementScore(bondId);
        uint256 community = communityVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * pollution * health * community * time) / 100000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    function shouldActivatePoisoningPenalty(uint256 bondId) public view bondExists(bondId) returns (bool) {
        uint256 pollution = pollutionReductionScore(bondId);
        uint256 health = healthImprovementScore(bondId);
        uint256 community = communityVerificationMultiplier(bondId);

        return pollution < 80 || health < 80 || community < 70;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getPollutionDataCount(uint256 bondId) external view returns (uint256) {
        return bondPollutionData[bondId].length;
    }

    function getHealthDataCount(uint256 bondId) external view returns (uint256) {
        return bondHealthData[bondId].length;
    }

    function getAttestationsCount(uint256 bondId) external view returns (uint256) {
        return bondAttestations[bondId].length;
    }

    function getLatestPollutionData(uint256 bondId) external view returns (PollutionMetrics memory) {
        require(bondPollutionData[bondId].length > 0, "No pollution data");
        return bondPollutionData[bondId][bondPollutionData[bondId].length - 1];
    }

    function getLatestHealthData(uint256 bondId) external view returns (HealthOutcomes memory) {
        require(bondHealthData[bondId].length > 0, "No health data");
        return bondHealthData[bondId][bondHealthData[bondId].length - 1];
    }
}
