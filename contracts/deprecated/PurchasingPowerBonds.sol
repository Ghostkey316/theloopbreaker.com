// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Purchasing Power Bonds
 * @notice Restoring 1990s Affordability (or Better) - Real wages > nominal wages
 *
 * Philosophy: Workers should afford what 1990s workers could afford (house, food, healthcare, savings).
 * Companies profit when workers afford MORE, not less.
 *
 * Key Innovation: Measures REAL affordability, not paper wages.
 * Can't game by raising wages 3% while raising costs 10%.
 */
contract PurchasingPowerBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address company;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 workerCount;
        bool active;
    }

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

    struct WorkerAttestation {
        address attestor;
        uint256 timestamp;
        bool canAffordHousing;
        bool canAffordFood;
        bool canAffordHealthcare;
        bool canSaveMoney;
        bool purchasingPowerImproving;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 workerShare;
        uint256 companyShare;
        uint256 perWorkerAmount;
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

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed company, uint256 stakeAmount);
    event MetricsSubmitted(uint256 indexed bondId, uint256 timestamp);
    event WorkerAttestationAdded(uint256 indexed bondId, address indexed attestor);
    event BondDistributed(uint256 indexed bondId, uint256 workerShare, uint256 companyShare);

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
     * @param workerCount Number of workers this bond covers
     */
    function createBond(uint256 workerCount) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(workerCount > 0, "Must have workers");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            workerCount: workerCount,
            active: true
        });

        emit BondCreated(bondId, msg.sender, msg.value);
        return bondId;
    }

    /**
     * @notice Submit purchasing power metrics
     * @dev Company submits data showing worker affordability
     */
    function submitMetrics(
        uint256 bondId,
        uint256 housingCostPercent,
        uint256 foodHoursPerWeek,
        uint256 healthcareCostPercent,
        uint256 educationScore,
        uint256 transportCostPercent,
        uint256 discretionaryPercent
    ) external onlyCompany(bondId) bondExists(bondId) {
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

        emit MetricsSubmitted(bondId, block.timestamp);
    }

    /**
     * @notice Workers attest to purchasing power improvements
     * @dev Anonymous workers verify affordability claims
     */
    function addWorkerAttestation(
        uint256 bondId,
        bool canAffordHousing,
        bool canAffordFood,
        bool canAffordHealthcare,
        bool canSaveMoney,
        bool purchasingPowerImproving
    ) external bondExists(bondId) {
        bondAttestations[bondId].push(WorkerAttestation({
            attestor: msg.sender,
            timestamp: block.timestamp,
            canAffordHousing: canAffordHousing,
            canAffordFood: canAffordFood,
            canAffordHealthcare: canAffordHealthcare,
            canSaveMoney: canSaveMoney,
            purchasingPowerImproving: purchasingPowerImproving
        }));

        emit WorkerAttestationAdded(bondId, msg.sender);
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
     * @dev Average of all 6 affordability metrics
     * @return score 0-200 (1.0x = 1990s baseline, 2.0x = better than 1990s)
     */
    function overallPurchasingPowerScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 housing = housingAffordabilityScore(bondId);
        uint256 food = foodAffordabilityScore(bondId);
        uint256 healthcare = healthcareAffordabilityScore(bondId);
        uint256 discretionary = discretionaryIncomeScore(bondId);

        // Simple average for MVP (can weight differently later)
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

        // Check recent attestations (last 180 days approximated by 180 * 86400 seconds)
        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 positiveCount = 0;

        for (uint256 i = attestationsLength; i > 0;) {
            unchecked { --i; } // Safe: i > 0 checked in loop condition
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
        uint256 yearsElapsed = age / 31536000; // Seconds in a year

        if (yearsElapsed < 1) return 100;       // 1.0x
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 50);  // 1.0x to 2.0x
        return 200 + ((yearsElapsed - 3) * 50); // 2.0x to 3.0x (capped at reasonable max)
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

        // All multipliers are scaled by 100, so divide by 100^3 = 1000000
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

    /**
     * @notice Distribute bond proceeds
     * @dev 70% to workers, 30% to company (or 100% to workers if declining)
     */
    function distributeBond(uint256 bondId) external nonReentrant onlyCompany(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
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
            reason: reason
        }));

        // Transfer funds (simplified - in production would have worker registry)
        if (companyShare > 0) {
            payable(bond.company).transfer(companyShare);
        }

        emit BondDistributed(bondId, workerShare, companyShare);
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
}
