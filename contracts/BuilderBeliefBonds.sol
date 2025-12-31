// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Builder Belief Bonds
 * @notice BUILDING > TRANSACTING
 *
 * Stakers back builders. Bonds appreciate when builder improves.
 * Community-funded builder support.
 */
contract BuilderBeliefBonds {
    
    struct Bond {
        uint256 bondId;
        address staker;
        address builder;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct BeliefMetrics {
        uint256 timestamp;
        uint256 buildingScore;       // GitHub activity, on-chain building
        uint256 transactionScore;    // On-chain transactions
        uint256 revolutionaryScore;  // Revolutionary projects
    }

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BeliefMetrics[]) public bondMetrics;

    event BondCreated(uint256 indexed bondId, address staker, address builder);

    function createBond(address builder) external payable returns (uint256) {
        require(msg.value > 0 && builder != address(0), "Invalid");
        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond(bondId, msg.sender, builder, msg.value, block.timestamp, true);
        emit BondCreated(bondId, msg.sender, builder);
        return bondId;
    }

    function submitBeliefScore(uint256 bondId, uint256 building, uint256 transactions, uint256 revolutionary) external {
        // Oracle or builder can submit
        bondMetrics[bondId].push(BeliefMetrics(block.timestamp, building, transactions, revolutionary));
    }

    function calculateBeliefScore(uint256 bondId) public view returns (uint256) {
        BeliefMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        BeliefMetrics storage latest = metrics[metrics.length - 1];
        // Building weighted 70%, transactions 20%, revolutionary 10%
        return (latest.buildingScore * 70 + latest.transactionScore * 20 + latest.revolutionaryScore * 10) / 100;
    }

    function calculateBondValue(uint256 bondId) public view returns (uint256) {
        uint256 belief = calculateBeliefScore(bondId);
        uint256 age = (block.timestamp - bonds[bondId].createdAt) / 31536000; // years
        uint256 timeMultiplier = 100 + (age * 50); // 1.0x + 0.5x per year
        return (bonds[bondId].stakeAmount * belief * timeMultiplier) / 500000;
    }
}
