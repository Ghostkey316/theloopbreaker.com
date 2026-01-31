// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./BaseDignityBond.sol";

/**
 * @title BaseYieldPoolBond
 * @notice Base contract for bonds with yield pool funding mechanism
 * @dev Extends BaseDignityBond with yield pool management for sustainable economics
 *
 * @custom:security-enhancement Added as part of 2026 Protocol Audit
 * @custom:purpose Prevent contract insolvency by ensuring sufficient reserves for distributions
 *
 * Mission Alignment: Economic sustainability ensures long-term support for workers/communities.
 * Yield pools prevent bank-run scenarios and ensure fair distribution to all bond holders.
 */
abstract contract BaseYieldPoolBond is BaseDignityBond {

    // ============ State Variables ============

    /// @notice Pool of funds available for bond appreciations
    /// @dev Funded externally to ensure sustainable economics
    uint256 public yieldPool;

    /// @notice Minimum yield pool balance required
    /// @dev Circuit breaker: distributions pause if pool drops below this
    uint256 public minimumYieldPoolBalance;

    /// @notice Total value of all active bonds (for reserve ratio calculation)
    uint256 public totalActiveBondValue;

    /// @notice Whether yield pool checks are enforced
    /// @dev Can be disabled by governance in special circumstances
    bool public yieldPoolEnforced;

    // ============ Constants ============

    /// @notice Default minimum yield pool balance (10 ETH)
    uint256 public constant DEFAULT_MINIMUM_YIELD_POOL = 10 ether;

    /// @notice Minimum reserve ratio (basis points): 5000 = 50%
    /// @dev Yield pool should be at least 50% of total active bond value
    uint256 public constant MINIMUM_RESERVE_RATIO = 5000;

    // ============ Events ============

    event YieldPoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event YieldPoolWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event YieldPoolUsed(uint256 indexed bondId, uint256 amount, uint256 remainingBalance);
    event YieldPoolReplenished(uint256 indexed bondId, uint256 amount, uint256 newBalance);
    event MinimumYieldPoolUpdated(uint256 oldMinimum, uint256 newMinimum);
    event YieldPoolEnforcementChanged(bool enforced);
    event LowYieldPoolWarning(uint256 currentBalance, uint256 minimumRequired, uint256 deficit);
    event ReserveRatioWarning(uint256 yieldPool, uint256 activeBonds, uint256 ratio);

    // ============ Constructor ============

    constructor() {
        minimumYieldPoolBalance = DEFAULT_MINIMUM_YIELD_POOL;
        yieldPoolEnforced = true;
    }

    // ============ Yield Pool Management ============

    /**
     * @notice Fund the yield pool to enable bond appreciations
     * @dev Anyone can fund the pool - protocol treasury, yield farming, fees, etc.
     *
     * Mission Alignment: Decentralized funding ensures no single point of control.
     * Community can support the protocol's economic sustainability.
     */
    function fundYieldPool() external payable {
        require(msg.value > 0, "Must send ETH");

        yieldPool += msg.value;

        emit YieldPoolFunded(msg.sender, msg.value, yieldPool);
    }

    /**
     * @notice Owner can withdraw excess yield pool funds
     * @dev Cannot withdraw below minimum balance - ensures reserve safety
     * @param amount Amount to withdraw
     *
     * Mission Alignment: Owner can rebalance, but minimum reserves protect users.
     */
    function withdrawYieldPool(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= yieldPool, "Insufficient yield pool");
        require(
            yieldPool - amount >= minimumYieldPoolBalance,
            "Cannot withdraw below minimum balance"
        );

        yieldPool -= amount;

        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");

        emit YieldPoolWithdrawn(owner, amount, yieldPool);
    }

    /**
     * @notice Update minimum yield pool balance
     * @dev Owner can adjust based on protocol growth
     * @param newMinimum New minimum balance (in wei)
     */
    function setMinimumYieldPoolBalance(uint256 newMinimum) external onlyOwner {
        require(newMinimum > 0, "Minimum must be greater than zero");

        uint256 oldMinimum = minimumYieldPoolBalance;
        minimumYieldPoolBalance = newMinimum;

        emit MinimumYieldPoolUpdated(oldMinimum, newMinimum);
    }

    /**
     * @notice Enable or disable yield pool enforcement
     * @dev Emergency governance function - use with extreme caution
     * @param enforced Whether to enforce yield pool checks
     *
     * Mission Alignment: Governance can disable in emergency, but default is protection.
     */
    function setYieldPoolEnforcement(bool enforced) external onlyOwner {
        yieldPoolEnforced = enforced;
        emit YieldPoolEnforcementChanged(enforced);
    }

    // ============ Internal Functions ============

    /**
     * @notice Deduct appreciation from yield pool
     * @dev Called by child contracts during distribution
     * @param bondId ID of bond being distributed
     * @param amount Amount of appreciation to deduct
     *
     * @custom:security Includes solvency checks to prevent insolvency
     */
    function _useYieldPool(uint256 bondId, uint256 amount) internal {
        // Check yield pool sufficiency
        if (yieldPoolEnforced) {
            require(yieldPool >= amount, "Insufficient yield pool for distribution");
            require(
                yieldPool >= minimumYieldPoolBalance,
                "Yield pool below minimum - distributions paused"
            );
        }

        yieldPool -= amount;

        emit YieldPoolUsed(bondId, amount, yieldPool);

        // Emit warning if pool is getting low.
        // NOTE: yieldPool can be between [minimum, 2×minimum). In that case, "deficit" is 0,
        // and we must NOT underflow (Solidity 0.8+ checked arithmetic).
        if (yieldPool < minimumYieldPoolBalance * 2) {
            uint256 deficit = yieldPool >= minimumYieldPoolBalance ? 0 : (minimumYieldPoolBalance - yieldPool);
            emit LowYieldPoolWarning(yieldPool, minimumYieldPoolBalance, deficit);
        }
    }

    /**
     * @notice Replenish yield pool from depreciation
     * @dev Called when bonds depreciate - losses go back to pool
     * @param bondId ID of bond being distributed
     * @param amount Amount of depreciation to add back
     *
     * Mission Alignment: Zero-sum economics - losses fund future gains.
     */
    function _replenishYieldPool(uint256 bondId, uint256 amount) internal {
        yieldPool += amount;
        emit YieldPoolReplenished(bondId, amount, yieldPool);
    }

    /**
     * @notice Check if yield pool can safely cover amount
     * @dev View function for UI/integration checking
     * @param amount Amount to check
     * @return canCover Whether pool can cover amount
     * @return wouldBeHealthy Whether pool would remain healthy after
     */
    function canYieldPoolCover(uint256 amount) public view returns (bool canCover, bool wouldBeHealthy) {
        canCover = yieldPool >= amount;
        wouldBeHealthy = (yieldPool - amount) >= minimumYieldPoolBalance;
    }

    /**
     * @notice Calculate current reserve ratio
     * @dev Reserve ratio = (yieldPool / totalActiveBondValue) * 10000
     * @return ratio Reserve ratio in basis points (10000 = 100%)
     */
    function getReserveRatio() public view returns (uint256 ratio) {
        if (totalActiveBondValue == 0) {
            return 10000; // 100% if no active bonds
        }
        ratio = (yieldPool * 10000) / totalActiveBondValue;

        // Emit warning if ratio is low
        if (ratio < MINIMUM_RESERVE_RATIO) {
            // This is a view function, so we can't emit events
            // UI/monitoring should check this
        }
    }

    /**
     * @notice Check if protocol is economically healthy
     * @dev Combines yield pool and reserve ratio checks
     * @return isHealthy True if both yield pool and reserve ratio are adequate
     * @return yieldPoolOK True if yield pool >= minimum
     * @return reserveRatioOK True if reserve ratio >= 50%
     * @return currentRatio Current reserve ratio in basis points
     */
    function getProtocolHealth() external view returns (
        bool isHealthy,
        bool yieldPoolOK,
        bool reserveRatioOK,
        uint256 currentRatio
    ) {
        yieldPoolOK = yieldPool >= minimumYieldPoolBalance;
        currentRatio = getReserveRatio();
        reserveRatioOK = currentRatio >= MINIMUM_RESERVE_RATIO;
        isHealthy = yieldPoolOK && reserveRatioOK;
    }

    /**
     * @notice Update total active bond value (called by child contracts)
     * @dev Internal function to track protocol-wide exposure
     * @param newValue New total value of all active bonds
     */
    function _updateTotalActiveBondValue(uint256 newValue) internal {
        totalActiveBondValue = newValue;

        // Check reserve ratio after update
        uint256 ratio = getReserveRatio();
        if (ratio < MINIMUM_RESERVE_RATIO) {
            emit ReserveRatioWarning(yieldPool, totalActiveBondValue, ratio);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get yield pool balance
     * @return balance Current yield pool balance
     */
    function getYieldPoolBalance() external view returns (uint256 balance) {
        return yieldPool;
    }

    /**
     * @notice Get minimum required yield pool balance
     * @return minimum Minimum balance requirement
     */
    function getMinimumYieldPool() external view returns (uint256 minimum) {
        return minimumYieldPoolBalance;
    }

    /**
     * @notice Check if yield pool enforcement is active
     * @return enforced True if enforced, false otherwise
     */
    function isYieldPoolEnforced() external view returns (bool enforced) {
        return yieldPoolEnforced;
    }
}
