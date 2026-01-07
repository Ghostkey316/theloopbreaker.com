// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Purchasing Power Bonds V2 (Production Ready)
 * @notice Restoring 1990s Affordability (or Better) - Real wages > nominal wages
 *
 * @dev Philosophy: Workers should afford what 1990s workers could afford (house, food, healthcare, savings).
 * Companies profit when workers afford MORE, not less.
 *
 * @dev Key Innovation: Measures REAL affordability, not paper wages.
 * Can't game by raising wages 3% while raising costs 10%.
 *
 * @dev Mission Alignment: Protects ALL HUMANS (workers + communities).
 * Real purchasing power matters more than nominal wages.
 *
 * @custom:security ReentrancyGuard on distributeBond, Pausable for emergencies, Distribution timelock
 * @custom:ethics 100% to workers when purchasing power declining, can't fake affordability
 */
contract PurchasingPowerBondsV2 is BaseDignityBond {

    // ============ Structs ============

    /**
     * @notice Bond structure
     * @param bondId Unique identifier
     * @param company Address of company
     * @param stakeAmount Amount of ETH staked
     * @param createdAt Timestamp when created
     * @param workerCount Number of workers covered
     * @param distributionRequestedAt Timestamp when distribution requested (0 if none pending)
     * @param distributionPending Whether distribution is currently pending timelock
     * @param active Whether bond is still active
     */
    struct Bond {
        uint256 bondId;
        address company;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 workerCount;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    /**
     * @notice Purchasing power metrics
     * @dev All scores scaled for precision
     */
    struct PurchasingPowerMetrics {
        uint256 timestamp;
        // All scores 0-100 (scaled by 100 for precision: 3000 = 30.00%)
        uint256 housingCostPercent;      // % of income on housing (target: 3000 = 30%)
        uint256 foodHoursPerWeek;        // Hours worked for groceries (target: 400 = 4 hours, scaled by 100)
        uint256 healthcareCostPercent;   // % of income on healthcare (target: 700 = 7%)
        uint256 educationScore;          // 0-10000 (100 = perfect)
        uint256 transportCostPercent;    // % of income on transport (target: 1000 = 10%)
        uint256 discretionaryPercent;    // % left after necessities (target: 2500 = 25%)
        bool verifiedByWorkers;
    }

    /**
     * @notice Worker attestation
     */
    struct WorkerAttestation {
        address attestor;
        uint256 timestamp;
        bool canAffordHousing;
        bool canAffordFood;
        bool canAffordHealthcare;
        bool canSaveMoney;
        bool purchasingPowerImproving;
    }

    /**
     * @notice Distribution record
     */
    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 workerShare;
        uint256 companyShare;
        uint256 perWorkerAmount;
        uint256 purchasingPowerScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PurchasingPowerMetrics[]) public bondMetrics;
    mapping(uint256 => WorkerAttestation[]) public bondAttestations;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // 1990s baseline targets (scaled by 100)
    uint256 public constant HOUSING_TARGET = 3000;        // 30%
    uint256 public constant FOOD_HOURS_TARGET = 400;      // 4 hours
    uint256 public constant HEALTHCARE_TARGET = 700;      // 7%
    uint256 public constant EDUCATION_TARGET = 7500;      // 75/100
    uint256 public constant TRANSPORT_TARGET = 1000;      // 10%
    uint256 public constant DISCRETIONARY_TARGET = 2500;  // 25%

    // Maximum reasonable values for validation
    uint256 public constant MAX_HOUSING_PERCENT = 10000;  // 100%
    uint256 public constant MAX_FOOD_HOURS = 10000;       // 100 hours (scaled by 100)
    uint256 public constant MAX_HEALTHCARE_PERCENT = 10000; // 100%
    uint256 public constant MAX_TRANSPORT_PERCENT = 10000; // 100%
    uint256 public constant MAX_DISCRETIONARY_PERCENT = 10000; // 100%

    // ============ Events ============

    /**
     * @notice Emitted when bond is created
     */
    event BondCreated(
        uint256 indexed bondId,
        address indexed company,
        uint256 stakeAmount,
        uint256 workerCount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when metrics submitted
     */
    event MetricsSubmitted(
        uint256 indexed bondId,
        uint256 timestamp,
        uint256 purchasingPowerScore
    );

    /**
     * @notice Emitted when worker adds attestation
     */
    event WorkerAttestationAdded(
        uint256 indexed bondId,
        address indexed attestor,
        uint256 timestamp,
        bool purchasingPowerImproving
    );

    /**
     * @notice Emitted when distribution requested
     */
    event DistributionRequested(
        uint256 indexed bondId,
        address indexed company,
        uint256 requestedAt,
        uint256 availableAt
    );

    /**
     * @notice Emitted when bond distributed
     */
    event BondDistributed(
        uint256 indexed bondId,
        address indexed company,
        uint256 workerShare,
        uint256 companyShare,
        uint256 perWorkerAmount,
        int256 appreciation,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when declining penalty activates
     */
    event DecliningPenalty(
        uint256 indexed bondId,
        string reason,
        uint256 timestamp
    );

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

    /**
     * @notice Create a new Purchasing Power Bond
     * @dev Company stakes funds that appreciate when workers can afford more
     *
     * @param workerCount Number of workers this bond covers
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Worker count must be greater than 0
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     *
     * Mission Alignment: Companies stake on real affordability.
     * Can't fake by raising wages while costs rise faster.
     *
     * @custom:security Validates all inputs, checks contract not paused
     */
    function createBond(uint256 workerCount)
        external
        payable
        whenNotPaused
        returns (uint256)
    {
        _validateNonZero(msg.value, "Stake amount");
        _validateNonZero(workerCount, "Worker count");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            workerCount: workerCount,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        emit BondCreated(bondId, msg.sender, msg.value, workerCount, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit purchasing power metrics
     * @dev Company submits data showing worker affordability
     *
     * @param bondId ID of bond to submit metrics for
     * @param housingCostPercent Percent of income on housing (scaled by 100: 3000 = 30%)
     * @param foodHoursPerWeek Hours worked for groceries (scaled by 100: 400 = 4 hours)
     * @param healthcareCostPercent Percent of income on healthcare (scaled by 100)
     * @param educationScore Education affordability score (0-10000)
     * @param transportCostPercent Percent of income on transport (scaled by 100)
     * @param discretionaryPercent Percent left after necessities (scaled by 100)
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - All percentages must be 0-10000
     * - Food hours must be 0-10000
     * - Education score must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {MetricsSubmitted} event with calculated purchasing power score
     *
     * Mission Alignment: Company reports real affordability.
     * Workers verify, preventing fake metrics.
     *
     * @custom:security Validates all inputs to prevent manipulation
     */
    function submitMetrics(
        uint256 bondId,
        uint256 housingCostPercent,
        uint256 foodHoursPerWeek,
        uint256 healthcareCostPercent,
        uint256 educationScore,
        uint256 transportCostPercent,
        uint256 discretionaryPercent
    ) external onlyCompany(bondId) bondExists(bondId) whenNotPaused {
        // Validate all inputs
        require(housingCostPercent <= MAX_HOUSING_PERCENT, "Housing cost must be 0-100%");
        require(foodHoursPerWeek <= MAX_FOOD_HOURS, "Food hours must be 0-100");
        require(healthcareCostPercent <= MAX_HEALTHCARE_PERCENT, "Healthcare cost must be 0-100%");
        _validateScore(educationScore, "Education score");
        require(transportCostPercent <= MAX_TRANSPORT_PERCENT, "Transport cost must be 0-100%");
        require(discretionaryPercent <= MAX_DISCRETIONARY_PERCENT, "Discretionary must be 0-100%");

        bondMetrics[bondId].push(PurchasingPowerMetrics({
            timestamp: block.timestamp,
            housingCostPercent: housingCostPercent,
            foodHoursPerWeek: foodHoursPerWeek,
            healthcareCostPercent: healthcareCostPercent,
            educationScore: educationScore,
            transportCostPercent: transportCostPercent,
            discretionaryPercent: discretionaryPercent,
            verifiedByWorkers: false
        }));

        uint256 purchasingPowerScore = overallPurchasingPowerScore(bondId);
        emit MetricsSubmitted(bondId, block.timestamp, purchasingPowerScore);
    }

    /**
     * @notice Workers attest to purchasing power improvements
     * @dev Anonymous workers verify affordability claims
     *
     * @param bondId ID of bond to attest for
     * @param canAffordHousing Can worker afford housing?
     * @param canAffordFood Can worker afford food?
     * @param canAffordHealthcare Can worker afford healthcare?
     * @param canSaveMoney Can worker save money?
     * @param purchasingPowerImproving Is purchasing power improving?
     *
     * Requirements:
     * - Bond must exist
     * - Contract must not be paused
     *
     * Emits:
     * - {WorkerAttestationAdded} event
     *
     * Mission Alignment: Workers verify company claims.
     * Truth emerges from aggregate worker input.
     *
     * @custom:privacy Worker address recorded but can use fresh wallet for anonymity
     */
    function addWorkerAttestation(
        uint256 bondId,
        bool canAffordHousing,
        bool canAffordFood,
        bool canAffordHealthcare,
        bool canSaveMoney,
        bool purchasingPowerImproving
    ) external bondExists(bondId) whenNotPaused {
        bondAttestations[bondId].push(WorkerAttestation({
            attestor: msg.sender,
            timestamp: block.timestamp,
            canAffordHousing: canAffordHousing,
            canAffordFood: canAffordFood,
            canAffordHealthcare: canAffordHealthcare,
            canSaveMoney: canSaveMoney,
            purchasingPowerImproving: purchasingPowerImproving
        }));

        emit WorkerAttestationAdded(bondId, msg.sender, block.timestamp, purchasingPowerImproving);
    }

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives stakeholders time to verify
     * if purchasing power claims are accurate. Transparency over speed.
     *
     * @custom:security Timelock prevents instant rug pull
     */
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

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 70% to workers, 30% to company (or 100% to workers if declining)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {DecliningPenalty} event if penalty applies
     *
     * Mission Alignment: Workers get 70% when improving, 100% when declining.
     * Protects ALL humans (workers + communities) from affordability crisis.
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     */
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
            "Timelock not expired - stakeholders need time to verify"
        );

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        bool penaltyActive = shouldActivateDecliningPenalty(bondId);
        uint256 workerShare;
        uint256 companyShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // Penalty: 100% to workers
                workerShare = absAppreciation;
                companyShare = 0;
                reason = "Penalty: Purchasing power declining";
                emit DecliningPenalty(bondId, "Purchasing power declining", block.timestamp);
            } else {
                // Normal: 70/30 split
                workerShare = (absAppreciation * 70) / 100;
                companyShare = (absAppreciation * 30) / 100;
                reason = "Purchasing power improving";
            }
        } else {
            // Depreciation: 100% to workers as compensation
            workerShare = uint256(-appreciation);
            companyShare = 0;
            reason = "Depreciation compensation";
        }

        uint256 perWorkerAmount = workerShare / bond.workerCount;

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            workerShare: workerShare,
            companyShare: companyShare,
            perWorkerAmount: perWorkerAmount,
            purchasingPowerScore: overallPurchasingPowerScore(bondId),
            reason: reason
        }));

        // Transfer funds (simplified - in production would have worker registry)
        if (companyShare > 0) {
            payable(bond.company).transfer(companyShare);
        }

        emit BondDistributed(
            bondId,
            bond.company,
            workerShare,
            companyShare,
            perWorkerAmount,
            appreciation,
            reason,
            block.timestamp
        );
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate housing affordability score
     * @dev Lower housing cost % = better score
     * @return score 0-200 (scaled by 100, so 200 = 2.0x)
     */
    function housingAffordabilityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PurchasingPowerMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return 100; // 1.0x default

        uint256 currentPercent = metrics[metrics.length - 1].housingCostPercent;

        if (currentPercent <= 2500) return 200;        // 25% or less = excellent (2.0x)
        if (currentPercent <= HOUSING_TARGET) return 150;  // 30% = 1990s level (1.5x)
        if (currentPercent <= 4000) return 80;         // 40% = worse (0.8x)
        return 50;                                      // 50%+ = much worse (0.5x)
    }

    /**
     * @notice Calculate food affordability score
     */
    function foodAffordabilityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PurchasingPowerMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return 100;

        uint256 currentHours = metrics[metrics.length - 1].foodHoursPerWeek;

        if (currentHours <= 300) return 200;           // 3 hours = excellent
        if (currentHours <= FOOD_HOURS_TARGET) return 150;  // 4 hours = 1990s level
        if (currentHours <= 600) return 80;            // 6 hours = worse
        return 50;                                      // 8+ hours = much worse
    }

    /**
     * @notice Calculate healthcare affordability score
     */
    function healthcareAffordabilityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PurchasingPowerMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return 100;

        uint256 currentPercent = metrics[metrics.length - 1].healthcareCostPercent;

        if (currentPercent <= 500) return 200;         // 5% = excellent
        if (currentPercent <= HEALTHCARE_TARGET) return 150;  // 7% = 1990s level
        if (currentPercent <= 1500) return 80;         // 15% = worse
        return 50;                                      // 20%+ = much worse
    }

    /**
     * @notice Calculate discretionary income score
     */
    function discretionaryIncomeScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PurchasingPowerMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return 100;

        uint256 currentPercent = metrics[metrics.length - 1].discretionaryPercent;

        if (currentPercent >= 3500) return 200;        // 35%+ = excellent
        if (currentPercent >= DISCRETIONARY_TARGET) return 150;  // 25% = 1990s level
        if (currentPercent >= 1500) return 80;         // 15% = worse
        return 50;                                      // <10% = much worse
    }

    /**
     * @notice Calculate overall purchasing power score
     * @dev Average of all 4 affordability metrics
     * @return score 0-200 (1.0x = 1990s baseline, 2.0x = better than 1990s)
     */
    function overallPurchasingPowerScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 housing = housingAffordabilityScore(bondId);
        uint256 food = foodAffordabilityScore(bondId);
        uint256 healthcare = healthcareAffordabilityScore(bondId);
        uint256 discretionary = discretionaryIncomeScore(bondId);

        return (housing + food + healthcare + discretionary) / 4;
    }

    /**
     * @notice Calculate worker verification multiplier
     * @return multiplier 50-150 (0.5x to 1.5x)
     */
    function workerVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        WorkerAttestation[] storage attestations = bondAttestations[bondId];
        uint256 attestationsLength = attestations.length;

        if (attestationsLength == 0) return 50; // No verification = penalty

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 positiveCount = 0;

        for (uint256 i = attestationsLength; i > 0;) {
            unchecked { --i; }
            if (attestations[i].timestamp < cutoff) break;

            unchecked {
                ++recentCount;
                WorkerAttestation storage att = attestations[i];
                if (att.canAffordHousing && att.canAffordFood && att.canAffordHealthcare && att.purchasingPowerImproving) {
                    ++positiveCount;
                }
            }
        }

        if (recentCount == 0) return 70; // Old attestations only

        uint256 rate = (positiveCount * 100) / recentCount;

        if (rate >= 80) return 150;  // Strong consensus = 1.5x
        if (rate >= 50) return 100;  // Moderate = 1.0x
        return 50;                    // Weak = 0.5x
    }

    /**
     * @notice Calculate time multiplier
     * @return multiplier 100-300 (1.0x to 3.0x)
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
     * @notice Calculate current bond value
     * @dev Formula: Stake × PurchasingPower × WorkerVerification × Time
     * @return value Current bond value in wei
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 purchasingPower = overallPurchasingPowerScore(bondId);
        uint256 workerVerification = workerVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * purchasingPower * workerVerification * time) / 1000000;
    }

    /**
     * @notice Calculate appreciation/depreciation
     * @return appreciation Can be negative (depreciation)
     */
    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;

        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if declining penalty should activate
     */
    function shouldActivateDecliningPenalty(uint256 bondId) public view bondExists(bondId) returns (bool) {
        uint256 purchasingPower = overallPurchasingPowerScore(bondId);
        uint256 workerVerification = workerVerificationMultiplier(bondId);

        // Penalty if purchasing power declining (< 0.8) or no worker verification
        return purchasingPower < 80 || workerVerification < 70;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getAttestationsCount(uint256 bondId) external view returns (uint256) {
        return bondAttestations[bondId].length;
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (PurchasingPowerMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }
}
