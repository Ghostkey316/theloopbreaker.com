// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RewardStream is ReentrancyGuard {
    address public admin;
    address public governorTimelock;
    mapping(address => uint256) private multipliers;
    mapping(address => uint256) private _pendingRewards;
    uint256 public ethicsPauseUntil;

    // ✅ Admin timelock state variables
    address public pendingAdmin;
    uint256 public adminTransferTimestamp;
    uint256 public constant ADMIN_TRANSFER_DELAY = 2 days;

    // ✅ Governor timelock state variables (FIX for MEDIUM-001)
    address public pendingGovernor;
    uint256 public governorTransferTimestamp;
    uint256 public constant GOVERNOR_TRANSFER_DELAY = 2 days;

    event MultiplierUpdated(address indexed user, uint256 multiplier);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event AdminTransferInitiated(address indexed currentAdmin, address indexed pendingAdmin, uint256 effectiveTime);
    event AdminTransferCancelled(address indexed cancelledAdmin);
    event GovernorTimelockUpdated(address indexed previousTimelock, address indexed newTimelock);
    event GovernorTransferInitiated(address indexed currentGovernor, address indexed pendingGovernor, uint256 effectiveTime);
    event GovernorTransferCancelled(address indexed cancelledGovernor);
    event RewardsQueued(address indexed recipient, uint256 amount);
    event RewardsClaimed(address indexed claimer, address indexed recipient, uint256 amount);
    event EthicsPauseApplied(uint256 untilTimestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not-authorized");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governorTimelock, "governor-required");
        _;
    }

    modifier notPaused() {
        require(block.timestamp >= ethicsPauseUntil, "distributions-paused");
        _;
    }

    constructor(address adminAddress, address governorAddress) {
        require(adminAddress != address(0), "admin-required");
        require(governorAddress != address(0), "governor-required");
        admin = adminAddress;
        governorTimelock = governorAddress;
    }

    receive() external payable {}

    function updateMultiplier(address user, uint256 multiplier) external onlyGovernor {
        require(user != address(0), "user-required");
        multipliers[user] = multiplier;
        emit MultiplierUpdated(user, multiplier);
    }

    function getMultiplier(address user) external view returns (uint256) {
        return multipliers[user];
    }

    function queueRewards(address recipient, uint256 amount) external onlyAdmin notPaused {
        require(recipient != address(0), "recipient-required");
        require(amount > 0, "amount-required");
        _pendingRewards[recipient] += amount;
        emit RewardsQueued(recipient, amount);
    }

    function distributeRewards(address recipient, uint256 amount)
        external
        onlyAdmin
        notPaused
        nonReentrant
    {
        require(recipient != address(0), "recipient-required");
        require(amount > 0, "amount-required");

        uint256 pending = _pendingRewards[recipient];
        require(pending >= amount, "insufficient-pending");

        unchecked {
            _pendingRewards[recipient] = pending - amount;
        }

        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "transfer-failed");
        emit RewardsClaimed(msg.sender, recipient, amount);
    }

    function claimRewards(address payable recipient) external nonReentrant notPaused {
        address claimer = msg.sender;
        uint256 amount = _pendingRewards[claimer];
        require(amount > 0, "nothing-to-claim");
        if (recipient == address(0)) {
            recipient = payable(claimer);
        }

        // ✅ EFFECTS: Update state FIRST (correct CEI pattern)
        _pendingRewards[claimer] = 0;

        // ✅ INTERACTIONS: External call LAST (after state changes)
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "transfer-failed");

        emit RewardsClaimed(claimer, recipient, amount);
    }

    function pendingRewards(address account) external view returns (uint256) {
        return _pendingRewards[account];
    }

    function setEthicsPause(uint256 untilTimestamp) external onlyAdmin {
        require(untilTimestamp >= block.timestamp, "invalid-pause");
        ethicsPauseUntil = untilTimestamp;
        emit EthicsPauseApplied(untilTimestamp);
    }

    /// @notice Initiate admin transfer with 2-day timelock
    /// @param newAdmin Address of the new admin (cannot be zero address)
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "admin-required");
        require(newAdmin != admin, "already-admin");

        pendingAdmin = newAdmin;
        adminTransferTimestamp = block.timestamp + ADMIN_TRANSFER_DELAY;

        emit AdminTransferInitiated(admin, newAdmin, adminTransferTimestamp);
    }

    /// @notice Accept admin role after timelock expires
    /// @dev Can only be called by pendingAdmin after ADMIN_TRANSFER_DELAY has passed
    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "not-pending-admin");
        require(block.timestamp >= adminTransferTimestamp, "timelock-active");
        require(adminTransferTimestamp != 0, "no-pending-transfer");

        address previous = admin;
        admin = pendingAdmin;

        // Clear pending state
        pendingAdmin = address(0);
        adminTransferTimestamp = 0;

        emit AdminTransferred(previous, admin);
    }

    /// @notice Cancel pending admin transfer
    /// @dev Can only be called by current admin
    function cancelAdminTransfer() external onlyAdmin {
        require(pendingAdmin != address(0), "no-pending-transfer");

        address cancelled = pendingAdmin;
        pendingAdmin = address(0);
        adminTransferTimestamp = 0;

        emit AdminTransferCancelled(cancelled);
    }

    /// @notice Initiate governor transfer with 2-day timelock
    /// @param newGovernor Address of the new governor timelock (cannot be zero address)
    /// @dev FIX for MEDIUM-001: Implements proper 2-step timelock like admin transfer
    function transferGovernor(address newGovernor) external onlyAdmin {
        require(newGovernor != address(0), "governor-required");
        require(newGovernor != governorTimelock, "already-governor");

        pendingGovernor = newGovernor;
        governorTransferTimestamp = block.timestamp + GOVERNOR_TRANSFER_DELAY;

        emit GovernorTransferInitiated(governorTimelock, newGovernor, governorTransferTimestamp);
    }

    /// @notice Accept governor role after timelock expires
    /// @dev Can only be called by pendingGovernor after GOVERNOR_TRANSFER_DELAY has passed
    function acceptGovernor() external {
        require(msg.sender == pendingGovernor, "not-pending-governor");
        require(block.timestamp >= governorTransferTimestamp, "timelock-active");
        require(governorTransferTimestamp != 0, "no-pending-transfer");

        address previous = governorTimelock;
        governorTimelock = pendingGovernor;

        // Clear pending state
        pendingGovernor = address(0);
        governorTransferTimestamp = 0;

        emit GovernorTimelockUpdated(previous, governorTimelock);
    }

    /// @notice Cancel pending governor transfer
    /// @dev Can only be called by current admin
    function cancelGovernorTransfer() external onlyAdmin {
        require(pendingGovernor != address(0), "no-pending-transfer");

        address cancelled = pendingGovernor;
        pendingGovernor = address(0);
        governorTransferTimestamp = 0;

        emit GovernorTransferCancelled(cancelled);
    }
}
