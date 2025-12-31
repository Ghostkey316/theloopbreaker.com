// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Escape Velocity Bonds
 * @notice Little guy escaping poverty - $50-$500 stakes
 *
 * Too small for suits to exploit.
 * Pay it forward mechanism.
 */
contract EscapeVelocityBonds {
    
    struct Bond {
        uint256 bondId;
        address staker;
        uint256 stakeAmount;
        uint256 initialIncome;
        uint256 createdAt;
        bool active;
    }

    struct EscapeMetrics {
        uint256 timestamp;
        uint256 currentIncome;
        uint256 autonomyGain;
        uint256 peopleHelped;
    }

    uint256 public constant MIN_STAKE = 0.00005 ether; // ~$50 equiv
    uint256 public constant MAX_STAKE = 0.0005 ether;  // ~$500 equiv

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => EscapeMetrics[]) public bondMetrics;

    event BondCreated(uint256 indexed bondId, address indexed staker);

    function createBond(uint256 initialIncome) external payable returns (uint256) {
        require(msg.value >= MIN_STAKE && msg.value <= MAX_STAKE, "Stake must be $50-$500 equiv");
        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond(bondId, msg.sender, msg.value, initialIncome, block.timestamp, true);
        emit BondCreated(bondId, msg.sender);
        return bondId;
    }

    function submitProgress(uint256 bondId, uint256 currentIncome, uint256 autonomy, uint256 helped) external {
        require(bonds[bondId].staker == msg.sender, "Only staker");
        bondMetrics[bondId].push(EscapeMetrics(block.timestamp, currentIncome, autonomy, helped));
    }

    function calculateEscapeSuccess(uint256 bondId) public view returns (uint256) {
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;
        Bond storage bond = bonds[bondId];
        uint256 incomeGain = metrics[metrics.length - 1].currentIncome > bond.initialIncome ? 
            ((metrics[metrics.length - 1].currentIncome - bond.initialIncome) * 100) / bond.initialIncome : 0;
        return 100 + incomeGain; // 1.0x + income growth
    }

    function calculateBondValue(uint256 bondId) public view returns (uint256) {
        uint256 escapeSuccess = calculateEscapeSuccess(bondId);
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        uint256 helpMultiplier = metrics.length > 0 ? 100 + (metrics[metrics.length - 1].peopleHelped * 20) : 100;
        return (bonds[bondId].stakeAmount * escapeSuccess * helpMultiplier) / 10000;
    }
}
