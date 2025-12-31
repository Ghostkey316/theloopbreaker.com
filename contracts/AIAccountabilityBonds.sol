// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AI Accountability Bonds
 * @notice AI can only profit when ALL humans thrive - Works even with ZERO employment
 *
 * Philosophy: The ONLY economic system that works when AI fires everyone.
 * Creates AI companies that profit from human thriving, not human obsolescence.
 *
 * Key Innovation: Works with ZERO employment.
 * Measures purpose/education, not jobs.
 */
contract AIAccountabilityBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address aiCompany;
        string companyName;
        uint256 quarterlyRevenue;      // Revenue this bond is staking (30%)
        uint256 stakeAmount;            // 30% of quarterly revenue
        uint256 createdAt;
        bool active;
    }

    struct GlobalFlourishingMetrics {
        uint256 timestamp;
        uint256 incomeDistributionScore;  // 0-10000 (wealth spreading or concentrating?)
        uint256 povertyRateScore;         // 0-10000 (people escaping poverty?)
        uint256 healthOutcomesScore;      // 0-10000 (life expectancy improving?)
        uint256 mentalHealthScore;        // 0-10000 (depression/anxiety rates?)
        uint256 educationAccessScore;     // 0-10000 (can people learn AI skills?)
        uint256 purposeAgencyScore;       // 0-10000 (meaningful activities - paid OR unpaid?)
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 humanShare;
        uint256 aiCompanyShare;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => GlobalFlourishingMetrics[]) public bondMetrics;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // Profit locking thresholds
    uint256 public constant SUFFERING_THRESHOLD = 4000;  // Score < 40 = suffering
    uint256 public constant LOW_INCLUSION_THRESHOLD = 4000;  // education + purpose < 40

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed aiCompany, uint256 stakeAmount);
    event MetricsSubmitted(uint256 indexed bondId, uint256 timestamp);
    event BondDistributed(uint256 indexed bondId, uint256 humanShare, uint256 aiCompanyShare);
    event ProfitsLocked(uint256 indexed bondId, string reason);

    // ============ Modifiers ============

    modifier onlyAICompany(uint256 bondId) {
        require(bonds[bondId].aiCompany == msg.sender, "Only AI company");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create AI Accountability Bond
     * @dev AI company stakes 30% of quarterly revenue
     * @param companyName Name of AI company
     * @param quarterlyRevenue Total quarterly revenue (stake should be 30% of this)
     */
    function createBond(
        string memory companyName,
        uint256 quarterlyRevenue
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(msg.value >= (quarterlyRevenue * 30) / 100, "Must stake 30% of quarterly revenue");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            aiCompany: msg.sender,
            companyName: companyName,
            quarterlyRevenue: quarterlyRevenue,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, msg.value);
        return bondId;
    }

    /**
     * @notice Submit global human flourishing metrics
     * @dev Measured globally, not per-company
     */
    function submitMetrics(
        uint256 bondId,
        uint256 incomeDistributionScore,
        uint256 povertyRateScore,
        uint256 healthOutcomesScore,
        uint256 mentalHealthScore,
        uint256 educationAccessScore,
        uint256 purposeAgencyScore
    ) external onlyAICompany(bondId) bondExists(bondId) {
        bondMetrics[bondId].push(GlobalFlourishingMetrics({
            timestamp: block.timestamp,
            incomeDistributionScore: incomeDistributionScore,
            povertyRateScore: povertyRateScore,
            healthOutcomesScore: healthOutcomesScore,
            mentalHealthScore: mentalHealthScore,
            educationAccessScore: educationAccessScore,
            purposeAgencyScore: purposeAgencyScore
        }));

        emit MetricsSubmitted(bondId, block.timestamp);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate global flourishing score
     * @dev Average across all 6 dimensions
     */
    function globalFlourishingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Default: neutral

        GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];

        return (
            latest.incomeDistributionScore +
            latest.povertyRateScore +
            latest.healthOutcomesScore +
            latest.mentalHealthScore +
            latest.educationAccessScore +
            latest.purposeAgencyScore
        ) / 6;
    }

    /**
     * @notice Calculate inclusion multiplier
     * @dev Based on education access + purpose/agency
     * @return multiplier 50-200 (0.5x to 2.0x)
     */
    function inclusionMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];
        uint256 inclusionScore = (latest.educationAccessScore + latest.purposeAgencyScore) / 2;

        // High inclusion (education + purpose 70+) = 1.5x to 2.0x
        if (inclusionScore >= 7000) return 150 + ((inclusionScore - 7000) / 60);
        // Moderate inclusion (40-70) = 1.0x to 1.5x
        if (inclusionScore >= 4000) return 100 + ((inclusionScore - 4000) / 60);
        // Low inclusion (<40) = 0.5x to 1.0x
        return 50 + (inclusionScore / 80);
    }

    /**
     * @notice Check if declining trend exists
     */
    function hasDecliningTrend(uint256 bondId) public view bondExists(bondId) returns (bool) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return false;

        uint256 current = globalFlourishingScore(bondId);
        uint256 previous = (
            metrics[metrics.length - 2].incomeDistributionScore +
            metrics[metrics.length - 2].povertyRateScore +
            metrics[metrics.length - 2].healthOutcomesScore +
            metrics[metrics.length - 2].mentalHealthScore +
            metrics[metrics.length - 2].educationAccessScore +
            metrics[metrics.length - 2].purposeAgencyScore
        ) / 6;

        return current < previous;
    }

    /**
     * @notice Time multiplier
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 50);
        return 200 + ((yearsElapsed - 3) * 50);
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × GlobalFlourishing × Inclusion × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 flourishing = globalFlourishingScore(bondId);
        uint256 inclusion = inclusionMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        // Scale: flourishing is 0-10000, others are 0-200, so divide by 100000
        return (bond.stakeAmount * flourishing * inclusion * time) / 1000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if profits should be locked
     * @dev Locks if: humans suffering, declining trend, or low inclusion
     */
    function shouldLockProfits(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 flourishing = globalFlourishingScore(bondId);

        // Humans suffering (score < 40)
        if (flourishing < SUFFERING_THRESHOLD) {
            return (true, "Humans suffering");
        }

        // Declining trend
        if (hasDecliningTrend(bondId)) {
            return (true, "Declining human flourishing trend");
        }

        // Low inclusion (AI replacing without reskilling)
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0) {
            GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];
            uint256 inclusionScore = (latest.educationAccessScore + latest.purposeAgencyScore) / 2;
            if (inclusionScore < LOW_INCLUSION_THRESHOLD) {
                return (true, "Low inclusion - AI replacing without reskilling");
            }
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 50% to humans, 50% to AI company (or 100% to humans if locked)
     */
    function distributeBond(uint256 bondId) external nonReentrant onlyAICompany(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        (bool locked, string memory lockReason) = shouldLockProfits(bondId);

        uint256 humanShare;
        uint256 aiCompanyShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (locked) {
                // Profits locked: 100% to humans
                humanShare = absAppreciation;
                aiCompanyShare = 0;
                reason = lockReason;
                emit ProfitsLocked(bondId, lockReason);
            } else {
                // Normal: 50/50 split
                humanShare = absAppreciation / 2;
                aiCompanyShare = absAppreciation / 2;
                reason = "Global human flourishing improving";
            }
        } else {
            // Depreciation: 100% to humans as compensation
            humanShare = uint256(-appreciation);
            aiCompanyShare = 0;
            reason = "Depreciation compensation - humans suffering";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            humanShare: humanShare,
            aiCompanyShare: aiCompanyShare,
            reason: reason
        }));

        if (aiCompanyShare > 0) {
            payable(bond.aiCompany).transfer(aiCompanyShare);
        }

        emit BondDistributed(bondId, humanShare, aiCompanyShare);
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (GlobalFlourishingMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }
}
