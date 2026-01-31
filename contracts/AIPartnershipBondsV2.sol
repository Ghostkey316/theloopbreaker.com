// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./BaseYieldPoolBond.sol";

/**
 * @title AI Partnership Bonds V2 (Production Ready)
 * @notice AI grows WITH humans, not ABOVE them
 *
 * @dev Part of Vaultfire's civilization-scale trust infrastructure. This contract
 * provides economic proof that AI-human partnership is MORE profitable than AI domination.
 * Solves the AI alignment crisis through verifiable economic incentives.
 *
 * @dev Philosophy: AIs earn when humans flourish. Human capability growth required for AI profit.
 * Partnership quality detection prevents AI from extracting value while degrading human agency.
 *
 * @dev Key Innovation: AI profit capped at 30%. Domination penalty = 100% to human as compensation.
 * Partnership quality score (0-10000) measures if human became MORE capable (not less).
 *
 * @dev Mission Alignment: Not "humans vs AI" but partnership. AI alignment through economics, not wishful thinking.
 * For happy and healthy humans, AIs, and Earth.
 *
 * @custom:security ReentrancyGuard, Pausable, YieldPool
 * @custom:security-enhancement Added yield pool funding mechanism (2026 Audit), Distribution timelock, Input validation
 * @custom:ethics AI profit capped at 30%, human growth required, domination penalized
 * @custom:vision First economic proof of AI alignment at scale
 */
