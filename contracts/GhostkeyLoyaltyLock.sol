// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GhostkeyLoyaltyLock
 * @notice Locks user stakes for a set duration and provides a loyalty
 * multiplier that can be queried by backend systems.
 */
contract GhostkeyLoyaltyLock {
    struct LockInfo {
        uint256 start;
        uint256 duration;
        uint256 amount;
    }

    mapping(address => LockInfo) public locks;

    event Staked(address indexed user, uint256 amount, uint256 weeksLocked);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Stake tokens for a number of weeks. The amount is sent with the
     * transaction as ETH.
     * @param ensHolder The user address to credit the lock to.
     * @param weeks The duration in weeks to lock funds for.
     */
    function stake(address ensHolder, uint256 weeks) external payable {
        require(weeks > 0, "duration 0");
        require(msg.value > 0, "no value");
        LockInfo storage info = locks[ensHolder];
        require(info.amount == 0, "already staked");

        info.start = block.timestamp;
        info.duration = weeks * 1 weeks;
        info.amount = msg.value;

        emit Staked(ensHolder, msg.value, weeks);
    }

    /**
     * @notice Calculate the loyalty multiplier for a user.
     * @param user The user address.
     * @return multiplier The multiplier based on weeks locked.
     */
    function getMultiplier(address user) public view returns (uint256 multiplier) {
        LockInfo storage info = locks[user];
        if (info.amount == 0) {
            return 1;
        }
        uint256 weeksLocked = info.duration / 1 weeks;
        // Example linear scale: 1x base plus 0.1x per week
        multiplier = 1 + weeksLocked / 10;
    }

    /**
     * @notice Withdraw staked ETH after the lock period.
     */
    function withdraw() external {
        LockInfo storage info = locks[msg.sender];
        require(info.amount > 0, "nothing staked");
        require(block.timestamp >= info.start + info.duration, "still locked");

        uint256 amount = info.amount;
        delete locks[msg.sender];
        emit Withdrawn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}
