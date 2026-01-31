// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BaseDignityBond
 * @notice Base contract for all Universal Dignity Bonds
 * @dev Provides common functionality: pausability, ownership, score validation
 *
 * Mission Alignment: Emergency protection for workers/communities.
 * Can pause if exploit detected, protecting real people from harm.
 */
abstract contract BaseDignityBond is ReentrancyGuard, Pausable {

    // ============ State Variables ============

    /// @notice Contract owner (can pause in emergency)
    address public owner;

    /// @notice Pending owner for two-step ownership transfer
    /// @dev Prevents accidental ownership loss from typos in address
    address public pendingOwner;

    /// @notice Timelock period for distributions (7 days)
    uint256 public constant DISTRIBUTION_TIMELOCK = 7 days;

    // ============ Events ============

    /// @notice Emitted when contract is paused
    event ContractPaused(address indexed by, uint256 timestamp);

    /// @notice Emitted when contract is unpaused
    event ContractUnpaused(address indexed by, uint256 timestamp);

    /// @notice Emitted when ownership transfer is initiated
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Modifiers ============

    /**
     * @notice Restricts function to contract owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    // ============ Owner Functions ============

    /**
     * @notice Pause contract in case of emergency
     * @dev Only owner can pause. Prevents all bond creation and distributions.
     *
     * Mission Alignment: Emergency stop to protect workers/communities if exploit found.
     * Humanity over control - use sparingly, only for actual emergencies.
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Unpause contract after emergency is resolved
     * @dev Only owner can unpause. Restores normal operations.
     */
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer ownership to new address (step 1 of 2)
     * @dev Use for governance transitions or emergency handoff
     * @param newOwner Address of new owner
     *
     * @custom:security HIGH-005 FIX: Two-step ownership transfer
     * Prevents accidental loss of ownership due to typos. New owner must accept.
     *
     * Mission Alignment: Ownership should be transferable to community governance.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != owner, "Already the owner");

        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @notice Accept ownership transfer (step 2 of 2)
     * @dev New owner must call this to complete transfer
     *
     * @custom:security HIGH-005 FIX: Two-step ownership transfer
     * Only pending owner can accept. Prevents typo-based ownership loss.
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Only pending owner can accept");
        require(pendingOwner != address(0), "No pending ownership transfer");

        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);

        emit OwnershipTransferred(previousOwner, owner);
    }

    /**
     * @notice Cancel pending ownership transfer
     * @dev Current owner can cancel if transfer was initiated by mistake
     */
    function cancelOwnershipTransfer() external onlyOwner {
        require(pendingOwner != address(0), "No pending transfer to cancel");

        pendingOwner = address(0);
        emit OwnershipTransferStarted(owner, address(0)); // Signal cancellation
    }

    // ============ Validation Helpers ============

    /**
     * @notice Validate score is in valid range (0-10000)
     * @dev Internal helper for score validation
     * @param score Score to validate
     * @param paramName Parameter name for error message
     *
     * Mission Alignment: Prevents data manipulation through invalid scores.
     */
    function _validateScore(uint256 score, string memory paramName) internal pure {
        require(score <= 10000, string(abi.encodePacked(paramName, " must be 0-10000")));
    }

    /**
     * @notice Validate multiple scores at once
     * @dev More gas efficient than individual validation
     * @param scores Array of scores to validate
     */
    function _validateScores(uint256[] memory scores) internal pure {
        uint256 length = scores.length;
        for (uint256 i = 0; i < length;) {
            require(scores[i] <= 10000, "Score must be 0-10000");
            unchecked { ++i; }
        }
    }

    /**
     * @notice Validate address is not zero
     * @param addr Address to validate
     * @param paramName Parameter name for error message
     */
    function _validateAddress(address addr, string memory paramName) internal pure {
        require(addr != address(0), string(abi.encodePacked(paramName, " cannot be zero address")));
    }

    /**
     * @notice Validate amount is greater than zero
     * @param amount Amount to validate
     * @param paramName Parameter name for error message
     */
    function _validateNonZero(uint256 amount, string memory paramName) internal pure {
        require(amount > 0, string(abi.encodePacked(paramName, " must be greater than zero")));
    }

    // ============ View Functions ============

    /**
     * @notice Check if contract is currently paused
     * @return bool True if paused, false otherwise
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
}