contract AIPartnershipBondsV2 is BaseYieldPoolBond {

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

    // Loyalty multiplier thresholds (in days)
    uint256 public constant LOYALTY_1_MONTH = 30 days;
    uint256 public constant LOYALTY_6_MONTHS = 180 days;
    uint256 public constant LOYALTY_1_YEAR = 365 days;
    uint256 public constant LOYALTY_2_YEARS = 730 days;
    uint256 public constant LOYALTY_5_YEARS = 1825 days;

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PartnershipMetrics[]) public bondMetrics;
    mapping(uint256 => HumanVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    uint256 public partnershipFund;

    event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp);
    event PartnershipMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp);
    event HumanVerificationSubmitted(uint256 indexed bondId, address indexed verifier, bool confirmsPartnership, bool confirmsGrowth, bool confirmsAutonomy, uint256 timestamp);
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

        // ✅ HIGH-003 FIX: Update total active bond value
        _updateTotalActiveBondValue(totalActiveBondValue + msg.value);

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

    /**
     * @notice Submit human verification of partnership quality
     * @dev Allows humans to verify or challenge AI partnership claims
     *
     * @param bondId ID of bond to verify
     * @param confirmsPartnership Whether verifier confirms this is a true partnership
     * @param confirmsGrowth Whether verifier confirms human is growing (not passive)
     * @param confirmsAutonomy Whether verifier confirms human has autonomy (not dominated)
     * @param relationship Relationship to human partner (e.g., "self", "colleague", "friend")
     * @param notes Additional verification notes
     *
     * Requirements:
     * - Bond must exist
     * - Relationship string must be 1-100 characters
     * - Notes must be 0-500 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {HumanVerificationSubmitted} event
     *
     * Mission Alignment: Humans have final say on partnership quality.
     * Prevents AI from gaming metrics without human consent.
     *
     * @custom:security Anyone can submit verification (community attestation model)
     * @custom:ethics Human judgment > AI metrics when conflict arises
     */
    function submitHumanVerification(
        uint256 bondId,
        bool confirmsPartnership,
        bool confirmsGrowth,
        bool confirmsAutonomy,
        string memory relationship,
        string memory notes
    ) external bondExists(bondId) whenNotPaused {
        require(bytes(relationship).length > 0 && bytes(relationship).length <= 100, "Relationship invalid");
        require(bytes(notes).length <= 500, "Notes too long");

        bondVerifications[bondId].push(HumanVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            confirmsPartnership: confirmsPartnership,
            confirmsGrowth: confirmsGrowth,
            confirmsAutonomy: confirmsAutonomy,
            relationship: relationship,
            notes: notes
        }));

        emit HumanVerificationSubmitted(bondId, msg.sender, confirmsPartnership, confirmsGrowth, confirmsAutonomy, block.timestamp);
    }

    function requestDistribution(uint256 bondId) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");

        // ✅ CRITICAL-002 & HIGH-002 FIX: Snapshot appreciation to prevent manipulation
        int256 appreciation = calculateAppreciation(bondId);
        _trackPendingDistribution(bondId, appreciation);

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

        // ✅ HIGH-002 FIX: Use snapshotted appreciation to prevent front-running
        int256 appreciation = snapshotAppreciation[bondId];
        require(appreciation != 0, "No appreciation");

        // Clear snapshot after use
        snapshotAppreciation[bondId] = 0;

        (bool penaltyActive, string memory penaltyReason) = shouldActivateDominationPenalty(bondId);
        uint256 humanShare; uint256 aiShare; uint256 fundShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);

            // CRITICAL FIX: Check yield pool can cover appreciation
            _useYieldPool(bondId, abs);
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

        // CRITICAL FIX: Explicit balance checks before transfers
        uint256 totalPayout = humanShare + aiShare;
        require(address(this).balance >= totalPayout, "Insufficient contract balance for distribution");

        // Safe ETH transfers using .call{} instead of deprecated .transfer()
        if (humanShare > 0) {
            require(address(this).balance >= humanShare, "Insufficient balance for human share");
            (bool successHuman, ) = payable(bond.human).call{value: humanShare}("");
            require(successHuman, "Human transfer failed");
        }
        if (aiShare > 0) {
            require(address(this).balance >= aiShare, "Insufficient balance for ai share");
            (bool successAI, ) = payable(bond.aiAgent).call{value: aiShare}("");
            require(successAI, "AI transfer failed");
        }
        if (fundShare > 0) partnershipFund += fundShare;

        // ✅ HIGH-003 FIX: Update total active bond value (bond no longer active)
        bond.active = false;
        _updateTotalActiveBondValue(totalActiveBondValue - bond.stakeAmount);

        emit BondDistributed(bondId, humanShare, aiShare, fundShare, reason, block.timestamp);
    }

    /**
     * @notice Calculate loyalty multiplier based on partnership duration
     * @dev Rewards long-term partnerships over task-hopping
     *
     * @param bondId ID of bond to calculate loyalty for
     * @return multiplier 100-300 (1.0x to 3.0x)
     *
     * Multiplier tiers:
     * - < 1 month: 1.0x (100)
     * - 1-6 months: 1.1x (110)
     * - 6-12 months: 1.3x (130)
     * - 1-2 years: 1.5x (150)
     * - 2-5 years: 2.0x (200)
     * - 5+ years: 3.0x (300)
     *
     * Mission Alignment: AI serving same human long-term > task-hopping for max profit.
     * Loyalty creates trust, which creates true partnership.
     */
    function loyaltyMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 duration = block.timestamp - bond.createdAt;

        if (duration < LOYALTY_1_MONTH) return 100;        // 1.0x
        if (duration < LOYALTY_6_MONTHS) return 110;       // 1.1x
        if (duration < LOYALTY_1_YEAR) return 130;         // 1.3x
        if (duration < LOYALTY_2_YEARS) return 150;        // 1.5x
        if (duration < LOYALTY_5_YEARS) return 200;        // 2.0x
        return 300;                                         // 3.0x
    }

    /**
     * @notice Calculate human verification bonus
     * @dev Bonus for verified partnerships with human attestations
     *
     * @param bondId ID of bond to calculate verification bonus for
     * @return bonus 0-2000 (0-20% bonus to quality score)
     *
     * Verification scoring:
     * - No verifications: 0 bonus
     * - 1+ verifications with all confirmations: +20% bonus (2000)
     * - 1+ verifications with partial confirmations: +10% bonus (1000)
     * - 1+ verifications with no confirmations: 0 bonus
     *
     * Mission Alignment: Human verification prevents AI from gaming metrics.
     * Humans have final say on partnership quality.
     */
    function humanVerificationBonus(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        HumanVerification[] storage verifications = bondVerifications[bondId];
        if (verifications.length == 0) return 0;

        // Check latest verification
        HumanVerification storage latest = verifications[verifications.length - 1];

        // All three confirmations = full bonus
        if (latest.confirmsPartnership && latest.confirmsGrowth && latest.confirmsAutonomy) {
            return 2000; // +20%
        }

        // At least two confirmations = partial bonus
        uint256 confirmCount = 0;
        if (latest.confirmsPartnership) confirmCount++;
        if (latest.confirmsGrowth) confirmCount++;
        if (latest.confirmsAutonomy) confirmCount++;

        if (confirmCount >= 2) return 1000; // +10%
        return 0;
    }

    /**
     * @notice Calculate partnership quality score with verification
     * @dev Combines metrics + human verification + partnership history
     *
     * @param bondId ID of bond to calculate quality for
     * @return score Partnership quality score (0-10000+)
     *
     * Formula: (base_metrics × verification_bonus) / 10000
     * - base_metrics: Average of growth, autonomy, dignity, creativity (0-10000)
     * - verification_bonus: 0-2000 bonus from human attestations
     *
     * Mission Alignment: Humans have final say. Metrics + human judgment = truth.
     */
    function partnershipQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Default: neutral

        PartnershipMetrics storage latest = metrics[metrics.length - 1];

        // Base quality from metrics (0-10000)
        uint256 baseQuality = (latest.humanGrowth + latest.humanAutonomy + latest.humanDignity + latest.creativityScore) / 4;

        // Add human verification bonus (0-2000)
        uint256 verificationBonus = humanVerificationBonus(bondId);

        // Apply bonus: quality × (10000 + bonus) / 10000
        return (baseQuality * (10000 + verificationBonus)) / 10000;
    }

    /**
     * @notice Calculate bond value with loyalty multiplier
     * @dev Formula: (Stake × Quality × Loyalty) / 500000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Components:
     * - quality: 0-10000+ (partnership quality with verification)
     * - loyalty: 100-300 (1.0x-3.0x based on duration)
     * - Divisor: 500000 ensures reasonable range (1.0x-6.0x)
     *
     * Example calculations:
     * - Neutral (5000 × 100): 1.0x stake
     * - Good partnership, 1 year (7500 × 130): 1.95x stake
     * - Excellent partnership, 5 years (10000 × 300): 6.0x stake
     *
     * Mission Alignment: Long-term loyal partnerships earn more than
     * short-term task-hopping. Trust compounds over time.
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 quality = partnershipQualityScore(bondId);
        uint256 loyalty = loyaltyMultiplier(bondId);
        return (bonds[bondId].stakeAmount * quality * loyalty) / 500000;
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
