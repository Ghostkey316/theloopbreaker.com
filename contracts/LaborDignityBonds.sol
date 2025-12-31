// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Labor Dignity Bonds
 * @notice Worker flourishing > exploitation economically
 *
 * Makes suits and people equal again.
 * Redistributes power from capital to workers.
 */
contract LaborDignityBonds {
    
    struct Bond {
        uint256 bondId;
        address company;
        uint256 stakeAmount;
        uint256 workerCount;
        uint256 createdAt;
        bool active;
    }

    struct FlourishingMetrics {
        uint256 timestamp;
        uint256 incomeGrowth;      // 0-10000 (wages above inflation?)
        uint256 autonomy;          // 0-10000 (control over work?)
        uint256 dignity;           // 0-10000 (respect, safety, fair treatment?)
        uint256 workLifeBalance;   // 0-10000 (reasonable hours?)
        uint256 security;          // 0-10000 (job protection?)
        uint256 voice;             // 0-10000 (say in decisions?)
    }

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => FlourishingMetrics[]) public bondMetrics;

    event BondCreated(uint256 indexed bondId, address indexed company);
    event MetricsSubmitted(uint256 indexed bondId);

    function createBond(uint256 workerCount) external payable returns (uint256) {
        require(msg.value > 0 && workerCount > 0, "Invalid params");
        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond(bondId, msg.sender, msg.value, workerCount, block.timestamp, true);
        emit BondCreated(bondId, msg.sender);
        return bondId;
    }

    function submitMetrics(
        uint256 bondId,
        uint256 income,
        uint256 autonomy,
        uint256 dignity,
        uint256 balance,
        uint256 security,
        uint256 voice
    ) external {
        require(bonds[bondId].company == msg.sender, "Only company");
        bondMetrics[bondId].push(FlourishingMetrics(block.timestamp, income, autonomy, dignity, balance, security, voice));
        emit MetricsSubmitted(bondId);
    }

    function calculateFlourishingScore(uint256 bondId) public view returns (uint256) {
        FlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        FlourishingMetrics storage latest = metrics[metrics.length - 1];
        return (latest.incomeGrowth + latest.autonomy + latest.dignity + 
                latest.workLifeBalance + latest.security + latest.voice) / 6;
    }

    function calculateBondValue(uint256 bondId) public view returns (uint256) {
        uint256 score = calculateFlourishingScore(bondId);
        return (bonds[bondId].stakeAmount * score) / 5000; // Normalized to 1.0x at 50/100
    }
}
