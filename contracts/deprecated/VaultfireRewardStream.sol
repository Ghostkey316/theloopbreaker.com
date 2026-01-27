// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultfireRewardStream is AccessControl {
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    IERC20 public immutable rewardToken;
    uint64 public streamDuration;

    struct Stream {
        uint128 total;
        uint128 released;
        uint64 start;
        uint64 duration;
    }

    mapping(address => Stream) private streams;

    event StreamScheduled(address indexed recipient, uint256 amount, uint64 start, uint64 duration);
    event StreamClaimed(address indexed recipient, uint256 amount, uint256 remaining);
    event StreamDurationUpdated(uint64 duration);
    event AutomationRoleGranted(address indexed account);
    event AutomationRoleRevoked(address indexed account);

    constructor(address token, uint64 defaultDuration) {
        require(token != address(0), "token required");
        require(defaultDuration > 0, "duration required");
        rewardToken = IERC20(token);
        streamDuration = defaultDuration;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyStreamTrigger() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(AUTOMATION_ROLE, msg.sender)) {
            revert("VaultfireRewardStream:unauthorised");
        }
        _;
    }

    function setStreamDuration(uint64 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(duration > 0, "duration required");
        streamDuration = duration;
        emit StreamDurationUpdated(duration);
    }

    function grantAutomationRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AUTOMATION_ROLE, account);
        emit AutomationRoleGranted(account);
    }

    function revokeAutomationRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(AUTOMATION_ROLE, account);
        emit AutomationRoleRevoked(account);
    }

    function getStream(address recipient) external view returns (Stream memory) {
        return streams[recipient];
    }

    function claimable(address recipient) public view returns (uint256) {
        Stream memory stream = streams[recipient];
        if (stream.total == 0 || stream.duration == 0) {
            return 0;
        }
        if (block.timestamp <= stream.start) {
            return 0;
        }

        uint256 elapsed = block.timestamp - stream.start;
        if (elapsed >= stream.duration) {
            return stream.total - stream.released;
        }
        uint256 vested = (uint256(stream.total) * elapsed) / stream.duration;
        if (vested <= stream.released) {
            return 0;
        }
        return vested - stream.released;
    }

    function _pullFunding(uint256 amount) internal {
        bool success = rewardToken.transferFrom(msg.sender, address(this), amount);
        require(success, "transferFrom failed");
    }

    function _disburse(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        bool success = rewardToken.transfer(recipient, amount);
        require(success, "transfer failed");
        emit StreamClaimed(recipient, amount, streams[recipient].total - streams[recipient].released);
    }

    function _releaseAvailable(address recipient, Stream storage stream) internal {
        uint256 amount = claimable(recipient);
        if (amount == 0) {
            return;
        }
        stream.released += uint128(amount);
        _disburse(recipient, amount);
    }

    function streamReward(address recipient, uint256 amount) external onlyStreamTrigger {
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        _pullFunding(amount);

        Stream storage stream = streams[recipient];
        _releaseAvailable(recipient, stream);

        uint256 remaining = uint256(stream.total) - stream.released;
        stream.total = uint128(remaining + amount);
        stream.released = 0;
        stream.start = uint64(block.timestamp);
        stream.duration = streamDuration;

        emit StreamScheduled(recipient, amount + remaining, stream.start, stream.duration);
    }

    function claim() external {
        Stream storage stream = streams[msg.sender];
        _releaseAvailable(msg.sender, stream);
    }
}
