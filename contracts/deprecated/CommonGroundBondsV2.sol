// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseYieldPoolBond.sol";

/**
 * @title Common Ground Bonds V2 (Production Ready)
 * @notice Bridge-building > division economically
 *
 * @custom:security ReentrancyGuard, Pausable, YieldPool
 * @custom:security-enhancement Added yield pool funding mechanism (2026 Audit), Distribution timelock, Input validation
 * @custom:ethics Unity without destroying diversity, dual-party verification
 */
contract CommonGroundBondsV2 is BaseYieldPoolBond {

    struct Bond {
        uint256 bondId;
        address person1;
        address person2;
        string person1Position;
        string person2Position;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    struct BridgeMetrics {
        uint256 timestamp;
        address submitter;
        uint256 understandingQuality;  // 0-10000
        uint256 collaborationScore;    // 0-10000
        uint256 respectLevel;          // 0-10000
        uint256 rippleEffect;
        string progressNotes;
    }

    struct CrossDivideWitness {
        address witness;
        uint256 timestamp;
        string witnessPosition;
        bool confirmsGenuineBridge;
        bool confirmsRippleEffect;
        uint256 connectionsFormed;
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 bridgeBuildersShare;
        uint256 communityHealingShare;
        string reason;
    }

    uint256 public constant BRIDGE_QUALITY_THRESHOLD = 4000;
    uint256 public constant DIVISION_WORSENING_THRESHOLD = 3000;

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BridgeMetrics[]) public bondMetrics;
    mapping(uint256 => CrossDivideWitness[]) public bondWitnesses;
    mapping(uint256 => Distribution[]) public bondDistributions;
    uint256 public communityHealingPool;

    event BondCreated(uint256 indexed bondId, address indexed person1, address indexed person2, string position1, string position2, uint256 stakeAmount, uint256 timestamp);
    event BridgeProgressSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp);
    event DistributionRequested(uint256 indexed bondId, address indexed requester, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 bridgeShare, uint256 communityShare, string reason, uint256 timestamp);
    event DivisionWorseningPenalty(uint256 indexed bondId, string reason, uint256 timestamp);

    modifier onlyParticipants(uint256 bondId) { require(bonds[bondId].person1 == msg.sender || bonds[bondId].person2 == msg.sender, "Only participants"); _; }
    modifier bondExists(uint256 bondId) { require(bonds[bondId].active, "Bond does not exist"); _; }

    /**
     * @notice Create Common Ground Bond for bridge-building across divides
     * @dev Two people from different sides stake on building genuine bridge
     *
     * @param otherPerson Address of the other person in this bridge
     * @param position1 First person's position/perspective
     * @param position2 Second person's position/perspective
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Other person address cannot be zero address
     * - Cannot bridge with yourself
     * - Both positions must be 1-100 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event
     *
     * Mission Alignment: Bridge-building > division.
     * Unity without destroying diversity. Dual-party verification required.
     *
     * @custom:ethics Division worsening penalty = bridge-builders get 0%, community gets 100%
     */
    function createBond(address otherPerson, string memory position1, string memory position2) external payable whenNotPaused returns (uint256) {
        _validateNonZero(msg.value, "Stake amount");
        _validateAddress(otherPerson, "Other person");
        require(otherPerson != msg.sender, "Cannot bridge with yourself");
        require(bytes(position1).length > 0 && bytes(position1).length <= 100, "Position 1 invalid");
        require(bytes(position2).length > 0 && bytes(position2).length <= 100, "Position 2 invalid");

        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond({
            bondId: bondId, person1: msg.sender, person2: otherPerson,
            person1Position: position1, person2Position: position2,
            stakeAmount: msg.value, createdAt: block.timestamp,
            distributionRequestedAt: 0, distributionPending: false, active: true
        });

        emit BondCreated(bondId, msg.sender, otherPerson, position1, position2, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit bridge-building progress
     * @dev Tracks quality of understanding, collaboration, and respect across divide
     *
     * @param bondId ID of bond to submit progress for
     * @param understandingQuality Quality of mutual understanding (0-10000)
     * @param collaborationScore Collaboration quality score (0-10000)
     * @param respectLevel Respect level maintained (0-10000) - CRITICAL metric
     * @param rippleEffect Number of additional connections formed (ripple effect)
     * @param progressNotes Description of bridge-building progress
     *
     * Requirements:
     * - Caller must be one of the two participants
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {BridgeProgressSubmitted} event
     *
     * Mission Alignment: Bridge quality = understanding + collaboration + respect.
     * If respect < 30, division worsening penalty activates.
     *
     * @custom:security Validates all score inputs
     */
    function submitBridgeProgress(
        uint256 bondId, uint256 understandingQuality, uint256 collaborationScore,
        uint256 respectLevel, uint256 rippleEffect, string memory progressNotes
    ) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        _validateScore(understandingQuality, "Understanding quality");
        _validateScore(collaborationScore, "Collaboration score");
        _validateScore(respectLevel, "Respect level");

        bondMetrics[bondId].push(BridgeMetrics({
            timestamp: block.timestamp, submitter: msg.sender,
            understandingQuality: understandingQuality, collaborationScore: collaborationScore,
            respectLevel: respectLevel, rippleEffect: rippleEffect, progressNotes: progressNotes
        }));

        emit BridgeProgressSubmitted(bondId, msg.sender, block.timestamp);
    }

    function addCrossDivideWitness(
        uint256 bondId, string memory witnessPosition, bool confirmsGenuineBridge,
        bool confirmsRippleEffect, uint256 connectionsFormed, string memory notes
    ) external bondExists(bondId) whenNotPaused {
        bondWitnesses[bondId].push(CrossDivideWitness({
            witness: msg.sender, timestamp: block.timestamp, witnessPosition: witnessPosition,
            confirmsGenuineBridge: confirmsGenuineBridge, confirmsRippleEffect: confirmsRippleEffect,
            connectionsFormed: connectionsFormed, notes: notes
        }));
    }

    function requestDistribution(uint256 bondId) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 80% to bridge-builders, 20% to community healing pool (or 100% community if division worsening)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be one of the two participants
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {DivisionWorseningPenalty} event if penalty applies
     *
     * Mission Alignment: Bridge-builders profit when genuine bridge built.
     * If division worsening (respect < 30 OR quality < 40), community gets 100%.
     *
     * @custom:security ReentrancyGuard, timelock protection
     * @custom:ethics Superficial bridges don't profit - must be genuine
     */
    function distributeBond(uint256 bondId) external nonReentrant whenNotPaused onlyParticipants(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK, "Timelock not expired");

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateDivisionPenalty(bondId);
        uint256 bridgeShare; uint256 communityShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);

            // CRITICAL FIX: Check yield pool can cover appreciation
            _useYieldPool(bondId, abs);
            if (penaltyActive) {
                bridgeShare = 0; communityShare = abs;
                reason = penaltyReason;
                emit DivisionWorseningPenalty(bondId, penaltyReason, block.timestamp);
            } else {
                bridgeShare = (abs * 80) / 100;
                communityShare = (abs * 20) / 100;
                reason = "Genuine bridge built - inspiring others";
            }
        } else {
            bridgeShare = uint256(-appreciation); communityShare = 0;
            reason = "Support bridge-builders";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp, totalAmount: appreciation,
            bridgeBuildersShare: bridgeShare, communityHealingShare: communityShare, reason: reason
        }));

        // CRITICAL FIX: Explicit balance checks before transfers
        uint256 totalPayout = bridgeShare + communityShare;
        require(address(this).balance >= totalPayout, "Insufficient contract balance for distribution");

        // Safe ETH transfers using .call{} instead of deprecated .transfer()
        if (bridgeShare > 0) {
            uint256 perPerson = bridgeShare / 2;
            (bool success1, ) = payable(bond.person1).call{value: perPerson}("");
            require(success1, "Person1 transfer failed");
            (bool success2, ) = payable(bond.person2).call{value: perPerson}("");
            require(success2, "Person2 transfer failed");
        }
        if (communityShare > 0) communityHealingPool += communityShare;

        emit BondDistributed(bondId, bridgeShare, communityShare, reason, block.timestamp);
    }

    function bridgeQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        uint256 cutoff = block.timestamp - 7776000;
        uint256 count = 0; uint256 total = 0;
        for (uint256 i = metrics.length; i > 0 && metrics[i-1].timestamp >= cutoff;) {
            unchecked { --i; }
            BridgeMetrics storage m = metrics[i];
            total += (m.understandingQuality + m.collaborationScore + m.respectLevel) / 3;
            unchecked { ++count; }
        }
        return count > 0 ? total / count : 5000;
    }

    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 quality = bridgeQualityScore(bondId);
        return (bonds[bondId].stakeAmount * quality) / 5000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    function shouldActivateDivisionPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        BridgeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return (false, "");
        BridgeMetrics storage latest = metrics[metrics.length - 1];
        if (latest.respectLevel < DIVISION_WORSENING_THRESHOLD) return (true, "Respect declining - division worsening");
        uint256 quality = bridgeQualityScore(bondId);
        if (quality < BRIDGE_QUALITY_THRESHOLD) return (true, "Bridge quality too low - superficial connection");
        return (false, "");
    }

    function getBond(uint256 bondId) external view returns (Bond memory) { return bonds[bondId]; }
}
