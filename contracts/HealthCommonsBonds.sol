// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Health Commons Bonds
 * @notice Clean Air/Water/Food > Profit from Poisoning
 *
 * Philosophy: Makes environmental health economically profitable.
 * Companies profit from healing, not poisoning.
 *
 * Key Innovation: Tied to BOTH pollution reduction AND human health improvement.
 * Can't just move pollution - must improve health in affected communities.
 */
contract HealthCommonsBonds {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address company;
        string companyName;
        string affectedRegion;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct PollutionMetrics {
        uint256 timestamp;
        uint256 airQualityScore;    // 0-10000 (100 = perfect, scaled by 100)
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

    event BondCreated(uint256 indexed bondId, address indexed company, string affectedRegion);
    event PollutionDataSubmitted(uint256 indexed bondId, uint256 timestamp);
    event HealthDataSubmitted(uint256 indexed bondId, uint256 timestamp);
    event CommunityAttestationAdded(uint256 indexed bondId, address indexed attestor);
    event BondDistributed(uint256 indexed bondId, uint256 communityShare, uint256 companyShare);

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
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(bytes(affectedRegion).length > 0, "Must specify affected region");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            companyName: companyName,
            affectedRegion: affectedRegion,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, affectedRegion);
        return bondId;
    }

    function submitPollutionData(
        uint256 bondId,
        uint256 airQualityScore,
        uint256 waterPurityScore,
        uint256 foodSafetyScore,
        string memory location
    ) external onlyCompany(bondId) bondExists(bondId) {
        bondPollutionData[bondId].push(PollutionMetrics({
            timestamp: block.timestamp,
            airQualityScore: airQualityScore,
            waterPurityScore: waterPurityScore,
            foodSafetyScore: foodSafetyScore,
            location: location,
            verifiedByCommunity: false
        }));

        emit PollutionDataSubmitted(bondId, block.timestamp);
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
    ) external onlyCompany(bondId) bondExists(bondId) {
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

        emit HealthDataSubmitted(bondId, block.timestamp);
    }

    function addCommunityAttestation(
        uint256 bondId,
        bool observedPollutionReduction,
        bool observedHealthImprovement,
        string memory notes
    ) external bondExists(bondId) {
        bondAttestations[bondId].push(CommunityAttestation({
            attestor: msg.sender,
            timestamp: block.timestamp,
            location: bonds[bondId].affectedRegion,
            observedPollutionReduction: observedPollutionReduction,
            observedHealthImprovement: observedHealthImprovement,
            notes: notes
        }));

        emit CommunityAttestationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    function pollutionReductionScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PollutionMetrics[] storage pollution = bondPollutionData[bondId];
        if (pollution.length < 2) return 100; // 1.0x default

        // Average pollution scores
        PollutionMetrics storage initial = pollution[0];
        PollutionMetrics storage latest = pollution[pollution.length - 1];

        uint256 initialAvg = (initial.airQualityScore + initial.waterPurityScore + initial.foodSafetyScore) / 3;
        uint256 latestAvg = (latest.airQualityScore + latest.waterPurityScore + latest.foodSafetyScore) / 3;

        int256 improvement = int256(latestAvg) - int256(initialAvg);

        // Significant cleanup (+30 points or more)
        if (improvement >= 3000) return 150 + uint256((improvement - 3000) / 100);
        // Moderate improvement (+10 to +30 points)
        if (improvement >= 1000) return 100 + uint256((improvement - 1000) / 40);
        // Stable (-10 to +10)
        if (improvement >= -1000) return 100;
        // Getting worse
        return improvement > -4000 ? uint256(50 + improvement / 80) : 0;
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

        // Major health improvement (+20 points or more)
        if (improvement >= 2000) return 150 + uint256((improvement - 2000) / 60);
        // Moderate improvement (+5 to +20)
        if (improvement >= 500) return 100 + uint256((improvement - 500) / 30);
        // Stable
        if (improvement >= -500) return 100;
        // Health declining
        return improvement > -4000 ? uint256(50 + improvement / 80) : 0;
    }

    function communityVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        CommunityAttestation[] storage attestations = bondAttestations[bondId];

        if (attestations.length == 0) return 50; // No verification = penalty

        // Check recent (last ~180 days)
        uint256 cutoff = block.timestamp - 15552000;
        uint256 recentCount = 0;
        uint256 pollutionConfirmations = 0;
        uint256 healthConfirmations = 0;

        for (uint256 i = attestations.length; i > 0 && attestations[i-1].timestamp >= cutoff; i--) {
            recentCount++;
            if (attestations[i-1].observedPollutionReduction) pollutionConfirmations++;
            if (attestations[i-1].observedHealthImprovement) healthConfirmations++;
        }

        if (recentCount == 0) return 70; // Old attestations

        uint256 avgRate = ((pollutionConfirmations * 100 / recentCount) + (healthConfirmations * 100 / recentCount)) / 2;

        if (avgRate >= 80) return 150;  // Strong consensus
        if (avgRate >= 50) return 100;  // Moderate
        return 50 + avgRate / 2;         // Weak
    }

    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 years = age / 31536000;

        if (years < 1) return 100;
        if (years < 3) return 100 + (years * 50);
        return 200 + ((years - 3) * 50);
    }

    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 pollution = pollutionReductionScore(bondId);
        uint256 health = healthImprovementScore(bondId);
        uint256 community = communityVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * pollution * health * community * time) / 1000000;
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

    function distributeBond(uint256 bondId) external onlyCompany(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
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

        emit BondDistributed(bondId, communityShare, companyShare);
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
