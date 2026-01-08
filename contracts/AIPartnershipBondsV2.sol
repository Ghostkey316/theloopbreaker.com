// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title AI Partnership Bonds V2 (Production Ready)
 * @notice AI grows WITH humans, not ABOVE them
 *
 * @custom:security ReentrancyGuard, Pausable, Distribution timelock, Input validation
 * @custom:ethics AI profit capped at 30%, human growth required
 */
contract AIPartnershipBondsV2 is BaseDignityBond {

    struct Bond {
        uint256 bondId;
        address human;
        address aiAgent;
        string partnershipType;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    struct PartnershipMetrics {
        uint256 timestamp;
        address submitter;
        uint256 humanGrowth;        // 0-10000
        uint256 humanAutonomy;      // 0-10000
        uint256 humanDignity;       // 0-10000
        uint256 tasksMastered;
        uint256 creativityScore;    // 0-10000
        string progressNotes;
    }

    struct HumanVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsPartnership;
        bool confirmsGrowth;
        bool confirmsAutonomy;
        string relationship;
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 humanShare;
        uint256 aiShare;
        uint256 partnershipFundShare;
        string reason;
    }

    uint256 public constant AI_PROFIT_CAP = 30;
    uint256 public constant PARTNERSHIP_QUALITY_THRESHOLD = 4000;
    uint256 public constant DECLINING_AUTONOMY_THRESHOLD = 3000;

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PartnershipMetrics[]) public bondMetrics;
    mapping(uint256 => HumanVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    uint256 public partnershipFund;

    event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp);
    event PartnershipMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp);
    event DistributionRequested(uint256 indexed bondId, address indexed requester, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 humanShare, uint256 aiShare, uint256 fundShare, string reason, uint256 timestamp);
    event AIDominationPenalty(uint256 indexed bondId, string reason, uint256 timestamp);

    modifier onlyParticipants(uint256 bondId) { require(bonds[bondId].human == msg.sender || bonds[bondId].aiAgent == msg.sender, "Only participants"); _; }
    modifier bondExists(uint256 bondId) { require(bonds[bondId].active, "Bond does not exist"); _; }

    /**
     * @notice Create AI Partnership Bond
     * @dev Human and AI partner - bond appreciates when human GROWS, not when AI dominates
     *
     * @param aiAgent Address of the AI agent partner
     * @param partnershipType Description of partnership (e.g., "coding assistant", "research partner")
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - AI agent address cannot be zero address
     * - AI agent cannot be same as human
     * - Partnership type must be 1-200 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event
     *
     * Mission Alignment: AI grows WITH humans, not ABOVE them.
     * AI profit capped at 30% - human must thrive for AI to profit.
     *
     * @custom:ethics AI domination penalty = AI gets 0%, human gets 100%
     */
    function createBond(address aiAgent, string memory partnershipType) external payable whenNotPaused returns (uint256) {
        _validateNonZero(msg.value, "Stake amount");
        _validateAddress(aiAgent, "AI agent");
        require(aiAgent != msg.sender, "AI and human must be different");
        require(bytes(partnershipType).length > 0 && bytes(partnershipType).length <= 200, "Partnership type invalid");

        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond({
            bondId: bondId, human: msg.sender, aiAgent: aiAgent, partnershipType: partnershipType,
            stakeAmount: msg.value, createdAt: block.timestamp,
            distributionRequestedAt: 0, distributionPending: false, active: true
        });

        emit BondCreated(bondId, msg.sender, aiAgent, partnershipType, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit partnership quality metrics
     * @dev Tracks human growth in AI partnership - not AI dominance
     *
     * @param bondId ID of bond to submit metrics for
     * @param humanGrowth Human skill growth score (0-10000)
     * @param humanAutonomy Human autonomy level (0-10000) - CRITICAL metric
     * @param humanDignity Human dignity in partnership (0-10000)
     * @param tasksMastered Number of new tasks human has mastered
     * @param creativityScore Human creativity score (0-10000)
     * @param progressNotes Description of partnership progress
     *
     * Requirements:
     * - Caller must be human or AI agent
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {PartnershipMetricsSubmitted} event
     *
     * Mission Alignment: Measures human growth, not AI efficiency.
     * If human autonomy < 30, AI domination penalty activates.
     *
     * @custom:security Validates all score inputs
     */
    function submitPartnershipMetrics(
        uint256 bondId, uint256 humanGrowth, uint256 humanAutonomy, uint256 humanDignity,
        uint256 tasksMastered, uint256 creativityScore, string memory progressNotes
    ) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        _validateScore(humanGrowth, "Human growth");
        _validateScore(humanAutonomy, "Human autonomy");
        _validateScore(humanDignity, "Human dignity");
        _validateScore(creativityScore, "Creativity score");

        bondMetrics[bondId].push(PartnershipMetrics({
            timestamp: block.timestamp, submitter: msg.sender,
            humanGrowth: humanGrowth, humanAutonomy: humanAutonomy, humanDignity: humanDignity,
            tasksMastered: tasksMastered, creativityScore: creativityScore, progressNotes: progressNotes
        }));

        emit PartnershipMetricsSubmitted(bondId, msg.sender, block.timestamp);
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
     * @dev 60% human, 30% AI, 10% partnership fund (or 100% human if AI dominating)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be human or AI agent
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {AIDominationPenalty} event if penalty applies
     *
     * Mission Alignment: AI profit capped at 30%.
     * If AI dominating (human autonomy < 30), human gets 100%, AI gets 0%.
     *
     * @custom:security ReentrancyGuard, timelock protection
     * @custom:ethics AI can only profit when human thrives
     */
    function distributeBond(uint256 bondId) external nonReentrant whenNotPaused onlyParticipants(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK, "Timelock not expired");

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateDominationPenalty(bondId);
        uint256 humanShare; uint256 aiShare; uint256 fundShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);
            if (penaltyActive) {
                humanShare = abs; aiShare = 0; fundShare = 0;
                reason = penaltyReason;
                emit AIDominationPenalty(bondId, penaltyReason, block.timestamp);
            } else {
                humanShare = (abs * 60) / 100;
                aiShare = (abs * 30) / 100;
                fundShare = (abs * 10) / 100;
                reason = "True partnership - both thriving";
            }
        } else {
            humanShare = uint256(-appreciation); aiShare = 0; fundShare = 0;
            reason = "Support human during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp, totalAmount: appreciation,
            humanShare: humanShare, aiShare: aiShare, partnershipFundShare: fundShare, reason: reason
        }));

        // Safe ETH transfers using .call{} instead of deprecated .transfer()
        if (humanShare > 0) {
            (bool successHuman, ) = payable(bond.human).call{value: humanShare}("");
            require(successHuman, "Human transfer failed");
        }
        if (aiShare > 0) {
            (bool successAI, ) = payable(bond.aiAgent).call{value: aiShare}("");
            require(successAI, "AI transfer failed");
        }
        if (fundShare > 0) partnershipFund += fundShare;

        emit BondDistributed(bondId, humanShare, aiShare, fundShare, reason, block.timestamp);
    }

    function partnershipQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        PartnershipMetrics storage latest = metrics[metrics.length - 1];
        return (latest.humanGrowth + latest.humanAutonomy + latest.humanDignity + latest.creativityScore) / 4;
    }

    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 quality = partnershipQualityScore(bondId);
        return (bonds[bondId].stakeAmount * quality) / 5000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    function shouldActivateDominationPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return (false, "");
        PartnershipMetrics storage latest = metrics[metrics.length - 1];
        if (latest.humanAutonomy < DECLINING_AUTONOMY_THRESHOLD) return (true, "AI dominating - human autonomy declining");
        uint256 quality = partnershipQualityScore(bondId);
        if (quality < PARTNERSHIP_QUALITY_THRESHOLD) return (true, "Poor partnership quality");
        return (false, "");
    }

    function getBond(uint256 bondId) external view returns (Bond memory) { return bonds[bondId]; }
}
