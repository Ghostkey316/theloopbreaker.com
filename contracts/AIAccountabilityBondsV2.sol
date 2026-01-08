// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title AI Accountability Bonds V2 (Production Ready)
 * @notice AI can only profit when ALL humans thrive - Works even with ZERO employment
 *
 * @dev Philosophy: The ONLY economic system that works when AI fires everyone.
 * Creates AI companies that profit from human thriving, not human obsolescence.
 *
 * @dev Key Innovation: Works with ZERO employment.
 * Measures purpose/education, not jobs.
 *
 * @dev Mission Alignment: Protects ALL HUMANS (not just workers).
 * Locks AI profits when humans suffering, regardless of employment status.
 * This is humanity-level protection, not job-level protection.
 *
 * @custom:security ReentrancyGuard on distributeBond, Pausable for emergencies, Distribution timelock
 * @custom:ethics 100% to humans when suffering, works with zero jobs
 */
contract AIAccountabilityBondsV2 is BaseDignityBond {

    // ============ Structs ============

    /**
     * @notice Bond structure
     * @param bondId Unique identifier
     * @param aiCompany Address of AI company
     * @param companyName Name of AI company
     * @param quarterlyRevenue Revenue this bond is staking (30%)
     * @param stakeAmount 30% of quarterly revenue
     * @param createdAt Timestamp when created
     * @param distributionRequestedAt Timestamp when distribution requested (0 if none pending)
     * @param distributionPending Whether distribution is currently pending timelock
     * @param active Whether bond is still active
     */
    struct Bond {
        uint256 bondId;
        address aiCompany;
        string companyName;
        uint256 quarterlyRevenue;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    /**
     * @notice Global flourishing metrics
     * @dev Measured globally, not per-company. Works with ZERO employment.
     */
    struct GlobalFlourishingMetrics {
        uint256 timestamp;
        uint256 incomeDistributionScore;  // 0-10000 (wealth spreading or concentrating?)
        uint256 povertyRateScore;         // 0-10000 (people escaping poverty?)
        uint256 healthOutcomesScore;      // 0-10000 (life expectancy improving?)
        uint256 mentalHealthScore;        // 0-10000 (depression/anxiety rates?)
        uint256 educationAccessScore;     // 0-10000 (can people learn AI skills?)
        uint256 purposeAgencyScore;       // 0-10000 (meaningful activities - paid OR unpaid?)
    }

    /**
     * @notice Distribution record
     */
    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 humanShare;
        uint256 aiCompanyShare;
        uint256 globalFlourishingScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => GlobalFlourishingMetrics[]) public bondMetrics;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // ✅ Human treasury for distributing human share of profits
    address payable public humanTreasury;

    // Profit locking thresholds
    uint256 public constant SUFFERING_THRESHOLD = 4000;  // Score < 40 = suffering
    uint256 public constant LOW_INCLUSION_THRESHOLD = 4000;  // education + purpose < 40

    // ============ Events ============

    /**
     * @notice Emitted when bond is created
     */
    event BondCreated(
        uint256 indexed bondId,
        address indexed aiCompany,
        string companyName,
        uint256 quarterlyRevenue,
        uint256 stakeAmount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when human treasury address is updated
     */
    event HumanTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    /**
     * @notice Emitted when metrics submitted
     */
    event MetricsSubmitted(
        uint256 indexed bondId,
        uint256 timestamp,
        uint256 globalFlourishingScore
    );

    /**
     * @notice Emitted when distribution requested
     */
    event DistributionRequested(
        uint256 indexed bondId,
        address indexed aiCompany,
        uint256 requestedAt,
        uint256 availableAt
    );

    /**
     * @notice Emitted when bond distributed
     */
    event BondDistributed(
        uint256 indexed bondId,
        address indexed aiCompany,
        uint256 humanShare,
        uint256 aiCompanyShare,
        int256 appreciation,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when profits locked
     */
    event ProfitsLocked(
        uint256 indexed bondId,
        string reason,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyAICompany(uint256 bondId) {
        require(bonds[bondId].aiCompany == msg.sender, "Only AI company");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    /**
     * @notice Constructor to initialize human treasury
     * @param _humanTreasury Address that will receive human share of bond distributions
     */
    constructor(address payable _humanTreasury) {
        require(_humanTreasury != address(0), "Human treasury cannot be zero address");
        humanTreasury = _humanTreasury;
        emit HumanTreasuryUpdated(address(0), _humanTreasury);
    }

    /**
     * @notice Update human treasury address (owner only)
     * @param _newTreasury New address for human treasury
     */
    function setHumanTreasury(address payable _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Human treasury cannot be zero address");
        address previous = humanTreasury;
        humanTreasury = _newTreasury;
        emit HumanTreasuryUpdated(previous, _newTreasury);
    }

    // ============ Core Functions ============

    /**
     * @notice Create AI Accountability Bond
     * @dev AI company stakes 30% of quarterly revenue
     *
     * @param companyName Name of AI company
     * @param quarterlyRevenue Total quarterly revenue (stake should be 30% of this)
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Must stake at least 30% of quarterly revenue
     * - Company name required
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     *
     * Mission Alignment: AI companies stake on human flourishing.
     * Profits locked when humans suffer - even with ZERO employment.
     *
     * @custom:security Validates all inputs, checks contract not paused
     */
    function createBond(
        string memory companyName,
        uint256 quarterlyRevenue
    ) external payable whenNotPaused returns (uint256) {
        _validateNonZero(msg.value, "Stake amount");
        require(msg.value >= (quarterlyRevenue * 30) / 100, "Must stake 30% of quarterly revenue");
        require(bytes(companyName).length > 0, "Company name required");
        require(bytes(companyName).length <= 100, "Company name too long");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            aiCompany: msg.sender,
            companyName: companyName,
            quarterlyRevenue: quarterlyRevenue,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        emit BondCreated(bondId, msg.sender, companyName, quarterlyRevenue, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit global human flourishing metrics
     * @dev Measured globally, not per-company. Works with ZERO employment.
     *
     * @param bondId ID of bond to submit metrics for
     * @param incomeDistributionScore Wealth distribution score (0-10000)
     * @param povertyRateScore Poverty reduction score (0-10000)
     * @param healthOutcomesScore Health outcomes score (0-10000)
     * @param mentalHealthScore Mental health score (0-10000)
     * @param educationAccessScore Education access score (0-10000)
     * @param purposeAgencyScore Purpose/agency score (0-10000) - WORKS WITHOUT JOBS
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {MetricsSubmitted} event with calculated flourishing score
     *
     * Mission Alignment: Measures human flourishing, not employment.
     * Purpose and education matter even with zero jobs.
     *
     * @custom:security Validates all score inputs to prevent manipulation
     */
    function submitMetrics(
        uint256 bondId,
        uint256 incomeDistributionScore,
        uint256 povertyRateScore,
        uint256 healthOutcomesScore,
        uint256 mentalHealthScore,
        uint256 educationAccessScore,
        uint256 purposeAgencyScore
    ) external onlyAICompany(bondId) bondExists(bondId) whenNotPaused {
        // Validate all scores (0-10000)
        _validateScore(incomeDistributionScore, "Income distribution score");
        _validateScore(povertyRateScore, "Poverty rate score");
        _validateScore(healthOutcomesScore, "Health outcomes score");
        _validateScore(mentalHealthScore, "Mental health score");
        _validateScore(educationAccessScore, "Education access score");
        _validateScore(purposeAgencyScore, "Purpose/agency score");

        bondMetrics[bondId].push(GlobalFlourishingMetrics({
            timestamp: block.timestamp,
            incomeDistributionScore: incomeDistributionScore,
            povertyRateScore: povertyRateScore,
            healthOutcomesScore: healthOutcomesScore,
            mentalHealthScore: mentalHealthScore,
            educationAccessScore: educationAccessScore,
            purposeAgencyScore: purposeAgencyScore
        }));

        uint256 flourishingScore = globalFlourishingScore(bondId);
        emit MetricsSubmitted(bondId, block.timestamp, flourishingScore);
    }

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives humans time to verify
     * if flourishing claims are accurate. Protects humanity.
     *
     * @custom:security Timelock prevents instant rug pull
     */
    function requestDistribution(uint256 bondId)
        external
        onlyAICompany(bondId)
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

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 50% to humans, 50% to AI company (or 100% to humans if locked)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {ProfitsLocked} event if profits locked
     *
     * Mission Alignment: Humans get 50% when thriving, 100% when suffering.
     * Protects ALL humans in AI age, not just workers.
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     */
    function distributeBond(uint256 bondId)
        external
        nonReentrant
        whenNotPaused
        onlyAICompany(bondId)
        bondExists(bondId)
    {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(
            block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK,
            "Timelock not expired - humans need time to verify"
        );

        bond.distributionPending = false;
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
                emit ProfitsLocked(bondId, lockReason, block.timestamp);
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
            globalFlourishingScore: globalFlourishingScore(bondId),
            reason: reason
        }));

        // ✅ Safe ETH transfers using .call{} instead of deprecated .transfer()

        // Transfer AI company share
        if (aiCompanyShare > 0) {
            (bool successAI, ) = payable(bond.aiCompany).call{value: aiCompanyShare}("");
            require(successAI, "AI company transfer failed");
        }

        // ✅ Transfer human share to human treasury (FIX for HIGH-007)
        if (humanShare > 0) {
            require(humanTreasury != address(0), "Human treasury not set");
            (bool successHuman, ) = humanTreasury.call{value: humanShare}("");
            require(successHuman, "Human treasury transfer failed");
        }

        emit BondDistributed(
            bondId,
            bond.aiCompany,
            humanShare,
            aiCompanyShare,
            appreciation,
            reason,
            block.timestamp
        );
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate global flourishing score
     * @dev Average across all 6 dimensions
     *
     * @param bondId ID of bond to calculate score for
     * @return score Global flourishing score (0-10000)
     *
     * Mission Alignment: Measures human thriving, not employment.
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
     * @dev Based on education access + purpose/agency (WORKS WITHOUT JOBS)
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
     * @dev Formula: (Stake × GlobalFlourishing × Inclusion × Time) / 100,000,000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Math:
     * - flourishing: 0-10000 (globalFlourishingScore across 6 human thriving dimensions)
     * - inclusion: 50-200 (inclusionMultiplier based on education + purpose)
     * - time: 100-300 (timeMultiplier)
     * - Divisor: 50,000,000 ensures reasonable appreciation (1.0x-12.0x range)
     *
     * Example calculations:
     * - Neutral (5000 × 100 × 100): 1.0x stake (breakeven)
     * - Good (7500 × 150 × 200): 4.5x stake
     * - Excellent (10000 × 200 × 300): 12.0x stake
     *
     * Mission Alignment: AI can only profit when ALL humans thrive.
     * Works with ZERO employment - measures purpose/education, not jobs.
     *
     * @custom:math-fix Changed divisor from 1,000,000 to 50,000,000 (2026-01-07)
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 flourishing = globalFlourishingScore(bondId);
        uint256 inclusion = inclusionMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * flourishing * inclusion * time) / 50000000;
    }

    /**
     * @notice Calculate appreciation/depreciation
     */
    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if profits should be locked
     * @dev Locks if: humans suffering, declining trend, or low inclusion
     *
     * @return shouldLock Whether profits should be locked
     * @return reason Human-readable reason for locking
     *
     * Mission Alignment: AI can only profit when ALL humans thrive.
     * Works with ZERO employment - measures purpose, not jobs.
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

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }
}
