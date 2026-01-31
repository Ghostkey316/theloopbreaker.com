// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title Yield Pool Health Monitor
 * @notice Advanced monitoring and safety for yield pool economics
 * @dev Provides real-time health metrics, reserve requirements, and risk assessment
 *
 * @custom:security-audit Enhancement from Professional Security Audit 2026
 * @custom:purpose Prevent yield pool depletion and ensure economic sustainability
 */
contract YieldPoolHealthMonitor {

    // ============ Structs ============

    /**
     * @notice Comprehensive yield pool health snapshot
     * @param totalReserves Total ETH in yield pool
     * @param totalActiveBonds Total value of all active bonds
     * @param reserveRatio Reserves / active bonds (basis points, 10000 = 100%)
     * @param utilizationRate Active bonds / reserves (basis points)
     * @param minimumRequired Minimum reserves needed for current load
     * @param isHealthy Whether pool meets minimum requirements
     * @param riskLevel Risk assessment: 0=Safe, 1=Warning, 2=Critical
     * @param timestamp When this snapshot was taken
     */
    struct YieldPoolHealth {
        uint256 totalReserves;
        uint256 totalActiveBonds;
        uint256 reserveRatio;        // Basis points (10000 = 100%)
        uint256 utilizationRate;     // Basis points (10000 = 100%)
        uint256 minimumRequired;
        bool isHealthy;
        uint256 riskLevel;           // 0=Safe, 1=Warning, 2=Critical
        uint256 timestamp;
    }

    /**
     * @notice Reserve requirement configuration
     * @param baseReserveRatio Base percentage of active bonds (default: 50%)
     * @param volatilityBuffer Extra buffer during high volatility (default: 20%)
     * @param emergencyReserve Minimum locked reserve (default: 10 ETH)
     * @param rebalanceThreshold Trigger rebalance below this ratio (default: 40%)
     */
    struct ReserveRequirements {
        uint256 baseReserveRatio;      // Basis points (5000 = 50%)
        uint256 volatilityBuffer;      // Basis points (2000 = 20%)
        uint256 emergencyReserve;      // Wei (10 ether default)
        uint256 rebalanceThreshold;    // Basis points (4000 = 40%)
    }

    // ============ State Variables ============

    /// @notice Current reserve requirements configuration
    ReserveRequirements public reserveConfig;

    /// @notice Owner who can update configuration
    address public owner;

    /// @notice Historical health snapshots
    YieldPoolHealth[] public healthHistory;

    /// @notice Maximum snapshots to store
    uint256 public constant MAX_HISTORY = 100;

    // ============ Events ============

    event HealthSnapshotRecorded(
        uint256 timestamp,
        uint256 totalReserves,
        uint256 totalActiveBonds,
        uint256 reserveRatio,
        uint256 riskLevel
    );

    event RebalanceNeeded(
        uint256 timestamp,
        uint256 currentRatio,
        uint256 requiredRatio,
        uint256 deficitAmount
    );

    event RiskLevelChanged(
        uint256 timestamp,
        uint256 previousLevel,
        uint256 newLevel,
        string reason
    );

    event ReserveConfigUpdated(
        uint256 baseReserveRatio,
        uint256 volatilityBuffer,
        uint256 emergencyReserve,
        uint256 rebalanceThreshold
    );

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;

        // Initialize with conservative defaults
        reserveConfig = ReserveRequirements({
            baseReserveRatio: 5000,        // 50% of active bonds
            volatilityBuffer: 2000,        // +20% buffer
            emergencyReserve: 10 ether,    // 10 ETH minimum
            rebalanceThreshold: 4000       // Rebalance at <40%
        });

        emit ReserveConfigUpdated(5000, 2000, 10 ether, 4000);
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Calculate comprehensive yield pool health
     * @param yieldPool Current yield pool balance
     * @param totalActiveBonds Total value of all active bonds
     * @return health Complete health assessment
     *
     * @dev This function provides real-time risk assessment:
     * - Safe (0): Reserve ratio > 60%
     * - Warning (1): Reserve ratio 40-60%
     * - Critical (2): Reserve ratio < 40%
     */
    function assessHealth(
        uint256 yieldPool,
        uint256 totalActiveBonds
    ) public view returns (YieldPoolHealth memory health) {
        // Calculate minimum required reserves
        uint256 minRequired = calculateMinimumReserve(totalActiveBonds);

        // Calculate ratios (in basis points)
        uint256 reserveRatio = totalActiveBonds > 0
            ? (yieldPool * 10000) / totalActiveBonds
            : 10000; // 100% if no active bonds

        uint256 utilizationRate = yieldPool > 0
            ? (totalActiveBonds * 10000) / yieldPool
            : 0;

        // Determine risk level
        uint256 riskLevel;
        if (reserveRatio < 4000) {
            riskLevel = 2; // Critical: <40%
        } else if (reserveRatio < 6000) {
            riskLevel = 1; // Warning: 40-60%
        } else {
            riskLevel = 0; // Safe: >60%
        }

        // Assemble health snapshot
        health = YieldPoolHealth({
            totalReserves: yieldPool,
            totalActiveBonds: totalActiveBonds,
            reserveRatio: reserveRatio,
            utilizationRate: utilizationRate,
            minimumRequired: minRequired,
            isHealthy: yieldPool >= minRequired,
            riskLevel: riskLevel,
            timestamp: block.timestamp
        });
    }

    /**
     * @notice Record health snapshot to history
     * @param yieldPool Current yield pool balance
     * @param totalActiveBonds Total value of all active bonds
     *
     * @dev Automatically prunes history if > MAX_HISTORY
     */
    function recordHealthSnapshot(
        uint256 yieldPool,
        uint256 totalActiveBonds
    ) external {
        YieldPoolHealth memory health = assessHealth(yieldPool, totalActiveBonds);

        // Check if risk level changed
        if (healthHistory.length > 0) {
            uint256 previousRisk = healthHistory[healthHistory.length - 1].riskLevel;
            if (previousRisk != health.riskLevel) {
                emit RiskLevelChanged(
                    block.timestamp,
                    previousRisk,
                    health.riskLevel,
                    _getRiskLevelString(health.riskLevel)
                );
            }
        }

        // Record snapshot
        healthHistory.push(health);

        // Prune old history
        if (healthHistory.length > MAX_HISTORY) {
            _pruneHistory();
        }

        emit HealthSnapshotRecorded(
            health.timestamp,
            health.totalReserves,
            health.totalActiveBonds,
            health.reserveRatio,
            health.riskLevel
        );

        // Check if rebalancing needed
        if (health.reserveRatio < reserveConfig.rebalanceThreshold) {
            uint256 deficit = health.minimumRequired > health.totalReserves
                ? health.minimumRequired - health.totalReserves
                : 0;

            emit RebalanceNeeded(
                block.timestamp,
                health.reserveRatio,
                reserveConfig.baseReserveRatio,
                deficit
            );
        }
    }

    /**
     * @notice Calculate minimum required reserves
     * @param totalActiveBonds Total value of all active bonds
     * @return minimum Minimum reserves needed
     *
     * @dev Formula: max(
     *   (totalActiveBonds * baseRatio) + (totalActiveBonds * volatilityBuffer),
     *   emergencyReserve
     * )
     */
    function calculateMinimumReserve(uint256 totalActiveBonds) public view returns (uint256) {
        // Base requirement (e.g., 50% of active bonds)
        uint256 baseRequirement = (totalActiveBonds * reserveConfig.baseReserveRatio) / 10000;

        // Add volatility buffer (e.g., +20%)
        uint256 volatilityReserve = (totalActiveBonds * reserveConfig.volatilityBuffer) / 10000;

        uint256 totalRequired = baseRequirement + volatilityReserve;

        // Ensure at least emergency reserve
        return totalRequired > reserveConfig.emergencyReserve
            ? totalRequired
            : reserveConfig.emergencyReserve;
    }

    /**
     * @notice Check if yield pool can safely cover appreciation
     * @param yieldPool Current yield pool balance
     * @param totalActiveBonds Total value of active bonds
     * @param appreciationNeeded Amount needed for bond settlement
     * @return canCover Whether appreciation can be safely covered
     * @return wouldBeHealthy Whether pool would remain healthy after
     * @return recommendedAction Human-readable recommendation
     */
    function canSafelyCoverAppreciation(
        uint256 yieldPool,
        uint256 totalActiveBonds,
        uint256 appreciationNeeded
    ) external view returns (
        bool canCover,
        bool wouldBeHealthy,
        string memory recommendedAction
    ) {
        // Check basic coverage
        canCover = yieldPool >= appreciationNeeded;

        if (!canCover) {
            return (false, false, "Insufficient funds - cannot cover appreciation");
        }

        // Calculate post-settlement health
        uint256 postSettlementPool = yieldPool - appreciationNeeded;
        YieldPoolHealth memory postHealth = assessHealth(
            postSettlementPool,
            totalActiveBonds
        );

        wouldBeHealthy = postHealth.isHealthy;

        // Provide recommendation
        if (postHealth.riskLevel == 0) {
            recommendedAction = "Safe to settle - pool remains healthy";
        } else if (postHealth.riskLevel == 1) {
            recommendedAction = "Caution - settlement would trigger warning level";
        } else {
            recommendedAction = "HIGH RISK - settlement would deplete reserves below safe levels";
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update reserve requirements (owner only)
     * @param baseReserveRatio New base reserve ratio (basis points)
     * @param volatilityBuffer New volatility buffer (basis points)
     * @param emergencyReserve New emergency reserve (wei)
     * @param rebalanceThreshold New rebalance threshold (basis points)
     */
    function updateReserveConfig(
        uint256 baseReserveRatio,
        uint256 volatilityBuffer,
        uint256 emergencyReserve,
        uint256 rebalanceThreshold
    ) external onlyOwner {
        require(baseReserveRatio > 0 && baseReserveRatio <= 10000, "Invalid base ratio");
        require(volatilityBuffer <= 5000, "Volatility buffer too high");
        require(rebalanceThreshold > 0 && rebalanceThreshold <= 10000, "Invalid threshold");

        reserveConfig = ReserveRequirements({
            baseReserveRatio: baseReserveRatio,
            volatilityBuffer: volatilityBuffer,
            emergencyReserve: emergencyReserve,
            rebalanceThreshold: rebalanceThreshold
        });

        emit ReserveConfigUpdated(
            baseReserveRatio,
            volatilityBuffer,
            emergencyReserve,
            rebalanceThreshold
        );
    }

    // ============ View Functions ============

    /**
     * @notice Get recent health history
     * @param count Number of recent snapshots to return
     * @return snapshots Array of recent health snapshots
     */
    function getRecentHistory(uint256 count) external view returns (YieldPoolHealth[] memory) {
        uint256 historyLength = healthHistory.length;
        uint256 returnCount = count > historyLength ? historyLength : count;

        YieldPoolHealth[] memory snapshots = new YieldPoolHealth[](returnCount);

        for (uint256 i = 0; i < returnCount; i++) {
            snapshots[i] = healthHistory[historyLength - returnCount + i];
        }

        return snapshots;
    }

    /**
     * @notice Get total number of health snapshots recorded
     * @return count Total snapshots in history
     */
    function getHistoryLength() external view returns (uint256) {
        return healthHistory.length;
    }

    // ============ Internal Functions ============

    /**
     * @notice Prune old health history to maintain MAX_HISTORY limit
     * @dev Removes oldest 50% of history when limit exceeded
     */
    function _pruneHistory() internal {
        uint256 removeCount = healthHistory.length / 2;

        for (uint256 i = 0; i < healthHistory.length - removeCount; i++) {
            healthHistory[i] = healthHistory[i + removeCount];
        }

        for (uint256 i = 0; i < removeCount; i++) {
            healthHistory.pop();
        }
    }

    /**
     * @notice Get human-readable risk level string
     * @param riskLevel Risk level code
     * @return Human-readable string
     */
    function _getRiskLevelString(uint256 riskLevel) internal pure returns (string memory) {
        if (riskLevel == 0) return "Safe";
        if (riskLevel == 1) return "Warning";
        return "Critical";
    }
}
