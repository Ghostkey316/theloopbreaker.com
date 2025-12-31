// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Common Ground Bonds
 * @notice Bridge-building > division economically
 *
 * Unity without destroying diversity.
 * Heals political/social rifts.
 */
contract CommonGroundBonds {
    
    struct Bond {
        uint256 bondId;
        address person1;
        address person2;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct BridgeMetrics {
        uint256 timestamp;
        uint256 understandingQuality;  // Can each explain other's view?
        uint256 collaborationScore;    // Real-world cooperation?
        uint256 rippleEffect;          // Helped others bridge divides?
    }

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BridgeMetrics[]) public bondMetrics;

    event BondCreated(uint256 indexed bondId, address person1, address person2);

    function createBond(address otherPerson) external payable returns (uint256) {
        require(msg.value > 0 && otherPerson != address(0) && otherPerson != msg.sender, "Invalid");
        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond(bondId, msg.sender, otherPerson, msg.value, block.timestamp, true);
        emit BondCreated(bondId, msg.sender, otherPerson);
        return bondId;
    }

    function submitBridgeProgress(uint256 bondId, uint256 understanding, uint256 collaboration, uint256 ripple) external {
        Bond storage bond = bonds[bondId];
        require(msg.sender == bond.person1 || msg.sender == bond.person2, "Only bond participants");
        bondMetrics[bondId].push(BridgeMetrics(block.timestamp, understanding, collaboration, ripple));
    }

    function calculateBondValue(uint256 bondId) public view returns (uint256) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return bonds[bondId].stakeAmount;
        BridgeMetrics storage latest = metrics[metrics.length - 1];
        uint256 score = (latest.understandingQuality + latest.collaborationScore) / 2;
        uint256 rippleMultiplier = 100 + (latest.rippleEffect * 10);
        return (bonds[bondId].stakeAmount * score * rippleMultiplier) / 500000;
    }
}
