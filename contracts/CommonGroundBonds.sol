// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Common Ground Bonds
 * @notice Bridge-building > division economically
 *
 * Philosophy: Unity without destroying diversity.
 * Heals political/social rifts by rewarding genuine understanding across divides.
 *
 * Key Innovation: Dual-party verification required from both sides of divide.
 * Ripple effect tracking - bridges that inspire more bridges earn more.
 */
contract CommonGroundBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address person1;
        address person2;
        string person1Position;     // What divide? (e.g., "progressive", "conservative")
        string person2Position;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct BridgeMetrics {
        uint256 timestamp;
        address submitter;
        uint256 understandingQuality;  // 0-10000 (Can each explain other's view?)
        uint256 collaborationScore;    // 0-10000 (Real-world cooperation?)
        uint256 respectLevel;          // 0-10000 (Maintained respect despite disagreement?)
        uint256 rippleEffect;          // Number of people this bridge inspired
        string progressNotes;
    }

    struct CrossDivideWitness {
        address witness;
        uint256 timestamp;
        string witnessPosition;        // Which side of divide?
        bool confirmsGenuineBridge;
        bool confirmsRippleEffect;
        uint256 connectionsFormed;     // How many new connections due to this bridge?
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 bridgeBuildersShare;
        uint256 communityHealingShare;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BridgeMetrics[]) public bondMetrics;
    mapping(uint256 => CrossDivideWitness[]) public bondWitnesses;
    mapping(uint256 => Distribution[]) public bondDistributions;

    uint256 public communityHealingPool;  // Pool for funding more bridge-building

    // Thresholds
    uint256 public constant BRIDGE_QUALITY_THRESHOLD = 4000;   // Score < 40 = superficial
    uint256 public constant DIVISION_WORSENING_THRESHOLD = 3000; // Respect < 30 = division worsening

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed person1, address indexed person2);
    event BridgeProgressSubmitted(uint256 indexed bondId, address submitter);
    event CrossDivideWitnessAdded(uint256 indexed bondId, address indexed witness);
    event RippleEffectDetected(uint256 indexed bondId, uint256 newConnections);
    event BondDistributed(uint256 indexed bondId, uint256 bridgeShare, uint256 communityShare);
    event DivisionWorseningPenalty(uint256 indexed bondId, string reason);

    // ============ Modifiers ============

    modifier onlyParticipants(uint256 bondId) {
        require(
            bonds[bondId].person1 == msg.sender || bonds[bondId].person2 == msg.sender,
            "Only bond participants"
        );
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create Common Ground Bond between two people across a divide
     * @param otherPerson The other person in the bridge
     * @param position1 Your position/side of divide
     * @param position2 Other person's position/side
     */
    function createBond(
        address otherPerson,
        string memory position1,
        string memory position2
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(otherPerson != address(0), "Invalid address");
        require(otherPerson != msg.sender, "Cannot bridge with yourself");
        require(bytes(position1).length > 0 && bytes(position2).length > 0, "Must specify positions");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            person1: msg.sender,
            person2: otherPerson,
            person1Position: position1,
            person2Position: position2,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, otherPerson);
        return bondId;
    }

    /**
     * @notice Submit bridge-building progress
     * @dev Both participants should submit independently for verification
     */
    function submitBridgeProgress(
        uint256 bondId,
        uint256 understandingQuality,
        uint256 collaborationScore,
        uint256 respectLevel,
        uint256 rippleEffect,
        string memory progressNotes
    ) external onlyParticipants(bondId) bondExists(bondId) {
        bondMetrics[bondId].push(BridgeMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            understandingQuality: understandingQuality,
            collaborationScore: collaborationScore,
            respectLevel: respectLevel,
            rippleEffect: rippleEffect,
            progressNotes: progressNotes
        }));

        if (rippleEffect > 0) {
            emit RippleEffectDetected(bondId, rippleEffect);
        }

        emit BridgeProgressSubmitted(bondId, msg.sender);
    }

    /**
     * @notice Cross-divide witness verification
     * @dev People from either side can verify the bridge is genuine
     */
    function addCrossDivideWitness(
        uint256 bondId,
        string memory witnessPosition,
        bool confirmsGenuineBridge,
        bool confirmsRippleEffect,
        uint256 connectionsFormed,
        string memory notes
    ) external bondExists(bondId) {
        bondWitnesses[bondId].push(CrossDivideWitness({
            witness: msg.sender,
            timestamp: block.timestamp,
            witnessPosition: witnessPosition,
            confirmsGenuineBridge: confirmsGenuineBridge,
            confirmsRippleEffect: confirmsRippleEffect,
            connectionsFormed: connectionsFormed,
            notes: notes
        }));

        emit CrossDivideWitnessAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate bridge quality score
     * @dev Average of understanding, collaboration, and respect
     */
    function bridgeQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Neutral

        // Average recent metrics from both participants
        uint256 cutoff = block.timestamp - 7776000; // ~90 days
        uint256 count = 0;
        uint256 totalScore = 0;

        for (uint256 i = metrics.length; i > 0 && metrics[i-1].timestamp >= cutoff; i--) {
            BridgeMetrics storage m = metrics[i-1];
            uint256 score = (m.understandingQuality + m.collaborationScore + m.respectLevel) / 3;
            totalScore += score;
            count++;
        }

        return count > 0 ? totalScore / count : 5000;
    }

    /**
     * @notice Calculate ripple effect multiplier
     * @dev Based on how many new connections/bridges this inspired
     * @return multiplier 100-300 (1.0x to 3.0x)
     */
    function rippleEffectMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        CrossDivideWitness[] storage witnesses = bondWitnesses[bondId];

        if (metrics.length == 0) return 100;

        // Total ripple from participants
        uint256 totalRipple = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            totalRipple += metrics[i].rippleEffect;
        }

        // Total connections from witnesses
        for (uint256 i = 0; i < witnesses.length; i++) {
            totalRipple += witnesses[i].connectionsFormed;
        }

        // Each new connection/bridge = +10% (capped at 3.0x)
        uint256 multiplier = 100 + (totalRipple * 10);
        return multiplier > 300 ? 300 : multiplier;
    }

    /**
     * @notice Dual-party verification multiplier
     * @dev Both sides must be submitting progress for genuine bridge
     * @return multiplier 50-150 (0.5x to 1.5x)
     */
    function dualPartyVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        Bond storage bond = bonds[bondId];

        if (metrics.length == 0) return 50; // No verification = penalty

        uint256 cutoff = block.timestamp - 7776000; // ~90 days
        uint256 person1Count = 0;
        uint256 person2Count = 0;

        for (uint256 i = metrics.length; i > 0 && metrics[i-1].timestamp >= cutoff; i--) {
            if (metrics[i-1].submitter == bond.person1) person1Count++;
            if (metrics[i-1].submitter == bond.person2) person2Count++;
        }

        // Both actively participating
        if (person1Count >= 1 && person2Count >= 1) {
            uint256 balance = person1Count < person2Count ? person1Count : person2Count;
            return balance >= 3 ? 150 : 100 + (balance * 16);
        }

        // Only one side participating
        return 50;
    }

    /**
     * @notice Cross-community witness multiplier
     * @dev External verification from people on both sides of divide
     * @return multiplier 70-130 (0.7x to 1.3x)
     */
    function crossCommunityWitnessMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        CrossDivideWitness[] storage witnesses = bondWitnesses[bondId];
        uint256 witnessesLength = witnesses.length;

        if (witnessesLength == 0) return 100; // Neutral

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 genuineConfirmations = 0;
        uint256 rippleConfirmations = 0;

        for (uint256 i = witnessesLength; i > 0;) {
            unchecked { --i; }
            if (witnesses[i].timestamp < cutoff) break;

            unchecked {
                ++recentCount;
                if (witnesses[i].confirmsGenuineBridge) ++genuineConfirmations;
                if (witnesses[i].confirmsRippleEffect) ++rippleConfirmations;
            }
        }

        if (recentCount == 0) return 100;

        uint256 avgRate = ((genuineConfirmations * 100 / recentCount) + (rippleConfirmations * 100 / recentCount)) / 2;

        if (avgRate >= 80) return 130;  // Strong witness consensus
        if (avgRate >= 50) return 100;  // Moderate
        return 70 + (avgRate / 4);      // Weak
    }

    /**
     * @notice Time multiplier for sustained bridges
     * @return multiplier 100-250 (1.0x to 2.5x over years)
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 5) return 100 + (yearsElapsed * 37);
        return 250;
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × BridgeQuality × RippleEffect × DualParty × Witnesses × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 quality = bridgeQualityScore(bondId);
        uint256 ripple = rippleEffectMultiplier(bondId);
        uint256 dualParty = dualPartyVerificationMultiplier(bondId);
        uint256 witnesses = crossCommunityWitnessMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * quality * ripple * dualParty * witnesses * time) / 10000000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if division worsening penalty should apply
     * @dev Penalty if: bridge quality < 40 OR respect < 30 OR no dual-party verification
     */
    function shouldActivateDivisionPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 quality = bridgeQualityScore(bondId);

        // Superficial bridge (quality < 40)
        if (quality < BRIDGE_QUALITY_THRESHOLD) {
            return (true, "Bridge quality too low - superficial connection");
        }

        // Check respect level specifically
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0) {
            uint256 latestRespect = metrics[metrics.length - 1].respectLevel;
            if (latestRespect < DIVISION_WORSENING_THRESHOLD) {
                return (true, "Division worsening - respect declining");
            }
        }

        // No dual-party verification
        uint256 dualParty = dualPartyVerificationMultiplier(bondId);
        if (dualParty <= 50) {
            return (true, "Only one side participating - not genuine bridge");
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 60% to bridge-builders, 40% to community healing pool (or 100% pool if division worsening)
     */
    function distributeBond(uint256 bondId) external nonReentrant onlyParticipants(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateDivisionPenalty(bondId);

        uint256 bridgeShare;
        uint256 communityShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // Division worsening: 100% to community healing
                bridgeShare = 0;
                communityShare = absAppreciation;
                reason = penaltyReason;
                emit DivisionWorseningPenalty(bondId, penaltyReason);
            } else {
                // Normal: 60% bridge-builders, 40% community healing
                bridgeShare = (absAppreciation * 60) / 100;
                communityShare = (absAppreciation * 40) / 100;
                reason = "Genuine bridge-building - healing divisions";
            }
        } else {
            // Depreciation: Support bridge-builders
            bridgeShare = uint256(-appreciation);
            communityShare = 0;
            reason = "Support during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            bridgeBuildersShare: bridgeShare,
            communityHealingShare: communityShare,
            reason: reason
        }));

        // Split bridge share between both participants
        if (bridgeShare > 0) {
            uint256 perPerson = bridgeShare / 2;
            payable(bond.person1).transfer(perPerson);
            payable(bond.person2).transfer(perPerson);
        }

        if (communityShare > 0) {
            communityHealingPool += communityShare;
        }

        emit BondDistributed(bondId, bridgeShare, communityShare);
    }

    // ============ Community Healing Pool Functions ============

    /**
     * @notice Donate to community healing pool
     * @dev Anyone can contribute to fund more bridge-building
     */
    function donateToCommunityHealing() external payable {
        require(msg.value > 0, "Must donate amount");
        communityHealingPool += msg.value;
    }

    /**
     * @notice Get community healing pool balance
     */
    function getCommunityHealingPool() external view returns (uint256) {
        return communityHealingPool;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getWitnessesCount(uint256 bondId) external view returns (uint256) {
        return bondWitnesses[bondId].length;
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (BridgeMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }
}
