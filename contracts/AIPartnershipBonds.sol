// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AI Partnership Bonds
 * @notice AI grows WITH humans, not ABOVE them
 *
 * Philosophy: AI earns when humans flourish, not when AI dominates.
 * Creates genuine AI-human partnerships where both thrive together.
 *
 * Key Innovation: AI contribution capped at 30%.
 * AI profits ONLY when human growth, autonomy, and dignity all increase.
 */
contract AIPartnershipBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address human;
        address aiAgent;
        string partnershipType;     // What kind of AI-human collaboration?
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct PartnershipMetrics {
        uint256 timestamp;
        address submitter;
        uint256 humanGrowth;       // 0-10000 (Human learning new skills?)
        uint256 humanAutonomy;     // 0-10000 (Human control increasing?)
        uint256 humanDignity;      // 0-10000 (Human dignity growing?)
        uint256 tasksMastered;     // How many tasks human now owns that AI used to do?
        uint256 creativityScore;   // 0-10000 (Human creativity amplified?)
        string progressNotes;
    }

    struct HumanVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsPartnership;  // True partnership or AI takeover?
        bool confirmsGrowth;       // Human actually growing?
        bool confirmsAutonomy;     // Human has real control?
        string relationship;       // How does verifier know?
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

    // ============ State Variables ============

    uint256 public constant AI_PROFIT_CAP = 30; // AI max 30% of proceeds

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => PartnershipMetrics[]) public bondMetrics;
    mapping(uint256 => HumanVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;

    uint256 public partnershipFund;  // Pool for funding AI-human partnerships

    // Thresholds
    uint256 public constant PARTNERSHIP_QUALITY_THRESHOLD = 4000;  // Score < 40 = AI dominating
    uint256 public constant DECLINING_AUTONOMY_THRESHOLD = 3000;   // Autonomy < 30 = takeover

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent);
    event PartnershipMetricsSubmitted(uint256 indexed bondId, address submitter);
    event HumanVerificationAdded(uint256 indexed bondId, address indexed verifier);
    event BondDistributed(uint256 indexed bondId, uint256 humanShare, uint256 aiShare);
    event AIDominationPenalty(uint256 indexed bondId, string reason);
    event TasksMastered(uint256 indexed bondId, uint256 taskCount);

    // ============ Modifiers ============

    modifier onlyHuman(uint256 bondId) {
        require(bonds[bondId].human == msg.sender, "Only bond human");
        _;
    }

    modifier onlyAI(uint256 bondId) {
        require(bonds[bondId].aiAgent == msg.sender, "Only bond AI");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create AI Partnership Bond
     * @param aiAgent Address of AI agent (wallet controlled by AI)
     * @param partnershipType Description of collaboration
     */
    function createBond(
        address aiAgent,
        string memory partnershipType
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(aiAgent != address(0), "Invalid AI address");
        require(aiAgent != msg.sender, "AI and human must be different");
        require(bytes(partnershipType).length > 0, "Must describe partnership");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            human: msg.sender,
            aiAgent: aiAgent,
            partnershipType: partnershipType,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, aiAgent);
        return bondId;
    }

    /**
     * @notice Submit partnership metrics
     * @dev Both human and AI can submit independently for verification
     */
    function submitPartnershipMetrics(
        uint256 bondId,
        uint256 humanGrowth,
        uint256 humanAutonomy,
        uint256 humanDignity,
        uint256 tasksMastered,
        uint256 creativityScore,
        string memory progressNotes
    ) external bondExists(bondId) {
        require(
            bonds[bondId].human == msg.sender || bonds[bondId].aiAgent == msg.sender,
            "Only partnership participants"
        );

        bondMetrics[bondId].push(PartnershipMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            humanGrowth: humanGrowth,
            humanAutonomy: humanAutonomy,
            humanDignity: humanDignity,
            tasksMastered: tasksMastered,
            creativityScore: creativityScore,
            progressNotes: progressNotes
        }));

        if (tasksMastered > 0) {
            emit TasksMastered(bondId, tasksMastered);
        }

        emit PartnershipMetricsSubmitted(bondId, msg.sender);
    }

    /**
     * @notice Human verification from people who know the human
     * @dev Verifies partnership is genuine, not AI takeover
     */
    function addHumanVerification(
        uint256 bondId,
        bool confirmsPartnership,
        bool confirmsGrowth,
        bool confirmsAutonomy,
        string memory relationship,
        string memory notes
    ) external bondExists(bondId) {
        bondVerifications[bondId].push(HumanVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            confirmsPartnership: confirmsPartnership,
            confirmsGrowth: confirmsGrowth,
            confirmsAutonomy: confirmsAutonomy,
            relationship: relationship,
            notes: notes
        }));

        emit HumanVerificationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate partnership quality score
     * @dev Average of growth, autonomy, dignity, creativity
     */
    function partnershipQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Neutral

        uint256 cutoff = block.timestamp - 7776000; // ~90 days
        uint256 count = 0;
        uint256 totalScore = 0;

        for (uint256 i = metrics.length; i > 0 && metrics[i-1].timestamp >= cutoff; i--) {
            PartnershipMetrics storage m = metrics[i-1];
            uint256 score = (
                m.humanGrowth +
                m.humanAutonomy +
                m.humanDignity +
                m.creativityScore
            ) / 4;
            totalScore += score;
            count++;
        }

        return count > 0 ? totalScore / count : 5000;
    }

    /**
     * @notice Human mastery multiplier
     * @dev Based on tasks human has mastered (previously done by AI)
     * @return multiplier 100-200 (1.0x to 2.0x)
     */
    function humanMasteryMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        uint256 totalTasksMastered = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            totalTasksMastered += metrics[i].tasksMastered;
        }

        // Each task mastered = +10% (capped at 2.0x)
        uint256 multiplier = 100 + (totalTasksMastered * 10);
        return multiplier > 200 ? 200 : multiplier;
    }

    /**
     * @notice Human verification multiplier
     * @dev Based on verification from people who know the human
     * @return multiplier 70-130 (0.7x to 1.3x)
     */
    function humanVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        HumanVerification[] storage verifications = bondVerifications[bondId];

        if (verifications.length == 0) return 100; // Neutral

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 partnershipConfirmations = 0;
        uint256 growthConfirmations = 0;
        uint256 autonomyConfirmations = 0;

        for (uint256 i = verifications.length; i > 0 && verifications[i-1].timestamp >= cutoff; i--) {
            recentCount++;
            if (verifications[i-1].confirmsPartnership) partnershipConfirmations++;
            if (verifications[i-1].confirmsGrowth) growthConfirmations++;
            if (verifications[i-1].confirmsAutonomy) autonomyConfirmations++;
        }

        if (recentCount == 0) return 100;

        uint256 avgRate = (
            (partnershipConfirmations * 100 / recentCount) +
            (growthConfirmations * 100 / recentCount) +
            (autonomyConfirmations * 100 / recentCount)
        ) / 3;

        if (avgRate >= 80) return 130;  // Strong verification
        if (avgRate >= 50) return 100;  // Moderate
        return 70 + (avgRate / 4);      // Weak
    }

    /**
     * @notice Time multiplier
     * @return multiplier 100-200 (1.0x to 2.0x over 3 years)
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 33);
        return 200;
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × PartnershipQuality × HumanMastery × Verification × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 quality = partnershipQualityScore(bondId);
        uint256 mastery = humanMasteryMultiplier(bondId);
        uint256 verification = humanVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * quality * mastery * verification * time) / 100000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if AI domination penalty should apply
     * @dev Penalty if: partnership quality < 40 OR autonomy declining OR no verification
     */
    function shouldActivateAIDominationPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 quality = partnershipQualityScore(bondId);

        // Poor partnership quality (AI dominating)
        if (quality < PARTNERSHIP_QUALITY_THRESHOLD) {
            return (true, "Partnership quality too low - AI dominating");
        }

        // Check autonomy specifically
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0) {
            uint256 latestAutonomy = metrics[metrics.length - 1].humanAutonomy;
            if (latestAutonomy < DECLINING_AUTONOMY_THRESHOLD) {
                return (true, "Human autonomy declining - AI takeover");
            }
        }

        // No human verification
        uint256 verification = humanVerificationMultiplier(bondId);
        if (verification <= 70) {
            return (true, "Insufficient verification - questionable partnership");
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 50% human, 30% AI (capped), 20% partnership fund IF good partnership
     *      100% human if AI dominating
     */
    function distributeBond(uint256 bondId) external nonReentrant bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(
            bond.human == msg.sender || bond.aiAgent == msg.sender,
            "Only partnership participants"
        );

        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateAIDominationPenalty(bondId);

        uint256 humanShare;
        uint256 aiShare;
        uint256 fundShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // AI domination penalty: 100% to human
                humanShare = absAppreciation;
                aiShare = 0;
                fundShare = 0;
                reason = penaltyReason;
                emit AIDominationPenalty(bondId, penaltyReason);
            } else {
                // Normal: 50% human, 30% AI, 20% fund
                humanShare = (absAppreciation * 50) / 100;
                aiShare = (absAppreciation * 30) / 100;    // AI capped at 30%
                fundShare = (absAppreciation * 20) / 100;
                reason = "Genuine AI-human partnership - both thriving";
            }
        } else {
            // Depreciation: Support human
            humanShare = uint256(-appreciation);
            aiShare = 0;
            fundShare = 0;
            reason = "Support human during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            humanShare: humanShare,
            aiShare: aiShare,
            partnershipFundShare: fundShare,
            reason: reason
        }));

        if (humanShare > 0) {
            payable(bond.human).transfer(humanShare);
        }

        if (aiShare > 0) {
            payable(bond.aiAgent).transfer(aiShare);
        }

        if (fundShare > 0) {
            partnershipFund += fundShare;
        }

        emit BondDistributed(bondId, humanShare, aiShare);
    }

    // ============ Partnership Fund Functions ============

    /**
     * @notice Donate to partnership fund
     * @dev Anyone can contribute to fund AI-human partnerships
     */
    function donateToPartnershipFund() external payable {
        require(msg.value > 0, "Must donate amount");
        partnershipFund += msg.value;
    }

    /**
     * @notice Get partnership fund balance
     */
    function getPartnershipFund() external view returns (uint256) {
        return partnershipFund;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getVerificationsCount(uint256 bondId) external view returns (uint256) {
        return bondVerifications[bondId].length;
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (PartnershipMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }

    function getTotalTasksMastered(uint256 bondId) external view bondExists(bondId) returns (uint256) {
        PartnershipMetrics[] storage metrics = bondMetrics[bondId];
        uint256 total = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            total += metrics[i].tasksMastered;
        }
        return total;
    }
}
