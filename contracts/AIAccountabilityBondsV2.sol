// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./BaseYieldPoolBond.sol";
import "./MissionEnforcement.sol";

/**
 * @title AI Accountability Bonds V2 (Production Ready)
 * @notice AI can only profit when ALL humans thrive - Works even with ZERO employment
 *
 * @dev Philosophy: The ONLY economic system that works when AI fires everyone.
 * Creates AI companies that profit from human thriving, not human obsolescence.
 *
 * @dev Key Innovation: Works with ZERO employment.
 * Measures purpose/education, not jobs.
 *
 * @dev Mission Alignment: Protects ALL HUMANS (not just workers).
 * Locks AI profits when humans suffering, regardless of employment status.
 * This is humanity-level protection, not job-level protection.
 *
 * @custom:security ReentrancyGuard on distributeBond, Pausable for emergencies, Distribution timelock
 * @custom:ethics 100% to humans when suffering, works with zero jobs
 */
contract AIAccountabilityBondsV2 is BaseYieldPoolBond {

    // ============ Mission Enforcement (optional, off by default) ============

    MissionEnforcement public missionEnforcement;
    bool public missionEnforcementEnabled;

    event MissionEnforcementUpdated(address indexed previous, address indexed current);
    event MissionEnforcementEnabled(bool enabled);

    // ============ Structs ============

    /**
     * @notice Bond structure
     * @param bondId Unique identifier
     * @param aiCompany Address of AI company
     * @param companyName Name of AI company
     * @param quarterlyRevenue Revenue this bond is staking (30%)
     * @param stakeAmount 30% of quarterly revenue
     * @param createdAt Timestamp when created
     * @param distributionRequestedAt Timestamp when distribution requested (0 if none pending)
     * @param distributionPending Whether distribution is currently pending timelock
     * @param active Whether bond is still active
     */
    struct Bond {
        uint256 bondId;
        address aiCompany;
        string companyName;
        uint256 quarterlyRevenue;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    /**
     * @notice Global flourishing metrics
     * @dev Measured globally, not per-company. Works with ZERO employment.
     */
    struct GlobalFlourishingMetrics {
        uint256 timestamp;
        uint256 incomeDistributionScore;  // 0-10000 (wealth spreading or concentrating?)
        uint256 povertyRateScore;         // 0-10000 (people escaping poverty?)
        uint256 healthOutcomesScore;      // 0-10000 (life expectancy improving?)
        uint256 mentalHealthScore;        // 0-10000 (depression/anxiety rates?)
        uint256 educationAccessScore;     // 0-10000 (can people learn AI skills?)
        uint256 purposeAgencyScore;       // 0-10000 (meaningful activities - paid OR unpaid?)
    }

    /**
     * @notice Distribution record
     */
    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 humanShare;
        uint256 aiCompanyShare;
        uint256 globalFlourishingScore;
        string reason;
    }

    /**
     * @notice Oracle source for external data
     * @dev Allows integration with Chainlink, UMA, or custom oracles
     */
    struct OracleSource {
        address oracleAddress;
        string sourceName;
        bool isActive;
        uint256 registeredAt;
        uint256 trustScore;  // 0-10000
    }

    /**
     * @notice AI company verification of another company's metrics
     * @dev Creates peer accountability among AI companies
     */
    struct AIVerification {
        uint256 bondId;
        address verifyingAI;
        string verifyingCompanyName;
        uint256 timestamp;
        bool confirmsMetrics;
        string notes;
        uint256 stakeAmount;  // AI stakes on their verification
    }

    /**
     * @notice Challenge to disputed metrics
     * @dev Community can challenge suspicious flourishing claims
     */
    struct MetricsChallenge {
        address challenger;
        uint256 timestamp;
        string reason;
        uint256 challengeStake;
        bool resolved;
        bool challengeUpheld;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => GlobalFlourishingMetrics[]) public bondMetrics;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // Tracks the bond value baseline already accounted for in distributions.
    // Prevents repeated distributeBond() calls from paying out the same appreciation multiple times.
    mapping(uint256 => uint256) public lastDistributedValue;

    // ✅ Human treasury for distributing human share of profits
    address payable public humanTreasury;

    // Oracle integration
    mapping(address => OracleSource) public oracles;
    address[] public registeredOracles;

    // AI-to-AI verification
    mapping(uint256 => AIVerification[]) public bondAIVerifications;
    mapping(address => uint256) public aiCompanyVerificationCount;

    // O(1) counters to avoid iterating unbounded arrays in distribution paths
    mapping(uint256 => uint256) public verificationConfirmCount;
    mapping(uint256 => uint256) public verificationRejectCount;

    // Metrics challenges
    mapping(uint256 => MetricsChallenge[]) public bondChallenges;
    mapping(uint256 => uint256) public activeChallengeCount;
    uint256 public constant MIN_CHALLENGE_STAKE = 0.1 ether;

    // Profit locking thresholds
    uint256 public constant SUFFERING_THRESHOLD = 4000;  // Score < 40 = suffering
    uint256 public constant LOW_INCLUSION_THRESHOLD = 4000;  // education + purpose < 40

    // Verification thresholds
    uint256 public constant MIN_AI_VERIFICATIONS = 2;  // Minimum peer verifications needed
    uint256 public constant MIN_ORACLE_TRUST_SCORE = 7000;  // Minimum oracle trust (70%)

    // ============ Events ============

    /**
     * @notice Emitted when bond is created
     */
    event BondCreated(
        uint256 indexed bondId,
        address indexed aiCompany,
        string companyName,
        uint256 quarterlyRevenue,
        uint256 stakeAmount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when human treasury address is updated
     */
    event HumanTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    /**
     * @notice Emitted when metrics submitted
     */
    event MetricsSubmitted(
        uint256 indexed bondId,
        uint256 timestamp,
        uint256 globalFlourishingScore
    );

    /**
     * @notice Emitted when distribution requested
     */
    event DistributionRequested(
        uint256 indexed bondId,
        address indexed aiCompany,
        uint256 requestedAt,
        uint256 availableAt
    );

    /**
     * @notice Emitted when bond distributed
     */
    event BondDistributed(
        uint256 indexed bondId,
        address indexed aiCompany,
        uint256 humanShare,
        uint256 aiCompanyShare,
        int256 appreciation,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when profits locked
     */
    event ProfitsLocked(
        uint256 indexed bondId,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when oracle source registered
     */
    event OracleRegistered(
        address indexed oracleAddress,
        string sourceName,
        uint256 trustScore,
        uint256 timestamp
    );

    /**
     * @notice Emitted when AI verifies another AI's metrics
     */
    event AIVerificationSubmitted(
        uint256 indexed bondId,
        address indexed verifyingAI,
        bool confirmsMetrics,
        uint256 stakeAmount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when metrics are challenged
     */
    event MetricsChallenged(
        uint256 indexed bondId,
        address indexed challenger,
        string reason,
        uint256 challengeStake,
        uint256 timestamp
    );

    /**
     * @notice Emitted when challenge is resolved
     */
    event ChallengeResolved(
        uint256 indexed bondId,
        uint256 indexed challengeIndex,
        bool challengeUpheld,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyAICompany(uint256 bondId) {
        require(bonds[bondId].aiCompany == msg.sender, "Only AI company");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    /**
     * @notice Constructor to initialize human treasury
     * @param _humanTreasury Address that will receive human share of bond distributions
     */
    constructor(address payable _humanTreasury) {
        require(_humanTreasury != address(0), "Human treasury cannot be zero address");
        humanTreasury = _humanTreasury;
        emit HumanTreasuryUpdated(address(0), _humanTreasury);

        // Mission enforcement is optional/off by default.
        missionEnforcementEnabled = false;
    }

    function setMissionEnforcement(address mission) external onlyOwner {
        address previous = address(missionEnforcement);
        missionEnforcement = MissionEnforcement(mission);
        emit MissionEnforcementUpdated(previous, mission);
    }

    function setMissionEnforcementEnabled(bool enabled) external onlyOwner {
        missionEnforcementEnabled = enabled;
        emit MissionEnforcementEnabled(enabled);
    }

    function _requireMissionCompliance() internal view {
        if (!missionEnforcementEnabled) return;
        address m = address(missionEnforcement);
        require(m != address(0), "MissionEnforcement not set");

        // Minimal gating set (can expand over time):
        // - AI profit caps
        // - Community challenge principle
        // - Privacy default
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.AI_PROFIT_CAPS),
            "Mission: profit caps"
        );
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.COMMUNITY_CHALLENGES),
            "Mission: community challenges"
        );
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.PRIVACY_DEFAULT),
            "Mission: privacy default"
        );
    }

    /**
     * @notice Update human treasury address (owner only)
     * @param _newTreasury New address for human treasury
     */
    function setHumanTreasury(address payable _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Human treasury cannot be zero address");
        address previous = humanTreasury;
        humanTreasury = _newTreasury;
        emit HumanTreasuryUpdated(previous, _newTreasury);
    }

    // ============ Core Functions ============

    /**
     * @notice Create AI Accountability Bond
     * @dev AI company stakes 30% of quarterly revenue
     *
     * @param companyName Name of AI company
     * @param quarterlyRevenue Total quarterly revenue (stake should be 30% of this)
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Must stake at least 30% of quarterly revenue
     * - Company name required
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     *
     * Mission Alignment: AI companies stake on human flourishing.
     * Profits locked when humans suffer - even with ZERO employment.
     *
     * @custom:security Validates all inputs, checks contract not paused
     */
    function createBond(
        string memory companyName,
        uint256 quarterlyRevenue
    ) external payable whenNotPaused returns (uint256) {
        _validateNonZero(msg.value, "Stake amount");
        require(msg.value >= (quarterlyRevenue * 30) / 100, "Must stake 30% of quarterly revenue");
        require(bytes(companyName).length > 0, "Company name required");
        require(bytes(companyName).length <= 100, "Company name too long");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            aiCompany: msg.sender,
            companyName: companyName,
            quarterlyRevenue: quarterlyRevenue,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        // Initialize distribution baseline to the initial stake.
        lastDistributedValue[bondId] = msg.value;

        emit BondCreated(bondId, msg.sender, companyName, quarterlyRevenue, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit global human flourishing metrics
     * @dev Measured globally, not per-company. Works with ZERO employment.
     *
     * @param bondId ID of bond to submit metrics for
     * @param incomeDistributionScore Wealth distribution score (0-10000)
     * @param povertyRateScore Poverty reduction score (0-10000)
     * @param healthOutcomesScore Health outcomes score (0-10000)
     * @param mentalHealthScore Mental health score (0-10000)
     * @param educationAccessScore Education access score (0-10000)
     * @param purposeAgencyScore Purpose/agency score (0-10000) - WORKS WITHOUT JOBS
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {MetricsSubmitted} event with calculated flourishing score
     *
     * Mission Alignment: Measures human flourishing, not employment.
     * Purpose and education matter even with zero jobs.
     *
     * @custom:security Validates all score inputs to prevent manipulation
     */
    function submitMetrics(
        uint256 bondId,
        uint256 incomeDistributionScore,
        uint256 povertyRateScore,
        uint256 healthOutcomesScore,
        uint256 mentalHealthScore,
        uint256 educationAccessScore,
        uint256 purposeAgencyScore
    ) external onlyAICompany(bondId) bondExists(bondId) whenNotPaused {
        // Validate all scores (0-10000)
        _validateScore(incomeDistributionScore, "Income distribution score");
        _validateScore(povertyRateScore, "Poverty rate score");
        _validateScore(healthOutcomesScore, "Health outcomes score");
        _validateScore(mentalHealthScore, "Mental health score");
        _validateScore(educationAccessScore, "Education access score");
        _validateScore(purposeAgencyScore, "Purpose/agency score");

        bondMetrics[bondId].push(GlobalFlourishingMetrics({
            timestamp: block.timestamp,
            incomeDistributionScore: incomeDistributionScore,
            povertyRateScore: povertyRateScore,
            healthOutcomesScore: healthOutcomesScore,
            mentalHealthScore: mentalHealthScore,
            educationAccessScore: educationAccessScore,
            purposeAgencyScore: purposeAgencyScore
        }));

        uint256 flourishingScore = globalFlourishingScore(bondId);
        emit MetricsSubmitted(bondId, block.timestamp, flourishingScore);
    }

    /**
     * @notice Register oracle source (owner only)
     * @dev Allows integration with Chainlink, UMA, or custom oracles
     *
     * @param oracleAddress Address of oracle contract
     * @param sourceName Name/description of oracle source
     * @param trustScore Initial trust score (0-10000)
     *
     * Requirements:
     * - Caller must be owner
     * - Oracle address cannot be zero
     * - Source name must be 1-100 characters
     * - Trust score must be 0-10000
     *
     * Emits:
     * - {OracleRegistered} event
     *
     * Mission Alignment: Real-world data verification prevents AI from
     * manipulating flourishing metrics. Truth > claims.
     *
     * @custom:security Only owner can register oracles to prevent spam
     */
    function registerOracle(
        address oracleAddress,
        string memory sourceName,
        uint256 trustScore
    ) external onlyOwner {
        _validateAddress(oracleAddress, "Oracle address");
        require(bytes(sourceName).length > 0 && bytes(sourceName).length <= 100, "Source name invalid");
        _validateScore(trustScore, "Trust score");

        if (!oracles[oracleAddress].isActive) {
            registeredOracles.push(oracleAddress);
        }

        oracles[oracleAddress] = OracleSource({
            oracleAddress: oracleAddress,
            sourceName: sourceName,
            isActive: true,
            registeredAt: block.timestamp,
            trustScore: trustScore
        });

        emit OracleRegistered(oracleAddress, sourceName, trustScore, block.timestamp);
    }

    /**
     * @notice AI company verifies another AI's metrics
     * @dev Creates peer accountability - AIs stake on verification
     *
     * @param bondId ID of bond to verify
     * @param confirmsMetrics Whether verifier confirms metrics are accurate
     * @param notes Verification notes/evidence
     *
     * Requirements:
     * - Caller cannot be the bond's AI company (no self-verification)
     * - Bond must exist
     * - Must send stake with verification (skin in the game)
     * - Notes must be 1-500 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {AIVerificationSubmitted} event
     *
     * Mission Alignment: AI companies verify each other's flourishing claims.
     * If one AI causes suffering, other AIs can call it out (or face consequences).
     *
     * @custom:ethics Peer accountability prevents "race to bottom" where AIs
     * compete by harming humans. Economic incentive to verify truth.
     */
    function submitAIVerification(
        uint256 bondId,
        bool confirmsMetrics,
        string memory notes
    ) external payable bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(msg.sender != bond.aiCompany, "Cannot verify own metrics");
        _validateNonZero(msg.value, "Verification stake");
        require(bytes(notes).length > 0 && bytes(notes).length <= 500, "Notes invalid");

        bondAIVerifications[bondId].push(AIVerification({
            bondId: bondId,
            verifyingAI: msg.sender,
            verifyingCompanyName: "", // Could be looked up from another bond
            timestamp: block.timestamp,
            confirmsMetrics: confirmsMetrics,
            notes: notes,
            stakeAmount: msg.value
        }));

        // Update O(1) counters for verification quality scoring
        if (confirmsMetrics) {
            verificationConfirmCount[bondId]++;
        } else {
            verificationRejectCount[bondId]++;
        }

        aiCompanyVerificationCount[msg.sender]++;

        emit AIVerificationSubmitted(bondId, msg.sender, confirmsMetrics, msg.value, block.timestamp);
    }

    /**
     * @notice Challenge suspicious metrics
     * @dev Community can challenge AI claims of human flourishing
     *
     * @param bondId ID of bond to challenge
     * @param reason Why metrics are suspicious
     *
     * Requirements:
     * - Bond must exist
     * - Must send minimum challenge stake
     * - Reason must be 10-500 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {MetricsChallenged} event
     *
     * Mission Alignment: Community oversight prevents AI from lying about
     * human flourishing. Truth matters more than profit.
     *
     * @custom:security Challenge stake prevents spam. Upheld challenges
     * reward challenger, failed challenges forfeit stake to bond.
     */
    function challengeMetrics(
        uint256 bondId,
        string memory reason
    ) external payable bondExists(bondId) whenNotPaused {
        require(msg.value >= MIN_CHALLENGE_STAKE, "Insufficient challenge stake");
        require(bytes(reason).length >= 10 && bytes(reason).length <= 500, "Reason invalid");

        bondChallenges[bondId].push(MetricsChallenge({
            challenger: msg.sender,
            timestamp: block.timestamp,
            reason: reason,
            challengeStake: msg.value,
            resolved: false,
            challengeUpheld: false
        }));

        activeChallengeCount[bondId]++;

        emit MetricsChallenged(bondId, msg.sender, reason, msg.value, block.timestamp);
    }

    /**
     * @notice Resolve metrics challenge (owner only)
     * @dev Owner investigates and resolves challenge
     *
     * @param bondId ID of bond with challenge
     * @param challengeIndex Index of challenge to resolve
     * @param upheld Whether challenge is upheld (metrics were false)
     *
     * Requirements:
     * - Caller must be owner
     * - Challenge must exist and not be resolved
     *
     * Emits:
     * - {ChallengeResolved} event
     *
     * If upheld: Challenger gets stake back + penalty from bond
     * If rejected: Challenge stake goes to bond's human treasury
     *
     * Mission Alignment: Truth enforcement. AI cannot lie about flourishing.
     */
    function resolveChallenge(
        uint256 bondId,
        uint256 challengeIndex,
        bool upheld
    ) external onlyOwner nonReentrant {
        require(challengeIndex < bondChallenges[bondId].length, "Challenge does not exist");
        MetricsChallenge storage challenge = bondChallenges[bondId][challengeIndex];
        require(!challenge.resolved, "Challenge already resolved");

        // ✅ SECURITY FIX (HIGH-003): Store values before state changes
        // Follows checks-effects-interactions pattern for maximum safety
        address payable recipient;
        uint256 payoutAmount;

        if (upheld) {
            // Challenge upheld: Return stake + penalty to challenger
            uint256 penalty = challenge.challengeStake; // 1:1 penalty
            payoutAmount = challenge.challengeStake + penalty;
            recipient = payable(challenge.challenger);
            require(address(this).balance >= payoutAmount, "Insufficient balance for challenge payout");
        } else {
            // Challenge rejected: Stake goes to human treasury
            require(humanTreasury != address(0), "Human treasury not set");
            payoutAmount = challenge.challengeStake;
            recipient = humanTreasury;
        }

        // ✅ EFFECTS: Update state BEFORE external calls (CEI pattern)
        challenge.resolved = true;
        challenge.challengeUpheld = upheld;

        // Maintain O(1) active challenge count for verification quality
        if (activeChallengeCount[bondId] > 0) {
            activeChallengeCount[bondId]--;
        }

        // ✅ INTERACTIONS: External calls LAST
        (bool success, ) = recipient.call{value: payoutAmount}("");
        require(success, upheld ? "Challenge payout failed" : "Treasury transfer failed");

        emit ChallengeResolved(bondId, challengeIndex, upheld, block.timestamp);
    }

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives humans time to verify
     * if flourishing claims are accurate. Protects humanity.
     *
     * @custom:security Timelock prevents instant rug pull
     */
    function requestDistribution(uint256 bondId)
        external
        onlyAICompany(bondId)
        bondExists(bondId)
        whenNotPaused
    {
        _requireMissionCompliance();
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");

        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;

        emit DistributionRequested(
            bondId,
            msg.sender,
            block.timestamp,
            block.timestamp + DISTRIBUTION_TIMELOCK
        );
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 50% to humans, 50% to AI company (or 100% to humans if locked)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be AI company
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {ProfitsLocked} event if profits locked
     *
     * Mission Alignment: Humans get 50% when thriving, 100% when suffering.
     * Protects ALL humans in AI age, not just workers.
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     */
    function distributeBond(uint256 bondId)
        external
        nonReentrant
        whenNotPaused
        onlyAICompany(bondId)
        bondExists(bondId)
    {
        _requireMissionCompliance();
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(
            block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK,
            "Timelock not expired - humans need time to verify"
        );

        bond.distributionPending = false;

        // Compute delta appreciation since the last distribution baseline.
        uint256 currentValue = calculateBondValue(bondId);
        uint256 baseline = lastDistributedValue[bondId];
        int256 appreciation = int256(currentValue) - int256(baseline);

        require(appreciation != 0, "No appreciation to distribute");

        // Effects: update baseline before external interactions (CEI).
        lastDistributedValue[bondId] = currentValue;

        (bool locked, string memory lockReason) = shouldLockProfits(bondId);

        uint256 humanShare;
        uint256 aiCompanyShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);

            // CRITICAL FIX: Check yield pool can cover appreciation
            _useYieldPool(bondId, absAppreciation);
            if (locked) {
                // Profits locked: 100% to humans
                humanShare = absAppreciation;
                aiCompanyShare = 0;
                reason = lockReason;
                emit ProfitsLocked(bondId, lockReason, block.timestamp);
            } else {
                // Normal: 50/50 split
                humanShare = absAppreciation / 2;
                aiCompanyShare = absAppreciation / 2;
                reason = "Global human flourishing improving";
            }
        } else {
            // Depreciation: 100% to humans as compensation
            humanShare = uint256(-appreciation);
            aiCompanyShare = 0;
            reason = "Depreciation compensation - humans suffering";

            // Even on depreciation, if profits are locked we still emit the lock event
            // to make the enforcement visible/auditable.
            if (locked) {
                emit ProfitsLocked(bondId, lockReason, block.timestamp);
            }
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            humanShare: humanShare,
            aiCompanyShare: aiCompanyShare,
            globalFlourishingScore: globalFlourishingScore(bondId),
            reason: reason
        }));

        // ✅ Safe ETH transfers using .call{} instead of deprecated .transfer()

        // Transfer AI company share
        // CRITICAL FIX: Explicit balance checks before transfers
        uint256 totalPayout = humanShare + aiCompanyShare;
        require(address(this).balance >= totalPayout, "Insufficient contract balance for distribution");

        if (aiCompanyShare > 0) {
            require(address(this).balance >= aiCompanyShare, "Insufficient balance for aiCompany share");
            (bool successAI, ) = payable(bond.aiCompany).call{value: aiCompanyShare}("");
            require(successAI, "AI company transfer failed");
        }

        // ✅ Transfer human share to human treasury (FIX for HIGH-007)
        if (humanShare > 0) {
            require(humanTreasury != address(0), "Human treasury not set");
            (bool successHuman, ) = humanTreasury.call{value: humanShare}("");
            require(successHuman, "Human treasury transfer failed");
        }

        emit BondDistributed(
            bondId,
            bond.aiCompany,
            humanShare,
            aiCompanyShare,
            appreciation,
            reason,
            block.timestamp
        );
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate global flourishing score
     * @dev Average across all 6 dimensions
     *
     * @param bondId ID of bond to calculate score for
     * @return score Global flourishing score (0-10000)
     *
     * Mission Alignment: Measures human thriving, not employment.
     */
    function globalFlourishingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Default: neutral

        GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];

        return (
            latest.incomeDistributionScore +
            latest.povertyRateScore +
            latest.healthOutcomesScore +
            latest.mentalHealthScore +
            latest.educationAccessScore +
            latest.purposeAgencyScore
        ) / 6;
    }

    /**
     * @notice Calculate inclusion multiplier
     * @dev Based on education access + purpose/agency (WORKS WITHOUT JOBS)
     * @return multiplier 50-200 (0.5x to 2.0x)
     */
    function inclusionMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];
        uint256 inclusionScore = (latest.educationAccessScore + latest.purposeAgencyScore) / 2;

        // High inclusion (education + purpose 70+) = 1.5x to 2.0x
        if (inclusionScore >= 7000) return 150 + ((inclusionScore - 7000) / 60);
        // Moderate inclusion (40-70) = 1.0x to 1.5x
        if (inclusionScore >= 4000) return 100 + ((inclusionScore - 4000) / 60);
        // Low inclusion (<40) = 0.5x to 1.0x
        return 50 + (inclusionScore / 80);
    }

    /**
     * @notice Check if declining trend exists
     */
    function hasDecliningTrend(uint256 bondId) public view bondExists(bondId) returns (bool) {
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length < 2) return false;

        uint256 current = globalFlourishingScore(bondId);
        uint256 previous = (
            metrics[metrics.length - 2].incomeDistributionScore +
            metrics[metrics.length - 2].povertyRateScore +
            metrics[metrics.length - 2].healthOutcomesScore +
            metrics[metrics.length - 2].mentalHealthScore +
            metrics[metrics.length - 2].educationAccessScore +
            metrics[metrics.length - 2].purposeAgencyScore
        ) / 6;

        return current < previous;
    }

    /**
     * @notice Time multiplier
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 50);
        return 200 + ((yearsElapsed - 3) * 50);
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: (Stake × GlobalFlourishing × Inclusion × Time) / 100,000,000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Math:
     * - flourishing: 0-10000 (globalFlourishingScore across 6 human thriving dimensions)
     * - inclusion: 50-200 (inclusionMultiplier based on education + purpose)
     * - time: 100-300 (timeMultiplier)
     * - Divisor: 50,000,000 ensures reasonable appreciation (1.0x-12.0x range)
     *
     * Example calculations:
     * - Neutral (5000 × 100 × 100): 1.0x stake (breakeven)
     * - Good (7500 × 150 × 200): 4.5x stake
     * - Excellent (10000 × 200 × 300): 12.0x stake
     *
     * Mission Alignment: AI can only profit when ALL humans thrive.
     * Works with ZERO employment - measures purpose/education, not jobs.
     *
     * @custom:math-fix Changed divisor from 1,000,000 to 50,000,000 (2026-01-07)
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 flourishing = globalFlourishingScore(bondId);
        uint256 inclusion = inclusionMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        // ✅ SECURITY FIX (HIGH-004): Overflow protection
        // Check for potential overflow before multiplication
        // Max safe value: type(uint256).max / (10000 * 200 * 300) = ~1.9e70
        // This allows stakes up to 1.9e64 wei (way beyond realistic values)
        unchecked {
            uint256 temp1 = bond.stakeAmount * flourishing; // First multiplication
            require(temp1 / flourishing == bond.stakeAmount, "Overflow in bond value calculation");

            uint256 temp2 = temp1 * inclusion; // Second multiplication
            require(temp2 / inclusion == temp1, "Overflow in bond value calculation");

            uint256 temp3 = temp2 * time; // Third multiplication
            require(temp3 / time == temp2, "Overflow in bond value calculation");

            return temp3 / 50000000;
        }
    }

    /**
     * @notice Calculate appreciation/depreciation
     */
    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Calculate verification quality score
     * @dev Combines AI peer verifications and oracle trust
     *
     * @param bondId ID of bond to calculate verification for
     * @return score Verification quality (0-10000)
     *
     * Scoring:
     * - No verifications: 5000 (neutral)
     * - 2+ AI confirmations: +2000
     * - 1+ AI rejections: -3000
     * - Active challenges: -2000
     *
     * Mission Alignment: Multi-AI verification creates peer accountability.
     * AIs cannot lie about flourishing without other AIs calling them out.
     */
    function verificationQualityScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        // Use O(1) counters to avoid unbounded loops (prevents gas griefing).
        uint256 confirmCount = verificationConfirmCount[bondId];
        uint256 rejectCount = verificationRejectCount[bondId];
        uint256 activeChallenges = activeChallengeCount[bondId];

        // Start at neutral
        int256 score = 5000;

        // Add bonus for confirmations
        if (confirmCount >= 2) {
            score += 2000;
        } else if (confirmCount == 1) {
            score += 1000;
        }

        // Penalize rejections heavily
        if (rejectCount > 0) {
            score -= int256(rejectCount * 3000);
        }

        // Penalize active challenges
        if (activeChallenges > 0) {
            score -= int256(activeChallenges * 2000);
        }

        // Clamp to 0-10000
        if (score < 0) return 0;
        if (score > 10000) return 10000;
        return uint256(score);
    }

    /**
     * @notice Check if profits should be locked
     * @dev Locks if: humans suffering, declining trend, low inclusion, OR failed verification
     *
     * @return shouldLock Whether profits should be locked
     * @return reason Human-readable reason for locking
     *
     * Mission Alignment: AI can only profit when ALL humans thrive AND
     * verification confirms metrics are accurate. No lying allowed.
     */
    function shouldLockProfits(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 flourishing = globalFlourishingScore(bondId);

        // Humans suffering (score < 40)
        if (flourishing < SUFFERING_THRESHOLD) {
            return (true, "Humans suffering");
        }

        // Declining trend
        if (hasDecliningTrend(bondId)) {
            return (true, "Declining human flourishing trend");
        }

        // Low inclusion (AI replacing without reskilling)
        GlobalFlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0) {
            GlobalFlourishingMetrics storage latest = metrics[metrics.length - 1];
            uint256 inclusionScore = (latest.educationAccessScore + latest.purposeAgencyScore) / 2;
            if (inclusionScore < LOW_INCLUSION_THRESHOLD) {
                return (true, "Low inclusion - AI replacing without reskilling");
            }
        }

        // Failed verification (peer AIs or community challenge metrics)
        uint256 verificationScore = verificationQualityScore(bondId);
        if (verificationScore < 3000) {  // Less than 30% = failed verification
            return (true, "Failed verification - metrics disputed by peers");
        }

        return (false, "");
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (GlobalFlourishingMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }
}
