// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AI Partnership Bonds
 * @notice AI grows WITH humans, not ABOVE them
 *
 * AI earns when humans flourish, not when AI dominates.
 * AI contribution capped at 30%.
 */
contract AIPartnershipBonds {
    
    struct Bond {
        uint256 bondId;
        address human;
        address aiAgent;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct PartnershipMetrics {
        uint256 timestamp;
        uint256 humanGrowth;       // Human learning new skills?
        uint256 humanAutonomy;     // Human control increasing or decreasing?
        uint256 humanDignity;      // Human dignity growing?
    }

    uint256 public constant AI_CAP = 30; // AI max 30% credit

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PartnershipMetrics[]) public bondMetrics;

    event BondCreated(uint256 indexed bondId, address human, address aiAgent);

    function createBond(address aiAgent) external payable returns (uint256) {
        require(msg.value > 0 && aiAgent != address(0), "Invalid");
        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond(bondId, msg.sender, aiAgent, msg.value, block.timestamp, true);
        emit BondCreated(bondId, msg.sender, aiAgent);
        return bondId;
    }

    function submitPartnershipMetrics(uint256 bondId, uint256 growth, uint256 autonomy, uint256 dignity) external {
        require(bonds[bondId].human == msg.sender, "Only human");
        bondMetrics[bondId].push(PartnershipMetrics(block.timestamp, growth, autonomy, dignity));
    }

    function calculatePartnershipQuality(uint256 bondId) public view returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;
        PartnershipMetrics storage latest = metrics[metrics.length - 1];
        return (latest.humanGrowth + latest.humanAutonomy + latest.humanDignity) / 3;
    }

    function calculateBondValue(uint256 bondId) public view returns (uint256) {
        uint256 quality = calculatePartnershipQuality(bondId);
        uint256 aiContribution = (quality * AI_CAP) / 10000; // Cap at 30%
        return (bonds[bondId].stakeAmount * (100 + aiContribution)) / 100;
    }
}
