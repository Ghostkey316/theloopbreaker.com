// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RewardStream {
    address public admin;
    mapping(address => uint256) private multipliers;

    event MultiplierUpdated(address indexed user, uint256 multiplier);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not-authorized");
        _;
    }

    constructor(address adminAddress) {
        require(adminAddress != address(0), "admin-required");
        admin = adminAddress;
    }

    function updateMultiplier(address user, uint256 multiplier) external onlyAdmin {
        require(user != address(0), "user-required");
        multipliers[user] = multiplier;
        emit MultiplierUpdated(user, multiplier);
    }

    function getMultiplier(address user) external view returns (uint256) {
        return multipliers[user];
    }
}
