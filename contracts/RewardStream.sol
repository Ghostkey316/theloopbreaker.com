// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RewardStream is ReentrancyGuard {
    address public admin;
    address public governorTimelock;
    mapping(address => uint256) private multipliers;
    mapping(address => uint256) private _pendingRewards;
    uint256 public ethicsPauseUntil;

    event MultiplierUpdated(address indexed user, uint256 multiplier);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event GovernorTimelockUpdated(address indexed previousTimelock, address indexed newTimelock);
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

        _pendingRewards[claimer] = 0;
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

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "admin-required");
        address previous = admin;
        admin = newAdmin;
        emit AdminTransferred(previous, newAdmin);
    }

    function updateGovernorTimelock(address newGovernor) external onlyAdmin {
        require(newGovernor != address(0), "governor-required");
        address previous = governorTimelock;
        governorTimelock = newGovernor;
        emit GovernorTimelockUpdated(previous, newGovernor);
    }
}
